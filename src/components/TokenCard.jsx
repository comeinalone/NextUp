import { serviceStyle, TOKEN_STATE_LABEL } from "../lib/constants";

// Takes a token:update payload. Code first, large and monospaced, readable from across a room.
export default function TokenCard({ token, children, className = "" }) {
  if (!token) return null;
  const s = serviceStyle(token.code);
  return (
    <div className={`rounded-[10px] border border-line bg-surface p-5 ${className}`}>
      <span className={`inline-block rounded-[4px] px-[7px] py-1 text-[10px] font-medium ${s.soft} ${s.text}`}>{token.serviceName}</span>
      <p className="mt-3 font-mono text-5xl font-semibold tracking-[1px] tabular-nums">
        {token.code}
        {token.isPriority && <span className="ml-2 align-top text-2xl" title="Priority">★</span>}
      </p>
      <p className="mt-2 text-[13px] font-medium">{TOKEN_STATE_LABEL[token.state] ?? token.state}</p>
      {children}
    </div>
  );
}
