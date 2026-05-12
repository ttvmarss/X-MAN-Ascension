import re

with open('server.py', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add GROQ_API_KEY variable
if 'GROQ_API_KEY' not in c:
    target = 'GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")'
    if target in c:
        c = c.replace(target, target + '\nGROQ_API_KEY = os.getenv("GROQ_API_KEY", "")')
        print('Step 1: Added GROQ_API_KEY variable')
    else:
        # fallback: add after ANTHROPIC_API_KEY
        c = c.replace(
            'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")',
            'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")\nGROQ_API_KEY = os.getenv("GROQ_API_KEY", "")'
        )
        print('Step 1: Added GROQ_API_KEY after ANTHROPIC_API_KEY')
else:
    print('Step 1: GROQ_API_KEY already present')

# 2. Replace the LLM call block in generate_response with Groq
groq_block = '''    try:
        import httpx as _hx
        _url = "https://api.groq.com/openai/v1/chat/completions"
        _headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        _msgs = [{"role": "system", "content": system}]
        for _m in messages:
            _msgs.append({"role": _m["role"], "content": _m["content"]})
        _body = {"model": "llama-3.3-70b-versatile", "messages": _msgs, "max_tokens": 300, "temperature": 0.7}
        async with _hx.AsyncClient(timeout=30) as _hc:
            _resp = await _hc.post(_url, headers=_headers, json=_body)
            _data = _resp.json()
            if "error" in _data:
                log.error(f"Groq error: {_data[\'error\']}")
                return "Apologies, sir. Having trouble with my language systems."
            return _data["choices"][0]["message"]["content"]
    except Exception as e:
        log.error(f"LLM error: {e}")
        return "Apologies, sir. Having trouble with my language systems."'''

# Find and replace the existing LLM call block using regex
pattern = re.compile(
    r'    try:\n        (?:import httpx|response = await client|async with _hx).*?return "Apologies.*?\n    except Exception as e:\n        log\.error.*?\n        return "Apologies[^"]*"',
    re.DOTALL
)

match = pattern.search(c)
if match:
    fn_start = c.rfind('async def generate_response', 0, match.start())
    if fn_start != -1 and fn_start > len(c) - 5000:
        c = c[:match.start()] + groq_block + c[match.end():]
        print('Step 2: generate_response patched to use Groq')
    else:
        c = c[:match.start()] + groq_block + c[match.end():]
        print('Step 2: generate_response patched to use Groq')
else:
    print('Step 2: WARNING - could not find LLM call block')

# 3. Update lifespan to treat GROQ_API_KEY as valid
if 'GROQ_API_KEY' not in c[c.find('async def lifespan'):c.find('async def lifespan')+500]:
    c = re.sub(
        r'(    if ANTHROPIC_API_KEY:\n        anthropic_client = anthropic\.AsyncAnthropic\(api_key=ANTHROPIC_API_KEY\)\n)(    elif GEMINI_API_KEY:|    else:)',
        lambda m: m.group(1) + '    elif GROQ_API_KEY:\n        anthropic_client = True\n        log.info("Using Groq API (free)")\n' + m.group(2),
        c
    )
    if 'GROQ_API_KEY' in c[c.find('async def lifespan'):c.find('async def lifespan')+600]:
        print('Step 3: lifespan updated for Groq')
    else:
        print('Step 3: WARNING - could not update lifespan (Gemini sentinel still works)')
else:
    print('Step 3: lifespan already handles Groq')

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nDone! Now run: venv\\Scripts\\python server.py')
