// Works with token:update ({ etaMin, etaRange, unavailable }) and service:update ({ etaMin }).
export default function EtaRange({ etaMin, etaRange, unavailable, className = "" }) {
  let text;
  if (unavailable) text = "No counter open right now";
  else if (Array.isArray(etaRange)) {
    const [lo, hi] = etaRange;
    if (hi < 1) text = "Under 1 min";
    else if (lo === 0) text = `Under ${hi} min`;
    else text = lo === hi ? `${lo} min` : `${lo}–${hi} min`;
  } else if (typeof etaMin === "number") text = etaMin < 1 ? "Under 1 min" : `About ${Math.round(etaMin)} min`;
  else text = "Estimating…";
  return <span className={`tabular-nums ${className}`}>{text}</span>;
}