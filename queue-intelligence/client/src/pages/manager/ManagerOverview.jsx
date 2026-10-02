import { useState } from 'react'
import { Users, Monitor, UserCheck, ArrowRight, Info, Layers } from 'lucide-react'
import { managerOverview } from '../../lib/mocks'
import { Metric, PageHeading, StatusBadge } from './components'
import { serviceClass, minutes } from './format'
import RecommendationCard from './RecommendationCard'
import SimulationControls from './SimulationControls'

function CounterCard({ counter, services, staff }) {
  const [selectedId, setSelectedId] = useState(counter.pendingServiceId ?? counter.serviceId)
  const selected = services.find((service) => service.serviceId === selectedId)
  const service = services.find((item) => item.serviceId === counter.serviceId)
  const member = staff.find((person) => person.id === counter.staff?.id)
  const changed = selectedId !== counter.serviceId
  return (
    <article className="counter-card">
      <div className="counter-heading"><span className="counter-icon"><Monitor size={19} /></span><h3>{counter.name}</h3><StatusBadge state={counter.state} /></div>
      <div className={`counter-service ${serviceClass(service.serviceId)}`}><span className="service-dot" />{service.name}</div>
      <div className="counter-detail"><span>Assigned staff</span><strong>{counter.staff?.name ?? 'Unassigned'}</strong></div>
      <div className="current-token"><span>Current token</span><strong>{counter.currentCode ?? '—'}</strong><small>{counter.currentCode ? 'In service' : counter.state === 'OPEN' ? 'Ready for next customer' : 'Not serving'}</small></div>
      {counter.pendingServiceId && <p className="pending-note">Switching to {services.find((item) => item.serviceId === counter.pendingServiceId)?.name} after the current token.</p>}
      <label htmlFor={`assign-${counter.counterId}`}>Reassign service</label>
      <select id={`assign-${counter.counterId}`} value={selectedId} onChange={(event) => setSelectedId(Number(event.target.value))} aria-describedby={`preview-${counter.counterId}`}>
        {services.map((item) => <option key={item.serviceId} value={item.serviceId} disabled={member && !member.skills.includes(item.serviceId)}>{item.name}{member && !member.skills.includes(item.serviceId) ? ' · skill required' : ''}</option>)}
      </select>
      <p className={`assignment-note ${changed ? 'selected' : ''}`} id={`preview-${counter.counterId}`} aria-live="polite">{changed ? <>Preview: {selected.name}. No assignment saved. <button type="button" onClick={() => setSelectedId(counter.serviceId)}>Clear</button></> : 'Preview only · no changes are saved'}</p>
    </article>
  )
}

export default function ManagerOverview() {
  const { services, counters, staff } = managerOverview
  const waiting = services.reduce((sum, service) => sum + service.waiting, 0)
  const open = counters.filter((counter) => counter.state === 'OPEN').length
  return (
    <>
      <PageHeading eyebrow="YOUR OPERATIONS, TOGETHER" title="Service overview" description="A clear view of your queues, counters, and people."><span className="snapshot-chip"><span />Sample snapshot</span></PageHeading>
      <section className="metrics" aria-label="Operations summary">
        <Metric icon={Users} label="Customers waiting" value={waiting} detail={`Across ${services.length} services`} />
        <Metric icon={Monitor} label="Open counters" value={<>{open}<small> / {counters.length}</small></>} detail={`${counters.length - open} counter on break`} />
        <Metric icon={UserCheck} label="Staff available" value={staff.filter((person) => person.state === 'AVAILABLE').length} detail={`${staff.filter((person) => person.state === 'SERVING').length} currently serving`} />
      </section>
      <div className="intelligence-grid">
        <RecommendationCard />
        <SimulationControls />
      </div>
      <section className="panel service-panel" aria-labelledby="services-title">
        <div className="section-heading"><div><h2 id="services-title">Service queues</h2><p>Current load and estimated wait by service.</p></div><span className="count-label">{services.length} services</span></div>
        <div className="table-scroll"><table className="service-table"><thead><tr><th scope="col">Service</th><th scope="col">Waiting</th><th scope="col">Open counters</th><th scope="col">Estimated wait</th><th scope="col">Health</th></tr></thead><tbody>
          {services.map((service) => <tr key={service.serviceId}><th scope="row"><div className="service-name"><span className={`service-symbol ${serviceClass(service.serviceId)}`}>{service.prefix}</span><div>{service.name}<small>{service.notice ?? 'Service queue'}</small></div></div></th><td className="numeric">{service.waiting}<span className="cell-unit">people</span></td><td className="numeric">{service.openCounters}</td><td className="numeric">{service.openCounters ? minutes(service.etaMin) : <span className="unavailable">Unavailable</span>}</td><td><StatusBadge state={service.health} /></td></tr>)}
        </tbody></table></div>
        <div className="table-note"><Info size={14} />Estimates are sample values. A service needs an open counter to provide a wait estimate.</div>
      </section>
      <section aria-labelledby="counters-title"><div className="section-heading counter-section-heading"><div><h2 id="counters-title">Counter floor</h2><p>Staff assignments and the customer at each counter.</p></div><span className="count-label"><Layers size={14} />{counters.length} counters</span></div>
        <div className="counter-grid">{counters.map((counter) => <CounterCard key={counter.counterId} counter={counter} services={services} staff={staff} />)}</div>
      </section>
      <div className="mock-notice"><Info size={17} /><span><strong>A preview of your control room.</strong> Reassignment selections are local previews; counters and queue estimates stay unchanged.</span><ArrowRight size={18} /></div>
    </>
  )
}
