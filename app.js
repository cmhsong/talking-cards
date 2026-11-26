/* 말하는 그림카드 — 지체장애 학생 의사소통(AAC)·국어 학습용 */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NOTO = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/';
const MINE = { id: 'mine', name: '내 카드', color: '#64748b' };

/* ---------- 저장 ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const S = Object.assign({ voice: 'f', style: 'pic', size: '2', read: 'w', scan: 'off', cat: VOCAB[0].id,
  quizN: '3', prWhat: 'cat', prLayout: '3x4', prText: 'w', prCut: '1' }, store.get('aac.settings', {}));
// 주소 뒤 ?style=dot&size=3 처럼 설정을 바로 줄 수 있음(수업 링크 공유용)
new URLSearchParams(location.search).forEach((v, k) => { if (k in S) S[k] = v; });
let custom = store.get('aac.custom', []);
const saveS = () => store.set('aac.settings', S);
const saveCustom = () => { if (!store.set('aac.custom', custom)) toast('저장 공간이 부족해요. 사진 카드를 줄여 주세요.'); };

// 기본 카드의 낱말·문장을 고친 내용 { 카드id: { w, s } }
let edits = store.get('aac.edits', {});
const saveEdits = () => store.set('aac.edits', edits);
function applyEdit(x) {
  const e = edits[x.id]; if (!e) return x;
  const w = e.w || x.w, s = e.s ?? x.s;
  return { ...x, w, s, ew: w !== x.w, es: s !== x.s };   // 고친 글은 녹음 대신 읽어 주기로
}
function cats() {
  const list = VOCAB.map(c => ({ ...c, cards: [...c.cards.map(applyEdit), ...custom.filter(x => x.cat === c.id)] }));
  const mine = custom.filter(x => !VOCAB.some(c => c.id === x.cat));
  if (mine.length) list.push({ ...MINE, cards: mine });
  return list;
}
const allCards = () => cats().flatMap(c => c.cards.map(x => ({ ...x, color: c.color })));
function curCat() { const l = cats(); return l.find(c => c.id === S.cat) || l[0]; }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- 목소리 ---------- */
const player = new Audio();
let speakToken = 0, playDone = null;
function stopAll() {
  speakToken++;
  player.pause();
  if (playDone) playDone();   // 멈춘 소리를 기다리던 곳도 끝나게
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function playFile(url, token = speakToken) {
  return new Promise(res => {
    if (token !== speakToken) return res();
    const done = () => { player.onended = player.onerror = null; playDone = null; res(); };
    playDone = done;
    player.onended = done; player.onerror = done;
    player.src = url;
    player.play().catch(done);
  });
}
let voices = [];
function loadVoices() { voices = ('speechSynthesis' in window) ? speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang)) : []; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const MALE = /injoon|hyunsu|bongjin|gookmin|minsu|jinho|male|남/i;
const FEMALE = /sunhi|heami|yuna|sora|jimin|seohyeon|yujin|soon-?bok|ji-?min|female|google|여/i;
function pickVoice(g) {
  const m = voices.find(v => MALE.test(v.name));
  const f = voices.find(v => FEMALE.test(v.name) && !MALE.test(v.name)) || voices.find(v => v !== m);
  if (g === 'm') return m ? { v: m, pitch: 1 } : { v: f, pitch: 0.55 };   // 남자 목소리가 없으면 낮은 음으로
  return f ? { v: f, pitch: 1.05 } : { v: m, pitch: 1.4 };
}
function tts(text, g = S.voice, token = speakToken) {
  return new Promise(res => {
    if (!('speechSynthesis' in window) || token !== speakToken) { if (!('speechSynthesis' in window)) toast('이 브라우저는 읽어 주기를 지원하지 않아요.'); return res(); }
    const u = new SpeechSynthesisUtterance(text);
    const p = pickVoice(g);
    u.lang = 'ko-KR'; if (p.v) u.voice = p.v; u.pitch = p.pitch; u.rate = 0.9;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
    setTimeout(res, 1500 + text.length * 400);   // 일부 기기에서 onend가 오지 않을 때 대비
  });
}
function speakCard(card, kind = S.read, token = speakToken) {
  if (kind === 's' && !card.s) kind = 'w';
  if (card.audio && !(kind === 'w' ? card.ew : card.es)) return playFile(`audio/${S.voice}/${card.id}_${kind}.mp3`, token);
  return tts(kind === 's' ? card.s : card.w, S.voice, token);
}
const feedback = name => playFile(`audio/${S.voice}/fb_${name}.mp3`);

