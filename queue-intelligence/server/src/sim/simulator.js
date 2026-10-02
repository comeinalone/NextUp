import { db } from "../db/db.js";
import { seedDatabase } from "../db/seed.js";
import * as clock from "../core/clock.js";
import { ServiceError } from "../core/errors.js";
import { createToken } from "../core/queueService.js";
import { setRunning } from "../core/simState.js";
import { refresh, refreshAll } from "../realtime/recompute.js";

// Demo mode: speed the clock up so a 4-minute service takes seconds.
export function startSim(speed) {
  clock.setSpeed(speed);
  setRunning(true);
  refresh(); // tells the manager dashboard
}

// Back to normal speed. Time does not rewind.
export function stopSim() {
  clock.setSpeed(1);
  setRunning(false);
  refresh();
}

// A rush of customers arriving at once. Every tenth one is a priority customer.
export function flood(serviceId, count) {
  const svc = db.prepare("SELECT id FROM services WHERE id = ?").get(serviceId);
  if (!svc) throw new ServiceError("SERVICE_NOT_FOUND", "Service not found", 404);
  for (let i = 0; i < count; i++) createToken(serviceId, i % 10 === 9);
  refresh({ services: [serviceId] });
}

// Reload the starting data. The clock and the simulator are left as they are.
export function reseed() {
  seedDatabase();
  refreshAll();
}

// Reload the data, turn the simulator off and put the clock back on real time.
export function resetAll() {
  setRunning(false);
  clock.resyncToRealTime();
  seedDatabase();
  refreshAll();
}