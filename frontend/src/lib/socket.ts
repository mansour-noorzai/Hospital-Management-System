import { io, Socket } from 'socket.io-client';
import { store } from '@/store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const token = store.getState().auth.accessToken;
  if (!token) return;
  const s = getSocket();
  // Obtain a fresh JWT after a reconnect or access-token rotation.
  s.auth = callback => callback({ token: store.getState().auth.accessToken });
  s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
