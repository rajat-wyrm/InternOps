import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) return socket;
  // Use same env var as axios.js for consistency (#25)
  const apiUrl =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  socket = io(apiUrl, {
    auth: { token },
    withCredentials: true,
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