/* ---------- 도트(픽셀아트) 변환 ---------- */
const pixCache = new Map();
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    if (!src.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });
}
function pixelate(src, N = 32) {
  if (pixCache.has(src)) return pixCache.get(src);
  const p = loadImage(src).then(im => {
    const W = N * 4, c = document.createElement('canvas'); c.width = c.height = W;
    const x = c.getContext('2d', { willReadFrequently: true });
    const sc = Math.min(W / im.naturalWidth, W / im.naturalHeight);
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, (W - w) / 2, (W - h) / 2, w, h);
    const d = x.getImageData(0, 0, W, W).data;
    // 4x4 칸 평균(투명도 가중)
    const px = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
        const k = ((j * 4 + yy) * W + i * 4 + xx) * 4, al = d[k + 3];
        r += d[k] * al; g += d[k + 1] * al; b += d[k + 2] * al; a += al;
      }
      if (a / 16 < 110) { px.push(null); continue; }
      r /= a; g /= a; b /= a;
      const m = (r + g + b) / 3, sat = 1.2;          // 채도를 조금 올려 또렷하게
      px.push([clamp(m + (r - m) * sat), clamp(m + (g - m) * sat), clamp(m + (b - m) * sat)]);
    }
    // 색 줄이기(k-평균 16색)
    const op = px.filter(Boolean);
    const K = Math.min(16, op.length);
    if (K) {
      const sorted = [...op].sort((a, b) => lum(a) - lum(b));
      let cen = Array.from({ length: K }, (_, i) => [...sorted[Math.floor((i + 0.5) * sorted.length / K)]]);
      const asg = new Array(px.length);
      for (let it = 0; it < 7; it++) {
        const sum = cen.map(() => [0, 0, 0, 0]);
        px.forEach((q, i) => {
          if (!q) return;
          let best = 0, bd = 1e9;
          cen.forEach((cc, ci) => { const dd = (q[0] - cc[0]) ** 2 * .3 + (q[1] - cc[1]) ** 2 * .59 + (q[2] - cc[2]) ** 2 * .11; if (dd < bd) { bd = dd; best = ci; } });
          asg[i] = best; const s = sum[best]; s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; s[3]++;
        });
        cen = cen.map((cc, ci) => sum[ci][3] ? [sum[ci][0] / sum[ci][3], sum[ci][1] / sum[ci][3], sum[ci][2] / sum[ci][3]] : cc);
      }
      px.forEach((q, i) => { if (q) px[i] = cen[asg[i]].map(Math.round); });
    }
    // 바깥 테두리(진한 선) 그리기
    const M = N + 2, out = new Array(M * M).fill(null);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) out[(j + 1) * M + i + 1] = px[j * N + i];
    const edge = out.slice();
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      if (out[j * M + i]) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (i + dx >= 0 && i + dx < M && j + dy >= 0 && j + dy < M) ? out[(j + dy) * M + i + dx] : null).find(Boolean);
      if (nb) edge[j * M + i] = nb.map(v => Math.round(v * 0.28 + 12));
    }
    const S2 = 8, oc = document.createElement('canvas'); oc.width = oc.height = M * S2;
    const ox = oc.getContext('2d');
    edge.forEach((q, k) => { if (!q) return; ox.fillStyle = `rgb(${q[0]},${q[1]},${q[2]})`; ox.fillRect((k % M) * S2, Math.floor(k / M) * S2, S2, S2); });
    return oc.toDataURL('image/png');
  }).catch(() => src);
  pixCache.set(src, p);
  return p;
}
const clamp = v => Math.max(0, Math.min(255, v));
const lum = q => q[0] * .3 + q[1] * .59 + q[2] * .11;

function setImg(img, src) {
  img.alt = '';
  if (S.style !== 'dot') { img.src = src; return Promise.resolve(); }
  img.style.visibility = 'hidden';
  return pixelate(src).then(u => { img.src = u; img.style.visibility = ''; });
}

/* ---------- 카드 그리기 ---------- */
function cardEl(card, color, onTap) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'card'; b.dataset.scan = '';
  b.style.setProperty('--c', color);
  b.setAttribute('aria-label', card.w);
  const img = document.createElement('img'); setImg(img, card.img);
  const w = document.createElement('span'); w.className = 'w'; w.textContent = card.w;
  b.append(img, w);
  if (onTap) b.addEventListener('click', () => onTap(card, b));
  return b;
}
function renderCats(box, onPick) {
  box.innerHTML = '';
  cats().forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cat' + (c.id === curCat().id ? ' on' : ''); b.dataset.scan = '';
    b.style.setProperty('--c', c.color);
    const img = document.createElement('img');
    if (c.cards[0]) setImg(img, c.cards[0].img);
    b.append(img, document.createTextNode(c.name));
    b.addEventListener('click', () => { S.cat = c.id; saveS(); onPick(); });
    box.append(b);
  });
}
let lastTap = 0;
function guard() { const n = Date.now(); if (n - lastTap < 450) return false; lastTap = n; return true; }  // 떨림으로 두 번 눌림 방지
async function flash(el, p) { el.classList.add('talking'); await p; el.classList.remove('talking'); }

