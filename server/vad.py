import sys
import json
import torch
import os

# Set threads to 1 for stability in some environments
torch.set_num_threads(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio file provided"}))
        return

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        return

    try:
        # Load model and utils from torch hub
        model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                      model='silero_vad',
                                      force_reload=False,
                                      trust_repo=True)
        (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = utils

        # Load audio (read_audio converts to 16kHz mono internally if needed)
        wav = read_audio(audio_path, sampling_rate=16000)

        # Get speech timestamps
        # threshold=0.5 is standard; increase if too many false positives
        speech_timestamps = get_speech_timestamps(wav, model, sampling_rate=16000, threshold=0.45)

        # Convert to seconds
        results = []
        for ts in speech_timestamps:
            results.append({
                "start": round(ts['start'] / 16000, 3),
                "end": round(ts['end'] / 16000, 3)
            })

        print(json.dumps(results))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
