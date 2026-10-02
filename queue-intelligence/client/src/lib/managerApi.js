import { io } from 'socket.io-client'

// REST responses and socket snapshots share one manager data boundary.

export class ManagerApiError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', status = 0 } = {}) {
    super(message)
    this.name = 'ManagerApiError'
    this.code = code
    this.status = status
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    })
  } catch {
    throw new ManagerApiError('Could not reach the NextUp server.', { code: 'NETWORK_ERROR' })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ManagerApiError(
      payload?.error?.message ?? 'The manager request failed.',
      { code: payload?.error?.code ?? 'REQUEST_FAILED', status: response.status },
    )
  }
  return payload
}

const realProvider = {
  getOverview: () => request('/api/manager/overview'),
  getRecommendation: () => request('/api/manager/recommendation'),
  applyRecommendation: ({ id }) => request('/api/manager/recommendation/apply', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }),
  assignCounter: ({ counterId, serviceId }) => request(`/api/counters/${counterId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  }),
  startSimulation: ({ speed }) => request('/api/sim/start', {
    method: 'POST',
    body: JSON.stringify({ speed }),
  }),
  stopSimulation: () => request('/api/sim/stop', { method: 'POST' }),
  floodService: ({ serviceId, count }) => request('/api/sim/flood', {
    method: 'POST',
    body: JSON.stringify({ serviceId, count }),
  }),
  configureBots: ({ counterIds }) => request('/api/sim/bots', {
    method: 'POST',
    body: JSON.stringify({ counterIds }),
  }),
  configureArrivals: ({ perMin }) => request('/api/sim/arrivals', {
    method: 'POST',
    body: JSON.stringify({ perMin }),
  }),
  resetSimulation: () => request('/api/sim/reset', { method: 'POST' }),
}

let managerSocket = null
let currentOverview = null
let overviewRevision = 0
let overviewRequest = null
let currentRecommendation = null
let recommendationRevision = 0
let recommendationRequest = null
let currentAssists = []
let assistRevision = 0
let assistRequest = null
const overviewSubscribers = new Set()
const recommendationSubscribers = new Set()
const assistSubscribers = new Set()

function publishOverview(overview) {
  currentOverview = overview
  overviewRevision += 1
  for (const subscriber of overviewSubscribers) subscriber(overview)
  return overview
}

function publishRecommendation(recommendation) {
  currentRecommendation = recommendation
  recommendationRevision += 1
  for (const subscriber of recommendationSubscribers) subscriber(recommendation)
  return recommendation
}

function getRecommendation() {
  if (!recommendationRequest) {
    const revision = recommendationRevision
    recommendationRequest = realProvider.getRecommendation().then((recommendation) => {
      return revision === recommendationRevision ? publishRecommendation(recommendation) : currentRecommendation
    }).finally(() => { recommendationRequest = null })
  }
  return recommendationRequest
}

function publishAssists(requests) {
  currentAssists = requests.filter((item) => item.state !== 'RESOLVED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
  assistRevision += 1
  for (const subscriber of assistSubscribers) subscriber(currentAssists)
  return currentAssists
}

function publishAssist(request) {
  publishAssists([...currentAssists.filter((item) => item.id !== request.id), request])
  return request
}

function getAssists() {
  if (!assistRequest) {
    const revision = assistRevision
    assistRequest = request('/api/assist').then((requests) => {
      // A newer socket event wins over an earlier HTTP snapshot.
      return revision === assistRevision ? publishAssists(requests) : currentAssists
    }).finally(() => { assistRequest = null })
  }
  return assistRequest
}

function getOverview() {
  if (!overviewRequest) {
    const revision = overviewRevision
    overviewRequest = realProvider.getOverview().then((overview) => {
      return revision === overviewRevision ? publishOverview(overview) : currentOverview
    }).finally(() => { overviewRequest = null })
  }
  return overviewRequest
}

function releaseManagerSocket() {
  if (!overviewSubscribers.size && !recommendationSubscribers.size && !assistSubscribers.size) stopManagerSocket()
}

function stopManagerSocket() {
  if (!managerSocket) return
  managerSocket.removeAllListeners()
  managerSocket.disconnect()
  managerSocket = null
}

function ensureManagerSocket() {
  if (managerSocket) return managerSocket

  const socket = io({ autoConnect: false })
  socket.on('connect', () => {
    socket.emit('join', 'manager')
    // Assistance is recovered by REST because room join only sends overview/recommendation.
    if (assistSubscribers.size) getAssists().catch(() => {})
  })
  socket.on('manager:overview', publishOverview)
  socket.on('manager:recommendation', publishRecommendation)
  socket.on('assist:new', publishAssist)
  socket.on('assist:update', publishAssist)
  managerSocket = socket
  socket.connect()
  return socket
}

function subscribeOverview(subscriber) {
  overviewSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    overviewSubscribers.delete(subscriber)
    releaseManagerSocket()
  }
}

function subscribeRecommendation(subscriber) {
  recommendationSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    recommendationSubscribers.delete(subscriber)
    releaseManagerSocket()
  }
}

function subscribeAssists(subscriber) {
  assistSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    assistSubscribers.delete(subscriber)
    releaseManagerSocket()
  }
}

async function publishOverviewResult(operation) {
  return publishOverview(await operation)
}

export const managerApi = {
  getOverview,
  getStaffOverview: getOverview,
  assignCounter: (input) => publishOverviewResult(realProvider.assignCounter(input)),
  subscribeOverview,
  getRecommendation,
  applyRecommendation: async (input) => {
    const overview = await publishOverviewResult(realProvider.applyRecommendation(input))
    publishRecommendation(null)
    return overview
  },
  subscribeRecommendation,
  startSimulation: (input) => publishOverviewResult(realProvider.startSimulation(input)),
  stopSimulation: () => publishOverviewResult(realProvider.stopSimulation()),
  floodService: (input) => publishOverviewResult(realProvider.floodService(input)),
  configureBots: (input) => publishOverviewResult(realProvider.configureBots(input)),
  configureArrivals: (input) => publishOverviewResult(realProvider.configureArrivals(input)),
  resetSimulation: () => publishOverviewResult(realProvider.resetSimulation()),
  getAnalyticsToday: () => request('/api/analytics/today'),
  getAnalyticsTimeline: () => request('/api/analytics/timeline?minutes=120&step=5'),
  getEvents: () => request('/api/events?limit=50'),
  getAssists,
  subscribeAssists,
  acceptAssist: async ({ id, counterId }) => publishAssist(await request(`/api/assist/${id}/accept`, {
    method: 'POST', body: JSON.stringify({ counterId }),
  })),
  resolveAssist: async ({ id }) => publishAssist(await request(`/api/assist/${id}/resolve`, { method: 'POST' })),
}

const assignmentErrorMessages = {
  STAFF_LACKS_SKILL: 'The assigned staff member is not skilled for that service.',
  ALREADY_ASSIGNED: 'This counter already serves the selected service.',
  ALREADY_SWITCHING: 'This counter already has a service switch in progress.',
}

export function assignmentErrorMessage(error) {
  const message = assignmentErrorMessages[error?.code] ?? error?.message ?? 'The counter could not be reassigned.'
  return error?.code && assignmentErrorMessages[error.code] ? `${message} (${error.code})` : message
}
