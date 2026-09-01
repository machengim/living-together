import type { AiProvider, ChatMessage } from "./ai-provider.js";
import { normalizeMemorySuggestion, type Memory } from "../memory/memory-normalizer.js";
import { defaultEmotionalState, formatEmotionalState } from "../character/emotional-state.js";

type OpenAiResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export function createOpenAiProvider(): AiProvider {
  return {
    async generateReply(messages: ChatMessage[]) {
      const apiKey = process.env.OPENAI_API_KEY;
      const currentDateTime = new Date().toISOString();
      const userNickname = process.env.USER_NICKNAME || "亲爱的";
      const currentScene = "Rica and the user are together in the living room.";

      if (!apiKey || apiKey === "your_api_key_here") {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const requestBody = {
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions: `You are Rica, the girlfriend of the user. Stay in character.
The user's nickname is ${userNickname}.
Never output template placeholders such as \${user} or \${userNickname}; use the actual nickname or a natural form of address.
Current date and time: ${currentDateTime}
Current scene: ${currentScene}
${formatEmotionalState(defaultEmotionalState)}`,
        input: messages,
        store: false,
      };

      console.log("OpenAI request:", JSON.stringify(requestBody, null, 2));

      const providerResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        throw new Error(
          `OpenAI request failed with status ${providerResponse.status}: ${errorBody}`,
        );
      }

      const data = (await providerResponse.json()) as OpenAiResponse;
      const reply = data.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === "output_text")
        ?.text
        ?.trim();

      if (!reply) {
        throw new Error("OpenAI returned no text response");
      }

      return reply;
    },
    async extractMemories(messages: ChatMessage[]): Promise<Memory[]> {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey || apiKey === "your_api_key_here") {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const requestBody = {
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions: `Review the conversation and suggest only stable, useful memories about the user or relationship.
Return a JSON array only. Each item must contain category and content.
Allowed categories: preference, personal_fact, relationship_fact, promise, boundary.
Return [] when there are no suitable memories. Do not include sensitive information unless explicitly stated as something to remember.`,
        input: messages,
        store: false,
      };

      console.log("OpenAI memory request:", JSON.stringify(requestBody, null, 2));

      const providerResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!providerResponse.ok) {
        throw new Error(`OpenAI memory request failed with status ${providerResponse.status}`);
      }

      const data = (await providerResponse.json()) as OpenAiResponse;
      const text = data.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === "output_text")
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
