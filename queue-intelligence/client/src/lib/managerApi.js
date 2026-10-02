import {
  analyticsTimeline,
  analyticsToday,
  managerOverview,
  managerRecommendation,
} from './mocks'

// P3's single data boundary. Replace these mock implementations with fetch calls
// to the matching /api endpoints when P1's server is ready.
const clone = (value) => structuredClone(value)

export const managerApi = {
  getOverview: async () => clone(managerOverview),
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
