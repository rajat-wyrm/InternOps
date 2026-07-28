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
    allowRequest: (req, callback) => {
      const url = new URL(req.url, 'http://localhost');
      const token =
        url.searchParams.get('token') ||
        (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : null) ||
        req.headers['sec-websocket-protocol'];

      if (token) {
        try {
          verifyAccessToken(token);
        } catch (err) {
          log?.warn(
            {
              err,
              clientIp:
                req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
            },
            'WebSocket handshake authentication failed: invalid token'
          );
          return callback('Unauthorized', false);
        }
      }
      callback(null, true);
    },
  });

  io.use((socket, next) => {
    const rawToken =
      socket.handshake?.auth?.token ||
      socket.handshake?.query?.token ||
      (socket.handshake?.headers?.authorization &&
      socket.handshake.headers.authorization.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);
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
    // Attach error listener to prevent process crashes
    socket.on('error', (err) => {
      log?.error({ err, userId: socket.userId }, 'WebSocket connection error');
    });

    if (socket.conn) {
      socket.conn.on('error', (err) => {
        log?.error(
          { err, userId: socket.userId },
          'Underlying socket connection error'
        );
      });
    }

    socket.join(`user_${socket.userId}`);
    socket.on('disconnect', () => {
      log?.info({ socketId: socket.id }, 'Client disconnected');
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
