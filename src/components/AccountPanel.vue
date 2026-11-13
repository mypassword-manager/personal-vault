<script setup>
import { computed, reactive, ref } from "vue";
import { copyText, deleteAccount, saveAccount, ui } from "../session/vault-session.js";
import { safeHttpUrl } from "../utils/safe-url.js";

const mode = ref("list");
const query = ref("");
const editingId = ref("");
const confirmDelete = ref(false);
const passwordVisible = ref(false);
const form = reactive({
  websiteName: "",
  url: "",
  email: "",
  username: "",
  password: "",
});

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return ui.accounts.filter((account) => matchesQuery(account, needle));
});
const searching = computed(() => query.value.trim().length > 0);

const current = computed(() => ui.accounts.find((account) => account.id === editingId.value) || null);
const safeUrl = computed(() => (current.value ? safeHttpUrl(current.value.url) : ""));

function identity(account) {
  return account.username || account.email || "Tiada nama pengguna atau e-mel";
}

function hostOf(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(text) || text.includes(".");
  if (!looksLikeUrl) return "";
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function matchesQuery(account, needle) {
  const raw = needle.trim().toLowerCase();
  if (!raw) return true;
  const host = hostOf(account.url);
  const haystack = [account.websiteName, account.url, host, account.username, account.email]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(raw)) return true;
  const probe = hostOf(raw);
  return Boolean(probe) && (host === probe || host.endsWith(`.${probe}`) || haystack.includes(probe));
}

function resetForm() {
  form.websiteName = "";
  form.url = "";
  form.email = "";
  form.username = "";
  form.password = "";
  passwordVisible.value = false;
}

function openNew() {
  editingId.value = "";
  resetForm();
  mode.value = "form";
}

function openDetail(id) {
  editingId.value = id;
  passwordVisible.value = false;
  confirmDelete.value = false;
  mode.value = "detail";
}

function openEdit() {
  if (!current.value) return;
  form.websiteName = current.value.websiteName;
  form.url = current.value.url;
  form.email = current.value.email;
  form.username = current.value.username;
  form.password = current.value.password;
  passwordVisible.value = false;
  mode.value = "form";
}

function closeForm() {
  form.password = "";
  passwordVisible.value = false;
  mode.value = editingId.value ? "detail" : "list";
}

function backToList() {
  resetForm();
  editingId.value = "";
  confirmDelete.value = false;
  mode.value = "list";
}

async function submit() {
  const savedId = editingId.value;
  const ok = await saveAccount({
    id: savedId || undefined,
    websiteName: form.websiteName,
    url: form.url,
    email: form.email,
    username: form.username,
    password: form.password,
  });
  if (!ok) return;
  form.password = "";
  if (savedId) {
    editingId.value = savedId;
    passwordVisible.value = false;
    mode.value = "detail";
  } else {
    backToList();
  }
}

async function remove() {
  if (!editingId.value) return;
  const ok = await deleteAccount(editingId.value);
  if (!ok) return;
  confirmDelete.value = false;
  backToList();
}
</script>

