import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.VAULT_URL || "http://127.0.0.1:8080/";
const PASSWORD = "Ujian-Vault-2026";
const WRONG = "salah-sekali-123";
const IC = "001231-14-5678";
const SECRET = "Kunci-Rekaan-2026";
const SECRET_2 = "Lain-Rekaan-99";
const NAME = "Ahmad bin Harun";
const EMAIL = "ahmad.harun@contoh.my";
const SITE = "Perpustakaan Desa";
const USER_1 = "ahmad.desa";
const USER_2 = "ahmad.kedua";
const USER_EDITED = "ahmad.disunting";
const USER_LATER = "ahmad.belum-timpa";
const MARKERS = [PASSWORD, WRONG, IC, SECRET, SECRET_2, NAME, EMAIL, USER_1, USER_EDITED, USER_LATER];
const BACKUP_PATH = "/tmp/vault-peribadi-sandaran.json";

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

async function step(name, fn) {
  await fn();
  pass(name);
}

async function waitUnlocked(page) {
  await page.getByRole("tab", { name: "Profil" }).waitFor({ timeout: 120000 });
}

async function holdsPlaintext(page) {
  return page.evaluate(() => globalThis.__vaultDebug?.holdsPlaintext?.() ?? null);
}

async function assertHolds(page, expected) {
  const held = await holdsPlaintext(page);
  if (held === null) return;
  assert.equal(held, expected);
}

async function inspectDb(page) {
  return page.evaluate(async (markers) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vault-peribadi");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction("sampul", "readonly");
      const request = tx.objectStore("sampul").get("utama");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!record) return { empty: true };
    const cipher = new Uint8Array(record.ciphertext);
    let binary = "";
    for (let i = 0; i < cipher.length; i += 1) binary += String.fromCharCode(cipher[i]);
    const meta = JSON.stringify({
      id: record.id,
      format: record.format,
      version: record.version,
      kdf: record.kdf,
      keys: Object.keys(record),
    });
    return {
      empty: false,
      hits: markers.filter((marker) => binary.includes(marker) || meta.includes(marker)),
      iterations: record.kdf?.iterations,
      ivLen: new Uint8Array(record.iv).byteLength,
      saltLen: new Uint8Array(record.salt).byteLength,
      keys: Object.keys(record),
      ivHex: Array.from(new Uint8Array(record.iv))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    };
  }, MARKERS);
}

async function assertNoLeak(page, label) {
  const dump = await inspectDb(page);
  assert.equal(dump.empty, false, `${label}: IndexedDB kosong`);
  assert.deepEqual(dump.hits, [], `${label}: penanda ditemui ${dump.hits.join(", ")}`);
  assert.equal(dump.iterations, 600000);
  assert.equal(dump.ivLen, 12);
  assert.equal(dump.saltLen, 16);
  for (const key of ["password", "kataLaluan", "key", "profile", "accounts", "icNumber"]) {
    assert.equal(dump.keys.includes(key), false, key);
  }
  return dump;
}

async function addAccount(page, { username, password, email }) {
  await page.getByRole("button", { name: "Tambah akaun" }).click();
  await page.locator("#website").fill(SITE);
  await page.locator("#url").fill("https://perpustakaan.contoh.my");
  await page.locator("#emel-akaun").fill(email);
  await page.locator("#username").fill(username);
  await page.locator("#kata-laluan").fill(password);
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.getByRole("button", { name: new RegExp(username) }).waitFor({ timeout: 20000 });
}

