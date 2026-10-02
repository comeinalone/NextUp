import { tokenSnapshot, serviceSnapshot, counterSnapshot } from "../core/snapshots.js";

let io = null;

// Turn a room name into [event name, function that builds the payload].
// Rooms we don't build snapshots for yet (manager, display, staff) return null.
function resolveRoom(room) {
  const [kind, id] = String(room).split(":");
  if (kind === "token" && id) return ["token:update", () => tokenSnapshot(id)];
  if (kind === "service" && id) return ["service:update", () => serviceSnapshot(Number(id))];
  if (kind === "counter" && id) return ["counter:update", () => counterSnapshot(Number(id))];
  return null;
}

// Send the current snapshot of a room to a target (one socket, or a whole room).
// A bad room name or an unknown token must never crash the server.
function send(target, room) {
  const entry = resolveRoom(room);
  if (!entry) return;
  try {
    target.emit(entry[0], entry[1]());
  } catch (e) {
    console.warn(`[broadcast] skipped ${room}: ${e.message}`);
  }
}

// Call once at startup with the Socket.IO server.
export function initBroadcaster(server) {
  io = server;
  io.on("connection", (socket) => {
    socket.on("join", (room) => {
      if (typeof room !== "string") return;
      socket.join(room);
      send(socket, room); // the newcomer gets the current state immediately
    });
  });
}

// Push a fresh snapshot to everyone watching one token, service or counter.
export function emitToken(code) {
  if (io) send(io.to(`token:${code}`), `token:${code}`);
}

export function emitService(serviceId) {
  if (io) send(io.to(`service:${serviceId}`), `service:${serviceId}`);
}

export function emitCounter(counterId) {
  if (io) send(io.to(`counter:${counterId}`), `counter:${counterId}`);
}