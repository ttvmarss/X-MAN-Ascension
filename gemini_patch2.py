import re

with open('server.py', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add GEMINI_API_KEY if missing
if 'GEMINI_API_KEY' not in c:
    c = c.replace(
        'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")',
        'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")\nGEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")'
    )
    print('Step 1: Added GEMINI_API_KEY')
else:
    print('Step 1: GEMINI_API_KEY already present')

# 2. Replace the Anthropic API call inside generate_response using regex
# Find: await client.messages.create(...) block and replace with Gemini call
pattern = r'(    try:\n        (?:response = await client\.messages\.create|_resp = await _hc\.post).*?return [^\n]+\n    except Exception as e:\n        log\.error.*?\n        return [^\n]+)'

gemini_block = '''    try:
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
                log.error(f"Gemini error: {_data[\'error\']}")
                return "Apologies, sir. Having trouble with my language systems."
            return _data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        log.error(f"LLM error: {e}")
        return "Apologies, sir. Having trouble with my language systems."'''

# Find the generate_response function and replace its try block
fn_match = re.search(r'async def generate_response\(.*?\n(?:.*?\n)*?    try:\n.*?return "Apologies.*?\n', c, re.DOTALL)
if fn_match:
    # Find the try block within the function
    fn_text = fn_match.group(0)
    try_match = re.search(r'    try:\n        (?:response = await client|async with _hx).*?return [^\n]+\n    except Exception as e:\n        log\.error.*?\n        return [^\n]+', fn_text, re.DOTALL)
    if try_match:
        old_block = try_match.group(0)
        c = c.replace(old_block, gemini_block, 1)
        print('Step 2: generate_response patched to Gemini')
    else:
        print('Step 2: Could not find try block in generate_response')
else:
    print('Step 2: Could not find generate_response function')

# 3. Fix lifespan to allow Gemini as sentinel
if 'elif GEMINI_API_KEY:' not in c:
    # Try to add elif branch after anthropic_client assignment
    c = re.sub(
        r'(    if ANTHROPIC_API_KEY:\n        anthropic_client = anthropic\.AsyncAnthropic\(api_key=ANTHROPIC_API_KEY\)\n)    else:',
        r'\1    elif GEMINI_API_KEY:\n        anthropic_client = True\n        log.info("Using Gemini API")\n    else:',
        c
    )
    if 'elif GEMINI_API_KEY:' in c:
        print('Step 3: lifespan patched')
    else:
        print('Step 3: WARNING - could not patch lifespan')
else:
    print('Step 3: lifespan already patched')

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('Done! Run: venv\\Scripts\\python server.py')
