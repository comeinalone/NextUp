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
