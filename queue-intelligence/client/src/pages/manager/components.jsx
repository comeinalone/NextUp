export function StatusBadge({ state }) {
  return <span className={`status-badge status-${state.toLowerCase()}`}><span />{state.charAt(0) + state.slice(1).toLowerCase()}</span>
}
export function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children}</div>
}
export function Metric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><div className="metric-label">{label}<Icon size={18} /></div><div className="metric-value">{value}</div><p>{detail}</p></div>
}
