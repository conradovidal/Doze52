import { request, type RequestOptions } from "node:https";
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import {
  CALENDAR_SOURCE_LIMITS,
  CalendarSourceBudget,
  CalendarSourceLimitError,
} from "./source-transport";

const CBF_HOSTS = new Set(["cbf.com.br", "www.cbf.com.br"]);
const MAX_RESPONSE_BYTES = CALENDAR_SOURCE_LIMITS.cbfResponseBytes;

// Public intermediate advertised by the CBF leaf certificate through AIA.
// Source: http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt
export const CBF_SECTIGO_OV_R36_CA = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----`;

export const CBF_CA_SHA256 = "65:42:D1:76:BE:D5:0F:19:3C:0C:E2:97:AE:44:EC:D8:A0:A8:6B:EC:2E:DE:68:27:69:34:40:59:B4:E7:85:30";

export const validateCbfIntermediateCertificate = (
  pem = CBF_SECTIGO_OV_R36_CA,
  expectedFingerprint = CBF_CA_SHA256
) => {
  let certificate: X509Certificate;
  try { certificate = new X509Certificate(pem); }
  catch (error) { throw new Error("cbf_tls_chain_error: CA intermediária inválida", { cause: error }); }
  if (certificate.fingerprint256 !== expectedFingerprint) {
    throw new Error("cbf_tls_chain_error: fingerprint da CA intermediária divergente");
  }
  return certificate;
};

export const cbfRequestOptions = (url: URL): RequestOptions => {
  if (url.protocol !== "https:" || !CBF_HOSTS.has(url.hostname)) {
    throw new Error(`cbf_tls_chain_error: host não autorizado (${url.hostname})`);
  }
  validateCbfIntermediateCertificate();
  return {
    method: "GET",
    ca: [...rootCertificates, CBF_SECTIGO_OV_R36_CA],
    headers: {
      accept: "application/json,text/html;q=0.9",
      "user-agent": "Doze52-Calendar-Updater/1.0 (+https://doze52.com)",
    },
    servername: url.hostname,
  };
};

const tlsFailure = (error: unknown) => {
  if (error instanceof Error && error.message.startsWith("cbf_tls_chain_error:")) return error;
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "TLS_ERROR")
    : "TLS_ERROR";
  return new Error(`cbf_tls_chain_error: ${code}`, { cause: error });
};

const requestFailure = (error: unknown) => {
  if (error instanceof CalendarSourceLimitError) return error;
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "TRANSPORT_ERROR")
    : "TRANSPORT_ERROR";
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  if (/CERT|TLS|SSL|VERIFY|SELF_SIGNED|ISSUER|SIGNATURE/i.test(`${code} ${message}`)) {
    return tlsFailure(error);
  }
  return new Error(`cbf_transport_error: ${code}`, { cause: error });
};

export const fetchCbfOfficialSource = async (
  input: string,
  sourceId: string,
  budget: CalendarSourceBudget
) => {
  const url = new URL(input);
  let options: RequestOptions;
  try { options = cbfRequestOptions(url); }
  catch (error) { throw tlsFailure(error); }

  const startedAt = performance.now();
  budget.beginRequest(sourceId);
  return new Promise<{ body: string; contentType: string }>((resolve, reject) => {
    let settled = false;
    let status: number | undefined;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      const failure = requestFailure(error);
      budget.fail(
        sourceId,
        failure instanceof CalendarSourceLimitError
          ? failure.code
          : "source_transport_error"
      );
      budget.finish(sourceId, startedAt, status);
      reject(failure);
    };
    const clientRequest = request(url, options, (response) => {
      const responseStatus = response.statusCode ?? 0;
      status = responseStatus;
      const chunks: Buffer[] = [];
      let received = 0;
      const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
      if (
        contentType &&
        !contentType.includes("application/json") &&
        !contentType.includes("text/html")
      ) {
        response.destroy(new CalendarSourceLimitError("source_content_type_invalid"));
        return;
      }
      const contentLength = Number(response.headers["content-length"] ?? "");
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        response.destroy(new CalendarSourceLimitError("source_response_too_large"));
        return;
      }
      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        try {
          budget.addBytes(sourceId, chunk.length);
        } catch (error) {
          response.destroy(error as Error);
          return;
        }
        if (received > MAX_RESPONSE_BYTES) {
          response.destroy(new CalendarSourceLimitError("source_response_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        if (responseStatus < 200 || responseStatus >= 300) {
          settled = true;
          budget.fail(sourceId, `source_http_${responseStatus}`);
          budget.finish(sourceId, startedAt, responseStatus);
          reject(new Error(`${url}: HTTP ${responseStatus}`));
          return;
        }
        let body: string;
        try {
          body = new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks)
          );
        } catch {
          fail(new CalendarSourceLimitError("source_response_invalid_utf8"));
          return;
        }
        settled = true;
        budget.finish(sourceId, startedAt, responseStatus);
        resolve({
          body,
          contentType,
        });
      });
      response.on("error", fail);
    });
    clientRequest.setTimeout(20_000, () => clientRequest.destroy(new Error("CBF request timeout")));
    clientRequest.on("error", fail);
    clientRequest.end();
  });
};
