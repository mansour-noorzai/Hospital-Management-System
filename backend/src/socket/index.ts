import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createAdapter as createMongoAdapter } from '@socket.io/mongo-adapter';
import mongoose from 'mongoose';
import { usesRedis } from '../config/stateBackend';
import { SOCKET_EVENTS } from '../db/sharedState';
import { getRedisClient } from "../db/redis";
import { logger } from "../middleware/requestLogger";
import { isAllowedOrigin } from "../config/origins";
import jwt from "jsonwebtoken";
import { User } from '../models/User';
import { currentHospitalId } from '../tenant/context';

export let io: SocketServer;

interface SocketAuthUser {
  _id: string;
  role: string;
  hospitalId: string;
  sessionVersion: number;
}

export function initSocket(
  httpServer: HttpServer,
  jwtSecret?: string,
  ready?: () => Promise<void>,
): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    },
    transports: process.env.VERCEL ? ["websocket"] : ["websocket", "polling"],
    allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin)),
  });

  // JWT auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      if (ready) await ready();
      await connectSocketAdapter();
    } catch { return next(new Error("Service is temporarily unavailable")); }
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, jwtSecret || process.env.JWT_SECRET!) as SocketAuthUser;
      void User.findById(payload._id).select('+sessionVersion').lean().then((user) => {
        if (!user || !user.isActive || user.status !== 'active' || user.forcePasswordChange || !user.hospitalId ||
            user.hospitalId.toString() !== payload.hospitalId || user.role !== payload.role ||
            user.sessionVersion !== payload.sessionVersion) return next(new Error('Session is no longer valid'));
        socket.data.user = payload;
        next();
      }).catch(() => next(new Error('Authentication failed')));
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketAuthUser;
    logger.info(`Socket connected: ${user._id} (${user.role})`);

    // Join user-specific room
    void socket.join(`user:${user._id}`);
    void socket.join(`hospital:${user.hospitalId}`);

    // Join role-specific room
    void socket.join(`role:${user.role}:${user.hospitalId}`);

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${user._id} — ${reason}`);
    });
  });

  logger.info("Socket.io initialized");
  return io;
}

let adapterReady: Promise<void> | undefined;

export function createMongoSocketAdapter() {
  if (!mongoose.connection.db) throw new Error('Database unavailable');
  return createMongoAdapter(mongoose.connection.db.collection(SOCKET_EVENTS), {
    addCreatedAtField: true,
    changeStreamOptions: { maxAwaitTimeMS: 1000 },
  });
}

export async function connectSocketAdapter(): Promise<void> {
  if (!io) return;
  if (!adapterReady) adapterReady = (async () => {
    if (!usesRedis()) {
      io.adapter(createMongoSocketAdapter());
      return;
    }
    const client = getRedisClient();
    const pubClient = client.duplicate({ lazyConnect: true });
    const subClient = client.duplicate({ lazyConnect: true });
    pubClient.on('error', () => logger.warn('Socket publisher connection error'));
    subClient.on('error', () => logger.warn('Socket subscriber connection error'));
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
    } catch (error) {
      pubClient.disconnect();
      subClient.disconnect();
      throw error;
    }
  })().catch(error => {
    adapterReady = undefined;
    if (process.env.NODE_ENV === 'production') throw error;
    logger.warn('Socket adapter unavailable in local development');
  });
  return adapterReady;
}

// Helper: emit to a specific user
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

// Helper: emit to all users with a role
export function emitToRole(role: string, event: string, data: unknown): void {
  const hospitalId = currentHospitalId();
  if (!hospitalId) {
    logger.warn('Tenant-scoped socket event skipped because no hospital context was available', { role, event });
    return;
  }
  io?.to(`role:${role}:${hospitalId}`).emit(event, data);
}

export function emitToHospital(hospitalId: string, event: string, data: unknown): void {
  io?.to(`hospital:${hospitalId}`).emit(event, data);
}

export function emitToCurrentHospital(event: string, data: unknown): void {
  const hospitalId = currentHospitalId();
  if (hospitalId) emitToHospital(hospitalId, event, data);
}

export function emitToHospitalRole(hospitalId: string, role: string, event: string, data: unknown): void {
  io?.to(`role:${role}:${hospitalId}`).emit(event, data);
}
