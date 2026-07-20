const { Server } = require('socket.io');
const config = require('./config');
const { verifyAccessToken } = require('./utils/tokens');

let io = null;
let log = null;
const pendingUnauthenticatedConnections = new Set();

function cleanupPendingConnection(engineSocket) {
  if (!engineSocket) return;
  if (engineSocket.authTimeout) {
    clearTimeout(engineSocket.authTimeout);
    engineSocket.authTimeout = null;
  }
  pendingUnauthenticatedConnections.delete(engineSocket);
}

function scheduleAuthTimeout(engineSocket, clientIp) {
  if (!engineSocket) return;

  pendingUnauthenticatedConnections.add(engineSocket);
  engineSocket.authTimeout = setTimeout(() => {
    if (!pendingUnauthenticatedConnections.has(engineSocket)) return;

    log?.warn(
      {
        clientIp,
        socketId: engineSocket.id,
      },
      'WebSocket unauthenticated connection timed out'
    );

    cleanupPendingConnection(engineSocket);
    engineSocket.close();
  }, config.websocket.authTimeoutMs);
}

function initializeWebSocket(server, logger) {
  log = logger;
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
  });

  io.engine.on('connection', (engineSocket) => {
    if (
      pendingUnauthenticatedConnections.size >=
      config.websocket.maxUnauthenticatedConnections
    ) {
      const clientIp =
        engineSocket.request?.headers?.['x-forwarded-for'] ||
        engineSocket.request?.socket?.remoteAddress;
      log?.warn(
        {
          clientIp,
          socketId: engineSocket.id,
          pendingConnections: pendingUnauthenticatedConnections.size,
          maxUnauthenticatedConnections:
            config.websocket.maxUnauthenticatedConnections,
        },
        'WebSocket connection rejected: maximum unauthenticated connections reached'
      );
      engineSocket.close();
      return;
    }

    const clientIp =
      engineSocket.request?.headers?.['x-forwarded-for'] ||
      engineSocket.request?.socket?.remoteAddress;
    scheduleAuthTimeout(engineSocket, clientIp);
    engineSocket.on('close', () => cleanupPendingConnection(engineSocket));
  });

  io.use((socket, next) => {
    const engineSocket = socket.conn;
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
        cleanupPendingConnection(engineSocket);
        socket.disconnect(true);
        return next(new Error('Authentication error'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      cleanupPendingConnection(engineSocket);
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
      cleanupPendingConnection(engineSocket);
      socket.disconnect(true);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    cleanupPendingConnection(socket.conn);

    if (!socket.userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user_${socket.userId}`);
    socket.on('disconnect', () => {
      cleanupPendingConnection(socket.conn);
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
