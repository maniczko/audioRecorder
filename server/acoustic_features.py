#!/usr/bin/env python3
"""
Acoustic feature extraction for VoiceLog.

Usage:
    python acoustic_features.py <wav_file_path>

Output:
    JSON to stdout with keys: f0Hz, jitterLocal, shimmerLocalDb, hnrDb, formantsHz
    On error: JSON with "error" key.

Dependencies: parselmouth (Praat bindings), numpy
"""

import json
import sys
import os


def analyze(file_path: str) -> dict:
    try:
        import parselmouth
        from parselmouth.praat import call
    except ImportError:
        return {"error": "parselmouth not installed — run: pip install praat-parselmouth"}

    import numpy as np

    if not os.path.isfile(file_path):
        return {"error": f"File not found: {file_path}"}

    try:
        sound = parselmouth.Sound(file_path)
    except Exception as e:
        return {"error": f"Cannot read audio: {e}"}

    # --- F0 (pitch) ---
    try:
        pitch = call(sound, "To Pitch", 0.0, 75.0, 600.0)
        f0_values = pitch.selected_array["frequency"]
        f0_values = f0_values[f0_values > 0]
        f0_hz = float(np.median(f0_values)) if len(f0_values) > 0 else None
    except Exception:
        f0_hz = None

    # --- Jitter ---
    try:
        point_process = call(sound, "To PointProcess (periodic, cc)", 75.0, 600.0)
        jitter_local = call(point_process, "Get jitter (local)", 0.0, 0.0, 0.0001, 0.02, 1.3)
        jitter_local = round(jitter_local * 100, 3)  # percent
    except Exception:
        jitter_local = None

    # --- Shimmer ---
    try:
        point_process = call(sound, "To PointProcess (periodic, cc)", 75.0, 600.0)
        shimmer_local_db = call(
            [sound, point_process],
            "Get shimmer (local_dB)",
            0.0, 0.0, 0.0001, 0.02, 1.3, 1.6,
        )
        shimmer_local_db = round(shimmer_local_db, 3)
    except Exception:
        shimmer_local_db = None

    # --- HNR (Harmonics-to-Noise Ratio) ---
    try:
        harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75.0, 0.1, 1.0)
        hnr_values = [
            harmonicity.get_value(harmonicity.get_time_from_frame_number(i + 1))
            for i in range(harmonicity.get_number_of_frames())
        ]
        hnr_values = [v for v in hnr_values if v is not None and v != -200.0]
        hnr_db = round(float(np.mean(hnr_values)), 2) if hnr_values else None
    except Exception:
        hnr_db = None

    # --- Formants (F1, F2) ---
    try:
        formant = call(sound, "To Formant (burg)", 0.0, 5, 5500.0, 0.025, 50.0)
        n_frames = call(formant, "Get number of frames")
        f1_vals = []
        f2_vals = []
        for i in range(1, n_frames + 1):
            t = call(formant, "Get time from frame number", i)
            f1 = call(formant, "Get value at time", 1, t, "Hertz", "Linear")
            f2 = call(formant, "Get value at time", 2, t, "Hertz", "Linear")
            if f1 and f1 > 0:
                f1_vals.append(f1)
            if f2 and f2 > 0:
                f2_vals.append(f2)
        formants_hz = {
            "f1": round(float(np.median(f1_vals)), 1) if f1_vals else None,
            "f2": round(float(np.median(f2_vals)), 1) if f2_vals else None,
        }
    except Exception:
        formants_hz = {"f1": None, "f2": None}

    return {
        "f0Hz": round(f0_hz, 1) if f0_hz is not None else None,
        "jitterLocal": jitter_local,
        "shimmerLocalDb": shimmer_local_db,
        "hnrDb": hnr_db,
        "formantsHz": formants_hz,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: acoustic_features.py <wav_file>"}))
        sys.exit(1)

    result = analyze(sys.argv[1])
    print(json.dumps(result))
    sys.exit(1 if "error" in result else 0)
