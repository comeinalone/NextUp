# NextUp: Demo Script

One connected story that shows every feature. Each beat has what to **do**, what to **say**, and a **fallback** `curl` in case a screen misbehaves.

## Who is on which screen

| Person | Screen | Role in the demo |
|---|---|---|
| P2 | Phone (`/`, `/t/A-041`) plus the TV (`/display`) | The customer, and the waiting room |
| P1 | Counter consoles (`/counter/1`, `/counter/3`) | The counter staff |
| P3 | Manager dashboard (`/manager`, analytics) | The manager, and the presenter of the intelligence |

## Before you go on stage (2 minutes)

1. Everyone pulls `main`, runs `npm install`, and starts the app. Only one server is used for the demo, so everyone points at the same one (P1's laptop). P2 and P3 open their screens through P1's *Network* address from `npm run dev`.
2. Reset to clean data:
   ```bash
   curl -X POST localhost:4000/api/sim/reset
   ```
3. Check that after a reset nothing is waiting, no bots are set, and the speed is 1x.
4. P2: open `/display` on the TV and click once on the page so the browser allows the spoken announcement.
5. Open the audit log and the analytics page on P3's second tab.

Reset again between run-throughs. Token numbers start at `A-041`, `F-031`, `C-026` after every reset.

---

## Beat 1: Get a token (customer)

**Do (P2):** open `/`. Point at the service cards, then pick **Admissions** and tap **Get token**.

**Say:** "Each service card shows live wait and health. Before queuing, the customer sees exactly which documents to bring: photo ID, previous marksheet, fee receipt. No more waiting an hour and being sent home."

**Show:** token `A-041`, position 1, wait range, and the checklist of documents.

**Fallback:** `curl -X POST localhost:4000/api/tokens -H "Content-Type: application/json" -d '{"serviceId":1}'`

## Beat 2: Priority done fairly

**Do (P2):** on a second device or tab, get another Admissions token with the **priority** option (`A-042`).

**Say:** "Priority customers go first, but it isn't blind. A priority customer counts as having already waited 15 extra minutes, so a regular customer who has waited longer overtakes them. Nobody starves."

**Show:** `A-042` jumps to position 1 and `A-041` moves to position 2, and the page updates without a refresh.

**Fallback:** `curl -X POST localhost:4000/api/tokens -H "Content-Type: application/json" -d '{"serviceId":1,"isPriority":true}'`

## Beat 3: The counter serves (staff)

**Do (P1):** on `/counter/1`, point at the **next recommended** box, then **Call next**.

**Say:** "The counter shows why this customer is next: priority, waiting time. Staff aren't guessing." 

**Show together:**
- The TV announces "Token A 42, Counter 1" aloud, and the display shows it.
- The customer's phone switches to **Called** and shows the counter.

**Do (P1):** **Start**, tick two or three checklist items (Verify details, and so on), then **Complete**.

**Say:** "Every service has its own checklist, so processing is a workflow, not just a button. And when the service completes, the system learns: that real duration feeds the average that every future wait estimate uses."

**Fallback:** `curl -X POST localhost:4000/api/counters/1/call-next`, then `/start`, then `/complete` (same base address).

## Beat 4: Real life is messy: skip, hold, recall

**Do (P1):** call the next customer (`A-041`) and **Skip** them ("not at counter"). Then call a new customer, start, **Hold** them with the reason "missing marksheet", and recall them at another Admissions counter (`/counter/2`).

**Say:** "People don't show up, or arrive without a document. Skips make future estimates a little more optimistic, because the system tracks how often that happens. A held customer isn't lost: any counter of that service can recall them."

**Fallback:** `curl -X POST localhost:4000/api/counters/1/skip -H "Content-Type: application/json" -d '{"reason":"Not at counter"}'`

## Beat 5: A counter takes a break: honest delay notices

**Do (P1):** on `/counter/3` (Fee Payment), set the counter to **Break** with the reason "Tea break". P2 gets a Fee Payment token first so there's someone waiting.

**Say:** "Waiting customers are told why waits changed: 'Counter 3 on break, ETAs updated.' No silent changes."

**Show:** the notice banner on P2's Fee Payment token page, and the wait going up. Then set the counter back to **Open**: the notice disappears.

**Fallback:** `curl -X POST localhost:4000/api/counters/3/state -H "Content-Type: application/json" -d '{"state":"BREAK","reason":"Tea break"}'`

## Beat 6: Staff help each other

**Do (P1):** on `/counter/3`, press **Request help**, choose "document issue". P3 sees it appear on the manager dashboard. On `/counter/2`, **Accept**. Then **Resolve**.

**Say:** "A counter in trouble doesn't shout across the room. The request goes only to colleagues who are available and have the skill for that service. The manager sees every unresolved request."

**Show:** the request appearing live on the manager's page, the count going up and down.

**Fallback:** `curl -X POST localhost:4000/api/assist -H "Content-Type: application/json" -d '{"counterId":3,"reason":"DOCUMENT_ISSUE"}'`, then `/api/assist/<id>/accept` with `{"counterId":2}`, then `/api/assist/<id>/resolve`.

## Beat 7: The rush: the headline moment

**Do (P3):** press **Flood Admissions** (30 customers) on the manager's simulation panel.

**Say:** "Now a rush hits Admissions."

**Show:** Admissions turns **critical** (red), the wait jumps to about an hour, and P2's customer page and the TV update live.

**Fallback:** `curl -X POST localhost:4000/api/sim/flood -H "Content-Type: application/json" -d '{"serviceId":1,"count":30}'`

## Beat 8: The system tells the manager what to do

**Do (P3):** point at the **recommendation card**.

**Say:** "The system noticed Certificates has spare counters and Admissions is drowning. It recommends moving Counter 4, and only because the person sitting there has the Admissions skill. It shows before and after, and the total customer-minutes saved. And we checked: when the move is made, the real numbers match this prediction."

**Do (P1, in a terminal):** run `curl "localhost:4000/api/manager/simulate?service=1&counters=3"`, then change `counters` to 2 and 4 to compare.

**Say:** "This is the same engine that produces every customer's wait, so the answers always agree. The manager can test a decision before making it."

**Fallback:** `curl localhost:4000/api/manager/recommendation` and `curl "localhost:4000/api/manager/simulate?service=1&counters=3"`

## Beat 9: Apply it, and watch it work

**Do (P3):** press **Apply**.

**Say:** "One click."

**Show together:** Counter 4 appears under Admissions on the dashboard, the open-counter count goes from 2 to 3, and P2's customer page shows a shorter wait **immediately**. The card disappears and stays away for a few minutes, so the system doesn't flip-flop.

**Fallback:** `curl -X POST localhost:4000/api/manager/recommendation/apply -H "Content-Type: application/json" -d '{"id":"rec-4-1"}'`

## Beat 10: Manual control and safe switching

**Do (P3):** while a counter is serving someone, reassign it to another service from the counter grid.

**Say:** "If the manager moves a busy counter, it doesn't drop the customer. It shows as switching, finishes the current customer, then moves by itself. The manager can also refuse nonsense: you can't move a counter to a service its staff can't do."

**Show:** the counter in **switching** state, then moving once the customer finishes. Try a counter whose staff lacks the skill and show the refusal.

**Fallback:** `curl -X POST localhost:4000/api/counters/1/assign -H "Content-Type: application/json" -d '{"serviceId":2}'`

## Beat 11: Let it run itself

**Do (P3):** on the simulation panel, set bots to counters 1 to 3, arrivals to 4 per minute, speed to 10x, and press **Start**.

**Say:** "To show a whole day in seconds, we speed up time. Bots operate some counters with realistic service times and the occasional no-show, and customers keep arriving. Counters we don't give to bots stay manual, so a person can still step in."

**Show:** waiting counts, ETAs and "now serving" changing on every screen on their own, and the TV calling tokens.

**Fallback:**
```bash
curl -X POST localhost:4000/api/sim/bots     -H "Content-Type: application/json" -d '{"counterIds":[1,2,3]}'
curl -X POST localhost:4000/api/sim/arrivals -H "Content-Type: application/json" -d '{"perMin":4}'
curl -X POST localhost:4000/api/sim/start    -H "Content-Type: application/json" -d '{"speed":10}'
```

## Beat 12: Analytics and the audit log

**Do (P3):** open the analytics page, then the audit log.

**Say:** "Everything is recorded as it happens, so analytics need no separate system: customers served, waiting, no-shows, average wait and service time, and queue load over time. And the audit log answers 'why did they go before me?' with a plain-English record of every call, skip, move and help request."

**Show:** the load chart with the rush from Beat 7, and log lines such as "Counter 4 moved from Certificates to Admissions".

**Fallback:** `curl localhost:4000/api/analytics/today` and `curl "localhost:4000/api/events?limit=10"`

## Beat 13: Wrap-up (say it, don't demo it)

**Say:** "Other systems manage the line. NextUp makes the wait honest, makes priority fair and explainable, tells the manager what to do and what it will change, and lets them test decisions first. On our roadmap: AI routing from a plain-language problem, WhatsApp updates, multi-step journeys on one token, and rush-hour forecasts."

---

## If something breaks

| Problem | Do this |
|---|---|
| A screen is blank or stuck | Refresh it. The server re-sends the current state when a page reconnects |
| A screen doesn't react to a click | Use the `curl` fallback for that beat. The other screens still update live |
| The recommendation doesn't appear | Check that Admissions really has many waiting. If the card was applied recently, it stays hidden for 5 minutes. Run `curl -X POST localhost:4000/api/sim/reset` and flood again |
| Everything is odd | `curl -X POST localhost:4000/api/sim/reset`, refresh every screen, restart from Beat 1 |
| The TV doesn't speak | Click on the display page once to allow sound. If it still doesn't, skip it and point at the screen |
| Wi-Fi drops for teammates | Use one laptop with several browser windows |

## Features this demo covers

Tokens and priority (1, 2) · live wait-time range and learning (1, 3) · documents to bring (1) · counter workflow with checklists (3) · skip, hold and recall (4) · delay notices (5) · staff help requests (6) · overload detection and recommendation with predicted impact (7, 8) · what-if (8) · one-click apply and safe switching (9, 10) · bots, arrivals and time control (11) · analytics and audit log (12) · public display with spoken calls (3, 7).

## Not built (don't claim them)

Token transfer between services, a grace slot for missed turns, a closing-time cutoff, WhatsApp or SMS, AI routing.
