import "./style.css";
import QRCode from "qrcode";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createExerciseAnalysisEngine } from "./engine/analyzers.js";
import { buildTimelineModel } from "./engine/timeline.js";
import { createRtcPeer } from "./rtc/peer-connection.js";
import { createSignalingClient } from "./rtc/signaling-client.js";
import { buildJoinUrl, createRtcSessionState, resolvePublicOrigin } from "./rtc/session-state.js";

const VISION_WASM_URL = "/wasm";

const MODEL_URLS = {
  lite: "/models/pose_landmarker_lite.task",
  full: "/models/pose_landmarker_full.task",
  heavy: "/models/pose_landmarker_heavy.task",
};

const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const EXERCISES = {
  squat: {
    label: "深蹲",
    idleProgress: "0 次",
    ruleNote: "自动深蹲规则：重心和髋部出现明显上下运动，膝角收缩再伸展，肩部相对稳定，且站姿更接近正面或半侧面。",
  },
  pushup: {
    label: "俯卧撑",
    idleProgress: "0 次",
    ruleNote: "自动俯卧撑规则：身体接近水平且基本成直线，肘角周期性收缩/伸展，肩部高度同步起伏，侧身视角优先。",
  },
  plank: {
    label: "平板支撑",
    idleProgress: "0.0 s",
    ruleNote: "自动平板支撑规则：肩髋踝持续接近共线，躯干和支撑点波动较小，侧身视角优先。",
  },
  curl: {
    label: "哑铃弯举",
    idleProgress: "0 次",
    ruleNote: "自动弯举规则：上臂漂移较小，肘角周期性收缩/伸展，腕部轨迹明显上下移动，站姿更接近侧身。",
  },
};

const SINGLE_RULE_NOTE = "单动作分析模式：选择一个动作后，系统只按该动作规则做时序分析，并将动作次数与时间频率轴作为主要反馈。";

const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32],
  [27, 31], [28, 32],
];

const HISTORY_LIMIT = 72;
const AUTO_ENTER_THRESHOLD = 0.62;
const AUTO_KEEP_THRESHOLD = 0.48;
const AUTO_SWITCH_MARGIN = 0.1;
const AUTO_STABLE_FRAMES = 4;
const AUTO_ENTER_THRESHOLDS = {
  squat: 0.62,
  pushup: 0.56,
  plank: 0.58,
  curl: 0.52,
};
const AUTO_KEEP_THRESHOLDS = {
  squat: 0.48,
  pushup: 0.44,
  plank: 0.46,
  curl: 0.4,
};
const AUTO_MIN_LEAD_THRESHOLDS = {
  squat: 0.06,
  pushup: 0.06,
  plank: 0.05,
  curl: 0.02,
};
const ACTIVE_HISTORY_LIMIT = 48;
const MISSING_POSE_GRACE_FRAMES = 6;
const COMPLETENESS_STALE_MS = 2400;
const CADENCE_STALE_MS = 4200;
const CURL_SCOUT_SCORE_THRESHOLD = 0.42;
const CURL_SCOUT_IDLE_FRAMES = 12;

const ui = {
  video: document.querySelector("#webcam"),
  canvas: document.querySelector("#overlay"),
  cameraStatus: document.querySelector("#camera-status"),
  renderFps: document.querySelector("#render-fps"),
  inferenceMs: document.querySelector("#inference-ms"),
  poseCount: document.querySelector("#pose-count"),
  landmarkCount: document.querySelector("#landmark-count"),
  videoResolution: document.querySelector("#video-resolution"),
  delegateLabel: document.querySelector("#delegate-label"),
  logBox: document.querySelector("#log-box"),
  sourceSelect: document.querySelector("#source-select"),
  exerciseSelect: document.querySelector("#exercise-select"),
  modelSelect: document.querySelector("#model-select"),
  detectionThreshold: document.querySelector("#detection-threshold"),
  detectionThresholdValue: document.querySelector("#detection-threshold-value"),
  trackingThreshold: document.querySelector("#tracking-threshold"),
  trackingThresholdValue: document.querySelector("#tracking-threshold-value"),
  mirrorToggle: document.querySelector("#mirror-toggle"),
  labelsToggle: document.querySelector("#labels-toggle"),
  startButton: document.querySelector("#start-button"),
  stopButton: document.querySelector("#stop-button"),
  reloadButton: document.querySelector("#reload-button"),
  resetActionButton: document.querySelector("#reset-action-button"),
  exerciseName: document.querySelector("#exercise-name"),
  actionStatus: document.querySelector("#action-status"),
  actionProgress: document.querySelector("#action-progress"),
  actionCompleteness: document.querySelector("#action-completeness"),
  actionRate: document.querySelector("#action-rate"),
  actionPhase: document.querySelector("#action-phase"),
  focusCountLabel: document.querySelector("#focus-count-label"),
  focusCountValue: document.querySelector("#focus-count-value"),
  focusCountMeta: document.querySelector("#focus-count-meta"),
  timelineSummary: document.querySelector("#timeline-summary"),
  timelineAxis: document.querySelector("#timeline-axis"),
  ruleNote: document.querySelector("#rule-note"),
  debugMetricLabels: [
    document.querySelector("#debug-1-label"),
    document.querySelector("#debug-2-label"),
    document.querySelector("#debug-3-label"),
    document.querySelector("#debug-4-label"),
  ],
  debugMetricValues: [
    document.querySelector("#debug-1-value"),
    document.querySelector("#debug-2-value"),
    document.querySelector("#debug-3-value"),
    document.querySelector("#debug-4-value"),
  ],
  temporalSequence: document.querySelector("#temporal-sequence"),
  temporalAngles: document.querySelector("#temporal-angles"),
  temporalVelocity: document.querySelector("#temporal-velocity"),
  temporalCenter: document.querySelector("#temporal-center"),
  temporalWrist: document.querySelector("#temporal-wrist"),
  temporalOrientation: document.querySelector("#temporal-orientation"),
  temporalDirection: document.querySelector("#temporal-direction"),
  temporalEquipment: document.querySelector("#temporal-equipment"),
  remoteSessionCard: document.querySelector("#remote-session-card"),
  remoteSessionStatus: document.querySelector("#remote-session-status"),
  sessionCode: document.querySelector("#session-code"),
  peerStatus: document.querySelector("#peer-status"),
  sessionQr: document.querySelector("#session-qr"),
  sessionLink: document.querySelector("#session-link"),
  copySessionLinkButton: document.querySelector("#copy-session-link-button"),
  remoteSessionTip: document.querySelector("#remote-session-tip"),
};

const canvasContext = ui.canvas.getContext("2d");

const state = {
  poseLandmarker: null,
  stream: null,
  streamKind: null,
  stopTracksOnRelease: false,
  vision: null,
  animationFrameId: 0,
  lastVideoTime: -1,
  renderFrames: 0,
  lastFpsSampleTime: performance.now(),
  smoothedInferenceMs: 0,
  usingDelegate: "GPU",
  cameraRunning: false,
  isReloading: false,
  sourceMode: "local",
  selectedExercise: "squat",
  analysisEngine: createExerciseAnalysisEngine("squat", EXERCISES.squat),
  analysisStartedAt: 0,
  temporal: createTemporalState(),
  activeTemporal: createActiveTemporalState(),
  curlScoutTemporal: createActiveTemporalState("curl"),
  autoDetection: createAutoDetectionState(),
  recognition: createRecognitionState(),
  missingPoseFrames: 0,
  curlScoutRecognition: createDynamicExerciseState("down"),
  curlScoutIdleFrames: 0,
  remoteSession: createRtcSessionState("analyzer"),
  signalingClient: null,
  peerController: null,
};

function createTemporalState(historyLimit = HISTORY_LIMIT, exerciseKey = null) {
  return {
    frameCount: 0,
    lastTimestamp: 0,
    lastPoints: null,
    history: {},
    snapshot: null,
    historyLimit,
    exerciseKey,
  };
}

function createActiveTemporalState(exerciseKey = null) {
  return createTemporalState(ACTIVE_HISTORY_LIMIT, exerciseKey);
}

function createAutoDetectionState() {
  return {
    activeExercise: null,
    candidateExercise: null,
    candidateFrames: 0,
    confidence: 0,
    scores: {
      squat: 0,
      pushup: 0,
      plank: 0,
      curl: 0,
    },
  };
}

function createRecognitionState() {
  return {
    squat: createDynamicExerciseState("up"),
    pushup: createDynamicExerciseState("up"),
    plank: {
      holding: false,
      holdStartedAt: 0,
      currentHoldSeconds: 0,
      bestHoldSeconds: 0,
      holdCount: 0,
      holdSegments: [],
      stabilityScore: 0,
      responseLabel: "待稳定",
      phase: "idle",
    },
    curl: createDynamicExerciseState("down"),
  };
}

function createDynamicExerciseState(initialPhase) {
  return {
    reps: 0,
    initialPhase,
    phase: initialPhase,
    phaseFrames: 0,
    phasePeakPrimary: null,
    phaseValleyPrimary: null,
    phasePeakSecondary: null,
    phaseValleySecondary: null,
    cyclePeakCompleteness: 0,
    lastRepCompleteness: 0,
    lastRepAt: 0,
    lastMotionAt: 0,
    repTimes: [],
    repHistory: [],
    cadenceRpm: 0,
    responseLabel: "待触发",
  };
}

function cloneHistory(history) {
  const clonedHistory = {};

  for (const [key, values] of Object.entries(history)) {
    clonedHistory[key] = Array.isArray(values) ? [...values] : values;
  }

  return clonedHistory;
}

function cloneTemporalState(source, historyLimit = source.historyLimit, exerciseKey = source.exerciseKey) {
  return {
    frameCount: source.frameCount,
    lastTimestamp: source.lastTimestamp,
    lastPoints: source.lastPoints ? { ...source.lastPoints } : null,
    history: cloneHistory(source.history),
    snapshot: source.snapshot ? { ...source.snapshot } : null,
    historyLimit,
    exerciseKey,
  };
}

function cloneDynamicRecognitionState(source) {
  return {
    reps: source.reps,
    initialPhase: source.initialPhase,
    phase: source.phase,
    phaseFrames: source.phaseFrames,
    phasePeakPrimary: source.phasePeakPrimary,
    phaseValleyPrimary: source.phaseValleyPrimary,
    phasePeakSecondary: source.phasePeakSecondary,
    phaseValleySecondary: source.phaseValleySecondary,
    cyclePeakCompleteness: source.cyclePeakCompleteness,
    lastRepCompleteness: source.lastRepCompleteness,
    lastRepAt: source.lastRepAt,
    lastMotionAt: source.lastMotionAt,
    repTimes: [...source.repTimes],
    repHistory: [...source.repHistory],
    cadenceRpm: source.cadenceRpm,
    responseLabel: source.responseLabel,
  };
}

function setLog(message) {
  ui.logBox.textContent = message;
}

function setCameraStatus(message) {
  ui.cameraStatus.textContent = message;
}

function setSourceMode(mode) {
  state.sourceMode = mode === "remote" ? "remote" : "local";
  ui.sourceSelect.value = state.sourceMode;
  ui.remoteSessionCard.hidden = state.sourceMode !== "remote";
  ui.startButton.textContent = state.sourceMode === "remote" ? "创建手机会话" : "启动摄像头";
  ui.copySessionLinkButton.disabled = !state.remoteSession.joinUrl;
}

function resetRemoteSessionState() {
  state.remoteSession = createRtcSessionState("analyzer");
}

function renderRemoteSessionState() {
  ui.remoteSessionCard.hidden = state.sourceMode !== "remote";
  ui.remoteSessionStatus.textContent = state.remoteSession.signalingState === "connected"
    ? "信令已连通"
    : state.remoteSession.lastError || "未创建";
  ui.sessionCode.textContent = state.remoteSession.sessionId || "-";
  ui.peerStatus.textContent = remotePeerStatusLabel();
  ui.sessionLink.value = state.remoteSession.joinUrl || "";
  ui.sessionQr.src = state.remoteSession.qrDataUrl || "";
  ui.sessionQr.hidden = !state.remoteSession.qrDataUrl;
  ui.copySessionLinkButton.disabled = !state.remoteSession.joinUrl;
  ui.remoteSessionTip.textContent = remoteSessionTipText();
}