/* ---------- 말하기 ---------- */
// 문장 띠 한 칸: { card, color, text? }  text가 있으면 그 글을 읽어 줌(직접 쓰거나 고친 글)
let strip = [], stripSel = -1;
const TEXT_COLOR = '#94a3b8';
const itemText = it => it.text ?? (S.read === 's' && it.card.s ? it.card.s : it.card.w);
const speakItem = (it, tk = speakToken) => it.text != null ? tts(it.text, S.voice, tk) : speakCard(it.card, S.read, tk);
function renderTalk() {
  renderCats($('#catsTalk'), renderTalk);
  const c = curCat(), g = $('#gridTalk'); g.innerHTML = '';
  c.cards.forEach(card => g.append(cardEl(card, c.color, (cd, el) => {
    if (!guard()) return;
    stopAll(); flash(el, speakCard(cd));
    strip.push({ card: cd, color: c.color }); if (strip.length > 12) strip.shift();
    stripSel = -1; renderStrip();
  })));
  renderStrip();
}
function renderStrip() {
  const box = $('#strip'); box.innerHTML = '';
  if (stripSel >= strip.length) stripSel = -1;
  $('#stripEdit').hidden = stripSel < 0;
  $('#stripSentence').disabled = !strip.length;
  if (!strip.length) { box.innerHTML = '<p class="strip-hint">그림을 누르면 여기에 모여요</p>'; return; }
  strip.forEach((it, i) => {
    const ch = document.createElement('button'); ch.type = 'button';
    ch.className = 'chip' + (i === stripSel ? ' sel' : '') + (it.text != null ? ' text' : '');
    ch.style.setProperty('--c', it.color);
    if (it.card) { const img = document.createElement('img'); setImg(img, it.card.img); ch.append(img); }
    else { const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = '✏️'; ch.append(ic); }
    const t = document.createElement('span'); t.className = 't'; t.textContent = it.text ?? it.card.w; ch.append(t);
    ch.setAttribute('aria-pressed', i === stripSel);
    ch.addEventListener('click', () => {           // 누르면 고르기(+읽기), 한 번 더 누르면 고르기 풀기
      stripSel = stripSel === i ? -1 : i; renderStrip();
      if (stripSel === i) { stopAll(); speakItem(it); }
    });
    box.append(ch);
  });
  if (stripSel < 0) box.scrollLeft = box.scrollWidth;
}
$('#stripPlay').addEventListener('click', async () => {
  stopAll(); const tk = speakToken, chips = $$('#strip .chip');
  for (let i = 0; i < strip.length; i++) {
    if (tk !== speakToken) break;
    chips[i]?.classList.add('talking');
    await speakItem(strip[i], tk);
    chips[i]?.classList.remove('talking');
    await new Promise(r => setTimeout(r, 120));
  }
});
$('#stripBack').addEventListener('click', () => {
  if (stripSel >= 0) strip.splice(stripSel, 1); else strip.pop();
  stripSel = -1; renderStrip();
});
$('#stripClear').addEventListener('click', () => { strip = []; stripSel = -1; stopAll(); renderStrip(); });
$('#stripDel').addEventListener('click', () => { if (stripSel >= 0) { strip.splice(stripSel, 1); stripSel = -1; renderStrip(); } });
$('#stripLeft').addEventListener('click', () => {
  if (stripSel <= 0) return;
  [strip[stripSel - 1], strip[stripSel]] = [strip[stripSel], strip[stripSel - 1]]; stripSel--; renderStrip();
});
$('#stripRight').addEventListener('click', () => {
  if (stripSel < 0 || stripSel >= strip.length - 1) return;
  [strip[stripSel + 1], strip[stripSel]] = [strip[stripSel], strip[stripSel + 1]]; stripSel++; renderStrip();
});
$('#stripFix').addEventListener('click', () => {
  const it = strip[stripSel]; if (!it) return;
  openEdit({
    title: '✏️ 글자 고치기', fields: [{ key: 't', label: '이 칸에서 읽을 말', value: itemText(it) }],
    onSave: v => { if (!v.t) return '글자를 써 주세요.'; it.text = v.t; renderStrip(); },
  });
});
$('#stripAdd').addEventListener('click', () => openEdit({
  title: '➕ 낱말 쓰기', okLabel: '✔ 넣기', fields: [{ key: 't', label: '넣을 말 (예: 을, 를, 주세요, 빨리)', value: '' }],
  onSave: v => {
    if (!v.t) return '글자를 써 주세요.';
    const at = stripSel >= 0 ? stripSel + 1 : strip.length;   // 고른 칸 뒤에, 아니면 맨 끝에
    strip.splice(at, 0, { card: null, color: TEXT_COLOR, text: v.t }); stripSel = -1; renderStrip();
  },
}));
$('#stripSentence').addEventListener('click', () => {
  if (!strip.length) return;
  const first = strip.find(it => it.card);
  openEdit({
    title: '📝 문장 고치기', okLabel: '✔ 이 문장으로 바꾸기',
    fields: [{ key: 't', label: '모인 말을 자연스러운 문장으로 고쳐요', value: strip.map(itemText).join(' '), multi: true }],
    onSave: v => {
      if (!v.t) return '문장을 써 주세요.';
      strip = [{ card: first?.card || null, color: first?.color || TEXT_COLOR, text: v.t }]; stripSel = -1; renderStrip();
    },
    extra: [{ label: '💾 내 카드로 저장', fn: v => {
      if (!v.t) return '문장을 써 주세요.';
      if (!first) return '그림이 있는 카드를 하나 이상 넣어 주세요.';
      custom.push({ id: 'c' + Date.now().toString(36), w: v.t.length > 12 ? v.t.slice(0, 12) + '…' : v.t, s: v.t, cat: 'mine', img: first.card.img });
      saveCustom(); toast("'내 카드' 묶음에 저장했어요."); renderTalk();
    } }],
  });
});

