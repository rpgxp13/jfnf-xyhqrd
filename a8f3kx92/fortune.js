/* Fortune — Saju + Tarot (100% client-side, no backend)
   - Saju eight characters are computed with the lunar-javascript library
     (loaded lazily from CDN only when the saju feature is entered).
   - All randomness uses crypto.getRandomValues().
   - Interpretation text comes from static JSON (data/saju.json, data/tarot.json).
     The get*Reading() functions are the single seam to swap for an LLM API later. */

(function () {
  'use strict';

  /* ═══════════ view manager ═══════════ */
  const VIEWS = ['v-select', 'v-saju-input', 'v-saju-result', 'v-tarot-topic', 'v-tarot-spread', 'v-tarot-table', 'v-history'];
  const BACK_MAP = {
    'v-select': null,                 // → index.html
    'v-saju-input': 'v-select',
    'v-saju-result': 'v-saju-input',
    'v-tarot-topic': 'v-select',
    'v-tarot-spread': 'v-tarot-topic',
    'v-tarot-table': 'v-tarot-spread',
    'v-history': 'v-select',
  };
  const TITLES = {
    'v-select': '🔮 Fortune',
    'v-saju-input': '📜 사주풀이',
    'v-saju-result': '📜 사주풀이',
    'v-tarot-topic': '🃏 타로점',
    'v-tarot-spread': '🃏 타로점',
    'v-tarot-table': '🃏 타로점',
    'v-history': '🕘 기록',
  };

  let currentView = 'v-select';
  let backOverride = null; // set when a result view is opened from history

  const $ = (id) => document.getElementById(id);

  function show(view) {
    VIEWS.forEach(v => $(v).classList.toggle('on', v === view));
    currentView = view;
    $('pageTitle').textContent = TITLES[view] || '🔮 Fortune';
    window.scrollTo(0, 0);
  }

  $('backBtn').addEventListener('click', () => {
    if (backOverride) { const t = backOverride; backOverride = null; show(t); return; }
    const t = BACK_MAP[currentView];
    if (t === null || t === undefined) { location.href = './index.html'; return; }
    show(t);
  });

  /* ═══════════ crypto random helpers ═══════════ */
  function randInt(maxExclusive) {
    const u = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let x;
    do { crypto.getRandomValues(u); x = u[0]; } while (x >= limit);
    return x % maxExclusive;
  }
  function cryptoShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const REVERSAL_PERCENT = 30; // chance of a reversed card

  /* ═══════════ lazy loaders ═══════════ */
  let lunarReady = null;
  function ensureLunar() {
    if (window.Lunar && window.Solar) return Promise.resolve();
    if (lunarReady) return lunarReady;
    lunarReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js';
      s.onload = () => resolve();
      s.onerror = () => { lunarReady = null; reject(new Error('lunar load fail')); };
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('lunar load timeout')), 12000);
    });
    return lunarReady;
  }

  let sajuData = null, tarotData = null;
  async function loadSajuData() {
    if (!sajuData) sajuData = await (await fetch('./data/saju.json')).json();
    return sajuData;
  }
  async function loadTarotData() {
    if (!tarotData) tarotData = await (await fetch('./data/tarot.json')).json();
    return tarotData;
  }

  /* ═══════════ history (localStorage) ═══════════ */
  const HKEY = 'fortune_history_v1';
  function histList() {
    try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; }
  }
  function histSave(entry) {
    const list = histList();
    list.unshift(entry);
    if (list.length > 30) list.length = 30;
    try { localStorage.setItem(HKEY, JSON.stringify(list)); } catch {}
  }
  function fmtTs(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* ═══════════ saju constants ═══════════ */
  const GAN_KO = { '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계' };
  const ZHI_KO = { '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해' };
  const GAN_EL = { '甲': '목', '乙': '목', '丙': '화', '丁': '화', '戊': '토', '己': '토', '庚': '금', '辛': '금', '壬': '수', '癸': '수' };
  const ZHI_EL = { '子': '수', '丑': '토', '寅': '목', '卯': '목', '辰': '토', '巳': '화', '午': '화', '未': '토', '申': '금', '酉': '금', '戌': '토', '亥': '수' };
  const EL_ORDER = ['목', '화', '토', '금', '수'];

  /* ═══════════ saju: input UI ═══════════ */
  function segInit(segEl) {
    segEl.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        segEl.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        if (segEl.id === 'calSeg') {
          $('leapRow').style.display = b.dataset.v === 'lunar' ? 'flex' : 'none';
        }
      });
    });
  }
  segInit($('calSeg'));
  segInit($('genderSeg'));
  const segVal = (segEl) => segEl.querySelector('button.sel').dataset.v;

  $('sjNoTime').addEventListener('change', () => {
    $('sjTime').disabled = $('sjNoTime').checked;
  });

  document.querySelectorAll('[data-go]').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.go === 'saju') { show('v-saju-input'); ensureLunar().catch(() => {}); }
      else show('v-tarot-topic');
    });
  });

  $('sjGo').addEventListener('click', async () => {
    const dateStr = $('sjDate').value;
    if (!dateStr) { alert('생년월일을 입력해주세요!'); return; }
    const [y, m, d] = dateStr.split('-').map(Number);
    const hasTime = !$('sjNoTime').checked;
    let hh = 12, mi = 0;
    if (hasTime) {
      const t = $('sjTime').value;
      if (!t) { alert('태어난 시간을 입력하거나 "시간을 몰라요"를 선택해주세요!'); return; }
      [hh, mi] = t.split(':').map(Number);
    }
    const input = {
      calendar: segVal($('calSeg')),
      leap: $('sjLeap').checked,
      y, m, d, hasTime, hh, mi,
      gender: segVal($('genderSeg')),
      name: $('sjName').value.trim(),
    };

    $('sjGo').disabled = true;
    $('sjLoading').style.display = 'block';
    try {
      await ensureLunar();
      const saju = computeSaju(input);
      const entry = {
        type: 'saju', ts: Date.now(),
        name: input.name, gender: input.gender,
        birth: describeBirth(input, saju),
        pillars: saju.pillars, hasTime: input.hasTime,
      };
      histSave(entry);
      await renderSajuResult(entry);
      backOverride = null;
      show('v-saju-result');
    } catch (e) {
      alert('사주 계산에 실패했어요. 날짜가 올바른지 확인해주세요.\n(음력의 경우 존재하는 날짜/윤달인지 확인)');
    } finally {
      $('sjGo').disabled = false;
      $('sjLoading').style.display = 'none';
    }
  });

  /* ═══════════ saju: computation (lunar-javascript) ═══════════ */
  function computeSaju(input) {
    let lunarObj;
    if (input.calendar === 'lunar') {
      const lm = input.leap ? -input.m : input.m;
      lunarObj = window.Lunar.fromYmdHms(input.y, lm, input.d, input.hasTime ? input.hh : 12, input.hasTime ? input.mi : 0, 0);
    } else {
      lunarObj = window.Solar.fromYmdHms(input.y, input.m, input.d, input.hasTime ? input.hh : 12, input.hasTime ? input.mi : 0, 0).getLunar();
    }
    const ec = lunarObj.getEightChar();
    return {
      pillars: {
        year: ec.getYear(),
        month: ec.getMonth(),
        day: ec.getDay(),
        time: input.hasTime ? ec.getTime() : null,
      },
      solarYmd: lunarObj.getSolar().toYmd(),
    };
  }

  function describeBirth(input, saju) {
    const cal = input.calendar === 'lunar' ? `음력${input.leap ? '(윤달)' : ''}` : '양력';
    const t = input.hasTime ? ` ${String(input.hh).padStart(2, '0')}:${String(input.mi).padStart(2, '0')}` : ' (시간 모름)';
    return `${cal} ${input.y}.${String(input.m).padStart(2, '0')}.${String(input.d).padStart(2, '0')}${t}`;
  }

  function countElements(pillars) {
    const counts = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    ['year', 'month', 'day', 'time'].forEach(k => {
      const p = pillars[k];
      if (!p) return;
      counts[GAN_EL[p[0]]]++;
      counts[ZHI_EL[p[1]]]++;
    });
    return counts;
  }

  /* ═══════════ saju: reading (static JSON — swap point for LLM API) ═══════════ */
  async function getSajuReading(pillars) {
    const data = await loadSajuData();
    const dayGan = pillars.day[0];
    const counts = countElements(pillars);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const notes = [];
    EL_ORDER.forEach(el => {
      if (counts[el] >= 3) notes.push({ el, text: data.elements[el].excess });
      else if (counts[el] === 0) notes.push({ el, text: data.elements[el].lack });
    });
    if (notes.length === 0) notes.push({ el: null, text: data.balance.balanced });
    return {
      ilgan: data.ilgan[dayGan],
      elements: data.elements,
      counts, total, notes,
      balanceNote: data.balance.note,
    };
  }

  /* ═══════════ saju: result rendering ═══════════ */
  async function renderSajuResult(entry) {
    const reading = await getSajuReading(entry.pillars);
    const p = entry.pillars;

    $('sjrTitle').textContent = (entry.name ? entry.name + '의 ' : '') + '사주 명식';
    $('sjrSub').textContent = entry.birth + (entry.gender ? (entry.gender === 'F' ? ' · 여성' : ' · 남성') : '');

    const defs = [
      ['년주', p.year], ['월주', p.month], ['일주', p.day], ['시주', p.time],
    ];
    $('sjrPillars').innerHTML = defs.map(([label, val]) => {
      if (!val) return `<div class="pillar empty"><div class="plabel">${label}</div><div class="hanja">모름</div></div>`;
      const g = val[0], z = val[1];
      return `<div class="pillar">
        <div class="plabel">${label}</div>
        <div class="hanja">${g}<br>${z}</div>
        <div class="read">${GAN_KO[g]}${ZHI_KO[z]}</div>
        <div class="els">${GAN_EL[g]} · ${ZHI_EL[z]}</div>
      </div>`;
    }).join('');

    const il = reading.ilgan;
    $('sjrSym').textContent = il.symbol;
    $('sjrIlganName').innerHTML = `당신의 일간은 <b>${il.hanja} (${il.ko})</b>`;
    $('sjrIlganTitle').textContent = il.title;
    $('sjrIlganText').textContent = il.text;

    $('sjrBars').innerHTML = EL_ORDER.map(el => {
      const c = reading.counts[el];
      const pct = reading.total ? Math.round(c / reading.total * 100) : 0;
      const info = reading.elements[el];
      return `<div class="ebar-row">
        <span class="ename">${info.emoji} ${el}</span>
        <span class="etrack"><span class="efill" data-w="${pct}" style="background:${info.color}"></span></span>
        <span class="ecnt">${c}</span>
      </div>`;
    }).join('');
    requestAnimationFrame(() => {
      document.querySelectorAll('#sjrBars .efill').forEach(f => { f.style.width = f.dataset.w + '%'; });
    });

    $('sjrNotes').innerHTML =
      reading.notes.map(n => `<div class="enote">${n.text}</div>`).join('') +
      `<div class="enote" style="opacity:0.75">${reading.balanceNote}</div>`;
  }

  $('sjrAgain').addEventListener('click', () => { backOverride = null; show('v-saju-input'); });
  $('sjrHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ tarot ═══════════ */
  const TOPIC_LABEL = { love: '연애 · 관계', work: '일 · 커리어', money: '금전', all: '종합' };
  const TOPIC_KEY = { love: 'love', work: 'work', money: 'money' };
  const POS_LABELS = { one: ['메시지'], three: ['과거', '현재', '미래'] };

  const tstate = { topic: null, spread: null, deck: [], picks: [], revealed: 0, replay: false };

  document.querySelectorAll('[data-topic]').forEach(b => {
    b.addEventListener('click', () => {
      tstate.topic = b.dataset.topic;
      show('v-tarot-spread');
    });
  });
  document.querySelectorAll('[data-spread]').forEach(b => {
    b.addEventListener('click', () => {
      tstate.spread = b.dataset.spread;
      startTarotTable();
    });
  });

  async function startTarotTable() {
    tstate.replay = false;
    tstate.picks = [];
    tstate.revealed = 0;
    show('v-tarot-table');
    $('shuffleBox').style.display = 'block';
    $('pickBox').style.display = 'none';
    $('revealBox').style.display = 'none';
    $('readings').innerHTML = '';
    $('tarotDisc').style.display = 'none';
    $('tarotDone').style.display = 'none';

    // shuffle animation stack
    const stage = $('shuffleStage');
    stage.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('div');
      c.className = 'scard cback';
      c.style.animationDelay = (i * 0.09) + 's';
      c.style.animationDuration = (0.42 + i * 0.03) + 's';
      stage.appendChild(c);
    }

    await loadTarotData();
    tstate.deck = cryptoShuffle([...Array(78).keys()]);

    setTimeout(buildFan, 1800);
  }

  function buildFan() {
    $('shuffleBox').style.display = 'none';
    $('pickBox').style.display = 'block';

    const need = tstate.spread === 'one' ? 1 : 3;
    $('pickSlots').innerHTML = POS_LABELS[tstate.spread].map((lbl, i) =>
      `<div class="slot"><div class="pos">${lbl}</div><div class="tcard" id="pickSlot${i}" style="width:64px;height:100px"><div class="tin"><div class="tback cback" style="opacity:0.25"></div></div></div></div>`
    ).join('');
    $('pickCount').textContent = `0 / ${need}`;

    const fan = $('fan');
    fan.innerHTML = '';
    const n = 78;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'fcard cback';
      const ang = -65 + (130 / (n - 1)) * i;
      c.style.transform = `translateX(-50%) rotate(${ang}deg) translateY(-250px)`;
      c.dataset.i = i;
      c.addEventListener('click', onFanPick);
      fan.appendChild(c);
    }
    // center the horizontal scroll on mobile
    const sc = document.querySelector('.fan-scroll');
    sc.scrollLeft = (700 - sc.clientWidth) / 2;
  }

  function onFanPick(e) {
    const need = tstate.spread === 'one' ? 1 : 3;
    if (tstate.picks.length >= need) return;
    const el = e.currentTarget;
    if (el.classList.contains('gone')) return;
    el.classList.add('gone');

    const cardId = tstate.deck[Number(el.dataset.i)];
    const reversed = randInt(100) < REVERSAL_PERCENT;
    tstate.picks.push({ id: cardId, rev: reversed });

    const slotIdx = tstate.picks.length - 1;
    const slot = $('pickSlot' + slotIdx);
    slot.innerHTML = '<div class="tin"><div class="tback cback"></div></div>';
    slot.style.transform = 'scale(1.12)';
    setTimeout(() => { slot.style.transform = ''; }, 180);
    $('pickCount').textContent = `${tstate.picks.length} / ${need}`;

    if (tstate.picks.length >= need) setTimeout(buildReveal, 550);
  }

  function cardFaceHtml(card, suits) {
    const suitMark = card.arcana === 'major' ? '★' : suits[card.suit].emoji;
    return `<div class="tface">
      <span class="corner">${card.label}</span>
      <span class="suitmark">${suitMark}</span>
      <span class="femoji">${card.emoji}</span>
      <span class="fko">${card.ko}</span>
      <span class="fen">${card.en}</span>
    </div>`;
  }

  function buildReveal() {
    $('pickBox').style.display = 'none';
    $('revealBox').style.display = 'block';
    $('revealTitle').textContent = '카드를 눌러 공개하세요';
    $('revealSub').textContent = `${TOPIC_LABEL[tstate.topic]} · ${tstate.spread === 'one' ? '원 카드' : '쓰리 카드'}`;

    const suits = tarotData.suits;
    $('revealSlots').innerHTML = tstate.picks.map((pk, i) => {
      const card = tarotData.cards[pk.id];
      return `<div class="slot"><div class="pos">${POS_LABELS[tstate.spread][i]}</div>
        <div class="tcard${pk.rev ? ' rev' : ''}" id="rvSlot${i}">
          <div class="tin">
            <div class="tback cback"></div>
            <div class="tfront">${cardFaceHtml(card, suits)}</div>
          </div>
        </div></div>`;
    }).join('');

    tstate.picks.forEach((pk, i) => {
      $('rvSlot' + i).addEventListener('click', () => onRevealTap(i));
    });
    setReady();
  }

  function setReady() {
    const next = $('rvSlot' + tstate.revealed);
    if (next) next.classList.add('ready');
  }

  function onRevealTap(i) {
    if (i !== tstate.revealed) return;
    const slot = $('rvSlot' + i);
    if (!slot.classList.contains('ready')) return;
    slot.classList.remove('ready');
    slot.classList.add('flip');
    tstate.revealed++;
    setTimeout(async () => {
      await appendReading(i);
      if (tstate.revealed >= tstate.picks.length) finishTarot();
      else setReady();
    }, 720);
  }

  /* ═══════════ tarot: reading (static JSON — swap point for LLM API) ═══════════ */
  async function getTarotReading(pick, topic) {
    const data = await loadTarotData();
    const card = data.cards[pick.id];
    const result = {
      card,
      orientation: pick.rev ? '역방향' : '정방향',
      meaning: pick.rev ? card.rev : card.up,
      topicLabel: null, topicText: null,
    };
    if (topic !== 'all') {
      result.topicLabel = TOPIC_LABEL[topic];
      result.topicText = card[TOPIC_KEY[topic]];
    }
    return result;
  }

  async function appendReading(i) {
    const pk = tstate.picks[i];
    const r = await getTarotReading(pk, tstate.topic);
    const div = document.createElement('div');
    div.className = 'card reading';
    div.innerHTML = `
      <div class="r-pos">${POS_LABELS[tstate.spread][i]}</div>
      <div class="r-name">${r.card.emoji} ${r.card.ko} <span style="font-weight:600;color:#8a7a63;font-size:12px">${r.card.en}</span>${pk.rev ? '<span class="rev-badge">역방향</span>' : ''}</div>
      <div class="r-mean">${r.meaning}</div>
      ${r.topicText ? `<div class="r-topic"><b>${r.topicLabel}</b> · ${r.topicText}</div>` : ''}`;
    $('readings').appendChild(div);
  }

  function finishTarot() {
    $('revealTitle').textContent = '리딩 완료 ✨';
    $('tarotDisc').style.display = 'block';
    $('tarotDone').style.display = 'flex';
    if (!tstate.replay) {
      histSave({
        type: 'tarot', ts: Date.now(),
        topic: tstate.topic, spread: tstate.spread,
        picks: tstate.picks,
      });
    }
  }

  $('trAgain').addEventListener('click', () => { backOverride = null; startTarotTable(); });
  $('trHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ history UI ═══════════ */
  $('historyBtn').addEventListener('click', () => { renderHistory(); show('v-history'); });

  function renderHistory() {
    const list = histList();
    const box = $('historyList');
    if (!list.length) {
      box.innerHTML = '<div class="h-empty">아직 기록이 없어요.<br>사주나 타로를 보면 여기에 저장됩니다.</div>';
      $('historyClear').style.display = 'none';
      return;
    }
    $('historyClear').style.display = 'inline';
    box.innerHTML = '';
    list.forEach((e, idx) => {
      const b = document.createElement('button');
      b.className = 'h-item';
      if (e.type === 'saju') {
        b.innerHTML = `<span class="hi">📜</span><span><div class="ht">${e.name ? e.name + '의 ' : ''}사주풀이</div><div class="hd">${e.birth} · ${fmtTs(e.ts)}</div></span>`;
      } else {
        b.innerHTML = `<span class="hi">🃏</span><span><div class="ht">타로 · ${TOPIC_LABEL[e.topic]}</div><div class="hd">${e.spread === 'one' ? '원 카드' : '쓰리 카드'} · ${fmtTs(e.ts)}</div></span>`;
      }
      b.addEventListener('click', () => openHistory(idx));
      box.appendChild(b);
    });
  }

  async function openHistory(idx) {
    const e = histList()[idx];
    if (!e) return;
    if (e.type === 'saju') {
      await renderSajuResult(e);
      backOverride = 'v-history';
      show('v-saju-result');
    } else {
      await loadTarotData();
      tstate.replay = true;
      tstate.topic = e.topic;
      tstate.spread = e.spread;
      tstate.picks = e.picks;
      tstate.revealed = e.picks.length;
      show('v-tarot-table');
      $('shuffleBox').style.display = 'none';
      $('pickBox').style.display = 'none';
      $('revealBox').style.display = 'block';
      $('revealTitle').textContent = '지난 리딩 다시 보기';
      $('revealSub').textContent = `${TOPIC_LABEL[e.topic]} · ${e.spread === 'one' ? '원 카드' : '쓰리 카드'} · ${fmtTs(e.ts)}`;
      const suits = tarotData.suits;
      $('revealSlots').innerHTML = e.picks.map((pk, i) => {
        const card = tarotData.cards[pk.id];
        return `<div class="slot"><div class="pos">${POS_LABELS[e.spread][i]}</div>
          <div class="tcard flip${pk.rev ? ' rev' : ''}"><div class="tin" style="transition:none">
            <div class="tback cback"></div>
            <div class="tfront">${cardFaceHtml(card, suits)}</div>
          </div></div></div>`;
      }).join('');
      $('readings').innerHTML = '';
      for (let i = 0; i < e.picks.length; i++) await appendReading(i);
      $('tarotDisc').style.display = 'block';
      $('tarotDone').style.display = 'flex';
      backOverride = 'v-history';
    }
  }

  $('historyClear').addEventListener('click', () => {
    if (confirm('지난 기록을 전부 삭제할까요?')) {
      localStorage.removeItem(HKEY);
      renderHistory();
    }
  });
})();
