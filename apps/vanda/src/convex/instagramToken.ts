"use node";

import { createDecipheriv, createHash } from "node:crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
}

/**
 * Reverse of the AES-256-GCM token encryption in instagramGraphActions.ts.
 * Shared by the `"use node"` actions (publish, observe) that need the plaintext
 * Instagram access token; imported only from those node modules.
 */
export function decryptInstagramToken(connection: {
  readonly tokenCiphertext?: string | undefined;
  readonly tokenIv?: string | undefined;
  readonly tokenAuthTag?: string | undefined;
}): string {
  const { tokenCiphertext, tokenIv, tokenAuthTag } = connection;
  if (tokenCiphertext === undefined || tokenIv === undefined || tokenAuthTag === undefined) {
    throw new Error("connection has no stored token");
  }
  const key = createHash("sha256").update(requireEnv("INSTAGRAM_TOKEN_ENCRYPTION_KEY")).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(tokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(tokenAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(tokenCiphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
