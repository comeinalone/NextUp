import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useLive } from "../../lib/useLive";
import Button from "../../components/Button";
import TokenCard from "../../components/TokenCard";
import EtaRange from "../../components/EtaRange";

export default function TokenPage() {
  const code = useParams().code.toUpperCase();
  const { data: token, setData, error } = useLive(`token:${code}`, "token:update", {
    fetcher: () => api.getToken(code),
    match: (p) => p.code === code,
  });
  const state = token?.state;

  // Buzz the phone and change the tab title when it's the customer's turn.
  useEffect(() => {
    if (state === "CALLED") navigator.vibrate?.([300, 150, 300]);
  }, [state]);
  useEffect(() => {
    if (!state) return;
    const before = document.title;
    document.title = state === "CALLED" ? `Your turn! ${code}` : `${code} · NextUp`;
    return () => {
      document.title = before;
    };
  }, [state, code]);

  if (error && !token) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-[15px] font-medium">
          {error.code === "TOKEN_NOT_FOUND" ? `We can't find token ${code}.` : error.message}
        </p>
        <Link to="/" className="mt-4 inline-block underline">Get a new token</Link>
      </main>
    );
  }
  if (!token) return <p className="p-6 text-mute">Loading your token…</p>;

  const docs = token.customerChecklist ?? [];
  const finished = ["COMPLETED", "CANCELLED", "SKIPPED"].includes(state);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <TokenCard token={token}>
        {state === "WAITING" && (
          <div className="mt-4 space-y-4">
            {token.notice && <p className="rounded-[6px] bg-notice p-3 text-[13px]">{token.notice}</p>}

            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[12px] text-mute">Your position</dt>
                <dd className="text-3xl font-semibold tabular-nums">{token.position}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-mute">People ahead</dt>
                <dd className="text-3xl font-semibold tabular-nums">{token.peopleAhead}</dd>
              </div>
            </dl>

            <div>
              <p className="text-[12px] text-mute">Estimated wait</p>
              <EtaRange
                etaMin={token.etaMin}
                etaRange={token.etaRange}
                unavailable={token.unavailable}
                className="text-3xl font-semibold"
              />
            </div>

            {token.nowServing && (
              <p className="text-[13px] text-mute">
                Now serving <span className="font-mono font-medium text-ink">{token.nowServing}</span>
              </p>
            )}
            {token.position <= 2 && (
              <p className="text-[13px] font-medium text-busy">Almost your turn. Stay close to the counters.</p>
            )}
          </div>
        )}

        {state === "CALLED" && (
          <p className="mt-4 text-3xl font-semibold">Go to {token.counter?.name ?? "your counter"}</p>
        )}
        {state === "SERVING" && (
          <p className="mt-4 text-[15px]">Being served at {token.counter?.name ?? "the counter"}.</p>
        )}
        {state === "HELD" && (
          <p className="mt-4 text-[15px]">Your token is on hold. Please speak to the counter staff.</p>
        )}
        {state === "SKIPPED" && (
          <p className="mt-4 text-[15px]">You weren't at the counter when called. Please see the staff desk or get a new token.</p>
        )}
        {state === "COMPLETED" && <p className="mt-4 text-[15px]">All done. Thank you!</p>}
        {state === "CANCELLED" && <p className="mt-4 text-[15px]">This token was cancelled.</p>}
      </TokenCard>

      {!finished && docs.length > 0 && (
        <section className="rounded-[10px] border border-line bg-surface p-4">
          <h2 className="text-[13px] font-medium">Bring with you</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
            {docs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      {state === "WAITING" && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => setData(await api.cancelToken(code))}
        >
          Leave the queue
        </Button>
      )}
      {finished && (
        <Link to="/" className="block text-center underline">Get another token</Link>
      )}
    </main>
  );
}