// Whether demo mode is on. Kept in its own file so the simulator and the
// manager snapshot can both read it without importing each other.
let running = false;

export const isRunning = () => running;
export const setRunning = (value) => {
  running = !!value;
};