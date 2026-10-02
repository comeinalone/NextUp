# Shared Contract (draft v1)

All three agree on this in the first 20 minutes. After that, nobody changes a
shape without telling the others. Sample data in `client/src/lib/mocks.js`
must match these shapes exactly.

## Conventions

- Times from the server are ISO strings (`"2026-10-02T10:15:00.000Z"`).
- All durations and ETAs are **minutes as numbers** (`4.2`, not `"4m 12s"`).
- IDs are integers. Token **codes** are strings like `"A-042"`.
- Health is one of: `"NORMAL" | "BUSY" | "CRITICAL"`.
- Token state: `WAITING | CALLED | SERVING | HELD | SKIPPED | COMPLETED | CANCELLED`.
- Counter state: `OPEN | BREAK | CLOSED | SWITCHING`.
- Staff state: `AVAILABLE | SERVING | BREAK | OFFLINE`.
- Errors from REST: HTTP 4xx with `{ "error": { "code": "STRING", "message": "Human readable" } }`.
- Sockets send **full small snapshots**, never diffs.

---

## Socket events (server → client)

### `token:update` (room `token:<code>`)
```json
{
  "code": "A-042",
  "serviceId": 1,
  "serviceName": "Admissions",
  "isPriority": false,
  "state": "WAITING",
  "position": 7,
  "peopleAhead": 6,
  "etaMin": 13,
  "etaRange": [10, 16],
  "unavailable": false,
  "nowServing": "A-036",
  "counter": null,
  "notice": null,
  "customerChecklist": ["ID proof", "Fee receipt"]
}
```
- `counter` when called: `{ "id": 2, "name": "Counter 2" }`.
- `etaRange` is `null` and `unavailable` is `true` when no counter is open.
- `notice` is a string such as `"Counter 2 on a short break, ETAs updated"` or `null`.

### `service:update` (room `service:<id>`)
```json
{
  "serviceId": 1,
  "name": "Admissions",
  "prefix": "A",
  "waiting": 31,
  "openCounters": 2,
  "etaMin": 29,
  "health": "CRITICAL",
  "customerMinutes": 410,
  "nowServing": [{ "counterId": 1, "counterName": "Counter 1", "code": "A-036" }],
  "notice": null
}
```

### `counter:update` (room `counter:<id>`)
```json
{
  "counterId": 2,
  "name": "Counter 2",
  "serviceId": 1,
  "serviceName": "Admissions",
  "state": "OPEN",
  "stateReason": null,
  "pendingServiceId": null,
  "avgServiceMin": 4.2,
  "current": {
    "tokenId": 88,
    "code": "A-037",
    "state": "SERVING",
    "isPriority": false,
    "startedAt": "2026-10-02T10:12:00.000Z",
    "checklist": [
      { "itemId": 1, "label": "Verify ID", "done": true },
      { "itemId": 2, "label": "Check documents", "done": false }
    ]
  },
  "queue": [
    { "tokenId": 91, "code": "P-012", "isPriority": true, "waitMin": 11, "score": 26 }
  ],
  "held": [{ "tokenId": 70, "code": "A-030", "reason": "Missing document" }],
  "nextRecommended": { "code": "A-051", "reasons": ["Priority customer (+15)", "Waiting 11 min"] }
}
```
`current` is `null` when the counter is idle. `nextRecommended` is `null` when nobody is waiting.

### `manager:overview` (room `manager`)
```json
{
  "services": [ /* service:update shape */ ],
  "counters": [
    {
      "counterId": 1, "name": "Counter 1", "serviceId": 1,
      "state": "OPEN", "pendingServiceId": null,
      "staff": { "id": 3, "name": "Hitesh", "state": "SERVING" },
      "currentCode": "A-036"
    }
  ],
  "staff": [
    { "id": 3, "name": "Hitesh", "state": "SERVING", "counterId": 1,
      "skills": [1, 2, 3], "servedToday": 12, "avgHandlingMin": 4.1 }
  ],
  "openAssists": 1,
  "sim": { "running": true, "speed": 5, "bots": [1, 2], "arrivalsPerMin": 4 }
}
```

### `manager:recommendation` (room `manager`)
Payload is `null` when there is no recommendation.
```json
{
  "id": "rec-17",
  "counterId": 5,
  "counterName": "Counter 5",
  "fromServiceId": 3,
  "fromServiceName": "Certificates",
  "toServiceId": 1,
  "toServiceName": "Admissions",
  "before": {
    "from": { "etaMin": 5,  "customerMinutes": 20 },
    "to":   { "etaMin": 29, "customerMinutes": 410 }
  },
  "after": {
    "from": { "etaMin": 8,  "customerMinutes": 32 },
    "to":   { "etaMin": 18, "customerMinutes": 255 }
  },
  "savedCustomerMinutes": 143,
  "assumptions": "Based on current queue, no new arrivals, average service times from today."
}
```

