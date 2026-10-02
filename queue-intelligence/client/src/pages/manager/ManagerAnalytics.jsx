import { Activity, BarChart3, CheckCircle2, Clock3, HandHelping, Hourglass, UserMinus, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { managerApi } from '../../lib/managerApi'
import { Metric, PageHeading, RefreshNotice, ResourceState } from './components'
import { minutes, timeLabel } from './format'
import { useManagerResource } from './useManagerResource'

function QueueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><span>{timeLabel(label, true)}</span><strong>{payload[0].value} waiting</strong></div>
}

export default function ManagerAnalytics() {
  // Independent resources keep a temporary audit/timeline failure from hiding KPIs.
  const todayResource = useManagerResource(managerApi.getAnalyticsToday, undefined, true)
  const timelineResource = useManagerResource(managerApi.getAnalyticsTimeline, undefined, true)
  const eventsResource = useManagerResource(managerApi.getEvents, undefined, true)
  const today = todayResource.data
  const timeline = timelineResource.data
  const events = eventsResource.data

  return (
    <>
      <PageHeading eyebrow="TODAY'S SERVICE PULSE" title="Queue analytics" description="A focused view of throughput, wait times, and queue load.">
        <span className="snapshot-chip"><span />Live analytics</span>
      </PageHeading>
      <RefreshNotice {...todayResource} />
      {!today ? <ResourceState loading={todayResource.loading} title={todayResource.loading ? 'Loading analytics' : 'Analytics unavailable'} message="Getting today’s queue metrics." action={todayResource.error ? todayResource.reload : undefined} /> : (
        <section className="analytics-metrics" aria-label="Today's queue metrics">
          <Metric icon={CheckCircle2} label="Completed" value={today.completed} detail={`${today.issued} tokens issued`} />
          <Metric icon={Users} label="Waiting now" value={today.waiting} detail="Across all services" />
          <Metric icon={Clock3} label="Avg. service" value={minutes(today.avgServiceMin)} detail="Start to completion" />
          <Metric icon={Hourglass} label="Avg. wait" value={minutes(today.avgWaitMin)} detail="Created to first call" />
          <Metric icon={UserMinus} label="No-shows" value={today.noShows} detail="Tokens skipped today" />
        </section>
      )}
      <section className="panel chart-panel" aria-labelledby="queue-load-title">
        <div className="section-heading">
          <div><h2 id="queue-load-title">Waiting customers over time</h2><p>Real queue load over the last two hours, including the current queue.</p></div>
          <span className="count-label"><BarChart3 size={14} />5-minute intervals</span>
        </div>
        <RefreshNotice {...timelineResource} />
        {!timeline ? <ResourceState loading={timelineResource.loading} title={timelineResource.loading ? 'Loading timeline' : 'Timeline unavailable'} message="Getting recorded queue load." action={timelineResource.error ? timelineResource.reload : undefined} /> : !timeline.length ? <p className="empty-state">No queue history yet. Recorded waiting counts will appear here.</p> : (
          <div className="chart-wrap" role="img" aria-label={`Waiting customers from ${timeLabel(timeline[0].time)} to ${timeLabel(timeline.at(-1).time)}. Latest: ${timeline.at(-1).waiting} waiting.`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={timeline} margin={{ top: 12, right: 18, bottom: 4, left: -16 }}>
                <CartesianGrid stroke="#e8ede9" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="time" tickFormatter={(value) => timeLabel(value)} minTickGap={35} axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<QueueTooltip />} cursor={{ stroke: '#9bb6aa', strokeDasharray: '3 4' }} />
                <Line type="monotone" dataKey="waiting" isAnimationActive={false} stroke="#187652" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#187652', stroke: '#ffffff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="table-note">Refreshes with queue activity. All times are shown in your local time zone.</div>
      </section>
      <section className="panel activity-panel" aria-labelledby="activity-title">
        <div className="section-heading"><div><h2 id="activity-title">Activity log</h2><p>Latest queue, counter, and staff assistance activity.</p></div><span className="count-label"><Activity size={14} />Latest 50</span></div>
        <RefreshNotice {...eventsResource} />
        {!events ? <ResourceState loading={eventsResource.loading} title={eventsResource.loading ? 'Loading activity' : 'Activity unavailable'} message="Getting recent operations." action={eventsResource.error ? eventsResource.reload : undefined} /> : !events.length ? <p className="empty-state">No recent activity. New queue and counter events will appear here.</p> : (
          <ol className="activity-list">
            {events.map((event, index) => {
              const Icon = event.type.startsWith('ASSIST_') ? HandHelping : Activity
              return <li key={`${event.at}-${event.type}-${index}`}><span className="activity-icon" title={event.type.replaceAll('_', ' ')}><Icon size={15} /></span><p>{event.text}</p><time dateTime={event.at} title={event.at}>{timeLabel(event.at, true)}</time></li>
            })}
          </ol>
        )}
      </section>
    </>
  )
}
