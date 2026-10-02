import { useState } from 'react'
import { Play, RotateCcw, Square, Waves } from 'lucide-react'
import { managerOverview } from '../../lib/mocks'
import { managerApi } from '../../lib/managerApi'
import { StatusBadge } from './components'

export default function SimulationControls() {
  const [simulation, setSimulation] = useState(managerOverview.sim)
  const [speed, setSpeed] = useState(managerOverview.sim.speed)
  const [serviceId, setServiceId] = useState(managerOverview.services[0].serviceId)
  const [message, setMessage] = useState('Ready for a mock demo run.')
  const services = managerOverview.services

  const start = async () => {
    const next = await managerApi.startSimulation({ speed })
    setSimulation(next)
    setMessage(`Simulation started at ${speed}× speed.`)
  }
  const stop = async () => {
    const next = await managerApi.stopSimulation()
    setSimulation({ ...next, speed })
    setMessage('Simulation stopped. Mock queue data is unchanged.')
  }
  const flood = async () => {
    const result = await managerApi.floodService({ serviceId, count: 10 })
    const service = services.find((item) => item.serviceId === result.serviceId)
    setMessage(`Added a mock burst of ${result.count} arrivals to ${service.name}.`)
  }
  const reset = async () => {
    const next = await managerApi.resetSimulation()
    setSimulation(next)
    setSpeed(next.speed)
    setServiceId(services[0].serviceId)
    setMessage('Simulation controls reset to their initial mock state.')
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
            <button className="primary-button compact" type="button" onClick={start} disabled={simulation.running}><Play size={14} />Start</button>
            <button className="secondary-button compact" type="button" onClick={stop} disabled={!simulation.running}><Square size={13} />Stop</button>
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
            <button className="secondary-button compact" type="button" onClick={flood}><Waves size={14} />Add 10</button>
          </div>
        </div>
        <div className="simulation-group reset-group">
          <span className="control-label">Reset demo</span>
          <button className="text-button" type="button" onClick={reset}><RotateCcw size={14} />Reset simulation</button>
        </div>
      </div>
      <p className="simulation-message" aria-live="polite">{message}</p>
    </section>
  )
}
