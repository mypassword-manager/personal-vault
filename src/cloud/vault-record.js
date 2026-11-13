import { backupToEnvelope, envelopeToBackup } from "../crypto/vault-crypto.js";

export function envelopeToRecord(envelope) {
  const backup = envelopeToBackup(envelope);
  return {
    format: backup.format,
    version: backup.version,
    kdf: backup.kdf,
    salt: backup.salt,
    iv: backup.iv,
    ciphertext: backup.ciphertext,
    updated_at: new Date(envelope.updatedAt || Date.now()).toISOString(),
  };
}

export function recordToEnvelope(row) {
  const envelope = backupToEnvelope({
    format: row?.format,
    version: row?.version,
    kdf: row?.kdf,
    salt: row?.salt,
    iv: row?.iv,
    ciphertext: row?.ciphertext,
  });
  const updatedAt = Date.parse(row?.updated_at);
  if (Number.isFinite(updatedAt)) envelope.updatedAt = updatedAt;
  return envelope;
}
