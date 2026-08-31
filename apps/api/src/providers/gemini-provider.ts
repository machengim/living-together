import type { AiProvider } from "./ai-provider.js";

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
    async generateReply(message) {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const providerResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
            input: message,
            generation_config: {
              thinking_level: "low",
              thinking_summaries: "none",
            },
          }),
        },
      );

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        throw new Error(
          `Gemini request failed with status ${providerResponse.status}: ${errorBody}`,
        );
      }

      const data = (await providerResponse.json()) as GeminiResponse;
      console.log("Gemini response:", JSON.stringify(data, null, 2));
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
  };
}
