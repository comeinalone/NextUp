// All tunable numbers live here so they can be adjusted in one place.
export const config = {
  port: 4000,

  // Scheduler: a priority customer is treated as if they had already
  // waited this many extra minutes.
  priorityBoost: 15,

  // ETA engine
  ewmaAlpha: 0.3, // weight of the most recent service time
  noShowAlpha: 0.1, // how fast the no-show rate reacts to a skip or completion
  minServiceMin: 0.5, // a service can't "learn" as shorter than this
  etaRangeLow: 0.8, // customer sees eta * 0.8 ...
  etaRangeHigh: 1.2, // ... to eta * 1.2
  minRemainingMin: 0.5, // a busy counter is never treated as "free in 0 min"
  graceMin: 1.5, // time lost when a called customer doesn't show up
  rejoinAfterPeople: 2, // a skipped customer rejoins behind this many people

  // Queue health, based on a service's ETA in minutes
  health: {
    busyAboveMin: 10,
    criticalAboveMin: 20,
  },

  // Allocation engine (counter recommendations)
  allocation: {
    minSavingCustomerMin: 30, // ignore recommendations that save less than this
    etaRatio: 2, // target ETA must be at least 2x the donor's ETA
    donorMinCounters: 2, // never take the last counter from a service
    cooldownMin: 5, // wait this long after a change before recommending again
    unavailablePenaltyMin: 30, // a waiting person with no open counter counts as this long
  },

  // Background recompute so ETAs keep moving even when nobody clicks
  tickMs: 5000,

  // Staff assistance: prompt for help when a token takes this many times
  // the service average
  slowServiceFactor: 2,
    
  // Demo simulator (bots and automatic arrivals)
  sim: {
    tickMs: 250, // how often bots and arrivals are processed (real milliseconds)
    pickupMin: 0.25, // simulated minutes for a called customer to reach the counter
    serviceSpread: [0.6, 1.4], // a bot's service takes the default time x this range
    noShowRate: 0.05, // chance a called customer doesn't show up
    priorityRate: 0.08, // chance an arriving customer is a priority customer
    arrivalWeights: [0.5, 0.3, 0.2], // share of arrivals per service, in service order
  },
};