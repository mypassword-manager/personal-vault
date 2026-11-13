import assert from "node:assert/strict";
import test from "node:test";
import {
  KDF_ITERATIONS,
  backupToEnvelope,
  createEnvelope,
  decryptData,
  emptyVault,
  envelopeToBackup,
  openEnvelope,
  reseal,
} from "../src/crypto/vault-crypto.js";
import { envelopeToRecord, recordToEnvelope } from "../src/cloud/vault-record.js";

const PASSWORD = "Ujian-Vault-2026";
const IC = "001231-14-5678";
const SECRET = "Kunci-Rekaan-2026";
const MARKERS = [PASSWORD, IC, SECRET, "Ahmad bin Harun", "ahmad.harun@contoh.my", "ahmad.desa"];

test("data vault tersulit, sifar IC kekal, dan kata laluan salah ditolak", async () => {
  const data = emptyVault();
  data.profile = {
    fullName: "Ahmad bin Harun",
    icNumber: IC,
    email: "ahmad.harun@contoh.my",
  };
  data.accounts.push({
    id: "akaun-1",
    websiteName: "Perpustakaan Desa",
    url: "https://perpustakaan.contoh.my",
    email: "ahmad@contoh.my",
    username: "ahmad.desa",
    password: SECRET,
    createdAt: 1,
    updatedAt: 1,
  });

  const created = await createEnvelope(PASSWORD, data);
  assert.equal(created.key.extractable, false);
  assert.equal(created.envelope.kdf.iterations, KDF_ITERATIONS);
  assert.equal(created.envelope.kdf.hash, "SHA-256");
  assert.equal(created.envelope.salt.byteLength, 16);
  assert.equal(created.envelope.iv.byteLength, 12);
  assert.equal(created.data.profile.icNumber, IC);

  const opened = await openEnvelope(PASSWORD, created.envelope);
  assert.equal(opened.data.profile.icNumber, IC);
  assert.equal(opened.data.accounts[0].password, SECRET);
  assert.equal(opened.key.extractable, false);

  await assert.rejects(() => openEnvelope("salah-sekali-123", created.envelope), { message: "AUTH" });

  const resealed = await reseal(created.key, created.envelope, opened.data);
  assert.notEqual(Buffer.from(resealed.iv).toString("hex"), Buffer.from(created.envelope.iv).toString("hex"));
  const again = await decryptData(created.key, resealed.iv, resealed.ciphertext);
  assert.equal(again.profile.icNumber, IC);

  const backup = envelopeToBackup(created.envelope);
  const raw = JSON.stringify(backup);
  for (const marker of MARKERS) {
    assert.equal(raw.includes(marker), false, `penanda muncul dalam sandaran: ${marker}`);
  }
  const record = envelopeToRecord(created.envelope);
  const stored = JSON.stringify(record);
  for (const marker of MARKERS) {
    assert.equal(stored.includes(marker), false, `penanda muncul dalam rekod Neon: ${marker}`);
  }
  const cloudRestored = recordToEnvelope({ ...record, updated_at: "2026-01-02T00:00:00.000Z" });
  assert.equal(cloudRestored.updatedAt, Date.parse("2026-01-02T00:00:00.000Z"));
  assert.equal(cloudRestored.kdf.iterations, KDF_ITERATIONS);
  const restored = backupToEnvelope(backup);
  const fromBackup = await decryptData(created.key, restored.iv, restored.ciphertext);
  assert.equal(fromBackup.profile.icNumber, IC);
  assert.equal(fromBackup.accounts[0].password, SECRET);

  const latin = Buffer.from(created.envelope.ciphertext).toString("latin1");
  for (const marker of MARKERS) {
    assert.equal(latin.includes(marker), false, `penanda muncul dalam ciphertext: ${marker}`);
  }

  const tampered = new Uint8Array(created.envelope.ciphertext);
  tampered[0] ^= 0xff;
  await assert.rejects(() => decryptData(created.key, created.envelope.iv, tampered));

  assert.throws(
    () =>
      envelopeToBackup({
        ...created.envelope,
        kdf: { ...created.envelope.kdf, iterations: 1 },
      }),
    { message: "FORMAT" },
  );
  assert.throws(() => backupToEnvelope({ format: "bukan" }), { message: "FORMAT" });
});
