import "./style.css";
import { createRtcPeer } from "./rtc/peer-connection.js";
import { createSignalingClient } from "./rtc/signaling-client.js";
import { createRtcSessionState } from "./rtc/session-state.js";

const ui = {
  preview: document.querySelector("#mobile-preview"),
  status: document.querySelector("#mobile-status"),
  sessionCode: document.querySelector("#mobile-session-code"),
  streamState: document.querySelector("#mobile-stream-state"),
  networkState: document.querySelector("#mobile-network-state"),
  startButton: document.querySelector("#mobile-start-button"),
  stopButton: document.querySelector("#mobile-stop-button"),
  switchCameraButton: document.querySelector("#mobile-switch-camera-button"),
  logBox: document.querySelector("#mobile-log-box"),
};

const state = {
  session: createRtcSessionState("mobile"),
  signaling: null,
  peer: null,
  stream: null,
  facingMode: "user",
  streaming: false,
};

const sessionId = new URLSearchParams(window.location.search).get("sessionId")?.trim().toUpperCase() ?? "";

ui.sessionCode.textContent = sessionId ? `会话码 ${sessionId}` : "会话码 缺失";

if (!sessionId) {
  setStatus("缺少会话码");
  setStreamState("无法启动");
  setNetworkState("未加入");
  setLog("链接缺少 sessionId，请重新扫码进入。");
  ui.startButton.disabled = true;
} else {
  state.session.sessionId = sessionId;
  if (!window.isSecureContext) {
    setLog("当前页面不是安全上下文，手机浏览器通常会拒绝摄像头。请改用二维码里的 HTTPS 地址。");
  } else {
    setLog("页面已就绪。点击“启动前摄推流”后会接入电脑端会话。");
  }
}

ui.startButton.addEventListener("click", () => {
  startStreaming();
});

ui.stopButton.addEventListener("click", () => {
  stopStreaming();
});

ui.switchCameraButton.addEventListener("click", () => {
  switchCamera();
});

window.addEventListener("beforeunload", () => {
  stopStreaming();
});

async function startStreaming() {
  if (!sessionId || state.streaming) {
    return;
  }

  try {
    assertCapturePrerequisites();
    await ensureLocalStream();
    await connectSignaling();
    state.streaming = true;
    setStatus("等待电脑协商");
    setStreamState(`已启动 ${cameraLabel()}`);
    setNetworkState("信令已连接");
    setLog("本机预览已启动，等待电脑端发起 WebRTC 协商。");
  } catch (error) {
    state.streaming = false;
    setStatus("启动失败");
    setNetworkState("连接失败");
    setLog(formatMobileError(error));
  }
}

function stopStreaming({ preservePreview = false } = {}) {
  closePeer();
  closeSignaling();
  state.streaming = false;

  if (!preservePreview) {
    stopLocalStream();
    ui.preview.srcObject = null;
    setStreamState("未启动");
  }

  setNetworkState("待连接");
  setStatus("已停止");
  setLog("手机端推流已停止。");
}

async function switchCamera() {
  state.facingMode = state.facingMode === "user" ? "environment" : "user";

  try {
    const wasStreaming = state.streaming;
    stopLocalStream();
    await ensureLocalStream();

    if (wasStreaming && state.peer) {
      const nextVideoTrack = state.stream?.getVideoTracks?.()[0] ?? null;

      if (nextVideoTrack) {
        await state.peer.replaceVideoTrack(nextVideoTrack);
      }
    }

    setStreamState(`已启动 ${cameraLabel()}`);
    setLog(`已切换到${cameraLabel()}。`);
  } catch (error) {
    setLog(`切换摄像头失败。${error instanceof Error ? error.message : String(error)}`);
  }
}

async function ensureLocalStream() {
  if (state.stream) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持 getUserMedia，或页面不是安全上下文。");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: state.facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 24 },
    },
  });

  state.stream = stream;
  ui.preview.srcObject = stream;
  await ui.preview.play();
}

function stopLocalStream() {
  if (!state.stream) {
    return;
  }

  for (const track of state.stream.getTracks()) {
    track.stop();
  }

  state.stream = null;
}

