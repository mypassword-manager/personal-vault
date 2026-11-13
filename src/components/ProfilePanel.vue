<script setup>
import { ref, watch } from "vue";
import { copyText, saveProfile, ui } from "../session/vault-session.js";

const fullName = ref(ui.profile.fullName);
const icNumber = ref(ui.profile.icNumber);
const email = ref(ui.profile.email);
const icVisible = ref(false);

watch(
  () => ui.profile,
  (profile) => {
    fullName.value = profile.fullName;
    icNumber.value = profile.icNumber;
    email.value = profile.email;
  },
  { deep: true },
);

async function save() {
  await saveProfile({
    fullName: fullName.value,
    icNumber: icNumber.value,
    email: email.value,
  });
  icVisible.value = false;
}
</script>

<template>
  <form class="stack" @submit.prevent="save">
    <label class="field" for="nama">
      <span>Nama penuh</span>
      <input id="nama" v-model="fullName" type="text" autocomplete="name" :disabled="ui.busy" />
    </label>
    <div class="field">
      <label for="ic">Nombor IC</label>
      <input
        id="ic"
        v-model="icNumber"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        class="secret-input"
        :class="{ 'is-visible': icVisible }"
        :disabled="ui.busy"
      />
      <div class="secret-actions">
        <button type="button" class="btn btn-ghost" @click="icVisible = !icVisible">
          {{ icVisible ? "Sembunyi" : "Lihat" }}
        </button>
        <button type="button" class="btn btn-ghost" :disabled="!icNumber" @click="copyText(icNumber)">
          Salin
        </button>
      </div>
    </div>
    <label class="field" for="emel">
      <span>E-mel</span>
      <input
        id="emel"
        v-model="email"
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="off"
        spellcheck="false"
        :disabled="ui.busy"
      />
    </label>
    <p v-if="ui.error" class="alert" role="alert">{{ ui.error }}</p>
    <p v-if="ui.busyLabel" class="status" role="status">{{ ui.busyLabel }}</p>
    <button type="submit" class="btn btn-primary" :disabled="ui.busy">Simpan profil</button>
  </form>
</template>