function remotePeerStatusLabel() {
  if (state.remoteSession.connectionState === "connected") {
    return "手机画面分析中";
  }

  if (state.remoteSession.peerState === "joined") {
    return "手机已加入，等待视频流";
  }

  if (state.remoteSession.signalingState === "connected") {
    return "等待手机扫码加入";
  }

  return "等待创建";
}

function remoteSessionTipText() {
  if (state.remoteSession.lastError) {
    return state.remoteSession.lastError;
  }

  if (!state.remoteSession.joinUrl) {
    return "切换到手机接入模式后，点击“创建手机会话”，用手机扫码打开采集页。";
  }

  if (state.remoteSession.connectionState === "connected") {
    return "手机视频流已接入当前页面，电脑端正在沿用现有姿态算法链路做实时分析。";
  }

  if (state.remoteSession.peerState === "joined") {
    return "手机端已进入会话，正在协商 WebRTC 视频流。";
  }

  return "二维码和链接已生成，手机打开后会自动加入当前分析会话。";
}

function updateThresholdLabels() {
  ui.detectionThresholdValue.textContent = Number(ui.detectionThreshold.value).toFixed(2);
  ui.trackingThresholdValue.textContent = Number(ui.trackingThreshold.value).toFixed(2);
}

function resizeCanvasToVideo() {
  const width = ui.video.videoWidth;
  const height = ui.video.videoHeight;

  if (!width || !height) {
    return;
  }

  if (ui.canvas.width !== width || ui.canvas.height !== height) {
    ui.canvas.width = width;
    ui.canvas.height = height;
    ui.videoResolution.textContent = `${width} x ${height}`;
  }
}

function isLandmarkVisible(landmark) {
  const visibility = landmark.visibility ?? 1;
  const presence = landmark.presence ?? 1;
  return visibility >= 0.35 && presence >= 0.35;
}

