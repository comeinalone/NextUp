import {
  analyticsTimeline,
  analyticsToday,
  managerOverview,
  managerRecommendation,
} from './mocks.js'

// P3's single data boundary. Replace these mock implementations with fetch calls
// to the matching /api endpoints when P1's server is ready.
const clone = (value) => structuredClone(value)

const mockProvider = {
  getOverview: async () => clone(managerOverview),
  assignCounter: async ({ counterId, serviceId }) => {
    const overview = clone(managerOverview)
    const counter = overview.counters.find((item) => item.counterId === counterId)
    if (!counter) throw new Error('Counter was not found.')
    if (!overview.services.some((item) => item.serviceId === serviceId)) throw new Error('Service was not found.')
    counter.serviceId = serviceId
    counter.pendingServiceId = null
    return overview
  },
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

// Keep this provider selection in one place. P1 integration replaces the
// implementations here; manager components continue to call the same methods.
const provider = mockProvider

export const managerApi = {
  getOverview: () => provider.getOverview(),
  getStaffOverview: () => provider.getOverview(),
  assignCounter: (input) => provider.assignCounter(input),
  getRecommendation: () => provider.getRecommendation(),
  applyRecommendation: (input) => provider.applyRecommendation(input),
  startSimulation: (input) => provider.startSimulation(input),
  stopSimulation: () => provider.stopSimulation(),
  floodService: (input) => provider.floodService(input),
  resetSimulation: () => provider.resetSimulation(),
  getAnalyticsToday: () => provider.getAnalyticsToday(),
  getAnalyticsTimeline: () => provider.getAnalyticsTimeline(),
}