<template>
  <div>
    <div v-if="mode === 'list'" class="stack">
      <div class="toolbar">
        <label class="field" for="carian">
          <span>Cari log masuk</span>
          <input
            id="carian"
            v-model="query"
            type="search"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
            placeholder="Nama aplikasi atau URL"
            autofocus
          />
        </label>
        <button type="button" class="btn btn-primary" @click="openNew">Tambah akaun</button>
      </div>
      <p v-if="!searching" class="hint">Taip nama aplikasi atau URL untuk keluarkan nama pengguna dan kata laluan.</p>
      <p v-if="ui.accounts.length === 0" class="empty">Belum ada akaun.</p>
      <p v-else-if="filtered.length === 0" class="empty">Tiada akaun sepadan.</p>
      <ul v-else class="list" data-testid="account-list">
        <li v-for="account in filtered" :key="account.id" :class="{ lookup: searching }">
          <button type="button" class="account" @click="openDetail(account.id)">
            <strong>{{ account.websiteName }}</strong>
            <span>{{ identity(account) }}</span>
            <span v-if="searching && account.url" class="meta">{{ account.url }}</span>
          </button>
          <div v-if="searching" class="creds" data-testid="lookup-result">
            <div class="cred-row">
              <div>
                <p class="meta">Nama pengguna</p>
                <p class="secret-value">{{ account.username || account.email || "Belum diisi" }}</p>
              </div>
              <button
                type="button"
                class="btn btn-ghost"
                :disabled="!(account.username || account.email)"
                @click="copyText(account.username || account.email)"
              >
                Salin
              </button>
            </div>
            <div class="cred-row">
              <div>
                <p class="meta">Kata laluan</p>
                <p class="secret-value">{{ account.password || "Belum diisi" }}</p>
              </div>
              <button type="button" class="btn btn-ghost" :disabled="!account.password" @click="copyText(account.password)">
                Salin
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <form v-else-if="mode === 'form'" class="stack" @submit.prevent="submit">
      <button type="button" class="btn btn-ghost" @click="closeForm">Kembali</button>
      <h2>{{ editingId ? "Sunting akaun" : "Akaun baharu" }}</h2>
      <div class="grid-2">
        <label class="field" for="website">
          <span>Nama aplikasi</span>
          <input id="website" v-model="form.websiteName" type="text" required :disabled="ui.busy" />
        </label>
        <label class="field" for="url">
          <span>URL</span>
          <input
            id="url"
            v-model="form.url"
            type="text"
            inputmode="url"
            autocapitalize="off"
            spellcheck="false"
            placeholder="https://"
            :disabled="ui.busy"
          />
        </label>
        <label class="field" for="emel-akaun">
          <span>E-mel akaun</span>
          <input
            id="emel-akaun"
            v-model="form.email"
            type="text"
            inputmode="email"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :disabled="ui.busy"
          />
        </label>
        <label class="field" for="username">
          <span>Nama pengguna</span>
          <input
            id="username"
            v-model="form.username"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :disabled="ui.busy"
          />
        </label>
      </div>
      <div class="field">
        <label for="kata-laluan">Kata laluan</label>
        <input
          id="kata-laluan"
          v-model="form.password"
          :type="passwordVisible ? 'text' : 'password'"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="ui.busy"
        />
        <div class="secret-actions">
          <button type="button" class="btn btn-ghost" @click="passwordVisible = !passwordVisible">
            {{ passwordVisible ? "Sembunyi" : "Lihat" }}
          </button>
        </div>
      </div>
      <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
      <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="ui.busy">Simpan</button>
        <button type="button" class="btn btn-ghost" :disabled="ui.busy" @click="backToList">Batal</button>
      </div>
    </form>

    <article v-else-if="current" class="stack" data-testid="account-detail">
      <button type="button" class="btn btn-ghost" @click="backToList">Kembali</button>
      <h2>{{ current.websiteName }}</h2>
      <p class="meta">{{ identity(current) }}</p>
      <dl class="stack">
        <div>
          <dt class="meta">URL</dt>
          <dd>
            <a v-if="safeUrl" class="link" :href="safeUrl" target="_blank" rel="noopener noreferrer">{{ current.url }}</a>
            <span v-else>{{ current.url || "Belum diisi" }}</span>
          </dd>
        </div>
        <div>
          <dt class="meta">E-mel akaun</dt>
          <dd>{{ current.email || "Belum diisi" }}</dd>
        </div>
        <div>
          <dt class="meta">Nama pengguna</dt>
          <dd>{{ current.username || "Belum diisi" }}</dd>
        </div>
      </dl>
      <div class="secret-box" data-testid="secret-password">
        <p class="secret-label">Kata laluan</p>
        <p class="secret-value">{{ passwordVisible ? current.password || "Belum diisi" : "Disembunyikan" }}</p>
        <div class="secret-actions">
          <button type="button" class="btn btn-ghost" @click="passwordVisible = !passwordVisible">
            {{ passwordVisible ? "Sembunyi" : "Lihat" }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="!current.password" @click="copyText(current.password)">
            Salin
          </button>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-secondary" @click="openEdit">Sunting</button>
        <button type="button" class="btn btn-danger" @click="confirmDelete = true">Padam</button>
      </div>
    </article>

    <div v-if="confirmDelete" class="backdrop" @click.self="confirmDelete = false">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="padam-tajuk">
        <h2 id="padam-tajuk">Padam akaun?</h2>
        <p class="lede">Padam akaun ini? Tindakan ini tidak boleh dibatalkan.</p>
        <div class="actions">
          <button type="button" class="btn btn-danger" :disabled="ui.busy" @click="remove">Ya, padam</button>
          <button type="button" class="btn btn-ghost" :disabled="ui.busy" @click="confirmDelete = false">Batal</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
dl,
dd {
  margin: 0;
}

.lookup {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.lookup .account {
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.creds {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cred-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.cred-row .secret-value {
  margin-top: var(--space-1);
}
</style>
