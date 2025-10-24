import { Server } from "socket.io";

let io;
export const userSockets = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "https://global-learning-bridge-charity-proj.vercel.app",
        "http://localhost:5173",
        "http://5.223.51.13",
      ],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      return next(new Error("User ID is required"));
    }
    socket.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket?.userId, socket.id);

    userSockets.set(socket?.userId, socket.id);

    socket.on("disconnect", () => {
      for (const [key, value] of userSockets.entries()) {
        if (value === socket.id) {
          userSockets.delete(key);
          break;
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export const getUserSocketId = (userId) => userSockets.get(userId);
