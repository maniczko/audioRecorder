const SPEAKER_PALETTE = [
  "#75d6c4", // 0 — teal
  "#818cf8", // 1 — indigo
  "#fb923c", // 2 — orange
  "#f472b6", // 3 — pink
  "#a3e635", // 4 — lime
  "#38bdf8", // 5 — sky
  "#e879f9", // 6 — fuchsia
  "#fbbf24", // 7 — amber
];

const SPEAKER_PALETTE_DIM = SPEAKER_PALETTE.map((hex) => `${hex}40`); // 25% opacity

export function getSpeakerColor(speakerId) {
  const id = Number(speakerId);
  if (!Number.isFinite(id) || id < 0) return "var(--accent, #75d6c4)";
  return SPEAKER_PALETTE[id % SPEAKER_PALETTE.length];
}

export function getSpeakerColorDim(speakerId) {
  const id = Number(speakerId);
  if (!Number.isFinite(id) || id < 0) return "rgba(117,214,196,0.15)";
  return SPEAKER_PALETTE_DIM[id % SPEAKER_PALETTE_DIM.length];
}