### `assist:new` / `assist:update` (rooms `staff`, `manager`)
```json
{
  "id": 4, "counterId": 3, "counterName": "Counter 3", "tokenCode": "A-037",
  "reason": "DOCUMENT_ISSUE", "note": "", "state": "OPEN",
  "createdAt": "2026-10-02T10:14:00.000Z",
  "acceptedBy": null,
  "eligibleCounterIds": [1, 2]
}
```
Reasons: `DOCUMENT_ISSUE | SYSTEM_PROBLEM | OVERLOADED | DIFFICULT_CASE | OTHER`.
States: `OPEN | ACCEPTED | RESOLVED`.

### `display:called` (room `display`)
```json
{ "code": "A-042", "counterId": 3, "counterName": "Counter 3" }
```

---

## REST endpoints

Base path `/api`. Request bodies are JSON.
| GET | `/analytics/today` | | `{ issued, completed, waiting, noShows, avgWaitMin, avgServiceMin, perService: [{ serviceId, name, issued, completed, waiting, noShows, avgWaitMin, avgServiceMin }] }` (averages are null with no data) |
| GET | `/analytics/timeline` | `?minutes=120&step=5` (both optional) | `[{ time, waiting }]` oldest first, last point is now |
| GET | `/assist` | | unresolved requests, oldest first |
| POST | `/assist` | `{ counterId, reason, note?, tokenCode? }` | assist shape (201) |
| POST | `/assist/:id/accept` | `{ counterId }` (the helping counter) | assist shape |
| POST | `/assist/:id/resolve` | | assist shape |


### Customer
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/services` | | array of service shape + `requiredDocuments: string[]` |
| POST | `/tokens` | `{ serviceId, isPriority }` | `token:update` shape |
| GET | `/tokens/:code` | | `token:update` shape |
| POST | `/tokens/:code/cancel` | | `token:update` shape |
| POST | `/tokens/:code/rejoin` | | `token:update` shape |

### Counter
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/counters/:id` | | `counter:update` shape |
| POST | `/counters/:id/call-next` | | `counter:update` shape |
| POST | `/counters/:id/start` | | `counter:update` shape |
| POST | `/counters/:id/complete` | | `counter:update` shape |
| POST | `/counters/:id/skip` | `{ reason }` | `counter:update` shape |
| POST | `/counters/:id/hold` | `{ reason }` | `counter:update` shape |
| POST | `/counters/:id/recall/:tokenId` | | `counter:update` shape |
| POST | `/counters/:id/state` | `{ state: "OPEN"/"BREAK"/"CLOSED", reason }` | `counter:update` shape |
| POST | `/tokens/:id/checklist/:itemId` | `{ done }` | `counter:update` shape |
| POST | `/tokens/:id/transfer` | `{ serviceId }` | `counter:update` shape |

### Manager
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/manager/overview` | | `manager:overview` shape |
| POST | `/counters/:id/assign` | `{ serviceId }` | `manager:overview` shape |
| GET | `/manager/recommendation` | | recommendation or `null` |
| POST | `/manager/recommendation/apply` | `{ id }` | `manager:overview` shape |
| GET | `/manager/simulate` | `?service=1&counters=3` | `{ serviceId, counters, etaMin, customerMinutes }` |
| GET | `/analytics/today` | | `{ issued, completed, waiting, noShows, avgWaitMin, avgServiceMin, perService: [...] }` |
| GET | `/analytics/timeline` | | `[{ time, waiting }]` |
| GET | `/events` | `?limit=50` | `[{ at, type, text }]` |
| POST | `/assist` | `{ counterId, tokenCode, reason, note }` | assist shape |
| POST | `/assist/:id/accept` · `/resolve` | | assist shape |

### Demo mode
| Method | Path | Body |
|---|---|---|
| POST | `/sim/start` | `{ speed }` |
| POST | `/sim/stop` | |
| POST | `/sim/flood` | `{ serviceId, count }` |
| POST | `/sim/seed` | |
| POST | `/sim/reset` | |
| POST | `/sim/bots` | `{ counterIds: [1, 2] }` |
| POST | `/sim/arrivals` | `{ perMin: 4 }` |

---

## Rooms a client joins

Emit `join` with a room name after connecting:
`socket.emit("join", "token:A-042")` · `"service:1"` · `"counter:2"` · `"manager"` · `"display"` · `"staff"`

On join, the server immediately sends the current snapshot for that room, so
a page that loads or reconnects is correct without waiting for the next change.
