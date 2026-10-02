import { db } from "../db/db.js";
import { config } from "../config.js";
import * as clock from "./clock.js";
import { ServiceError } from "./errors.js";
import { getWaitingQueue } from "./scheduler.js";

// Wrap a function so everything inside is one atomic database transaction.
// If anything throws, every change inside is rolled back.
const tx = (fn) => db.transaction(fn);

// ---------- helpers ----------

function logEvent(tokenId, type, { counterId = null, staffId = null, reason = null, meta = null } = {}) {
  db.prepare(
    `INSERT INTO token_events (token_id, type, counter_id, staff_id, reason, at, meta)
     VALUES (?,?,?,?,?,?,?)`
  ).run(tokenId, type, counterId, staffId, reason, clock.nowIso(), meta ? JSON.stringify(meta) : null);
}

function logSystem(type, payload) {
  db.prepare("INSERT INTO system_events (type, payload, at) VALUES (?,?,?)").run(
    type,
    JSON.stringify(payload),
    clock.nowIso()
  );
}

export function getTokenById(id) {
  return db.prepare("SELECT * FROM tokens WHERE id = ?").get(id);
}

export function getTokenByCode(code) {
  const t = db.prepare("SELECT * FROM tokens WHERE code = ?").get(code);
  if (!t) throw new ServiceError("TOKEN_NOT_FOUND", "Token not found", 404);
  return t;
}

export function getCounter(id) {
  const c = db.prepare("SELECT * FROM counters WHERE id = ?").get(id);
  if (!c) throw new ServiceError("COUNTER_NOT_FOUND", "Counter not found", 404);
  return c;
}

// The token a counter is currently handling (called or being served), if any.
export function activeToken(counterId) {
  return db
    .prepare(
      `SELECT * FROM tokens
       WHERE counter_id = ? AND state IN ('CALLED','SERVING')
       ORDER BY id DESC LIMIT 1`
    )
    .get(counterId);
}

function setStaffState(counter, state) {
  if (counter.staff_id) {
    db.prepare("UPDATE staff SET state = ? WHERE id = ?").run(state, counter.staff_id);
  }
}

// If a counter was told to switch service while busy, do it as soon as it is free.
export function applyPendingSwitch(counterId) {
  const c = getCounter(counterId);
  if (c.state === "SWITCHING" && c.pending_service_id && !activeToken(counterId)) {
    db.prepare(
      `UPDATE counters
       SET service_id = ?, pending_service_id = NULL, state = 'OPEN', state_reason = NULL
       WHERE id = ?`
    ).run(c.pending_service_id, counterId);
    logSystem("COUNTER_SWITCHED", { counterId, from: c.service_id, to: c.pending_service_id });
  }
}

// ---------- learning (feeds the ETA engine) ----------

function learnFromCompletion(serviceId, durationMin) {
  const s = db.prepare("SELECT * FROM service_stats WHERE service_id = ?").get(serviceId);
  const d = Math.max(durationMin, config.minServiceMin);
  const ewma = config.ewmaAlpha * d + (1 - config.ewmaAlpha) * s.ewma_min;
  const noShow = (1 - config.noShowAlpha) * s.no_show_rate; // drifts toward 0
  db.prepare(
    "UPDATE service_stats SET ewma_min = ?, no_show_rate = ?, updated_at = ? WHERE service_id = ?"
  ).run(ewma, noShow, clock.nowIso(), serviceId);
}

// ---------- customer actions ----------

export const createToken = tx((serviceId, isPriority = false) => {
  const svc = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId);
  if (!svc) throw new ServiceError("SERVICE_NOT_FOUND", "Service not found", 404);

  const { n } = db
    .prepare("SELECT COALESCE(MAX(number), 0) AS n FROM tokens WHERE service_id = ?")
    .get(serviceId);
  const number = n + 1;
  const code = `${svc.prefix}-${String(number).padStart(3, "0")}`;

  const info = db
    .prepare(
      `INSERT INTO tokens (code, number, service_id, is_priority, state, created_at)
       VALUES (?,?,?,?, 'WAITING', ?)`
    )
    .run(code, number, serviceId, isPriority ? 1 : 0, clock.nowIso());
  const id = Number(info.lastInsertRowid);

  // One checklist row per item for this service (employees tick these off).
  db.prepare(
    "INSERT INTO token_checklist (token_id, item_id) SELECT ?, id FROM checklist_items WHERE service_id = ?"
  ).run(id, serviceId);

  logEvent(id, "CREATED", { meta: { priority: !!isPriority } });
  return getTokenById(id);
});

// ---------- counter actions ----------

