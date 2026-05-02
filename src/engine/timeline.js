import { listHoldEvents, listRepEvents } from "./events.js";

export function buildTimelineModel(store, exerciseKey, analysisStartedAt, now, liveHoldSeconds = 0) {
  if (!analysisStartedAt) {
    return {
      summary: "等待动作采样",
      points: [],
      segments: [],
      durationMs: 1000,
    };
  }

  const durationMs = Math.max(1000, now - analysisStartedAt);

  if (exerciseKey === "plank") {
    const segments = listHoldEvents(store).map((event) => ({
      startAtMs: event.startAtMs,
      endAtMs: event.atMs,
      durationSeconds: event.durationSeconds,
      active: false,
    }));

    if (store.holdStartAt) {
      segments.push({
        startAtMs: store.holdStartAt,
        endAtMs: now,
        durationSeconds: liveHoldSeconds,
        active: true,
      });
    }

    const bestHoldSeconds = segments.reduce((best, segment) => Math.max(best, segment.durationSeconds ?? 0), 0);
    return {
      summary: segments.length ? `保持片段 ${segments.length} 段 | 最长 ${bestHoldSeconds.toFixed(1)} s` : "等待进入保持",
      points: [],
      segments,
      durationMs,
    };
  }

  const repEvents = listRepEvents(store);
  const points = repEvents.map((event, index) => ({
    atMs: event.atMs,
    index: index + 1,
  }));

  const lastIntervalSeconds = repEvents.length >= 2
    ? (repEvents[repEvents.length - 1].atMs - repEvents[repEvents.length - 2].atMs) / 1000
    : null;

  return {
    summary: repEvents.length
      ? `累计 ${repEvents.length} 次 | 最近间隔 ${lastIntervalSeconds ? `${lastIntervalSeconds.toFixed(2)} s` : "待形成"}`
      : "等待首次计数",
    points,
    segments: [],
    durationMs,
  };
}
