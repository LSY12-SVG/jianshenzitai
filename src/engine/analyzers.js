import { createCalibrationState, getCalibrationStatus, resetCalibrationState, updateCalibrationState } from "./calibration.js";
import { createEventStore, finishHoldEvent, getEventStoreSummary, getRecentCadenceRpm, pushRepEvent, resetEventStore, startHoldEvent } from "./events.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value, min, max) {
  if (value === null || value === undefined || Number.isNaN(value) || max <= min) {
    return 0;
  }

  return clamp01((value - min) / (max - min));
}

function normalizeInverse(value, min, max) {
  return 1 - normalize(value, min, max);
}

function weightedAverage(pairs) {
  const valid = pairs.filter((pair) => pair.value !== null && pair.value !== undefined && !Number.isNaN(pair.value));

  if (!valid.length) {
    return 0;
  }

  const totalWeight = valid.reduce((sum, pair) => sum + pair.weight, 0);
  return valid.reduce((sum, pair) => sum + (pair.value * pair.weight), 0) / totalWeight;
}

function formatCount(count) {
  return `${count} 次`;
}

function formatSeconds(seconds) {
  return `${seconds.toFixed(1)} s`;
}

function formatDegrees(value) {
  return value === null || value === undefined ? "-" : `${value.toFixed(1)}°`;
}

