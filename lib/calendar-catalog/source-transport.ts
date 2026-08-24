export const CALENDAR_SOURCE_LIMITS = {
  runRequests: 300,
  runBytes: 96 * 1024 * 1024,
  sourceRequests: 100,
  sourceBytes: 32 * 1024 * 1024,
  officialResponseBytes: 4 * 1024 * 1024,
  geResponseBytes: 4 * 1024 * 1024,
  cbfResponseBytes: 12 * 1024 * 1024,
} as const;

export type SourceOperationalMetrics = {
  requests: number;
  rejectedRequests: number;
  bytes: number;
  durationMs: number;
  statusClasses: Record<string, number>;
  failures: Record<string, number>;
};

export class CalendarSourceLimitError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CalendarSourceLimitError";
  }
}

const emptyMetrics = (): SourceOperationalMetrics => ({
  requests: 0,
  rejectedRequests: 0,
  bytes: 0,
  durationMs: 0,
  statusClasses: {},
  failures: {},
});

const increment = (record: Record<string, number>, key: string) => {
  record[key] = (record[key] ?? 0) + 1;
};

export class CalendarSourceBudget {
  private readonly sources = new Map<string, SourceOperationalMetrics>();
  private requests = 0;
  private bytes = 0;

  private metrics(sourceId: string) {
    const current = this.sources.get(sourceId) ?? emptyMetrics();
    this.sources.set(sourceId, current);
    return current;
  }

  beginRequest(sourceId: string) {
    const metrics = this.metrics(sourceId);
    if (
      this.requests >= CALENDAR_SOURCE_LIMITS.runRequests ||
      metrics.requests >= CALENDAR_SOURCE_LIMITS.sourceRequests
    ) {
      metrics.rejectedRequests += 1;
      throw new CalendarSourceLimitError("source_request_budget_exceeded");
    }
    this.requests += 1;
    metrics.requests += 1;
  }

  addBytes(sourceId: string, received: number) {
    const metrics = this.metrics(sourceId);
    this.bytes += received;
    metrics.bytes += received;
    if (
      this.bytes > CALENDAR_SOURCE_LIMITS.runBytes ||
      metrics.bytes > CALENDAR_SOURCE_LIMITS.sourceBytes
    ) {
      throw new CalendarSourceLimitError("source_byte_budget_exceeded");
    }
  }

  finish(sourceId: string, startedAt: number, status?: number) {
    const metrics = this.metrics(sourceId);
    metrics.durationMs += Math.max(0, Math.round(performance.now() - startedAt));
    if (status) increment(metrics.statusClasses, `${Math.floor(status / 100)}xx`);
  }

  fail(sourceId: string, code: string) {
    increment(this.metrics(sourceId).failures, code);
  }

  snapshot() {
    return Object.fromEntries(
      [...this.sources.entries()].map(([sourceId, metrics]) => [
        sourceId,
        {
          ...metrics,
          statusClasses: { ...metrics.statusClasses },
          failures: { ...metrics.failures },
        },
      ])
    );
  }
}

const declaredLength = (response: Response) => {
  const value = response.headers.get("content-length")?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const readLimitedResponse = async (
  response: Response,
  sourceId: string,
  budget: CalendarSourceBudget,
  maxBytes: number
) => {
  const declared = declaredLength(response);
  if (declared !== null && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new CalendarSourceLimitError("source_response_too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let responseBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    responseBytes += value.byteLength;
    try {
      budget.addBytes(sourceId, value.byteLength);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    if (responseBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new CalendarSourceLimitError("source_response_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(responseBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CalendarSourceLimitError("source_response_invalid_utf8");
  }
};

const failureCode = (error: unknown) =>
  error instanceof CalendarSourceLimitError
    ? error.code
    : error instanceof DOMException && error.name === "TimeoutError"
      ? "source_timeout"
      : "source_transport_error";

export const fetchBoundedCalendarSource = async ({
  sourceId,
  input,
  allowedHosts,
  acceptedContentTypes,
  maxBytes,
  budget,
  fetchImpl = fetch,
}: {
  sourceId: string;
  input: string;
  allowedHosts: ReadonlySet<string>;
  acceptedContentTypes: readonly string[];
  maxBytes: number;
  budget: CalendarSourceBudget;
  fetchImpl?: typeof fetch;
}) => {
  const url = new URL(input);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    budget.fail(sourceId, "source_url_not_allowed");
    throw new CalendarSourceLimitError("source_url_not_allowed");
  }

  const startedAt = performance.now();
  let status: number | undefined;
  try {
    budget.beginRequest(sourceId);
    const response = await fetchImpl(url, {
      headers: {
        accept: acceptedContentTypes.join(","),
        "user-agent": "Doze52-Calendar-Updater/1.0 (+https://doze52.com)",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      redirect: "error",
    });
    status = response.status;
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new CalendarSourceLimitError(`source_http_${response.status}`);
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !acceptedContentTypes.some((accepted) => contentType.includes(accepted))
    ) {
      await response.body?.cancel().catch(() => undefined);
      throw new CalendarSourceLimitError("source_content_type_invalid");
    }
    const body = await readLimitedResponse(response, sourceId, budget, maxBytes);
    return { body, contentType };
  } catch (error) {
    budget.fail(sourceId, failureCode(error));
    throw error;
  } finally {
    budget.finish(sourceId, startedAt, status);
  }
};
