import { createServer } from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { db } from "./src/db/db.js";
import { config } from "./src/config.js";
import { createApp } from "./src/app.js";
import { initBroadcaster } from "./src/realtime/broadcaster.js";
import { botTick, arrivalTick, startSimLoop, stopSimLoop } from "./src/sim/bots.js";

let total = 0;
let passed = 0;
const ok = (label, cond, detail = "") => {
  total++;
  if (cond) passed++;
  console.log(cond ? "PASS" : "FAIL", "-", label, detail);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const httpServer = createServer(createApp());
const io = new Server(httpServer, { cors: { origin: "*" } });
initBroadcaster(io);
await new Promise((r) => httpServer.listen(4100, r));

const base = "http://localhost:4100/api";
async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

function client(room) {
  const socket = connect("http://localhost:4100");
  const events = [];
  socket.onAny((event, payload) => events.push({ event, payload }));
  return new Promise((resolve) =>
    socket.on("connect", () => {
      socket.emit("join", room);
      resolve({ socket, events });
    })
  );
}
const ofType = (c, type) => c.events.filter((e) => e.event === type).map((e) => e.payload);
const lastOv = (c) => ofType(c, "manager:overview").at(-1);
const lastTok = (c) => ofType(c, "token:update").at(-1);
const err = (r, status, code) => r.status === status && r.data.error?.code === code;
const overview = async () => (await call("GET", "/manager/overview")).data;
const totalWaiting = (o) => o.services.reduce((a, s) => a + s.waiting, 0);
const tokenState = (code) => db.prepare("SELECT state FROM tokens WHERE code = ?").get(code).state;
const countTokens = () => db.prepare("SELECT COUNT(*) AS n FROM tokens").get().n;
const live = (serviceId) =>
  db
    .prepare("SELECT COUNT(*) AS n FROM tokens WHERE service_id = ? AND state IN ('WAITING','CALLED','SERVING')")
    .get(serviceId).n;

// Call botTick by hand every 50 ms until the condition holds (or time runs out).
async function runBots(cond, maxMs) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    botTick();
    if (cond()) return true;
    await sleep(50);
  }
  return cond();
}
// Wait without ticking (for the real loop).
async function waitFor(cond, maxMs) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(50);
  }
  return cond();
}

config.sim.noShowRate = 0; // keep the main scenarios predictable

// 1. The new overview fields
const mgr = await client("manager");
await sleep(300);
let o = await overview();
ok("overview: sim has bots [] and arrivalsPerMin 0",
  Array.isArray(o.sim.bots) && o.sim.bots.length === 0 && o.sim.arrivalsPerMin === 0);

// 2. Choosing bot counters
const b1 = await call("POST", "/sim/bots", { counterIds: [1, 2] });
ok("set bots to counters 1 and 2", b1.status === 200 && JSON.stringify(b1.data.sim.bots) === "[1,2]");
await sleep(300);
ok("the manager room is pushed the bot list", JSON.stringify(lastOv(mgr).sim.bots) === "[1,2]");
ok("unknown counter -> 404", err(await call("POST", "/sim/bots", { counterIds: [1, 99] }), 404, "COUNTER_NOT_FOUND"));
ok("the refused attempt changed nothing", JSON.stringify((await overview()).sim.bots) === "[1,2]");
ok("ids as text -> 400", err(await call("POST", "/sim/bots", { counterIds: ["1"] }), 400, "BAD_REQUEST"));
ok("missing counterIds -> 400", err(await call("POST", "/sim/bots", {}), 400, "BAD_REQUEST"));
const dup = await call("POST", "/sim/bots", { counterIds: [2, 2, 1] });
ok("duplicates are merged and sorted", JSON.stringify(dup.data.sim.bots) === "[1,2]");
const none = await call("POST", "/sim/bots", { counterIds: [] });
ok("an empty list turns bots off", none.status === 200 && none.data.sim.bots.length === 0);
await call("POST", "/sim/bots", { counterIds: [1, 2] });

// 3. Bots do nothing while the simulator is off
for (let i = 0; i < 3; i++) await call("POST", "/tokens", { serviceId: 1 }); // A-041 .. A-043
botTick();
ok("simulator off: bots do nothing",
  (await call("GET", "/counters/1")).data.current === null && (await overview()).services[0].waiting === 3);

