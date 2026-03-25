function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, limit = 48) {
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

export function buildSketchnoteSvg(
  summaryText: string,
  bullets: Array<{ label: string; value: string; icon?: string }> = []
) {
  const title = escapeXml(String(summaryText || '').trim() || 'Podsumowanie spotkania');
  const entries = bullets.slice(0, 4);
  const bodyLines = entries.flatMap((item) => [
    `${item.icon || '•'} ${item.label}`,
    ...wrapText(item.value, 42).map((line) => `  ${line}`),
  ]);
  const textBlocks = bodyLines
    .map(
      (line, index) =>
        `<text x="48" y="${170 + index * 28}" font-size="${line.startsWith('  ') ? 20 : 24}" font-weight="${line.startsWith('  ') ? 400 : 700}" fill="#1f2937">${escapeXml(line.trim())}</text>`
    )
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Sketchnotka spotkania">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff7d6" />
          <stop offset="100%" stop-color="#ffe6c7" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" rx="48" fill="url(#bg)" />
      <circle cx="1030" cy="120" r="70" fill="#7dd3fc" opacity="0.35" />
      <circle cx="140" cy="760" r="90" fill="#f9a8d4" opacity="0.28" />
      <rect x="48" y="44" width="640" height="110" rx="28" fill="#ffffff" opacity="0.9" />
      <text x="76" y="108" font-size="42" font-weight="800" fill="#111827">${title}</text>
      <text x="76" y="142" font-size="20" fill="#475569">Wizualne podsumowanie najwazniejszych punktow</text>
      <rect x="40" y="188" width="1120" height="620" rx="36" fill="#ffffff" opacity="0.82" stroke="#f59e0b" stroke-width="4" />
      <text x="48" y="220" font-size="22" font-weight="700" fill="#7c2d12">Najwazniejsze elementy</text>
      ${textBlocks}
      <path d="M790 270 C890 230, 990 230, 1080 300" stroke="#fb7185" stroke-width="8" stroke-linecap="round" fill="none" />
      <path d="M1068 292 l28 8 -20 20" stroke="#fb7185" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <rect x="770" y="360" width="320" height="200" rx="24" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="804" y="408" font-size="24" font-weight="700" fill="#0f172a">Decyzja</text>
      <text x="804" y="444" font-size="20" fill="#334155">Co trzeba domknac po spotkaniu.</text>
      <text x="804" y="482" font-size="20" fill="#334155">Przypisz ownera i termin.</text>
      <rect x="770" y="592" width="320" height="132" rx="24" fill="#ecfeff" stroke="#67e8f9" />
      <text x="804" y="644" font-size="24" font-weight="700" fill="#0f172a">Nastepny krok</text>
      <text x="804" y="682" font-size="20" fill="#334155">Sprawdz postep i zablokuj blokery.</text>
    </svg>
  `.trim();
}

export function buildSketchnoteDataUrl(
  summaryText: string,
  bullets: Array<{ label: string; value: string; icon?: string }> = []
) {
  const svg = buildSketchnoteSvg(summaryText, bullets);
  const encoded =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}
