export interface Config {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  topP: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const number = (
    name: string,
    fallback: number,
    min: number,
    max: number,
    integer = false,
  ): number => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      throw new Error(
        `${name} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}`,
      );
    }
    return value;
  };
  const baseUrl = (env.HYDRA_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "HYDRA_BASE_URL must be an HTTP(S) API base URL without credentials or query parameters",
      );
    }
  }
  const model = (env.HYDRA_MODEL ?? "public/rundao-kimi-k3").trim();
  if (!model) throw new Error("HYDRA_MODEL must not be empty");
  return {
    baseUrl,
    apiKey: (env.HYDRA_API_KEY ?? "").trim(),
    model,
    timeoutMs: number("HYDRA_TIMEOUT_MS", 300_000, 100, 600_000, true),
    maxTokens: number("HYDRA_MAX_TOKENS", 131_072, 1, 1_048_576, true),
    temperature: number("HYDRA_TEMPERATURE", 0.8, 0, 2),
    topP: number("HYDRA_TOP_P", 0.6, 0, 1),
  };
}
