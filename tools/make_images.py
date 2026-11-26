# 카드 그림 내려받기: python tools/make_images.py  (Google Noto Emoji 3D, Apache 2.0)
import io, json, os, urllib.request
try:
    import truststore; truststore.inject_into_ssl()  # 학교망 인증서 사용
except ImportError:
    pass
from PIL import Image
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
os.makedirs('img', exist_ok=True)
for c in json.load(open('tools/vocab.json', encoding='utf-8')):
    for cid, w, s, cp in c['cards']:
        out = f'img/{cid}.webp'
        if os.path.exists(out): continue
        for d in ('3D/png/512', '2D/png/512'):
            try:
                b = urllib.request.urlopen(f'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/{d}/emoji_u{cp}.png').read()
                Image.open(io.BytesIO(b)).convert('RGBA').resize((256, 256), Image.LANCZOS).save(out, 'WEBP', quality=88)
                print('ok', cid, d); break
            except Exception:
                pass
        else:
            print('없음', cid, cp)