function formatNormalized(value) {
  return value === null || value === undefined ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatCadence(rpm) {
  return rpm > 0 ? `${rpm.toFixed(1)} 次/分` : "-";
}

function getRecentAverage(history, key, windowSize = 4) {
  const values = history?.[key] ?? [];

  if (!values.length) {
    return null;
  }

  const recent = values.slice(Math.max(0, values.length - windowSize));
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}

function createDynamicState(initialPhase) {
  return {
    initialPhase,
    phase: initialPhase,
    phaseFrames: 0,
    phasePeakPrimary: null,
    phaseValleyPrimary: null,
    phasePeakSecondary: null,
    phaseValleySecondary: null,
    cyclePeakCompleteness: 0,
    responseLabel: "待触发",
  };
}

function resetDynamicState(state) {
  state.phase = state.initialPhase;
  state.phaseFrames = 0;
  state.phasePeakPrimary = null;
  state.phaseValleyPrimary = null;
  state.phasePeakSecondary = null;
  state.phaseValleySecondary = null;
  state.cyclePeakCompleteness = 0;
  state.responseLabel = "待触发";
}

function updatePhaseTracker(state, primaryValue, secondaryValue) {
  state.phaseFrames += 1;

  if (primaryValue !== null && primaryValue !== undefined) {
    state.phasePeakPrimary = state.phasePeakPrimary === null ? primaryValue : Math.max(state.phasePeakPrimary, primaryValue);
    state.phaseValleyPrimary = state.phaseValleyPrimary === null ? primaryValue : Math.min(state.phaseValleyPrimary, primaryValue);
  }

  if (secondaryValue !== null && secondaryValue !== undefined) {
    state.phasePeakSecondary = state.phasePeakSecondary === null ? secondaryValue : Math.max(state.phasePeakSecondary, secondaryValue);
    state.phaseValleySecondary = state.phaseValleySecondary === null ? secondaryValue : Math.min(state.phaseValleySecondary, secondaryValue);
  }
}

function changeDynamicPhase(state, phase, label, primaryValue = null, secondaryValue = null) {
  state.phase = phase;
  state.responseLabel = label;
  state.phaseFrames = 0;
  state.phasePeakPrimary = primaryValue;
  state.phaseValleyPrimary = primaryValue;
  state.phasePeakSecondary = secondaryValue;
  state.phaseValleySecondary = secondaryValue;
}

function currentCount(events, exerciseKey) {
  return getEventStoreSummary(events, exerciseKey, 0, 0).count;
}

function buildCommonResult(exerciseMeta, status, progress, rate, phase, ruleNote, debugMetrics, eventStore, calibration, now, extra = {}) {
  return {
    label: exerciseMeta.label,
    status: calibration.completed ? status : getCalibrationStatus(calibration, now),
    progress,
    completeness: rate,
    rate: phase,
    phase: extra.phaseSummary ?? "事件流待建立",
    ruleNote,
    debugMetrics,
    eventStore,
    calibrationStatus: getCalibrationStatus(calibration, now),
    ...extra,
  };
}

export function createExerciseAnalysisEngine(exerciseKey, exerciseMeta) {
  const calibration = createCalibrationState();
  const events = createEventStore();
  const dynamic = createDynamicState(exerciseKey === "curl" ? "down" : "up");
  const runtime = {
    lastRepAtMs: 0,
  };
  const plank = {
    holding: false,
    holdStartedAt: 0,
    currentHoldSeconds: 0,
    bestHoldSeconds: 0,
    responseLabel: "待稳定",
  };

  function reset(nextExerciseKey = exerciseKey, nextMeta = exerciseMeta) {
    exerciseKey = nextExerciseKey;
    exerciseMeta = nextMeta;
    resetCalibrationState(calibration);
    resetEventStore(events);
    resetDynamicState(dynamic);
    runtime.lastRepAtMs = 0;
    plank.holding = false;
    plank.holdStartedAt = 0;
    plank.currentHoldSeconds = 0;
    plank.bestHoldSeconds = 0;
    plank.responseLabel = "待稳定";
  }

  function analyzeSquat(features, now) {
    const thresholds = calibration.profile;
    const frameCompleteness = weightedAverage([
      { value: normalize(features.hipTravel, thresholds.squatTravelThreshold * 0.6, thresholds.squatTravelThreshold * 2.2), weight: 0.4 },
      { value: normalize(features.kneeAngleRange, 20, 75), weight: 0.4 },
      { value: normalizeInverse(features.shoulderTravel, 0.04, 0.16), weight: 0.2 },
    ]);
    dynamic.cyclePeakCompleteness = Math.max(dynamic.cyclePeakCompleteness, frameCompleteness);

    if (
      dynamic.phase === "up"
      && features.kneeAngle !== null
      && features.kneeAngle < 120
      && features.hipTrend > 0.002
      && features.kneeAngleTrend < -0.8
    ) {
      dynamic.phase = "down";
      dynamic.responseLabel = "下蹲响应";
    } else if (
      dynamic.phase === "down"
      && features.kneeAngle !== null
      && features.kneeAngle > 155
      && features.hipTrend < -0.0018
      && features.kneeAngleTrend > 0.8
      && features.kneeAngleRange > 35
      && features.hipTravel > thresholds.squatTravelThreshold
    ) {
      pushRepEvent(events, now, { phase: "up", completeness: dynamic.cyclePeakCompleteness });
      dynamic.cyclePeakCompleteness = 0;
      dynamic.phase = "up";
      dynamic.responseLabel = "起身完成";
    } else {
      dynamic.responseLabel = dynamic.phase === "down" ? "底部缓冲" : "准备下蹲";
    }

    return buildCommonResult(
      exerciseMeta,
      `按${exerciseMeta.label}规则分析中`,
      formatCount(currentCount(events, exerciseKey)),
      formatCadence(getRecentCadenceRpm(events)),
      dynamic.phase === "down" ? "下蹲阶段" : "站立阶段",
      exerciseMeta.ruleNote,
      [
        { label: "膝角均值", value: formatDegrees(features.kneeAngle) },
        { label: "髋部波动", value: formatNormalized(features.hipTravel) },
        { label: "肩部波动", value: formatNormalized(features.shoulderTravel) },
        { label: "响应判定", value: dynamic.responseLabel },
      ],
      events,
      calibration,
      now,
      { phaseSummary: currentCount(events, exerciseKey) ? `已记录 ${currentCount(events, exerciseKey)} 次事件` : "等待首次计数" },
    );
  }

  function analyzePushup(features, now) {
    const smoothedElbowAngle = getRecentAverage(features.history, "elbowAngle") ?? features.elbowAngle;
    const smoothedShoulderY = getRecentAverage(features.history, "shoulderCenterY") ?? features.shoulderCenter?.y ?? null;
    updatePhaseTracker(dynamic, smoothedElbowAngle, smoothedShoulderY);
    const pushupShoulderThreshold = calibration.profile.pushupShoulderTravelThreshold;
    const minRepIntervalMs = 330;

    const elbowDropFromPeak = dynamic.phasePeakPrimary !== null && smoothedElbowAngle !== null
      ? dynamic.phasePeakPrimary - smoothedElbowAngle
      : 0;
    const elbowRiseFromValley = dynamic.phaseValleyPrimary !== null && smoothedElbowAngle !== null
      ? smoothedElbowAngle - dynamic.phaseValleyPrimary
      : 0;
    const shoulderDrop = dynamic.phaseValleySecondary !== null && smoothedShoulderY !== null
      ? smoothedShoulderY - dynamic.phaseValleySecondary
      : 0;
    const shoulderLift = dynamic.phasePeakSecondary !== null && smoothedShoulderY !== null
      ? dynamic.phasePeakSecondary - smoothedShoulderY
      : 0;
    const bodyHorizontalOk = features.bodyHorizontalDelta === null || features.bodyHorizontalDelta < 0.24;
    const bodyLineOk = features.bodyLineAngle !== null && features.bodyLineAngle > 132;
    const enoughDownDrive = (
      shoulderDrop > (pushupShoulderThreshold * 0.35)
      || features.shoulderTravel > (pushupShoulderThreshold * 1.2)
      || features.centerTravel > 0.015
      || features.shoulderTrend > 0.0014
      || features.centerTrend > 0.0014
    );
    const enoughUpDrive = (
      shoulderLift > (pushupShoulderThreshold * 0.16)
      || features.shoulderTravel > (pushupShoulderThreshold * 0.72)
      || features.centerTravel > 0.011
      || features.shoulderTrend < -0.001
      || features.centerTrend < -0.001
    );
    const completedTopRange = smoothedElbowAngle !== null && (
      (smoothedElbowAngle > 112 && elbowRiseFromValley > 7)
      || elbowRiseFromValley > 13
    );

    if (
      dynamic.phase === "up"
      && smoothedElbowAngle !== null
      && smoothedElbowAngle < 148
      && elbowDropFromPeak > 8
      && enoughDownDrive
      && bodyLineOk
      && bodyHorizontalOk
      && dynamic.phaseFrames >= 1
    ) {
      changeDynamicPhase(dynamic, "down", "下压响应", smoothedElbowAngle, smoothedShoulderY);
    } else if (
      dynamic.phase === "down"
      && smoothedElbowAngle !== null
      && completedTopRange
      && enoughUpDrive
      && bodyHorizontalOk
      && dynamic.phaseFrames >= 2
      && (now - runtime.lastRepAtMs) >= minRepIntervalMs
    ) {
      pushRepEvent(events, now, { phase: "up" });
      runtime.lastRepAtMs = now;
      changeDynamicPhase(dynamic, "up", "撑起完成", smoothedElbowAngle, smoothedShoulderY);
    } else {
      dynamic.responseLabel = dynamic.phase === "down" ? "底部发力" : "准备下压";
    }

    return buildCommonResult(
      exerciseMeta,
      `按${exerciseMeta.label}规则分析中`,
      formatCount(currentCount(events, exerciseKey)),
      formatCadence(getRecentCadenceRpm(events)),
      dynamic.phase === "down" ? "下压阶段" : "撑起阶段",
      exerciseMeta.ruleNote,
      [
        { label: "肘角", value: formatDegrees(features.elbowAngle) },
        { label: "躯干直线", value: formatDegrees(features.bodyLineAngle) },
        { label: "肩部升降", value: formatNormalized(Math.max(shoulderDrop, shoulderLift)) },
        { label: "响应判定", value: dynamic.responseLabel },
      ],
      events,
      calibration,
      now,
      { phaseSummary: currentCount(events, exerciseKey) ? `已记录 ${currentCount(events, exerciseKey)} 次事件` : "等待首次计数" },
    );
  }

  function analyzePlank(features, now) {
    const holdingNow = (
      features.bodyLineAngle !== null
      && features.bodyLineAngle > 160
      && features.bodyHorizontalDelta !== null
      && features.bodyHorizontalDelta < Math.max(0.16, calibration.profile.uprightDelta * 0.85)
      && features.hipTravel < 0.035
      && features.shoulderTravel < 0.035
      && features.wristTravelY < calibration.profile.wristTravelThreshold * 1.4
      && features.elbowAngleRange < 32
      && features.sequenceFrames >= 16
    );

    if (holdingNow) {
      if (!plank.holding) {
        plank.holding = true;
        plank.holdStartedAt = now;
        plank.responseLabel = "进入保持";
        startHoldEvent(events, now, { phase: "holding" });
      }

      plank.currentHoldSeconds = (now - plank.holdStartedAt) / 1000;
      plank.bestHoldSeconds = Math.max(plank.bestHoldSeconds, plank.currentHoldSeconds);
    } else {
      if (plank.holding) {
        const ended = finishHoldEvent(events, now, { phase: "idle" });
        plank.bestHoldSeconds = Math.max(plank.bestHoldSeconds, ended?.durationSeconds ?? 0);
      }
      plank.holding = false;
      plank.holdStartedAt = 0;
      plank.currentHoldSeconds = 0;
      plank.responseLabel = features.stabilityScore > 0.6 ? "姿态调整" : "重新进入";
    }

    return buildCommonResult(
      exerciseMeta,
      `按${exerciseMeta.label}规则分析中`,
      `${currentCount(events, exerciseKey)} 组 / ${formatSeconds(plank.currentHoldSeconds)}`,
      plank.currentHoldSeconds > 0 ? formatSeconds(plank.currentHoldSeconds) : "-",
      plank.holding ? "保持中" : "待稳定",
      exerciseMeta.ruleNote,
      [
        { label: "肩髋踝夹角", value: formatDegrees(features.bodyLineAngle) },
        { label: "髋部波动", value: formatNormalized(features.hipTravel) },
        { label: "肩部波动", value: formatNormalized(features.shoulderTravel) },
        { label: "响应判定", value: plank.responseLabel },
      ],
      events,
      calibration,
      now,
      { liveHoldSeconds: plank.currentHoldSeconds, phaseSummary: currentCount(events, exerciseKey) ? `已记录 ${currentCount(events, exerciseKey)} 段保持` : "等待首次保持" },
    );
  }

  function analyzeCurl(features, now) {
    const smoothedElbowAngle = getRecentAverage(features.history, "elbowAngle") ?? features.elbowAngle;
    const smoothedWristY = getRecentAverage(features.history, "wristY") ?? features.sideWrist?.y ?? null;
    updatePhaseTracker(dynamic, smoothedElbowAngle, smoothedWristY);

    const elbowDropFromPeak = dynamic.phasePeakPrimary !== null && smoothedElbowAngle !== null
      ? dynamic.phasePeakPrimary - smoothedElbowAngle
      : 0;
    const elbowRiseFromValley = dynamic.phaseValleyPrimary !== null && smoothedElbowAngle !== null
      ? smoothedElbowAngle - dynamic.phaseValleyPrimary
      : 0;
    const wristLift = dynamic.phasePeakSecondary !== null && smoothedWristY !== null
      ? dynamic.phasePeakSecondary - smoothedWristY
      : 0;
    const wristDrop = dynamic.phaseValleySecondary !== null && smoothedWristY !== null
      ? smoothedWristY - dynamic.phaseValleySecondary
      : 0;
    const elbowDrift = features.elbowDriftX + features.elbowDriftY;
    const wristAssistUp = wristLift > 0.012 || features.wristTravelY > calibration.profile.wristTravelThreshold || features.wristYTrend < -0.002;
    const wristAssistDown = wristDrop > 0.012 || features.wristTravelY > calibration.profile.wristTravelThreshold || features.wristYTrend > 0.002;
    const contractedEnough = smoothedElbowAngle !== null && (smoothedElbowAngle < 134 || elbowDropFromPeak > 24);
    const extendedEnough = smoothedElbowAngle !== null && (smoothedElbowAngle > 136 || elbowRiseFromValley > 24);
    const curlInDropThreshold = wristAssistUp ? 14 : 18;
    const curlOutRiseThreshold = wristAssistDown ? 14 : 18;

    if (
      dynamic.phase === "down"
      && smoothedElbowAngle !== null
      && contractedEnough
      && elbowDropFromPeak > curlInDropThreshold
      && elbowDrift < calibration.profile.elbowDriftThreshold
      && (features.bodyHorizontalDelta === null || features.bodyHorizontalDelta > 0.12)
      && dynamic.phaseFrames >= 3
    ) {
      changeDynamicPhase(dynamic, "up", "弯举响应", smoothedElbowAngle, smoothedWristY);
    } else if (
      dynamic.phase === "up"
      && smoothedElbowAngle !== null
      && extendedEnough
      && elbowRiseFromValley > curlOutRiseThreshold
      && elbowDrift < calibration.profile.elbowDriftThreshold
      && dynamic.phaseFrames >= 3
    ) {
      pushRepEvent(events, now, { phase: "down" });
      changeDynamicPhase(dynamic, "down", "下放完成", smoothedElbowAngle, smoothedWristY);
    } else {
      dynamic.responseLabel = dynamic.phase === "up" ? "顶点停顿" : "准备弯举";
    }

    return buildCommonResult(
      exerciseMeta,
      `按${exerciseMeta.label}规则分析中`,
      formatCount(currentCount(events, exerciseKey)),
      formatCadence(getRecentCadenceRpm(events)),
      dynamic.phase === "up" ? "弯举阶段" : "下放阶段",
      exerciseMeta.ruleNote,
      [
        { label: "肘角", value: formatDegrees(features.elbowAngle) },
        { label: "腕部位移", value: formatNormalized(Math.max(wristLift, wristDrop)) },
        { label: "肘部漂移", value: formatNormalized(elbowDrift) },
        { label: "响应判定", value: dynamic.responseLabel },
      ],
      events,
      calibration,
      now,
      { phaseSummary: currentCount(events, exerciseKey) ? `已记录 ${currentCount(events, exerciseKey)} 次事件` : "等待首次计数" },
    );
  }

  function analyzeFrame(features, now) {
    updateCalibrationState(calibration, features, now);

    switch (exerciseKey) {
      case "squat":
        return analyzeSquat(features, now);
      case "pushup":
        return analyzePushup(features, now);
      case "plank":
        return analyzePlank(features, now);
      case "curl":
        return analyzeCurl(features, now);
      default:
        return buildCommonResult(
          exerciseMeta,
          "未选择动作",
          "-",
          "-",
          "待机",
          exerciseMeta.ruleNote,
          [
            { label: "分析目标", value: exerciseMeta.label },
            { label: "动作次数", value: "-" },
            { label: "时间频率", value: "-" },
            { label: "规则状态", value: "待选择" },
          ],
          events,
          calibration,
          now,
        );
    }
  }

  function handleMissing(now) {
    if (exerciseKey === "plank" && plank.holding) {
      const ended = finishHoldEvent(events, now, { phase: "idle", reason: "missing_pose" });
      plank.bestHoldSeconds = Math.max(plank.bestHoldSeconds, ended?.durationSeconds ?? 0);
      plank.holding = false;
      plank.holdStartedAt = 0;
      plank.currentHoldSeconds = 0;
    }
  }

  function getSummary(now) {
    return getEventStoreSummary(events, exerciseKey, now, plank.currentHoldSeconds);
  }

  function getEventStore() {
    return events;
  }

  return {
    reset,
    analyzeFrame,
    handleMissing,
    getSummary,
    getEventStore,
    getCalibrationStatus: () => getCalibrationStatus(calibration, performance.now()),
  };
}
