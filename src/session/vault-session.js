import { reactive } from "vue";
import {
  backupToEnvelope,
  createEnvelope,
  emptyVault,
  envelopeToBackup,
  openEnvelope,
  reseal,
} from "../crypto/vault-crypto.js";
import { loadEnvelope, saveEnvelope } from "../storage/vault-db.js";
import { createIdleWatch } from "./idle.js";
import {
  endCloudSession,
  fetchCloudUser,
  neonDatabaseUrl,
  pullCloudEnvelope,
  pushCloudEnvelope,
  startCloudLogin,
} from "../cloud/neon-sync.js";

const emptyProfile = () => ({ fullName: "", icNumber: "", email: "" });

export const ui = reactive({
  status: "loading",
  busy: false,
  busyLabel: "",
  error: "",
  notice: "",
  hasVault: false,
  cloudEnabled: false,
  cloudUser: null,
  importStep: null,
  importError: "",
  profile: emptyProfile(),
  accounts: [],
});

let cryptoKey = null;
let plaintext = null;
let envelope = null;
let pending = null;
let idleWatch = null;
let noticeTimer = 0;
let cloudSkipped = false;
const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

function notify(message) {
  ui.notice = message;
  ui.error = "";
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    if (ui.notice === message) ui.notice = "";
  }, 3600);
}

function publish() {
  if (!plaintext) {
    ui.profile = emptyProfile();
    ui.accounts = [];
    return;
  }
  ui.profile = { ...plaintext.profile };
  ui.accounts = plaintext.accounts.map((account) => ({ ...account }));
}

function wipePending() {
  if (!pending) return;
  pending.key = null;
  pending.data = null;
  pending.envelope = null;
  pending = null;
}

function syncDebug() {
  if (import.meta.env?.DEV) {
    globalThis.__vaultDebug = {
      holdsPlaintext: () =>
        plaintext !== null || cryptoKey !== null || Boolean(pending?.key || pending?.data),
    };
  }
}

function onActivity() {
  idleWatch?.poke();
}

function onVisibility() {
  if (document.visibilityState === "visible") idleWatch?.checkNow();
}

