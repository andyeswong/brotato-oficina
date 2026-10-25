<script setup lang="ts">
import { model, editor, version } from '../store';

// Rampas de la paleta: se elige el MATERIAL (rampa) y su tono base. La luz del render se mueve dentro de
// la rampa a partir de ese tono.
void version;
</script>

<template>
  <div class="pal">
    <div v-for="(r, ri) in model.palette.ramps" :key="r.name" class="ramp" :class="{ sel: ri === editor.ramp }">
      <span class="name">{{ r.name }}</span>
      <div class="tones">
        <button
          v-for="(c, ti) in r.colors" :key="ti" class="tone" :class="{ on: ri === editor.ramp && ti === editor.tone }"
          :style="{ background: c }" :title="`${r.name} · tono ${ti} · ${c}`"
          @click="editor.ramp = ri; editor.tone = ti"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pal { display: flex; flex-direction: column; gap: 8px; }
.ramp { display: flex; flex-direction: column; gap: 3px; padding: 4px; border-radius: 4px; }
.ramp.sel { background: #2a2d38; }
.name { color: var(--muted); font-size: 12px; }
.tones { display: flex; gap: 2px; }
.tone { width: 22px; height: 22px; padding: 0; border-radius: 3px; border: 2px solid transparent; }
.tone.on { border-color: #fff; }
</style>
