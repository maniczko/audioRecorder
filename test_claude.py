from httpx import Client
client = Client()
res = client.post("https://api.anthropic.com/v1/messages", headers={
    "x-api-key": "sk-ant-api03-P-Z-YmX6X4X4X4X4X4X-P-X4X4X4",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
}, json={
    "model": "claude-3-haiku-20240307",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "hi"}]
})
print("HTTP", res.status_code)
print(res.text)
