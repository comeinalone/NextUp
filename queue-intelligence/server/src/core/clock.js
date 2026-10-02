// One clock for the whole server. Never call Date.now() anywhere else.
// Speed > 1 makes time pass faster, so the demo can show a 4-minute
// service in a few seconds.

let anchorReal = Date.now();
let anchorVirtual = Date.now();
let speed = 1;

// Current time in milliseconds
export function now() {
  return anchorVirtual + (Date.now() - anchorReal) * speed;
}

// Current time as an ISO string, the format stored in the database
export function nowIso() {
  return new Date(now()).toISOString();
}

// Change speed without making time jump
export function setSpeed(newSpeed) {
  anchorVirtual = now();
  anchorReal = Date.now();
  speed = newSpeed;
}

export function getSpeed() {
  return speed;
}

// Snap back to real time. Only call this right after reseeding the database,
// because it can move time backwards.
export function resyncToRealTime() {
  anchorReal = Date.now();
  anchorVirtual = Date.now();
  speed = 1;
}

// Minutes elapsed since an ISO timestamp (or null if there is none)
export function minutesSince(iso) {
  if (!iso) return null;
  return (now() - Date.parse(iso)) / 60000;
}

// Minutes between two ISO timestamps
export function minutesBetween(startIso, endIso) {
  return (Date.parse(endIso) - Date.parse(startIso)) / 60000;
}