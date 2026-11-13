<script setup>
import { ref } from "vue";
import AccountPanel from "./AccountPanel.vue";
import BackupActions from "./BackupActions.vue";
import ProfilePanel from "./ProfilePanel.vue";
import { ui } from "../session/vault-session.js";

const tab = ref("akaun");
</script>

<template>
  <section class="shell shell-wide">
    <div class="tabs" role="tablist" aria-label="Bahagian vault">
      <button type="button" class="tab" role="tab" :aria-selected="tab === 'profil'" @click="tab = 'profil'">
        Profil
      </button>
      <button type="button" class="tab" role="tab" :aria-selected="tab === 'akaun'" @click="tab = 'akaun'">
        Akaun
      </button>
      <button type="button" class="tab" role="tab" :aria-selected="tab === 'sandaran'" @click="tab = 'sandaran'">
        Sandaran
      </button>
    </div>
    <div class="panel">
      <ProfilePanel v-if="tab === 'profil'" />
      <AccountPanel v-else-if="tab === 'akaun'" />
      <div v-else class="stack">
        <h2>Sandaran</h2>
        <p class="lede">
          Fail sandaran mengandungi data tersulit sahaja. Ia boleh dibuka semula dengan kata laluan
          utama yang digunakan semasa sandaran dibuat.
        </p>
        <BackupActions />
        <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
        <p class="hint">Penyulitan AES-GCM. Kunci dijana dengan PBKDF2-HMAC-SHA-256, 600,000 lelaran.</p>
      </div>
    </div>
  </section>
</template>
