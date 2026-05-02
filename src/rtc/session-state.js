export const SIGNAL_PATH = "/signal";
export const MOBILE_ENTRY_PATH = "/mobile.html";

export function createRtcSessionState(role = "analyzer") {
  return {
    role,
    sessionId: "",
    joinUrl: "",
    qrDataUrl: "",
    signalPath: SIGNAL_PATH,
    signalingState: "idle",
    peerState: "idle",
    connectionState: "idle",
    remoteStreamActive: false,
    lastError: "",
  };
}

export function buildJoinUrl(sessionId, origin = window.location.origin) {
  return `${origin}${MOBILE_ENTRY_PATH}?sessionId=${encodeURIComponent(sessionId)}`;
}

export function resolvePublicOrigin(preferredOrigin, fallbackOrigin = window.location.origin) {
  if (preferredOrigin && typeof preferredOrigin === "string") {
    return preferredOrigin;
  }

  return fallbackOrigin;
}

export function buildSignalUrl(path = SIGNAL_PATH, origin = window.location.origin) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path.startsWith("/") ? path : `/${path}`}`;
}
