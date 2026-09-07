import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import express from 'express';
import request from 'supertest';
import { Server } from 'socket.io';
import { io as connect, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createServer } from 'http';
import { incrementRequestCount, prepareSharedState, SOCKET_EVENTS } from './sharedState';
import { createMongoSocketAdapter } from '../socket';
import { rateLimiter } from '../middleware/rateLimiter';

let database: MongoMemoryReplSet;
beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ args: ['--nounixsocket'] }] });
  await mongoose.connect(database.getUri());
  await prepareSharedState();
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });

test('concurrent requests are counted exactly once and a new time window resets the limit', async () => {
  const counts = await Promise.all(Array.from({ length: 120 }, () => incrementRequestCount('concurrent-client', 60, 60000)));
  expect(counts.sort((a,b) => a-b)).toEqual(Array.from({length:120}, (_,i)=>i+1));
  expect(await incrementRequestCount('concurrent-client', 60, 120000)).toBe(1);
  expect(await incrementRequestCount('different-client', 60, 60000)).toBe(1);
});

test('temporary counters and socket events have TTL indexes', async () => {
  const counterIndexes = await mongoose.connection.db!.collection('request_limits').indexes();
  const socketIndexes = await mongoose.connection.db!.collection(SOCKET_EVENTS).indexes();
  expect(counterIndexes.some(index => index.expireAfterSeconds === 0)).toBe(true);
  expect(socketIndexes.some(index => index.expireAfterSeconds === 300)).toBe(true);
});

test('HTTP requests are blocked after the shared limit is exhausted', async () => {
  const app = express().use(rateLimiter).get('/', (_req,res)=>res.sendStatus(200));
  const responses = await Promise.all(Array.from({length:101},()=>request(app).get('/')));
  expect(responses.filter(response=>response.status===200)).toHaveLength(100);
  expect(responses.filter(response=>response.status===429)).toHaveLength(1);
  expect(responses.find(response=>response.status===429)!.headers['retry-after']).toBe('60');
});

test('production requests fail closed when the shared store is unavailable', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const failure = jest.spyOn(mongoose.connection.db!, 'collection').mockImplementation(() => { throw new Error('Unavailable'); });
  try {
    const app = express().use(rateLimiter).get('/', (_req,res)=>res.sendStatus(200));
    expect((await request(app).get('/')).status).toBe(503);
  } finally {
    failure.mockRestore();
    process.env.NODE_ENV = previous;
  }
});

test('MongoDB broadcasts reach the matching hospital on another server only', async () => {
  const http1 = createServer();
  const http2 = createServer();
  const server1 = new Server(http1, {transports:['websocket']});
  const server2 = new Server(http2, {transports:['websocket']});
  server1.adapter(createMongoSocketAdapter());
  server2.adapter(createMongoSocketAdapter());
  const clients: Socket[] = [];
  try {
    await new Promise<void>(resolve=>http1.listen(0, '127.0.0.1',resolve));
    await new Promise<void>(resolve=>http2.listen(0, '127.0.0.1',resolve));
    server2.on('connection',socket=> { void socket.join(socket.handshake.auth.room); socket.emit('ready'); });
    for(const room of ['hospital:a','hospital:b']) {
      const client=connect(`http://127.0.0.1:${(http2.address() as AddressInfo).port}`, {transports:['websocket'],auth:{room}});
      clients.push(client);
      await new Promise<void>((resolve,reject)=>{ client.once('ready',resolve);client.once('connect_error',reject); });
    }
    const wrongTenant=jest.fn();
    clients[1].on('record-updated',wrongTenant);
    const received=new Promise<unknown>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Cross-instance update timed out')),5000);
      clients[0].once('record-updated',data=>{clearTimeout(timer);resolve(data);});
    });
    server1.to('hospital:a').emit('record-updated',{id:'demo-record'});
    expect(await received).toEqual({id:'demo-record'});
    expect(wrongTenant).not.toHaveBeenCalled();
  } finally {
    clients.forEach(client=>client.disconnect());
    await Promise.all([new Promise<void>(resolve=>server1.close(()=>resolve())),new Promise<void>(resolve=>server2.close(()=>resolve()))]);
  }
});
