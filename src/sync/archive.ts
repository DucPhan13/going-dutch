import { SyncError } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 600_000;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

interface ArchiveEnvelope {
  format: "going-dutch-sync";
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  encryption: { name: "AES-GCM"; iv: string };
  ciphertext: string;
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};

const decodeBase64 = (value: string) => {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    throw new SyncError("unsupported-archive", "This sync file is invalid.");
  }
};

const assertCrypto = () => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) throw new SyncError("storage-unavailable", "Encrypted sync requires a secure browser connection.");
};

async function passwordKey(passphrase: string, salt: Uint8Array, iterations: number) {
  if (passphrase.length < 8) throw new SyncError("invalid-data", "Use a passphrase of at least 8 characters.");
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: arrayBuffer(salt), iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const aad = (envelope: Pick<ArchiveEnvelope, "format" | "version" | "kdf" | "encryption">) => {
  const { format, version, kdf, encryption } = envelope;
  return encoder.encode(JSON.stringify({ format, version, kdf, encryption }));
};

export async function encryptArchive(payload: unknown) {
  assertCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passphrase = (payload as { passphrase?: string }).passphrase;
  if (typeof passphrase !== "string") throw new SyncError("invalid-data", "A passphrase is required.");
  const body = { ...(payload as Record<string, unknown>) };
  delete body.passphrase;
  const envelopeBase = {
    format: "going-dutch-sync" as const,
    version: 1 as const,
    kdf: { name: "PBKDF2" as const, hash: "SHA-256" as const, iterations: ITERATIONS, salt: encodeBase64(salt) },
    encryption: { name: "AES-GCM" as const, iv: encodeBase64(iv) },
  };
  const key = await passwordKey(passphrase, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: arrayBuffer(iv), additionalData: arrayBuffer(aad(envelopeBase)) }, key, arrayBuffer(encoder.encode(JSON.stringify(body))));
  return new Blob([JSON.stringify({ ...envelopeBase, ciphertext: encodeBase64(new Uint8Array(ciphertext)) } satisfies ArchiveEnvelope)], { type: "application/vnd.going-dutch.sync+json" });
}

export async function decryptArchive(file: Blob, passphrase: string): Promise<Record<string, unknown>> {
  assertCrypto();
  if (file.size > MAX_ARCHIVE_BYTES) throw new SyncError("archive-too-large", "This sync file is too large to import.");
  let envelope: ArchiveEnvelope;
  try { envelope = JSON.parse(decoder.decode(await file.arrayBuffer())); } catch { throw new SyncError("unsupported-archive", "This is not a Going Dutch sync file."); }
  if (!envelope || envelope.format !== "going-dutch-sync" || envelope.version !== 1 || envelope.kdf?.name !== "PBKDF2" || envelope.kdf.hash !== "SHA-256" || !Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100_000 || envelope.kdf.iterations > 2_000_000 || envelope.encryption?.name !== "AES-GCM") {
    throw new SyncError("unsupported-archive", "This sync file uses an unsupported format.");
  }
  try {
    const salt = decodeBase64(envelope.kdf.salt);
    const iv = decodeBase64(envelope.encryption.iv);
    if (salt.length < 16 || iv.length !== 12) throw new Error("invalid encryption parameters");
    const key = await passwordKey(passphrase, salt, envelope.kdf.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: arrayBuffer(iv), additionalData: arrayBuffer(aad(envelope)) }, key, arrayBuffer(decodeBase64(envelope.ciphertext)));
    const parsed = JSON.parse(decoder.decode(plaintext));
    if (!parsed || typeof parsed !== "object") throw new Error("invalid payload");
    return parsed;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError("decryption-failed", "Unable to open this sync file. Check the passphrase and file.", error);
  }
}

export const archiveBytesToBase64 = encodeBase64;
export const archiveBase64ToBytes = decodeBase64;