export const callNext = tx((counterId) => {
  const counter = getCounter(counterId);
  if (counter.state !== "OPEN") {
    throw new ServiceError("COUNTER_NOT_OPEN", `Counter is ${counter.state.toLowerCase()}`, 409);
  }
  if (activeToken(counterId)) {
    throw new ServiceError("COUNTER_BUSY", "Finish the current token first", 409);
  }

  const [next] = getWaitingQueue(counter.service_id);
  if (!next) throw new ServiceError("QUEUE_EMPTY", "Nobody is waiting", 409);

  db.prepare("UPDATE tokens SET state = 'CALLED', counter_id = ?, called_at = ? WHERE id = ?").run(
    counterId,
    clock.nowIso(),
    next.id
  );
  logEvent(next.id, "CALLED", {
    counterId,
    staffId: counter.staff_id,
    meta: { score: Math.round(next.score * 10) / 10 },
  });
  return getTokenById(next.id);
});

export const startService = tx((counterId) => {
  const counter = getCounter(counterId);
  const token = activeToken(counterId);
  if (!token || token.state !== "CALLED") {
    throw new ServiceError("NO_CALLED_TOKEN", "No called token to start", 409);
  }
  db.prepare("UPDATE tokens SET state = 'SERVING', started_at = ? WHERE id = ?").run(
    clock.nowIso(),
    token.id
  );
  setStaffState(counter, "SERVING");
  logEvent(token.id, "STARTED", { counterId, staffId: counter.staff_id });
  return getTokenById(token.id);
});

export const completeService = tx((counterId) => {
  const counter = getCounter(counterId);
  const token = activeToken(counterId);
  if (!token || token.state !== "SERVING") {
    throw new ServiceError("NOT_SERVING", "No token is being served", 409);
  }

  const completedAt = clock.nowIso();
  db.prepare("UPDATE tokens SET state = 'COMPLETED', completed_at = ? WHERE id = ?").run(
    completedAt,
    token.id
  );

  const durationMin = clock.minutesBetween(token.started_at, completedAt);
  learnFromCompletion(token.service_id, durationMin);

  setStaffState(counter, "AVAILABLE");
  logEvent(token.id, "COMPLETED", {
    counterId,
    staffId: counter.staff_id,
    meta: { durationMin: Math.round(durationMin * 100) / 100 },
  });
  applyPendingSwitch(counterId);
  return getTokenById(token.id);
});
// ---------- skip, hold, recall, cancel ----------

// A skip means the customer didn't show up, so the no-show rate drifts upward.
function learnFromSkip(serviceId) {
  const s = db.prepare("SELECT * FROM service_stats WHERE service_id = ?").get(serviceId);
  const noShow = (1 - config.noShowAlpha) * s.no_show_rate + config.noShowAlpha;
  db.prepare("UPDATE service_stats SET no_show_rate = ?, updated_at = ? WHERE service_id = ?").run(
    noShow,
    clock.nowIso(),
    serviceId
  );
}

// Customer didn't show up after being called.
export const skipToken = tx((counterId, reason = null) => {
  const counter = getCounter(counterId);
  const token = activeToken(counterId);
  if (!token || token.state !== "CALLED") {
    throw new ServiceError("NO_CALLED_TOKEN", "Only a called token can be skipped", 409);
  }
  db.prepare(
    "UPDATE tokens SET state = 'SKIPPED', skipped_at = ?, skip_reason = ? WHERE id = ?"
  ).run(clock.nowIso(), reason, token.id);

  learnFromSkip(token.service_id);
  setStaffState(counter, "AVAILABLE");
  logEvent(token.id, "SKIPPED", { counterId, staffId: counter.staff_id, reason });
  applyPendingSwitch(counterId);
  return getTokenById(token.id);
});

// Park a token (for example the customer must fetch a missing document).
export const holdToken = tx((counterId, reason = null) => {
  const counter = getCounter(counterId);
  const token = activeToken(counterId);
  if (!token) throw new ServiceError("NO_ACTIVE_TOKEN", "No token to hold", 409);

  db.prepare("UPDATE tokens SET state = 'HELD', held_at = ?, hold_reason = ? WHERE id = ?").run(
    clock.nowIso(),
    reason,
    token.id
  );
  setStaffState(counter, "AVAILABLE");
  logEvent(token.id, "HELD", { counterId, staffId: counter.staff_id, reason });
  applyPendingSwitch(counterId);
  return getTokenById(token.id);
});

