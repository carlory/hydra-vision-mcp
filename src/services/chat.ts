import { completeWithBackend } from "./context.js";
import type { VisionMessage } from "../providers/openai.js";

export class ChatService {
  visionCompletions(messages: VisionMessage[]): Promise<string> {
    return completeWithBackend(messages);
  }
}

export const chatService = new ChatService();
