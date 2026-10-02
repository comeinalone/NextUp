import { db } from "../db/db.js";

const round1 = (n) => Math.round(n * 10) / 10;

// Stored JSON can be missing or damaged; a bad row must never break the log.
function parse(text) {
  try {
    const value = text ? JSON.parse(text) : null;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

// The newest entries first, written in plain English.
// Shape: [{ at, type, text }]
export function recentEvents(limit = 50) {
  const services = new Map(
    db.prepare("SELECT id, name FROM services").all().map((s) => [s.id, s.name])
  );
  const counters = new Map(
    db.prepare("SELECT id, name FROM counters").all().map((c) => [c.id, c.name])
  );
  const counterName = (id) => (id == null ? "A counter" : (counters.get(id) ?? `Counter ${id}`));
  const serviceName = (id) => (id == null ? "a service" : (services.get(id) ?? `service ${id}`));

  function tokenText(r, meta) {
    const code = r.code ?? "A token";
    const at = r.counter_id ? ` at ${counterName(r.counter_id)}` : "";
    const why = r.reason ? ` (${r.reason})` : "";
    switch (r.type) {
      case "CREATED":
        return `${code} joined the queue${meta.priority ? " as a priority customer" : ""}`;
      case "CALLED":
        return `${code} called${at}`;
      case "STARTED":
        return `Service started for ${code}${at}`;
      case "COMPLETED":
        return `${code} completed${at}${meta.durationMin != null ? ` (${round1(meta.durationMin)} min)` : ""}`;
      case "SKIPPED":
        return `${code} skipped${at}${why}`;
      case "HELD":
        return `${code} put on hold${at}${why}`;
      case "RECALLED":
        return `${code} recalled${at}`;
      case "CANCELLED":
        return `${code} cancelled by the customer${r.counter_id ? ` after being called${at}` : ""}`;
      default:
        return `${code} ${r.type.toLowerCase()}`;
    }
  }

  function systemText(r, p) {
    switch (r.type) {
      case "SEED":
        return p.message ?? "Seed data loaded";
      case "COUNTER_STATE": {
        const name = counterName(p.counterId);
        const why = p.reason ? ` (${p.reason})` : "";
        if (p.to === "OPEN") return `${name} reopened`;
        if (p.to === "BREAK") return `${name} went on break${why}`;
        if (p.to === "CLOSED") return `${name} closed${why}`;
        return `${name} changed state`;
      }
      case "COUNTER_SWITCH_PENDING":
        return `${counterName(p.counterId)} will move from ${serviceName(p.from)} to ${serviceName(p.to)} after its current customer`;
      case "COUNTER_SWITCHED":
        return `${counterName(p.counterId)} moved from ${serviceName(p.from)} to ${serviceName(p.to)}`;
            case "ASSIST_REQUESTED":
        return `${counterName(p.counterId)} asked for help${p.tokenCode ? ` with ${p.tokenCode}` : ""} (${String(p.reason ?? "OTHER").toLowerCase().replace(/_/g, " ")})`;
      case "ASSIST_ACCEPTED":
        return `${counterName(p.helperCounterId)} is helping ${counterName(p.counterId)}`;
      case "ASSIST_RESOLVED":
        return `Help request from ${counterName(p.counterId)} resolved`;
      default:
        return r.type;
    }
  }

  // Take the newest `limit` from each table, merge, and keep the newest `limit`.
  const tokenRows = db
    .prepare(
      `SELECT e.id, e.type, e.counter_id, e.reason, e.at, e.meta, t.code
       FROM token_events e LEFT JOIN tokens t ON t.id = e.token_id
       ORDER BY e.at DESC, e.id DESC LIMIT ?`
    )
    .all(limit);
  const systemRows = db
    .prepare("SELECT id, type, payload, at FROM system_events ORDER BY at DESC, id DESC LIMIT ?")
    .all(limit);

  const rows = [
    ...tokenRows.map((r) => ({ at: r.at, sys: 0, type: r.type, text: tokenText(r, parse(r.meta)) })),
    ...systemRows.map((r) => ({ at: r.at, sys: 1, type: r.type, text: systemText(r, parse(r.payload)) })),
  ];

  // Newest first. On an identical timestamp the system entry comes first,
  // because it is the follow-on result of the token action.
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.sys - a.sys));

  return rows.slice(0, limit).map(({ at, type, text }) => ({ at, type, text }));
}