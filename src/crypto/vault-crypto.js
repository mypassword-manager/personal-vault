const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const KDF_ITERATIONS = 600_000;
export const KDF_HASH = "SHA-256";
export const KDF_NAME = "PBKDF2";
export const AES_NAME = "AES-GCM";
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const BACKUP_FORMAT = "vault-peribadi-backup";
export const BACKUP_VERSION = 1;
const AAD = textEncoder.encode("vault-peribadi-v1");
const MAX_CIPHER_BYTES = 2_000_000;

function cryptoApi() {
  const api = globalThis.crypto;
  if (!api?.subtle || !api.getRandomValues) {
    throw new Error("CRYPTO");
  }
  return api;
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  cryptoApi().getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_000_000) {
    throw new Error("FORMAT");
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function asBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

export function emptyVault() {
  return {
    profile: { fullName: "", icNumber: "", email: "" },
    accounts: [],
  };
}

export function normalizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("FORMAT");
  }
  const profile = data.profile ?? {};
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  return {
    profile: {
      fullName: String(profile.fullName ?? ""),
      icNumber: String(profile.icNumber ?? ""),
      email: String(profile.email ?? ""),
    },
    accounts: accounts.map((account) => ({
      id: String(account?.id || cryptoApi().randomUUID()),
      websiteName: String(account?.websiteName ?? ""),
      url: String(account?.url ?? ""),
      email: String(account?.email ?? ""),
      username: String(account?.username ?? ""),
      password: String(account?.password ?? ""),
      createdAt: Number(account?.createdAt) || Date.now(),
      updatedAt: Number(account?.updatedAt) || Date.now(),
    })),
  };
}

export function assertEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") throw new Error("FORMAT");
  if (envelope.format !== BACKUP_FORMAT || envelope.version !== BACKUP_VERSION) {
    throw new Error("FORMAT");
  }
  const kdf = envelope.kdf;
  if (
    !kdf ||
    kdf.name !== KDF_NAME ||
    kdf.hash !== KDF_HASH ||
    kdf.iterations !== KDF_ITERATIONS
  ) {
    throw new Error("FORMAT");
  }
  const salt = asBytes(envelope.salt);
  const iv = asBytes(envelope.iv);
  const ciphertext = asBytes(envelope.ciphertext);
  if (!salt || salt.byteLength !== SALT_BYTES) throw new Error("FORMAT");
  if (!iv || iv.byteLength !== IV_BYTES) throw new Error("FORMAT");
  if (!ciphertext || ciphertext.byteLength < 16 || ciphertext.byteLength > MAX_CIPHER_BYTES) {
    throw new Error("FORMAT");
  }
  return { salt, iv, ciphertext };
}

export async function deriveKey(password, salt) {
  const api = cryptoApi();
  const baseKey = await api.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    KDF_NAME,
    false,
    ["deriveKey"],
  );
  return api.subtle.deriveKey(
    {
      name: KDF_NAME,
      salt,
      iterations: KDF_ITERATIONS,
      hash: KDF_HASH,
    },
    baseKey,
    { name: AES_NAME, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(key, data) {
  const iv = randomBytes(IV_BYTES);
  const plaintext = textEncoder.encode(JSON.stringify(data));
  const cipherBuffer = await cryptoApi().subtle.encrypt(
    { name: AES_NAME, iv, additionalData: AAD },
    key,
    plaintext,
  );
  return { iv, ciphertext: new Uint8Array(cipherBuffer) };
}

export async function decryptData(key, iv, ciphertext) {
  const plainBuffer = await cryptoApi().subtle.decrypt(
    { name: AES_NAME, iv, additionalData: AAD },
    key,
    ciphertext,
  );
  return JSON.parse(textDecoder.decode(plainBuffer));
}

function stamp(createdAt) {
  const now = Date.now();
  return { createdAt: createdAt ?? now, updatedAt: now };
}

export async function createEnvelope(password, data) {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  const normalized = normalizeData(data);
  const sealed = await encryptData(key, normalized);
  const times = stamp();
  return {
    key,
    data: normalized,
    envelope: {
      id: "utama",
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      kdf: { name: KDF_NAME, hash: KDF_HASH, iterations: KDF_ITERATIONS },
      salt,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
      createdAt: times.createdAt,
      updatedAt: times.updatedAt,
    },
  };
}

export async function reseal(key, envelope, data) {
  const checked = assertEnvelope(envelope);
  const normalized = normalizeData(data);
  const sealed = await encryptData(key, normalized);
  return {
    id: "utama",
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: {
      name: KDF_NAME,
      hash: KDF_HASH,
      iterations: KDF_ITERATIONS,
    },
    salt: checked.salt,
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
    createdAt: envelope.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

export async function openEnvelope(password, envelope) {
  const checked = assertEnvelope(envelope);
  const key = await deriveKey(password, checked.salt);
  try {
    const parsed = await decryptData(key, checked.iv, checked.ciphertext);
    return { key, data: normalizeData(parsed) };
  } catch (error) {
    if (error?.message === "FORMAT") throw error;
    throw new Error("AUTH");
  }
}

export function envelopeToBackup(envelope) {
  const checked = assertEnvelope(envelope);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: { name: KDF_NAME, hash: KDF_HASH, iterations: KDF_ITERATIONS },
    salt: bytesToBase64(checked.salt),
    iv: bytesToBase64(checked.iv),
    ciphertext: bytesToBase64(checked.ciphertext),
    exportedAt: new Date().toISOString(),
  };
}

export function backupToEnvelope(backup) {
  let salt = null;
  let iv = null;
  let ciphertext = null;
  try {
    salt = base64ToBytes(backup?.salt);
    iv = base64ToBytes(backup?.iv);
    ciphertext = base64ToBytes(backup?.ciphertext);
  } catch {
    throw new Error("FORMAT");
  }
  const envelope = {
    id: "utama",
    format: backup?.format,
    version: backup?.version,
    kdf: backup?.kdf,
    salt,
    iv,
    ciphertext,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  assertEnvelope(envelope);
  return envelope;
}
