import { io } from "socket.io-client";
import { SERVER_URL, USE_MOCKS } from "./api";

export const socket = io(SERVER_URL, { autoConnect: !USE_MOCKS });

// room -> number of components using it
const rooms = new Map();

// After a reconnect the server has forgotten our rooms, so join them again.
// The server answers each join with the current snapshot, so the UI re-syncs.
socket.on("connect", () => {
  for (const room of rooms.keys()) socket.emit("join", room);
});

export function joinRoom(room) {
  const n = rooms.get(room) ?? 0;
  rooms.set(room, n + 1);
  if (n === 0 && socket.connected) socket.emit("join", room);
}

export function leaveRoom(room) {
  const n = (rooms.get(room) ?? 1) - 1;
  if (n <= 0) rooms.delete(room);
  else rooms.set(room, n);
}
