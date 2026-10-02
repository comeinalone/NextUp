import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Clock, Info, CircleAlert, LifeBuoy, Users, ClipboardCheck, Pause, Power, Star } from "lucide-react";
import { api } from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { serviceStyle } from "../../lib/constants";
import Button from "../../components/Button";
import Brand from "../../components/Brand";
import StatusBadge from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";

const GUTTER = "px-[14px] min-[430px]:px-5 lg:px-[38px]";
const SELECT = "min-h-[44px] w-full rounded-[5px] border border-control bg-surface px-2 text-[11px] text-ink";
const HOLD_REASONS = ["Missing document", "Customer stepped away", "Other"];
const BREAK_REASONS = ["Short break", "Lunch break", "Other"];
const HELP_REASONS = [
  ["DOCUMENT_ISSUE", "Document issue"], ["SYSTEM_PROBLEM", "System problem"], ["OVERLOADED", "Overloaded"],
  ["DIFFICULT_CASE", "Difficult case"], ["OTHER", "Other"],
];
const COUNTER_BADGE = {
  OPEN: ["normal", "Open"], BREAK: ["busy", "On break"], CLOSED: ["idle", "Closed"], SWITCHING: ["busy", "Switching"],
};
const TOKEN_BADGE = {
  CALLED: ["serving", "Called"], SERVING: ["serving", "Serving"], HELD: ["busy", "On hold"],
};

