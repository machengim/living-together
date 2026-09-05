import "dotenv/config";
import { createServer } from "node:http";

import express from "express";
import webpush from "web-push";
import { WebSocket, WebSocketServer } from "ws";
import {
  clearChatHistory,
  getActiveAiProvider,
  getRecentMessages,
  initializeDatabase,
  saveMessage,
  setActiveAiProvider,
} from "./database.js";
import {
  createAiProvider,
  getAvailableAiProviders,
  isAiProviderName,
  type AiProviderName,
} from "./providers/provider-factory.js";
import type { ChatMessage, TimeContext } from "./providers/ai-provider.js";

const app = express();
const server = createServer(app);
const websocketServer = new WebSocketServer({ server, path: "/ws" });
const port = Number(process.env.PORT) || 3000;
const clients = new Set<WebSocket>();
const proactiveMessageTimers = new Map<WebSocket, ReturnType<typeof setInterval>>();
const activeReplyControllers = new Map<string, AbortController>();
const pushSubscriptions = new Map<string, webpush.PushSubscription>();
let disconnectedPushSent = false;
let activeAiProviderName: AiProviderName = "ollama";
let aiProvider = createAiProvider(activeAiProviderName);
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
      typeof data.type !== "string"
    ) {
      return;
    }

    if (
      data.type === "cancel-message" &&
      "id" in data &&
      typeof data.id === "string"
    ) {
      activeReplyControllers.get(data.id)?.abort();
      return;
    }

    if (
      data.type !== "proactive-toggle" ||
      !("enabled" in data) ||
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

app.get("/ai-provider", (_request, response) => {
  response.json({
    activeProvider: activeAiProviderName,
    availableProviders: getAvailableAiProviders(),
  });
});

app.post("/ai-provider", async (request, response) => {
  const provider = request.body?.provider;

  if (typeof provider !== "string" || !isAiProviderName(provider)) {
    response.status(400).json({ error: "Unsupported AI provider" });
    return;
  }

  if (!getAvailableAiProviders().includes(provider)) {
    response.status(503).json({ error: "AI provider is not configured" });
    return;
  }

  try {
    const nextProvider = createAiProvider(provider);
    const previousProvider = activeAiProviderName;
    activeAiProviderName = provider;
    aiProvider = nextProvider;
    await setActiveAiProvider(provider);
    console.log(`[API] AI provider changed from ${previousProvider} to ${provider}`);
    response.json({ activeProvider: provider });
  } catch (error) {
    console.error("[API] AI provider change failed:", error);
    response.status(500).json({ error: "Could not change AI provider" });
  }
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
  broadcastEvent({ type: "message", message });
}

function broadcastEvent(eventData: Record<string, unknown>) {
  const event = JSON.stringify(eventData);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(event);
    }
  }
}

function createReplyId() {
  return `${Date.now()}-${Math.random()}`;
}

async function generateAndBroadcastReply(
  provider: ReturnType<typeof createAiProvider>,
  messages: ChatMessage[],
  timeContext: TimeContext,
) {
  if (provider.generateReplyStream) {
    const replyId = createReplyId();
    const abortController = new AbortController();
    activeReplyControllers.set(replyId, abortController);
    let assistantMessage = "";
    broadcastEvent({ type: "message-start", id: replyId });

    try {
      for await (const chunk of provider.generateReplyStream(
        messages,
        timeContext,
        abortController.signal,
      )) {
        assistantMessage += chunk;
        broadcastEvent({ type: "message-delta", id: replyId, text: chunk });
      }

      if (!assistantMessage.trim()) {
        throw new Error("AI provider returned an empty streamed response");
      }

      await saveMessage({ role: "assistant", content: assistantMessage });
      broadcastEvent({ type: "message-end", id: replyId, message: assistantMessage });
    } catch (error) {
      if (abortController.signal.aborted) {
        broadcastEvent({ type: "message-cancelled", id: replyId });
      } else {
        broadcastEvent({ type: "message-error", id: replyId });
      }
      activeReplyControllers.delete(replyId);
      throw error;
    }

    activeReplyControllers.delete(replyId);
  } else {
    const assistantMessage = await provider.generateReply(messages, timeContext);
    await saveMessage({ role: "assistant", content: assistantMessage });
    broadcastMessage(assistantMessage);
  }

  const updatedMessages = await getRecentMessages(6);
  const memories = await provider.extractMemories(updatedMessages);
  console.log("Normalized memory suggestions:", JSON.stringify(memories, null, 2));
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

app.post("/reset-game", (_request, response) => {
  void clearChatHistory()
    .then(() => {
      broadcastEvent({ type: "reset" });
      console.log("[API] Game reset");
      response.json({ status: "reset" });
    })
    .catch((error) => {
      console.error("[API] Game reset failed:", error);
      response.status(500).json({ error: "Could not reset the game" });
    });
});

app.post("/message", async (request, response) => {
  console.log("[API] POST /message received");

  if (typeof request.body !== "string" || !request.body.trim()) {
    response.status(400).json({
      error: "Request body must be a non-empty string",
    });
    return;
  }

  const userMessage = request.body.trim();
  const timeContext: TimeContext = {
    utcTime: new Date().toISOString(),
    timeZone: request.header("x-user-timezone") || "UTC",
    localTime: request.header("x-user-local-time") || new Date().toISOString(),
  };

  try {
    await saveMessage({ role: "user", content: userMessage });
  } catch (error) {
    console.error("Failed to save user message:", error);
    response.status(503).json({ error: "Could not save the message" });
    return;
  }

  let recentMessages: ChatMessage[];

  try {
    recentMessages = await getRecentMessages(6);
  } catch (error) {
    console.error("Failed to load chat history:", error);
    response.status(503).json({ error: "Could not load chat history" });
    return;
  }

  console.log(
    "AI provider request:",
    JSON.stringify(
      {
        provider: activeAiProviderName,
        messages: recentMessages,
        timeContext,
      },
      null,
      2,
    ),
  );

  void generateAndBroadcastReply(aiProvider, recentMessages, timeContext)
    .catch((error) => {
      console.error("AI provider request failed:", error);
    });

  response.status(202).json({ status: "accepted" });
});

void initializeDatabase()
  .then(async () => {
    const storedProvider = await getActiveAiProvider();
    if (isAiProviderName(storedProvider) && getAvailableAiProviders().includes(storedProvider)) {
      activeAiProviderName = storedProvider;
      aiProvider = createAiProvider(storedProvider);
    }

    server.listen(port, () => {
      console.log(`API server listening on http://localhost:${port}`);
      console.log(`[API] AI provider: ${activeAiProviderName}; streaming: ${Boolean(aiProvider.generateReplyStream)}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  });
