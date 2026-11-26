# 데이터·서비스워커 만들기: python tools/build.py  (vocab.json 고친 뒤 make_audio.py → build.py 순서로 실행)
import json, os, time
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
v = json.load(open('tools/vocab.json', encoding='utf-8'))
cats = [{'id': c['id'], 'name': c['name'], 'color': c['color'],
         'cards': [{'id': i, 'w': w, 's': s, 'img': f'img/{i}.webp', 'audio': True} for i, w, s, _ in c['cards']]} for c in v]
open('data.js', 'w', encoding='utf-8').write('// tools/build.py가 만든 파일입니다. 직접 고치지 마세요.\nwindow.VOCAB = ' + json.dumps(cats, ensure_ascii=False, indent=1) + ';\n')
assets = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'emoji-ko.json', 'manifest.webmanifest',
          'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png']
for d in ('img', 'audio/f', 'audio/m'):
    assets += [f'{d}/{f}' for f in sorted(os.listdir(d))]
sw = open('tools/sw.template.js', encoding='utf-8').read()
sw = sw.replace('__VERSION__', time.strftime('%Y%m%d%H%M')).replace('__ASSETS__', json.dumps(assets))
open('sw.js', 'w', encoding='utf-8').write(sw)
print('assets', len(assets))
