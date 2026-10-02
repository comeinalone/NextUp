import { db } from "../db/db.js";
import { config } from "../config.js";
import * as clock from "./clock.js";
import { simulateQueue } from "./etaEngine.js";
import { activeToken } from "./queueService.js";

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

// Reduce a simulation to the few numbers the comparison needs.
// A service with people waiting and no open counter is the worst case:
// it has no ETA, and its customer-minutes use a flat penalty per person.
function metrics(sim) {
  if (sim.unavailable) {
    return {
      etaMin: null,
      customerMinutes: sim.waiting * config.allocation.unavailablePenaltyMin,
      rank: sim.waiting > 0 ? Infinity : 0,
    };
  }
  return { etaMin: sim.etaMin, customerMinutes: sim.customerMinutes, rank: sim.etaMin };
}

const shape = (m) => ({ etaMin: round1(m.etaMin), customerMinutes: round1(m.customerMinutes) });

function hasSkill(staffId, serviceId) {
  return !!db
    .prepare("SELECT 1 FROM staff_skills WHERE staff_id = ? AND service_id = ?")
    .get(staffId, serviceId);
}

// Was a counter moved into or out of one of these services recently?
function recentlyChanged(serviceIds) {
  const rows = db
    .prepare(
      `SELECT payload, at FROM system_events
       WHERE type IN ('COUNTER_SWITCHED','COUNTER_SWITCH_PENDING')
       ORDER BY id DESC LIMIT 20`
    )
    .all();
  for (const r of rows) {
    if (clock.minutesSince(r.at) >= config.allocation.cooldownMin) continue;
    const p = JSON.parse(r.payload);
    if (serviceIds.includes(p.from) || serviceIds.includes(p.to)) return true;
  }
  return false;
}

// Returns the best counter move right now (shape: manager:recommendation in
// shared/contract.md), or null when nothing is worth doing.
export function computeRecommendation() {
  const cfg = config.allocation;
  const services = db.prepare("SELECT id, name FROM services ORDER BY id").all();
  const sims = new Map(services.map((s) => [s.id, simulateQueue(s.id)]));

  let best = null;

  for (const target of services) {
    const ts = sims.get(target.id);
    if (ts.waiting === 0) continue;
    const tm = metrics(ts);

    for (const donor of services) {
      if (donor.id === target.id) continue;
      const ds = sims.get(donor.id);
      if (ds.unavailable || ds.counters < cfg.donorMinCounters) continue;
      const dm = metrics(ds);

      if (tm.rank < cfg.etaRatio * dm.rank) continue; // not lopsided enough
      if (recentlyChanged([target.id, donor.id])) continue; // too soon after a change

      // Counters that could move: open, not switching, staff can do the new service.
      const candidates = db
        .prepare(
          `SELECT * FROM counters
           WHERE service_id = ? AND state = 'OPEN' AND pending_service_id IS NULL`
        )
        .all(donor.id)
        .filter((c) => !c.staff_id || hasSkill(c.staff_id, target.id));
      if (candidates.length === 0) continue;

      // What would the two services look like after the move?
      const afterT = metrics(simulateQueue(target.id, { counters: ts.counters + 1 }));
      const afterD = metrics(simulateQueue(donor.id, { counters: ds.counters - 1 }));

      const saving =
        tm.customerMinutes + dm.customerMinutes - (afterT.customerMinutes + afterD.customerMinutes);
      if (saving < cfg.minSavingCustomerMin) continue;
      if (afterD.etaMin > afterT.etaMin) continue; // don't just move the problem

      // Prefer a counter that is idle right now, then the lowest number.
      const counter = [...candidates].sort(
        (a, b) =>
          Number(!!activeToken(a.id)) - Number(!!activeToken(b.id)) || a.id - b.id
      )[0];

      if (!best || saving > best.saving) {
        best = {
          saving,
          rec: {
            id: `rec-${counter.id}-${target.id}`,
            counterId: counter.id,
            counterName: counter.name,
            fromServiceId: donor.id,
            fromServiceName: donor.name,
            toServiceId: target.id,
            toServiceName: target.name,
            before: { from: shape(dm), to: shape(tm) },
            after: { from: shape(afterD), to: shape(afterT) },
            savedCustomerMinutes: round1(saving),
            assumptions:
              "Based on the current queue with no new arrivals, using today's average service times." +
              (ts.unavailable
                ? ` ${target.name} has no open counter, so each waiting person is counted as ${cfg.unavailablePenaltyMin} min.`
                : ""),
          },
        };
      }
    }
  }

  return best ? best.rec : null;
}