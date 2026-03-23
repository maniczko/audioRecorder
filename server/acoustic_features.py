import json
import math
import sys


def sanitize_number(value):
    if value is None:
        return None
    try:
        numeric = float(value)
    except Exception:
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return round(numeric, 3)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: acoustic_features.py <audio_path>"}))
        return 1

    audio_path = sys.argv[1]

    try:
        import parselmouth
        from parselmouth.praat import call
    except Exception as error:
        print(json.dumps({"error": f"Missing Python dependencies for acoustic features: {error}"}))
        return 1

    try:
        sound = parselmouth.Sound(audio_path)
        duration = sound.get_total_duration()
        if not duration or duration <= 0.25:
            print(json.dumps({"error": "Audio sample is too short for acoustic analysis."}))
            return 1

        pitch = sound.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
        mean_f0 = call(pitch, "Get mean", 0, 0, "Hertz")

        point_process = call([sound, pitch], "To PointProcess (cc)")
        jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        shimmer_local_db = call([sound, point_process], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

        harmonicity = sound.to_harmonicity_cc(time_step=0.01, minimum_pitch=75, silence_threshold=0.1, periods_per_window=1.0)
        hnr = call(harmonicity, "Get mean", 0, 0)

        formant = sound.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5500, window_length=0.025, pre_emphasis_from=50)
        formants = {
            "f1": sanitize_number(call(formant, "Get mean", 1, 0, 0, "Hertz")),
            "f2": sanitize_number(call(formant, "Get mean", 2, 0, 0, "Hertz")),
            "f3": sanitize_number(call(formant, "Get mean", 3, 0, 0, "Hertz")),
            "f4": sanitize_number(call(formant, "Get mean", 4, 0, 0, "Hertz")),
        }

        print(json.dumps({
            "sampleDurationSeconds": sanitize_number(duration),
            "f0Hz": sanitize_number(mean_f0),
            "jitterLocal": sanitize_number(jitter_local * 100 if jitter_local is not None else None),
            "shimmerLocalDb": sanitize_number(shimmer_local_db),
            "hnrDb": sanitize_number(hnr),
            "formantsHz": formants,
        }))
        return 0
    except Exception as error:
        print(json.dumps({"error": f"Acoustic analysis failed: {error}"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
