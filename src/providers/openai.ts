import type { Config } from "../config.js";
import { ApiError } from "../errors/types.js";

export interface VisionMessage {
  role: string;
  content: unknown;
}

export class VisionProvider {
  constructor(readonly config: Config) {}

  async complete(messages: VisionMessage[], signal: AbortSignal): Promise<string> {
    if (!this.config.apiKey) throw new Error("HYDRA_API_KEY is required to call the vision model");
    if (!this.config.baseUrl)
      throw new Error("HYDRA_BASE_URL is required to call the vision model");
    signal.throwIfAborted();
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]);
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          thinking: { type: "enabled" },
          stream: false,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          max_tokens: this.config.maxTokens,
        }),
        signal: requestSignal,
      });
    } catch (error) {
      signal.throwIfAborted();
      throw new Error("Vision provider connection failed or timed out", { cause: error });
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `HTTP ${response.status}: ${errorText}`,
        undefined,
        response.status,
        undefined,
      );
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const result = body.choices?.[0]?.message?.content;
    if (!result)
      throw new ApiError("Invalid API response: missing content", undefined, undefined, undefined);
    return result;
  }
}