function getVisibleLandmark(landmarks, index) {
  const landmark = landmarks[index];
  return landmark && isLandmarkVisible(landmark) ? landmark : null;
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averagePoints(points) {
  const visiblePoints = points.filter(Boolean);

  if (!visiblePoints.length) {
    return null;
  }

  return {
    x: average(visiblePoints.map((point) => point.x)),
    y: average(visiblePoints.map((point) => point.y)),
    z: average(visiblePoints.map((point) => point.z ?? 0)),
  };
}

function angleBetween(a, b, c) {
  if (!a || !b || !c) {
    return null;
  }

  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const abLength = Math.hypot(abx, aby);
  const cbLength = Math.hypot(cbx, cby);

  if (!abLength || !cbLength) {
    return null;
  }

  const cosine = Math.min(1, Math.max(-1, ((abx * cbx) + (aby * cby)) / (abLength * cbLength)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function range(values) {
  if (!values.length) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value, min, max) {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  if (max <= min) {
    return 0;
  }

  return clamp01((value - min) / (max - min));
}

function normalizeInverse(value, min, max) {
  return 1 - normalize(value, min, max);
}

function pushHistory(history, key, value, limit = HISTORY_LIMIT) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return;
  }

  if (!history[key]) {
    history[key] = [];
  }

  history[key].push(value);

  if (history[key].length > limit) {
    history[key].shift();
  }
}

function formatCount(count) {
  return `${count} 次`;
}

function formatSeconds(seconds) {
  return `${seconds.toFixed(1)} s`;
}

function formatDegrees(value) {
  return value === null ? "-" : `${value.toFixed(1)}°`;
}

function formatNormalized(value) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatVelocity(value) {
  return value === null ? "-" : `${value.toFixed(2)}/s`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function getSelectedExercise() {
  return state.selectedExercise;
}

function getSelectedExerciseMeta() {
  return EXERCISES[getSelectedExercise()];
}

function visibilityScore(landmarks, indices) {
  return indices.reduce((score, index) => {
    const landmark = landmarks[index];
    if (!landmark) {
      return score;
    }

    return score + (landmark.visibility ?? 1) + (landmark.presence ?? 1);
  }, 0);
}

function chooseDominantSide(landmarks, leftIndices, rightIndices) {
  return visibilityScore(landmarks, leftIndices) >= visibilityScore(landmarks, rightIndices) ? "left" : "right";
}

function getSideIndexes(side) {
  if (side === "left") {
    return {
      shoulder: LANDMARK.LEFT_SHOULDER,
      elbow: LANDMARK.LEFT_ELBOW,
      wrist: LANDMARK.LEFT_WRIST,
      hip: LANDMARK.LEFT_HIP,
      knee: LANDMARK.LEFT_KNEE,
      ankle: LANDMARK.LEFT_ANKLE,
    };
  }

  return {
    shoulder: LANDMARK.RIGHT_SHOULDER,
    elbow: LANDMARK.RIGHT_ELBOW,
    wrist: LANDMARK.RIGHT_WRIST,
    hip: LANDMARK.RIGHT_HIP,
    knee: LANDMARK.RIGHT_KNEE,
    ankle: LANDMARK.RIGHT_ANKLE,
  };
}

function summarizeDirection(velocity, positiveLabel, negativeLabel, threshold) {
  if (velocity === null) {
    return "未知";
  }

  if (velocity > threshold) {
    return positiveLabel;
  }

  if (velocity < -threshold) {
    return negativeLabel;
  }

  return "稳定";
}

function estimateOrientation(leftShoulder, rightShoulder, leftHip, rightHip) {
  const shoulderCenter = averagePoints([leftShoulder, rightShoulder]);
  const hipCenter = averagePoints([leftHip, rightHip]);

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !shoulderCenter || !hipCenter) {
    return {
      key: "unknown",
      label: "未知",
      widthRatio: null,
    };
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const hipWidth = Math.abs(leftHip.x - rightHip.x);
  const torsoHeight = Math.abs(shoulderCenter.y - hipCenter.y);
  const averageWidth = (shoulderWidth + hipWidth) / 2;
  const widthRatio = torsoHeight > 0 ? averageWidth / torsoHeight : 0;
  const shoulderDepthDelta = Math.abs((leftShoulder.z ?? 0) - (rightShoulder.z ?? 0));

  if (widthRatio > 0.72 && shoulderDepthDelta < 0.12) {
    return {
      key: "front",
      label: "正面",
      widthRatio,
    };
  }

  return {
    key: "side",
    label: (leftShoulder.z ?? 0) < (rightShoulder.z ?? 0) ? "左侧身" : "右侧身",
    widthRatio,
  };
}

function renderTemporalSnapshot(snapshot) {
  ui.temporalSequence.textContent = snapshot.sequenceText;
  ui.temporalAngles.textContent = snapshot.angleText;
  ui.temporalVelocity.textContent = snapshot.velocityText;
  ui.temporalCenter.textContent = snapshot.centerText;
  ui.temporalWrist.textContent = snapshot.wristText;
  ui.temporalOrientation.textContent = snapshot.orientationText;
  ui.temporalDirection.textContent = snapshot.directionText;
  ui.temporalEquipment.textContent = snapshot.equipmentText;
}

function renderEmptyTemporalSnapshot() {
  renderTemporalSnapshot({
    sequenceText: "-",
    angleText: "-",
    velocityText: "-",
    centerText: "-",
    wristText: "-",
    orientationText: "-",
    directionText: "-",
    equipmentText: "未启用",
  });
}

function computeTemporalFeatures(landmarks, now, temporal = state.temporal, { renderSnapshot = false } = {}) {
  const leftShoulder = getVisibleLandmark(landmarks, LANDMARK.LEFT_SHOULDER);
  const rightShoulder = getVisibleLandmark(landmarks, LANDMARK.RIGHT_SHOULDER);
  const leftElbow = getVisibleLandmark(landmarks, LANDMARK.LEFT_ELBOW);
  const rightElbow = getVisibleLandmark(landmarks, LANDMARK.RIGHT_ELBOW);
  const leftWrist = getVisibleLandmark(landmarks, LANDMARK.LEFT_WRIST);
  const rightWrist = getVisibleLandmark(landmarks, LANDMARK.RIGHT_WRIST);
  const leftHip = getVisibleLandmark(landmarks, LANDMARK.LEFT_HIP);
  const rightHip = getVisibleLandmark(landmarks, LANDMARK.RIGHT_HIP);
  const leftKnee = getVisibleLandmark(landmarks, LANDMARK.LEFT_KNEE);
  const rightKnee = getVisibleLandmark(landmarks, LANDMARK.RIGHT_KNEE);
  const leftAnkle = getVisibleLandmark(landmarks, LANDMARK.LEFT_ANKLE);
  const rightAnkle = getVisibleLandmark(landmarks, LANDMARK.RIGHT_ANKLE);

  const shoulderCenter = averagePoints([leftShoulder, rightShoulder]);
  const hipCenter = averagePoints([leftHip, rightHip]);
  const bodyCenter = averagePoints([leftShoulder, rightShoulder, leftHip, rightHip]);
  const orientation = estimateOrientation(leftShoulder, rightShoulder, leftHip, rightHip);
  const dominantSide = chooseDominantSide(
    landmarks,
    [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST, LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
    [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST, LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
  );
  const dominantIndexes = getSideIndexes(dominantSide);
  const sideShoulder = getVisibleLandmark(landmarks, dominantIndexes.shoulder);
  const sideElbow = getVisibleLandmark(landmarks, dominantIndexes.elbow);
  const sideWrist = getVisibleLandmark(landmarks, dominantIndexes.wrist);
  const sideHip = getVisibleLandmark(landmarks, dominantIndexes.hip);
  const sideKnee = getVisibleLandmark(landmarks, dominantIndexes.knee);
  const sideAnkle = getVisibleLandmark(landmarks, dominantIndexes.ankle);

  const kneeAngle = average([
    angleBetween(leftHip, leftKnee, leftAnkle),
    angleBetween(rightHip, rightKnee, rightAnkle),
  ].filter((value) => value !== null));
  const hipAngle = average([
    angleBetween(leftShoulder, leftHip, leftKnee),
    angleBetween(rightShoulder, rightHip, rightKnee),
  ].filter((value) => value !== null));
  const elbowAngle = average([
    angleBetween(leftShoulder, leftElbow, leftWrist),
    angleBetween(rightShoulder, rightElbow, rightWrist),
  ].filter((value) => value !== null));
  const shoulderAngle = average([
    angleBetween(leftElbow, leftShoulder, leftHip),
    angleBetween(rightElbow, rightShoulder, rightHip),
  ].filter((value) => value !== null));
  const bodyLineAngle = angleBetween(sideShoulder, sideHip, sideAnkle);
  const bodyHorizontalDelta = sideShoulder && sideAnkle ? Math.abs(sideShoulder.y - sideAnkle.y) : null;

  pushHistory(temporal.history, "bodyCenterY", bodyCenter?.y ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "hipCenterY", hipCenter?.y ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "shoulderCenterY", shoulderCenter?.y ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "wristY", sideWrist?.y ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "wristX", sideWrist?.x ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "elbowY", sideElbow?.y ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "elbowX", sideElbow?.x ?? null, temporal.historyLimit);
  pushHistory(temporal.history, "kneeAngle", kneeAngle, temporal.historyLimit);
  pushHistory(temporal.history, "hipAngle", hipAngle, temporal.historyLimit);
  pushHistory(temporal.history, "elbowAngle", elbowAngle, temporal.historyLimit);
  pushHistory(temporal.history, "shoulderAngle", shoulderAngle, temporal.historyLimit);
  pushHistory(temporal.history, "bodyLineAngle", bodyLineAngle, temporal.historyLimit);

  const dt = temporal.lastTimestamp ? (now - temporal.lastTimestamp) / 1000 : 0;
  let centerVelocityY = null;
  let hipVelocityY = null;
  let shoulderVelocityY = null;
  let wristVelocityY = null;
  let wristVelocityX = null;

  if (dt > 0 && temporal.lastPoints) {
    if (bodyCenter && temporal.lastPoints.bodyCenter) {
      centerVelocityY = (bodyCenter.y - temporal.lastPoints.bodyCenter.y) / dt;
    }

    if (hipCenter && temporal.lastPoints.hipCenter) {
      hipVelocityY = (hipCenter.y - temporal.lastPoints.hipCenter.y) / dt;
    }

    if (shoulderCenter && temporal.lastPoints.shoulderCenter) {
      shoulderVelocityY = (shoulderCenter.y - temporal.lastPoints.shoulderCenter.y) / dt;
    }

    if (sideWrist && temporal.lastPoints.sideWrist) {
      wristVelocityY = (sideWrist.y - temporal.lastPoints.sideWrist.y) / dt;
      wristVelocityX = (sideWrist.x - temporal.lastPoints.sideWrist.x) / dt;
    }
  }

  temporal.lastTimestamp = now;
  temporal.lastPoints = {
    bodyCenter,
    hipCenter,
    shoulderCenter,
    sideWrist,
  };
  temporal.frameCount += 1;

  const centerTravel = range(temporal.history.bodyCenterY ?? []);
  const hipTravel = range(temporal.history.hipCenterY ?? []);
  const shoulderTravel = range(temporal.history.shoulderCenterY ?? []);
  const wristTravelY = range(temporal.history.wristY ?? []);
  const wristTravelX = range(temporal.history.wristX ?? []);
  const elbowDriftY = range(temporal.history.elbowY ?? []);
  const elbowDriftX = range(temporal.history.elbowX ?? []);
  const kneeAngleRange = range(temporal.history.kneeAngle ?? []);
  const hipAngleRange = range(temporal.history.hipAngle ?? []);
  const elbowAngleRange = range(temporal.history.elbowAngle ?? []);
  const bodyLineAngleRange = range(temporal.history.bodyLineAngle ?? []);
  const hipTrend = getSeriesSlope(getRecentValues(temporal.history, "hipCenterY"));
  const shoulderTrend = getSeriesSlope(getRecentValues(temporal.history, "shoulderCenterY"));
  const kneeAngleTrend = getSeriesSlope(getRecentValues(temporal.history, "kneeAngle"));
  const elbowAngleTrend = getSeriesSlope(getRecentValues(temporal.history, "elbowAngle"));
  const wristYTrend = getSeriesSlope(getRecentValues(temporal.history, "wristY"));
  const wristXTrend = getSeriesSlope(getRecentValues(temporal.history, "wristX"));
  const centerTrend = getSeriesSlope(getRecentValues(temporal.history, "bodyCenterY"));
  const stabilityScore = weightedAverage([
    { value: normalizeInverse(hipTravel, 0.02, 0.08), weight: 1 },
    { value: normalizeInverse(shoulderTravel, 0.02, 0.08), weight: 1 },
    { value: normalizeInverse(bodyLineAngleRange, 2, 14), weight: 1 },
  ]);
  const direction = hipTravel > wristTravelY
    ? summarizeDirection(hipVelocityY, "下行", "上行", 0.08)
    : summarizeDirection(wristVelocityY, "下行", "上行", 0.12);

  const snapshot = {
    sequenceText: `${temporal.history.bodyCenterY?.length ?? 0} 帧连续骨架`,
    angleText: `膝 ${formatDegrees(kneeAngle)} | 髋 ${formatDegrees(hipAngle)} | 肘 ${formatDegrees(elbowAngle)} | 肩 ${formatDegrees(shoulderAngle)}`,
    velocityText: `重心 ${formatVelocity(centerVelocityY)} | 腕部 ${formatVelocity(wristVelocityY)}`,
    centerText: `重心波动 ${formatNormalized(centerTravel)} | 髋波动 ${formatNormalized(hipTravel)}`,
    wristText: `纵向 ${formatNormalized(wristTravelY)} | 横向 ${formatNormalized(wristTravelX)} | 漂移 ${formatNormalized(elbowDriftX + elbowDriftY)}`,
    orientationText: orientation.widthRatio === null ? "未知" : `${orientation.label} | 宽高比 ${orientation.widthRatio.toFixed(2)}`,
    directionText: `${direction} | 重心 ${summarizeDirection(centerVelocityY, "下移", "上移", 0.08)}`,
    equipmentText: "未启用",
  };

  temporal.snapshot = snapshot;
  if (renderSnapshot) {
    renderTemporalSnapshot(snapshot);
  }

  return {
    orientation,
    dominantSide,
    bodyCenter,
    hipCenter,
    shoulderCenter,
    sideShoulder,
    sideElbow,
    sideWrist,
    sideHip,
    sideKnee,
    sideAnkle,
    kneeAngle,
    hipAngle,
    elbowAngle,
    shoulderAngle,
    bodyLineAngle,
    bodyHorizontalDelta,
    centerVelocityY,
    hipVelocityY,
    shoulderVelocityY,
    wristVelocityY,
    wristVelocityX,
    centerTravel,
    hipTravel,
    shoulderTravel,
    wristTravelY,
    wristTravelX,
    elbowDriftY,
    elbowDriftX,
    kneeAngleRange,
    hipAngleRange,
    elbowAngleRange,
    bodyLineAngleRange,
    hipTrend,
    shoulderTrend,
    kneeAngleTrend,
    elbowAngleTrend,
    wristYTrend,
    wristXTrend,
    centerTrend,
    stabilityScore,
    history: temporal.history,
    sequenceFrames: temporal.history.bodyCenterY?.length ?? 0,
  };
}

function renderExerciseResult(result) {
  ui.exerciseName.textContent = result.label;
  ui.actionStatus.textContent = result.status;
  ui.actionProgress.textContent = result.progress;
  ui.actionCompleteness.textContent = result.completeness;
  ui.actionRate.textContent = result.rate;
  ui.actionPhase.textContent = result.phase;
  ui.ruleNote.textContent = result.ruleNote;
  renderFocusMetrics(result.timelineNow ?? performance.now());

  for (let index = 0; index < 4; index += 1) {
    const metric = result.debugMetrics[index] ?? { label: `指标 ${index + 1}`, value: "-" };
    ui.debugMetricLabels[index].textContent = metric.label;
    ui.debugMetricValues[index].textContent = metric.value;
  }
}

function renderIdleResult(status, phase) {
  const exercise = getSelectedExercise();
  const exerciseMeta = getSelectedExerciseMeta();

  renderExerciseResult({
    label: exerciseMeta.label,
    status,
    progress: exercise === "plank" ? "0 组" : "0 次",
    completeness: "-",
    rate: "-",
    phase,
    ruleNote: `${SINGLE_RULE_NOTE} ${exerciseMeta.ruleNote}`,
    debugMetrics: [
      { label: "分析目标", value: exerciseMeta.label },
      { label: "动作次数", value: exercise === "plank" ? "0 组" : "0 次" },
      { label: "时间频率", value: "等待数据" },
      { label: "规则状态", value: "待采样" },
    ],
    timelineNow: performance.now(),
  });
}

function formatTimelineSeconds(seconds) {
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
}

function buildTimelineSkeleton(durationMs, nowLabel) {
  const safeDurationMs = Math.max(durationMs, 1000);
  const width = 760;
  const height = 132;
  const left = 34;
  const right = 724;
  const axisY = 96;
  const top = 28;
  const midX = (left + right) / 2;
  const endSeconds = safeDurationMs / 1000;

  return {
    safeDurationMs,
    width,
    height,
    left,
    right,
    axisY,
    top,
    midX,
    endSeconds,
    axis: `
      <line x1="${left}" y1="${axisY}" x2="${right}" y2="${axisY}" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${axisY}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <line x1="${midX}" y1="${top}" x2="${midX}" y2="${axisY}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <line x1="${right}" y1="${top}" x2="${right}" y2="${axisY}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <text x="${left}" y="118" fill="#93a3b8" font-size="11">0 s</text>
      <text x="${midX - 16}" y="118" fill="#93a3b8" font-size="11">${formatTimelineSeconds(endSeconds / 2)}</text>
      <text x="${right - 28}" y="118" fill="#93a3b8" font-size="11">${nowLabel}</text>
    `,
  };
}

function renderFrequencyTimeline(now = performance.now()) {
  const exercise = getSelectedExercise();
  const summary = state.analysisEngine.getSummary(now);
  const timeline = buildTimelineModel(
    state.analysisEngine.getEventStore(),
    exercise,
    state.analysisStartedAt,
    now,
    summary.liveHoldSeconds ?? 0,
  );
  const chart = buildTimelineSkeleton(timeline.durationMs, formatTimelineSeconds(timeline.durationMs / 1000));
  const pointMarks = timeline.points.map((point) => {
    const ratio = Math.max(0, Math.min(1, (point.atMs - state.analysisStartedAt) / chart.safeDurationMs));
    const x = chart.left + ((chart.right - chart.left) * ratio);
    return `
      <line x1="${x.toFixed(1)}" y1="42" x2="${x.toFixed(1)}" y2="${chart.axisY}" stroke="#42d6a4" stroke-width="2" opacity="0.78" />
      <circle cx="${x.toFixed(1)}" cy="36" r="5" fill="#42d6a4" />
      <text x="${(x - 4).toFixed(1)}" y="22" fill="#edf4ff" font-size="10">${point.index}</text>
    `;
  }).join("");
  const segmentMarks = timeline.segments.map((segment) => {
    const startRatio = Math.max(0, Math.min(1, (segment.startAtMs - state.analysisStartedAt) / chart.safeDurationMs));
    const endRatio = Math.max(startRatio, Math.min(1, (segment.endAtMs - state.analysisStartedAt) / chart.safeDurationMs));
    const x = chart.left + ((chart.right - chart.left) * startRatio);
    const width = Math.max(4, (chart.right - chart.left) * (endRatio - startRatio));
    return `<rect x="${x.toFixed(1)}" y="44" width="${width.toFixed(1)}" height="28" rx="10" fill="${segment.active ? "#42d6a4" : "#6ab8ff"}" opacity="${segment.active ? 0.9 : 0.72}" />`;
  }).join("");

  ui.timelineSummary.textContent = timeline.summary;
  ui.timelineAxis.innerHTML = `
    <svg viewBox="0 0 ${chart.width} ${chart.height}" preserveAspectRatio="none" aria-label="时间频率轴">
      ${chart.axis}
      ${segmentMarks}
      ${pointMarks}
    </svg>
  `;
}

function renderFocusMetrics(now = performance.now()) {
  const exercise = getSelectedExercise();
  const exerciseMeta = getSelectedExerciseMeta();
  const summary = state.analysisEngine.getSummary(now);

  if (exercise === "plank") {
    ui.focusCountLabel.textContent = "保持组数";
    ui.focusCountValue.textContent = `${summary.count} 组`;
    ui.focusCountMeta.textContent = summary.liveHoldSeconds > 0
      ? `当前保持 ${formatSeconds(summary.liveHoldSeconds)}，最长 ${formatSeconds(summary.bestHoldSeconds)}`
      : `最长保持 ${formatSeconds(summary.bestHoldSeconds)}`;
  } else {
    ui.focusCountLabel.textContent = `${exerciseMeta.label}次数`;
    ui.focusCountValue.textContent = `${summary.count} 次`;
    ui.focusCountMeta.textContent = summary.cadenceRpm > 0
      ? `当前频率 ${formatCadence(summary.cadenceRpm)}`
      : "等待形成稳定节奏";
  }

  renderFrequencyTimeline(now);
}

function getRecentValues(history, key, windowSize = 12) {
  const values = history[key] ?? [];
  return values.slice(Math.max(0, values.length - windowSize));
}

function getSeriesSlope(values) {
  if (!values || values.length < 3) {
    return 0;
  }

  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = average(values);

  if (meanY === null) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < n; index += 1) {
    const dx = index - meanX;
    numerator += dx * (values[index] - meanY);
    denominator += dx * dx;
  }

  return denominator ? numerator / denominator : 0;
}

function formatCadence(rpm) {
  return rpm > 0 ? `${rpm.toFixed(1)} 次/分` : "-";
}

function updateRepCadence(repTimes, now) {
  repTimes.push(now);

  if (repTimes.length > 6) {
    repTimes.shift();
  }

  if (repTimes.length < 2) {
    return 0;
  }

  const intervals = [];
  for (let index = 1; index < repTimes.length; index += 1) {
    intervals.push((repTimes[index] - repTimes[index - 1]) / 1000);
  }

  const avgInterval = average(intervals);
  return avgInterval && avgInterval > 0 ? 60 / avgInterval : 0;
}

function registerRep(recognition, now) {
  recognition.reps += 1;
  recognition.lastRepCompleteness = recognition.cyclePeakCompleteness;
  recognition.lastRepAt = now;
  recognition.lastMotionAt = now;
  recognition.repHistory.push(now);
  recognition.cadenceRpm = updateRepCadence(recognition.repTimes, now);
  recognition.cyclePeakCompleteness = 0;
}

function resetDynamicExerciseTracking(recognition, { clearCounts = false } = {}) {
  recognition.phase = recognition.initialPhase;
  recognition.phaseFrames = 0;
  recognition.phasePeakPrimary = null;
  recognition.phaseValleyPrimary = null;
  recognition.phasePeakSecondary = null;
  recognition.phaseValleySecondary = null;
  recognition.cyclePeakCompleteness = 0;
  recognition.lastRepCompleteness = 0;
  recognition.lastRepAt = 0;
  recognition.lastMotionAt = 0;
  recognition.repTimes = [];
  recognition.repHistory = [];
  recognition.cadenceRpm = 0;
  recognition.responseLabel = "待触发";

  if (clearCounts) {
    recognition.reps = 0;
  }
}

function resetPlankTracking(recognition, { clearCounts = false } = {}) {
  recognition.holding = false;
  recognition.holdStartedAt = 0;
  recognition.currentHoldSeconds = 0;
  recognition.holdSegments = [];
  recognition.stabilityScore = 0;
  recognition.responseLabel = "待稳定";
  recognition.phase = "idle";

  if (clearCounts) {
    recognition.bestHoldSeconds = 0;
    recognition.holdCount = 0;
  }
}

function resetExerciseTracking(exerciseKey, options) {
  switch (exerciseKey) {
    case "squat":
    case "pushup":
    case "curl":
      resetDynamicExerciseTracking(state.recognition[exerciseKey], options);
      break;
    case "plank":
      resetPlankTracking(state.recognition.plank, options);
      break;
    default:
      break;
  }
}

function adoptCurlScoutState() {
  state.recognition.curl = cloneDynamicRecognitionState(state.curlScoutRecognition);
  state.activeTemporal = cloneTemporalState(state.curlScoutTemporal, ACTIVE_HISTORY_LIMIT, "curl");
  state.curlScoutIdleFrames = 0;
}

function captureCurlScoutFromActive() {
  state.curlScoutRecognition = cloneDynamicRecognitionState(state.recognition.curl);
  state.curlScoutTemporal = cloneTemporalState(state.activeTemporal, ACTIVE_HISTORY_LIMIT, "curl");
  state.curlScoutIdleFrames = 0;
}

function resetCurlScoutState({ clearCounts = true } = {}) {
  state.curlScoutTemporal = createActiveTemporalState("curl");
  state.curlScoutRecognition = createDynamicExerciseState("down");
  state.curlScoutIdleFrames = 0;

  if (!clearCounts) {
    state.curlScoutRecognition.reps = state.recognition.curl.reps;
  }
}

function setActiveExercise(nextExercise, now, confidence = 0) {
  const detection = state.autoDetection;
  const previousExercise = detection.activeExercise;

  if (previousExercise === nextExercise) {
    detection.confidence = confidence;
    return;
  }

  if (previousExercise === "plank" && nextExercise !== "plank") {
    endPlankHoldIfNeeded(now);
  }

  if (previousExercise === "curl" && nextExercise !== "curl") {
    captureCurlScoutFromActive();
  }

  if (previousExercise) {
    resetExerciseTracking(previousExercise);
  }

  detection.activeExercise = nextExercise;
  detection.candidateExercise = null;
  detection.candidateFrames = 0;
  detection.confidence = nextExercise ? confidence : 0;
  state.activeTemporal = createActiveTemporalState(nextExercise);
  state.temporal = createTemporalState();

  if (nextExercise) {
    if (nextExercise === "curl") {
      adoptCurlScoutState();
    } else {
      resetExerciseTracking(nextExercise);
    }
  }
}

function noteDynamicActivity(recognition, frameCompleteness, now) {
  recognition.cyclePeakCompleteness = Math.max(recognition.cyclePeakCompleteness, frameCompleteness);

  if (frameCompleteness >= 0.18 || recognition.phase !== recognition.initialPhase) {
    recognition.lastMotionAt = now;
  }
}

function expireDynamicFeedbackIfNeeded(recognition, now) {
  if (recognition.lastMotionAt && (now - recognition.lastMotionAt) > COMPLETENESS_STALE_MS) {
    resetDynamicExerciseTracking(recognition);
    recognition.responseLabel = "等待下一次动作";
    return;
  }

  if (recognition.lastRepAt && (now - recognition.lastRepAt) > CADENCE_STALE_MS) {
    recognition.cadenceRpm = 0;
    recognition.repTimes = [];
  }
}

function getDynamicCompleteness(recognition, now) {
  const recentCycle = recognition.lastMotionAt && (now - recognition.lastMotionAt) <= COMPLETENESS_STALE_MS
    ? recognition.cyclePeakCompleteness
    : 0;
  const recentRep = recognition.lastRepAt && (now - recognition.lastRepAt) <= COMPLETENESS_STALE_MS
    ? recognition.lastRepCompleteness
    : 0;
  const value = Math.max(recentCycle, recentRep);
  return value > 0.04 ? formatPercent(value) : "-";
}

function getDynamicCadence(recognition, now) {
  if (!recognition.lastRepAt || (now - recognition.lastRepAt) > CADENCE_STALE_MS) {
    return "-";
  }

  return formatCadence(recognition.cadenceRpm);
}

function getRecentAverage(history, key, windowSize = 4) {
  const values = getRecentValues(history, key, windowSize);
  return values.length ? average(values) : null;
}

function updatePhaseTracker(recognition, primaryValue, secondaryValue) {
  recognition.phaseFrames += 1;

  if (primaryValue !== null && primaryValue !== undefined) {
    recognition.phasePeakPrimary = recognition.phasePeakPrimary === null
      ? primaryValue
      : Math.max(recognition.phasePeakPrimary, primaryValue);
    recognition.phaseValleyPrimary = recognition.phaseValleyPrimary === null
      ? primaryValue
      : Math.min(recognition.phaseValleyPrimary, primaryValue);
  }

  if (secondaryValue !== null && secondaryValue !== undefined) {
    recognition.phasePeakSecondary = recognition.phasePeakSecondary === null
      ? secondaryValue
      : Math.max(recognition.phasePeakSecondary, secondaryValue);
    recognition.phaseValleySecondary = recognition.phaseValleySecondary === null
      ? secondaryValue
      : Math.min(recognition.phaseValleySecondary, secondaryValue);
  }
}

function resetPhaseTracker(recognition, primaryValue = null, secondaryValue = null) {
  recognition.phaseFrames = 0;
  recognition.phasePeakPrimary = primaryValue;
  recognition.phaseValleyPrimary = primaryValue;
  recognition.phasePeakSecondary = secondaryValue;
  recognition.phaseValleySecondary = secondaryValue;
}

function changeDynamicPhase(recognition, phase, label, primaryValue = null, secondaryValue = null) {
  recognition.phase = phase;
  recognition.responseLabel = label;
  resetPhaseTracker(recognition, primaryValue, secondaryValue);
}

function weightedAverage(pairs) {
  const valid = pairs.filter((pair) => pair.value !== null && pair.value !== undefined && !Number.isNaN(pair.value));

  if (!valid.length) {
    return 0;
  }

  const totalWeight = valid.reduce((sum, pair) => sum + pair.weight, 0);
  const total = valid.reduce((sum, pair) => sum + (pair.value * pair.weight), 0);
  return totalWeight > 0 ? total / totalWeight : 0;
}

function computeExerciseScores(metrics) {
  const frontFactor = metrics.orientation.key === "front" ? 1 : 0.72;
  const sideFactor = metrics.orientation.key === "side" ? 1 : 0.45;
  const uprightFactor = normalize(metrics.bodyHorizontalDelta, 0.14, 0.34);
  const horizontalFactor = normalizeInverse(metrics.bodyHorizontalDelta, 0.08, 0.22);
  const straightLineFactor = normalize(metrics.bodyLineAngle, 145, 178);
  const armDriveFactor = weightedAverage([
    { value: normalize(metrics.elbowAngleRange, 22, 90), weight: 0.55 },
    { value: normalize(metrics.wristTravelY, 0.04, 0.18), weight: 0.45 },
  ]);
  const stableTorsoFactor = weightedAverage([
    { value: normalizeInverse(metrics.hipTravel, 0.025, 0.09), weight: 1 },
    { value: normalizeInverse(metrics.shoulderTravel, 0.025, 0.09), weight: 1 },
  ]);

  let squat = weightedAverage([
    { value: normalize(metrics.hipTravel, 0.03, 0.13), weight: 0.25 },
    { value: normalize(metrics.kneeAngleRange, 20, 70), weight: 0.25 },
    { value: normalize(metrics.centerTravel, 0.02, 0.12), weight: 0.15 },
    { value: normalizeInverse(metrics.shoulderTravel, 0.05, 0.18), weight: 0.15 },
    { value: uprightFactor, weight: 0.1 },
    { value: frontFactor, weight: 0.1 },
  ]);
  if (horizontalFactor > 0.72 && straightLineFactor > 0.75) {
    squat *= 0.45;
  }

  let pushup = weightedAverage([
    { value: sideFactor, weight: 0.2 },
    { value: normalize(metrics.elbowAngleRange, 28, 95), weight: 0.22 },
    { value: horizontalFactor, weight: 0.18 },
    { value: straightLineFactor, weight: 0.2 },
    { value: normalize(metrics.shoulderTravel, 0.02, 0.12), weight: 0.1 },
    { value: normalize(metrics.centerTravel, 0.02, 0.09), weight: 0.1 },
  ]);
  if (metrics.orientation.key === "front") {
    pushup *= 0.58;
  }

  let plank = weightedAverage([
    { value: sideFactor, weight: 0.16 },
    { value: horizontalFactor, weight: 0.24 },
    { value: normalize(metrics.bodyLineAngle, 160, 178), weight: 0.24 },
    { value: normalizeInverse(metrics.hipTravel, 0.018, 0.08), weight: 0.14 },
    { value: normalizeInverse(metrics.shoulderTravel, 0.018, 0.08), weight: 0.12 },
    { value: normalizeInverse(metrics.elbowAngleRange, 12, 55), weight: 0.05 },
    { value: normalize(metrics.sequenceFrames, 12, 40), weight: 0.05 },
  ]);
  if (metrics.orientation.key === "front") {
    plank *= 0.55;
  }
  if (uprightFactor > 0.52) {
    plank *= 0.24;
  }
  if (armDriveFactor > 0.56) {
    plank *= 0.5;
  }

  let curl = weightedAverage([
    { value: normalize(metrics.elbowAngleRange, 25, 95), weight: 0.26 },
    { value: normalize(metrics.wristTravelY, 0.05, 0.2), weight: 0.22 },
    { value: normalizeInverse(metrics.elbowDriftX + metrics.elbowDriftY, 0.05, 0.2), weight: 0.14 },
    { value: uprightFactor, weight: 0.18 },
    { value: normalizeInverse(metrics.centerTravel, 0.035, 0.16), weight: 0.08 },
    { value: metrics.orientation.key === "side" ? 1 : 0.72, weight: 0.06 },
    { value: normalize(metrics.shoulderAngle, 18, 75), weight: 0.06 },
  ]);
  if (horizontalFactor > 0.72 && straightLineFactor > 0.75) {
    curl *= 0.5;
  }
  if (uprightFactor > 0.48 && armDriveFactor > 0.52) {
    curl = Math.min(1, curl + 0.08);
  }
  if (uprightFactor > 0.58 && metrics.orientation.key === "side" && armDriveFactor > 0.4) {
    curl = Math.min(1, curl + 0.12);
  }

  return {
    squat: clamp01(squat),
    pushup: clamp01(pushup),
    plank: clamp01(plank),
    curl: clamp01(curl),
  };
}

function updateAutoDetection(scores, now) {
  const detection = state.autoDetection;
  detection.scores = scores;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestExercise, bestScore] = ranked[0] ?? [null, 0];
  const [, secondScore] = ranked[1] ?? [null, 0];
  const activeScore = detection.activeExercise ? scores[detection.activeExercise] ?? 0 : 0;
  const bestEnterThreshold = bestExercise ? (AUTO_ENTER_THRESHOLDS[bestExercise] ?? AUTO_ENTER_THRESHOLD) : AUTO_ENTER_THRESHOLD;
  const bestLeadThreshold = bestExercise ? (AUTO_MIN_LEAD_THRESHOLDS[bestExercise] ?? 0.06) : 0.06;
  const activeKeepThreshold = detection.activeExercise
    ? (AUTO_KEEP_THRESHOLDS[detection.activeExercise] ?? AUTO_KEEP_THRESHOLD)
    : AUTO_KEEP_THRESHOLD;

  if (detection.activeExercise) {
    if (bestExercise === detection.activeExercise && activeScore >= activeKeepThreshold) {
      detection.candidateExercise = null;
      detection.candidateFrames = 0;
      detection.confidence = activeScore;
      return detection.activeExercise;
    }

    if (
      bestExercise
      && bestExercise !== detection.activeExercise
      && bestScore >= bestEnterThreshold
      && bestScore - activeScore >= AUTO_SWITCH_MARGIN
      && bestScore - secondScore >= bestLeadThreshold
    ) {
      if (detection.candidateExercise === bestExercise) {
        detection.candidateFrames += 1;
      } else {
        detection.candidateExercise = bestExercise;
        detection.candidateFrames = 1;
      }

      if (detection.candidateFrames >= AUTO_STABLE_FRAMES) {
        setActiveExercise(bestExercise, now, bestScore);
      }
    } else {
      detection.candidateExercise = null;
      detection.candidateFrames = 0;
      if (activeScore < 0.35 && bestScore < 0.45) {
        setActiveExercise(null, now, 0);
      } else {
        detection.confidence = activeScore;
      }
    }

    return detection.activeExercise;
  }

  if (bestExercise && bestScore >= bestEnterThreshold && bestScore - secondScore >= bestLeadThreshold) {
    if (detection.candidateExercise === bestExercise) {
      detection.candidateFrames += 1;
    } else {
      detection.candidateExercise = bestExercise;
      detection.candidateFrames = 1;
    }

    if (detection.candidateFrames >= AUTO_STABLE_FRAMES - 1) {
      setActiveExercise(bestExercise, now, bestScore);
    }
  } else {
    detection.candidateExercise = null;
    detection.candidateFrames = 0;
    detection.confidence = 0;
  }

  return detection.activeExercise;
}

function buildAutoCandidateResult() {
  const exercise = getSelectedExercise();
  const label = EXERCISES[exercise].label;

  return {
    label,
    status: "等待动作出现",
    progress: exercise === "plank" ? "0 组" : "0 次",
    completeness: "-",
    rate: "-",
    phase: "待识别",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES[exercise].ruleNote}`,
    debugMetrics: [
      { label: "分析目标", value: EXERCISES[exercise].label },
      { label: "动作次数", value: exercise === "plank" ? "0 组" : "0 次" },
      { label: "时间频率", value: "等待数据" },
      { label: "规则状态", value: "待采样" },
    ],
    timelineNow: performance.now(),
  };
}

function buildPoseGraceResult(now) {
  const activeExercise = getSelectedExercise();

  if (!activeExercise) {
    return {
      label: "未选择动作",
      status: "目标短暂丢失",
      progress: "-",
      completeness: "-",
      rate: "-",
      phase: "容错保持",
      ruleNote: SINGLE_RULE_NOTE,
      debugMetrics: [
        { label: "分析目标", value: "-" },
        { label: "动作次数", value: "-" },
        { label: "时间频率", value: "-" },
        { label: "规则状态", value: "待选择" },
      ],
      timelineNow: now,
    };
  }

  if (activeExercise === "plank") {
    const recognition = state.recognition.plank;
    return {
      label: EXERCISES.plank.label,
      status: "目标短暂丢失",
      progress: `${recognition.holdCount} 组 / ${formatSeconds(recognition.currentHoldSeconds)}`,
      completeness: recognition.currentHoldSeconds > 0 ? formatSeconds(recognition.currentHoldSeconds) : "-",
      rate: recognition.responseLabel,
      phase: "容错保持",
      ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES.plank.ruleNote}`,
      debugMetrics: [
        { label: "肩髋踝夹角", value: "-" },
        { label: "髋部波动", value: "-" },
        { label: "肩部波动", value: "-" },
        { label: "响应判定", value: "短时保留状态" },
      ],
      timelineNow: now,
    };
  }

  const recognition = state.recognition[activeExercise];
  return {
    label: EXERCISES[activeExercise].label,
    status: "目标短暂丢失",
    progress: formatCount(recognition.reps),
    completeness: getDynamicCadence(recognition, now),
    rate: recognition.phase === "up" ? "动作上行" : "动作下行",
    phase: "容错保持",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES[activeExercise].ruleNote}`,
    debugMetrics: [
      { label: "关键角度", value: "-" },
      { label: "位移波动", value: "-" },
      { label: "响应缓存", value: recognition.responseLabel },
      { label: "丢帧容错", value: `${state.missingPoseFrames}/${MISSING_POSE_GRACE_FRAMES}` },
    ],
    timelineNow: now,
  };
}

function evaluateSquat(metrics, confidence, now) {
  const recognition = state.recognition.squat;
  const frameCompleteness = weightedAverage([
    { value: normalize(metrics.hipTravel, 0.03, 0.13), weight: 0.4 },
    { value: normalize(metrics.kneeAngleRange, 20, 75), weight: 0.4 },
    { value: normalizeInverse(metrics.shoulderTravel, 0.04, 0.16), weight: 0.2 },
  ]);
  noteDynamicActivity(recognition, frameCompleteness, now);

  if (
    recognition.phase === "up"
    && metrics.kneeAngle !== null
    && metrics.kneeAngle < 120
    && metrics.hipTrend > 0.002
    && metrics.kneeAngleTrend < -0.8
  ) {
    recognition.phase = "down";
    recognition.responseLabel = "下蹲响应";
  } else if (
    recognition.phase === "down"
    && metrics.kneeAngle !== null
    && metrics.kneeAngle > 155
    && metrics.hipTrend < -0.0018
    && metrics.kneeAngleTrend > 0.8
    && metrics.kneeAngleRange > 35
    && metrics.hipTravel > 0.05
  ) {
    registerRep(recognition, now);
    recognition.phase = "up";
    recognition.responseLabel = "起身完成";
  } else {
    recognition.responseLabel = recognition.phase === "down" ? "底部缓冲" : "准备下蹲";
  }
  expireDynamicFeedbackIfNeeded(recognition, now);

  return {
    label: EXERCISES.squat.label,
    status: `按${EXERCISES.squat.label}规则分析中`,
    progress: formatCount(recognition.reps),
    completeness: getDynamicCadence(recognition, now),
    rate: recognition.phase === "down" ? "下蹲阶段" : "站立阶段",
    phase: recognition.repHistory.length ? `已记录 ${recognition.repHistory.length} 次峰值` : "等待首次计数",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES.squat.ruleNote}`,
    debugMetrics: [
      { label: "膝角均值", value: formatDegrees(metrics.kneeAngle) },
      { label: "髋部波动", value: formatNormalized(metrics.hipTravel) },
      { label: "肩部波动", value: formatNormalized(metrics.shoulderTravel) },
      { label: "响应判定", value: recognition.responseLabel },
    ],
    timelineNow: now,
  };
}

