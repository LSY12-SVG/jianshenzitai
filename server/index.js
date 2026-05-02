import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import selfsigned from "selfsigned";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const httpPort = Number(process.env.PORT ?? 8787);
const httpsPort = Number(process.env.HTTPS_PORT ?? 8788);
const clientPort = Number(process.env.CLIENT_PORT ?? 5173);
const sessionTtlMs = 2 * 60 * 60 * 1000;

const app = express();
const sessions = new Map();
const httpServer = createHttpServer(app);
const httpsCredentials = createSelfSignedCertificate();
const httpsServer = createHttpsServer(httpsCredentials, app);
const httpWss = new WebSocketServer({ server: httpServer, path: "/signal" });
const httpsWss = new WebSocketServer({ server: httpsServer, path: "/signal" });

app.use(express.json());

app.use((req, res, next) => {
  if (req.path.endsWith(".html") || req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/session/create", (_req, res) => {
  const sessionId = createSessionId();
  const publicOrigins = getPublicOrigins();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    analyzer: null,
    mobile: null,
  };

  sessions.set(sessionId, session);

  res.json({
    sessionId,
    mobilePath: "/mobile.html",
    signalPath: "/signal",
    publicOrigins,
    preferredOrigin: publicOrigins[0] ?? null,
    fallbackOrigin: getFallbackHttpOrigin(),
    createdAt: session.createdAt,
  });
});

attachSignalServer(httpWss);
attachSignalServer(httpsWss);

setInterval(() => {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > sessionTtlMs && !isSocketOpen(session.analyzer) && !isSocketOpen(session.mobile)) {
      sessions.delete(sessionId);
    }
  }
}, 10 * 60 * 1000).unref();

httpServer.listen(httpPort, "0.0.0.0", () => {
  console.log(`Signal server listening on http://0.0.0.0:${httpPort}`);
});

httpsServer.listen(httpsPort, "0.0.0.0", () => {
  console.log(`Secure app server listening on https://0.0.0.0:${httpsPort}`);
});

function attachSignalServer(wss) {
  wss.on("connection", (socket) => {
    const context = {
      sessionId: null,
      role: null,
    };

    socket.on("message", (rawMessage) => {
      let payload;

      try {
        payload = JSON.parse(rawMessage.toString());
      } catch {
        sendMessage(socket, "session:error", { message: "消息不是合法 JSON。" });
        return;
      }

      const { type } = payload ?? {};

      switch (type) {
        case "session:join":
          handleSessionJoin(socket, context, payload);
          return;
        case "webrtc:offer":
        case "webrtc:answer":
        case "webrtc:ice-candidate":
          relayMessage(socket, context, payload);
          return;
        default:
          sendMessage(socket, "session:error", { message: `不支持的消息类型：${type ?? "unknown"}` });
      }
    });

    socket.on("close", () => {
      handleSocketClose(socket, context);
    });

    socket.on("error", () => {
      handleSocketClose(socket, context);
    });
  });
}

function createSessionId() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function handleSessionJoin(socket, context, payload) {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim().toUpperCase() : "";
  const role = payload.role === "analyzer" || payload.role === "mobile" ? payload.role : "";

  if (!sessionId || !role) {
    sendMessage(socket, "session:error", { message: "缺少 sessionId 或 role。" });
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    sendMessage(socket, "session:error", { message: "会话不存在或已过期。" });
    return;
  }

  if (role === "analyzer" && isSocketOpen(session.analyzer) && session.analyzer !== socket) {
    sendMessage(socket, "session:error", { message: "该会话已有分析端在线。" });
    return;
  }

  if (role === "mobile" && isSocketOpen(session.mobile) && session.mobile !== socket) {
    sendMessage(socket, "session:error", { message: "该会话已有手机端在线。" });
    return;
  }

  session[role] = socket;
  session.createdAt = Date.now();
  context.sessionId = sessionId;
  context.role = role;

  sendMessage(socket, "session:joined", {
    sessionId,
    role,
  });

  const counterpartRole = role === "analyzer" ? "mobile" : "analyzer";
  const counterpartSocket = session[counterpartRole];

  if (isSocketOpen(counterpartSocket)) {
    sendMessage(counterpartSocket, "peer:joined", {
      sessionId,
      role,
    });
    sendMessage(socket, "peer:joined", {
      sessionId,
      role: counterpartRole,
    });
  }
}

