import type { AiProvider } from "./ai-provider.js";
import { createFakeProvider } from "./fake-provider.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { createOpenAiProvider } from "./openai-provider.js";
import { createOpenRouterProvider } from "./openrouter-provider.js";
import { createOllamaProvider } from "./ollama-provider.js";

export const aiProviderNames = ["fake", "openai", "gemini", "openrouter", "ollama"] as const;
export type AiProviderName = (typeof aiProviderNames)[number];

export function isAiProviderName(value: string): value is AiProviderName {
  return aiProviderNames.includes(value as AiProviderName);
}

export function getAvailableAiProviders(): AiProviderName[] {
  return aiProviderNames.filter((provider) => {
    if (provider === "fake" || provider === "ollama") return true;
    if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
    return Boolean(process.env.OPENROUTER_API_KEY);
  });
}

export function createAiProvider(providerName: AiProviderName): AiProvider {
  switch (providerName) {
    case "fake":
      return createFakeProvider();
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAiProvider();
    case "openrouter":
      return createOpenRouterProvider();
    case "ollama":
      return createOllamaProvider();
    default:
      throw new Error(`Unsupported AI provider: ${providerName}`);
  }
}