function evaluatePushup(metrics, confidence, now) {
  const recognition = state.recognition.pushup;
  const smoothedElbowAngle = getRecentAverage(state.activeTemporal.history, "elbowAngle") ?? metrics.elbowAngle;
  const smoothedShoulderY = getRecentAverage(state.activeTemporal.history, "shoulderCenterY") ?? metrics.shoulderCenter?.y ?? null;
  updatePhaseTracker(recognition, smoothedElbowAngle, smoothedShoulderY);

  const elbowDropFromPeak = (
    recognition.phasePeakPrimary !== null && smoothedElbowAngle !== null
      ? recognition.phasePeakPrimary - smoothedElbowAngle
      : 0
  );
  const elbowRiseFromValley = (
    recognition.phaseValleyPrimary !== null && smoothedElbowAngle !== null
      ? smoothedElbowAngle - recognition.phaseValleyPrimary
      : 0
  );
  const shoulderDrop = (
    recognition.phaseValleySecondary !== null && smoothedShoulderY !== null
      ? smoothedShoulderY - recognition.phaseValleySecondary
      : 0
  );
  const shoulderLift = (
    recognition.phasePeakSecondary !== null && smoothedShoulderY !== null
      ? recognition.phasePeakSecondary - smoothedShoulderY
      : 0
  );
  const frameCompleteness = weightedAverage([
    { value: normalize(metrics.elbowAngleRange, 28, 95), weight: 0.4 },
    { value: normalize(metrics.shoulderTravel, 0.02, 0.12), weight: 0.2 },
    { value: normalize(metrics.bodyLineAngle, 145, 178), weight: 0.2 },
    { value: normalizeInverse(metrics.bodyHorizontalDelta, 0.08, 0.22), weight: 0.2 },
  ]);
  noteDynamicActivity(recognition, frameCompleteness, now);

  if (
    recognition.phase === "up"
    && smoothedElbowAngle !== null
    && smoothedElbowAngle < 128
    && elbowDropFromPeak > 16
    && shoulderDrop > 0.012
    && metrics.bodyLineAngle !== null
    && metrics.bodyLineAngle > 140
    && recognition.phaseFrames >= 3
  ) {
    changeDynamicPhase(recognition, "down", "下压响应", smoothedElbowAngle, smoothedShoulderY);
  } else if (
    recognition.phase === "down"
    && smoothedElbowAngle !== null
    && smoothedElbowAngle > 134
    && elbowRiseFromValley > 18
    && shoulderLift > 0.012
    && (metrics.bodyHorizontalDelta === null || metrics.bodyHorizontalDelta < 0.2)
    && recognition.phaseFrames >= 4
  ) {
    registerRep(recognition, now);
    changeDynamicPhase(recognition, "up", "撑起完成", smoothedElbowAngle, smoothedShoulderY);
  } else {
    recognition.responseLabel = recognition.phase === "down" ? "底部发力" : "准备下压";
  }
  expireDynamicFeedbackIfNeeded(recognition, now);

  return {
    label: EXERCISES.pushup.label,
    status: `按${EXERCISES.pushup.label}规则分析中`,
    progress: formatCount(recognition.reps),
    completeness: getDynamicCadence(recognition, now),
    rate: recognition.phase === "down" ? "下压阶段" : "撑起阶段",
    phase: recognition.repHistory.length ? `已记录 ${recognition.repHistory.length} 次峰值` : "等待首次计数",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES.pushup.ruleNote}`,
    debugMetrics: [
      { label: "肘角", value: formatDegrees(metrics.elbowAngle) },
      { label: "躯干直线", value: formatDegrees(metrics.bodyLineAngle) },
      { label: "肩部升降", value: formatNormalized(Math.max(shoulderDrop, shoulderLift)) },
      { label: "响应判定", value: recognition.responseLabel },
    ],
    timelineNow: now,
  };
}

function evaluatePlank(metrics, confidence, now) {
  const recognition = state.recognition.plank;
  const holdingNow = (
    metrics.bodyLineAngle !== null
    && metrics.bodyLineAngle > 160
    && metrics.bodyHorizontalDelta !== null
    && metrics.bodyHorizontalDelta < 0.16
    && metrics.hipTravel < 0.035
    && metrics.shoulderTravel < 0.035
    && metrics.wristTravelY < 0.08
    && metrics.elbowAngleRange < 32
    && metrics.sequenceFrames >= 16
  );

  if (holdingNow) {
    if (!recognition.holding) {
      recognition.holding = true;
      recognition.holdStartedAt = now;
      recognition.responseLabel = "进入保持";
    }

    recognition.currentHoldSeconds = (now - recognition.holdStartedAt) / 1000;
    recognition.bestHoldSeconds = Math.max(recognition.bestHoldSeconds, recognition.currentHoldSeconds);
    recognition.stabilityScore = metrics.stabilityScore;
    recognition.phase = "holding";
  } else {
    endPlankHoldIfNeeded(now);
    recognition.stabilityScore = metrics.stabilityScore;
    recognition.responseLabel = metrics.stabilityScore > 0.6 ? "姿态调整" : "重新进入";
    recognition.phase = "idle";
  }

  return {
    label: EXERCISES.plank.label,
    status: `按${EXERCISES.plank.label}规则分析中`,
    progress: `${recognition.holdCount} 组 / ${formatSeconds(recognition.currentHoldSeconds)}`,
    completeness: recognition.currentHoldSeconds > 0 ? `${recognition.currentHoldSeconds.toFixed(1)} s` : "-",
    rate: recognition.phase === "holding" ? "保持中" : "待稳定",
    phase: recognition.holdSegments.length ? `已记录 ${recognition.holdSegments.length} 段保持` : "等待首次保持",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES.plank.ruleNote}`,
    debugMetrics: [
      { label: "肩髋踝夹角", value: formatDegrees(metrics.bodyLineAngle) },
      { label: "髋部波动", value: formatNormalized(metrics.hipTravel) },
      { label: "肩部波动", value: formatNormalized(metrics.shoulderTravel) },
      { label: "响应判定", value: recognition.responseLabel || formatSeconds(recognition.bestHoldSeconds) },
    ],
    timelineNow: now,
  };
}

