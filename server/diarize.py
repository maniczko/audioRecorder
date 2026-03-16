#!/usr/bin/env python3
"""
High-quality speaker diarization using pyannote.audio 3.x.

Algorytm:
  1. pyannote/speaker-diarization-3.1 — segmentacja kto kiedy mówi
  2. Wynik: JSON array [{speaker, start, end}, ...]

Użycie:
  python diarize.py <audio_file> [hf_token]

Zmienne środowiskowe:
  HF_TOKEN  — HuggingFace token (alternatywnie jako arg 2)

Wymagania (zainstaluj raz):
  pip install pyannote.audio torch torchaudio

Token HuggingFace:
  1. Zarejestruj się na https://huggingface.co
  2. Wejdź w https://hf.co/settings/tokens → New token (read)
  3. Zaakceptuj warunki modelu: https://hf.co/pyannote/speaker-diarization-3.1
  4. Ustaw HF_TOKEN=<token> w pliku .env
"""

import sys
import os
import json
import tempfile
import subprocess


def _ensure_wav_16k(audio_path: str) -> tuple[str, bool]:
    """Konwertuje do WAV 16kHz mono jeśli potrzeba. Zwraca (ścieżka, czy_tymczasowy)."""
    ext = os.path.splitext(audio_path)[1].lower()
    if ext in (".wav",):
        return audio_path, False

    ffmpeg = os.environ.get("FFMPEG_BINARY", "ffmpeg")
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", tmp.name],
            capture_output=True, timeout=120, check=True
        )
        return tmp.name, True
    except Exception as e:
        os.unlink(tmp.name)
        raise RuntimeError(f"Konwersja audio nie powiodła się: {e}") from e


def diarize(audio_path: str, hf_token: str | None = None) -> list[dict]:
    """
    Uruchamia diaryzację pyannote i zwraca listę segmentów.
    Każdy segment: { speaker: "SPEAKER_00", start: 0.0, end: 5.2 }
    """
    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError as e:
        raise RuntimeError(
            f"Brakuje pakietu: {e}. Zainstaluj: pip install pyannote.audio torch torchaudio"
        ) from e

    token = hf_token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    if not token:
        raise RuntimeError(
            "Brak HuggingFace tokena. Ustaw HF_TOKEN w .env lub podaj jako argument."
        )

    # Załaduj pipeline (pobierze model ~1GB przy pierwszym uruchomieniu)
    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token,
        )
    except Exception as e:
        raise RuntimeError(f"Nie można załadować modelu pyannote: {e}") from e

    # GPU jeśli dostępne, inaczej CPU
    device_name = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline.to(torch.device(device_name))

    # Konwertuj do WAV jeśli potrzeba
    wav_path, is_tmp = _ensure_wav_16k(audio_path)
    try:
        diarization = pipeline(wav_path)
    finally:
        if is_tmp:
            try:
                os.unlink(wav_path)
            except OSError:
                pass

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        # Normalizuj etykietę: SPEAKER_00 → speaker_0
        normalized = speaker.lower().replace("speaker_", "speaker_")
        segments.append({
            "speaker": normalized,
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
        })

    return segments


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
            "Użycie: python diarize.py <audio_file> [hf_token]\n"
            "  lub ustaw HF_TOKEN w zmiennych środowiskowych",
            file=sys.stderr,
        )
        sys.exit(1)

    audio_file = sys.argv[1]
    hf_tok = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.isfile(audio_file):
        print(json.dumps({"error": f"Plik nie istnieje: {audio_file}"}))
        sys.exit(1)

    try:
        result = diarize(audio_file, hf_tok)
        print(json.dumps(result))
    except RuntimeError as err:
        print(json.dumps({"error": str(err)}))
        sys.exit(1)
