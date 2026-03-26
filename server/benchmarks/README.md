# 🎯 STT Provider Benchmark

Automatyczne porównanie providerów Speech-to-Text dla języka polskiego.

## Quick Start

```bash
# Uruchom benchmark z domyślnym datasetem
pnpm run benchmark:stt

# Uruchom z konkretnym manifestem
pnpm run benchmark:stt:run benchmarks/pl-dataset.json

# Zobacz ostatni raport
pnpm run benchmark:stt:latest

# Lista dostępnych raportów
pnpm run benchmark:stt:list
```

## Struktura

```
server/benchmarks/
├── pl-dataset.json          # Manifest benchmarku
├── results/                 # Wygenerowane raporty
│   ├── benchmark-2026-03-26T12-00-00-000Z.json
│   └── benchmark-2026-03-26T12-00-00-000Z.md
├── samples/                 # Pliki audio do testów
│   ├── sample-001.wav
│   ├── sample-001.txt       # Referencyjna transkrypcja
│   └── ...
└── README.md
```

## Jak Dodać Własny Dataset?

1. **Przygotuj pliki audio** (WAV, MP3, WebM)
2. **Stwórz referencyjne transkrypcje** (.txt)
3. **Utwórz manifest** (JSON):

```json
{
  "datasetName": "My Dataset",
  "items": [
    {
      "id": "sample-001",
      "audioPath": "./samples/sample-001.wav",
      "transcriptPath": "./samples/sample-001.txt",
      "contentType": "audio/wav"
    }
  ]
}
```

4. **Uruchom benchmark**:
   ```bash
   pnpm run benchmark:stt:run benchmarks/my-dataset.json
   ```

## Metryki

### WER Proxy (Word Error Rate)
- **Im niższy, tym lepiej**
- 0.0 = idealne dopasowanie
- 1.0 = complete mismatch
- Obliczane jako: `(S + D + I) / N` gdzie:
  - S = substitutions
  - D = deletions
  - I = insertions
  - N = liczba słów w referencji

### Failure Rate
- Procent nieudanych transkrypcji
- Im niższy, tym lepiej

### Average Duration
- Średni czas przetwarzania na próbkę
- Im niższy, tym szybciej

## Providerzy

Domyślnie testowani:
- **OpenAI Whisper** (whisper-1)
- **Groq Whisper** (whisper-large-v3)
- **Google Cloud STT** (jeśli skonfigurowany)
- **Azure Speech** (jeśli skonfigurowany)

## CI/CD Integration

Dodaj do GitHub Actions:

```yaml
- name: STT Benchmark
  run: |
    pnpm run benchmark:stt:run benchmarks/pl-dataset.json
    pnpm run benchmark:stt:latest > benchmark-report.md
    
- name: Upload Benchmark Results
  uses: actions/upload-artifact@v4
  with:
    name: benchmark-results
    path: server/benchmarks/results/
```

## Przykładowy Raport

```markdown
# 🎯 STT Provider Benchmark Report

**Run ID:** benchmark-1711454400000
**Timestamp:** 2026-03-26T12:00:00.000Z
**Git SHA:** abc1234
**Dataset:** pl-dataset

## 🏆 Winner

**Groq Whisper** (groq-whisper)
- WER Proxy: **0.0842**

## 📈 Provider Results

| Provider | Model | WER Proxy ↓ | Failure Rate ↓ | Avg Duration (ms) |
|----------|-------|-------------|----------------|-------------------|
| 🥇 Groq Whisper | whisper-large-v3 | 0.0842 | 0.0% | 1234 |
| OpenAI Whisper | whisper-1 | 0.0956 | 0.0% | 5678 |
```

## Konfiguracja

Edytuj `.env` aby dodać providerów:

```env
# OpenAI
OPENAI_API_KEY=sk-...
VOICELOG_OPENAI_API_KEY=sk-...

# Groq
GROQ_API_KEY=gsk_...

# Google
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Azure
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
```

## Troubleshooting

### "No providers available"
- Sprawdź czy API keys są ustawione w `.env`
- Uruchom `pnpm run test:smoke` aby przetestować połączenie

### "Manifest not found"
- Upewnij się że plik manifestu istnieje
- Sprawdź ścieżkę: `benchmarks/pl-dataset.json`

### High WER Proxy
- Sprawdź jakość audio (szum, ciche nagranie)
- Upewnij się że transkrypcja referencyjna jest dokładna
- Rozważ użycie lepszego modelu (np. whisper-large-v3)