function relayMessage(socket, context, payload) {
  const session = context.sessionId ? sessions.get(context.sessionId) : null;

  if (!session || !context.role) {
    sendMessage(socket, "session:error", { message: "请先加入会话。" });
    return;
  }

  const targetRole = context.role === "analyzer" ? "mobile" : "analyzer";
  const targetSocket = session[targetRole];

  if (!isSocketOpen(targetSocket)) {
    sendMessage(socket, "session:error", { message: "对端未连接，无法转发信令。" });
    return;
  }

  sendMessage(targetSocket, payload.type, {
    sessionId: context.sessionId,
    role: context.role,
    description: payload.description ?? null,
    candidate: payload.candidate ?? null,
  });
}

function handleSocketClose(socket, context) {
  if (!context.sessionId || !context.role) {
    return;
  }

  const session = sessions.get(context.sessionId);

  if (!session) {
    return;
  }

  if (session[context.role] === socket) {
    session[context.role] = null;
  }

  const counterpartRole = context.role === "analyzer" ? "mobile" : "analyzer";
  const counterpartSocket = session[counterpartRole];

  if (context.role === "analyzer") {
    if (isSocketOpen(counterpartSocket)) {
      sendMessage(counterpartSocket, "session:error", {
        message: "分析端已离开，会话已关闭。",
      });
      counterpartSocket.close();
    }
    sessions.delete(context.sessionId);
    return;
  }

  if (isSocketOpen(counterpartSocket)) {
    sendMessage(counterpartSocket, "peer:left", {
      sessionId: context.sessionId,
      role: context.role,
    });
  }

  if (!isSocketOpen(session.analyzer) && !isSocketOpen(session.mobile)) {
    sessions.delete(context.sessionId);
  }
}

function sendMessage(socket, type, payload = {}) {
  if (!isSocketOpen(socket)) {
    return;
  }

  socket.send(JSON.stringify({
    type,
    ...payload,
  }));
}

function isSocketOpen(socket) {
  return socket instanceof WebSocket && socket.readyState === WebSocket.OPEN;
}

function createSelfSignedCertificate() {
  const attrs = [{ name: "commonName", value: "Pose Remote Capture" }];
  const pems = selfsigned.generate(attrs, {
    algorithm: "sha256",
    days: 30,
    keySize: 2048,
    extensions: [
      {
        name: "basicConstraints",
        cA: true,
      },
      {
        name: "keyUsage",
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: "subjectAltName",
        altNames: getPublicOrigins()
          .map((origin, index) => {
            const hostname = new URL(origin).hostname;

            if (hostname === "localhost") {
              return { type: 2, value: hostname };
            }

            if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
              return { type: 7, ip: hostname };
            }

            return { type: 2, value: hostname, index };
          }),
      },
    ],
  });

  return {
    key: pems.private,
    cert: pems.cert,
  };
}

function getPublicOrigins() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [interfaceName, items] of Object.entries(interfaces)) {
    for (const item of items ?? []) {
      if (!item || item.family !== "IPv4" || item.internal) {
        continue;
      }

      const address = item.address;
      const normalizedName = interfaceName.toLowerCase();

      if (address === "127.0.0.1") {
        continue;
      }

      candidates.push({
        interfaceName,
        origin: `https://${address}:${httpsPort}`,
        score: getInterfacePriority(normalizedName, address),
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((item) => item.origin)
    .filter((origin, index, list) => list.indexOf(origin) === index);
}

function getFallbackHttpOrigin() {
  const publicOrigins = getPublicOrigins();

  if (!publicOrigins.length) {
    return `http://127.0.0.1:${clientPort}`;
  }

  const preferredUrl = new URL(publicOrigins[0]);
  return `http://${preferredUrl.hostname}:${clientPort}`;
}

function getInterfacePriority(interfaceName, address) {
  let score = 0;

  if (interfaceName.includes("wlan") || interfaceName.includes("wi-fi") || interfaceName.includes("wifi")) {
    score += 60;
  }

  if (interfaceName.includes("以太网") || interfaceName.includes("ethernet")) {
    score += 45;
  }

  if (interfaceName.includes("vmware") || interfaceName.includes("virtual") || interfaceName.includes("vethernet")) {
    score -= 100;
  }

  if (interfaceName.includes("bluetooth") || interfaceName.includes("蓝牙")) {
    score -= 80;
  }

  if (address.startsWith("172.") || address.startsWith("192.168.") || address.startsWith("10.")) {
    score += 20;
  }

  return score;
}
