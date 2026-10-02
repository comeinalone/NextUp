import { BarChart3, CheckCircle2, Clock3, Hourglass, UserMinus, Users } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { managerApi } from '../../lib/managerApi'
import { Metric, PageHeading, ResourceState } from './components'
import { minutes } from './format'
import { useManagerResource } from './useManagerResource'

const loadAnalytics = async () => {
  const [today, timeline] = await Promise.all([
    managerApi.getAnalyticsToday(),
    managerApi.getAnalyticsTimeline(),
  ])
  return { today, timeline }
}

function QueueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><span>{label}</span><strong>{payload[0].value} waiting</strong></div>
}

export default function ManagerAnalytics() {
  const { data, error, loading, reload } = useManagerResource(loadAnalytics)
  if (loading && !data) return <ResourceState loading title="Loading analytics" message="Preparing today’s queue metrics and timeline." />
  if (error || !data) return <ResourceState title="Analytics unavailable" message="Today’s analytics could not be loaded." action={reload} />

  const { today, timeline } = data
  const peak = timeline.reduce((highest, point) => point.waiting > highest.waiting ? point : highest, timeline[0] ?? { time: '—', waiting: 0 })
  const chartDescription = timeline.length
    ? `Line chart of customers waiting from ${timeline[0].time} to ${timeline[timeline.length - 1].time}, peaking at ${peak.waiting} at ${peak.time}`
    : 'Queue load timeline with no data points'

  return (
    <>
      <PageHeading eyebrow="TODAY'S SERVICE PULSE" title="Queue analytics" description="A focused view of throughput, wait times, and queue load.">
        <span className="snapshot-chip"><span />Today · sample data</span>
      </PageHeading>

      <section className="analytics-metrics" aria-label="Today's queue metrics">
        <Metric icon={CheckCircle2} label="Completed" value={today.completed} detail={`${today.issued} tokens issued`} />
        <Metric icon={Users} label="Waiting now" value={today.waiting} detail="Across all services" />
        <Metric icon={Clock3} label="Avg. service" value={minutes(today.avgServiceMin)} detail="Per completed token" />
        <Metric icon={Hourglass} label="Avg. wait" value={minutes(today.avgWaitMin)} detail="Before being called" />
        <Metric icon={UserMinus} label="No-shows" value={today.noShows} detail="Called but not served" />
      </section>

      <section className="panel chart-panel" aria-labelledby="queue-load-title">
        <div className="section-heading">
          <div><h2 id="queue-load-title">Queue load over time</h2><p>Customers waiting across all services during today’s sample period.</p></div>
          <span className="count-label"><BarChart3 size={14} />30-minute intervals</span>
        </div>
        <div className="chart-wrap" role="img" aria-label={chartDescription}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 12, right: 18, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#e8ede9" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<QueueTooltip />} cursor={{ stroke: '#9bb6aa', strokeDasharray: '3 4' }} />
              <Line type="monotone" dataKey="waiting" stroke="#187652" strokeWidth={2.5} dot={{ r: 3.5, fill: '#ffffff', stroke: '#187652', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#187652', stroke: '#ffffff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="table-note">Timeline values follow the <code>GET /api/analytics/timeline</code> response shape.</div>
      </section>
    </>
  )
}
