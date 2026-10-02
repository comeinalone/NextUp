import { useState } from 'react'
import { Play, RotateCcw, Square, Waves } from 'lucide-react'
import { managerApi } from '../../lib/managerApi'
import { StatusBadge } from './components'

export default function SimulationControls({ services, initialSimulation }) {
  const [simulation, setSimulation] = useState(initialSimulation)
  const [speed, setSpeed] = useState(initialSimulation.speed)
  const [serviceId, setServiceId] = useState(services[0]?.serviceId ?? '')
  const [message, setMessage] = useState('Ready for a mock demo run.')
  const [pendingAction, setPendingAction] = useState(null)
  const [hasError, setHasError] = useState(false)

  const start = async () => {
    setPendingAction('start')
    setHasError(false)
    try {
      const next = await managerApi.startSimulation({ speed })
      setSimulation(next)
      setMessage(`Simulation started at ${speed}× speed.`)
    } catch {
      setHasError(true)
      setMessage('The simulation could not be started.')
    } finally {
      setPendingAction(null)
    }
  }
  const stop = async () => {
    setPendingAction('stop')
    setHasError(false)
    try {
      const next = await managerApi.stopSimulation()
      setSimulation({ ...next, speed })
      setMessage('Simulation stopped. Mock queue data is unchanged.')
    } catch {
      setHasError(true)
      setMessage('The simulation could not be stopped.')
    } finally {
      setPendingAction(null)
    }
  }
  const flood = async () => {
    setPendingAction('flood')
    setHasError(false)
    try {
      const result = await managerApi.floodService({ serviceId, count: 10 })
      const service = services.find((item) => item.serviceId === result.serviceId)
      setMessage(`Added a mock burst of ${result.count} arrivals to ${service?.name ?? 'the selected service'}.`)
    } catch {
      setHasError(true)
      setMessage('The service flood could not be applied.')
    } finally {
      setPendingAction(null)
    }
  }
  const reset = async () => {
    setPendingAction('reset')
    setHasError(false)
    try {
      const next = await managerApi.resetSimulation()
      setSimulation(next)
      setSpeed(next.speed)
      setServiceId(services[0]?.serviceId ?? '')
      setMessage('Simulation controls reset to their initial mock state.')
    } catch {
      setHasError(true)
      setMessage('The simulation could not be reset.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section className="panel simulation-panel" aria-labelledby="simulation-title">
      <div className="section-heading">
        <div><h2 id="simulation-title">Demo simulation</h2><p>Control the local preview without changing queue records.</p></div>
        <StatusBadge state={simulation.running ? 'RUNNING' : 'STOPPED'} />
      </div>
      <div className="simulation-controls">
        <div className="simulation-group">
          <span className="control-label">Run state</span>
          <div className="button-row">
            <button className="primary-button compact" type="button" onClick={start} disabled={simulation.running || pendingAction !== null}><Play size={14} />{pendingAction === 'start' ? 'Starting…' : 'Start'}</button>
            <button className="secondary-button compact" type="button" onClick={stop} disabled={!simulation.running || pendingAction !== null}><Square size={13} />{pendingAction === 'stop' ? 'Stopping…' : 'Stop'}</button>
          </div>
        </div>
        <div className="simulation-group">
          <label htmlFor="simulation-speed">Speed</label>
          <select id="simulation-speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {[1, 5, 10].map((value) => <option key={value} value={value}>{value}× realtime</option>)}
          </select>
        </div>
        <div className="simulation-group flood-group">
          <label htmlFor="flood-service">Flood service</label>
          <div className="inline-control">
            <select id="flood-service" value={serviceId} onChange={(event) => setServiceId(Number(event.target.value))}>
              {services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.name}</option>)}
            </select>
            <button className="secondary-button compact" type="button" onClick={flood} disabled={pendingAction !== null || !serviceId}><Waves size={14} />{pendingAction === 'flood' ? 'Adding…' : 'Add 10'}</button>
          </div>
        </div>
        <div className="simulation-group reset-group">
          <span className="control-label">Reset demo</span>
          <button className="text-button" type="button" onClick={reset} disabled={pendingAction !== null}><RotateCcw size={14} />{pendingAction === 'reset' ? 'Resetting…' : 'Reset simulation'}</button>
        </div>
      </div>
      <p className={`simulation-message${hasError ? ' error' : ''}`} aria-live="polite">{message}</p>
    </section>
  )
}