async function openAccount(page, username) {
  await page.getByRole("button", { name: new RegExp(username) }).click();
  await page.getByTestId("account-detail").waitFor();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage();
page.setDefaultTimeout(20000);

try {
  await step("skrin cipta vault dipaparkan", async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Cipta kata laluan utama" }).waitFor();
  });

  await step("kata laluan pendek ditolak", async () => {
    await page.locator("#master").fill("pendek");
    await page.locator("#master2").fill("pendek");
    await page.getByRole("button", { name: "Cipta Vault" }).click();
    await page.getByRole("alert").filter({ hasText: "sekurang-kurangnya 8 aksara" }).waitFor();
  });

  await step("pengesahan kata laluan tidak sepadan ditolak", async () => {
    await page.locator("#master").fill(PASSWORD);
    await page.locator("#master2").fill("Ujian-Vault-lain");
    await page.getByRole("button", { name: "Cipta Vault" }).click();
    await page.getByText("Kata laluan tidak sepadan.").waitFor();
  });

  await step("vault baharu dicipta", async () => {
    await page.locator("#master").fill(PASSWORD);
    await page.locator("#master2").fill(PASSWORD);
    await page.getByRole("button", { name: "Cipta Vault" }).click();
    await waitUnlocked(page);
    await assertHolds(page, true);
  });

  await step("profil disimpan dan nombor IC kekal sebagai teks", async () => {
    await page.getByRole("tab", { name: "Profil" }).click();
    await page.locator("#nama").fill(NAME);
    await page.locator("#ic").fill(IC);
    await page.locator("#emel").fill(EMAIL);
    assert.equal(await page.locator("#ic").evaluate((el) => el.classList.contains("is-visible")), false);
    await page.getByRole("button", { name: "Simpan profil" }).click();
    await page.getByText("Profil disimpan.").waitFor();
    assert.equal(await page.locator("#ic").inputValue(), IC);
  });

  await step("nombor IC boleh dilihat, disembunyi dan disalin", async () => {
    await page.getByRole("button", { name: "Lihat" }).click();
    assert.equal(await page.locator("#ic").evaluate((el) => el.classList.contains("is-visible")), true);
    await page.getByRole("button", { name: "Sembunyi" }).click();
    await page.getByRole("button", { name: "Salin" }).click();
    await page.getByText("Disalin.").waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), IC);
  });

  await step("nama website kosong ditolak", async () => {
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: "Tambah akaun" }).click();
    await page.locator("#website").fill("   ");
    await page.getByRole("button", { name: "Simpan" }).click();
    await page.getByText("Nama aplikasi diperlukan.").waitFor();
  });

  await step("dua akaun untuk website yang sama boleh ditambah", async () => {
    await page.getByRole("button", { name: "Batal" }).click();
    await addAccount(page, { username: USER_1, password: SECRET, email: "ahmad@contoh.my" });
    await addAccount(page, { username: USER_2, password: SECRET_2, email: "kedua@contoh.my" });
    const list = await page.getByTestId("account-list").innerHTML();
    assert.equal(list.includes(SECRET), false);
    assert.equal(list.includes(SECRET_2), false);
    assert.match(list, new RegExp(USER_1));
    assert.match(list, new RegExp(USER_2));
  });

  await step("carian mengasingkan akaun", async () => {
    await page.locator("#carian").fill("kedua");
    await page.getByRole("button", { name: new RegExp(USER_2) }).waitFor();
    assert.equal(await page.getByRole("button", { name: new RegExp(USER_1) }).count(), 0);
    await page.getByTestId("lookup-result").getByText(SECRET_2).waitFor();
    assert.equal(await page.getByText(SECRET).count(), 0);
    await page.locator("#carian").fill("perpustakaan.contoh.my");
    await page.getByRole("button", { name: new RegExp(USER_1) }).waitFor();
    await page.getByRole("button", { name: new RegExp(USER_2) }).waitFor();
    await page.locator("#carian").fill("");
    await page.getByRole("button", { name: new RegExp(USER_1) }).waitFor();
  });

  await step("kata laluan tersembunyi, boleh dilihat dan disalin", async () => {
    await openAccount(page, USER_1);
    const hidden = await page.getByTestId("secret-password").innerHTML();
    assert.equal(hidden.includes(SECRET), false);
    assert.match(hidden, /Disembunyikan/);
    await page.getByRole("button", { name: "Lihat" }).click();
    await page.getByText(SECRET).waitFor();
    await page.getByRole("button", { name: "Sembunyi" }).click();
    assert.equal((await page.getByTestId("account-detail").innerHTML()).includes(SECRET), false);
    await page.getByTestId("secret-password").getByRole("button", { name: "Salin" }).click();
    await page.getByText("Disalin.").waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), SECRET);
  });

  await step("akaun boleh disunting", async () => {
    await page.getByRole("button", { name: "Sunting" }).click();
    await page.locator("#username").fill(USER_EDITED);
    await page.getByRole("button", { name: "Simpan" }).click();
    await page.getByText(USER_EDITED).first().waitFor();
  });

  await step("padam minta pengesahan dan hanya memadam akaun dipilih", async () => {
    await page.getByRole("button", { name: "Kembali" }).click();
    await openAccount(page, USER_2);
    await page.getByRole("button", { name: "Padam" }).click();
    await page.getByRole("heading", { name: "Padam akaun?" }).waitFor();
    await page.getByRole("button", { name: "Batal" }).click();
    await page.getByText(USER_2).first().waitFor();
    await page.getByRole("button", { name: "Padam" }).click();
    await page.getByRole("button", { name: "Ya, padam" }).click();
    await page.getByRole("button", { name: new RegExp(USER_EDITED) }).waitFor();
    assert.equal(await page.getByRole("button", { name: new RegExp(USER_2) }).count(), 0);
  });

  let ivBefore = "";
  await step("IndexedDB tidak mengandungi teks profil atau kata laluan", async () => {
    const dump = await assertNoLeak(page, "selepas simpan");
    ivBefore = dump.ivHex;
  });

  await step("muat semula mengunci vault dan data tidak kelihatan", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Buka Vault" }).waitFor();
    assert.equal(await page.getByText(NAME).count(), 0);
    assert.equal(await page.getByText(IC).count(), 0);
    await assertHolds(page, false);
  });

  await step("kata laluan salah gagal membuka vault", async () => {
    await page.locator("#unlock-password").fill(WRONG);
    await page.getByRole("button", { name: "Buka" }).click();
    await page.getByText("Kata laluan tidak tepat.").waitFor({ timeout: 120000 });
    await page.getByRole("heading", { name: "Buka Vault" }).waitFor();
    await assertHolds(page, false);
    assert.equal(await page.getByText(NAME).count(), 0);
  });

  await step("kata laluan betul memulihkan data selepas muat semula", async () => {
    await page.locator("#unlock-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Buka" }).click();
    await waitUnlocked(page);
    await page.getByRole("tab", { name: "Profil" }).click();
    assert.equal(await page.locator("#ic").inputValue(), IC);
    assert.equal(await page.locator("#nama").inputValue(), NAME);
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: new RegExp(USER_EDITED) }).waitFor();
  });

  await step("sandaran tersulit tidak mengandungi teks biasa", async () => {
    await page.getByRole("tab", { name: "Sandaran" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Eksport Sandaran Tersulit" }).click();
    const download = await downloadPromise;
    await download.saveAs(BACKUP_PATH);
    const raw = fs.readFileSync(BACKUP_PATH, "utf8");
    const backup = JSON.parse(raw);
    assert.equal(backup.format, "vault-peribadi-backup");
    assert.equal(backup.kdf.iterations, 600000);
    assert.equal(backup.kdf.hash, "SHA-256");
    for (const marker of MARKERS) assert.equal(raw.includes(marker), false, marker);
  });

  await step("import kata laluan salah tidak menukar data", async () => {
    await page.getByRole("tab", { name: "Akaun" }).click();
    await openAccount(page, USER_EDITED);
    await page.getByRole("button", { name: "Sunting" }).click();
    await page.locator("#username").fill(USER_LATER);
    await page.getByRole("button", { name: "Simpan" }).click();
    await page.getByText(USER_LATER).first().waitFor();
    await page.getByRole("tab", { name: "Sandaran" }).click();
    await page.locator("input[type=file]").setInputFiles(BACKUP_PATH);
    await page.locator("#import-password").fill(WRONG);
    await page.getByRole("button", { name: "Sahkan sandaran" }).click();
    await page.getByText("Kata laluan tidak tepat. Sandaran tidak digunakan.").waitFor({ timeout: 120000 });
    await page.getByRole("button", { name: "Batal" }).click();
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: new RegExp(USER_LATER) }).waitFor();
  });

  await step("import yang dibatalkan tidak menimpa vault", async () => {
    await page.getByRole("tab", { name: "Sandaran" }).click();
    await page.locator("input[type=file]").setInputFiles(BACKUP_PATH);
    await page.locator("#import-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sahkan sandaran" }).click();
    await page.getByRole("button", { name: "Timpa vault" }).waitFor({ timeout: 120000 });
    await page.getByRole("button", { name: "Batal" }).click();
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: new RegExp(USER_LATER) }).waitFor();
  });

  await step("sandaran dipulihkan selepas pengesahan timpa", async () => {
    await page.getByRole("tab", { name: "Sandaran" }).click();
    await page.locator("input[type=file]").setInputFiles(BACKUP_PATH);
    await page.locator("#import-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sahkan sandaran" }).click();
    await page.getByRole("button", { name: "Timpa vault" }).click();
    await page.getByText("Sandaran dipulihkan.").waitFor({ timeout: 20000 });
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: new RegExp(USER_EDITED) }).waitFor();
    assert.equal(await page.getByRole("button", { name: new RegExp(USER_LATER) }).count(), 0);
    const dump = await assertNoLeak(page, "selepas import");
    assert.notEqual(dump.ivHex, "");
    void ivBefore;
  });

  await step("butang Kunci Vault melepaskan data daripada paparan", async () => {
    await page.getByRole("button", { name: "Kunci Vault" }).click();
    await page.getByRole("heading", { name: "Buka Vault" }).waitFor();
    await assertHolds(page, false);
    assert.equal(await page.getByText(NAME).count(), 0);
    assert.equal(await page.getByText(SECRET).count(), 0);
    assert.equal(await page.getByText(IC).count(), 0);
  });

  await step("import selepas data pelayar dipadam memulihkan sandaran", async () => {
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase("vault-peribadi");
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        }),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Cipta kata laluan utama" }).waitFor();
    await page.locator("input[type=file]").setInputFiles(BACKUP_PATH);
    await page.locator("#import-password").fill(WRONG);
    await page.getByRole("button", { name: "Sahkan sandaran" }).click();
    await page.getByText("Kata laluan tidak tepat. Sandaran tidak digunakan.").waitFor({ timeout: 120000 });
    await page.getByRole("button", { name: "Batal" }).click();
    assert.equal((await inspectDb(page)).empty, true);
    await page.locator("input[type=file]").setInputFiles(BACKUP_PATH);
    await page.locator("#import-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sahkan sandaran" }).click();
    await page.getByRole("button", { name: "Pulihkan sandaran" }).click();
    await page.getByText("Sandaran dipulihkan.").waitFor({ timeout: 20000 });
    await page.getByRole("tab", { name: "Profil" }).click();
    assert.equal(await page.locator("#nama").inputValue(), NAME);
    assert.equal(await page.locator("#ic").inputValue(), IC);
    await page.getByRole("tab", { name: "Akaun" }).click();
    await page.getByRole("button", { name: new RegExp(USER_EDITED) }).waitFor();
    await assertNoLeak(page, "selepas pulih");
  });

  console.log(JSON.stringify({ ok: true, passed: results.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, passed: results.map((item) => item.name), error: String(error) }, null, 2));
  await page.screenshot({ path: "/workspace/screenshots/vault-e2e-fail.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
