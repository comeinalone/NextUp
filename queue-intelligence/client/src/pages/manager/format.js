export const serviceClass = (id) => `service-${id}`
export const minutes = (value) => Number.isFinite(value)
  ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} min`
  : '—'

export function timeLabel(value, withDate = false) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    ...(withDate ? { month: 'short', day: 'numeric' } : {}),
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function timeAgo(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  if (!Number.isFinite(elapsed)) return '—'
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} hr ago`
}
