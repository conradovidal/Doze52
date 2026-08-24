export class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request payload exceeds ${maxBytes} bytes.`);
    this.name = "PayloadTooLargeError";
  }
}

export class InvalidJsonPayloadError extends Error {
  constructor() {
    super("Request body must be a JSON object.");
    this.name = "InvalidJsonPayloadError";
  }
}

const assertPositiveByteLimit = (maxBytes: number) => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer.");
  }
};

const declaredBodyExceedsLimit = (request: Request, maxBytes: number) => {
  const contentLength = request.headers.get("content-length")?.trim();
  if (!contentLength || !/^\d+$/.test(contentLength)) return false;
  return BigInt(contentLength) > BigInt(maxBytes);
};

const readLimitedBytes = async (request: Request, maxBytes: number) => {
  assertPositiveByteLimit(maxBytes);
  if (declaredBodyExceedsLimit(request, maxBytes)) {
    await request.body?.cancel().catch(() => undefined);
    throw new PayloadTooLargeError(maxBytes);
  }

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
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
  return bytes;
};

export async function readLimitedText(request: Request, maxBytes: number) {
  return new TextDecoder().decode(await readLimitedBytes(request, maxBytes));
}

export async function readLimitedJsonObject(
  request: Request,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const bytes = await readLimitedBytes(request, maxBytes);
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
