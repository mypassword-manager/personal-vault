import { createClient } from "@neon/neon-js";
import { envelopeToRecord, recordToEnvelope } from "./vault-record.js";

let client;

export function neonDatabaseUrl() {
  const value = String(import.meta.env.VITE_NEON_DATABASE_URL || "").trim();
  if (!value.startsWith("https://") || value.includes("@") || value.includes("postgres")) return "";
  return value.replace(/\/+$/, "");
}

function neonClient() {
  const url = neonDatabaseUrl();
  if (!url) return null;
  if (!client) client = createClient(url);
  return client;
}

export function cloudCallbackUrl() {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(base, window.location.href).href;
}

function userFromSession(result) {
  const user = result?.data?.user || result?.user || null;
  if (!user) return null;
  return {
    id: String(user.id || ""),
    email: String(user.email || ""),
    name: String(user.name || ""),
  };
}

export async function fetchCloudUser() {
  const neon = neonClient();
  if (!neon) return null;
  const result = await neon.auth.getSession();
  if (result?.error) return null;
  return userFromSession(result);
}

export async function startCloudLogin(provider) {
  const neon = neonClient();
  if (!neon) throw new Error("CLOUD");
  const result = await neon.auth.signIn.social({
    provider,
    callbackURL: cloudCallbackUrl(),
  });
  if (result?.error) throw new Error("CLOUD");
}

export async function endCloudSession() {
  const neon = neonClient();
  if (!neon) return;
  await neon.auth.signOut();
}

export async function pullCloudEnvelope() {
  const neon = neonClient();
  if (!neon) return null;
  const { data, error } = await neon
    .from("vault_sampul")
    .select("format,version,kdf,salt,iv,ciphertext,updated_at")
    .limit(1);
  if (error) throw new Error("CLOUD");
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return recordToEnvelope(row);
}

export async function pushCloudEnvelope(envelope) {
  const neon = neonClient();
  if (!neon) return;
  const record = envelopeToRecord(envelope);
  const existing = await neon.from("vault_sampul").select("user_id").limit(1);
  if (existing.error) throw new Error("CLOUD");
  const row = Array.isArray(existing.data) ? existing.data[0] : null;
  const result = row
    ? await neon.from("vault_sampul").update(record).eq("user_id", row.user_id)
    : await neon.from("vault_sampul").insert(record);
  if (result.error) throw new Error("CLOUD");
}
