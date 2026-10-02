import { useState } from 'react'
import { Users, Monitor, UserCheck, Info, Layers } from 'lucide-react'
import { assignmentErrorMessage, managerApi } from '../../lib/managerApi'
import { Metric, PageHeading, ResourceState, StatusBadge } from './components'
import { serviceClass, minutes } from './format'
import RecommendationCard from './RecommendationCard'
import SimulationControls from './SimulationControls'
import StaffAssistance from './StaffAssistance'
import { useManagerResource } from './useManagerResource'

function CounterCard({ counter, services, staff, onAssigned }) {
  const [selectedId, setSelectedId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState(null)
  const service = services.find((item) => item.serviceId === counter.serviceId)
  const member = staff.find((person) => person.id === counter.staff?.id)
  const destinations = services.filter((item) => item.serviceId !== counter.serviceId && member?.skills.includes(item.serviceId))
  const pendingService = services.find((item) => item.serviceId === counter.pendingServiceId)
  const switching = counter.state === 'SWITCHING' || counter.pendingServiceId !== null

  const assign = async (event) => {
    event.preventDefault()
    if (!selectedId || assigning || switching) return
    setAssigning(true)
    setError(null)
    try {
      const updatedOverview = await managerApi.assignCounter({ counterId: counter.counterId, serviceId: Number(selectedId) })
      const updatedCounter = updatedOverview.counters.find((item) => item.counterId === counter.counterId)
      const destination = services.find((item) => item.serviceId === Number(selectedId))
      onAssigned(updatedOverview, updatedCounter?.state === 'SWITCHING'
        ? `${counter.name} will switch to ${destination?.name} after the current customer.`
        : `${counter.name} is now assigned to ${destination?.name}.`)
      setSelectedId('')
    } catch (assignmentError) {
      setError(assignmentErrorMessage(assignmentError))
    } finally {
      setAssigning(false)
    }
  }

  return (
    <article className="counter-card">
      <div className="counter-heading"><span className="counter-icon"><Monitor size={19} /></span><h3>{counter.name}</h3><StatusBadge state={counter.state} /></div>
      <div className={`counter-service ${serviceClass(service.serviceId)}`}><span className="service-dot" />{service.name}</div>
      <div className="counter-detail"><span>Assigned staff</span><strong>{counter.staff?.name ?? 'Unassigned'}</strong></div>
      <div className="current-token"><span>Current token</span><strong>{counter.currentCode ?? '—'}</strong><small>{counter.currentCode ? 'In service' : counter.state === 'OPEN' ? 'Ready for next customer' : 'Not serving'}</small></div>
      {switching && <p className="pending-note"><strong>Switch queued:</strong> {pendingService?.name ?? 'another service'} after the current customer is completed.</p>}
      <form className="assignment-form" onSubmit={assign}>
        <label htmlFor={`assign-${counter.counterId}`}>Reassign service</label>
        <div className="assignment-control">
          <select id={`assign-${counter.counterId}`} value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(null) }} disabled={assigning || switching || destinations.length === 0} aria-describedby={`assignment-${counter.counterId}`}>
            <option value="">{switching ? 'Switch already in progress' : destinations.length ? 'Choose destination…' : 'No other skilled services'}</option>
            {destinations.map((item) => <option key={item.serviceId} value={item.serviceId}>{item.name}</option>)}
          </select>
          <button className="primary-button compact" type="submit" disabled={!selectedId || assigning || switching}>{assigning ? 'Assigning…' : 'Assign'}</button>
        </div>
        <p className={`assignment-note${error ? ' error' : ''}`} id={`assignment-${counter.counterId}`} aria-live="polite">
          {error ?? (switching ? 'The current service remains active until the switch completes.' : member ? 'Destinations reflect this staff member’s skills.' : 'Assign staff before changing this service.')}
        </p>
      </form>
    </article>
  )
}

export default function ManagerOverview() {
  const { data: overview, error, loading, reload } = useManagerResource(managerApi.getOverview, managerApi.subscribeOverview)
  const [assignmentNotice, setAssignmentNotice] = useState(null)
  if (loading && !overview) return <ResourceState loading title="Loading control room" message="Getting the latest manager snapshot." />
  if (error || !overview) return <ResourceState title="Control room unavailable" message="The manager overview could not be loaded." action={reload} />

  const { services, counters, staff } = overview
  const waiting = services.reduce((sum, service) => sum + service.waiting, 0)
  const activeCounters = counters.filter((counter) => counter.state === 'OPEN' || counter.state === 'SWITCHING')
  const automated = activeCounters.filter((counter) => overview.sim.bots?.includes(counter.counterId)).length
  return (
    <>
      <PageHeading eyebrow="YOUR OPERATIONS, TOGETHER" title="Service overview" description="A clear view of your queues, counters, and people."><span className="snapshot-chip"><span />Live snapshot</span></PageHeading>
      <section className="metrics" aria-label="Operations summary">
        <Metric icon={Users} label="Customers waiting" value={waiting} detail={`Across ${services.length} services`} />
        <Metric icon={Monitor} label="Active counters" value={<>{activeCounters.length}<small> / {counters.length}</small></>} detail={`${automated} automated · ${activeCounters.length - automated} manual`} />
        <Metric icon={UserCheck} label="Staff available" value={staff.filter((person) => person.state === 'AVAILABLE').length} detail={`${staff.filter((person) => person.state === 'SERVING').length} currently serving`} />
      </section>
      <div className="intelligence-grid">
        <RecommendationCard />
        <SimulationControls />
      </div>
      <StaffAssistance counters={counters} openAssists={overview.openAssists} />
      <section className="panel service-panel" aria-labelledby="services-title">
        <div className="section-heading"><div><h2 id="services-title">Service queues</h2><p>Current load and estimated wait by service.</p></div><span className="count-label">{services.length} services</span></div>
        <div className="table-scroll"><table className="service-table"><thead><tr><th scope="col">Service</th><th scope="col">Waiting</th><th scope="col">Open counters</th><th scope="col">Estimated wait</th><th scope="col">Health</th></tr></thead><tbody>
          {services.map((service) => <tr key={service.serviceId}><th scope="row"><div className="service-name"><span className={`service-symbol ${serviceClass(service.serviceId)}`}>{service.prefix}</span><div>{service.name}<small>{service.notice ?? 'Service queue'}</small></div></div></th><td className="numeric">{service.waiting}<span className="cell-unit">people</span></td><td className="numeric">{service.openCounters}</td><td className="numeric">{service.openCounters ? minutes(service.etaMin) : <span className="unavailable">Unavailable</span>}</td><td><StatusBadge state={service.health} /></td></tr>)}
        </tbody></table></div>
        <div className="table-note"><Info size={14} />Live estimates refresh with the manager overview. A service needs an open counter to provide a wait estimate.</div>
      </section>
      <section aria-labelledby="counters-title"><div className="section-heading counter-section-heading"><div><h2 id="counters-title">Counter floor</h2><p>Staff assignments and the customer at each counter.</p></div><span className="count-label"><Layers size={14} />{counters.length} counters</span></div>
        {assignmentNotice && <div className="assignment-banner" role="status"><Info size={15} />{assignmentNotice}<button type="button" onClick={() => setAssignmentNotice(null)} aria-label="Dismiss assignment message">Dismiss</button></div>}
        <div className="counter-grid">{counters.map((counter) => <CounterCard key={`${counter.counterId}-${counter.serviceId}-${counter.pendingServiceId ?? 'none'}`} counter={counter} services={services} staff={staff} onAssigned={(updatedOverview, message) => { setAssignmentNotice(message) }} />)}</div>
      </section>
    </>
  )
}
