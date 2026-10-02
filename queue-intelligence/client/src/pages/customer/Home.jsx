import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Wallet, FileText, Users, Star, Info, CircleAlert, Megaphone } from "lucide-react";
import { api } from "../../lib/api";
import { useServices } from "../../lib/useLive";
import { serviceStyle } from "../../lib/constants";
import Button from "../../components/Button";
import Brand from "../../components/Brand";
import HealthBadge from "../../components/HealthBadge";

const ICONS = { A: GraduationCap, F: Wallet, C: FileText };
const GUTTER = "px-[14px] min-[430px]:px-5 lg:px-[38px]";

function ServiceSymbol({ prefix }) {
  const st = serviceStyle(prefix);
  const Icon = ICONS[prefix] ?? FileText;
  return (
    <span className={`flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-lg ${st.soft} ${st.text}`}>
      <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
    </span>
  );
}

export default function Home() {
  const { services, error } = useServices();
  const [priority, setPriority] = useState(false);
  const navigate = useNavigate();

  // Button handles the pending state and error toast, so only the happy path is needed here.
  async function joinQueue(serviceId) {
    const token = await api.createToken(serviceId, priority);
    navigate(`/t/${token.code}`);
  }

  const board = services
    .flatMap((s) => (s.nowServing ?? []).map((n) => ({ ...n, serviceName: s.name, prefix: s.prefix })))
    .slice(0, 6);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex h-[52px] max-w-[1500px] items-center justify-between lg:h-[70px] ${GUTTER}`}>
          <Brand />
          <span className="hidden items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-mute sm:inline-flex">
            <span className="h-[5px] w-[5px] rounded-full bg-normal" aria-hidden="true" />
            Live wait times
          </span>
        </div>
      </header>

      <main className={`mx-auto max-w-[1500px] py-[25px] lg:pb-6 lg:pt-9 ${GUTTER}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-eyebrow">Digital token</p>
        <h1 className="mt-2 text-[clamp(26px,3vw,33px)] font-semibold leading-[1.2] tracking-[-1.2px]">Get your token</h1>
        <p className="mt-[10px] text-[13px] text-mute">Choose a service to join the queue. Wait times update as the line moves.</p>

        <div className="mt-[27px] flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-lg bg-notice text-brand-icon">
              <Star className="h-[19px] w-[19px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-semibold">Priority token</p>
              <p className="text-[11px] text-mute">Priority tokens are called sooner.</p>
            </div>
          </div>
          <button
            type="button" role="switch" aria-checked={priority} aria-label="Priority token"
            onClick={() => setPriority(!priority)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${priority ? "bg-brand" : "bg-[#b8c4be]"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${priority ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {error && services.length === 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-critical/20 bg-critical-soft p-4 text-critical">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-[19px] w-[19px] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-semibold">Couldn't load services</p>
                <p className="text-xs">{error.message}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        )}

        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {!error && services.length === 0 &&
            [1, 2, 3].map((i) => (
              <li key={i} className="h-[310px] rounded-[10px] border border-line bg-inset" aria-hidden="true" />
            ))}

          {services.map((s) => {
            const waiting = s.waiting ?? 0;
            const unavailable = s.openCounters === 0;
            const eta = typeof s.etaMin === "number" ? (s.etaMin < 1 ? "<1" : Math.round(s.etaMin)) : null;
            const docs = s.requiredDocuments ?? [];
            return (
              <li key={s.serviceId} className="flex flex-col rounded-[10px] border border-line bg-surface p-[17px] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ServiceSymbol prefix={s.prefix} />
                    <h2 className="truncate text-[15px] font-semibold tracking-[-0.3px]">{s.name}</h2>
                  </div>
                  <HealthBadge health={s.health} />
                </div>

                <div className="mt-4 rounded-md border border-inset-line bg-inset p-[14px]">
                  <p className="text-[10px] text-field">Estimated wait</p>
                  {unavailable || eta === null ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-[#67776e]">Unavailable</p>
                      <p className="text-[11px] text-mute">{unavailable ? "No counter open right now" : "Estimating…"}</p>
                    </>
                  ) : (
                    <p className="text-[35px] font-semibold leading-[1.3] tracking-[-1px] tabular-nums">
                      {eta}
                      <span className="ml-1 text-[13px] font-medium tracking-normal text-mute">min</span>
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-mute">
                    <Users className="h-3.5 w-3.5 text-[#718178]" aria-hidden="true" />
                    {waiting} {waiting === 1 ? "person" : "people"} waiting
                  </p>
                </div>

                {s.notice && (
                  <p className="mt-3 flex gap-2 rounded-md bg-busy-soft px-3 py-2 text-[11px] text-busy">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {s.notice}
                  </p>
                )}

                <div className="mt-4 flex-1">
                  {docs.length > 0 && (
                    <>
                      <p className="text-[10px] text-field">Bring with you</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {docs.map((d) => (
                          <li key={d} className="rounded-[4px] bg-idle-soft px-[7px] py-1 text-[10px] text-idle">{d}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                <Button className="mt-5 w-full" onClick={() => joinQueue(s.serviceId)}>Join queue</Button>
              </li>
            );
          })}
        </ul>

        <section aria-labelledby="serving-title" className="mt-6 overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="flex items-center justify-between gap-4 px-[17px] py-[17px] sm:px-[23px] sm:py-[21px]">
            <div>
              <h2 id="serving-title" className="text-base font-semibold tracking-[-0.3px]">Now serving</h2>
              <p className="text-xs text-mute">Tokens being served at each counter.</p>
            </div>
            <Megaphone className="h-[19px] w-[19px] text-[#718178]" aria-hidden="true" />
          </div>
          <ul aria-live="polite" className="border-t border-line">
            {board.length === 0 ? (
              <li className="px-6 py-8 text-center">
                <Megaphone className="mx-auto h-5 w-5 text-[#718178]" aria-hidden="true" />
                <p className="mt-2 text-[13px] font-semibold">No tokens called yet</p>
                <p className="text-xs text-mute">Called tokens appear here as counters start serving.</p>
              </li>
            ) : (
              board.map((b) => (
                <li key={`${b.counterId}-${b.code}`} className="flex items-center justify-between gap-3 border-b border-rowline px-[17px] py-4 last:border-b-0 sm:px-[23px]">
                  <div className="flex items-center gap-3">
                    <ServiceSymbol prefix={b.prefix} />
                    <div>
                      <p className="font-mono text-[23px] font-semibold leading-none tracking-[1px]">{b.code}</p>
                      <p className="mt-1 text-[10px] text-mute">{b.counterName}, {b.serviceName}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-serving-soft px-2 py-1 text-[10px] font-medium text-serving">
                    <span className="h-[5px] w-[5px] rounded-full bg-serving" aria-hidden="true" />
                    Serving
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <p className="mt-5 flex items-center gap-[11px] rounded-[7px] border border-notice-line bg-notice px-[17px] py-[14px] text-[11px] text-notice-text">
          <Info className="h-4 w-4 shrink-0 text-[#718178]" aria-hidden="true" />
          <span><strong className="font-semibold text-notice-strong">You'll get a token code.</strong> Open it any time to see your place in line.</span>
        </p>
      </main>
    </div>
  );
}
