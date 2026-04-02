/**
 * Shared Encryption Module — AES-256-GCM with Key Rotation
 *
 * Supports two environment variables:
 * - ENCRYPTION_KEY          — Current key (used for all new encryptions)
 * - ENCRYPTION_KEY_PREVIOUS — Previous key (used as fallback for decryption during rotation)
 *
 * Key rotation workflow:
 * 1. Generate a new 256-bit hex key: `openssl rand -hex 32`
 * 2. Set secrets:
 *    supabase secrets set ENCRYPTION_KEY_PREVIOUS="<old-key>" ENCRYPTION_KEY="<new-key>"
 * 3. Call the rotate-encryption-keys edge function (service-role auth):
 *    curl -X POST <supabase-url>/functions/v1/rotate-encryption-keys \
 *      -H "Authorization: Bearer <service-role-key>"
 * 4. Once rotation completes, remove the old key:
 *    supabase secrets unset ENCRYPTION_KEY_PREVIOUS
 *
 * Wire format: hex(IV_12bytes || AES-GCM-ciphertext)
 *
 * PCI-DSS 3.5 / 3.6 — Cryptographic key management.
 * SOC2 CC6.6 — Encryption of data at rest.
 */

// ─── Encrypt ────────────────────────────────────────────────────────

export async function encryptToken(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToHex(combined);
}

// ─── Decrypt (with key rotation fallback) ───────────────────────────

/**
 * Decrypt a token. Tries the current key first, then the previous key.
 * Returns plaintext on success; throws on failure.
 *
 * For backwards compatibility, if the value doesn't look like hex ciphertext
 * (i.e. was stored before encryption was enabled), it is returned as-is.
 */
export async function decryptToken(
  encryptedHex: string,
  currentKeyHex: string,
  previousKeyHex?: string,
): Promise<string> {
  // Backwards compat: if it doesn't look like hex ciphertext, treat as plaintext
  if (!/^[0-9a-f]{48,}$/i.test(encryptedHex)) {
    return encryptedHex;
  }

  // Try current key first
  try {
    return await decryptWithKey(encryptedHex, currentKeyHex);
  } catch {
    // Current key failed — try previous key if available
  }

  // Try previous key (rotation period)
  if (previousKeyHex) {
    try {
      return await decryptWithKey(encryptedHex, previousKeyHex);
    } catch {
      // Both keys failed
    }
  }

  throw new Error("Decryption failed with all available keys — value may be corrupt or keys are wrong");
}

/**
 * Decrypt with a single key. Throws on failure.
 */
async function decryptWithKey(encryptedHex: string, keyHex: string): Promise<string> {
  const encBytes = hexToBytes(encryptedHex);
  const iv = encBytes.slice(0, 12);
  const ciphertext = encBytes.slice(12);
  const keyBytes = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ─── Re-encrypt (for key rotation) ─────────────────────────────────

/**
 * Re-encrypt a value from the old key to the new key.
 * Returns the new ciphertext, or null if the value is plaintext / unchanged.
 */
export async function reEncryptToken(
  encryptedHex: string,
  oldKeyHex: string,
  newKeyHex: string,
): Promise<string | null> {
  // Skip plaintext values
  if (!/^[0-9a-f]{48,}$/i.test(encryptedHex)) {
    // It's plaintext — encrypt it with the new key
    return await encryptToken(encryptedHex, newKeyHex);
  }

  // Try decrypting with the new key first — if it works, already rotated
  try {
    await decryptWithKey(encryptedHex, newKeyHex);
    return null; // Already encrypted with new key
  } catch {
    // Not encrypted with new key — proceed with rotation
  }

  // Decrypt with old key, re-encrypt with new key
  const plaintext = await decryptWithKey(encryptedHex, oldKeyHex);
  return await encryptToken(plaintext, newKeyHex);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Get encryption keys from environment. Returns null if no key is set. */
export function getEncryptionKeys(): { current: string; previous?: string } | null {
  const current = Deno.env.get("ENCRYPTION_KEY");
  if (!current) return null;
  const previous = Deno.env.get("ENCRYPTION_KEY_PREVIOUS") || undefined;
  return { current, previous };
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
