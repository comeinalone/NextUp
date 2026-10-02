import { useState } from 'react'
import { ArrowRight, Check, Info, Lightbulb, MoveRight, TriangleAlert } from 'lucide-react'
import { managerRecommendation } from '../../lib/mocks'
import { managerApi } from '../../lib/managerApi'
import { minutes } from './format'

function ImpactRow({ label, before, after, emphasis = false }) {
  return (
    <div className={`impact-row${emphasis ? ' impact-target' : ''}`}>
      <div><span className="impact-label">{label}</span>{emphasis && <span className="target-label">Overloaded</span>}</div>
      <span className="impact-before">{minutes(before.etaMin)}</span>
      <ArrowRight size={15} aria-hidden="true" />
      <strong>{minutes(after.etaMin)}</strong>
    </div>
  )
}

export default function RecommendationCard() {
  const recommendation = managerRecommendation
  const [status, setStatus] = useState('ready')
  const applyRecommendation = async () => {
    setStatus('applying')
    try {
      await managerApi.applyRecommendation({ id: recommendation.id })
      setStatus('applied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="recommendation-card" aria-labelledby="recommendation-title">
      <div className="recommendation-header">
        <div className="recommendation-heading">
          <span className="recommendation-icon"><Lightbulb size={20} /></span>
          <div><p className="eyebrow">ALLOCATION OPPORTUNITY</p><h2 id="recommendation-title">Balance the counter floor</h2></div>
        </div>
        <span className="recommendation-id">{recommendation.id}</span>
      </div>

      <div className="recommendation-body">
        <div className="recommendation-summary">
          <div className="target-service"><TriangleAlert size={16} /><span><small>Overloaded service</small><strong>{recommendation.toServiceName}</strong></span></div>
          <div className="move-summary">
            <span><small>Move</small><strong>{recommendation.counterName}</strong></span>
            <MoveRight size={21} />
            <span><small>From → to</small><strong>{recommendation.fromServiceName} → {recommendation.toServiceName}</strong></span>
          </div>
        </div>

        <div className="recommendation-impact">
          <div className="impact-head"><span>Service ETA</span><span>Before</span><span /><span>After</span></div>
          <ImpactRow label={recommendation.toServiceName} before={recommendation.before.to} after={recommendation.after.to} emphasis />
          <ImpactRow label={recommendation.fromServiceName} before={recommendation.before.from} after={recommendation.after.from} />
        </div>

        <div className="recommendation-action">
          <div className="saved-minutes"><strong>{recommendation.savedCustomerMinutes}</strong><span>customer-minutes<br />saved</span></div>
          <button className="primary-button" type="button" onClick={applyRecommendation} disabled={status === 'applying' || status === 'applied'}>
            {status === 'applied' ? <><Check size={16} />Applied in preview</> : status === 'applying' ? 'Applying…' : 'Apply recommendation'}
          </button>
          <p className={`action-feedback${status === 'error' ? ' error' : ''}`} aria-live="polite">
            {status === 'applied' ? 'Mock state updated. Live counters are unchanged.' : status === 'error' ? 'Could not apply this recommendation.' : 'Preview action only'}
          </p>
        </div>
      </div>

      <div className="assumptions"><Info size={14} /><span><strong>Assumptions:</strong> {recommendation.assumptions}</span></div>
    </section>
  )
}
