import { db } from "../db/db.js";
import { ServiceError } from "./errors.js";
import { activeToken, getCounter, getTokenByCode } from "./queueService.js";
import { getWaitingQueue, explain } from "./scheduler.js";
import { simulateQueue, healthOf, tokenEta } from "./etaEngine.js";

// These functions build the exact payloads described in shared/contract.md.
// They only read from the database; they never change anything.

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

function getService(id) {
  const s = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
  if (!s) throw new ServiceError("SERVICE_NOT_FOUND", "Service not found", 404);
  return s;
}

// Tokens being handled right now in a service, most recently called first.
function nowServingList(serviceId) {
  return db
    .prepare(
      `SELECT t.code, c.id AS counterId, c.name AS counterName
       FROM tokens t JOIN counters c ON c.id = t.counter_id
       WHERE t.service_id = ? AND t.state IN ('CALLED','SERVING')
       ORDER BY t.called_at DESC`
    )
    .all(serviceId);
}

// The delay broadcast: explains why waits changed when a counter is on break.
function serviceNotice(serviceId) {
  const onBreak = db
    .prepare("SELECT * FROM counters WHERE service_id = ? AND state = 'BREAK' ORDER BY id")
    .all(serviceId);
  if (onBreak.length === 0) return null;
  const names = onBreak.map((c) => c.name).join(", ");
  const reason = onBreak.length === 1 && onBreak[0].state_reason ? ` (${onBreak[0].state_reason})` : "";
  return `${names} on break${reason}, ETAs updated`;
}

// ---------- token:update ----------

export function tokenSnapshot(code) {
  const token = getTokenByCode(code);
  const svc = getService(token.service_id);
  const eta = tokenEta(code);
  const serving = nowServingList(token.service_id);

  let counter = null;
  if (["CALLED", "SERVING"].includes(token.state) && token.counter_id) {
    const c = getCounter(token.counter_id);
    counter = { id: c.id, name: c.name };
  }

  const docs = db
    .prepare(
      "SELECT label FROM checklist_items WHERE service_id = ? AND customer_facing = 1 ORDER BY position"
    )
    .all(token.service_id)
    .map((r) => r.label);

  return {
    code,
    serviceId: svc.id,
    serviceName: svc.name,
    isPriority: !!token.is_priority,
    state: token.state,
    position: eta.position,
    peopleAhead: eta.peopleAhead,
    etaMin: eta.etaMin,
    etaRange: eta.etaRange,
    unavailable: eta.unavailable,
    nowServing: serving.length ? serving[0].code : null,
    counter,
    notice: token.state === "WAITING" ? serviceNotice(token.service_id) : null,
    customerChecklist: docs,
  };
}

// ---------- service:update ----------

export function serviceSnapshot(serviceId) {
  const svc = getService(serviceId);
  const sim = simulateQueue(serviceId);
  return {
    serviceId: svc.id,
    name: svc.name,
    prefix: svc.prefix,
    waiting: sim.waiting,
    openCounters: sim.counters,
    etaMin: round1(sim.etaMin),
    health: healthOf(sim),
    customerMinutes: round1(sim.customerMinutes),
    nowServing: nowServingList(serviceId),
    notice: serviceNotice(serviceId),
  };
}

export function allServiceSnapshots() {
  return db
    .prepare("SELECT id FROM services ORDER BY id")
    .all()
    .map((s) => serviceSnapshot(s.id));
}

// ---------- counter:update ----------

export function counterSnapshot(counterId) {
  const counter = getCounter(counterId);
  const svc = getService(counter.service_id);
  const active = activeToken(counterId);
  const queue = getWaitingQueue(counter.service_id);
  const stats = db
    .prepare("SELECT ewma_min FROM service_stats WHERE service_id = ?")
    .get(counter.service_id);

  let current = null;
  if (active) {
    const checklist = db
      .prepare(
        `SELECT ci.id AS itemId, ci.label, tc.done
         FROM token_checklist tc JOIN checklist_items ci ON ci.id = tc.item_id
         WHERE tc.token_id = ? ORDER BY ci.position`
      )
      .all(active.id)
      .map((r) => ({ itemId: r.itemId, label: r.label, done: !!r.done }));
    current = {
      tokenId: active.id,
      code: active.code,
      state: active.state,
      isPriority: !!active.is_priority,
      startedAt: active.started_at,
      checklist,
    };
  }

  const held = db
    .prepare("SELECT id, code, hold_reason FROM tokens WHERE service_id = ? AND state = 'HELD' ORDER BY held_at")
    .all(counter.service_id)
    .map((t) => ({ tokenId: t.id, code: t.code, reason: t.hold_reason }));

  return {
    counterId: counter.id,
    name: counter.name,
    serviceId: svc.id,
    serviceName: svc.name,
    state: counter.state,
    stateReason: counter.state_reason,
    pendingServiceId: counter.pending_service_id,
    avgServiceMin: round1(stats.ewma_min),
    current,
    queue: queue.slice(0, 10).map((t) => ({
      tokenId: t.id,
      code: t.code,
      isPriority: !!t.is_priority,
      waitMin: round1(t.waitMin),
      score: round1(t.score),
    })),
    held,
    nextRecommended: queue.length ? { code: queue[0].code, reasons: explain(queue[0]) } : null,
  };
}