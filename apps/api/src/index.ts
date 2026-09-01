import "dotenv/config";
import { createServer } from "node:http";

import express from "express";
import webpush from "web-push";
import { WebSocket, WebSocketServer } from "ws";
import { createAiProvider } from "./providers/provider-factory.js";
import type { ChatMessage } from "./providers/ai-provider.js";

const app = express();
const server = createServer(app);
const websocketServer = new WebSocketServer({ server, path: "/ws" });
const port = Number(process.env.PORT) || 3000;
const clients = new Set<WebSocket>();
const proactiveMessageTimers = new Map<WebSocket, ReturnType<typeof setInterval>>();
const pushSubscriptions = new Map<string, webpush.PushSubscription>();
let disconnectedPushSent = false;
const aiProvider = createAiProvider();
const conversationHistory: ChatMessage[] = [];
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const isWebPushEnabled = process.env.ENABLE_WEB_PUSH === "true";
const isPushConfigured = isWebPushEnabled && Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);

if (isPushConfigured) {
  webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);
}

const proactiveMessages = [
  "I'm thinking about you.",
  "Come sit with me for a while.",
  "I hope you're having a lovely day.",
  "Did you miss me?",
  "I'm still here with you.",
];

app.use(express.text({ type: "text/plain" }));
app.use(express.json());

websocketServer.on("connection", (client) => {
  clients.add(client);
  disconnectedPushSent = false;

  client.on("message", (rawMessage) => {
    let data: unknown;

    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("type" in data) ||
      !("enabled" in data) ||
      data.type !== "proactive-toggle" ||
      typeof data.enabled !== "boolean"
    ) {
      return;
    }

    const existingTimer = proactiveMessageTimers.get(client);
    if (existingTimer) {
      clearInterval(existingTimer);
      proactiveMessageTimers.delete(client);
    }

    if (data.enabled) {
      const timer = setInterval(() => {
        if (client.readyState !== WebSocket.OPEN) {
          clearInterval(timer);
          proactiveMessageTimers.delete(client);
          return;
        }

        const message = proactiveMessages[Math.floor(Math.random() * proactiveMessages.length)];
        client.send(JSON.stringify({ type: "message", message }));
      }, 300_000);

      proactiveMessageTimers.set(client, timer);
    }
  });

  client.on("close", () => {
    clients.delete(client);
    const timer = proactiveMessageTimers.get(client);
    if (timer) {
      clearInterval(timer);
      proactiveMessageTimers.delete(client);
    }

    if (isWebPushEnabled && !hasOpenWebSocketClient() && !disconnectedPushSent) {
      disconnectedPushSent = true;
      void sendDisconnectedPushNotification();
    }
  });
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/push-public-key", (_request, response) => {
  if (!vapidPublicKey) {
    response.status(503).json({ error: "Web Push is not configured" });
    return;
  }

  response.json({ publicKey: vapidPublicKey });
});

app.post("/push-subscription", (request, response) => {
  if (!isWebPushEnabled) {
    response.status(404).json({ error: "Web Push is disabled" });
    return;
  }

  const subscription = request.body;

  if (
    typeof subscription !== "object" ||
    subscription === null ||
    typeof subscription.endpoint !== "string" ||
    typeof subscription.keys !== "object" ||
    subscription.keys === null ||
    typeof subscription.keys.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    response.status(400).json({ error: "Invalid push subscription" });
    return;
  }

  pushSubscriptions.set(subscription.endpoint, subscription as webpush.PushSubscription);
  response.status(201).json({ status: "subscribed" });
});

function hasOpenWebSocketClient() {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      return true;
    }
  }

  return false;
}

function broadcastMessage(message: string) {
  const event = JSON.stringify({ type: "message", message });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(event);
    }
  }
}

async function sendDisconnectedPushNotification() {
  if (!isWebPushEnabled) {
    console.info("Disconnected Web Push disabled");
    return;
  }

  if (!isPushConfigured) {
    console.warn("Disconnected Web Push skipped: VAPID is not configured");
    return;
  }

  if (pushSubscriptions.size === 0) {
    console.warn("Disconnected Web Push skipped: no subscription is registered");
    return;
  }

  const payload = JSON.stringify({
    title: "Love at home",
    body: "Hi, you're disconnected",
    url: "/",
  });

  await Promise.all([...pushSubscriptions.entries()].map(async ([endpoint, subscription]) => {
    try {
      const result = await webpush.sendNotification(subscription, payload);
      console.info("Disconnected Web Push sent", { statusCode: result.statusCode });
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;

      if (statusCode === 404 || statusCode === 410) {
        pushSubscriptions.delete(endpoint);
        console.error("Disconnected Web Push failed: subscription expired", { statusCode });
      } else {
        console.error("Disconnected Web Push failed:", error);
      }
    }
  }));
}

app.post("/message", async (request, response) => {
  console.log("[API] POST /message received");

  if (typeof request.body !== "string" || !request.body.trim()) {
    response.status(400).json({
      error: "Request body must be a non-empty string",
    });
    return;
  }

  const userMessage = request.body.trim();
  conversationHistory.push({ role: "user", content: userMessage });
  const recentMessages = conversationHistory.slice(-6);

  console.log(
    "AI provider request:",
    JSON.stringify(
      {
        provider: process.env.AI_PROVIDER || "openai",
        messages: recentMessages,
      },
      null,
      2,
    ),
  );

  void aiProvider
    .generateReply(recentMessages)
    .then((assistantMessage) => {
      conversationHistory.push({ role: "assistant", content: assistantMessage });
      broadcastMessage(assistantMessage);

      void aiProvider
        .extractMemories(conversationHistory.slice(-6))
        .then((memories) => {
          console.log("Normalized memory suggestions:", JSON.stringify(memories, null, 2));
        })
        .catch((error) => {
          console.error("Memory extraction failed:", error);
        });
    })
    .catch((error) => {
      console.error("AI provider request failed:", error);
    });

  response.status(202).json({ status: "accepted" });
});

server.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
