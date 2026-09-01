import type { Memory } from "../memory/memory-normalizer.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface AiProvider {
  generateReply(messages: ChatMessage[]): Promise<string>;
  extractMemories(messages: ChatMessage[]): Promise<Memory[]>;
}
