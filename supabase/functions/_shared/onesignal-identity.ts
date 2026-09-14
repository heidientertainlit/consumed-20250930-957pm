/**
 * OneSignal Identity Verification primitives.
 *
 * This module deliberately has no Deno, Supabase, or provider SDK imports so
 * issuance and request-boundary behavior can be tested with disposable keys.
 * The private key is only ever supplied by the edge function's environment.
 */

export const DEFAULT_ONESIGNAL_JWT_TTL_SECONDS = 120;
export const MAX_ONESIGNAL_JWT_TTL_SECONDS = 180;

type SubtleCryptoLike = SubtleCrypto;

export type OneSignalIdentityClaims = {
  iss: string;
  exp: number;
  identity: {
    external_id: string;
  };
};

export type OneSignalJwtIssuer = {
  appId: string;
  privateKeyPem: string;
  ttlSeconds?: number;
  nowSeconds?: number;
  crypto?: Crypto;
};

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncode(utf8(value));
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodePem(pem: string, label: string): Uint8Array {
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!pem.includes(begin) || !pem.includes(end)) {
    throw new Error(`OneSignal identity key must be PEM ${label}`);
  }

  const body = pem
    .replace(begin, "")
    .replace(end, "")
    .replace(/\s/g, "");
  if (!body) throw new Error("OneSignal identity key is empty");

  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validateIssuerInput(appId: string, userId: string): void {
  if (!appId.trim()) throw new Error("OneSignal app ID is required");
  // The edge function derives this value from the verified Supabase subject.
  // Keeping the UUID check here also prevents a future caller from turning
  // this primitive into an arbitrary-identity signer.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    throw new Error("OneSignal identity must be a UUID");
  }
}

export function oneSignalIdentityClaims(
  appId: string,
  userId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_ONESIGNAL_JWT_TTL_SECONDS,
): OneSignalIdentityClaims {
  validateIssuerInput(appId, userId);
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > MAX_ONESIGNAL_JWT_TTL_SECONDS
  ) {
    throw new Error(
      `OneSignal identity JWT TTL must be between 1 and ${MAX_ONESIGNAL_JWT_TTL_SECONDS} seconds`,
    );
  }
  if (!Number.isInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error("OneSignal identity issuance time is invalid");
  }

  return {
    // OneSignal's current Identity Verification payload uses the app ID as
    // `iss` and the verified alias under `identity.external_id`.
    iss: appId,
    exp: nowSeconds + ttlSeconds,
    identity: { external_id: userId },
  };
}

export async function issueOneSignalJwt({
  appId,
  privateKeyPem,
  userId,
  ttlSeconds = DEFAULT_ONESIGNAL_JWT_TTL_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
  crypto: cryptoImpl = globalThis.crypto,
}: OneSignalJwtIssuer & { userId: string }): Promise<{
  token: string;
  claims: OneSignalIdentityClaims;
}> {
  if (!privateKeyPem.trim()) {
    throw new Error("OneSignal identity private key is not configured");
  }
  const claims = oneSignalIdentityClaims(
    appId,
    userId,
    nowSeconds,
    ttlSeconds,
  );
  const subtle: SubtleCryptoLike = cryptoImpl.subtle;
  const key = await subtle.importKey(
    "pkcs8",
    decodePem(privateKeyPem, "PRIVATE KEY"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const encodedHeader = base64UrlEncodeText(
    JSON.stringify({ alg: "ES256", typ: "JWT" }),
  );
  const encodedClaims = base64UrlEncodeText(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    utf8(signingInput),
  );

  return {
    token: `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`,
    claims,
  };
}

export type DecodedOneSignalJwt = {
  header: { alg?: string; typ?: string };
  claims: OneSignalIdentityClaims;
  signingInput: string;
  signature: Uint8Array;
};

export function decodeOneSignalJwt(token: string): DecodedOneSignalJwt {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed OneSignal identity JWT");

  let header: { alg?: string; typ?: string };
  let claims: OneSignalIdentityClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    throw new Error("Malformed OneSignal identity JWT payload");
  }

  if (header.alg !== "ES256" || header.typ !== "JWT") {
    throw new Error("OneSignal identity JWT must use ES256");
  }
  if (
    typeof claims.iss !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.identity?.external_id !== "string"
  ) {
    throw new Error("OneSignal identity JWT claims are incomplete");
  }

  return {
    header,
    claims,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2]),
  };
}

export async function verifyOneSignalJwt({
  token,
  publicKeyPem,
  expectedAppId,
  expectedUserId,
  nowSeconds = Math.floor(Date.now() / 1000),
  crypto: cryptoImpl = globalThis.crypto,
}: {
  token: string;
  publicKeyPem: string;
  expectedAppId: string;
  expectedUserId?: string;
  nowSeconds?: number;
  crypto?: Crypto;
}): Promise<boolean> {
  const decoded = decodeOneSignalJwt(token);
  if (decoded.claims.iss !== expectedAppId) return false;
  if (decoded.claims.exp <= nowSeconds) return false;
  if (
    expectedUserId !== undefined &&
    decoded.claims.identity.external_id !== expectedUserId
  ) {
    return false;
  }

  const key = await cryptoImpl.subtle.importKey(
    "spki",
    decodePem(publicKeyPem, "PUBLIC KEY"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return cryptoImpl.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decoded.signature,
    utf8(decoded.signingInput),
  );
}