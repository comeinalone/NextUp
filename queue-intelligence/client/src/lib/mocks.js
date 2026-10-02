// manager:overview snapshot. Keep these keys and types aligned with shared/contract.md.
// Display labels and local form selections belong in the UI, not in this payload.
export const managerOverview = {
  services: [
    { serviceId: 1, name: 'Admissions', prefix: 'A', waiting: 31, openCounters: 1, etaMin: 29, health: 'CRITICAL', customerMinutes: 410, nowServing: [{ counterId: 1, counterName: 'Counter 1', code: 'A-036' }], notice: null },
    { serviceId: 2, name: 'Fee Payment', prefix: 'F', waiting: 12, openCounters: 1, etaMin: 14, health: 'BUSY', customerMinutes: 96, nowServing: [{ counterId: 3, counterName: 'Counter 3', code: 'F-024' }], notice: null },
    { serviceId: 3, name: 'Certificates', prefix: 'C', waiting: 4, openCounters: 1, etaMin: 5, health: 'NORMAL', customerMinutes: 20, nowServing: [], notice: null },
  ],
  counters: [
    { counterId: 1, name: 'Counter 1', serviceId: 1, state: 'OPEN', pendingServiceId: null, staff: { id: 3, name: 'Hitesh', state: 'SERVING' }, currentCode: 'A-036' },
    { counterId: 2, name: 'Counter 2', serviceId: 3, state: 'OPEN', pendingServiceId: null, staff: { id: 1, name: 'Ananya', state: 'AVAILABLE' }, currentCode: null },
    { counterId: 3, name: 'Counter 3', serviceId: 2, state: 'OPEN', pendingServiceId: null, staff: { id: 2, name: 'Rahul', state: 'SERVING' }, currentCode: 'F-024' },
    { counterId: 4, name: 'Counter 4', serviceId: 3, state: 'BREAK', pendingServiceId: null, staff: { id: 4, name: 'Meera', state: 'BREAK' }, currentCode: null },
  ],
  staff: [
    { id: 3, name: 'Hitesh', state: 'SERVING', counterId: 1, skills: [1, 2, 3], servedToday: 12, avgHandlingMin: 4.1 },
    { id: 1, name: 'Ananya', state: 'AVAILABLE', counterId: 2, skills: [1, 3], servedToday: 18, avgHandlingMin: 3.8 },
    { id: 2, name: 'Rahul', state: 'SERVING', counterId: 3, skills: [1, 2], servedToday: 24, avgHandlingMin: 2.6 },
    { id: 4, name: 'Meera', state: 'BREAK', counterId: 4, skills: [2, 3], servedToday: 15, avgHandlingMin: 5.2 },
  ],
  openAssists: 0,
  sim: { running: false, speed: 1 },
}

// manager:recommendation snapshot. This object matches the socket/REST contract exactly.
export const managerRecommendation = {
  id: 'rec-17',
  counterId: 5,
  counterName: 'Counter 5',
  fromServiceId: 3,
  fromServiceName: 'Certificates',
  toServiceId: 1,
  toServiceName: 'Admissions',
  before: {
    from: { etaMin: 5, customerMinutes: 20 },
    to: { etaMin: 29, customerMinutes: 410 },
  },
  after: {
    from: { etaMin: 8, customerMinutes: 32 },
    to: { etaMin: 18, customerMinutes: 255 },
  },
  savedCustomerMinutes: 143,
  assumptions: 'Based on current queue, no new arrivals, average service times from today.',
}

// GET /analytics/today response.
export const analyticsToday = {
  issued: 96,
  completed: 71,
  waiting: 47,
  noShows: 5,
  avgWaitMin: 12.8,
  avgServiceMin: 4.1,
  perService: [
    { serviceId: 1, serviceName: 'Admissions', completed: 28 },
    { serviceId: 2, serviceName: 'Fee Payment', completed: 26 },
    { serviceId: 3, serviceName: 'Certificates', completed: 17 },
  ],
}

// GET /analytics/timeline response.
export const analyticsTimeline = [
  { time: '08:00', waiting: 6 },
  { time: '08:30', waiting: 11 },
  { time: '09:00', waiting: 18 },
  { time: '09:30', waiting: 25 },
  { time: '10:00', waiting: 39 },
  { time: '10:30', waiting: 47 },
  { time: '11:00', waiting: 42 },
  { time: '11:30', waiting: 35 },
]