/* ---------- 글 고치기 창 (문장 띠·카드 공용) ---------- */
function openEdit({ title, fields, onSave, extra = [], okLabel = '✔ 고치기' }) {
  const dlg = $('#editDlg');
  dlg.innerHTML = `<form method="dialog" class="edit-form"><h2></h2><div class="ef"></div><p class="edit-err" role="alert"></p>
    <div class="form-btns"><button type="button" class="big" data-g="f">👩 여자 목소리</button><button type="button" class="big" data-g="m">👨 남자 목소리</button></div>
    <div class="form-btns end"><button type="button" class="big" data-x="cancel">취소</button></div></form>`;
  $('h2', dlg).textContent = title;
  const box = $('.ef', dlg);
  fields.forEach(f => {
    const l = document.createElement('label'); l.className = 'field';
    const sp = document.createElement('span'); sp.textContent = f.label;
    const inp = document.createElement(f.multi ? 'textarea' : 'input');
    inp.name = f.key; inp.value = f.value || ''; inp.maxLength = f.multi ? 200 : 60; if (f.multi) inp.rows = 3;
    l.append(sp, inp); box.append(l);
  });
  const vals = () => Object.fromEntries(fields.map(f => [f.key, dlg.querySelector(`[name="${f.key}"]`).value.trim()]));
  const run = fn => { const err = fn(vals()); if (err) { $('.edit-err', dlg).textContent = err; return; } dlg.close(); };
  const end = $('.form-btns.end', dlg);
  extra.forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.className = 'big'; b.textContent = x.label; b.onclick = () => run(x.fn); end.append(b); });
  const ok = document.createElement('button'); ok.type = 'submit'; ok.className = 'big play'; ok.textContent = okLabel; end.append(ok);
  $('form', dlg).addEventListener('submit', e => { e.preventDefault(); run(onSave); });
  $('[data-x=cancel]', dlg).onclick = () => dlg.close();
  $$('[data-g]', dlg).forEach(b => b.onclick = () => {
    const v = Object.values(vals()).filter(Boolean); stopAll(); tts(v[v.length - 1] || '글자를 써 주세요', b.dataset.g);
  });
  dlg.showModal();
  const first = $('input, textarea', dlg); first.focus(); first.setSelectionRange(first.value.length, first.value.length);
}

