import { asBytes, assertEnvelope } from "../crypto/vault-crypto.js";

const DB_NAME = "vault-peribadi";
const DB_VERSION = 1;
const STORE = "sampul";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadEnvelope() {
  const db = await openDatabase();
  try {
    const raw = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).get("utama"));
    if (!raw) return null;
    const envelope = {
      id: "utama",
      format: raw.format,
      version: raw.version,
      kdf: raw.kdf,
      salt: asBytes(raw.salt),
      iv: asBytes(raw.iv),
      ciphertext: asBytes(raw.ciphertext),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    assertEnvelope(envelope);
    return envelope;
  } finally {
    db.close();
  }
}

export async function saveEnvelope(envelope) {
  const checked = assertEnvelope(envelope);
  const record = {
    id: "utama",
    format: envelope.format,
    version: envelope.version,
    kdf: {
      name: envelope.kdf.name,
      hash: envelope.kdf.hash,
      iterations: envelope.kdf.iterations,
    },
    salt: checked.salt,
    iv: checked.iv,
    ciphertext: checked.ciphertext,
    createdAt: envelope.createdAt ?? Date.now(),
    updatedAt: envelope.updatedAt ?? Date.now(),
  };
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
