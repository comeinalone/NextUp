import { db } from "../db/db.js";
import * as clock from "./clock.js";
import { ServiceError } from "./errors.js";
import { getCounter, getTokenByCode, activeToken } from "./queueService.js";

export const REASONS = ["DOCUMENT_ISSUE", "SYSTEM_PROBLEM", "OVERLOADED", "DIFFICULT_CASE", "OTHER"];

function logSystem(type, payload) {
  db.prepare("INSERT INTO system_events (type, payload, at) VALUES (?,?,?)").run(
    type,
    JSON.stringify(payload),
    clock.nowIso()
  );
}

// Counters whose staff could help: available right now, has the skill for the
// requesting counter's service, and is not the requester.
function eligibleCounterIds(requesterCounterId) {
  const requester = getCounter(requesterCounterId);
  return db
    .prepare(
      `SELECT c.id FROM counters c
       JOIN staff s ON s.id = c.staff_id
       JOIN staff_skills k ON k.staff_id = s.id AND k.service_id = ?
       WHERE c.id != ? AND s.state = 'AVAILABLE'
       ORDER BY c.id`
    )
    .all(requester.service_id, requesterCounterId)
    .map((r) => r.id);
}

function shape(r) {
  const counter = getCounter(r.counter_id);
  const token = r.token_id
    ? db.prepare("SELECT code FROM tokens WHERE id = ?").get(r.token_id)
    : null;

  // accepted_by holds the id of the counter that is helping.
  let acceptedBy = null;
  if (r.accepted_by) {
    const helper = getCounter(r.accepted_by);
    const staff = helper.staff_id
      ? db.prepare("SELECT name FROM staff WHERE id = ?").get(helper.staff_id)
      : null;
    acceptedBy = {
      counterId: helper.id,
      counterName: helper.name,
      staffName: staff ? staff.name : null,
    };
  }

  return {
    id: r.id,
    counterId: r.counter_id,
    counterName: counter.name,
    tokenCode: token ? token.code : null,
    reason: r.reason,
    note: r.note ?? "",
    state: r.state,
    createdAt: r.created_at,
    acceptedBy,
    // Only an open request is waiting for a helper.
    eligibleCounterIds: r.state === "OPEN" ? eligibleCounterIds(r.counter_id) : [],
  };
}

export function assistSnapshot(id) {
  const r = db.prepare("SELECT * FROM assistance_requests WHERE id = ?").get(id);
  if (!r) throw new ServiceError("ASSIST_NOT_FOUND", "Request not found", 404);
  return shape(r);
}

// Every request that is not resolved yet, oldest first.
export function listUnresolved() {
  return db
    .prepare("SELECT * FROM assistance_requests WHERE state != 'RESOLVED' ORDER BY created_at, id")
    .all()
    .map(shape);
}

// A counter asks for help. Returns the new request's id.
export const createAssist = db.transaction((counterId, reason, note, tokenCode) => {
  getCounter(counterId); // 404 if the counter doesn't exist

  const unresolved = db
    .prepare("SELECT 1 FROM assistance_requests WHERE counter_id = ? AND state != 'RESOLVED'")
    .get(counterId);
  if (unresolved) {
    throw new ServiceError("ALREADY_REQUESTED", "This counter already has an unresolved request", 409);
  }

  // The token the request is about: the one named, or else the one being handled.
  let token = null;
  if (tokenCode) token = getTokenByCode(tokenCode);
  else token = activeToken(counterId) ?? null;

  const info = db
    .prepare(
      `INSERT INTO assistance_requests (counter_id, token_id, reason, note, state, created_at)
       VALUES (?,?,?,?, 'OPEN', ?)`
    )
    .run(counterId, token ? token.id : null, reason, note ?? null, clock.nowIso());
  const id = Number(info.lastInsertRowid);

  logSystem("ASSIST_REQUESTED", {
    requestId: id,
    counterId,
    tokenCode: token ? token.code : null,
    reason,
  });
  return id;
});

// Another counter says "I'll help".
export const acceptAssist = db.transaction((id, helperCounterId) => {
  const r = db.prepare("SELECT * FROM assistance_requests WHERE id = ?").get(id);
  if (!r) throw new ServiceError("ASSIST_NOT_FOUND", "Request not found", 404);
  if (r.state !== "OPEN") {
    throw new ServiceError("NOT_OPEN", `This request is already ${r.state.toLowerCase()}`, 409);
  }

  getCounter(helperCounterId); // 404 if the helper counter doesn't exist
  if (helperCounterId === r.counter_id) {
    throw new ServiceError("OWN_REQUEST", "A counter cannot answer its own request", 409);
  }
  if (!eligibleCounterIds(r.counter_id).includes(helperCounterId)) {
    throw new ServiceError(
      "NOT_ELIGIBLE",
      "Staff at that counter is not available or does not have the skill for this service",
      409
    );
  }

  db.prepare(
    "UPDATE assistance_requests SET state = 'ACCEPTED', accepted_by = ?, accepted_at = ? WHERE id = ?"
  ).run(helperCounterId, clock.nowIso(), id);
  logSystem("ASSIST_ACCEPTED", { requestId: id, counterId: r.counter_id, helperCounterId });
});

// The problem is sorted out (an open request can be resolved without a helper).
export const resolveAssist = db.transaction((id) => {
  const r = db.prepare("SELECT * FROM assistance_requests WHERE id = ?").get(id);
  if (!r) throw new ServiceError("ASSIST_NOT_FOUND", "Request not found", 404);
  if (r.state === "RESOLVED") {
    throw new ServiceError("ALREADY_RESOLVED", "This request is already resolved", 409);
  }
  db.prepare("UPDATE assistance_requests SET state = 'RESOLVED', resolved_at = ? WHERE id = ?").run(
    clock.nowIso(),
    id
  );
  logSystem("ASSIST_RESOLVED", { requestId: id, counterId: r.counter_id });
});