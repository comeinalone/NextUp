import { useState } from 'react'
import { Bot, Play, RotateCcw, Square, Waves } from 'lucide-react'
import { managerApi } from '../../lib/managerApi'
import { ResourceState, StatusBadge } from './components'
import { useManagerResource } from './useManagerResource'

function SimulationPanel({ overview, feedback, setFeedback }) {
  const { counters, services, sim } = overview
  const [speed, setSpeed] = useState(sim.speed)
  const [selectedBots, setSelectedBots] = useState(sim.bots ?? [])
  const [arrivalsPerMin, setArrivalsPerMin] = useState(sim.arrivalsPerMin ?? 0)
  const [serviceId, setServiceId] = useState(services[0]?.serviceId ?? '')
  const [floodCount, setFloodCount] = useState(30)
  const [pendingAction, setPendingAction] = useState(null)

  const runAction = async (name, operation, successMessage) => {
    setPendingAction(name)
    setFeedback({ message: '', error: false })
    try {
      await operation()
      setFeedback({ message: successMessage, error: false })
      return true
    } catch (error) {
      setFeedback({ message: error?.message ?? 'The simulation action could not be completed.', error: true })
      return false
    } finally {
      setPendingAction(null)
    }
  }

  const toggleBot = async (counterId) => {
    const counterIds = selectedBots.includes(counterId)
      ? selectedBots.filter((id) => id !== counterId)
      : [...selectedBots, counterId]
    setSelectedBots(counterIds)
    const updated = await runAction(
      'bots',
      () => managerApi.configureBots({ counterIds }),
      counterIds.length ? `${counterIds.length} bot counter${counterIds.length === 1 ? '' : 's'} configured.` : 'Bot counters disabled.',
    )
    if (!updated) setSelectedBots(sim.bots ?? [])
  }

  const selectedService = services.find((service) => service.serviceId === Number(serviceId))
  const configuredBotNames = counters.filter((counter) => (sim.bots ?? []).includes(counter.counterId)).map((counter) => counter.name)

  return (
    <section className="panel simulation-panel" aria-labelledby="simulation-title">
      <div className="section-heading">
        <div><h2 id="simulation-title">Demo simulation</h2><p>Configure automation, then start the live simulator.</p></div>
        <StatusBadge state={sim.running ? 'RUNNING' : 'STOPPED'} />
      </div>

      <div className="simulation-summary" aria-label="Current simulation configuration">
        <span><Bot size={13} />{configuredBotNames.length ? configuredBotNames.join(', ') : 'No bot counters'}</span>
        <span>{sim.arrivalsPerMin ? `${sim.arrivalsPerMin}/min arrivals` : 'Arrivals off'}</span>
        <span>{sim.speed}× speed</span>
      </div>

      <div className="simulation-controls">
        <fieldset className="simulation-group bot-group" disabled={pendingAction !== null}>
          <legend>Bot counters</legend>
          <div className="bot-options">
            {counters.map((counter) => (
              <label key={counter.counterId}>
                <input type="checkbox" checked={selectedBots.includes(counter.counterId)} onChange={() => toggleBot(counter.counterId)} />
                <span>{counter.name}</span>
              </label>
            ))}
          </div>
          <small>Select none to keep every counter manual.</small>
        </fieldset>

        <div className="simulation-group">
          <label htmlFor="automatic-arrivals">Automatic arrivals</label>
          <div className="inline-control">
            <input id="automatic-arrivals" type="number" min="0" max="30" value={arrivalsPerMin} onChange={(event) => setArrivalsPerMin(Math.min(30, Math.max(0, Number(event.target.value))))} />
            <button className="secondary-button compact" type="button" onClick={() => runAction('arrivals', () => managerApi.configureArrivals({ perMin: arrivalsPerMin }), arrivalsPerMin ? `Automatic arrivals set to ${arrivalsPerMin}/min.` : 'Automatic arrivals disabled.')} disabled={pendingAction !== null || arrivalsPerMin === sim.arrivalsPerMin}>{pendingAction === 'arrivals' ? 'Setting…' : 'Set'}</button>
          </div>
          <small>0 means Off. Runs only while started.</small>
        </div>

        <div className="simulation-group">
          <label htmlFor="simulation-speed">Speed</label>
          <select id="simulation-speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} disabled={pendingAction !== null}>
            {[1, 5, 10].map((value) => <option key={value} value={value}>{value}× realtime</option>)}
          </select>
          <small>Applied when the simulation starts.</small>
        </div>

        <div className="simulation-group run-group">
          <span className="control-label">Run state</span>
          <div className="button-row">
            <button className="primary-button compact" type="button" onClick={() => runAction('start', () => managerApi.startSimulation({ speed }), `Simulation started at ${speed}× speed.`)} disabled={sim.running || pendingAction !== null}><Play size={14} />{pendingAction === 'start' ? 'Starting…' : 'Start'}</button>
            <button className="secondary-button compact" type="button" onClick={() => runAction('stop', managerApi.stopSimulation, 'Simulation stopped. Automated activity is paused.')} disabled={!sim.running || pendingAction !== null}><Square size={13} />{pendingAction === 'stop' ? 'Stopping…' : 'Stop'}</button>
          </div>
        </div>

        <div className="simulation-group flood-group">
          <label htmlFor="flood-service">Deliberate overload</label>
          <div className="flood-controls">
            <select id="flood-service" value={serviceId} onChange={(event) => setServiceId(Number(event.target.value))} disabled={pendingAction !== null}>
              {services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.name}</option>)}
            </select>
            <input aria-label="Flood arrival count" type="number" min="1" max="100" value={floodCount} onChange={(event) => setFloodCount(Math.min(100, Math.max(1, Number(event.target.value))))} disabled={pendingAction !== null} />
            <button className="secondary-button compact" type="button" onClick={() => runAction('flood', () => managerApi.floodService({ serviceId: Number(serviceId), count: floodCount }), `Added ${floodCount} arrivals to ${selectedService?.name ?? 'the selected service'}.`)} disabled={pendingAction !== null || !serviceId}><Waves size={14} />{pendingAction === 'flood' ? 'Adding…' : `Flood ${selectedService?.name ?? 'service'}`}</button>
          </div>
        </div>

        <div className="simulation-group reset-group">
          <span className="control-label">Reset demo</span>
          <button className="text-button" type="button" onClick={() => runAction('reset', managerApi.resetSimulation, 'Simulation reset. Bots and automatic arrivals are cleared.')} disabled={pendingAction !== null}><RotateCcw size={14} />{pendingAction === 'reset' ? 'Resetting…' : 'Reset simulation'}</button>
        </div>
      </div>
      <p className={`simulation-message${feedback.error ? ' error' : ''}`} aria-live="polite">{feedback.message || 'Bots and arrivals are configured now, but operate only while the simulation is running.'}</p>
    </section>
  )
}

export default function SimulationControls() {
  const { data: overview, error, loading, reload } = useManagerResource(managerApi.getOverview, managerApi.subscribeOverview)
  const [feedback, setFeedback] = useState({ message: '', error: false })

  if (loading && !overview) return <section className="panel simulation-panel"><ResourceState loading title="Loading simulation" message="Getting the current simulator configuration." /></section>
  if (error || !overview) return <section className="panel simulation-panel"><ResourceState title="Simulation unavailable" message="The simulation controls could not be loaded." action={reload} /></section>

  const sim = overview.sim
  const configurationKey = `${sim.speed}-${(sim.bots ?? []).join(',')}-${sim.arrivalsPerMin ?? 0}`
  return <SimulationPanel key={configurationKey} overview={overview} feedback={feedback} setFeedback={setFeedback} />
}
