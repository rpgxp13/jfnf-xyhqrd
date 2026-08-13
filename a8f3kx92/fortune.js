/* Fortune — Saju + Tarot (100% client-side, no backend)
   - Saju eight characters are computed with the lunar-javascript library
     (loaded lazily from CDN only when the saju feature is entered).
   - All randomness uses crypto.getRandomValues().
   - Interpretation text comes from static JSON (data/*.json); English
     translations live in saju_en.json / tarot_en.json and are fetched
     only when the language is switched to EN.
   - The get*Reading() functions are the single seam to swap for an LLM API later. */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ═══════════ i18n ═══════════ */
  const LKEY = 'fortune_lang';
  let lang = localStorage.getItem(LKEY) === 'en' ? 'en' : 'ko';

  const STR = {
    'title.fortune': ['🔮 Fortune', '🔮 Fortune'],
    'title.saju':    ['📜 사주풀이', '📜 Saju'],
    'title.tarot':   ['🃏 타로점', '🃏 Tarot'],
    'title.hist':    ['🕘 기록', '🕘 History'],

    'sel.saju.t':  ['사주풀이 · Saju', 'Saju Reading'],
    'sel.saju.d':  ['생년월일시로 사주팔자를 세우고<br>일간과 오행의 기운을 읽어드려요', 'Cast your Four Pillars from your birth data<br>and read your day master &amp; five elements'],
    'sel.tarot.t': ['타로점 · Tarot', 'Tarot Reading'],
    'sel.tarot.d': ['카드를 직접 섞고 뽑아서<br>지금 필요한 메시지를 확인해요', 'Shuffle and pick the cards yourself<br>to hear the message you need now'],
    'sel.history': ['🕘 지난 기록 보기', '🕘 Past readings'],

    'sj.title':  ['📜 사주 정보 입력', '📜 Birth details'],
    'sj.sub':    ['생년월일과 태어난 시간을 알려주세요', 'Tell us your birth date and time'],
    'f.name':    ['이름 (선택)', 'Name (optional)'],
    'f.name.ph': ['기록에 표시할 이름', 'Shown in your history'],
    'f.country': ['출생 국가 (시차 반영)', 'Country of birth (time zone)'],
    'c.kr':      ['🇰🇷 한국', '🇰🇷 Korea'],
    'c.ph':      ['🇵🇭 필리핀', '🇵🇭 Philippines'],
    'f.mode':    ['풀이 방식', 'Reading type'],
    'mode.four':  ['사주 (시간 포함)', 'Four pillars (with hour)'],
    'mode.three': ['삼주 (시간 제외)', 'Three pillars (no hour)'],
    'f.cal':     ['달력 기준', 'Calendar'],
    'f.solar':   ['양력', 'Solar'],
    'f.lunar':   ['음력', 'Lunar'],
    'f.leap':    ['윤달이에요', 'It’s a leap month'],
    'f.date':    ['생년월일', 'Date of birth'],
    'f.time':    ['태어난 시간', 'Time of birth'],
    'f.notime':  ['시간을 몰라요 (삼주로 자동 전환)', 'I don’t know the time (switches to 3 pillars)'],
    'f.gender':  ['성별 (선택)', 'Gender (optional)'],
    'f.female':  ['여성', 'Female'],
    'f.male':    ['남성', 'Male'],
    'f.skip':    ['선택 안 함', 'Skip'],
    'f.go':      ['사주 세우기 ✨', 'Cast my chart ✨'],
    'f.loading': ['만세력을 불러오는 중…', 'Loading the almanac…'],

    'r.myeongsik': ['사주 명식', 'Four Pillars'],
    'r.of':        ['{n}의 사주 명식', '{n}’s Four Pillars'],
    'r.ilgan':     ['당신의 일간은', 'Your day master is'],
    'r.elements':  ['오행 분포', 'Five Elements'],
    'r.again':     ['다시 입력', 'New input'],
    'r.home':      ['처음으로', 'Home'],
    'p.year':  ['년주', 'Year'],
    'p.month': ['월주', 'Month'],
    'p.day':   ['일주', 'Day'],
    'p.time':  ['시주', 'Hour'],
    'p.unknown': ['모름', '—'],

    'disc': ['본 콘텐츠는 재미와 자기 성찰을 위한 것으로, 실제 미래를 예측하지 않습니다.', 'This content is for fun and self-reflection; it does not predict the actual future.'],

    't.topic.title': ['🃏 어떤 이야기가 궁금한가요?', '🃏 What would you like to ask about?'],
    't.topic.sub':   ['질문 주제를 골라주세요', 'Choose a topic'],
    'topic.love':  ['연애 · 관계', 'Love · Relationship'],
    'topic.work':  ['일 · 커리어', 'Work · Career'],
    'topic.money': ['금전', 'Money'],
    'topic.all':   ['종합', 'General'],
    't.spread.title': ['스프레드 선택', 'Choose a spread'],
    't.spread.sub':   ['몇 장을 뽑을까요?', 'How many cards?'],
    'sp.one':     ['원 카드', 'One Card'],
    'sp.one.d':   ['지금 가장 필요한 하나의 메시지', 'The single message you need right now'],
    'sp.three':   ['쓰리 카드', 'Three Cards'],
    'sp.three.d': ['과거 · 현재 · 미래의 흐름 읽기', 'Past · Present · Future flow'],
    'sp.celtic':   ['켈틱 크로스', 'Celtic Cross'],
    'sp.celtic.d': ['10장으로 보는 깊이 있는 전체 리딩', 'A deep 10-card reading of your whole situation'],
    't.shuffle':  ['카드를 섞는 중… 마음속으로 질문을 떠올려 보세요 🌙', 'Shuffling… hold your question in your mind 🌙'],
    't.fanhint':  ['마음이 가는 카드를 눌러보세요', 'Tap a card that calls to you'],
    't.fanhint2': ['위의 카드를 누르면 확정! 부채꼴에서 다른 카드로 바꿀 수도 있어요', 'Tap the card above to confirm — or pick another from the fan'],
    't.reveal':   ['카드를 눌러 공개하세요', 'Tap a card to reveal it'],
    't.done':     ['리딩 완료 ✨', 'Reading complete ✨'],
    't.replay':   ['지난 리딩 다시 보기', 'Reading from your history'],
    't.again':    ['다시 뽑기', 'Draw again'],
    'pos.msg':     ['메시지', 'Message'],
    'pos.past':    ['과거', 'Past'],
    'pos.present': ['현재', 'Present'],
    'pos.future':  ['미래', 'Future'],
    'pos.c1':  ['현재 상황', 'Present'],
    'pos.c2':  ['장애물', 'Challenge'],
    'pos.c3':  ['원인 · 뿌리', 'Root cause'],
    'pos.c4':  ['지나간 과거', 'Recent past'],
    'pos.c5':  ['드러나는 목표', 'Goal above'],
    'pos.c6':  ['다가올 흐름', 'Near future'],
    'pos.c7':  ['나 자신', 'Yourself'],
    'pos.c8':  ['주변 환경', 'Around you'],
    'pos.c9':  ['희망과 두려움', 'Hopes & fears'],
    'pos.c10': ['최종 결과', 'Outcome'],
    'rev.badge':   ['역방향', 'Reversed'],

    'h.title': ['🕘 지난 기록', '🕘 Past readings'],
    'h.sub':   ['최근 30개까지 이 기기에 저장돼요', 'Up to 30 entries, stored on this device'],
    'h.empty': ['아직 기록이 없어요.<br>사주나 타로를 보면 여기에 저장됩니다.', 'No readings yet.<br>Saju and tarot results will be saved here.'],
    'h.clear': ['기록 전체 삭제', 'Delete all'],
    'h.clear.confirm': ['지난 기록을 전부 삭제할까요?', 'Delete all past readings?'],
    'h.saju':  ['사주풀이', 'Saju reading'],
    'h.of':    ['{n}의 사주풀이', '{n}’s saju reading'],
    'h.tarot': ['타로', 'Tarot'],

    'alert.date': ['생년월일을 입력해주세요!', 'Please enter your birth date!'],
    'alert.time': ['태어난 시간을 입력하거나 "시간을 몰라요"를 선택해주세요!', 'Enter a birth time or check "I don’t know the time"!'],
    'alert.fail': ['사주 계산에 실패했어요. 날짜가 올바른지 확인해주세요.\n(음력의 경우 존재하는 날짜/윤달인지 확인)', 'Could not calculate the chart. Please check the date.\n(For lunar input, make sure the date/leap month exists.)'],

    'b.solar': ['양력', 'Solar'],
    'b.lunar': ['음력', 'Lunar'],
    'b.leap':  ['(윤달)', ' (leap)'],
    'b.notime': [' (시간 모름)', ' (time unknown)'],
    'g.F': ['여성', 'Female'],
    'g.M': ['남성', 'Male'],
  };

  function t(key) {
    const v = STR[key];
    return v ? v[lang === 'ko' ? 0 : 1] : key;
  }
  function tf(key, name) { return t(key).replace('{n}', name); }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $('langBtn').textContent = lang === 'ko' ? 'EN' : '한';
    document.documentElement.lang = lang;
    $('pageTitle').textContent = t(TITLES[currentView] || 'title.fortune');
  }

  /* ═══════════ view manager ═══════════ */
  const VIEWS = ['v-select', 'v-saju-input', 'v-saju-result', 'v-tarot-topic', 'v-tarot-spread', 'v-tarot-table', 'v-history'];
  const BACK_MAP = {
    'v-select': null,
    'v-saju-input': 'v-select',
    'v-saju-result': 'v-saju-input',
    'v-tarot-topic': 'v-select',
    'v-tarot-spread': 'v-tarot-topic',
    'v-tarot-table': 'v-tarot-spread',
    'v-history': 'v-select',
  };
  const TITLES = {
    'v-select': 'title.fortune',
    'v-saju-input': 'title.saju',
    'v-saju-result': 'title.saju',
    'v-tarot-topic': 'title.tarot',
    'v-tarot-spread': 'title.tarot',
    'v-tarot-table': 'title.tarot',
    'v-history': 'title.hist',
  };

  let currentView = 'v-select';
  let backOverride = null;

  function show(view) {
    VIEWS.forEach(v => $(v).classList.toggle('on', v === view));
    currentView = view;
    $('pageTitle').textContent = t(TITLES[view] || 'title.fortune');
    window.scrollTo(0, 0);
  }

  $('backBtn').addEventListener('click', () => {
    if (backOverride) { const target = backOverride; backOverride = null; show(target); return; }
    const target = BACK_MAP[currentView];
    if (target === null || target === undefined) { location.href = './index.html'; return; }
    show(target);
  });

  /* ═══════════ language toggle ═══════════ */
  $('langBtn').addEventListener('click', async () => {
    lang = lang === 'ko' ? 'en' : 'ko';
    localStorage.setItem(LKEY, lang);
    applyStatic();
    // re-render dynamic screens in the new language
    if (currentView === 'v-saju-result' && lastSajuEntry) await renderSajuResult(lastSajuEntry);
    if (currentView === 'v-history') renderHistory();
    if (currentView === 'v-tarot-table') await rerenderTarotTexts();
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
  const REVERSAL_PERCENT = 30;

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

  /* ═══════════ future LLM integration (AWS Lambda proxy) ═══════════
     Set LLM_ENDPOINT to the proxy URL to enable detailed AI readings.
     The endpoint receives { kind: 'saju'|'tarot', lang, payload } and
     should return { text: "detailed reading" }. While it is null the
     static JSON templates below are used as-is, so the page keeps
     working with zero backend. */
  const LLM_ENDPOINT = null;

  async function llmReading(kind, payload) {
    if (!LLM_ENDPOINT) return null;
    try {
      const r = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, lang, payload }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j.text || null;
    } catch { return null; }
  }

  const dataCache = {};
  async function loadJson(name) {
    if (!dataCache[name]) dataCache[name] = await (await fetch('./data/' + name + '.json')).json();
    return dataCache[name];
  }
  const loadSajuData = () => loadJson('saju');
  const loadSajuEn = () => loadJson('saju_en');
  const loadTarotData = () => loadJson('tarot');
  const loadTarotEn = () => loadJson('tarot_en');

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
  const GAN_ROMA = { '甲': 'Gap', '乙': 'Eul', '丙': 'Byeong', '丁': 'Jeong', '戊': 'Mu', '己': 'Gi', '庚': 'Gyeong', '辛': 'Sin', '壬': 'Im', '癸': 'Gye' };
  const ZHI_ROMA = { '子': 'Ja', '丑': 'Chuk', '寅': 'In', '卯': 'Myo', '辰': 'Jin', '巳': 'Sa', '午': 'O', '未': 'Mi', '申': 'Sin', '酉': 'Yu', '戌': 'Sul', '亥': 'Hae' };
  const EL_EN = { '목': 'Wood', '화': 'Fire', '토': 'Earth', '금': 'Metal', '수': 'Water' };
  const GAN_EN_DESC = { '甲': 'Yang Wood', '乙': 'Yin Wood', '丙': 'Yang Fire', '丁': 'Yin Fire', '戊': 'Yang Earth', '己': 'Yin Earth', '庚': 'Yang Metal', '辛': 'Yin Metal', '壬': 'Yang Water', '癸': 'Yin Water' };
  const EL_ORDER = ['목', '화', '토', '금', '수'];

  const elName = (el) => lang === 'ko' ? el : EL_EN[el];
  const pillarReading = (g, z) => lang === 'ko' ? (GAN_KO[g] + ZHI_KO[z]) : (GAN_ROMA[g] + ZHI_ROMA[z].toLowerCase());

  /* ═══════════ saju: input UI ═══════════ */
  function segInit(segEl) {
    segEl.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        segEl.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        if (segEl.id === 'calSeg') {
          $('leapRow').style.display = b.dataset.v === 'lunar' ? 'flex' : 'none';
        }
        if (segEl.id === 'modeSeg') {
          $('timeField').style.display = b.dataset.v === 'three' ? 'none' : 'block';
        }
      });
    });
  }
  segInit($('calSeg'));
  segInit($('genderSeg'));
  segInit($('countrySeg'));
  segInit($('modeSeg'));

  /* standard-time offset per birth country; the almanac library works on
     UTC+8 (CST), so birth times are shifted onto that base before computing */
  const COUNTRY_UTC = { KR: 9, PH: 8 };
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

  let lastSajuEntry = null;

  $('sjGo').addEventListener('click', async () => {
    const dateStr = $('sjDate').value;
    if (!dateStr) { alert(t('alert.date')); return; }
    const [y, m, d] = dateStr.split('-').map(Number);
    const mode = segVal($('modeSeg'));
    const hasTime = mode === 'four' && !$('sjNoTime').checked;
    let hh = 12, mi = 0;
    if (hasTime) {
      const tm = $('sjTime').value;
      if (!tm) { alert(t('alert.time')); return; }
      [hh, mi] = tm.split(':').map(Number);
    }
    const input = {
      cal: segVal($('calSeg')),
      leap: $('sjLeap').checked,
      country: segVal($('countrySeg')),
      y, m, d, hasTime, hh, mi,
    };

    $('sjGo').disabled = true;
    $('sjLoading').style.display = 'block';
    try {
      await ensureLunar();
      const saju = computeSaju(input);
      const entry = {
        type: 'saju', ts: Date.now(),
        name: $('sjName').value.trim(),
        gender: segVal($('genderSeg')),
        in: input,
        pillars: saju.pillars,
      };
      histSave(entry);
      lastSajuEntry = entry;
      await renderSajuResult(entry);
      backOverride = null;
      show('v-saju-result');
    } catch (e) {
      alert(t('alert.fail'));
    } finally {
      $('sjGo').disabled = false;
      $('sjLoading').style.display = 'none';
    }
  });

  /* ═══════════ saju: computation (lunar-javascript) ═══════════ */
  function shiftToCST(y, m, d, hh, mi, utcOff) {
    const ms = Date.UTC(y, m - 1, d, hh, mi) - (utcOff - 8) * 3600000;
    const dt = new Date(ms);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hh: dt.getUTCHours(), mi: dt.getUTCMinutes() };
  }

  function computeSaju(input) {
    const utcOff = COUNTRY_UTC[input.country] || 9;
    const hh = input.hasTime ? input.hh : 12;
    const mi = input.hasTime ? input.mi : 0;

    // resolve lunar input to a solar date first, then apply the time-zone shift
    let sy = input.y, sm = input.m, sd = input.d;
    if (input.cal === 'lunar') {
      const lm = input.leap ? -input.m : input.m;
      const sol = window.Lunar.fromYmd(input.y, lm, input.d).getSolar();
      sy = sol.getYear(); sm = sol.getMonth(); sd = sol.getDay();
    }
    const s = shiftToCST(sy, sm, sd, hh, mi, utcOff);
    const lunarObj = window.Solar.fromYmdHms(s.y, s.m, s.d, s.hh, s.mi, 0).getLunar();
    const ec = lunarObj.getEightChar();
    return {
      pillars: {
        year: ec.getYear(),
        month: ec.getMonth(),
        day: ec.getDay(),
        time: input.hasTime ? ec.getTime() : null,
      },
    };
  }

  function describeBirth(entry) {
    if (!entry.in) return entry.birth || '';
    const i = entry.in;
    const flag = i.country === 'PH' ? '🇵🇭 ' : (i.country === 'KR' ? '🇰🇷 ' : '');
    const cal = t(i.cal === 'lunar' ? 'b.lunar' : 'b.solar') + (i.cal === 'lunar' && i.leap ? t('b.leap') : '');
    const tp = i.hasTime ? ` ${String(i.hh).padStart(2, '0')}:${String(i.mi).padStart(2, '0')}` : t('b.notime');
    return `${flag}${cal} ${i.y}.${String(i.m).padStart(2, '0')}.${String(i.d).padStart(2, '0')}${tp}`;
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
  async function getSajuReading(entry) {
    const pillars = entry.pillars;
    const data = await loadSajuData();
    const en = lang === 'en' ? await loadSajuEn() : null;
    const dayGan = pillars.day[0];
    const counts = countElements(pillars);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const base = data.ilgan[dayGan];
    const ilgan = {
      symbol: base.symbol, hanja: base.hanja, ko: base.ko,
      title: en ? en.ilgan[dayGan].title : base.title,
      text: en ? en.ilgan[dayGan].text : base.text,
    };

    const notes = [];
    EL_ORDER.forEach(el => {
      const src = en ? en.elements[el] : data.elements[el];
      if (counts[el] >= 3) notes.push(src.excess);
      else if (counts[el] === 0) notes.push(src.lack);
    });
    if (notes.length === 0) notes.push(en ? en.balance.balanced : data.balance.balanced);

    // detailed AI reading when a backend is configured (no-op otherwise)
    const llmText = await llmReading('saju', {
      pillars, counts,
      name: entry.name || null,
      gender: entry.gender || null,
      birth: describeBirth(entry),
    });

    return {
      ilgan, counts, total, notes, llmText,
      colors: Object.fromEntries(EL_ORDER.map(el => [el, data.elements[el].color])),
      emojis: Object.fromEntries(EL_ORDER.map(el => [el, data.elements[el].emoji])),
      balanceNote: en ? en.balance.note : data.balance.note,
    };
  }

  /* ═══════════ saju: result rendering ═══════════ */
  async function renderSajuResult(entry) {
    lastSajuEntry = entry;
    const reading = await getSajuReading(entry);
    const p = entry.pillars;

    $('sjrTitle').textContent = entry.name ? tf('r.of', entry.name) : t('r.myeongsik');
    $('sjrSub').textContent = describeBirth(entry) + (entry.gender ? ' · ' + t('g.' + entry.gender) : '');

    const defs = [
      ['p.year', p.year], ['p.month', p.month], ['p.day', p.day], ['p.time', p.time],
    ];
    $('sjrPillars').innerHTML = defs.map(([labelKey, val]) => {
      if (!val) return `<div class="pillar empty"><div class="plabel">${t(labelKey)}</div><div class="hanja">${t('p.unknown')}</div></div>`;
      const g = val[0], z = val[1];
      return `<div class="pillar">
        <div class="plabel">${t(labelKey)}</div>
        <div class="hanja">${g}<br>${z}</div>
        <div class="read">${pillarReading(g, z)}</div>
        <div class="els">${elName(GAN_EL[g])} · ${elName(ZHI_EL[z])}</div>
      </div>`;
    }).join('');

    const il = reading.ilgan;
    $('sjrSym').textContent = il.symbol;
    $('sjrIlganName').innerHTML = lang === 'ko'
      ? `${t('r.ilgan')} <b>${il.hanja} (${il.ko})</b>`
      : `${t('r.ilgan')} <b>${il.hanja} — ${GAN_ROMA[il.hanja]} (${GAN_EN_DESC[il.hanja]})</b>`;
    $('sjrIlganTitle').textContent = il.title;
    $('sjrIlganText').textContent = il.text;

    $('sjrBars').innerHTML = EL_ORDER.map(el => {
      const c = reading.counts[el];
      const pct = reading.total ? Math.round(c / reading.total * 100) : 0;
      return `<div class="ebar-row">
        <span class="ename">${reading.emojis[el]} ${elName(el)}</span>
        <span class="etrack"><span class="efill" data-w="${pct}" style="background:${reading.colors[el]}"></span></span>
        <span class="ecnt">${c}</span>
      </div>`;
    }).join('');
    requestAnimationFrame(() => {
      document.querySelectorAll('#sjrBars .efill').forEach(f => { f.style.width = f.dataset.w + '%'; });
    });

    $('sjrNotes').innerHTML =
      reading.notes.map(n => `<div class="enote">${n}</div>`).join('') +
      (reading.llmText ? `<div class="enote" style="background:#f4edfd">${reading.llmText}</div>` : '') +
      `<div class="enote" style="opacity:0.75">${reading.balanceNote}</div>`;
  }

  $('sjrAgain').addEventListener('click', () => { backOverride = null; show('v-saju-input'); });
  $('sjrHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ tarot ═══════════ */
  const POS_KEYS = {
    one: ['pos.msg'],
    three: ['pos.past', 'pos.present', 'pos.future'],
    celtic: ['pos.c1', 'pos.c2', 'pos.c3', 'pos.c4', 'pos.c5', 'pos.c6', 'pos.c7', 'pos.c8', 'pos.c9', 'pos.c10'],
  };
  const NEED = { one: 1, three: 3, celtic: 10 };
  const TOPIC_FIELD = { love: 'love', work: 'work', money: 'money' };

  function posLabel(spread, i) {
    const s = t(POS_KEYS[spread][i]);
    return spread === 'celtic' ? `${i + 1}. ${s}` : s;
  }

  const tstate = { topic: null, spread: null, deck: [], picks: [], revealed: 0, replay: false, ts: null };
  let candidate = null;

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

  const spreadName = () => t('sp.' + tstate.spread);
  const topicName = () => t('topic.' + tstate.topic);

  async function startTarotTable() {
    tstate.replay = false;
    tstate.picks = [];
    tstate.revealed = 0;
    candidate = null;
    show('v-tarot-table');
    $('shuffleBox').style.display = 'block';
    $('pickBox').style.display = 'none';
    $('revealBox').style.display = 'none';
    $('readings').innerHTML = '';
    $('tarotDisc').style.display = 'none';
    $('tarotDone').style.display = 'none';

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
    if (lang === 'en') await loadTarotEn();
    tstate.deck = cryptoShuffle([...Array(78).keys()]);

    setTimeout(buildFan, 1800);
  }

  function fanHintDefault() {
    $('fanHint').classList.remove('cand-mode');
    $('fanHint').textContent = t('t.fanhint');
  }

  function resetCandSlot() {
    $('candSlot').innerHTML = '<span class="qm">?</span>';
  }

  function buildFan() {
    $('shuffleBox').style.display = 'none';
    $('pickBox').style.display = 'block';

    const need = NEED[tstate.spread];
    $('pickSlots').className = 'slots' + (tstate.spread === 'celtic' ? ' celtic' : '');
    $('pickSlots').innerHTML = POS_KEYS[tstate.spread].map((k, i) =>
      `<div class="slot"><div class="pos">${posLabel(tstate.spread, i)}</div><div class="tcard" id="pickSlot${i}" style="width:${tstate.spread === 'celtic' ? 46 : 64}px;height:${tstate.spread === 'celtic' ? 72 : 100}px"><div class="tin"><div class="tback cback" style="opacity:0.25"></div></div></div></div>`
    ).join('');
    $('pickCount').textContent = `0 / ${need}`;
    fanHintDefault();
    resetCandSlot();

    const fan = $('fan');
    fan.innerHTML = '';
    const n = 78;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'fcard cback';
      const ang = -62 + (124 / (n - 1)) * i;
      const base = `translateX(-50%) rotate(${ang}deg) translateY(-268px)`;
      c.style.transform = base;
      c.dataset.base = base;
      c.dataset.i = i;
      c.addEventListener('click', onFanTap);
      fan.appendChild(c);
    }
    const sc = document.querySelector('.fan-scroll');
    sc.scrollLeft = (880 - sc.clientWidth) / 2;
  }

  /* two-step picking: tapping a fan card lifts it OUT of the fan into the
     upright preview slot at the top (its empty spot stays visible in the
     fan); tapping the preview card confirms, tapping another fan card swaps */
  function onFanTap(e) {
    const need = NEED[tstate.spread];
    if (tstate.picks.length >= need) return;
    const el = e.currentTarget;
    if (el.classList.contains('gone') || el.classList.contains('away')) return;

    if (candidate) candidate.classList.remove('away'); // put the old one back
    candidate = el;
    el.classList.add('away');

    const slot = $('candSlot');
    slot.innerHTML = '<div class="cand-card cback"></div>';
    slot.querySelector('.cand-card').addEventListener('click', () => {
      if (candidate) confirmPick(candidate);
    });

    $('fanHint').classList.add('cand-mode');
    $('fanHint').textContent = t('t.fanhint2');
  }

  function confirmPick(el) {
    const need = NEED[tstate.spread];
    candidate = null;
    el.classList.add('gone');
    el.classList.remove('away');
    resetCandSlot();
    fanHintDefault();

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

  function cardName(card) {
    return lang === 'ko' ? card.ko : card.en;
  }
  function cardSubName(card) {
    return lang === 'ko' ? card.en : card.ko;
  }

  function cardFaceHtml(card) {
    const suits = dataCache['tarot'].suits;
    const suitMark = card.arcana === 'major' ? '★' : suits[card.suit].emoji;
    return `<div class="tface">
      <span class="corner">${card.label}</span>
      <span class="suitmark">${suitMark}</span>
      <span class="femoji">${card.emoji}</span>
      <span class="fko">${cardName(card)}</span>
      <span class="fen">${cardSubName(card)}</span>
    </div>`;
  }

  function buildReveal() {
    $('pickBox').style.display = 'none';
    $('revealBox').style.display = 'block';
    $('revealTitle').textContent = t('t.reveal');
    $('revealSub').textContent = `${topicName()} · ${spreadName()}`;

    $('revealSlots').className = 'slots' + (tstate.spread === 'celtic' ? ' celtic' : '');
    $('revealSlots').innerHTML = tstate.picks.map((pk, i) => {
      const card = dataCache['tarot'].cards[pk.id];
      return `<div class="slot"><div class="pos">${posLabel(tstate.spread, i)}</div>
        <div class="tcard${pk.rev ? ' rev' : ''}" id="rvSlot${i}">
          <div class="tin">
            <div class="tback cback"></div>
            <div class="tfront">${cardFaceHtml(card)}</div>
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
  async function getTarotReading(pick, topic, spread, posIndex) {
    const data = await loadTarotData();
    const card = data.cards[pick.id];
    let texts = card; // korean fields live on the card itself
    if (lang === 'en') {
      const en = await loadTarotEn();
      texts = en[String(pick.id)] || card;
    }
    const result = {
      card,
      meaning: pick.rev ? texts.rev : texts.up,
      topicLabel: null, topicText: null, llmText: null,
    };
    if (topic !== 'all') {
      result.topicLabel = t('topic.' + topic);
      result.topicText = texts[TOPIC_FIELD[topic]];
    }
    // detailed AI reading when a backend is configured (no-op otherwise)
    result.llmText = await llmReading('tarot', {
      card: { en: card.en, ko: card.ko, arcana: card.arcana, suit: card.suit, label: card.label },
      reversed: pick.rev,
      topic, spread,
      position: POS_KEYS[spread][posIndex],
    });
    return result;
  }

  async function appendReading(i) {
    const pk = tstate.picks[i];
    const r = await getTarotReading(pk, tstate.topic, tstate.spread, i);
    const div = document.createElement('div');
    div.className = 'card reading';
    div.innerHTML = `
      <div class="r-pos">${posLabel(tstate.spread, i)}</div>
      <div class="r-name">${r.card.emoji} ${cardName(r.card)} <span style="font-weight:600;color:#8a7a63;font-size:12px">${cardSubName(r.card)}</span>${pk.rev ? `<span class="rev-badge">${t('rev.badge')}</span>` : ''}</div>
      <div class="r-mean">${r.meaning}</div>
      ${r.topicText ? `<div class="r-topic"><b>${r.topicLabel}</b> · ${r.topicText}</div>` : ''}
      ${r.llmText ? `<div class="r-topic" style="background:#f4edfd">${r.llmText}</div>` : ''}`;
    $('readings').appendChild(div);
  }

  function finishTarot() {
    $('revealTitle').textContent = t('t.done');
    $('tarotDisc').style.display = 'block';
    $('tarotDone').style.display = 'flex';
    if (!tstate.replay) {
      tstate.ts = Date.now();
      histSave({
        type: 'tarot', ts: tstate.ts,
        topic: tstate.topic, spread: tstate.spread,
        picks: tstate.picks,
      });
    }
  }

  /* re-render tarot table texts after a language switch */
  async function rerenderTarotTexts() {
    if ($('revealBox').style.display !== 'block') { // still picking
      if ($('pickBox').style.display === 'block') {
        const need = NEED[tstate.spread];
        $('pickSlots').querySelectorAll('.pos').forEach((el, i) => { el.textContent = posLabel(tstate.spread, i); });
        $('pickCount').textContent = `${tstate.picks.length} / ${need}`;
        if (candidate) { $('fanHint').classList.add('cand-mode'); $('fanHint').textContent = t('t.fanhint2'); }
        else fanHintDefault();
      }
      return;
    }
    if (lang === 'en') await loadTarotEn();
    $('revealTitle').textContent = tstate.revealed >= tstate.picks.length ? (tstate.replay ? t('t.replay') : t('t.done')) : t('t.reveal');
    $('revealSub').textContent = `${topicName()} · ${spreadName()}`;
    $('revealSlots').querySelectorAll('.pos').forEach((el, i) => { el.textContent = posLabel(tstate.spread, i); });
    $('revealSlots').querySelectorAll('.tfront').forEach((el, i) => {
      el.innerHTML = cardFaceHtml(dataCache['tarot'].cards[tstate.picks[i].id]);
    });
    $('readings').innerHTML = '';
    for (let i = 0; i < tstate.revealed; i++) await appendReading(i);
  }

  $('trAgain').addEventListener('click', () => { backOverride = null; startTarotTable(); });
  $('trHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ history UI ═══════════ */
  $('historyBtn').addEventListener('click', () => { renderHistory(); show('v-history'); });

  function renderHistory() {
    const list = histList();
    const box = $('historyList');
    if (!list.length) {
      box.innerHTML = `<div class="h-empty">${t('h.empty')}</div>`;
      $('historyClear').style.display = 'none';
      return;
    }
    $('historyClear').style.display = 'inline';
    box.innerHTML = '';
    list.forEach((e, idx) => {
      const b = document.createElement('button');
      b.className = 'h-item';
      if (e.type === 'saju') {
        const title = e.name ? tf('h.of', e.name) : t('h.saju');
        b.innerHTML = `<span class="hi">📜</span><span><div class="ht">${title}</div><div class="hd">${describeBirth(e)} · ${fmtTs(e.ts)}</div></span>`;
      } else {
        b.innerHTML = `<span class="hi">🃏</span><span><div class="ht">${t('h.tarot')} · ${t('topic.' + e.topic)}</div><div class="hd">${t('sp.' + e.spread)} · ${fmtTs(e.ts)}</div></span>`;
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
      if (lang === 'en') await loadTarotEn();
      tstate.replay = true;
      tstate.topic = e.topic;
      tstate.spread = e.spread;
      tstate.picks = e.picks;
      tstate.revealed = e.picks.length;
      tstate.ts = e.ts;
      show('v-tarot-table');
      $('shuffleBox').style.display = 'none';
      $('pickBox').style.display = 'none';
      $('revealBox').style.display = 'block';
      $('revealTitle').textContent = t('t.replay');
      $('revealSub').textContent = `${topicName()} · ${spreadName()} · ${fmtTs(e.ts)}`;
      $('revealSlots').className = 'slots' + (e.spread === 'celtic' ? ' celtic' : '');
      $('revealSlots').innerHTML = e.picks.map((pk, i) => {
        const card = dataCache['tarot'].cards[pk.id];
        return `<div class="slot"><div class="pos">${posLabel(e.spread, i)}</div>
          <div class="tcard flip${pk.rev ? ' rev' : ''}"><div class="tin" style="transition:none">
            <div class="tback cback"></div>
            <div class="tfront">${cardFaceHtml(card)}</div>
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
    if (confirm(t('h.clear.confirm'))) {
      localStorage.removeItem(HKEY);
      renderHistory();
    }
  });

  /* init */
  applyStatic();
})();
