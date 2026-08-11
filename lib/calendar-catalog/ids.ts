import { createHash } from "node:crypto";

const NAMESPACE = "b52f2b49-f9c7-4eb8-aaf6-4182ba2303eb";

const uuidBytes = (uuid: string) =>
  Buffer.from(uuid.replaceAll("-", ""), "hex");

export const deterministicCalendarUuid = (
  authority: string,
  competition: string,
  season: number,
  externalId: string
) => {
  const digest = createHash("sha1")
    .update(uuidBytes(NAMESPACE))
    .update(`${authority}:${competition}:${season}:${externalId}`)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
};