// 4. Start the simulator: bots serve the customers
const display = await client("display");
const w43 = await client("token:A-043");
await sleep(300);
const ewmaBefore = db.prepare("SELECT ewma_min FROM service_stats WHERE service_id = 1").get().ewma_min;
await call("POST", "/sim/start", { speed: 120 });

botTick();
await sleep(300);
const c1 = (await call("GET", "/counters/1")).data;
const c2 = (await call("GET", "/counters/2")).data;
ok("first tick: counters 1 and 2 call A-041 and A-042 (oldest first)",
  c1.current?.code === "A-041" && c1.current.state === "CALLED" &&
    c2.current?.code === "A-042" && c2.current.state === "CALLED");
ok("A-043 keeps waiting and is now first in line",
  lastTok(w43).state === "WAITING" && lastTok(w43).position === 1);
const calls = ofType(display, "display:called");
ok("the display announced both calls, in order",
  calls.length === 2 && calls[0].code === "A-041" && calls[0].counterId === 1 &&
    calls[1].code === "A-042" && calls[1].counterId === 2);

ok("the bots serve all three customers", await runBots(() => live(1) === 0, 20000));
await sleep(300);
ok("all three are COMPLETED",
  ["A-041", "A-042", "A-043"].every((c) => tokenState(c) === "COMPLETED"));
const items = db
  .prepare(
    `SELECT COUNT(*) AS n, SUM(tc.done) AS done
     FROM token_checklist tc JOIN tokens t ON t.id = tc.token_id
     WHERE t.code IN ('A-041','A-042','A-043')`
  )
  .get();
ok("every checklist item was ticked (3 customers x 5 items)", items.n === 15 && items.done === 15,
  `(${items.done} of ${items.n})`);
const durations = db
  .prepare(
    `SELECT e.meta FROM token_events e JOIN tokens t ON t.id = e.token_id
     WHERE e.type = 'COMPLETED' AND t.code IN ('A-041','A-042','A-043')`
  )
  .all()
  .map((r) => JSON.parse(r.meta).durationMin);
ok("service times look realistic (between 2 and 7 simulated minutes)",
  durations.length === 3 && durations.every((d) => d > 2 && d < 7),
  `(${durations.join(", ")})`);
const ewmaAfter = db.prepare("SELECT ewma_min FROM service_stats WHERE service_id = 1").get().ewma_min;
ok("the average service time learned from the bots", ewmaAfter !== ewmaBefore,
  `(${ewmaBefore.toFixed(2)} -> ${ewmaAfter.toFixed(2)})`);
ok("A-043's page got its final COMPLETED update", lastTok(w43).state === "COMPLETED");
ok("the display announced all three calls", ofType(display, "display:called").length === 3);

// 5. Counters that are not bots are left alone
await call("POST", "/tokens", { serviceId: 2 });
for (let i = 0; i < 5; i++) {
  botTick();
  await sleep(50);
}
ok("counter 3 (not a bot) is left alone",
  (await call("GET", "/counters/3")).data.current === null && (await overview()).services[1].waiting === 1);

// 6. A bot on break does not pick anyone up
await call("POST", "/sim/bots", { counterIds: [1] });
await call("POST", "/counters/1/state", { state: "BREAK", reason: "Test" });
const t6 = (await call("POST", "/tokens", { serviceId: 1 })).data.code;
for (let i = 0; i < 5; i++) {
  botTick();
  await sleep(50);
}
ok("a bot on break picks nobody up", tokenState(t6) === "WAITING");
await call("POST", "/counters/1/state", { state: "OPEN" });
ok("once reopened it picks the customer up", await runBots(() => tokenState(t6) !== "WAITING", 3000));
ok("...and finishes them", await runBots(() => tokenState(t6) === "COMPLETED", 20000));

