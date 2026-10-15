import { AsyncLocalStorage } from "node:async_hooks";
import type { VisionProvider, VisionMessage } from "../providers/openai.js";

const calls = new AsyncLocalStorage<{ provider: VisionProvider; signal: AbortSignal }>();

export function withVisionBackend<T>(
  provider: VisionProvider,
  signal: AbortSignal,
  call: () => T,
): T {
  return calls.run({ provider, signal }, call);
}

export function completeWithBackend(messages: VisionMessage[]): Promise<string> {
  const context = calls.getStore();
  if (!context)
    throw new Error("Vision requests must run inside a configured Hydra backend context");
  return context.provider.complete(messages, context.signal);
}
