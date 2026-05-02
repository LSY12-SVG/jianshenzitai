export function createEventStore() {
  return {
    events: [],
    holdStartAt: 0,
  };
}

export function resetEventStore(store) {
  store.events = [];
  store.holdStartAt = 0;
}

export function pushRepEvent(store, atMs, payload = {}) {
  store.events.push({
    type: "rep",
    atMs,
    ...payload,
  });
}

export function startHoldEvent(store, atMs, payload = {}) {
  if (store.holdStartAt) {
    return;
  }

  store.holdStartAt = atMs;
  store.events.push({
    type: "hold_start",
    atMs,
    ...payload,
  });
}

export function finishHoldEvent(store, atMs, payload = {}) {
  if (!store.holdStartAt) {
    return null;
  }

  const durationMs = Math.max(0, atMs - store.holdStartAt);
  const event = {
    type: "hold_end",
    atMs,
    startAtMs: store.holdStartAt,
    durationMs,
    durationSeconds: durationMs / 1000,
    ...payload,
  };

  store.events.push(event);
  store.holdStartAt = 0;
  return event;
}

export function listRepEvents(store) {
  return store.events.filter((event) => event.type === "rep");
}

export function listHoldEvents(store) {
  return store.events.filter((event) => event.type === "hold_end");
}

export function getRecentCadenceRpm(store) {
  const repEvents = listRepEvents(store);

  if (repEvents.length < 2) {
    return 0;
  }

  const recent = repEvents.slice(-6);
  const intervals = [];

  for (let index = 1; index < recent.length; index += 1) {
    intervals.push((recent[index].atMs - recent[index - 1].atMs) / 1000);
  }

  if (!intervals.length) {
    return 0;
  }

  const avgInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  return avgInterval > 0 ? 60 / avgInterval : 0;
}

export function getEventStoreSummary(store, exerciseKey, now, liveHoldSeconds = 0) {
  if (exerciseKey === "plank") {
    const holdEvents = listHoldEvents(store);
    const bestHoldSeconds = holdEvents.reduce((best, event) => Math.max(best, event.durationSeconds ?? 0), 0);

    return {
      count: holdEvents.length,
      liveHoldSeconds,
      bestHoldSeconds,
      firstEventAtMs: holdEvents[0]?.startAtMs ?? null,
      falsePositiveCount: null,
      missedCount: null,
    };
  }

  const repEvents = listRepEvents(store);
  return {
    count: repEvents.length,
    cadenceRpm: getRecentCadenceRpm(store),
    firstEventAtMs: repEvents[0]?.atMs ?? null,
    falsePositiveCount: null,
    missedCount: null,
  };
}
