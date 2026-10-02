import { db } from "../db/db.js";
import { config } from "../config.js";
import * as clock from "./clock.js";

// Higher score = served sooner.
// A priority customer is treated as if they had already waited
// `priorityBoost` extra minutes, so a normal customer who has waited long
// enough overtakes a fresh priority customer. That is the aging rule.
export function scoreOf(token, nowMs = clock.now()) {
  const waitMin = (nowMs - Date.parse(token.created_at)) / 60000;
  return waitMin + (token.is_priority ? config.priorityBoost : 0) + token.score_offset;
}

// Waiting tokens for a service, best candidate first.
export function getWaitingQueue(serviceId) {
  const nowMs = clock.now();
  const rows = db
    .prepare("SELECT * FROM tokens WHERE service_id = ? AND state = 'WAITING'")
    .all(serviceId);

  return rows
    .map((t) => ({
      ...t,
      waitMin: (nowMs - Date.parse(t.created_at)) / 60000,
      score: scoreOf(t, nowMs),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || Date.parse(a.created_at) - Date.parse(b.created_at)
    );
}

// Plain-English reasons shown to staff next to "next recommended".
export function explain(token) {
  const reasons = [];
  if (token.is_priority) reasons.push(`Priority customer (+${config.priorityBoost})`);
  reasons.push(`Waiting ${Math.round(token.waitMin)} min`);
  if (token.score_offset) reasons.push("Returned after a missed call");
  return reasons;
}