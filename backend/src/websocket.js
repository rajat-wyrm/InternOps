const { Server } = require('socket.io');
const config = require('./config');

let io = null;

function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
  });
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('authenticate', (token) => {
      // verify JWT and join user room
      try {
        const { verifyAccessToken } = require('./utils/tokens');
        const decoded = verifyAccessToken(token);
        socket.join(`user_${decoded.id}`);
        socket.userId = decoded.id;
      } catch (err) {}
    });
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
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
