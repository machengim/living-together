import type { AiProvider } from "./ai-provider.js";
import { createFakeProvider } from "./fake-provider.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { createOpenAiProvider } from "./openai-provider.js";

export function createAiProvider(): AiProvider {
  switch (process.env.AI_PROVIDER?.toLowerCase()) {
    case "fake":
      return createFakeProvider();
    case "gemini":
      return createGeminiProvider();
    case "openai":
    case undefined:
    case "":
      return createOpenAiProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}