/* ---------- 낱말 공부 ---------- */
let learnIdx = 0;
function renderLearn(auto) {
  renderCats($('#catsLearn'), () => { learnIdx = 0; renderLearn(true); });
  const c = curCat(); if (!c.cards.length) return;
  learnIdx = (learnIdx + c.cards.length) % c.cards.length;
  const card = c.cards[learnIdx], box = $('#learnCard');
  box.style.setProperty('--c', c.color);
  box.innerHTML = `<img><div class="w"></div><div class="s"></div>
    <div class="btns"><button class="big play" data-k="w" data-scan>🔊 낱말</button><button class="big" data-k="s" data-scan>🔊 문장</button></div>
    <div class="pos">${learnIdx + 1} / ${c.cards.length} · <button type="button" class="linkbtn" data-x="edit">✏️ 글자 고치기</button></div>`;
  setImg($('img', box), card.img);
  $('.w', box).textContent = card.w; $('.s', box).textContent = card.s || '';
  if (!card.s) $('[data-k=s]', box).hidden = true;
  $$('[data-k]', box).forEach(b => b.addEventListener('click', () => { stopAll(); flash(b, speakCard(card, b.dataset.k)); }));
  $('[data-x=edit]', box).addEventListener('click', () => editCard(card));
  if (auto) { stopAll(); speakCard(card, 'w'); }
}
function editCard(card) {
  const mine = custom.find(x => x.id === card.id);
  const orig = mine ? null : VOCAB.flatMap(c => c.cards).find(x => x.id === card.id);
  openEdit({
    title: '✏️ 카드 글자 고치기',
    fields: [{ key: 'w', label: '낱말', value: card.w }, { key: 's', label: '문장', value: card.s || '', multi: true }],
    onSave: v => {
      if (!v.w) return '낱말을 써 주세요.';
      if (mine) { mine.w = v.w; mine.s = v.s; saveCustom(); }
      else {
        const e = {}; if (v.w !== orig.w) e.w = v.w; if (v.s !== orig.s) e.s = v.s;
        if (Object.keys(e).length) edits[card.id] = e; else delete edits[card.id];
        saveEdits();
      }
      toast('고쳤어요. 고친 글은 기기 목소리로 읽어 줘요.'); render();
    },
    extra: edits[card.id] ? [{ label: '↩ 원래대로', fn: () => { delete edits[card.id]; saveEdits(); toast('원래 글자로 되돌렸어요.'); render(); } }] : [],
  });
}
$('#learnPrev').addEventListener('click', () => { learnIdx--; renderLearn(true); });
$('#learnNext').addEventListener('click', () => { learnIdx++; renderLearn(true); });

