import type { AiProvider } from "./ai-provider.js";

const replies = [
  "That sounds really interesting! I’d love to hear a little more about what you mean.",
  "I’m thinking about that for a moment. It’s a nice idea, and I can see why you mentioned it.",
  "Tell me more when you have a chance. I’m curious about the details and what happened next.",
  "That made me smile. It sounds like something we could talk about together this evening.",
  "Let’s talk about it a little more. I want to understand what you’re thinking and how you feel.",
];

export function createFakeProvider(): AiProvider {
  return {
    async generateReply(_messages) {
      await new Promise((resolve) => setTimeout(resolve, 700));

      const replyIndex = Math.floor(Math.random() * replies.length);
      return replies[replyIndex];
    },
    async extractMemories(_messages) {
      return [];
    },
  };
}
