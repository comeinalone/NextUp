// Fake data in the exact contract shapes. Only used when VITE_MOCKS=1.
// P2's own file, so it can't conflict with P3's lib/mocks.js.
export const mockServices = [
  { serviceId: 1, name: "Admissions", prefix: "A", waiting: 31, openCounters: 2, etaMin: 29, health: "CRITICAL",
    customerMinutes: 410, nowServing: [{ counterId: 1, counterName: "Counter 1", code: "A-036" }], notice: null,
    requiredDocuments: ["ID proof", "Marksheet", "Passport photo"] },
  { serviceId: 2, name: "Fee Payment", prefix: "F", waiting: 9, openCounters: 2, etaMin: 14, health: "BUSY",
    customerMinutes: 63, nowServing: [{ counterId: 3, counterName: "Counter 3", code: "F-011" }], notice: null,
    requiredDocuments: ["Fee receipt", "College ID card"] },
  { serviceId: 3, name: "Certificates", prefix: "C", waiting: 4, openCounters: 1, etaMin: 5, health: "NORMAL",
    customerMinutes: 12, nowServing: [{ counterId: 5, counterName: "Counter 5", code: "C-007" }], notice: null,
    requiredDocuments: ["College ID card", "Application form"] },
];

const nextNumber = { 1: 42, 2: 12, 3: 8 };

// What POST /tokens returns (token:update shape). Priority tokens keep the service prefix, per architecture.md.
export function mockToken(serviceId, isPriority = false) {
  const s = mockServices.find((x) => x.serviceId === serviceId) ?? mockServices[0];
  const n = nextNumber[s.serviceId]++;
  return {
    code: `${s.prefix}-${String(n).padStart(3, "0")}`,
    serviceId: s.serviceId,
    serviceName: s.name,
    isPriority,
    state: "WAITING",
    position: s.waiting + 1,
    peopleAhead: s.waiting,
    etaMin: s.etaMin,
    etaRange: [Math.round(s.etaMin * 0.8), Math.round(s.etaMin * 1.2)],
    unavailable: false,
    nowServing: s.nowServing[0]?.code ?? null,
    counter: null,
    notice: null,
    customerChecklist: s.requiredDocuments,
  };
}
