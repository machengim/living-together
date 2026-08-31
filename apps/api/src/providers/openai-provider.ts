import type { AiProvider } from "./ai-provider.js";

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
    async generateReply(message) {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey || apiKey === "your_api_key_here") {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const providerResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
            instructions:
              "You are a friendly chatbot living in a shared home. Reply briefly and naturally.",
            input: message,
            store: false,
          }),
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
  };
}
