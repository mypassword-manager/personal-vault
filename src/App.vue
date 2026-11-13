<script setup>
import { onMounted } from "vue";
import { init, lock, signOutCloud, ui } from "./session/vault-session.js";
import CloudLogin from "./components/CloudLogin.vue";
import ImportDialog from "./components/ImportDialog.vue";
import SetupScreen from "./components/SetupScreen.vue";
import UnlockScreen from "./components/UnlockScreen.vue";
import VaultHome from "./components/VaultHome.vue";

onMounted(() => {
  init();
});
</script>

<template>
  <div class="app" :data-status="ui.status">
    <header class="topbar">
      <div class="brand">
        <svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <h1>Vault Peribadi</h1>
      </div>
      <div class="top-actions">
        <button v-if="ui.cloudUser" type="button" class="btn btn-ghost" @click="signOutCloud">Keluar</button>
        <button
          v-if="ui.status === 'unlocked'"
          type="button"
          class="btn btn-secondary"
          @click="lock('Vault dikunci.')"
        >
          Kunci Vault
        </button>
      </div>
    </header>

    <p v-if="ui.status === 'loading'" class="status shell" role="status">Menyemak vault tempatan…</p>
    <CloudLogin v-else-if="ui.status === 'cloud'" />
    <SetupScreen v-else-if="ui.status === 'setup'" />
    <UnlockScreen v-else-if="ui.status === 'locked'" />
    <VaultHome v-else />

    <p v-if="ui.notice" class="toast" role="status">{{ ui.notice }}</p>
    <ImportDialog />
  </div>
</template>
