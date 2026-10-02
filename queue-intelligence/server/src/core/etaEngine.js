import { db } from "../db/db.js";
import { config } from "../config.js";
import * as clock from "./clock.js";
import { ServiceError } from "./errors.js";
import { getWaitingQueue } from "./scheduler.js";

const round1 = (n) => Math.round(n * 10) / 10;

function getStats(serviceId) {
  const s = db.prepare("SELECT * FROM service_stats WHERE service_id = ?").get(serviceId);
  if (!s) throw new ServiceError("SERVICE_NOT_FOUND", "Service not found", 404);
  return s;
}

// Average minutes one token takes, allowing for customers who don't show up.
function perTokenMin(stats) {
  return stats.ewma_min * (1 - stats.no_show_rate) + stats.no_show_rate * config.graceMin;
}

// Minutes until a counter finishes what it is doing right now.
function remainingMin(counterId) {
  const token = db
    .prepare(
      `SELECT * FROM tokens
       WHERE counter_id = ? AND state IN ('CALLED','SERVING')
       ORDER BY id DESC LIMIT 1`
    )
    .get(counterId);
  if (!token) return 0; // idle

  const avg = getStats(token.service_id).ewma_min;
  if (token.state === "CALLED") return avg; // customer is still walking up
  const elapsed = clock.minutesSince(token.started_at);
  return Math.max(avg - elapsed, config.minRemainingMin);
}

// When each counter that can serve this service becomes free (minutes from now).
// Counts open counters, plus counters that are finishing a customer and
// about to switch INTO this service.
function counterFreeTimes(serviceId) {
  const counters = db
    .prepare(
      `SELECT * FROM counters
       WHERE (service_id = ? AND state = 'OPEN')
          OR (pending_service_id = ? AND state = 'SWITCHING')`
    )
    .all(serviceId, serviceId);
  return counters.map((c) => remainingMin(c.id));
}

// The "range" a customer sees, for example 10-16 min.
export function etaRange(etaMin) {
  return [Math.floor(etaMin * config.etaRangeLow), Math.ceil(etaMin * config.etaRangeHigh)];
}

// Simulate the queue for one service.
// Pass { counters: N } to ask "what if this service had N counters?".
//
// Returns:
//   etaMin           wait for a person who joins right now
//   customerMinutes  total of every waiting person's wait (used to compare options)
//   etas             one entry per waiting token, in serving order
export function simulateQueue(serviceId, { counters = null } = {}) {
  const stats = getStats(serviceId);
  const perToken = perTokenMin(stats);
  let free = counterFreeTimes(serviceId);

  if (counters !== null) {
    free.sort((a, b) => a - b);
    free = free.slice(0, counters);
    while (free.length < counters) free.push(0); // extra counters start idle
  }

  const queue = getWaitingQueue(serviceId);

  if (free.length === 0) {
    return {
      serviceId,
      unavailable: true,
      counters: 0,
      waiting: queue.length,
      perTokenMin: perToken,
      etaMin: null,
      customerMinutes: null,
      etas: queue.map((t, i) => ({ tokenId: t.id, code: t.code, position: i + 1, etaMin: null })),
    };
  }

  let customerMinutes = 0;
  const etas = queue.map((t, i) => {
    let idx = 0;
    for (let k = 1; k < free.length; k++) if (free[k] < free[idx]) idx = k;
    const eta = free[idx];
    free[idx] += perToken;
    customerMinutes += eta;
    return { tokenId: t.id, code: t.code, position: i + 1, etaMin: eta };
  });

  return {
    serviceId,
    unavailable: false,
    counters: free.length,
    waiting: queue.length,
    perTokenMin: perToken,
    etaMin: Math.min(...free),
    customerMinutes,
    etas,
  };
}

// NORMAL / BUSY / CRITICAL for a service, from its simulation result.
export function healthOf(sim) {
  if (sim.unavailable) return sim.waiting > 0 ? "CRITICAL" : "NORMAL";
  if (sim.etaMin > config.health.criticalAboveMin) return "CRITICAL";
  if (sim.etaMin >= config.health.busyAboveMin) return "BUSY";
  return "NORMAL";
}

// What one customer sees on their token page.
export function tokenEta(code) {
  const token = db.prepare("SELECT * FROM tokens WHERE code = ?").get(code);
  if (!token) throw new ServiceError("TOKEN_NOT_FOUND", "Token not found", 404);

  const base = { code, state: token.state, serviceId: token.service_id };
  if (token.state !== "WAITING") {
    return { ...base, position: null, peopleAhead: null, etaMin: null, etaRange: null, unavailable: false };
  }

  const sim = simulateQueue(token.service_id);
  const entry = sim.etas.find((e) => e.tokenId === token.id);
  return {
    ...base,
    position: entry.position,
    peopleAhead: entry.position - 1,
    etaMin: sim.unavailable ? null : round1(entry.etaMin),
    etaRange: sim.unavailable ? null : etaRange(entry.etaMin),
    unavailable: sim.unavailable,
  };
}