function runCurlCounter(recognition, temporalState, metrics, now) {
  const smoothedElbowAngle = getRecentAverage(temporalState.history, "elbowAngle") ?? metrics.elbowAngle;
  const smoothedWristY = getRecentAverage(temporalState.history, "wristY") ?? metrics.sideWrist?.y ?? null;
  updatePhaseTracker(recognition, smoothedElbowAngle, smoothedWristY);

  const elbowDropFromPeak = (
    recognition.phasePeakPrimary !== null && smoothedElbowAngle !== null
      ? recognition.phasePeakPrimary - smoothedElbowAngle
      : 0
  );
  const elbowRiseFromValley = (
    recognition.phaseValleyPrimary !== null && smoothedElbowAngle !== null
      ? smoothedElbowAngle - recognition.phaseValleyPrimary
      : 0
  );
  const wristLift = (
    recognition.phasePeakSecondary !== null && smoothedWristY !== null
      ? recognition.phasePeakSecondary - smoothedWristY
      : 0
  );
  const wristDrop = (
    recognition.phaseValleySecondary !== null && smoothedWristY !== null
      ? smoothedWristY - recognition.phaseValleySecondary
      : 0
  );
  const frameCompleteness = weightedAverage([
    { value: normalize(metrics.elbowAngleRange, 22, 90), weight: 0.58 },
    { value: normalize(metrics.wristTravelY, 0.04, 0.18), weight: 0.16 },
    { value: normalizeInverse(metrics.elbowDriftX + metrics.elbowDriftY, 0.06, 0.24), weight: 0.16 },
    { value: normalize(metrics.sequenceFrames, 8, 28), weight: 0.1 },
  ]);
  noteDynamicActivity(recognition, frameCompleteness, now);
  const elbowDrift = metrics.elbowDriftX + metrics.elbowDriftY;
  const wristAssistUp = wristLift > 0.012 || metrics.wristTravelY > 0.055 || metrics.wristYTrend < -0.002;
  const wristAssistDown = wristDrop > 0.012 || metrics.wristTravelY > 0.055 || metrics.wristYTrend > 0.002;
  const contractedEnough = smoothedElbowAngle !== null && (smoothedElbowAngle < 134 || elbowDropFromPeak > 24);
  const extendedEnough = smoothedElbowAngle !== null && (smoothedElbowAngle > 136 || elbowRiseFromValley > 24);
  const curlInDropThreshold = wristAssistUp ? 14 : 18;
  const curlOutRiseThreshold = wristAssistDown ? 14 : 18;

  if (
    recognition.phase === "down"
    && smoothedElbowAngle !== null
    && contractedEnough
    && elbowDropFromPeak > curlInDropThreshold
    && elbowDrift < 0.24
    && (metrics.bodyHorizontalDelta === null || metrics.bodyHorizontalDelta > 0.12)
    && recognition.phaseFrames >= 3
  ) {
    changeDynamicPhase(recognition, "up", "弯举响应", smoothedElbowAngle, smoothedWristY);
  } else if (
    recognition.phase === "up"
    && smoothedElbowAngle !== null
    && extendedEnough
    && elbowRiseFromValley > curlOutRiseThreshold
    && elbowDrift < 0.24
    && recognition.phaseFrames >= 3
  ) {
    registerRep(recognition, now);
    changeDynamicPhase(recognition, "down", "下放完成", smoothedElbowAngle, smoothedWristY);
  } else {
    recognition.responseLabel = recognition.phase === "up" ? "顶点停顿" : "准备弯举";
  }
  expireDynamicFeedbackIfNeeded(recognition, now);

  return {
    wristLift,
    wristDrop,
    elbowDrift,
  };
}

