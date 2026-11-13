<script setup>
import { ref } from "vue";
import { cancelImport, confirmImport, ui, verifyImportPassword } from "../session/vault-session.js";

const password = ref("");

async function verify() {
  const value = password.value;
  password.value = "";
  await verifyImportPassword(value);
}

async function confirm() {
  await confirmImport();
}
</script>

<template>
  <div v-if="ui.importStep" class="backdrop" @click.self="cancelImport">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <h2 id="import-title">Import Sandaran</h2>
      <form v-if="ui.importStep === 'password'" class="stack" @submit.prevent="verify">
        <p class="lede">
          Masukkan kata laluan asal sandaran. Vault semasa tidak ditukar sehingga sandaran berjaya
          disahkan dan anda mengesahkan timpa.
        </p>
        <label class="field">
          <span>Kata laluan asal sandaran</span>
          <input
            id="import-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            autocapitalize="off"
            spellcheck="false"
            required
            :disabled="ui.busy"
          />
        </label>
        <p v-if="ui.importError" class="alert" role="alert">{{ ui.importError }}</p>
        <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="ui.busy">Sahkan sandaran</button>
          <button type="button" class="btn btn-ghost" :disabled="ui.busy" @click="cancelImport">Batal</button>
        </div>
      </form>
      <div v-else class="stack">
        <p>Sandaran berjaya disahkan dengan kata laluan asalnya.</p>
        <p v-if="ui.hasVault">
          Timpa vault semasa dengan sandaran ini? Data semasa akan diganti dan kata laluan utama
          bertukar kepada kata laluan sandaran.
        </p>
        <p v-else>Pulihkan sandaran ini ke dalam pelayar?</p>
        <p v-if="ui.importError" class="alert" role="alert">{{ ui.importError }}</p>
        <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
        <div class="actions">
          <button type="button" class="btn btn-danger" :disabled="ui.busy" @click="confirm">
            {{ ui.hasVault ? "Timpa vault" : "Pulihkan sandaran" }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="ui.busy" @click="cancelImport">Batal</button>
        </div>
      </div>
    </div>
  </div>
</template>