/* ---------- 듣고 고르기 ---------- */
const Q = { target: null, stars: 0, busy: false };
function renderQuiz() {
  renderCats($('#catsQuiz'), () => { Q.stars = 0; newRound(); });
  newRound();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newRound() {
  const n = +S.quizN, c = curCat();
  let pool = c.cards.map(x => ({ ...x, color: c.color }));
  if (pool.length < n) pool = allCards();
  const cand = pool.filter(x => !Q.target || x.id !== Q.target.id);
  Q.target = cand[Math.floor(Math.random() * cand.length)];
  const opts = shuffle([Q.target, ...shuffle(pool.filter(x => x.id !== Q.target.id)).slice(0, n - 1)]);
  Q.busy = false;
  $('#quizMsg').textContent = '잘 듣고 그림을 골라요 👂';
  $('#stars').textContent = '⭐'.repeat(Q.stars % 10) || '';
  const g = $('#gridQuiz'); g.innerHTML = '';
  opts.forEach(o => {
    const el = cardEl(o, o.color, onAnswer);
    $('.w', el).style.visibility = 'hidden';      // 글자 대신 소리로만
    g.append(el);
  });
  setTimeout(hearTarget, 350);
}
function hearTarget() { if (!Q.target) return; stopAll(); speakCard(Q.target, 'w'); }
async function onAnswer(card, el) {
  if (Q.busy || el.classList.contains('wrong') || !guard()) return;
  stopAll();
  $$('#gridQuiz .w').forEach(w => w.style.visibility = '');
  if (card.id === Q.target.id) {
    Q.busy = true; Q.stars++; el.classList.add('right');
    $('#quizMsg').textContent = '잘했어요! 👏';
    $('#stars').textContent = '⭐'.repeat(((Q.stars - 1) % 10) + 1);
    await speakCard(card, 'w'); await feedback('good');
    setTimeout(newRound, 600);
  } else {
    el.classList.add('wrong');
    $$('#gridQuiz .w').forEach(w => w.style.visibility = 'hidden');
    $('#quizMsg').textContent = '다시 들어 봐요 🙂';
    const tk = speakToken; await feedback('retry'); if (tk === speakToken) speakCard(Q.target, 'w', tk);
  }
}
$('#quizHear').addEventListener('click', hearTarget);

/* ---------- 카드 만들기 ---------- */
const M = { editId: null, img: null, tab: 'g' };
let emojiIndex = null;
function renderMake() {
  const sel = $('#mkCat'), keep = sel.value;
  sel.innerHTML = [...VOCAB, MINE].map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = keep || 'mine';
  setSeg($('#pickTabs'), M.tab);
  $('#pickG').hidden = M.tab !== 'g'; $('#pickU').hidden = M.tab !== 'u';
  renderPreview(); renderMyList();
}
function draftCard() { return { id: M.editId || 'c' + Date.now().toString(36), w: $('#mkWord').value.trim(), s: $('#mkSent').value.trim(), cat: $('#mkCat').value, img: M.img }; }
function renderPreview() {
  const box = $('#mkPreview'), d = draftCard(); box.innerHTML = '';
  const color = ([...VOCAB, MINE].find(c => c.id === d.cat) || MINE).color;
  if (!d.img) { box.innerHTML = '<p class="small">그림을 고르면 여기에 보여요.</p>'; return; }
  box.append(cardEl({ ...d, w: d.w || '낱말' }, color, cd => { stopAll(); speakCard({ ...cd, audio: false }, 's'); }));
}
function renderMyList() {
  const box = $('#myList'); box.innerHTML = '';
  $('#myCount').textContent = custom.length ? `(${custom.length}개)` : '';
  if (!custom.length) { box.innerHTML = '<p class="small">아직 없어요. 왼쪽에서 만들어 보세요.</p>'; return; }
  custom.forEach(c => {
    const r = document.createElement('div'); r.className = 'myrow';
    r.innerHTML = `<img><div class="t"><b></b><small></small></div><button type="button" data-a="play">🔊</button><button type="button" data-a="edit">고치기</button><button type="button" data-a="del">지우기</button>`;
    setImg($('img', r), c.img); $('b', r).textContent = c.w;
    $('small', r).textContent = `${([...VOCAB, MINE].find(x => x.id === c.cat) || MINE).name} · ${c.s || ''}`;
    r.addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'play') { stopAll(); speakCard(c, 's'); }
      if (a === 'edit') {
        M.editId = c.id; M.img = c.img;
        $('#mkWord').value = c.w; $('#mkSent').value = c.s || ''; $('#mkCat').value = c.cat;
        $('#makeTitle').textContent = '카드 고치기'; $('#mkCancel').hidden = false; renderPreview();
        $('#makeForm').scrollIntoView({ behavior: 'smooth' });
      }
      if (a === 'del' && confirm(`'${c.w}' 카드를 지울까요?`)) { custom = custom.filter(x => x.id !== c.id); saveCustom(); renderMake(); }
    });
    box.append(r);
  });
}
function resetForm() {
  M.editId = null; M.img = null; $('#makeForm').reset();
  $('#makeTitle').textContent = '새 카드 만들기'; $('#mkCancel').hidden = true;
  $$('#gResults button.on').forEach(b => b.classList.remove('on'));
  renderMake();
}
$('#makeForm').addEventListener('submit', e => {
  e.preventDefault();
  const d = draftCard();
  if (!d.w) return toast('낱말을 써 주세요.');
  if (!d.img) return toast('그림을 골라 주세요.');
  const i = custom.findIndex(x => x.id === d.id);
  if (i >= 0) custom[i] = d; else custom.push(d);
  saveCustom(); toast(`'${d.w}' 카드를 저장했어요. [말하기]에서 쓸 수 있어요.`);
  resetForm();
});
$('#mkCancel').addEventListener('click', resetForm);
['#mkWord', '#mkSent', '#mkCat'].forEach(s => $(s).addEventListener('input', renderPreview));
$('#mkTestF').addEventListener('click', () => { const d = draftCard(); stopAll(); tts(d.s || d.w || '낱말을 써 주세요', 'f'); });
$('#mkTestM').addEventListener('click', () => { const d = draftCard(); stopAll(); tts(d.s || d.w || '낱말을 써 주세요', 'm'); });
$('#pickTabs').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) { M.tab = v; renderMake(); } });

// 구글 Noto 그림 찾기
async function searchEmoji() {
  const q = $('#gq').value.trim(), box = $('#gResults');
  $('#gWeb').href = 'https://www.google.com/search?tbm=isch&tbs=il:cl&q=' + encodeURIComponent((q || $('#mkWord').value.trim()) + ' 일러스트');
  if (!q) { box.innerHTML = '<p>찾을 낱말을 써 주세요.</p>'; return; }
  box.innerHTML = '<p>찾는 중…</p>';
  try { emojiIndex = emojiIndex || await (await fetch('emoji-ko.json')).json(); }
  catch { box.innerHTML = '<p>그림 목록을 불러오지 못했어요. 인터넷을 확인해 주세요.</p>'; return; }
  const terms = q.split(/\s+/);
  const hits = emojiIndex.map(([code, name, kw]) => {
    let sc = 0;
    for (const t of terms) { if (name === t) sc += 5; else if (name.includes(t)) sc += 3; else if (kw.includes(t)) sc += 1; else return null; }
    return { code, name, sc };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 80);
  box.innerHTML = hits.length ? '' : '<p>찾은 그림이 없어요. 다른 낱말로 찾아보거나 아래 구글 이미지 검색을 써 보세요.</p>';
  hits.forEach(h => {
    const b = document.createElement('button'); b.type = 'button'; b.title = h.name;
    const img = document.createElement('img'); img.loading = 'lazy'; img.alt = h.name;
    let dir = '3D';
    img.src = `${NOTO}3D/png/128/emoji_u${h.code}.png`;
    img.onerror = () => { if (dir === '3D') { dir = '2D'; img.src = `${NOTO}2D/png/128/emoji_u${h.code}.png`; } else b.remove(); };
    b.append(img);
    b.addEventListener('click', () => {
      $$('#gResults button.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
      M.img = `${NOTO}${dir}/png/512/emoji_u${h.code}.png`;
      if (!$('#mkWord').value.trim()) $('#mkWord').value = q;
      renderPreview();
    });
    box.append(b);
  });
}
$('#gqBtn').addEventListener('click', searchEmoji);
$('#gq').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchEmoji(); } });

