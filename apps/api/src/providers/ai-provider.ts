import type { Memory } from "../memory/memory-normalizer.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TimeContext = {
  utcTime: string;
  timeZone: string;
  localTime: string;
};

export interface AiProvider {
  generateReply(messages: ChatMessage[], timeContext: TimeContext): Promise<string>;
  generateReplyStream?(
    messages: ChatMessage[],
    timeContext: TimeContext,
    signal?: AbortSignal,
  ): AsyncIterable<string>;
  extractMemories(messages: ChatMessage[]): Promise<Memory[]>;
}
