function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distance(a, b) {
  if (!a || !b) {
    return null;
  }

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}

export function createCalibrationState(durationMs = 1600) {
  return {
    durationMs,
    startedAtMs: 0,
    completed: false,
    samples: {
      torsoHeight: [],
      upperArmLength: [],
      forearmLength: [],
      uprightDelta: [],
    },
    profile: {
      torsoHeight: 0.22,
      upperArmLength: 0.11,
      forearmLength: 0.1,
      uprightDelta: 0.22,
      squatTravelThreshold: 0.05,
      pushupShoulderTravelThreshold: 0.012,
      wristTravelThreshold: 0.05,
      elbowDriftThreshold: 0.24,
    },
  };
}

export function resetCalibrationState(state) {
  state.startedAtMs = 0;
  state.completed = false;
  state.samples = {
    torsoHeight: [],
    upperArmLength: [],
    forearmLength: [],
    uprightDelta: [],
  };
  state.profile = {
    torsoHeight: 0.22,
    upperArmLength: 0.11,
    forearmLength: 0.1,
    uprightDelta: 0.22,
    squatTravelThreshold: 0.05,
    pushupShoulderTravelThreshold: 0.012,
    wristTravelThreshold: 0.05,
    elbowDriftThreshold: 0.24,
  };
}

export function updateCalibrationState(state, features, now) {
  if (!state.startedAtMs) {
    state.startedAtMs = now;
  }

  const torsoHeight = distance(features.sideShoulder, features.sideHip);
  const upperArmLength = distance(features.sideShoulder, features.sideElbow);
  const forearmLength = distance(features.sideElbow, features.sideWrist);

  if (torsoHeight) {
    state.samples.torsoHeight.push(torsoHeight);
  }
  if (upperArmLength) {
    state.samples.upperArmLength.push(upperArmLength);
  }
  if (forearmLength) {
    state.samples.forearmLength.push(forearmLength);
  }
  if (features.bodyHorizontalDelta !== null && features.bodyHorizontalDelta !== undefined) {
    state.samples.uprightDelta.push(features.bodyHorizontalDelta);
  }

  if (state.completed || (now - state.startedAtMs) < state.durationMs) {
    return state.profile;
  }

  const torso = median(state.samples.torsoHeight) ?? state.profile.torsoHeight;
  const upperArm = median(state.samples.upperArmLength) ?? state.profile.upperArmLength;
  const forearm = median(state.samples.forearmLength) ?? state.profile.forearmLength;
  const upright = median(state.samples.uprightDelta) ?? state.profile.uprightDelta;

  state.profile = {
    torsoHeight: torso,
    upperArmLength: upperArm,
    forearmLength: forearm,
    uprightDelta: upright,
    squatTravelThreshold: Math.max(0.035, torso * 0.24),
    pushupShoulderTravelThreshold: Math.max(0.008, torso * 0.055),
    wristTravelThreshold: Math.max(0.038, forearm * 0.48),
    elbowDriftThreshold: Math.max(0.18, upperArm * 1.8),
  };
  state.completed = true;
  return state.profile;
}

export function getCalibrationStatus(state, now) {
  if (!state.startedAtMs) {
    return "等待校准";
  }

  if (state.completed) {
    return "已完成基线校准";
  }

  const elapsedSeconds = (now - state.startedAtMs) / 1000;
  return `基线校准中 ${elapsedSeconds.toFixed(1)} / ${(state.durationMs / 1000).toFixed(1)} s`;
}