// 내 사진 올리기·붙여넣기
async function useFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url), max = 360, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    let data = c.toDataURL('image/webp', 0.85);
    if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.85);
    M.img = data; M.tab = 'u'; renderMake(); toast('그림을 넣었어요.');
  } catch { toast('이 그림은 열 수 없어요.'); }
  finally { URL.revokeObjectURL(url); }
}
$('#mkFile').addEventListener('change', e => { useFile(e.target.files[0]); e.target.value = ''; });
document.addEventListener('paste', e => {
  if (view !== 'make') return;
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (it) { e.preventDefault(); useFile(it.getAsFile()); }
});
$('.pick').addEventListener('dragover', e => e.preventDefault());
$('.pick').addEventListener('drop', e => { e.preventDefault(); useFile(e.dataTransfer.files[0]); });

// 내보내기·가져오기
$('#exportBtn').addEventListener('click', () => {
  if (!custom.length) return toast('내보낼 카드가 없어요.');
  const blob = new Blob([JSON.stringify({ app: 'talking-cards', v: 1, cards: custom })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `내-그림카드-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); const list = (d.cards || []).filter(c => c.id && c.w && c.img);
    list.forEach(c => { const i = custom.findIndex(x => x.id === c.id); if (i >= 0) custom[i] = c; else custom.push(c); });
    saveCustom(); renderMake(); toast(`카드 ${list.length}개를 가져왔어요.`);
  } catch { toast('카드 파일이 아니에요.'); }
});

/* ---------- 출력 ---------- */
function renderPrintOpts() {
  const sel = $('#prWhat');
  sel.innerHTML = '<option value="cat">지금 고른 묶음</option>' + cats().map(c => `<option value="c:${c.id}">${c.name}</option>`).join('') + '<option value="all">전체 카드</option>';
  sel.value = [...sel.options].some(o => o.value === S.prWhat) ? S.prWhat : 'cat';
  setSeg($('#prLayout'), S.prLayout); setSeg($('#prText'), S.prText); setSeg($('#prCut'), S.prCut);
  renderPages();
}
function printCards() {
  const list = cats();
  if (S.prWhat === 'all') return list.flatMap(c => c.cards.map(x => ({ ...x, color: c.color })));
  const c = S.prWhat.startsWith('c:') ? list.find(x => x.id === S.prWhat.slice(2)) || curCat() : curCat();
  return c.cards.map(x => ({ ...x, color: c.color }));
}
function renderPages() {
  const [cols, rows] = S.prLayout.split('x').map(Number), per = cols * rows, cards = printCards();
  const area = $('#printArea'); area.innerHTML = '';
  const cellH = 277 / rows, cellW = 190 / cols;
  const wSize = Math.min(cellH * 0.14, cellW * 0.2), sSize = Math.min(cellH * 0.065, cellW * 0.085);
  const jobs = [];
  for (let p = 0; p < cards.length; p += per) {
    const pg = document.createElement('div'); pg.className = 'page' + (S.prCut === '1' ? ' cut' : '');
    pg.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; pg.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    cards.slice(p, p + per).forEach(cd => {
      const cell = document.createElement('div'); cell.className = 'pc';
      cell.innerHTML = '<div class="in"><img></div>';
      const inn = $('.in', cell); inn.style.setProperty('--c', cd.color);
      jobs.push(setImg($('img', cell), cd.img));
      if (S.prText !== 'n') { const b = document.createElement('b'); b.textContent = cd.w; b.style.fontSize = wSize + 'mm'; inn.append(b); }
      if (S.prText === 'ws' && cd.s) { const s = document.createElement('small'); s.textContent = cd.s; s.style.fontSize = sSize + 'mm'; inn.append(s); }
      pg.append(cell);
    });
    area.append(pg);
  }
  if (!cards.length) area.innerHTML = '<p>출력할 카드가 없어요.</p>';
  return Promise.all(jobs);
}
$('#prWhat').addEventListener('change', e => { S.prWhat = e.target.value; saveS(); renderPages(); });
[['#prLayout', 'prLayout'], ['#prText', 'prText'], ['#prCut', 'prCut']].forEach(([s, k]) =>
  $(s).addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (!v) return; S[k] = v; saveS(); setSeg($(s), v); renderPages(); }));
$('#prGo').addEventListener('click', async () => {
  await renderPages();
  await Promise.all($$('#printArea img').map(i => i.decode().catch(() => {})));
  window.print();
});

/* ---------- 설정·화면 전환 ---------- */
function setSeg(seg, v) { $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }
function applySettings() {
  document.body.dataset.size = S.size;
  document.body.classList.toggle('dot', S.style === 'dot');
  $$('.settings .seg').forEach(seg => setSeg(seg, S[seg.dataset.set]));
  setSeg($('#quizN'), S.quizN);
  $('#scanSwitch').hidden = S.scan !== 'on';
}
$$('.settings .seg').forEach(seg => seg.addEventListener('click', e => {
  const v = e.target.closest('button')?.dataset.v; if (!v) return;
  const k = seg.dataset.set, changed = S[k] !== v;
  S[k] = v; saveS(); applySettings();
  if (k === 'voice' && changed) { stopAll(); playFile(`audio/${v}/hello_w.mp3`); }
  if (k === 'style' && changed) render();
  if (k === 'scan') scanRestart();
}));
$('#quizN').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (!v) return; S.quizN = v; saveS(); setSeg($('#quizN'), v); Q.stars = 0; newRound(); });

let view = 'talk';
function render() {
  if (view === 'talk') renderTalk();
  if (view === 'learn') renderLearn(false);
  if (view === 'quiz') renderQuiz();
  if (view === 'make') renderMake();
  if (view === 'print') renderPrintOpts();
  scanRestart();
}
function route() {
  const v = (location.hash || '#talk').slice(1);
  view = ['talk', 'learn', 'quiz', 'make', 'print'].includes(v) ? v : 'talk';
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + view));
  $$('.menu a').forEach(a => a.classList.toggle('on', a.dataset.view === view));
  stopAll(); render();
}
window.addEventListener('hashchange', route);

/* ---------- 스위치 스캔 (한 개 스위치·스페이스·엔터로 고르기) ---------- */
let scanTimer = null, scanIdx = -1;
function scanItems() { return $$(`#view-${view} [data-scan]`).filter(el => el.offsetParent && !el.hidden && !el.classList.contains('wrong')); }
function scanRestart() {
  clearInterval(scanTimer); $$('.scan-hi').forEach(e => e.classList.remove('scan-hi')); scanIdx = -1;
  if (S.scan !== 'on' || view === 'make' || view === 'print') return;
  scanTimer = setInterval(scanStep, 1800);
}
function scanStep() {
  const items = scanItems(); if (!items.length) return;
  $$('.scan-hi').forEach(e => e.classList.remove('scan-hi'));
  scanIdx = (scanIdx + 1) % items.length;
  items[scanIdx].classList.add('scan-hi');
  items[scanIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function scanSelect() {
  const el = $('.scan-hi'); if (!el) return;
  lastTap = 0; el.click();
  const items = scanItems(); const i = items.indexOf(el);   // 고른 뒤 처음부터가 아니라 그 자리에서 이어감
  clearInterval(scanTimer); scanIdx = i >= 0 ? i - 1 : -1;
  scanTimer = setInterval(scanStep, 1800);
}
$('#scanSwitch').addEventListener('click', scanSelect);
document.addEventListener('keydown', e => {
  if (S.scan !== 'on' || !scanTimer) return;
  if (e.key === ' ' || e.key === 'Enter') { if (e.target.matches('input, select, textarea')) return; e.preventDefault(); scanSelect(); }
});

/* ---------- 앱 설치·오프라인 ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone) $('#installBtn').hidden = true;
$('#installBtn').addEventListener('click', async () => {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') $('#installBtn').hidden = true; installEvt = null; }
  else $('#installDlg').showModal();
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('앱을 설치했어요!'); });
if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  navigator.serviceWorker?.register('sw.js').catch(() => {});
}

$('#setToggle').addEventListener('click', () => {
  const open = document.body.classList.toggle('set-open');
  $('#setToggle').textContent = open ? '⚙️ 설정 닫기' : '⚙️ 설정 열기';
  $('#setToggle').setAttribute('aria-expanded', open);
});
applySettings();
route();
