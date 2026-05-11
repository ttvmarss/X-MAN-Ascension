import re

with open(r'C:\Users\Administrator\jarvis\server.py', 'r', encoding='utf-8') as f:
    c = f.read()

new_fn = '''async def synthesize_speech(text: str):
    try:
        import edge_tts, tempfile, os as _os
        communicate = edge_tts.Communicate(text, "en-GB-RyanNeural")
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name
        await communicate.save(tmp_path)
        with open(tmp_path, "rb") as f:
            audio = f.read()
        _os.unlink(tmp_path)
        return audio
    except Exception as e:
        print(f"TTS error: {e}")
        return None'''

c = re.sub(r'async def synthesize_speech\(.*?(?=\nasync def |\nclass |\n# ---)',
           new_fn + '\n\n', c, flags=re.DOTALL)

with open(r'C:\Users\Administrator\jarvis\server.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('PATCHED OK')
