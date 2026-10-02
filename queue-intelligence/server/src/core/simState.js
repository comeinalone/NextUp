// Demo mode state, kept in its own file so the simulator, the bots and the
// manager snapshot can all read it without importing each other.
let running = false;
let bots = new Set();
let arrivalsPerMin = 0;

export const isRunning = () => running;
export const setRunning = (value) => {
  running = !!value;
};

export const getBots = () => [...bots].sort((a, b) => a - b);
export const setBots = (ids) => {
  bots = new Set(ids);
};

export const getArrivalsPerMin = () => arrivalsPerMin;
export const setArrivalsPerMin = (n) => {
  arrivalsPerMin = n;
};

// Back to "demo mode off, nothing automated".
export function clearSimState() {
  running = false;
  bots = new Set();
  arrivalsPerMin = 0;
}