function Panel({ title, desc, icon: Icon, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-[10px] border border-line bg-surface ${className}`}>
      <div className="flex items-center justify-between gap-4 px-[17px] py-[17px] sm:px-[23px] sm:py-[21px]">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.3px]">{title}</h2>
          {desc && <p className="text-xs text-mute">{desc}</p>}
        </div>
        {Icon && <Icon className="h-[19px] w-[19px] shrink-0 text-[#718178]" aria-hidden="true" />}
      </div>
      {children}
    </section>
  );
}

const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export default function CounterConsole() {
  const id = Number(useParams().id);
  const toast = useToast();
  const { data: c, setData, error } = useLive(`counter:${id}`, "counter:update", {
    fetcher: () => api.counter(id),
    match: (p) => p.counterId === id,
  });
  const [holdReason, setHoldReason] = useState(HOLD_REASONS[0]);
  const [breakReason, setBreakReason] = useState(BREAK_REASONS[0]);
  const [helpReason, setHelpReason] = useState(HELP_REASONS[0][0]);

  // 1s tick for the service timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // If the server sends `serverNow` (simulated clock), correct for the difference; otherwise offset is 0.
  const offset = useMemo(() => (c?.serverNow ? Date.parse(c.serverNow) - Date.now() : 0), [c]);

  // Every action returns the new counter snapshot. Button shows pending + error toasts.
  const act = (fn) => async () => setData(await fn());

  if (error && !c) {
    return (
      <div className="min-h-screen p-6">
        <p className="flex items-center gap-3 rounded-[10px] border border-critical/20 bg-critical-soft p-4 text-[13px] text-critical">
          <CircleAlert className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          {error.message}
        </p>
      </div>
    );
  }

  const cur = c?.current ?? null;
  const open = c?.state === "OPEN";
  const queue = c?.queue ?? [];
  const canCall = open && !cur && queue.length > 0;
  const elapsed = cur?.startedAt ? Math.max(0, Math.floor((now + offset - Date.parse(cur.startedAt)) / 1000)) : null;
  const overtime = cur?.state === "SERVING" && elapsed !== null && c.avgServiceMin > 0 && elapsed > c.avgServiceMin * 2 * 60;
  const [tone, label] = COUNTER_BADGE[c?.state] ?? ["idle", "Unknown"];
  const idleHint = !open ? "This counter isn't open, so it can't call tokens." : queue.length === 0 ? "Nobody is waiting right now." : "Call the next customer when you're ready.";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex h-[52px] max-w-[1500px] items-center justify-between lg:h-[70px] ${GUTTER}`}>
          <Brand />
          <span className="text-xs text-[#83918c]">Counter console</span>
        </div>
      </header>

      <main className={`mx-auto max-w-[1500px] py-[25px] lg:pb-6 lg:pt-9 ${GUTTER}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-eyebrow">Counter console</p>
            <h1 className="mt-2 text-[clamp(26px,3vw,33px)] font-semibold leading-[1.2] tracking-[-1.2px]">{c?.name ?? "Loading…"}</h1>
            <p className="mt-[10px] text-[13px] text-mute">
              {c ? `${c.serviceName}. Average service time ${c.avgServiceMin ?? "-"} min.` : " "}
            </p>
          </div>
          {c && <StatusBadge tone={tone}>{label}</StatusBadge>}
        </div>

        {c?.state === "SWITCHING" && (
          <p className="mt-5 flex items-center gap-[11px] rounded-[7px] border border-notice-line bg-notice px-[17px] py-[14px] text-[11px] text-notice-text">
            <Info className="h-4 w-4 shrink-0 text-[#718178]" aria-hidden="true" />
            Finish the current token. This counter then moves to a new service.
          </p>
        )}

        {!c ? (
          <div className="mt-[27px] h-[260px] rounded-[10px] border border-line bg-inset" aria-hidden="true" />
        ) : (
          <div className="mt-[27px] grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel title="Current token" desc="The customer at this counter." icon={Users}>
                <div className="border-t border-line p-[17px] sm:p-[23px]">
                  {!cur ? (
                    <div className="rounded-md border border-inset-line bg-inset p-6 text-center">
                      <p className="text-[13px] font-semibold">No token at this counter</p>
                      <p className="mt-1 text-xs text-mute">{idleHint}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-inset-line bg-inset p-[14px]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-[40px] font-semibold leading-none tracking-[1px]">
                          {cur.code}
                          {cur.isPriority && <Star className="ml-2 inline h-5 w-5 align-top text-fees" aria-label="Priority" />}
                        </p>
                        <StatusBadge tone={TOKEN_BADGE[cur.state]?.[0] ?? "idle"}>{TOKEN_BADGE[cur.state]?.[1] ?? cur.state}</StatusBadge>
                      </div>
                      {elapsed !== null && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-mute">
                          <Clock className="h-3.5 w-3.5 text-[#718178]" aria-hidden="true" />
                          <span className="font-mono text-[13px] font-semibold text-ink tabular-nums">{fmt(elapsed)}</span> in service
                        </p>
                      )}
                    </div>
                  )}

                  {overtime && (
                    <p className="mt-3 flex items-center gap-2 rounded-md bg-busy-soft px-3 py-2 text-[11px] text-busy" role="status">
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      This is taking longer than usual. You can ask for help below.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!cur && <Button disabled={!canCall} onClick={act(() => api.callNext(id))}>Call next</Button>}
                    {cur?.state === "CALLED" && (
                      <>
                        <Button onClick={act(() => api.start(id))}>Start</Button>
                        <Button variant="secondary" onClick={act(() => api.skip(id, "No show"))}>Skip</Button>
                      </>
                    )}
                    {cur?.state === "SERVING" && (
                      <>
                        <Button onClick={act(() => api.complete(id))}>Complete</Button>
                        <Button variant="secondary" onClick={act(() => api.hold(id, holdReason))}>Hold</Button>
                        <label className="w-full max-w-[220px] text-[10px] text-field">
                          Hold reason
                          <select className={`${SELECT} mt-1`} value={holdReason} onChange={(e) => setHoldReason(e.target.value)}>
                            {HOLD_REASONS.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </Panel>

              {cur && (
                <Panel title="Checklist" desc="Tick items as you verify them." icon={ClipboardCheck}>
                  <ul className="border-t border-line">
                    {(cur.checklist ?? []).map((i) => (
                      <li key={i.itemId} className="border-b border-rowline last:border-b-0">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-[17px] py-2 text-[13px] sm:px-[23px]">
                          <input
                            type="checkbox" className="h-4 w-4 accent-[#102d2a]" checked={i.done}
                            onChange={(e) => api.setChecklist(cur.tokenId, i.itemId, e.target.checked).then(setData).catch((err) => toast.error(err.message))}
                          />
                          <span className={i.done ? "text-mute line-through" : ""}>{i.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {cur && (
                <Panel title="Need help?" desc="Alert the manager and available staff." icon={LifeBuoy}>
                  <div className="flex flex-wrap items-end gap-3 border-t border-line p-[17px] sm:p-[23px]">
                    <label className="w-full max-w-[220px] text-[10px] text-field">
                      Reason
                      <select className={`${SELECT} mt-1`} value={helpReason} onChange={(e) => setHelpReason(e.target.value)}>
                        {HELP_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <Button variant="secondary" onClick={async () => { await api.requestHelp(id, cur.code, helpReason); toast.info("Help request sent."); }}>
                      Request help
                    </Button>
                  </div>
                </Panel>
              )}
            </div>

            <div className="space-y-4">
              <Panel title="Next recommended" desc="Highest priority score." icon={Star}>
                <div className="border-t border-line p-[17px] sm:p-[23px]">
                  {c.nextRecommended ? (
                    <div className="rounded-md border border-inset-line bg-inset p-[14px]">
                      <p className="font-mono text-[23px] font-semibold leading-none tracking-[1px]">{c.nextRecommended.code}</p>
                      <ul className="mt-2 space-y-0.5 text-[11px] text-mute">
                        {c.nextRecommended.reasons.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-mute">Nobody is waiting.</p>
                  )}
                </div>
              </Panel>

              <Panel title="Queue" desc={`${queue.length} waiting for this service.`} icon={Users}>
                <ul className="border-t border-line" aria-live="polite">
                  {queue.length === 0 && <li className="px-6 py-6 text-center text-xs text-mute">The queue is empty.</li>}
                  {queue.slice(0, 8).map((q) => {
                    const st = serviceStyle(q.code);
                    return (
                      <li key={q.tokenId} className="flex items-center justify-between gap-3 border-b border-rowline px-[17px] py-3 last:border-b-0 sm:px-[23px]">
                        <span className={`font-mono text-[15px] font-semibold tracking-[1px] ${st.text}`}>
                          {q.code}{q.isPriority && <span className="ml-1" title="Priority">★</span>}
                        </span>
                        <span className="text-[11px] text-mute tabular-nums">Waiting {Math.round(q.waitMin)} min</span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              <Panel title="On hold" desc="Customers who stepped away." icon={Pause}>
                <ul className="border-t border-line">
                  {(c.held ?? []).length === 0 && <li className="px-6 py-6 text-center text-xs text-mute">No held tokens.</li>}
                  {(c.held ?? []).map((h) => (
                    <li key={h.tokenId} className="flex items-center justify-between gap-3 border-b border-rowline px-[17px] py-3 last:border-b-0 sm:px-[23px]">
                      <div>
                        <p className="font-mono text-[15px] font-semibold tracking-[1px]">{h.code}</p>
                        <p className="text-[10px] text-mute">{h.reason}</p>
                      </div>
                      <Button variant="secondary" disabled={!!cur || !open} onClick={act(() => api.recall(id, h.tokenId))}>Recall</Button>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Counter status" desc="Open, break or close this counter." icon={Power}>
                <div className="space-y-3 border-t border-line p-[17px] sm:p-[23px]">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={c.state === "OPEN" || c.state === "SWITCHING"} onClick={act(() => api.setCounterState(id, "OPEN"))}>Open</Button>
                    <Button variant="secondary" disabled={c.state !== "OPEN"} onClick={act(() => api.setCounterState(id, "BREAK", breakReason))}>Start break</Button>
                    <Button variant="secondary" disabled={c.state === "CLOSED" || c.state === "SWITCHING"} onClick={act(() => api.setCounterState(id, "CLOSED"))}>Close</Button>
                  </div>
                  <label className="block text-[10px] text-field">
                    Break reason
                    <select className={`${SELECT} mt-1`} value={breakReason} onChange={(e) => setBreakReason(e.target.value)}>
                      {BREAK_REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  {c.state === "BREAK" && c.stateReason && <p className="text-[11px] text-mute">On break: {c.stateReason}</p>}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
