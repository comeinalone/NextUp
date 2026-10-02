import { useState } from 'react'
import { HandHelping } from 'lucide-react'
import { managerApi } from '../../lib/managerApi'
import { RefreshNotice, ResourceState, StatusBadge } from './components'
import { timeAgo, timeLabel } from './format'
import { useManagerResource } from './useManagerResource'

const reasons = {
  DOCUMENT_ISSUE: 'Document issue', SYSTEM_PROBLEM: 'System problem',
  OVERLOADED: 'Overloaded', DIFFICULT_CASE: 'Difficult case', OTHER: 'Other assistance',
}
const conflicts = {
  NOT_ELIGIBLE: 'That helper is no longer available. Choose from the updated list.',
  OWN_REQUEST: 'A counter cannot answer its own request. The helper list has been refreshed.',
  NOT_OPEN: 'This request has already changed. The list has been refreshed.',
}

function AssistanceRequest({ request, counters, reload, announce }) {
  const [helperId, setHelperId] = useState('')
  const [pending, setPending] = useState(null)
  const eligible = counters.filter((counter) => request.eligibleCounterIds.includes(counter.counterId))
  const selectedId = eligible.some((counter) => counter.counterId === Number(helperId)) ? helperId : ''
  const act = async (action) => {
    if (pending) return
    setPending(action)
    announce(null)
    try {
      if (action === 'accept') await managerApi.acceptAssist({ id: request.id, counterId: Number(selectedId) })
      else await managerApi.resolveAssist({ id: request.id })
      announce(action === 'accept' ? { id: request.id, message: `${request.counterName} has been assigned a helper.` } : null)
    } catch (error) {
      announce({ error: true, message: conflicts[error.code] ?? error.message ?? 'Could not update this request.' })
      if (error.status === 409 || error.status === 404) await reload()
    } finally {
      setPending(null)
    }
  }

  return <li className="assistance-request">
    <div className="assistance-details">
      <div className="assistance-heading"><h3>{request.counterName}{request.tokenCode && <span> · {request.tokenCode}</span>}</h3><StatusBadge state={request.state} /></div>
      <p className="assistance-reason">{reasons[request.reason] ?? request.reason.replaceAll('_', ' ').toLowerCase()}</p>
      {request.note && <p className="assistance-note">{request.note}</p>}
      <time dateTime={request.createdAt} title={timeLabel(request.createdAt, true)}>{timeAgo(request.createdAt)}</time>
      {request.acceptedBy && <p className="assistance-helper">{request.acceptedBy.counterName}{request.acceptedBy.staffName ? ` · ${request.acceptedBy.staffName}` : ''} is helping</p>}
    </div>
    <div className="assistance-actions">
      {request.state === 'OPEN' && (eligible.length ? <>
        <label htmlFor={`helper-${request.id}`}>Eligible helper</label>
        <div className="inline-control"><select id={`helper-${request.id}`} value={selectedId} onChange={(event) => setHelperId(event.target.value)} disabled={pending !== null}><option value="">Choose a counter…</option>{eligible.map((counter) => <option key={counter.counterId} value={counter.counterId}>{counter.name}{counter.staff?.name ? ` · ${counter.staff.name}` : ''}</option>)}</select><button className="primary-button compact" type="button" disabled={!selectedId || pending !== null} onClick={() => act('accept')}>{pending === 'accept' ? 'Assigning…' : 'Assign helper'}</button></div>
      </> : <p className="assistance-unavailable">No eligible helper currently available</p>)}
      <button className="text-button" type="button" onClick={() => act('resolve')} disabled={pending !== null}>{pending === 'resolve' ? 'Resolving…' : 'Mark resolved'}</button>
    </div>
  </li>
}

export default function StaffAssistance({ counters, openAssists }) {
  const resource = useManagerResource(managerApi.getAssists, managerApi.subscribeAssists, true)
  const [notice, setNotice] = useState(null)
  const visibleNotice = notice && (notice.error || resource.data?.some((request) => request.id === notice.id))
  return <section className="panel assistance-panel" aria-labelledby="assistance-title">
    <div className="section-heading"><div><h2 id="assistance-title">Staff assistance</h2><p>Help requests from the counter floor, oldest first.</p></div><span className="count-label"><HandHelping size={15} />{openAssists} unresolved</span></div>
    <RefreshNotice {...resource} />
    {visibleNotice && <p className={`assistance-feedback${notice.error ? ' error' : ''}`} role="status">{notice.message}</p>}
    {!resource.data ? <ResourceState loading={resource.loading} title={resource.loading ? 'Loading assistance' : 'Assistance unavailable'} message="Getting requests from the counter floor." action={resource.error ? resource.reload : undefined} /> : resource.data.length ? <ul className="assistance-list">{resource.data.map((request) => <AssistanceRequest key={request.id} request={request} counters={counters} reload={resource.reload} announce={setNotice} />)}</ul> : <p className="empty-state">No unresolved assistance requests. New requests appear here automatically.</p>}
  </section>
}
