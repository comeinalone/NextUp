import { analyticsTimeline, analyticsToday } from './mocks.js'
import { io } from 'socket.io-client'

// P3's single data boundary. Analytics remains mock-backed until its backend is ready.
const clone = (value) => structuredClone(value)

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

const mockProvider = {
  getAnalyticsToday: async () => clone(analyticsToday),
  getAnalyticsTimeline: async () => clone(analyticsTimeline),
}

let managerSocket = null
let currentOverview = null
const overviewSubscribers = new Set()
const recommendationSubscribers = new Set()

function publishOverview(overview) {
  currentOverview = overview
  for (const subscriber of overviewSubscribers) subscriber(overview)
  return overview
}

function publishRecommendation(recommendation) {
  for (const subscriber of recommendationSubscribers) subscriber(recommendation)
  return recommendation
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
  socket.on('connect', () => socket.emit('join', 'manager'))
  socket.on('manager:overview', publishOverview)
  socket.on('manager:recommendation', publishRecommendation)
  managerSocket = socket
  socket.connect()
  return socket
}

function subscribeOverview(subscriber) {
  overviewSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    overviewSubscribers.delete(subscriber)
    if (overviewSubscribers.size === 0 && recommendationSubscribers.size === 0) stopManagerSocket()
  }
}

function subscribeRecommendation(subscriber) {
  recommendationSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    recommendationSubscribers.delete(subscriber)
    if (overviewSubscribers.size === 0 && recommendationSubscribers.size === 0) stopManagerSocket()
  }
}

async function publishOverviewResult(operation) {
  return publishOverview(await operation)
}

export const managerApi = {
  getOverview: () => currentOverview ? Promise.resolve(currentOverview) : publishOverviewResult(realProvider.getOverview()),
  getStaffOverview: () => currentOverview ? Promise.resolve(currentOverview) : publishOverviewResult(realProvider.getOverview()),
  assignCounter: (input) => publishOverviewResult(realProvider.assignCounter(input)),
  subscribeOverview,
  getRecommendation: async () => publishRecommendation(await realProvider.getRecommendation()),
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
  getAnalyticsToday: () => mockProvider.getAnalyticsToday(),
  getAnalyticsTimeline: () => mockProvider.getAnalyticsTimeline(),
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
