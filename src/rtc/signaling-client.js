import { buildSignalUrl, SIGNAL_PATH } from "./session-state.js";

export function createSignalingClient({
  sessionId,
  role,
  signalPath = SIGNAL_PATH,
  onMessage,
  onOpen,
  onClose,
  onError,
} = {}) {
  let socket = null;

  async function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    await new Promise((resolve, reject) => {
      socket = new WebSocket(buildSignalUrl(signalPath));

      socket.addEventListener("open", () => {
        send("session:join", { sessionId, role });
        onOpen?.();
        resolve();
      }, { once: true });

      socket.addEventListener("error", (event) => {
        onError?.(event);
        reject(new Error("WebSocket 连接失败"));
      }, { once: true });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessage?.(payload);
        } catch (error) {
          onError?.(error);
        }
      });

      socket.addEventListener("close", (event) => {
        onClose?.(event);
      });
    });
  }

  function send(type, payload = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("信令通道尚未连接");
    }

    socket.send(JSON.stringify({
      type,
      sessionId,
      role,
      ...payload,
    }));
  }

  function close() {
    if (!socket) {
      return;
    }

    socket.close();
    socket = null;
  }

  function getReadyState() {
    return socket?.readyState ?? WebSocket.CLOSED;
  }

  return {
    connect,
    send,
    close,
    getReadyState,
  };
}
