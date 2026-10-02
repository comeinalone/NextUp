import { mockServices, mockToken } from "./mocks.p2";

// Set VITE_MOCKS=1 in client/.env to run without the server (customer home + token creation only).
export const USE_MOCKS = import.meta.env.VITE_MOCKS === "1";

// All REST calls live here. Errors always throw ApiError with a human-readable message.
const PORT = import.meta.env.VITE_API_PORT ?? 5000;
// hostname (not "localhost") so phones on the LAN reach the laptop
export const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:${PORT}`;
const BASE = `${SERVER_URL}/api`;

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the server. Check the Wi-Fi and that the server is running.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? "Something went wrong. Try again.");
  }
  return data;
}

const get = (p) => request("GET", p);
const post = (p, b = {}) => request("POST", p, b);

export const api = {
  // Customer: these use the token CODE ("A-042")
  services: () => (USE_MOCKS ? Promise.resolve(mockServices) : get("/services")),
  createToken: (serviceId, isPriority = false) =>
    USE_MOCKS ? Promise.resolve(mockToken(serviceId, isPriority)) : post("/tokens", { serviceId, isPriority }),
  getToken: (code) => get(`/tokens/${code}`),
  cancelToken: (code) => post(`/tokens/${code}/cancel`),
  rejoinToken: (code) => post(`/tokens/${code}/rejoin`),

  // Counter: each returns the counter:update shape
  counter: (id) => get(`/counters/${id}`),
  callNext: (id) => post(`/counters/${id}/call-next`),
  start: (id) => post(`/counters/${id}/start`),
  complete: (id) => post(`/counters/${id}/complete`),
  skip: (id, reason) => post(`/counters/${id}/skip`, { reason }),
  hold: (id, reason) => post(`/counters/${id}/hold`, { reason }),
  recall: (id, tokenId) => post(`/counters/${id}/recall/${tokenId}`),
  setCounterState: (id, state, reason = "") => post(`/counters/${id}/state`, { state, reason }), // OPEN | BREAK | CLOSED
  // These two use the numeric tokenId (current.tokenId), NOT the code
  setChecklist: (tokenId, itemId, done) => post(`/tokens/${tokenId}/checklist/${itemId}`, { done }),
  transfer: (tokenId, serviceId) => post(`/tokens/${tokenId}/transfer`, { serviceId }),

  // Help request (UI is yours, the backend is P3's)
  requestHelp: (counterId, tokenCode, reason, note = "") => post("/assist", { counterId, tokenCode, reason, note }),
};
