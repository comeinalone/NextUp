export function StatusBadge({ state }) {
  return <span className={`status-badge status-${state.toLowerCase()}`}><span />{state.charAt(0) + state.slice(1).toLowerCase()}</span>
}
export function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children}</div>
}
export function Metric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><div className="metric-label">{label}<Icon size={18} /></div><div className="metric-value">{value}</div><p>{detail}</p></div>
}

export function ResourceState({ title, message, action, loading = false }) {
  return <div className={`resource-state${loading ? ' is-loading' : ''}`} role={loading ? 'status' : 'alert'}>
    <span className="resource-state-mark" aria-hidden="true" />
    <div><strong>{title}</strong><p>{message}</p></div>
    {action && <button className="secondary-button compact" type="button" onClick={action}>Try again</button>}
  </div>
}

export function RefreshNotice({ data, error, reload, loading }) {
  if (!error || data === null) return null
  return <div className="refresh-notice" role="status"><span>Could not refresh. Showing the last available data.</span><button className="text-button" type="button" onClick={reload} disabled={loading}>{loading ? 'Retrying…' : 'Retry'}</button></div>
}
