import {
  analyticsTimeline,
  analyticsToday,
  managerOverview,
  managerRecommendation,
} from './mocks.js'
import { io } from 'socket.io-client'

// P3's single data boundary. Replace these mock implementations with fetch calls
// to the matching /api endpoints when P1's server is ready.
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
  assignCounter: ({ counterId, serviceId }) => request(`/api/counters/${counterId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  }),
}

const mockProvider = {
  getRecommendation: async () => clone(managerRecommendation),
  applyRecommendation: async ({ id }) => {
    if (id !== managerRecommendation.id) throw new Error('Recommendation is no longer available.')
    return clone(managerOverview)
  },
  startSimulation: async ({ speed }) => ({ running: true, speed }),
  stopSimulation: async () => ({ running: false, speed: managerOverview.sim.speed }),
  floodService: async ({ serviceId, count }) => ({ serviceId, count }),
  resetSimulation: async () => clone(managerOverview.sim),
  getAnalyticsToday: async () => clone(analyticsToday),
  getAnalyticsTimeline: async () => clone(analyticsTimeline),
}

let managerSocket = null
const overviewSubscribers = new Set()

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
  socket.on('manager:overview', (overview) => {
    for (const subscriber of overviewSubscribers) subscriber(overview)
  })
  managerSocket = socket
  socket.connect()
  return socket
}

function subscribeOverview(subscriber) {
  overviewSubscribers.add(subscriber)
  ensureManagerSocket()
  return () => {
    overviewSubscribers.delete(subscriber)
    if (overviewSubscribers.size === 0) stopManagerSocket()
  }
}

export const managerApi = {
  getOverview: () => realProvider.getOverview(),
  getStaffOverview: () => realProvider.getOverview(),
  assignCounter: (input) => realProvider.assignCounter(input),
  subscribeOverview,
  getRecommendation: () => mockProvider.getRecommendation(),
  applyRecommendation: (input) => mockProvider.applyRecommendation(input),
  startSimulation: (input) => mockProvider.startSimulation(input),
  stopSimulation: () => mockProvider.stopSimulation(),
  floodService: (input) => mockProvider.floodService(input),
  resetSimulation: () => mockProvider.resetSimulation(),
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
