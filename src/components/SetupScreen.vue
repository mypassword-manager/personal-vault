<script setup>
import { ref } from "vue";
import { createVault, ui } from "../session/vault-session.js";
import BackupActions from "./BackupActions.vue";

const password = ref("");
const confirm = ref("");

async function submit() {
  await createVault(password.value, confirm.value);
}
</script>

<template>
  <section class="shell panel">
    <h2>Cipta kata laluan utama</h2>
    <p class="lede">
      Ini penggunaan pertama pada pelayar ini. Kata laluan utama tidak disimpan. Jika terlupa, vault
      dan sandaran tidak boleh dibuka.
    </p>
    <form class="stack" @submit.prevent="submit">
      <label class="field" for="master">
        <span>Kata laluan utama</span>
        <input
          id="master"
          v-model="password"
          type="password"
          autocomplete="new-password"
          autocapitalize="off"
          spellcheck="false"
          required
          :disabled="ui.busy"
        />
      </label>
      <label class="field" for="master2">
        <span>Sahkan kata laluan utama</span>
        <input
          id="master2"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          autocapitalize="off"
          spellcheck="false"
          required
          :disabled="ui.busy"
        />
      </label>
      <p class="hint">Sekurang-kurangnya 8 aksara. Gunakan frasa yang hanya anda ingat.</p>
      <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
      <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
      <button type="submit" class="btn btn-primary btn-block" :disabled="ui.busy">Cipta Vault</button>
    </form>
    <BackupActions />
  </section>
</template>
