const { Server } = require('socket.io');
const config = require('./config');
const { verifyAccessToken } = require('./utils/tokens');

let io = null;
let log = null;

function initializeWebSocket(server, logger) {
  log = logger;
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        socket.disconnect(true);
        return next(new Error('Authentication error'));
      }
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      next();
    } catch {
      socket.disconnect(true);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user_${socket.userId}`);
    socket.on('disconnect', () => {
      log.info({ socketId: socket.id }, 'Client disconnected');
    });
  });
  return io;
}

function getIO() {
  return io;
}

async function notifyUser(userId, event, data) {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

module.exports = { initializeWebSocket, getIO, notifyUser };
