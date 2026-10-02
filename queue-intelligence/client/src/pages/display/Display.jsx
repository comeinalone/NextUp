import { useEffect, useRef, useState } from "react";
import { socket, joinRoom, leaveRoom } from "../../lib/socket";
import { useServices } from "../../lib/useLive";
import { serviceStyle } from "../../lib/constants";
import Button from "../../components/Button";
import EtaRange from "../../components/EtaRange";
import HealthBadge from "../../components/HealthBadge";

// "A-042" at "Counter 3" is read out as "Token A 42, Counter 3".
function spoken(code, counterName) {
  const [letter, num] = code.split("-");
  return `Token ${letter} ${Number(num)}, ${counterName}`;
}

export default function Display() {
  const { services } = useServices();
  const [recent, setRecent] = useState([]);
  const [flash, setFlash] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);

  useEffect(() => {
    const onCalled = (p) => {
      setRecent((cur) => [p, ...cur.filter((x) => x.code !== p.code)].slice(0, 6));
      setFlash(p.code);
      setTimeout(() => setFlash((f) => (f === p.code ? null : f)), 6000);
      if (soundRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken(p.code, p.counterName)));
      }
    };
    socket.on("display:called", onCalled);
    joinRoom("display");
    return () => {
      socket.off("display:called", onCalled);
      leaveRoom("display");
    };
  }, []);

  // Browsers only allow speech after a click, so the TV needs one tap.
  function enableSound() {
    soundRef.current = true;
    setSoundOn(true);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Sound is on"));
    }
  }

  const serving = services
    .flatMap((s) => (s.nowServing ?? []).map((n) => ({ ...n, serviceName: s.name })))
    .sort((a, b) => a.counterId - b.counterId);

  return (
    <main className="min-h-screen bg-surface p-8 text-ink">
      <header className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold">Now serving</h1>
        {!soundOn && (
          <Button variant="secondary" onClick={enableSound}>
            Enable sound
          </Button>
        )}
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {serving.length === 0 && (
          <p className="col-span-full text-2xl text-mute">No one is being served right now.</p>
        )}
        {serving.map((s) => (
          <div
            key={s.code}
            className={`rounded-[10px] border border-line p-5 ${flash === s.code ? "animate-pulse bg-notice" : "bg-inset"}`}
          >
            <p className="font-mono text-6xl font-semibold tabular-nums">{s.code}</p>
            <p className="mt-2 text-2xl font-medium">{s.counterName}</p>
            <p className="text-mute">{s.serviceName}</p>
          </div>
        ))}
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-medium text-mute">Recently called</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {recent.map((r) => (
              <span key={r.code} className="rounded-[6px] bg-inset px-3 py-2 font-mono text-xl tabular-nums">
                {r.code} · {r.counterName}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {services.map((s) => {
          const st = serviceStyle(s.prefix);
          return (
            <div key={s.serviceId} className="rounded-[10px] border border-line p-5">
              <div className="flex items-center justify-between">
                <p className={`text-2xl font-semibold ${st.text}`}>{s.name}</p>
                <HealthBadge health={s.health} />
              </div>
              <p className="mt-3 text-xl">
                {s.waiting} waiting · <EtaRange etaMin={s.etaMin} unavailable={s.openCounters === 0 && s.waiting > 0} />
              </p>
              {s.notice && <p className="mt-2 text-[13px] text-busy">{s.notice}</p>}
            </div>
          );
        })}
      </section>
    </main>
  );
}