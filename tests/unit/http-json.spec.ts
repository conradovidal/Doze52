import { expect, test } from "@playwright/test";
import {
  InvalidJsonPayloadError,
  PayloadTooLargeError,
  readLimitedJsonObject,
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
