import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "../db/redis";
import { logger } from "../middleware/requestLogger";
import { env } from "../config/env";
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
  jwtSecret: string,
): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  try {
    const redisClient = getRedisClient();
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis adapter enabled");
  } catch {
    logger.warn("Socket.io Redis adapter disabled — Redis unavailable");
  }

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as SocketAuthUser;
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