export function startIdle() {
  stopIdle();
  idleWatch = createIdleWatch({
    onIdle: () => lock("Vault dikunci selepas lima minit tanpa aktiviti."),
  });
  for (const eventName of activityEvents) {
    window.addEventListener(eventName, onActivity, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", onVisibility);
  idleWatch.start();
}

export function stopIdle() {
  idleWatch?.stop();
  idleWatch = null;
  for (const eventName of activityEvents) {
    window.removeEventListener(eventName, onActivity, { capture: true });
  }
  document.removeEventListener("visibilitychange", onVisibility);
}

async function syncCloud(nextEnvelope) {
  if (!ui.cloudUser || !nextEnvelope) return;
  try {
    await pushCloudEnvelope(nextEnvelope);
  } catch {
    ui.error = "Disimpan pada telefon ini. Gagal menghantar salinan tersulit ke Neon.";
  }
}

async function reconcileCloud(local) {
  const remote = await pullCloudEnvelope();
  if (!remote) {
    if (local) await pushCloudEnvelope(local);
    return local;
  }
  if (!local || (remote.updatedAt || 0) > (local.updatedAt || 0)) {
    await saveEnvelope(remote);
    return remote;
  }
  if ((local.updatedAt || 0) > (remote.updatedAt || 0)) await pushCloudEnvelope(local);
  return local;
}

async function readLocalEnvelope() {
  try {
    envelope = ui.cloudUser ? await reconcileCloud(await loadEnvelope()) : await loadEnvelope();
    ui.hasVault = Boolean(envelope);
    ui.status = envelope ? "locked" : "setup";
  } catch {
    envelope = null;
    ui.hasVault = false;
    ui.status = "setup";
    ui.error = ui.cloudUser
      ? "Gagal membaca vault. Semak jadual Neon atau data tempatan."
      : "Data tempatan tidak dapat dibaca. Import sandaran atau cipta vault baharu.";
  }
}

export function lock(message) {
  stopIdle();
  wipePending();
  cryptoKey = null;
  plaintext = null;
  ui.importStep = null;
  ui.importError = "";
  ui.profile = emptyProfile();
  ui.accounts = [];
  ui.status = envelope ? "locked" : "setup";
  ui.hasVault = Boolean(envelope);
  ui.error = "";
  if (message) notify(message);
  syncDebug();
}

async function commit(nextData) {
  if (!cryptoKey || !envelope) throw new Error("LOCKED");
  const nextEnvelope = await reseal(cryptoKey, envelope, nextData);
  await saveEnvelope(nextEnvelope);
  envelope = nextEnvelope;
  plaintext = nextData;
  publish();
  await syncCloud(nextEnvelope);
}

export async function init() {
  ui.busy = true;
  ui.busyLabel = "Menyemak vault tempatan…";
  ui.error = "";
  try {
    ui.cloudEnabled = Boolean(neonDatabaseUrl());
    ui.cloudUser = null;
    if (ui.cloudEnabled && !cloudSkipped) {
      try {
        ui.cloudUser = await fetchCloudUser();
      } catch {
        ui.cloudUser = null;
        ui.error = "Neon tidak dapat dihubungi.";
      }
      if (!ui.cloudUser) {
        envelope = null;
        ui.hasVault = false;
        ui.status = "cloud";
        return;
      }
    }
    await readLocalEnvelope();
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
    syncDebug();
  }
}

export async function signInCloud(provider) {
  ui.error = "";
  ui.busy = true;
  ui.busyLabel = "Membuka log masuk…";
  try {
    await startCloudLogin(provider);
  } catch {
    ui.error = "Log masuk tidak berjaya. Semak penyedia OAuth dalam Neon.";
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
  }
}

export async function continueWithoutCloud() {
  cloudSkipped = true;
  await init();
}

export async function signOutCloud() {
  lock();
  ui.cloudUser = null;
  cloudSkipped = false;
  try {
    await endCloudSession();
  } catch {
    ui.error = "Sesi Neon tidak dapat ditutup.";
  }
  ui.status = ui.cloudEnabled ? "cloud" : ui.status;
}

export async function createVault(password, confirm) {
  ui.error = "";
  if (password.length < 8) {
    ui.error = "Kata laluan utama mestilah sekurang-kurangnya 8 aksara.";
    return;
  }
  if (password !== confirm) {
    ui.error = "Kata laluan tidak sepadan.";
    return;
  }
  ui.busy = true;
  ui.busyLabel = "Menyediakan kunci…";
  try {
    const created = await createEnvelope(password, emptyVault());
    await saveEnvelope(created.envelope);
    cryptoKey = created.key;
    plaintext = created.data;
    envelope = created.envelope;
    ui.hasVault = true;
    ui.status = "unlocked";
    publish();
    startIdle();
    await syncCloud(created.envelope);
    if (!ui.error) notify("Vault sedia. Kata laluan utama tidak disimpan.");
  } catch {
    cryptoKey = null;
    plaintext = null;
    ui.error = "Gagal mencipta vault.";
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
    syncDebug();
  }
}

export async function unlock(password) {
  ui.error = "";
  ui.busy = true;
  ui.busyLabel = "Membuka vault…";
  try {
    if (!envelope) envelope = await loadEnvelope();
    if (!envelope) {
      ui.status = "setup";
      ui.hasVault = false;
      return;
    }
    const opened = await openEnvelope(password, envelope);
    cryptoKey = opened.key;
    plaintext = opened.data;
    ui.status = "unlocked";
    ui.hasVault = true;
    publish();
    startIdle();
  } catch (error) {
    cryptoKey = null;
    plaintext = null;
    publish();
    ui.status = "locked";
    ui.error =
      error?.message === "FORMAT"
        ? "Data vault rosak atau format tidak sah."
        : "Kata laluan tidak tepat.";
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
    syncDebug();
  }
}

export async function saveProfile(profile) {
  if (!plaintext) return false;
  ui.error = "";
  ui.busy = true;
  ui.busyLabel = "Menyimpan…";
  try {
    await commit({
      profile: {
        fullName: String(profile.fullName ?? ""),
        icNumber: String(profile.icNumber ?? ""),
        email: String(profile.email ?? ""),
      },
      accounts: plaintext.accounts.map((account) => ({ ...account })),
    });
    if (!ui.error) notify("Profil disimpan.");
    return true;
  } catch {
    ui.error = "Gagal menyimpan.";
    return false;
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
  }
}

export async function saveAccount(input) {
  if (!plaintext) return false;
  const websiteName = String(input.websiteName ?? "").trim();
  if (!websiteName) {
    ui.error = "Nama aplikasi diperlukan.";
    return false;
  }
  ui.error = "";
  ui.busy = true;
  ui.busyLabel = "Menyimpan…";
  try {
    const now = Date.now();
    const accounts = plaintext.accounts.map((account) => ({ ...account }));
    if (input.id) {
      const index = accounts.findIndex((account) => account.id === input.id);
      if (index < 0) {
        ui.error = "Akaun tidak dijumpai.";
        return false;
      }
      accounts[index] = {
        ...accounts[index],
        websiteName,
        url: String(input.url ?? "").trim(),
        email: String(input.email ?? "").trim(),
        username: String(input.username ?? "").trim(),
        password: String(input.password ?? ""),
        updatedAt: now,
      };
    } else {
      accounts.push({
        id: globalThis.crypto.randomUUID(),
        websiteName,
        url: String(input.url ?? "").trim(),
        email: String(input.email ?? "").trim(),
        username: String(input.username ?? "").trim(),
        password: String(input.password ?? ""),
        createdAt: now,
        updatedAt: now,
      });
    }
    await commit({
      profile: { ...plaintext.profile },
      accounts,
    });
    if (!ui.error) notify("Akaun disimpan.");
    return true;
  } catch {
    ui.error = "Gagal menyimpan.";
    return false;
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
  }
}

export async function deleteAccount(id) {
  if (!plaintext) return false;
  ui.error = "";
  ui.busy = true;
  ui.busyLabel = "Menyimpan…";
  try {
    await commit({
      profile: { ...plaintext.profile },
      accounts: plaintext.accounts.filter((account) => account.id !== id).map((account) => ({ ...account })),
    });
    if (!ui.error) notify("Akaun dipadam.");
    return true;
  } catch {
    ui.error = "Gagal menyimpan.";
    return false;
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
  }
}

export async function downloadBackup() {
  ui.error = "";
  try {
    const source = envelope || (await loadEnvelope());
    if (!source) {
      ui.error = "Tiada data untuk dieksport.";
      return;
    }
    const backup = envelopeToBackup(source);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `vault-peribadi-sandaran-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    notify("Sandaran tersulit dimuat turun.");
  } catch {
    ui.error = "Gagal mengeksport sandaran.";
  }
}

export async function beginImport(text) {
  ui.error = "";
  ui.importError = "";
  wipePending();
  if (typeof text !== "string" || text.length === 0 || text.length > 3_000_000) {
    ui.error = "Format sandaran tidak sah.";
    return;
  }
  try {
    const parsed = JSON.parse(text);
    const nextEnvelope = backupToEnvelope(parsed);
    pending = { envelope: nextEnvelope, key: null, data: null };
    ui.importStep = "password";
  } catch {
    wipePending();
    ui.importStep = null;
    ui.error = "Format sandaran tidak sah.";
  }
}

export async function verifyImportPassword(password) {
  if (!pending?.envelope) return;
  ui.importError = "";
  ui.busy = true;
  ui.busyLabel = "Mengesahkan sandaran…";
  try {
    const opened = await openEnvelope(password, pending.envelope);
    pending.key = opened.key;
    pending.data = opened.data;
    ui.importStep = "confirm";
  } catch {
    if (pending) {
      pending.key = null;
      pending.data = null;
    }
    ui.importStep = "password";
    ui.importError = "Kata laluan tidak tepat. Sandaran tidak digunakan.";
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
    syncDebug();
  }
}

export function cancelImport() {
  wipePending();
  ui.importStep = null;
  ui.importError = "";
  syncDebug();
}

export async function confirmImport() {
  if (!pending?.envelope || !pending.key || !pending.data) return;
  ui.busy = true;
  ui.busyLabel = "Memulihkan sandaran…";
  try {
    await saveEnvelope(pending.envelope);
    cryptoKey = pending.key;
    plaintext = pending.data;
    envelope = pending.envelope;
    pending.key = null;
    pending.data = null;
    pending.envelope = null;
    pending = null;
    ui.importStep = null;
    ui.importError = "";
    ui.hasVault = true;
    ui.status = "unlocked";
    publish();
    stopIdle();
    startIdle();
    await syncCloud(envelope);
    if (!ui.error) notify("Sandaran dipulihkan.");
  } catch {
    ui.importError = "Gagal memulihkan sandaran. Vault semasa tidak ditukar.";
  } finally {
    ui.busy = false;
    ui.busyLabel = "";
    syncDebug();
  }
}

export async function copyText(value) {
  const text = String(value ?? "");
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      try {
        area.select();
        const ok = document.execCommand("copy");
        if (!ok) throw new Error("copy");
      } finally {
        area.remove();
      }
    }
    notify("Disalin.");
    return true;
  } catch {
    ui.error = "Gagal menyalin. Pastikan laman dibuka melalui localhost atau HTTPS.";
    return false;
  }
}