// 7. No-shows
config.sim.noShowRate = 1;
const nsBefore = db.prepare("SELECT no_show_rate FROM service_stats WHERE service_id = 1").get().no_show_rate;
const t7 = (await call("POST", "/tokens", { serviceId: 1 })).data.code;
ok("with a no-show rate of 1 the bot skips the customer", await runBots(() => tokenState(t7) === "SKIPPED", 5000));
const skipRow = db.prepare("SELECT skip_reason FROM tokens WHERE code = ?").get(t7);
ok("the skip reason says it was a bot no-show", skipRow.skip_reason === "Bot: no-show");
const nsAfter = db.prepare("SELECT no_show_rate FROM service_stats WHERE service_id = 1").get().no_show_rate;
ok("the no-show rate went up", nsAfter > nsBefore, `(${nsBefore.toFixed(3)} -> ${nsAfter.toFixed(3)})`);
config.sim.noShowRate = 0;

// 8. Stopping pauses the bots
await call("POST", "/sim/stop");
const t8 = (await call("POST", "/tokens", { serviceId: 1 })).data.code;
for (let i = 0; i < 5; i++) {
  botTick();
  await sleep(50);
}
ok("simulator stopped: bots are idle", tokenState(t8) === "WAITING");
await call("POST", `/tokens/${t8}/cancel`);

// 9. Automatic arrivals
ok("arrivals -1 -> 400", err(await call("POST", "/sim/arrivals", { perMin: -1 }), 400, "BAD_REQUEST"));
ok("arrivals 31 -> 400", err(await call("POST", "/sim/arrivals", { perMin: 31 }), 400, "BAD_REQUEST"));
ok("arrivals as text -> 400", err(await call("POST", "/sim/arrivals", { perMin: "5" }), 400, "BAD_REQUEST"));
ok("missing perMin -> 400", err(await call("POST", "/sim/arrivals", {}), 400, "BAD_REQUEST"));
const a1 = await call("POST", "/sim/arrivals", { perMin: 6 });
ok("set arrivals to 6 per minute", a1.status === 200 && a1.data.sim.arrivalsPerMin === 6);
await sleep(300);
ok("the manager room is pushed the rate", lastOv(mgr).sim.arrivalsPerMin === 6);

const stoppedBefore = countTokens();
arrivalTick();
await sleep(500);
arrivalTick();
ok("simulator stopped: no arrivals", countTokens() === stoppedBefore);

await call("POST", "/sim/bots", { counterIds: [] }); // nobody serves, so arrivals pile up
await call("POST", "/sim/start", { speed: 60 });
arrivalTick(); // start the timing
const t9 = countTokens();
await sleep(1000);
arrivalTick();
const made = countTokens() - t9;
ok("6 per simulated minute: about 6 arrivals in one real second at 60x", made >= 5 && made <= 7, `(${made})`);
await sleep(300);
ok("the manager room is pushed the arrivals", totalWaiting(lastOv(mgr)) === totalWaiting(await overview()));
await call("POST", "/sim/arrivals", { perMin: 0 });
const t9b = countTokens();
await sleep(500);
arrivalTick();
ok("rate 0: arrivals stop", countTokens() === t9b);

// 10. Seed keeps the automation, reset clears it
await call("POST", "/sim/start", { speed: 30 });
await call("POST", "/sim/bots", { counterIds: [1, 2] });
await call("POST", "/sim/arrivals", { perMin: 3 });
const sd = await call("POST", "/sim/seed");
ok("seed keeps the simulator, bots and arrivals",
  sd.data.sim.running === true && sd.data.sim.speed === 30 &&
    JSON.stringify(sd.data.sim.bots) === "[1,2]" && sd.data.sim.arrivalsPerMin === 3);
const rs = await call("POST", "/sim/reset");
ok("reset turns everything off",
  rs.data.sim.running === false && rs.data.sim.speed === 1 &&
    rs.data.sim.bots.length === 0 && rs.data.sim.arrivalsPerMin === 0);

// 11. The real loop
await call("POST", "/sim/bots", { counterIds: [1, 2] });
await call("POST", "/sim/start", { speed: 120 });
await call("POST", "/tokens", { serviceId: 1 }); // A-041
await call("POST", "/tokens", { serviceId: 1 }); // A-042
startSimLoop(50);
ok("the real loop serves both customers on its own", await waitFor(() => live(1) === 0, 20000));
stopSimLoop();
const t11 = (await call("POST", "/tokens", { serviceId: 1 })).data.code;
await sleep(600);
ok("after the loop is stopped nothing happens", tokenState(t11) === "WAITING");

console.log(`\n${passed} of ${total} passed`);
io.close();
process.exit(0);