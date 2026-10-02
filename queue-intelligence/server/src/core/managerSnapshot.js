import { db } from "../db/db.js";
import * as clock from "./clock.js";
import { activeToken } from "./queueService.js";
import { allServiceSnapshots } from "./snapshots.js";

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

// Midnight (server local time) of the current day, as an ISO string.
function startOfTodayIso() {
  const d = new Date(clock.now());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Builds the manager:overview payload described in shared/contract.md.
export function managerSnapshot() {
  const since = startOfTodayIso();

  const counterRows = db
    .prepare(
      `SELECT c.*, s.name AS staff_name, s.state AS staff_state
       FROM counters c LEFT JOIN staff s ON s.id = c.staff_id
       ORDER BY c.id`
    )
    .all();

  const counters = counterRows.map((c) => {
    const active = activeToken(c.id);
    return {
      counterId: c.id,
      name: c.name,
      serviceId: c.service_id,
      state: c.state,
      pendingServiceId: c.pending_service_id,
      staff: c.staff_id ? { id: c.staff_id, name: c.staff_name, state: c.staff_state } : null,
      currentCode: active ? active.code : null,
    };
  });

  const served = db.prepare(
    `SELECT COUNT(*) AS n,
            AVG((julianday(completed_at) - julianday(started_at)) * 1440) AS avgMin
     FROM tokens
     WHERE state = 'COMPLETED' AND counter_id = ? AND completed_at >= ?`
  );
  const skillsOf = db.prepare(
    "SELECT service_id FROM staff_skills WHERE staff_id = ? ORDER BY service_id"
  );

  const staff = db
    .prepare("SELECT * FROM staff ORDER BY id")
    .all()
    .map((p) => {
      const counter = counterRows.find((c) => c.staff_id === p.id) ?? null;
      const stats = counter ? served.get(counter.id, since) : { n: 0, avgMin: null };
      return {
        id: p.id,
        name: p.name,
        state: p.state,
        counterId: counter ? counter.id : null,
        skills: skillsOf.all(p.id).map((r) => r.service_id),
        servedToday: stats.n,
        avgHandlingMin: round1(stats.avgMin),
      };
    });

  const { n: openAssists } = db
    .prepare("SELECT COUNT(*) AS n FROM assistance_requests WHERE state != 'RESOLVED'")
    .get();

  return {
    services: allServiceSnapshots(),
    counters,
    staff,
    openAssists,
    sim: { running: false, speed: clock.getSpeed() },
  };
}