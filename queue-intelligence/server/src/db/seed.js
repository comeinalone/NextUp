import { db, initSchema, dropAll } from "./db.js";

const MIN = 60 * 1000;
const rand = (min, max) => min + Math.random() * (max - min);
const iso = (ms) => new Date(ms).toISOString();

dropAll();
initSchema();

const services = [
  { name: "Admissions", prefix: "A", min: 4.2, color: "#6366f1" }, // id 1
  { name: "Fee Payment", prefix: "F", min: 3.0, color: "#f59e0b" }, // id 2
  { name: "Certificates", prefix: "C", min: 2.5, color: "#10b981" }, // id 3
];

const staff = [
  { name: "Arya", skills: [1, 3] }, // id 1
  { name: "Rahul", skills: [2] }, // id 2
  { name: "Hitesh", skills: [1, 2, 3] }, // id 3
  { name: "Meera", skills: [1, 2] }, // id 4
  { name: "Kabir", skills: [3, 1] }, // id 5
];

// name, service id, staff id
const counters = [
  ["Counter 1", 1, 4],
  ["Counter 2", 1, 3],
  ["Counter 3", 2, 2],
  ["Counter 4", 3, 1],
  ["Counter 5", 3, 5],
];

// service id, label, customer facing (1 = customer sees it as "bring this")
const checklist = [
  [1, "Photo ID", 1],
  [1, "Previous marksheet", 1],
  [1, "Fee receipt", 1],
  [1, "Verify details", 0],
  [1, "Complete request", 0],
  [2, "Fee slip", 1],
  [2, "Student ID card", 1],
  [2, "Verify amount", 0],
  [2, "Issue receipt", 0],
  [3, "Photo ID", 1],
  [3, "Application form", 1],
  [3, "Verify records", 0],
  [3, "Issue certificate", 0],
];

// service id, number of fake completed tokens
const history = [
  [1, 40],
  [2, 30],
  [3, 25],
];

const run = db.transaction(() => {
  const now = Date.now();

  const insService = db.prepare(
    "INSERT INTO services (name, prefix, default_service_min, color) VALUES (?,?,?,?)"
  );
  services.forEach((s) => insService.run(s.name, s.prefix, s.min, s.color));

  const insStaff = db.prepare("INSERT INTO staff (name, state) VALUES (?, 'AVAILABLE')");
  const insSkill = db.prepare("INSERT INTO staff_skills (staff_id, service_id) VALUES (?,?)");
  staff.forEach((p) => {
    const id = insStaff.run(p.name).lastInsertRowid;
    p.skills.forEach((sid) => insSkill.run(id, sid));
  });

  const insCounter = db.prepare(
    "INSERT INTO counters (name, service_id, staff_id) VALUES (?,?,?)"
  );
  counters.forEach((c) => insCounter.run(...c));

  const insItem = db.prepare(
    "INSERT INTO checklist_items (service_id, label, customer_facing, position) VALUES (?,?,?,?)"
  );
  checklist.forEach((c, i) => insItem.run(c[0], c[1], c[2], i));

  const insToken = db.prepare(`
    INSERT INTO tokens
      (code, number, service_id, is_priority, state, counter_id,
       created_at, called_at, started_at, completed_at)
    VALUES (?,?,?,?, 'COMPLETED', ?, ?,?,?,?)
  `);
  const insStats = db.prepare(
    "INSERT INTO service_stats (service_id, ewma_min, no_show_rate, updated_at) VALUES (?,?,?,?)"
  );

  for (const [serviceId, count] of history) {
    const svc = services[serviceId - 1];
    const counterIds = db
      .prepare("SELECT id FROM counters WHERE service_id = ?")
      .all(serviceId)
      .map((r) => r.id);

    const times = Array.from({ length: count }, () => now - rand(25, 200) * MIN).sort(
      (a, b) => a - b
    );

    let durationSum = 0;
    times.forEach((created, i) => {
      const called = created + rand(2, 12) * MIN;
      const started = called + 0.2 * MIN;
      const duration = Math.max(0.8, svc.min * rand(0.6, 1.4));
      durationSum += duration;
      const completed = started + duration * MIN;
      const number = i + 1;
      const code = `${svc.prefix}-${String(number).padStart(3, "0")}`;
      const counterId = counterIds[Math.floor(Math.random() * counterIds.length)];
      insToken.run(
        code, number, serviceId, Math.random() < 0.08 ? 1 : 0, counterId,
        iso(created), iso(called), iso(started), iso(completed)
      );
    });

    insStats.run(serviceId, durationSum / count, 0.05, iso(now));
  }

  db.prepare("INSERT INTO system_events (type, payload, at) VALUES (?,?,?)").run(
    "SEED", JSON.stringify({ message: "Seed data loaded" }), iso(now)
  );
});

run();

const n = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
console.log(
  `Seeded: ${n("services")} services, ${n("counters")} counters, ` +
    `${n("staff")} staff, ${n("tokens")} historical tokens`
);