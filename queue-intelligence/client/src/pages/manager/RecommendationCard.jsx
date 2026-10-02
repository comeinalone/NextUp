import { useState } from 'react'
import { ArrowRight, Info, Lightbulb, MoveRight, TriangleAlert } from 'lucide-react'
import { managerApi } from '../../lib/managerApi'
import { ResourceState } from './components'
import { minutes } from './format'
import { useManagerResource } from './useManagerResource'

function ImpactRow({ label, before, after, emphasis = false }) {
  const eta = (value) => value == null ? 'No counter open' : minutes(value)
  return (
    <div className={`impact-row${emphasis ? ' impact-target' : ''}`}>
      <div><span className="impact-label">{label}</span>{emphasis && <span className="target-label">Overloaded</span>}</div>
      <span className="impact-before">{eta(before.etaMin)}</span>
      <ArrowRight size={15} aria-hidden="true" />
      <strong>{eta(after.etaMin)}</strong>
    </div>
  )
}

export default function RecommendationCard() {
  const { data: recommendation, error: loadError, loading, reload } = useManagerResource(managerApi.getRecommendation, managerApi.subscribeRecommendation)
  const [applying, setApplying] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const applyRecommendation = async () => {
    setApplying(true)
    setFeedback(null)
    try {
      await managerApi.applyRecommendation({ id: recommendation.id })
    } catch (error) {
      if (error?.code === 'RECOMMENDATION_STALE') {
        setFeedback('Queue conditions changed. Recommendation refreshed.')
        await reload()
      } else {
        setFeedback(error?.message ?? 'Could not apply this recommendation.')
      }
    } finally {
      setApplying(false)
    }
  }

  if (loading && !recommendation) return <section className="recommendation-card"><ResourceState loading title="Checking queue balance" message="Looking for the latest allocation opportunity." /></section>
  if (loadError) return <section className="recommendation-card"><ResourceState title="Recommendation unavailable" message="The current recommendation could not be loaded." action={reload} /></section>
  if (!recommendation) return feedback ? <p className="recommendation-feedback" role="status">{feedback}</p> : null

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
          <button className="primary-button" type="button" onClick={applyRecommendation} disabled={applying}>
            {applying ? 'Applying…' : 'Apply recommendation'}
          </button>
          <p className={`action-feedback${feedback ? ' error' : ''}`} aria-live="polite">
            {feedback ?? 'Updates the live counter assignment'}
          </p>
        </div>
      </div>

      <div className="assumptions"><Info size={14} /><span><strong>Assumptions:</strong> {recommendation.assumptions}</span></div>
    </section>
  )
}
