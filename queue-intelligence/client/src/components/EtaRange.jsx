// Works with token:update ({ etaMin, etaRange, unavailable }) and service:update ({ etaMin }).
export default function EtaRange({ etaMin, etaRange, unavailable, className = "" }) {
  let text;
  if (unavailable) text = "No counter open right now";
  else if (Array.isArray(etaRange)) text = etaRange[0] === etaRange[1] ? `${etaRange[0]} min` : `${etaRange[0]}–${etaRange[1]} min`;
  else if (typeof etaMin === "number") text = etaMin < 1 ? "Under 1 min" : `About ${Math.round(etaMin)} min`;
  else text = "Estimating…";
  return <span className={`tabular-nums ${className}`}>{text}</span>;
}
