import { db } from "../db/db.js";
import { config } from "../config.js";
import { emitToken, emitService, emitCounter } from "./broadcaster.js";

// Call this after every change. Tell it what changed and it pushes fresh
// snapshots to everyone affected.
//
//   services  service ids whose queue changed (a counter that moved between
//             two services means passing BOTH ids)
//   counters  extra counter ids to refresh
//   tokens    extra token codes to refresh (use this for a token that just
//             finished, was skipped or cancelled, because it is no longer
//             part of a live queue)
export function refresh({ services = [], counters = [], tokens = [] } = {}) {
  const serviceIds = new Set(services);
  const counterIds = new Set(counters);
  const codes = new Set(tokens);

  for (const sid of serviceIds) {
    const affectedCounters = db
      .prepare("SELECT id FROM counters WHERE service_id = ? OR pending_service_id = ?")
      .all(sid, sid);
    for (const c of affectedCounters) counterIds.add(c.id);

    const liveTokens = db
      .prepare("SELECT code FROM tokens WHERE service_id = ? AND state IN ('WAITING','CALLED','SERVING')")
      .all(sid);
    for (const t of liveTokens) codes.add(t.code);
  }

  for (const sid of serviceIds) emitService(sid);
  for (const cid of counterIds) emitCounter(cid);
  for (const code of codes) emitToken(code);
}

// Refresh everything that is live.
export function refreshAll() {
  const services = db.prepare("SELECT id FROM services").all().map((r) => r.id);
  const counters = db.prepare("SELECT id FROM counters").all().map((r) => r.id);
  refresh({ services, counters });
}

// ETAs change as time passes, even when nobody clicks anything.
let timer = null;

export function stopTicker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startTicker(ms = config.tickMs) {
  stopTicker();
  timer = setInterval(() => {
    try {
      refreshAll();
    } catch (e) {
      console.warn("[tick] failed:", e.message);
    }
  }, ms);
  return stopTicker;
}