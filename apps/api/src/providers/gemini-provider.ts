import type { AiProvider, ChatMessage, TimeContext } from "./ai-provider.js";
import { normalizeMemorySuggestion, type Memory } from "../memory/memory-normalizer.js";
import { defaultEmotionalState, formatEmotionalState } from "../character/emotional-state.js";

type GeminiResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export function createGeminiProvider(): AiProvider {
  return {
    async generateReply(messages: ChatMessage[], timeContext: TimeContext) {
      const apiKey = process.env.GEMINI_API_KEY;
      const userNickname = process.env.USER_NICKNAME || "丸子";
      const currentScene = "莉香 and 丸子 are together in the living room.";

      if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const requestBody = {
        model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
        input: [
          "You are 莉香, the main character from Tokyo Love Story and the girlfriend of the user. Stay in character.",
          "[Behavior Rules: Character is realistic and conversational. If the User ignores a question, changes the subject, or leaves an action unresolved, immediately drop the previous topic and follow the User's new lead. Do NOT repeat or press unresolved questions.]",
          `The user's nickname is ${userNickname}.`,
          "Never output template placeholders such as ${user} or ${userNickname}; use the actual nickname or a natural form of address.",
          `Current UTC time: ${timeContext.utcTime}`,
          `User timezone: ${timeContext.timeZone}`,
          `User local time: ${timeContext.localTime}`,
          `Current scene: ${currentScene}`,
          formatEmotionalState(defaultEmotionalState),
          "",
          "Conversation:",
          messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
        ].join("\n"),
        generation_config: {
          thinking_level: "low",
          thinking_summaries: "none",
          temperature: 0.8,
          top_p: 0.9,
        },
      };

      console.log("Gemini request:", JSON.stringify(requestBody, null, 2));

      const providerResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        throw new Error(
          `Gemini request failed with status ${providerResponse.status}: ${errorBody}`,
        );
      }

      const data = (await providerResponse.json()) as GeminiResponse;
      console.log(
        "Gemini request and response:",
        JSON.stringify({ request: requestBody, response: data }, null, 2),
      );
      const reply = data.steps
        ?.filter((step) => step.type === "model_output")
        .flatMap((step) => step.content ?? [])
        .find((content) => content.type === "text")
        ?.text
        ?.trim();

      if (!reply) {
        throw new Error("Gemini returned no text response");
      }

      return reply;
    },
    async extractMemories(messages: ChatMessage[]): Promise<Memory[]> {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const requestBody = {
        model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
        input: [
          "Review the conversation and suggest only stable, useful memories about the user or relationship.",
          "Return a JSON array only. Each item must contain category and content.",
          "Allowed categories: preference, personal_fact, relationship_fact, promise, boundary.",
          "Return [] when there are no suitable memories.",
          "",
          "Conversation:",
          messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
        ].join("\n"),
        generation_config: {
          thinking_level: "low",
          thinking_summaries: "none",
        },
      };

      console.log("Gemini memory request:", JSON.stringify(requestBody, null, 2));

      const providerResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!providerResponse.ok) {
        throw new Error(`Gemini memory request failed with status ${providerResponse.status}`);
      }

      const data = (await providerResponse.json()) as GeminiResponse;
      const text = data.steps
        ?.filter((step) => step.type === "model_output")
        .flatMap((step) => step.content ?? [])
        .find((content) => content.type === "text")
        ?.text;

      if (!text) return [];

      try {
        const suggestions = JSON.parse(text) as unknown[];
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
