import { db } from "../db/db.js";
import { seedDatabase } from "../db/seed.js";
import * as clock from "../core/clock.js";
import { ServiceError } from "../core/errors.js";
import { createToken } from "../core/queueService.js";
import { setRunning, setBots, setArrivalsPerMin, clearSimState } from "../core/simState.js";
import { refresh, refreshAll } from "../realtime/recompute.js";
import { resetSimRuntime } from "./bots.js";

// Demo mode: speed the clock up so a 4-minute service takes seconds.
// Bots and automatic arrivals only act while this is running.
export function startSim(speed) {
  clock.setSpeed(speed);
  setRunning(true);
  refresh(); // tells the manager dashboard
}

// Back to normal speed. Time does not rewind. Bots and arrivals pause.
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

// Choose which counters are operated automatically (an empty list means none).
export function setBotCounters(counterIds) {
  const unique = [...new Set(counterIds)];
  for (const id of unique) {
    if (!db.prepare("SELECT 1 FROM counters WHERE id = ?").get(id)) {
      throw new ServiceError("COUNTER_NOT_FOUND", `Counter ${id} not found`, 404);
    }
  }
  setBots(unique);
  refresh();
}

// Customers per simulated minute arriving on their own (0 turns it off).
export function setArrivals(perMin) {
  setArrivalsPerMin(perMin);
  refresh();
}

// Reload the starting data. The clock, bots and arrival rate are kept.
export function reseed() {
  resetSimRuntime();
  seedDatabase();
  refreshAll();
}

// Reload the data, turn everything off and put the clock back on real time.
export function resetAll() {
  clearSimState();
  resetSimRuntime();
  clock.resyncToRealTime();
  seedDatabase();
  refreshAll();
}