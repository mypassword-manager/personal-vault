<script setup>
import { ref } from "vue";
import { ui, unlock } from "../session/vault-session.js";
import BackupActions from "./BackupActions.vue";

const password = ref("");

async function submit() {
  const value = password.value;
  password.value = "";
  await unlock(value);
}
</script>

<template>
  <section class="shell panel">
    <h2>Buka Vault</h2>
    <p class="lede">Masukkan kata laluan utama untuk menyahsulit data pada pelayar ini.</p>
    <form class="stack" @submit.prevent="submit">
      <label class="field" for="unlock-password">
        <span>Kata laluan utama</span>
        <input
          id="unlock-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          autocapitalize="off"
          spellcheck="false"
          required
          :disabled="ui.busy"
        />
      </label>
      <p class="hint">Vault dikunci semula selepas muat semula, dan selepas lima minit tanpa aktiviti.</p>
      <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
      <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
      <button type="submit" class="btn btn-primary btn-block" :disabled="ui.busy">Buka</button>
    </form>
    <BackupActions />
  </section>
</template>
