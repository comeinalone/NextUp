# NextUp

**A digital token and queue system that doesn't just manage the line: it predicts it, explains it, and tells the manager how to fix it.**

Built for the *Bid-2-Build* hackathon, Problem #3: *Digital Token & Dynamic Queue Intelligence.* Customers get a token and a live wait estimate, staff run multiple counters and services, and a manager sees overload coming and gets a recommendation with its predicted effect before acting on it.

## What makes it different

Most queue systems show "you are number 8." NextUp goes further in four ways.

**1. Adaptive wait times.** The estimate isn't a fixed average. It simulates the queue: how long each open counter has already spent on its current customer, which counters are on break, and how often called customers don't show up. It learns from every completed service and updates on every event. Customers see a range ("10 to 14 min"), not a falsely precise number.

**2. Explainable priority.** Priority customers (senior citizens, pregnant women, people with disabilities) are served earlier, but fairly. A priority customer counts as having already waited 15 extra minutes, so a regular customer who has waited longer overtakes a fresh priority arrival and nobody starves. Staff see *why* a token is next ("Priority customer, waiting 11 min").

**3. Recommendations with predicted impact.** When one service is overloaded and another has spare counters, the system recommends moving a specific counter, only if the person at that counter has the skill, and shows before and after waits and total customer-minutes saved. We checked the prediction against what actually happens after the move: they match.

**4. What-if simulation.** The manager can ask "what if Admissions had 3 counters?" and get the answer from the same engine that produces customer wait times, before changing anything.

## Features

**Customer**
- Choose a service, get a token (`A-042`), mark yourself as a priority customer
- Live position, people ahead, wait-time range, and the counter once you're called
- See which documents to bring before you queue
- Delay notices when a counter goes on a break ("Counter 2 on break, ETAs updated")
- Cancel and leave the queue

**Counter staff**
- Call next, start, complete, skip (no-show), hold, and recall a token
- Per-service checklist on each customer (verify ID, check documents, and so on)
- Open, break, or close a counter, with a reason
- Ask for help; only available colleagues with the right skill can answer

**Manager**
- Live overview of every service (waiting, open counters, ETA, health: normal, busy, critical) and every counter and staff member
- Counter-to-service reassignment. A busy counter finishes its current customer first, then switches
- Counter recommendation with before and after numbers, applied in one click
- What-if simulator
- Analytics: served, waiting, no-shows, average wait and service time, queue load over time
- Audit log in plain English ("A-042 called at Counter 1", "Counter 4 moved from Certificates to Admissions")

**Public display**
- Now serving per counter, current wait per service, and a spoken announcement when a token is called

**Demo mode**
- Speed up the clock, flood a service with customers, run bot counters and automatic arrivals, and reset to a clean slate (see [Running the demo](#running-the-demo))

## Run it

You need Node.js 20 or newer.

```bash
git clone https://github.com/comeinalone/NextUp.git
cd NextUp/queue-intelligence
npm install
npm run seed -w server
npm run dev
```

Then open **http://localhost:5173**. The API runs on port 4000, and the web app forwards `/api` and `/socket.io` to it, so there's nothing else to configure.

| Screen | Address |
|---|---|
| Customer: pick a service, get a token | `/` |
| Customer: live token page | `/t/A-042` |
| Counter console | `/counter/1` (counters 1 to 5) |
| Manager dashboard | `/manager` |
| Manager: staff | `/manager/staff` |
| Manager: analytics | `/manager/analytics` |
| Public display | `/display` |

To try it from a phone on the same Wi-Fi, open the *Network* address that `npm run dev` prints.

`npm run seed -w server` loads three services (Admissions, Fee Payment, Certificates), five counters, five staff with different skills, and about 95 past tokens, so averages and analytics start realistic. Run it again at any time to start fresh. `npm run lint` runs the linter.

## Running the demo

A real service takes minutes, so the demo mode bends time. Everything below can be done from the manager dashboard's simulation panel, or from a terminal:

```bash
# 1. Let bots operate counters 1 to 3, send in a trickle of customers, run at 10x speed
curl -X POST localhost:4000/api/sim/bots     -H "Content-Type: application/json" -d '{"counterIds":[1,2,3]}'
curl -X POST localhost:4000/api/sim/arrivals -H "Content-Type: application/json" -d '{"perMin":4}'
curl -X POST localhost:4000/api/sim/start    -H "Content-Type: application/json" -d '{"speed":10}'

# 2. Or: a sudden rush of 30 customers into Admissions
curl -X POST localhost:4000/api/sim/flood    -H "Content-Type: application/json" -d '{"serviceId":1,"count":30}'

# 3. The recommendation appears on the manager dashboard. Apply it there, or:
curl localhost:4000/api/manager/recommendation

# Pause everything / start over
curl -X POST localhost:4000/api/sim/stop
curl -X POST localhost:4000/api/sim/reset
```

On Windows PowerShell, use `Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/sim/reset` (add `-ContentType "application/json" -Body '{"serviceId":1,"count":30}'` where a body is needed), or use Git Bash.

Counters you don't hand to the bots stay manual, so a person can operate them during the demo.

## How it works

One Node.js server is the single source of truth. Every screen talks to it over REST and receives live updates over Socket.IO.

```text
  Customer      Counter       Manager       Display
     │             │             │             │
     └─────────────┴──────┬──────┴─────────────┘
              REST (actions) + Socket.IO (live updates)
                          │
        ┌─────────────────▼──────────────────┐
        │        Express + Socket.IO         │
        │                                    │
        │  Queue service ──► Audit events    │
        │       │                            │
        │  Scheduler   ETA engine   Allocation│
        │  (priority)  (simulate)   (recommend)│
        │       │                            │
        │  Snapshots ─► Broadcaster (rooms)  │
        └─────────────────┬──────────────────┘
                          │
                   SQLite (one file)
```

- **Every action is one database transaction.** A token can never be called by two counters, and if anything fails, nothing is half-applied.
- **After every change the server pushes fresh snapshots** to exactly the screens affected, and also every 5 seconds, because wait estimates change as time passes.
- **One simulation function** (`simulateQueue`) produces customer wait times, the recommendation's before and after numbers, and the what-if answers, so they always agree.
- **One virtual clock** drives all time, which is what lets the demo run faster than real life.

The API contract (every endpoint and payload) is in [`queue-intelligence/shared/contract.md`](queue-intelligence/shared/contract.md).

## Tech stack

React, Vite and Tailwind CSS on the front end. Node.js, Express, Socket.IO and SQLite (`better-sqlite3`) on the back end, validated with zod. All plain JavaScript, no external services, runs on one laptop.

## Project layout

```text
queue-intelligence/
├── client/                 React app (all four screens)
├── server/
│   └── src/
│       ├── core/           queue logic, scheduler, ETA engine, allocation engine,
│       │                   snapshots, analytics, audit log, assistance requests
│       ├── realtime/       Socket.IO rooms and the refresh pipeline
│       ├── routes/         REST endpoints
│       ├── sim/            demo mode (bots, arrivals)
│       └── db/             schema and seed data
└── shared/contract.md      the API contract
```

## What we left out

AI routing from a plain-language problem description, WhatsApp and SMS notifications, multi-step journeys on one token, rush-hour forecasting, and merging appointments with walk-ins are on the roadmap. We chose to make the core queue, the estimates, and the manager's decisions solid first.

## Team

| Role | Area | Name |
|---|---|---|
| P1: Engine | Server, database, queue logic, wait-time estimation, recommendations, demo mode | |
| P2: Floor | Customer app, counter console, public display | |
| P3: Control Room | Manager dashboard, staff, analytics | |
