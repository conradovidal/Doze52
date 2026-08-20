export class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`JSON payload exceeds ${maxBytes} bytes.`);
    this.name = "PayloadTooLargeError";
  }
}

export class InvalidJsonPayloadError extends Error {
  constructor() {
    super("Request body must be a JSON object.");
    this.name = "InvalidJsonPayloadError";
  }
}

export async function readLimitedJsonObject(
  request: Request,
  maxBytes: number
): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer.");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new InvalidJsonPayloadError();
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    );
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new InvalidJsonPayloadError();
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InvalidJsonPayloadError) throw error;
    throw new InvalidJsonPayloadError();
  }
}
