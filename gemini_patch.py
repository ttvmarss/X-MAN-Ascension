import re

with open('server.py', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add GEMINI_API_KEY variable
if 'GEMINI_API_KEY' not in c:
    c = c.replace(
        'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")',
        'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")\nGEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")'
    )
    print('Step 1: Added GEMINI_API_KEY variable')
else:
    print('Step 1: GEMINI_API_KEY already present')

# 2. Replace generate_response to use Gemini
old_fn = '''    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=250,  # Extra room for [ACTION:X] tags
            system=system,
            messages=messages,
        )
        track_usage(response)
        return response.content[0].text
    except Exception as e:
        log.error(f"LLM error: {e}")
        return "Apologies, sir. I'm having trouble connecting to my language systems."'''

new_fn = '''    try:
        import httpx as _hx
        _url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        _msgs = []
        for _m in messages:
            _role = "model" if _m["role"] == "assistant" else "user"
            _msgs.append({"role": _role, "parts": [{"text": _m["content"]}]})
        _body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": _msgs,
            "generationConfig": {"maxOutputTokens": 300, "temperature": 0.7}
        }
        async with _hx.AsyncClient(timeout=30) as _hc:
            _resp = await _hc.post(_url, json=_body)
            _data = _resp.json()
            if "error" in _data:
                log.error(f"Gemini error: {_data['error']}")
                return "Apologies, sir. I\'m having trouble connecting to my language systems."
            return _data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        log.error(f"LLM error: {e}")
        return "Apologies, sir. I\'m having trouble connecting to my language systems."'''

if old_fn in c:
    c = c.replace(old_fn, new_fn, 1)
    print('Step 2: generate_response patched to use Gemini')
else:
    print('Step 2: WARNING - function body not found, skipping')

# 3. Make anthropic_client truthy when using Gemini
old_lf = '    if ANTHROPIC_API_KEY:\n        anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)\n    else:\n        log.warning("ANTHROPIC_API_KEY not set — LLM features disabled")'
new_lf = '    if ANTHROPIC_API_KEY:\n        anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)\n    elif GEMINI_API_KEY:\n        anthropic_client = True\n        log.info("Using Gemini API for LLM (free tier)")\n    else:\n        log.warning("No API key set - LLM features disabled")'

if old_lf in c:
    c = c.replace(old_lf, new_lf, 1)
    print('Step 3: lifespan patched for Gemini sentinel')
else:
    print('Step 3: WARNING - lifespan block not found, skipping')

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nPatch complete! Restart server with: venv\\Scripts\\python server.py')
