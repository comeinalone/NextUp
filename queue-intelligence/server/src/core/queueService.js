import { db } from "../db/db.js";
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