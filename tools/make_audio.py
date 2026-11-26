# 카드 낱말·문장 음성 생성: python tools/make_audio.py  (edge-tts, MIT 오픈소스)
import asyncio, json, os
try:
    import truststore; truststore.inject_into_ssl()  # 학교망 인증서 사용
except ImportError: pass
import edge_tts
VOICES = {'f': 'ko-KR-SunHiNeural', 'm': 'ko-KR-InJoonNeural'}
v = json.load(open('tools/vocab.json', encoding='utf-8'))
jobs = []
for c in v:
    for cid, w, s, _ in c['cards']:
        for g, voice in VOICES.items():
            for kind, text in (('w', w), ('s', s)):
                out = f'audio/{g}/{cid}_{kind}.mp3'
                if not os.path.exists(out): jobs.append((text, voice, out))
EXTRA = {'fb_good':'잘했어요!','fb_retry':'다시 들어 봐요.','fb_q':'어떤 그림일까요?'}
for g, voice in VOICES.items():
    for k, text in EXTRA.items():
        out = f'audio/{g}/{k}.mp3'
        if not os.path.exists(out): jobs.append((text, voice, out))
os.makedirs('audio/f', exist_ok=True); os.makedirs('audio/m', exist_ok=True)
sem = asyncio.Semaphore(6)
async def one(text, voice, out):
    async with sem:
        for _ in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate='-10%').save(out); return
            except Exception as e: err = e
        print('FAIL', out, err)
async def main(): await asyncio.gather(*(one(*j) for j in jobs))
asyncio.run(main()); print('done', len(jobs))
