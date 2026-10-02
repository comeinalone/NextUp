// Static class strings only, so Tailwind doesn't purge them. Service colors identify the domain, never the state.
export const SERVICE_STYLE = {
  A: { text: "text-admissions", soft: "bg-admissions-soft" },
  F: { text: "text-fees", soft: "bg-fees-soft" },
  C: { text: "text-certs", soft: "bg-certs-soft" },
};
export const serviceStyle = (code = "") =>
  SERVICE_STYLE[code[0]] ?? { text: "text-idle", soft: "bg-idle-soft" };

export const HEALTH = {
  NORMAL: { label: "Normal", cls: "bg-normal-soft text-normal", dot: "bg-normal" },
  BUSY: { label: "Busy", cls: "bg-busy-soft text-busy", dot: "bg-busy" },
  CRITICAL: { label: "Critical", cls: "bg-critical-soft text-critical", dot: "bg-critical" },
};

export const TOKEN_STATE_LABEL = {
  WAITING: "Waiting",
  CALLED: "Your turn: go to your counter",
  SERVING: "Being served",
  HELD: "On hold",
  SKIPPED: "Missed your turn",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};