// Bring a held token back to a free counter of the same service.
export const recallToken = tx((counterId, tokenId) => {
  const counter = getCounter(counterId);
  if (counter.state !== "OPEN") {
    throw new ServiceError("COUNTER_NOT_OPEN", `Counter is ${counter.state.toLowerCase()}`, 409);
  }
  if (activeToken(counterId)) {
    throw new ServiceError("COUNTER_BUSY", "Finish the current token first", 409);
  }
  const token = getTokenById(tokenId);
  if (!token || token.state !== "HELD") {
    throw new ServiceError("NOT_HELD", "That token is not on hold", 409);
  }
  if (token.service_id !== counter.service_id) {
    throw new ServiceError("WRONG_SERVICE", "This counter serves a different service", 409);
  }
  db.prepare("UPDATE tokens SET state = 'CALLED', counter_id = ?, called_at = ? WHERE id = ?").run(
    counterId,
    clock.nowIso(),
    token.id
  );
  logEvent(token.id, "RECALLED", { counterId, staffId: counter.staff_id });
  return getTokenById(token.id);
});

// The customer leaves the queue.
export const cancelToken = tx((code) => {
  const token = getTokenByCode(code);
  if (!["WAITING", "HELD", "CALLED"].includes(token.state)) {
    throw new ServiceError("CANNOT_CANCEL", `A ${token.state.toLowerCase()} token cannot be cancelled`, 409);
  }
  const calledAtCounter = token.state === "CALLED" ? token.counter_id : null;

  db.prepare("UPDATE tokens SET state = 'CANCELLED', cancelled_at = ? WHERE id = ?").run(
    clock.nowIso(),
    token.id
  );
  logEvent(token.id, "CANCELLED", { counterId: calledAtCounter });

  // If they were already called, free that counter.
  if (calledAtCounter) {
    setStaffState(getCounter(calledAtCounter), "AVAILABLE");
    applyPendingSwitch(calledAtCounter);
  }
  return getTokenById(token.id);
});
// ---------- counter states, assignment, checklist ----------

export const setCounterState = tx((counterId, newState, reason = null) => {
  if (!["OPEN", "BREAK", "CLOSED"].includes(newState)) {
    throw new ServiceError("BAD_STATE", "State must be OPEN, BREAK or CLOSED", 400);
  }
  const counter = getCounter(counterId);
  if (counter.state === "SWITCHING") {
    throw new ServiceError("SWITCHING", "Counter is switching service; wait for it to finish", 409);
  }
  if (newState !== "OPEN" && activeToken(counterId)) {
    throw new ServiceError("ACTIVE_TOKEN", "Finish the current token before leaving the counter", 409);
  }

  db.prepare("UPDATE counters SET state = ?, state_reason = ? WHERE id = ?").run(
    newState,
    newState === "OPEN" ? null : reason,
    counterId
  );
  setStaffState(counter, { OPEN: "AVAILABLE", BREAK: "BREAK", CLOSED: "OFFLINE" }[newState]);
  logSystem("COUNTER_STATE", { counterId, from: counter.state, to: newState, reason });
  return getCounter(counterId);
});

// Move a counter to another service. If it is busy, it finishes the current
// token first (state SWITCHING), then moves by itself.
export const assignCounter = tx((counterId, serviceId) => {
  const counter = getCounter(counterId);
  const svc = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId);
  if (!svc) throw new ServiceError("SERVICE_NOT_FOUND", "Service not found", 404);
  if (counter.state === "SWITCHING") {
    throw new ServiceError("ALREADY_SWITCHING", "Counter is already switching service", 409);
  }
  if (counter.service_id === serviceId) {
    throw new ServiceError("ALREADY_ASSIGNED", "Counter already serves this service", 409);
  }

  // The person at the counter must be able to handle the new service.
  if (counter.staff_id) {
    const skilled = db
      .prepare("SELECT 1 FROM staff_skills WHERE staff_id = ? AND service_id = ?")
      .get(counter.staff_id, serviceId);
    if (!skilled) {
      throw new ServiceError("STAFF_LACKS_SKILL", `Staff at this counter cannot handle ${svc.name}`, 409);
    }
  }

  if (activeToken(counterId)) {
    db.prepare("UPDATE counters SET state = 'SWITCHING', pending_service_id = ? WHERE id = ?").run(
      serviceId,
      counterId
    );
    logSystem("COUNTER_SWITCH_PENDING", { counterId, from: counter.service_id, to: serviceId });
  } else {
    db.prepare("UPDATE counters SET service_id = ? WHERE id = ?").run(serviceId, counterId);
    logSystem("COUNTER_SWITCHED", { counterId, from: counter.service_id, to: serviceId });
  }
  return getCounter(counterId);
});

export const setChecklistItem = tx((tokenId, itemId, done) => {
  const info = db
    .prepare("UPDATE token_checklist SET done = ?, done_at = ? WHERE token_id = ? AND item_id = ?")
    .run(done ? 1 : 0, done ? clock.nowIso() : null, tokenId, itemId);
  if (info.changes === 0) {
    throw new ServiceError("CHECKLIST_NOT_FOUND", "Checklist item not found for this token", 404);
  }
  return getTokenById(tokenId);
});