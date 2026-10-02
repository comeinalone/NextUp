import { getCounter } from "../core/queueService.js";
import { tokenSnapshot, serviceSnapshot, counterSnapshot } from "../core/snapshots.js";
import { managerSnapshot } from "../core/managerSnapshot.js";
import { computeRecommendation } from "../core/allocationEngine.js";

let io = null;

// Turn a room name into [event name, function that builds the payload].
// Rooms we don't build snapshots for (display, staff) return null.
function resolveRoom(room) {
  const [kind, id] = String(room).split(":");
  if (kind === "manager" && id === undefined) return ["manager:overview", () => managerSnapshot()];
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

// The current counter recommendation, or null when there is nothing to do.
function sendRecommendation(target) {
  try {
    target.emit("manager:recommendation", computeRecommendation());
  } catch (e) {
    console.warn(`[broadcast] recommendation skipped: ${e.message}`);
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
      if (room === "manager") sendRecommendation(socket);
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

// Push a fresh overview and recommendation to the manager dashboard.
// Skipped when nobody is watching, so the 5-second tick stays cheap.
export function emitManager() {
  if (!io || !io.sockets.adapter.rooms.has("manager")) return;
  send(io.to("manager"), "manager");
  sendRecommendation(io.to("manager"));
}

// Tell the public display a token was just called (it announces it aloud).
export function emitDisplayCalled(code, counterId) {
  if (!io) return;
  try {
    const counter = getCounter(counterId);
    io.to("display").emit("display:called", {
      code,
      counterId: counter.id,
      counterName: counter.name,
    });
  } catch (e) {
    console.warn(`[broadcast] display:called skipped: ${e.message}`);
  }
}
// Assistance requests go to the staff screens and the manager dashboard.
export function emitAssist(event, payload) {
  if (io) io.to("staff").to("manager").emit(event, payload);
}