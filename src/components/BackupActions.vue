<script setup>
import { ref } from "vue";
import { beginImport, downloadBackup, ui } from "../session/vault-session.js";

const fileInput = ref(null);

function chooseFile() {
  fileInput.value?.click();
}

async function onFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const text = await file.text();
  await beginImport(text);
}
</script>

<template>
  <section class="stack">
    <div class="warning">
      <p>
        Memadam data pelayar boleh menghapuskan salinan tempatan vault ini. Sandaran tersulit hanya
        boleh dibuka dengan kata laluan utama yang asal.
      </p>
      <p>
        Kata laluan utama tidak disimpan dan tidak boleh dipulihkan jika terlupa. Data tidak dihantar
        ke mana-mana pelayan.
      </p>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-secondary" :disabled="ui.busy || !ui.hasVault" @click="downloadBackup">
        Eksport Sandaran Tersulit
      </button>
      <button type="button" class="btn btn-secondary" :disabled="ui.busy" @click="chooseFile">
        Import Sandaran
      </button>
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="application/json,.json"
        @change="onFile"
      />
    </div>
  </section>
</template>

<style scoped>
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
  pointer-events: none;
}
</style>
