import { expect, test } from "@playwright/test";
import {
  InvalidJsonPayloadError,
  PayloadTooLargeError,
  readLimitedJsonObject,
  readLimitedText,
} from "../../lib/http-json";

const jsonRequest = (body: BodyInit) => {
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  };
  if (body instanceof ReadableStream) init.duplex = "half";
  return new Request("https://doze52.example/api/test", init);
};

test("lê JSON válido sem depender de Content-Length", async () => {
  const request = jsonRequest('{"uf":"RS"}');
  expect(request.headers.get("content-length")).toBeNull();
  await expect(readLimitedJsonObject(request, 32)).resolves.toEqual({ uf: "RS" });
});

test("interrompe corpo chunked assim que ultrapassa o limite", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"message":"'));
      controller.enqueue(encoder.encode("x".repeat(32)));
      controller.enqueue(encoder.encode('"}'));
      controller.close();
    },
  });

  await expect(readLimitedJsonObject(jsonRequest(body), 16)).rejects.toBeInstanceOf(
    PayloadTooLargeError
  );
});

test("rejeita JSON truncado e valores que não são objeto", async () => {
  await expect(readLimitedJsonObject(jsonRequest('{"uf":'), 32)).rejects.toBeInstanceOf(
    InvalidJsonPayloadError
  );
  await expect(readLimitedJsonObject(jsonRequest("[]"), 32)).rejects.toBeInstanceOf(
    InvalidJsonPayloadError
  );
});

test("lê texto por bytes até exatamente o limite", async () => {
  const payload = "x".repeat(1024 * 1024);
  await expect(readLimitedText(jsonRequest(payload), payload.length)).resolves.toBe(
    payload
  );
});

test("conta bytes UTF-8 em vez de caracteres", async () => {
  await expect(readLimitedText(jsonRequest("é".repeat(8)), 15)).rejects.toBeInstanceOf(
    PayloadTooLargeError
  );
});

test("rejeita Content-Length declarado acima do limite", async () => {
  const request = jsonRequest("{}");
  request.headers.set("content-length", "1048577");
  await expect(readLimitedText(request, 1024 * 1024)).rejects.toBeInstanceOf(
    PayloadTooLargeError
  );
});

test("não confia em Content-Length menor que o corpo real", async () => {
  const request = jsonRequest("x".repeat(17));
  request.headers.set("content-length", "1");
  await expect(readLimitedText(request, 16)).rejects.toBeInstanceOf(
    PayloadTooLargeError
  );
});

test("cancela corpo chunked assim que o primeiro chunk excede o limite", async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(17));
    },
    cancel() {
      canceled = true;
    },
  });

  await expect(readLimitedText(jsonRequest(body), 16)).rejects.toBeInstanceOf(
    PayloadTooLargeError
  );
  expect(canceled).toBe(true);
});
