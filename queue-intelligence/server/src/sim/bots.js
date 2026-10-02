import { db } from "../db/db.js";
import { config } from "../config.js";
import * as clock from "../core/clock.js";
import { ServiceError } from "../core/errors.js";
import * as qs from "../core/queueService.js";
import { isRunning, getBots, getArrivalsPerMin } from "../core/simState.js";
import { refresh } from "../realtime/recompute.js";
import { emitDisplayCalled } from "../realtime/broadcaster.js";

const MIN = 60 * 1000;
const rand = (min, max) => min + Math.random() * (max - min);

// What each bot counter is doing: counterId -> { tokenId, phase, dueAt }.
// dueAt is in simulated milliseconds, so it speeds up with the clock.
const plans = new Map();
let carry = 0; // arrivals not yet created (a fraction of a customer)
let lastArrivalAt = null;

// Forget in-progress bot plans and arrival timing. Called after the data is
// reloaded, because token ids restart.
export function resetSimRuntime() {
  plans.clear();
  carry = 0;
  lastArrivalAt = null;
}

// How long a bot's service takes, in simulated minutes.
function serviceMinutes(serviceId) {
  const svc = db.prepare("SELECT default_service_min FROM services WHERE id = ?").get(serviceId);
  const [lo, hi] = config.sim.serviceSpread;
  return svc.default_service_min * rand(lo, hi);
}

// Tell every affected screen about a bot's action.
function push(counterId, serviceBefore, codes = []) {
  const serviceNow = qs.getCounter(counterId).service_id;
  refresh({
    services: [...new Set([serviceBefore, serviceNow])],
    counters: [counterId],
    tokens: codes,
  });
}

// ---------- bot counters ----------

function stepBot(counterId, nowMs) {
  const counter = db.prepare("SELECT * FROM counters WHERE id = ?").get(counterId);
  if (!counter) {
    plans.delete(counterId);
    return;
  }

  const token = qs.activeToken(counterId);

  // Idle: call the next customer if the counter is open and someone is waiting.
  if (!token) {
    plans.delete(counterId);
    if (counter.state !== "OPEN") return;
    const waiting = db
      .prepare("SELECT 1 FROM tokens WHERE service_id = ? AND state = 'WAITING' LIMIT 1")
      .get(counter.service_id);
    if (!waiting) return;

    const called = qs.callNext(counterId);
    plans.set(counterId, {
      tokenId: called.id,
      phase: "CALLED",
      dueAt: nowMs + config.sim.pickupMin * MIN,
    });
    push(counterId, counter.service_id, [called.code]);
    emitDisplayCalled(called.code, counterId);
    return;
  }

  // Busy: make sure we have a plan for this token (a person may have called it).
  let plan = plans.get(counterId);
  if (!plan || plan.tokenId !== token.id) {
    plan =
      token.state === "CALLED"
        ? { tokenId: token.id, phase: "CALLED", dueAt: nowMs + config.sim.pickupMin * MIN }
        : {
            tokenId: token.id,
            phase: "SERVING",
            dueAt: Math.max(
              nowMs,
              Date.parse(token.started_at) + serviceMinutes(token.service_id) * MIN
            ),
          };
    plans.set(counterId, plan);
  }
  if (nowMs < plan.dueAt) return;

  // The customer reaches the counter, or doesn't.
  if (plan.phase === "CALLED") {
    if (Math.random() < config.sim.noShowRate) {
      qs.skipToken(counterId, "Bot: no-show");
      plans.delete(counterId);
      push(counterId, counter.service_id, [token.code]);
      return;
    }
    qs.startService(counterId);
    plans.set(counterId, {
      tokenId: token.id,
      phase: "SERVING",
      dueAt: nowMs + serviceMinutes(token.service_id) * MIN,
    });
    push(counterId, counter.service_id, [token.code]);
    return;
  }

  // Service is done: tick every checklist item, then complete.
  const items = db.prepare("SELECT item_id FROM token_checklist WHERE token_id = ?").all(token.id);
  for (const it of items) qs.setChecklistItem(token.id, it.item_id, true);
  qs.completeService(counterId);
  plans.delete(counterId);
  push(counterId, counter.service_id, [token.code]);
}

// One pass over every bot counter. Does nothing while the simulator is off.
export function botTick() {
  if (!isRunning()) return;
  const nowMs = clock.now();
  for (const counterId of getBots()) {
    try {
      stepBot(counterId, nowMs);
    } catch (e) {
      if (!(e instanceof ServiceError)) console.warn(`[bots] counter ${counterId}: ${e.message}`);
    }
  }
}

// ---------- automatic arrivals ----------

function pickService() {
  const ids = db.prepare("SELECT id FROM services ORDER BY id").all().map((r) => r.id);
  const weights = ids.map((_, i) => config.sim.arrivalWeights[i] ?? 1);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r < 0) return ids[i];
  }
  return ids[ids.length - 1];
}

// Creates customers at the chosen rate (per simulated minute).
export function arrivalTick() {
  const nowMs = clock.now();
  const dtMin = lastArrivalAt === null ? 0 : Math.max(0, (nowMs - lastArrivalAt) / MIN);
  lastArrivalAt = nowMs;

  const rate = getArrivalsPerMin();
  if (!isRunning() || rate <= 0) {
    carry = 0;
    return;
  }

  carry += rate * dtMin;
  const touched = new Set();
  let made = 0;
  while (carry >= 1 && made < 50) {
    carry -= 1;
    made++;
    const serviceId = pickService();
    qs.createToken(serviceId, Math.random() < config.sim.priorityRate);
    touched.add(serviceId);
  }
  if (made === 50) carry = 0; // never let a backlog build into a burst
  if (touched.size) refresh({ services: [...touched] });
}

// ---------- the loop ----------

let timer = null;

export function stopSimLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startSimLoop(ms = config.sim.tickMs) {
  stopSimLoop();
  timer = setInterval(() => {
    try {
      botTick();
      arrivalTick();
    } catch (e) {
      console.warn("[sim] tick failed:", e.message);
    }
  }, ms);
  return stopSimLoop;
}