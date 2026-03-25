import urllib.request
import json
import sys

API_KEY = "AIzaSyBqssX6l1-xziA3-M2ETjeKmlqPsgkJgpI"
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        models = [m['name'].split('/')[1] for m in data.get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
        print("Available models:")
        for m in sorted(models):
            print(f"- {m}")
except Exception as e:
    print("Error:", e)
    sys.exit(1)
