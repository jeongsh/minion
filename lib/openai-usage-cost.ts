export type OpenAiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  webSearchCalls: number;
};

export type OpenAiPricingSnapshot = {
  model: string;
  verifiedAt: string;
  promotionalThrough: string | null;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  webSearchUsdPerCall: number;
};

export type MeasuredOpenAiUsage = OpenAiTokenUsage & {
  model: string;
  estimatedCostUsd: number | null;
  pricingSnapshot: OpenAiPricingSnapshot | null;
};

const MODEL_PRICES: Array<{
  matches: (model: string) => boolean;
  promotionalThrough?: string;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = [
  {
    matches: (model) => model.startsWith("gpt-5.6-sol"),
    promotionalThrough: "2026-11-21",
    inputUsdPerMillion: 4,
    cachedInputUsdPerMillion: 0.4,
    outputUsdPerMillion: 20,
  },
  {
    matches: (model) => model.startsWith("gpt-5.6-terra"),
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    outputUsdPerMillion: 12,
  },
  {
    matches: (model) => model.startsWith("gpt-5.4-mini"),
    inputUsdPerMillion: 0.75,
    cachedInputUsdPerMillion: 0.075,
    outputUsdPerMillion: 4.5,
  },
  {
    matches: (model) => model.startsWith("gpt-5.4-nano"),
    inputUsdPerMillion: 0.2,
    cachedInputUsdPerMillion: 0.02,
    outputUsdPerMillion: 1.25,
  },
  {
    matches: (model) => model.startsWith("gpt-5.4"),
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.25,
    outputUsdPerMillion: 15,
  },
];

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function pricingSnapshotForModel(model: string): OpenAiPricingSnapshot | null {
  const prices = MODEL_PRICES.find((item) => item.matches(model));
  return prices
    ? {
        model,
        verifiedAt: "2026-08-27",
        promotionalThrough: prices.promotionalThrough ?? null,
        inputUsdPerMillion: prices.inputUsdPerMillion,
        cachedInputUsdPerMillion: prices.cachedInputUsdPerMillion,
        outputUsdPerMillion: prices.outputUsdPerMillion,
        webSearchUsdPerCall: 0.01,
      }
    : null;
}

export function estimateOpenAiCostUsd(
  model: string,
  usage: OpenAiTokenUsage,
): { cost: number | null; pricingSnapshot: OpenAiPricingSnapshot | null } {
  const pricingSnapshot = pricingSnapshotForModel(model);
  if (!pricingSnapshot) return { cost: null, pricingSnapshot: null };

  const cachedInputTokens = Math.min(usage.inputTokens, usage.cachedInputTokens);
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  const cost =
    (uncachedInputTokens * pricingSnapshot.inputUsdPerMillion) / 1_000_000 +
    (cachedInputTokens * pricingSnapshot.cachedInputUsdPerMillion) / 1_000_000 +
    (usage.outputTokens * pricingSnapshot.outputUsdPerMillion) / 1_000_000 +
    usage.webSearchCalls * pricingSnapshot.webSearchUsdPerCall;

  return { cost, pricingSnapshot };
}

export function measureOpenAiResponseUsage(value: unknown, model: string): MeasuredOpenAiUsage {
  const response = value && typeof value === "object"
    ? value as {
        usage?: {
          input_tokens?: unknown;
          input_tokens_details?: { cached_tokens?: unknown };
          output_tokens?: unknown;
          output_tokens_details?: { reasoning_tokens?: unknown };
          total_tokens?: unknown;
        };
        output?: Array<{ type?: unknown }>;
      }
    : {};
  const inputTokens = nonNegativeInteger(response.usage?.input_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    nonNegativeInteger(response.usage?.input_tokens_details?.cached_tokens),
  );
  const outputTokens = nonNegativeInteger(response.usage?.output_tokens);
  const usage: OpenAiTokenUsage = {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens: Math.min(
      outputTokens,
      nonNegativeInteger(response.usage?.output_tokens_details?.reasoning_tokens),
    ),
    totalTokens: nonNegativeInteger(response.usage?.total_tokens) || inputTokens + outputTokens,
    webSearchCalls: Array.isArray(response.output)
      ? response.output.filter((item) => item?.type === "web_search_call").length
      : 0,
  };
  const estimated = estimateOpenAiCostUsd(model, usage);

  return {
    ...usage,
    model,
    estimatedCostUsd: estimated.cost,
    pricingSnapshot: estimated.pricingSnapshot,
  };
}

export function combineOpenAiUsage(rows: MeasuredOpenAiUsage[]) {
  const total = rows.reduce<OpenAiTokenUsage>(
    (sum, row) => ({
      inputTokens: sum.inputTokens + row.inputTokens,
      cachedInputTokens: sum.cachedInputTokens + row.cachedInputTokens,
      outputTokens: sum.outputTokens + row.outputTokens,
      reasoningTokens: sum.reasoningTokens + row.reasoningTokens,
      totalTokens: sum.totalTokens + row.totalTokens,
      webSearchCalls: sum.webSearchCalls + row.webSearchCalls,
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      webSearchCalls: 0,
    },
  );
  const costs = rows.map((row) => row.estimatedCostUsd);

  return {
    ...total,
    estimatedCostUsd: costs.some((cost) => cost === null)
      ? null
      : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0),
    pricingSnapshot: rows.flatMap((row) => row.pricingSnapshot ?? []),
  };
}
