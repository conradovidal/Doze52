type SafePayload = Record<string, unknown> | string | number | boolean | null;

const sanitize = (payload: SafePayload) => {
  if (payload instanceof Error) {
    return {
      name: payload.name,
      message: payload.message,
    };
  }
  if (payload === null || typeof payload !== "object") return payload;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("key") ||
      lower.includes("secret") ||
      lower.includes("authorization")
    ) {
      sanitized[key] = "[redacted]";
      continue;
    }
    if (value instanceof Error) {
      sanitized[key] = { name: value.name, message: value.message };
      continue;
    }
    sanitized[key] = value;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : { note: "empty-payload" };
};

export const logDevError = (context: string, payload: SafePayload) => {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[${context}]`, sanitize(payload));
};

export const logProdError = (message: string) => {
  if (process.env.NODE_ENV !== "production") return;
  console.error(message);
};
