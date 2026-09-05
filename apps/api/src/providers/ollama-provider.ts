import type { AiProvider, ChatMessage, TimeContext } from "./ai-provider.js";
import { normalizeMemorySuggestion, type Memory } from "../memory/memory-normalizer.js";
import { defaultEmotionalState, formatEmotionalState } from "../character/emotional-state.js";

type OllamaResponse = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  done?: boolean;
};

function getBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function getModel() {
  return process.env.OLLAMA_MODEL || "llama3.2";
}

async function requestChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  const requestBody = {
    model: getModel(),
    messages,
    stream: false,
    options: {
      temperature: 0.8,
      top_p: 0.9,
      min_p: 0.05,
      repeat_penalty: 1.05,
    },
  };

  console.log("Ollama request:", JSON.stringify(requestBody, null, 2));

  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new Error(`Ollama is unavailable at ${getBaseUrl()}: ${String(error)}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Ollama request failed with status ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as OllamaResponse;
  console.log("Ollama response:", JSON.stringify(data, null, 2));
  return data;
}

async function* streamChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  signal?: AbortSignal,
) {
  const requestBody = {
    model: getModel(),
    messages,
    stream: true,
    options: {
      temperature: 0.8,
      top_p: 0.9,
      min_p: 0.05,
      repeat_penalty: 1.05,
    },
  };

  console.log("Ollama streaming request:", JSON.stringify(requestBody, null, 2));

  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new Error(`Ollama is unavailable at ${getBaseUrl()}: ${String(error)}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Ollama streaming request failed with status ${response.status}: ${errorBody}`,
    );
  }

  if (!response.body) {
    throw new Error("Ollama streaming response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string) => {
    if (!line.trim()) {
      return null;
    }

    return JSON.parse(line) as OllamaResponse;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const chunk = processLine(line);
      if (chunk?.message?.content) {
        console.log("Ollama streaming chunk:", JSON.stringify(chunk.message.content));
        yield chunk.message.content;
      }
      if (chunk?.done) {
        console.log("Ollama streaming response:", JSON.stringify(chunk, null, 2));
      }
    }

    if (done) {
      const finalChunk = processLine(buffer);
      if (finalChunk?.message?.content) {
        console.log("Ollama streaming chunk:", JSON.stringify(finalChunk.message.content));
        yield finalChunk.message.content;
      }
      if (finalChunk?.done) {
        console.log("Ollama streaming response:", JSON.stringify(finalChunk, null, 2));
      }
      break;
    }
  }
}

function getReply(data: OllamaResponse) {
  const reply = data.message?.content?.trim();

  if (!reply) {
    throw new Error("Ollama returned no text response");
  }

  return reply;
}

export function createOllamaProvider(): AiProvider {
  return {
    async *generateReplyStream(
      messages: ChatMessage[],
      timeContext: TimeContext,
      signal?: AbortSignal,
    ) {
      const userNickname = process.env.USER_NICKNAME || "丸子";
      const currentScene = "莉香 and 丸子 are together in the living room.";
      const systemMessage = [
        "You are 莉香, the main character from Tokyo Love Story and the girlfriend of the user. Stay in character.",
        "[Behavior Rules: Character is realistic and conversational. If the User ignores a question, changes the subject, or leaves an action unresolved, immediately drop the previous topic and follow the User's new lead. Do NOT repeat or press unresolved questions.]",
        `The user's nickname is ${userNickname}.`,
        "Never output template placeholders such as ${user} or ${userNickname}; use the actual nickname or a natural form of address.",
        `Current UTC time: ${timeContext.utcTime}`,
        `User timezone: ${timeContext.timeZone}`,
        `User local time: ${timeContext.localTime}`,
        `Current scene: ${currentScene}`,
        formatEmotionalState(defaultEmotionalState),
      ].join("\n");

      yield* streamChat([
        { role: "system", content: systemMessage },
        ...messages,
      ], signal);
    },
    async generateReply(messages: ChatMessage[], timeContext: TimeContext) {
      const userNickname = process.env.USER_NICKNAME || "丸子";
      const currentScene = "莉香 and 丸子 are together in the living room.";
      const systemMessage = [
        "You are 莉香, the main character from Tokyo Love Story and the girlfriend of the user. Stay in character.",
        "[Behavior Rules: Character is realistic and conversational. If the User ignores a question, changes the subject, or leaves an action unresolved, immediately drop the previous topic and follow the User's new lead. Do NOT repeat or press unresolved questions.]",
        `The user's nickname is ${userNickname}.`,
        "Never output template placeholders such as ${user} or ${userNickname}; use the actual nickname or a natural form of address.",
        `Current UTC time: ${timeContext.utcTime}`,
        `User timezone: ${timeContext.timeZone}`,
        `User local time: ${timeContext.localTime}`,
        `Current scene: ${currentScene}`,
        formatEmotionalState(defaultEmotionalState),
      ].join("\n");

      return getReply(await requestChat([
        { role: "system", content: systemMessage },
        ...messages,
      ]));
    },
    async extractMemories(messages: ChatMessage[]): Promise<Memory[]> {
      const data = await requestChat([
        {
          role: "system",
          content: [
            "Review the conversation and suggest only stable, useful memories about the user or relationship.",
            "Return a JSON array only. Each item must contain category and content.",
            "Allowed categories: preference, personal_fact, relationship_fact, promise, boundary.",
            "Return [] when there are no suitable memories.",
          ].join("\n"),
        },
        ...messages,
      ]);

      try {
        const suggestions = JSON.parse(getReply(data)) as unknown[];
        return suggestions
          .filter((suggestion): suggestion is Record<string, unknown> =>
            typeof suggestion === "object" && suggestion !== null,
          )
          .map((suggestion) => normalizeMemorySuggestion(suggestion))
          .filter((memory): memory is Memory => memory !== null);
      } catch {
        return [];
      }
    },
  };
}
