export interface AiProvider {
  generateReply(message: string): Promise<string>;
}
