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
    const rawToken = socket.handshake?.auth?.token;
    const token = typeof rawToken === 'string' ? rawToken : '';
    const clientIp =
      socket.handshake?.headers?.['x-forwarded-for'] ||
      socket.handshake?.address;

    try {
      if (!token) {
        log?.warn(
          {
            clientIp,
            hasToken: false,
            tokenLength: 0,
            tokenSegments: 0,
          },
          'WebSocket authentication failed: missing token'
        );
        socket.disconnect(true);
        return next(new Error('Authentication error'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      log?.warn(
        {
          err,
          clientIp,
          hasToken: Boolean(token),
          tokenLength: token.length,
          tokenSegments: token ? token.split('.').length : 0,
        },
        'WebSocket authentication failed during token verification'
      );
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