function shouldTrackCurlScout(scores, metrics) {
  return (
    metrics.orientation.key === "side"
    && (metrics.bodyHorizontalDelta === null || metrics.bodyHorizontalDelta > 0.14)
    && scores.curl >= CURL_SCOUT_SCORE_THRESHOLD
  );
}

function syncCurlScout(metrics, scores, now) {
  if (shouldTrackCurlScout(scores, metrics)) {
    state.curlScoutIdleFrames = 0;
    return runCurlCounter(state.curlScoutRecognition, state.curlScoutTemporal, metrics, now);
  }

  state.curlScoutIdleFrames += 1;
  if (state.curlScoutIdleFrames >= CURL_SCOUT_IDLE_FRAMES) {
    resetCurlScoutState();
  }

  return null;
}

function applyCurlScoutScoreBoost(scores) {
  const scout = state.curlScoutRecognition;
  const scoutWarmth = Math.max(
    scout.phase !== scout.initialPhase ? 1 : 0,
    normalize(scout.cyclePeakCompleteness, 0.25, 0.72),
    normalize(scout.lastRepCompleteness, 0.25, 0.72),
  );

  if (scoutWarmth <= 0 || scores.curl < 0.36) {
    return;
  }

  scores.curl = Math.min(1, scores.curl + (0.05 * scoutWarmth));
}

function evaluateCurl(metrics, confidence, now) {
  const recognition = state.recognition.curl;
  const telemetry = runCurlCounter(recognition, state.activeTemporal, metrics, now);

  return {
    label: EXERCISES.curl.label,
    status: `按${EXERCISES.curl.label}规则分析中`,
    progress: formatCount(recognition.reps),
    completeness: getDynamicCadence(recognition, now),
    rate: recognition.phase === "up" ? "弯举阶段" : "下放阶段",
    phase: recognition.repHistory.length ? `已记录 ${recognition.repHistory.length} 次峰值` : "等待首次计数",
    ruleNote: `${SINGLE_RULE_NOTE} ${EXERCISES.curl.ruleNote}`,
    debugMetrics: [
      { label: "肘角", value: formatDegrees(metrics.elbowAngle) },
      { label: "腕部位移", value: formatNormalized(Math.max(telemetry?.wristLift ?? 0, telemetry?.wristDrop ?? 0)) },
      { label: "肘部漂移", value: formatNormalized(telemetry?.elbowDrift ?? 0) },
      { label: "响应判定", value: recognition.responseLabel },
    ],
    timelineNow: now,
  };
}

function evaluateDetectedExercise(exerciseKey, metrics, now) {
  const confidence = state.autoDetection.scores[exerciseKey] ?? 0;

  switch (exerciseKey) {
    case "squat":
      endPlankHoldIfNeeded(now);
      return evaluateSquat(metrics, confidence, now);
    case "pushup":
      endPlankHoldIfNeeded(now);
      return evaluatePushup(metrics, confidence, now);
    case "plank":
      return evaluatePlank(metrics, confidence, now);
    case "curl":
      endPlankHoldIfNeeded(now);
      return evaluateCurl(metrics, confidence, now);
    default:
      endPlankHoldIfNeeded(now);
      return buildAutoCandidateResult();
  }
}

function evaluateSelectedExercise(metrics, now) {
  return evaluateDetectedExercise(getSelectedExercise(), metrics, now);
}

function drawLandmarks(landmarks) {
  for (const [startIndex, endIndex] of POSE_CONNECTIONS) {
    const start = landmarks[startIndex];
    const end = landmarks[endIndex];

    if (!start || !end || !isLandmarkVisible(start) || !isLandmarkVisible(end)) {
      continue;
    }

    canvasContext.beginPath();
    canvasContext.moveTo(start.x * ui.canvas.width, start.y * ui.canvas.height);
    canvasContext.lineTo(end.x * ui.canvas.width, end.y * ui.canvas.height);
    canvasContext.lineWidth = 3;
    canvasContext.strokeStyle = "rgba(66, 214, 164, 0.85)";
    canvasContext.stroke();
  }

  for (let index = 0; index < landmarks.length; index += 1) {
    const landmark = landmarks[index];

    if (!isLandmarkVisible(landmark)) {
      continue;
    }

    const x = landmark.x * ui.canvas.width;
    const y = landmark.y * ui.canvas.height;

    canvasContext.beginPath();
    canvasContext.arc(x, y, 5, 0, Math.PI * 2);
    canvasContext.fillStyle = "#ffb54d";
    canvasContext.fill();

    canvasContext.beginPath();
    canvasContext.arc(x, y, 9, 0, Math.PI * 2);
    canvasContext.strokeStyle = "rgba(255, 255, 255, 0.2)";
    canvasContext.lineWidth = 2;
    canvasContext.stroke();

    if (ui.labelsToggle.checked) {
      canvasContext.fillStyle = "#edf4ff";
      canvasContext.font = "12px Segoe UI";
      canvasContext.fillText(String(index), x + 8, y - 8);
    }
  }
}

function clearCanvas() {
  canvasContext.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
}

function updateRenderFps(now) {
  state.renderFrames += 1;
  const elapsed = now - state.lastFpsSampleTime;

  if (elapsed >= 1000) {
    const fps = (state.renderFrames * 1000) / elapsed;
    ui.renderFps.textContent = fps.toFixed(1);
    state.renderFrames = 0;
    state.lastFpsSampleTime = now;
  }
}

function updateInferenceMetric(inferenceMs) {
  state.smoothedInferenceMs = state.smoothedInferenceMs === 0
    ? inferenceMs
    : (state.smoothedInferenceMs * 0.85) + (inferenceMs * 0.15);
  ui.inferenceMs.textContent = `${state.smoothedInferenceMs.toFixed(1)} ms`;
}

