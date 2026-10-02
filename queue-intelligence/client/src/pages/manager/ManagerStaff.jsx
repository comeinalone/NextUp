import { managerApi } from '../../lib/managerApi'
import { Users, UserCheck, Coffee } from 'lucide-react'
import { Metric, PageHeading, ResourceState, StatusBadge } from './components'
import { serviceClass, minutes } from './format'
import { useManagerResource } from './useManagerResource'

export default function ManagerStaff() {
  const { data: overview, error, loading, reload } = useManagerResource(managerApi.getStaffOverview, managerApi.subscribeOverview)
  if (loading && !overview) return <ResourceState loading title="Loading staff" message="Getting the current team snapshot." />
  if (error || !overview) return <ResourceState title="Staff unavailable" message="The staff overview could not be loaded." action={reload} />

  const { staff, services, counters } = overview
  return <>
    <PageHeading eyebrow="THE PEOPLE BEHIND THE QUEUE" title="Staff directory" description="Service skills, counter assignments, and today's workload." />
    <section className="metrics" aria-label="Staff summary">
      <Metric icon={Users} label="Team members" value={staff.length} detail="In the live manager overview" />
      <Metric icon={UserCheck} label="Available now" value={staff.filter((person) => person.state === 'AVAILABLE').length} detail="Ready to serve customers" />
      <Metric icon={Coffee} label="On break" value={staff.filter((person) => person.state === 'BREAK').length} detail="Temporarily away from a counter" />
    </section>
    <section className="panel" aria-labelledby="staff-title"><div className="section-heading"><div><h2 id="staff-title">Your team</h2><p>Skills indicate the services each person can handle.</p></div><span className="count-label">{staff.length} people</span></div>
      <div className="table-scroll"><table className="staff-table"><thead><tr><th scope="col">Staff member</th><th scope="col">Service skills</th><th scope="col">State</th><th scope="col">Counter</th><th scope="col">Served today</th><th scope="col">Avg. handling</th></tr></thead><tbody>
        {staff.map((person) => <tr key={person.id}><th scope="row"><div className="person"><span className="avatar">{person.name.slice(0, 2).toUpperCase()}</span><div>{person.name}<small>Staff #{String(person.id).padStart(2, '0')}</small></div></div></th><td><div className="skill-list">{person.skills.map((id) => <span key={id} className={`skill ${serviceClass(id)}`}>{services.find((service) => service.serviceId === id)?.name ?? `Service ${id}`}</span>)}</div></td><td><StatusBadge state={person.state} /></td><td>{counters.find((counter) => counter.counterId === person.counterId)?.name ?? 'Unassigned'}</td><td className="numeric">{person.servedToday}</td><td className="numeric">{minutes(person.avgHandlingMin)}</td></tr>)}
      </tbody></table></div><div className="table-note">Staff states and handling times update from the manager overview.</div>
    </section>
  </>
}
