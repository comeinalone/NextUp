const TONES = {
  normal: "bg-normal-soft text-normal",
  busy: "bg-busy-soft text-busy",
  critical: "bg-critical-soft text-critical",
  serving: "bg-serving-soft text-serving",
  idle: "bg-idle-soft text-idle",
};
const DOTS = { normal: "bg-normal", busy: "bg-busy", critical: "bg-critical", serving: "bg-serving", idle: "bg-idle" };

// Dot + label. Open/available = normal, break/switching/hold = busy, serving/called = serving, closed = idle.
export default function StatusBadge({ tone = "idle", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 py-1 text-[10px] font-medium ${TONES[tone]} ${className}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${DOTS[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}