async function createPoseLandmarker() {
  const selectedModel = ui.modelSelect.value;
  const minPoseDetectionConfidence = Number(ui.detectionThreshold.value);
  const minTrackingConfidence = Number(ui.trackingThreshold.value);

  if (!state.vision) {
    state.vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  }

  if (state.poseLandmarker) {
    state.poseLandmarker.close();
    state.poseLandmarker = null;
  }

  try {
    state.usingDelegate = "GPU";
    state.poseLandmarker = await PoseLandmarker.createFromOptions(state.vision, {
      baseOptions: {
        modelAssetPath: MODEL_URLS[selectedModel],
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence,
      minTrackingConfidence,
    });
  } catch (error) {
    state.usingDelegate = "CPU";
    state.poseLandmarker = await PoseLandmarker.createFromOptions(state.vision, {
      baseOptions: {
        modelAssetPath: MODEL_URLS[selectedModel],
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence,
      minTrackingConfidence,
    });
    setLog(`GPU 初始化失败，已自动回退到 CPU。${error instanceof Error ? error.message : String(error)}`);
  }

  ui.delegateLabel.textContent = state.usingDelegate;
  setLog(`模型已加载：${selectedModel.toUpperCase()}，推理设备：${state.usingDelegate}`);
}

async function ensurePoseLandmarker() {
  if (!state.poseLandmarker) {
    setLog("正在加载 Pose Landmarker 模型...");
    await createPoseLandmarker();
  }
}

function cancelRenderLoop() {
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = 0;
  }
}

function clearActiveStream({ clearVideo = true } = {}) {
  if (state.stream) {
    if (state.stopTracksOnRelease) {
      for (const track of state.stream.getTracks()) {
        track.stop();
      }
    }

    state.stream = null;
  }

  state.streamKind = null;
  state.stopTracksOnRelease = false;

  if (clearVideo) {
    ui.video.srcObject = null;
  }
}

function resetAnalysisUi(statusMessage, logMessage) {
  clearCanvas();
  ui.poseCount.textContent = "0";
  ui.landmarkCount.textContent = "0";
  ui.renderFps.textContent = "0.0";
  ui.inferenceMs.textContent = "0.0 ms";
  ui.videoResolution.textContent = "-";
  endPlankHoldIfNeeded(performance.now());
  state.temporal = createTemporalState();
  state.activeTemporal = createActiveTemporalState(getSelectedExercise());
  state.autoDetection = createAutoDetectionState();
  state.missingPoseFrames = 0;
  state.analysisStartedAt = 0;
  state.analysisEngine.reset(getSelectedExercise(), getSelectedExerciseMeta());
  resetCurlScoutState();
  renderEmptyTemporalSnapshot();
  renderIdleResult(statusMessage, "待机");
  setCameraStatus(statusMessage);
  setLog(logMessage);
}

function stopAnalysisRuntime(statusMessage, logMessage) {
  state.cameraRunning = false;
  cancelRenderLoop();
  clearActiveStream();
  resetAnalysisUi(statusMessage, logMessage);
}

async function activateStream(stream, { kind, stopTracksOnRelease, statusMessage, logMessage }) {
  cancelRenderLoop();
  clearActiveStream();
  state.stream = stream;
  state.streamKind = kind;
  state.stopTracksOnRelease = stopTracksOnRelease;
  ui.video.srcObject = stream;
  await ui.video.play();
  state.cameraRunning = true;
  state.missingPoseFrames = 0;
  state.lastVideoTime = -1;
  state.renderFrames = 0;
  state.lastFpsSampleTime = performance.now();
  state.analysisStartedAt = performance.now();
  setCameraStatus(statusMessage);
  setLog(logMessage);
  renderLoop();
}

function closePeerController() {
  state.peerController?.close();
  state.peerController = null;
  state.remoteSession.peerState = "idle";
  state.remoteSession.connectionState = "idle";
  state.remoteSession.remoteStreamActive = false;
}

function closeSignalingClient() {
  state.signalingClient?.close();
  state.signalingClient = null;
  state.remoteSession.signalingState = "idle";
}

function closeRemoteSession() {
  closePeerController();
  closeSignalingClient();
  resetRemoteSessionState();
  renderRemoteSessionState();
}

async function createSession() {
  const response = await fetch("/api/session/create");

  if (!response.ok) {
    throw new Error(`创建会话失败：HTTP ${response.status}`);
  }

  const payload = await response.json();
  const publicOrigin = resolvePublicOrigin(payload.preferredOrigin);
  const joinUrl = buildJoinUrl(payload.sessionId, publicOrigin);
  const qrPayload = await QRCode.toDataURL(joinUrl, {
    width: 240,
    margin: 1,
    color: {
      dark: "#edf4ff",
      light: "#0000",
    },
  });

  state.remoteSession = {
    ...createRtcSessionState("analyzer"),
    sessionId: payload.sessionId,
    signalPath: payload.signalPath ?? "/signal",
    joinUrl,
    qrDataUrl: qrPayload,
  };
  renderRemoteSessionState();
  setLog(`手机接入会话已创建。当前二维码使用局域网地址：${joinUrl}`);

  return {
    sessionId: payload.sessionId,
    joinUrl,
    qrPayload,
  };
}

function handleRemoteSessionError(message) {
  state.remoteSession.lastError = message;
  state.remoteSession.peerState = "idle";
  state.remoteSession.connectionState = "idle";
  stopAnalysisRuntime("手机接入异常", message);
  closePeerController();
  renderRemoteSessionState();
}

function handleRemotePeerLeft(message = "手机端已断开，等待重新接入。") {
  closePeerController();
  stopAnalysisRuntime("等待手机重连", message);
  state.remoteSession.lastError = "";
  renderRemoteSessionState();
}

async function beginRemoteNegotiation() {
  closePeerController();
  setLog("手机已加入会话，电脑端开始创建 WebRTC offer。");
  state.peerController = createRtcPeer({
    onIceCandidate: (candidate) => {
      setLog("电脑端已生成 ICE candidate，正在发送给手机端。");
      state.signalingClient?.send("webrtc:ice-candidate", { candidate });
    },
    onRemoteStream: async (stream) => {
      state.remoteSession.connectionState = "connected";
      state.remoteSession.remoteStreamActive = true;
      state.remoteSession.lastError = "";
      renderRemoteSessionState();
      setLog(`已收到手机视频轨，共 ${stream.getVideoTracks().length} 条视频轨，准备在电脑端渲染并分析。`);
      await activateStream(stream, {
        kind: "remote",
        stopTracksOnRelease: false,
        statusMessage: "手机画面分析中",
        logMessage: `手机已接入，正在按${getSelectedExerciseMeta().label}规则分析动作。`,
      });
    },
    onConnectionStateChange: (connectionState) => {
      state.remoteSession.connectionState = connectionState;

      if (connectionState === "failed" || connectionState === "closed") {
        handleRemotePeerLeft("手机视频连接已断开，等待重新接入。");
        return;
      }

      renderRemoteSessionState();
    },
  });

  const offer = await state.peerController.createOffer();
  setLog("电脑端已发送 offer，等待手机返回 answer。");
  state.signalingClient?.send("webrtc:offer", { description: offer });
}

async function connectRemoteStream(sessionId) {
  state.remoteSession.sessionId = sessionId;
  state.remoteSession.signalingState = "connecting";
  state.remoteSession.lastError = "";
  renderRemoteSessionState();

  state.signalingClient = createSignalingClient({
    sessionId,
    role: "analyzer",
    signalPath: state.remoteSession.signalPath,
    onOpen: () => {
      state.remoteSession.signalingState = "connected";
      renderRemoteSessionState();
    },
    onClose: () => {
      if (state.remoteSession.sessionId) {
        state.remoteSession.signalingState = "closed";
        renderRemoteSessionState();
      }
    },
    onError: (error) => {
      handleRemoteSessionError(`信令连接异常。${error instanceof Error ? error.message : String(error)}`);
    },
    onMessage: async (message) => {
      try {
        switch (message.type) {
          case "session:joined":
            state.remoteSession.signalingState = "connected";
            state.remoteSession.lastError = "";
            renderRemoteSessionState();
            setLog(`电脑端已加入会话 ${message.sessionId}，等待手机接入。`);
            return;
          case "peer:joined":
            if (message.role === "mobile") {
              state.remoteSession.peerState = "joined";
              renderRemoteSessionState();
              await beginRemoteNegotiation();
            }
            return;
          case "webrtc:answer":
            setLog("电脑端已收到手机返回的 answer。");
            console.log("webrtc:answer keys:", Object.keys(message.description ?? {}));
            await state.peerController?.applyAnswer(message.description);
            return;
          case "webrtc:ice-candidate":
            setLog("电脑端已收到手机端 ICE candidate。");
            console.log("webrtc:ice-candidate keys:", Object.keys(message.candidate ?? {}));
            await state.peerController?.addIceCandidate(message.candidate);
            return;
          case "peer:left":
            handleRemotePeerLeft();
            return;
          case "session:error":
            handleRemoteSessionError(message.message ?? "远端会话发生错误。");
            return;
          default:
            return;
        }
      } catch (err) {
        console.error("onMessage error:", err, "type:", message.type);
        setLog(`处理信令失败。${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });

  await state.signalingClient.connect();
}

async function startLocalSource() {
  if (state.cameraRunning || state.isReloading) {
    return;
  }

  try {
    await ensurePoseLandmarker();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    await activateStream(stream, {
      kind: "local",
      stopTracksOnRelease: true,
      statusMessage: "摄像头运行中",
      logMessage: `摄像头已启动，正在按${getSelectedExerciseMeta().label}规则分析动作。`,
    });
  } catch (error) {
    setCameraStatus("启动失败");
    setLog(`启动失败。请检查模型资源和摄像头权限。${error instanceof Error ? error.message : String(error)}`);
  }
}

async function startRemoteSource() {
  if (state.isReloading) {
    return;
  }

  try {
    stopCamera();
    await ensurePoseLandmarker();
    const session = await createSession();
    resetAnalysisUi("等待手机接入", "手机接入会话已创建，等待手机扫码。");
    await connectRemoteStream(session.sessionId);
    renderRemoteSessionState();
  } catch (error) {
    handleRemoteSessionError(`创建手机会话失败。${error instanceof Error ? error.message : String(error)}`);
  }
}

function endPlankHoldIfNeeded(now) {
  const recognition = state.recognition.plank;
  const holdDurationSeconds = recognition.holding
    ? Math.max(recognition.currentHoldSeconds, (now - recognition.holdStartedAt) / 1000)
    : recognition.currentHoldSeconds;

  if (recognition.holding) {
    recognition.currentHoldSeconds = holdDurationSeconds;
    recognition.bestHoldSeconds = Math.max(recognition.bestHoldSeconds, recognition.currentHoldSeconds);
  }

  if (recognition.holding && recognition.holdStartedAt > 0 && holdDurationSeconds >= 2) {
    recognition.holdCount += 1;
    recognition.holdSegments.push({
      startAt: recognition.holdStartedAt,
      endAt: now,
      durationSeconds: holdDurationSeconds,
    });
  }

  recognition.holding = false;
  recognition.holdStartedAt = 0;
  recognition.currentHoldSeconds = 0;
}

function stopCamera() {
  stopAnalysisRuntime("视频源未启动", "视频源已停止。");
  closeRemoteSession();
}

function applyMirrorTransform() {
  const transform = ui.mirrorToggle.checked ? "scaleX(-1)" : "scaleX(1)";
  ui.video.style.transform = transform;
  ui.canvas.style.transform = transform;
}

function handleMissingPose(now, { render = true } = {}) {
  state.missingPoseFrames += 1;

  if (state.missingPoseFrames <= MISSING_POSE_GRACE_FRAMES) {
    if (render) {
      renderExerciseResult(buildPoseGraceResult(now));
    }
    return;
  }

  endPlankHoldIfNeeded(now);
  state.analysisEngine.handleMissing(now);
  state.temporal = createTemporalState();
  state.activeTemporal = createActiveTemporalState(getSelectedExercise());
  state.autoDetection = createAutoDetectionState();
  state.missingPoseFrames = MISSING_POSE_GRACE_FRAMES;
  resetCurlScoutState();

  if (render) {
    renderEmptyTemporalSnapshot();
    renderIdleResult("未检测到人体", "待检测");
  }
}

function renderLoop() {
  if (!state.cameraRunning || !state.poseLandmarker) {
    return;
  }

  const now = performance.now();
  resizeCanvasToVideo();
  clearCanvas();
  updateRenderFps(now);

  if (ui.video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = ui.video.currentTime;

    const start = performance.now();
    const result = state.poseLandmarker.detectForVideo(ui.video, now);
    const inferenceMs = performance.now() - start;
    const poses = result.landmarks ?? [];

    updateInferenceMetric(inferenceMs);
    ui.poseCount.textContent = String(poses.length);
    ui.landmarkCount.textContent = poses[0] ? String(poses[0].length) : "0";

    if (poses[0]) {
      if (!state.analysisStartedAt) {
        state.analysisStartedAt = now;
      }
      state.missingPoseFrames = 0;
      drawLandmarks(poses[0]);
      const exerciseMetrics = computeTemporalFeatures(poses[0], now, state.activeTemporal, { renderSnapshot: true });
      renderExerciseResult(state.analysisEngine.analyzeFrame(exerciseMetrics, now));
    } else {
      handleMissingPose(now);
    }
  }

  state.animationFrameId = requestAnimationFrame(renderLoop);
}

async function reloadModel() {
  if (state.isReloading) {
    return;
  }

  state.isReloading = true;
  const previousSourceMode = state.sourceMode;
  const shouldRestart = state.cameraRunning || (previousSourceMode === "remote" && Boolean(state.remoteSession.sessionId));

  try {
    if (shouldRestart) {
      stopCamera();
    }

    setLog("正在重新加载模型配置...");
    await createPoseLandmarker();

    if (shouldRestart) {
      if (previousSourceMode === "remote") {
        await startRemoteSource();
      } else {
        await startLocalSource();
      }
    }
  } catch (error) {
    setLog(`模型重载失败。${error instanceof Error ? error.message : String(error)}`);
  } finally {
    state.isReloading = false;
  }
}

async function applyThresholdSettings() {
  updateThresholdLabels();

  if (!state.poseLandmarker || state.isReloading) {
    return;
  }

  try {
    await state.poseLandmarker.setOptions({
      minPoseDetectionConfidence: Number(ui.detectionThreshold.value),
      minTrackingConfidence: Number(ui.trackingThreshold.value),
    });
    setLog("阈值已更新。");
  } catch (error) {
    setLog(`阈值更新失败。${error instanceof Error ? error.message : String(error)}`);
  }
}

function createEmptyScoreMap() {
  return {
    squat: 0,
    pushup: 0,
    plank: 0,
    curl: 0,
  };
}

function getExerciseSummary(exerciseKey, now) {
  const summary = state.analysisEngine.getSummary(now);

  if (exerciseKey === "plank") {
    return {
      holdCount: summary.count,
      bestHoldSeconds: summary.bestHoldSeconds,
      currentHoldSeconds: summary.liveHoldSeconds,
      falsePositiveCount: summary.falsePositiveCount,
      missedCount: summary.missedCount,
    };
  }

  return {
    reps: summary.count,
    cadenceRpm: summary.cadenceRpm,
    cadenceText: formatCadence(summary.cadenceRpm ?? 0),
    falsePositiveCount: summary.falsePositiveCount,
    missedCount: summary.missedCount,
  };
}

function createEvaluationVideoElement(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.style.display = "none";

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    };
    const handleLoadedMetadata = () => {
      cleanup();
      resolve(video);
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`视频加载失败：${videoUrl}`));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleError, { once: true });
    document.body.appendChild(video);
    video.src = videoUrl;
    video.load();
  });
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const clampedTime = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.001)));
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("视频跳帧失败"));
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = clampedTime;
  });
}

function summarizeEvaluation(results) {
  const total = results.length;
  const correct = results.filter((result) => result.dominantExercise === result.expectedExercise).length;
  const avgCorrectFrameRatio = total
    ? results.reduce((sum, result) => sum + result.correctFrameRatio, 0) / total
    : 0;
  const avgPoseCoverage = total
    ? results.reduce((sum, result) => sum + result.poseCoverage, 0) / total
    : 0;

  return {
    totalVideos: total,
    correctTop1: correct,
    top1Accuracy: total ? correct / total : 0,
    averageCorrectFrameRatio: avgCorrectFrameRatio,
    averagePoseCoverage: avgPoseCoverage,
  };
}

async function evaluateVideo(videoUrl, expectedExercise, options = {}) {
  const sampleFps = options.sampleFps ?? 12;
  const samplingStep = sampleFps > 0 ? 1 / sampleFps : 1 / 12;
  const timestampOffsetMs = options.timestampOffsetMs ?? 0;
  const expectedCount = options.expectedCount ?? null;

  stopCamera();
  await ensurePoseLandmarker();
  setSelectedExercise(expectedExercise);
  resetAllExerciseStats();

  const video = await createEvaluationVideoElement(videoUrl);
  const duration = video.duration || 0;
  const totalFrames = Math.max(1, Math.floor(duration / samplingStep) + 1);
  const timeline = [];
  let poseFrames = 0;
  let secondMarker = -1;

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const time = Math.min(frameIndex * samplingStep, Math.max(0, duration - 0.001));
      const timestampMs = timestampOffsetMs + (time * 1000);
      await seekVideo(video, time);

      const result = state.poseLandmarker.detectForVideo(video, timestampMs);
      const poses = result.landmarks ?? [];

      if (!poses[0]) {
        handleMissingPose(timestampMs, { render: false });
        continue;
      }

      if (!state.analysisStartedAt) {
        state.analysisStartedAt = timestampMs;
      }
      state.missingPoseFrames = 0;
      poseFrames += 1;

      const exerciseMetrics = computeTemporalFeatures(poses[0], timestampMs, state.activeTemporal);
      const analysis = state.analysisEngine.analyzeFrame(exerciseMetrics, timestampMs);
      const summary = state.analysisEngine.getSummary(timestampMs);

      const currentSecond = Math.floor(time);
      if (currentSecond !== secondMarker) {
        secondMarker = currentSecond;
        timeline.push({
          second: currentSecond,
          count: summary.count,
          cadenceRpm: summary.cadenceRpm ?? 0,
          calibrationStatus: analysis.calibrationStatus,
          phase: analysis.rate,
          phaseSummary: analysis.phase,
        });
      }
    }
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }

  const summary = getExerciseSummary(expectedExercise, duration * 1000);
  const poseCoverage = poseFrames / totalFrames;
  const firstEventSeconds = state.analysisEngine.getSummary(duration * 1000).firstEventAtMs !== null
    ? (state.analysisEngine.getSummary(duration * 1000).firstEventAtMs - timestampOffsetMs) / 1000
    : null;
  const detectedCount = expectedExercise === "plank" ? summary.holdCount : summary.reps;
  const falsePositiveCount = expectedCount === null ? null : Math.max(0, detectedCount - expectedCount);
  const missedCount = expectedCount === null ? null : Math.max(0, expectedCount - detectedCount);

  return {
    videoUrl,
    expectedExercise,
    analyzedExercise: expectedExercise,
    expectedCount,
    durationSeconds: duration,
    sampleFps,
    sampledFrames: totalFrames,
    poseFrames,
    poseCoverage,
    detectedCount,
    firstEventSeconds,
    falsePositiveCount,
    missedCount,
    summary,
    timeline,
  };
}

async function evaluateVideos(videoItems, options = {}) {
  const results = [];
  let timestampOffsetMs = 0;

  for (const item of videoItems) {
    const result = await evaluateVideo(item.videoUrl, item.expectedExercise, {
      ...options,
      expectedCount: item.expectedCount ?? null,
      timestampOffsetMs,
    });
    results.push({
      name: item.name,
      ...result,
    });
    timestampOffsetMs += (result.durationSeconds * 1000) + 1000;
  }

  return {
    generatedAt: new Date().toISOString(),
    options: {
      sampleFps: options.sampleFps ?? 12,
    },
    summary: summarizeEvaluation(results),
    results,
  };
}

function resetAllExerciseStats() {
  endPlankHoldIfNeeded(performance.now());
  state.recognition = createRecognitionState();
  state.autoDetection = createAutoDetectionState();
  state.temporal = createTemporalState();
  state.activeTemporal = createActiveTemporalState(getSelectedExercise());
  state.missingPoseFrames = 0;
  state.analysisStartedAt = 0;
  state.analysisEngine.reset(getSelectedExercise(), getSelectedExerciseMeta());
  resetCurlScoutState();
  renderEmptyTemporalSnapshot();
  renderIdleResult("统计已重置", "待机");
  setLog(`${getSelectedExerciseMeta().label}分析统计已重置。`);
}

function setSelectedExercise(exerciseKey) {
  if (!EXERCISES[exerciseKey]) {
    return;
  }

  state.selectedExercise = exerciseKey;
  state.temporal = createTemporalState();
  state.activeTemporal = createActiveTemporalState(exerciseKey);
  state.autoDetection = createAutoDetectionState();
  state.missingPoseFrames = 0;
  state.analysisStartedAt = 0;
  state.analysisEngine.reset(exerciseKey, EXERCISES[exerciseKey]);
  resetCurlScoutState();
  endPlankHoldIfNeeded(performance.now());
  state.recognition = createRecognitionState();
  renderEmptyTemporalSnapshot();
  renderIdleResult(`已切换到${EXERCISES[exerciseKey].label}分析`, "待机");
  setLog(`当前仅分析 ${EXERCISES[exerciseKey].label}。启动摄像头后将只按这一种动作规则输出次数和时间频率轴。`);
}

ui.startButton.addEventListener("click", () => {
  if (state.sourceMode === "remote") {
    startRemoteSource();
    return;
  }

  startLocalSource();
});

ui.stopButton.addEventListener("click", () => {
  stopCamera();
});

ui.reloadButton.addEventListener("click", () => {
  reloadModel();
});

ui.resetActionButton.addEventListener("click", () => {
  resetAllExerciseStats();
});

ui.exerciseSelect.addEventListener("change", () => {
  setSelectedExercise(ui.exerciseSelect.value);
});

ui.sourceSelect.addEventListener("change", () => {
  stopCamera();
  setSourceMode(ui.sourceSelect.value);

  if (state.sourceMode === "remote") {
    resetAnalysisUi("等待创建手机会话", "已切换到手机接入模式。创建会话后，手机扫码即可把前置摄像头画面传到当前页面。");
  } else {
    resetAnalysisUi("等待本机摄像头", "已切换到本机摄像头模式。点击“启动摄像头”开始分析。");
  }

  renderRemoteSessionState();
});

ui.modelSelect.addEventListener("change", () => {
  reloadModel();
});

ui.mirrorToggle.addEventListener("change", () => {
  applyMirrorTransform();
});

ui.detectionThreshold.addEventListener("input", updateThresholdLabels);
ui.trackingThreshold.addEventListener("input", updateThresholdLabels);
ui.detectionThreshold.addEventListener("change", applyThresholdSettings);
ui.trackingThreshold.addEventListener("change", applyThresholdSettings);
ui.copySessionLinkButton.addEventListener("click", async () => {
  if (!state.remoteSession.joinUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.remoteSession.joinUrl);
    setLog("手机接入链接已复制到剪贴板。");
  } catch (error) {
    setLog(`复制链接失败。${error instanceof Error ? error.message : String(error)}`);
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
  state.poseLandmarker?.close();
});

window.poseAppDebug = {
  createSession,
  connectRemoteStream,
  disconnectRemoteStream: stopCamera,
  startLocalSource,
  stopCurrentSource: stopCamera,
  evaluateVideo,
  evaluateVideos,
};

updateThresholdLabels();
applyMirrorTransform();
setSourceMode(ui.sourceSelect.value);
renderRemoteSessionState();
state.selectedExercise = ui.exerciseSelect.value;
state.activeTemporal = createActiveTemporalState(state.selectedExercise);
renderEmptyTemporalSnapshot();
renderIdleResult("等待开始", "待机");
setLog("页面已就绪。可选择本机摄像头直接分析，或切换到手机接入模式生成二维码。");
