import type { AiProvider, ChatMessage, TimeContext } from "./ai-provider.js";
import { normalizeMemorySuggestion, type Memory } from "../memory/memory-normalizer.js";
import { defaultEmotionalState, formatEmotionalState } from "../character/emotional-state.js";

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === "your_openrouter_api_key_here") {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return apiKey;
}

function getModel() {
  return process.env.OPENROUTER_MODEL || "openrouter/auto";
}

async function requestCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  const requestBody = {
    model: getModel(),
    messages,
    temperature: 0.8,
    top_p: 0.9,
    min_p: 0.05,
    repetition_penalty: 1.05,
  };

  console.log("OpenRouter request:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(openRouterUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_SITE_URL
        ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
        : {}),
      ...(process.env.OPENROUTER_SITE_NAME
        ? { "X-Title": process.env.OPENROUTER_SITE_NAME }
        : {}),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter request failed with status ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as OpenRouterResponse;
  console.log("OpenRouter response:", JSON.stringify(data, null, 2));
  return data;
}

function getReply(data: OpenRouterResponse) {
  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("OpenRouter returned no text response");
  }

  return reply;
}

export function createOpenRouterProvider(): AiProvider {
  return {
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

      const data = await requestCompletion([
        { role: "system", content: systemMessage },
        ...messages,
      ]);

      return getReply(data);
    },
    async extractMemories(messages: ChatMessage[]): Promise<Memory[]> {
      const data = await requestCompletion([
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