async function connectSignaling() {
  if (state.signaling) {
    return;
  }

  state.signaling = createSignalingClient({
    sessionId,
    role: "mobile",
    onOpen: () => {
      state.session.signalingState = "connected";
      setNetworkState("信令已连接");
    },
    onClose: () => {
      state.session.signalingState = "closed";
      setNetworkState("信令已断开");
    },
    onError: (error) => {
      setNetworkState("信令异常");
      setLog(`信令异常。${error instanceof Error ? error.message : String(error)}`);
    },
    onMessage: async (message) => {
      try {
        await handleSignalMessage(message);
      } catch (error) {
        setLog(`处理信令失败。${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  await state.signaling.connect();
}

function closeSignaling() {
  state.signaling?.close();
  state.signaling = null;
}

function closePeer() {
  state.peer?.close();
  state.peer = null;
}

async function handleSignalMessage(message) {
  try {
    switch (message.type) {
      case "session:joined":
        setStatus("已加入会话");
        setLog(`已加入会话 ${message.sessionId}，等待电脑端。`);
        return;
      case "peer:joined":
        setStatus("分析端在线");
        setNetworkState("等待协商");
        setLog("电脑端已在线，等待接收 offer。");
        return;
      case "webrtc:offer":
        setLog("手机端已收到电脑端 offer，开始生成 answer。");
        console.log("webrtc:offer description keys:", Object.keys(message.description ?? {}));
        await handleOffer(message.description);
        return;
      case "webrtc:ice-candidate":
        setLog("手机端已收到电脑端 ICE candidate。");
        console.log("webrtc:ice-candidate candidate keys:", Object.keys(message.candidate ?? {}));
        await state.peer?.addIceCandidate(message.candidate);
        return;
      case "peer:left":
        closePeer();
        setStatus("等待电脑重连");
        setNetworkState("对端已断开");
        setLog("电脑端已断开，保持本机预览，等待重新连接。");
        return;
      case "session:error":
        closePeer();
        setStatus("会话错误");
        setNetworkState("会话关闭");
        setLog(message.message ?? "会话发生错误。");
        return;
      default:
        return;
    }
  } catch (err) {
    console.error("handleSignalMessage error:", err, "message type:", message?.type, "message:", JSON.stringify(message));
    setLog(`处理信令失败。${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleOffer(description) {
  await ensureLocalStream();
  closePeer();
  state.peer = createRtcPeer({
    localStream: state.stream,
    onIceCandidate: (candidate) => {
      setLog("手机端已生成 ICE candidate，正在发送给电脑端。");
      state.signaling?.send("webrtc:ice-candidate", { candidate });
    },
    onConnectionStateChange: (connectionState) => {
      setNetworkState(connectionStateLabel(connectionState));
      if (connectionState === "connected") {
        setStatus("推流中");
        setLog("WebRTC 已连通，电脑端正在接收手机视频流。");
      }
    },
  });

  await state.peer.acceptOffer(description);
  const answer = await state.peer.createAnswer();
  setLog("手机端已生成并发送 answer，等待 WebRTC 连通。");
  state.signaling?.send("webrtc:answer", { description: answer });
  setStatus("协商中");
  setNetworkState("协商中");
}

function cameraLabel() {
  return state.facingMode === "user" ? "前置摄像头" : "后置摄像头";
}

function connectionStateLabel(connectionState) {
  switch (connectionState) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "disconnected":
      return "已断开";
    case "failed":
      return "连接失败";
    case "closed":
      return "连接关闭";
    default:
      return "待连接";
  }
}

function setStatus(message) {
  ui.status.textContent = message;
}

function setStreamState(message) {
  ui.streamState.textContent = message;
}

function setNetworkState(message) {
  ui.networkState.textContent = message;
}

function setLog(message) {
  ui.logBox.textContent = message;
}

function assertCapturePrerequisites() {
  if (!window.isSecureContext) {
    throw new Error("当前页面不是 HTTPS 安全上下文，手机浏览器已拦截摄像头访问。请改用二维码里的 HTTPS 地址并接受证书提示。");
  }
}

function formatMobileError(error) {
  if (!(error instanceof Error)) {
    return `启动失败。${String(error)}`;
  }

  if (error.name === "NotAllowedError") {
    return "启动失败。浏览器拒绝了摄像头权限，请允许相机访问后重试。";
  }

  if (error.name === "NotFoundError") {
    return "启动失败。没有找到可用摄像头。";
  }

  if (error.name === "NotReadableError") {
    return "启动失败。摄像头可能正被其他应用占用。";
  }

  if (error.name === "OverconstrainedError") {
    return "启动失败。当前摄像头不支持请求的分辨率或帧率。";
  }

  return `启动失败。${error.message}`;
}
