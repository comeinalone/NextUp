import { db } from "../db/db.js";
import * as clock from "./clock.js";

const MIN = 60 * 1000;
const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

// Midnight (server local time) of the current day, as an ISO string.
function startOfTodayIso() {
  const d = new Date(clock.now());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Today's numbers for one service, or for everything when serviceId is null.
function statsFor(serviceId, since) {
  const filter = serviceId === null ? "" : " AND service_id = ?";
  const extra = serviceId === null ? [] : [serviceId];

  const issued = db
    .prepare(`SELECT COUNT(*) AS n FROM tokens WHERE created_at >= ?${filter}`)
    .get(since, ...extra).n;

  // Service time: started -> completed
  const done = db
    .prepare(
      `SELECT COUNT(*) AS n,
              AVG((julianday(completed_at) - julianday(started_at)) * 1440) AS avgMin
       FROM tokens WHERE state = 'COMPLETED' AND completed_at >= ?${filter}`
    )
    .get(since, ...extra);

  const waiting = db
    .prepare(`SELECT COUNT(*) AS n FROM tokens WHERE state = 'WAITING'${filter}`)
    .get(...extra).n;

  const noShows = db
    .prepare(`SELECT COUNT(*) AS n FROM tokens WHERE skipped_at >= ?${filter}`)
    .get(since, ...extra).n;

  // Wait: created -> called
  const waited = db
    .prepare(
      `SELECT AVG((julianday(called_at) - julianday(created_at)) * 1440) AS avgMin
       FROM tokens WHERE called_at >= ?${filter}`
    )
    .get(since, ...extra);

  return {
    issued,
    completed: done.n,
    waiting,
    noShows,
    avgWaitMin: round1(waited.avgMin),
    avgServiceMin: round1(done.avgMin),
  };
}

export function todayAnalytics() {
  const since = startOfTodayIso();
  const services = db.prepare("SELECT id, name FROM services ORDER BY id").all();
  return {
    ...statsFor(null, since),
    perService: services.map((s) => ({ serviceId: s.id, name: s.name, ...statsFor(s.id, since) })),
  };
}

// Queue load over time: how many people were waiting at each point.
// Covers the last `minutes` minutes, one point every `step` minutes, and the
// last point is "now". Uses the virtual clock.
export function timeline(minutes = 120, step = 5) {
  const nowMs = clock.now();
  const startMs = nowMs - minutes * MIN;

  const points = [];
  for (let t = startMs; t < nowMs; t += step * MIN) points.push(t);
  points.push(nowMs);

  // A token waits from creation until it is first called (or cancelled while
  // waiting). The first CALLED event is used when there is one, because a
  // token that was held and recalled has its called_at overwritten.
  const rows = db
    .prepare(
      `SELECT created_at, called_at, cancelled_at,
              (SELECT MIN(at) FROM token_events e
               WHERE e.token_id = tokens.id AND e.type = 'CALLED') AS first_called
       FROM tokens
       WHERE created_at <= ? AND (called_at IS NULL OR called_at >= ?)`
    )
    .all(new Date(nowMs).toISOString(), new Date(startMs).toISOString());

  const spans = rows.map((r) => {
    const endIso = r.first_called ?? r.called_at ?? r.cancelled_at;
    return { from: Date.parse(r.created_at), to: endIso ? Date.parse(endIso) : Infinity };
  });

  return points.map((t) => ({
    time: new Date(t).toISOString(),
    waiting: spans.filter((s) => s.from <= t && t < s.to).length,
  }));
}