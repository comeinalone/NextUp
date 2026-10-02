import { HEALTH } from "../lib/constants";

// Dot + label, never color alone.
export default function HealthBadge({ health = "NORMAL", className = "" }) {
  const h = HEALTH[health] ?? HEALTH.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 py-1 text-[10px] font-medium ${h.cls} ${className}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${h.dot}`} aria-hidden="true" />
      {h.label}
    </span>
  );
}
