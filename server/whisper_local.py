#!/usr/bin/env python3
"""
whisper_local.py
Lokalna transkrypcja przy użyciu faster-whisper
"""

import sys
import json
import argparse
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({
        "error": "faster_whisper not installed. Run: pip install faster-whisper"
    }), file=sys.stdout)
    sys.exit(1)


def transcribe_audio(
    audio_path: str,
    model_size: str = "base",
    language: str = "pl",
    device: str = "cpu",
    compute_type: str = "int8",
):
    """
    Transkrypcja pliku audio przy użyciu faster-whisper
    
    Args:
        audio_path: Ścieżka do pliku audio
        model_size: Rozmiar modelu (tiny, base, small, medium, large-v2, large-v3)
        language: Kod języka (pl, en, de, etc.)
        device: 'cpu' lub 'cuda'
        compute_type: 'int8', 'float16', 'float32'
    """
    
    print(json.dumps({
        "status": "loading",
        "model": model_size,
        "language": language,
        "device": device
    }), file=sys.stderr)
    
    try:
        # Załaduj model
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root="./models/whisper"
        )
        
        # Transkrypcja
        segments, info = model.transcribe(
            audio_path,
            language=language,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200
            ),
        )
        
        # Zbierz segmenty
        result_segments = []
        for segment in segments:
            result_segments.append({
                "start": int(segment.start * 1000),  # seconds -> ms
                "end": int(segment.end * 1000),
                "text": segment.text.strip(),
                "confidence": segment.avg_logprob,
            })
        
        # Wynik
        result = {
            "text": " ".join(s["text"] for s in result_segments),
            "segments": result_segments,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "status": "success"
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }, ensure_ascii=False))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Lokalna transkrypcja Whisper")
    parser.add_argument("audio_path", help="Ścieżka do pliku audio")
    parser.add_argument("--model", default="base", 
                       choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
                       help="Rozmiar modelu")
    parser.add_argument("--language", default="pl", help="Kod języka")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], 
                       help="Urządzenie (cpu lub cuda)")
    parser.add_argument("--compute-type", default="int8",
                       choices=["int8", "float16", "float32"],
                       help="Typ obliczeń")
    
    args = parser.parse_args()
    
    if not Path(args.audio_path).exists():
        print(json.dumps({
            "error": f"Plik nie istnieje: {args.audio_path}"
        }), file=sys.stdout)
        sys.exit(1)
    
    transcribe_audio(
        args.audio_path,
        model_size=args.model,
        language=args.language,
        device=args.device,
        compute_type=args.compute_type,
    )


if __name__ == "__main__":
    main()
