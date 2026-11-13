<script setup>
import { continueWithoutCloud, signInCloud, ui } from "../session/vault-session.js";
</script>

<template>
  <section class="shell panel">
    <h2>Log masuk</h2>
    <p class="lede">
      Log masuk dengan akaun anda. Selepas itu, kata laluan utama masih diperlukan. Neon hanya
      menerima vault yang sudah tersulit.
    </p>
    <div class="stack">
      <button type="button" class="btn btn-primary btn-block" :disabled="ui.busy" @click="signInCloud('github')">
        Log masuk dengan GitHub
      </button>
      <button type="button" class="btn btn-secondary btn-block" :disabled="ui.busy" @click="signInCloud('google')">
        Log masuk dengan Google
      </button>
      <button type="button" class="btn btn-ghost btn-block" :disabled="ui.busy" @click="continueWithoutCloud">
        Guna telefon ini sahaja
      </button>
    </div>
    <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
    <p class="hint">
      Jangan masukkan tali sambungan Postgres di sini. URL Neon yang digunakan tidak mengandungi kata
      laluan pangkalan data.
    </p>
  </section>
</template>
