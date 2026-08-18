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
  // default language is ENGLISH; Korean only when explicitly chosen
  let lang = localStorage.getItem(LKEY) === 'ko' ? 'ko' : 'en';

  const STR = {
    'title.fortune': ['🔮 Fortune', '🔮 Fortune'],
    'title.saju':    ['📜 사주풀이', '📜 Saju'],
    'title.tarot':   ['🃏 타로점', '🃏 Tarot'],
    'title.hist':    ['🕘 기록', '🕘 History'],

    'sel.saju.t':  ['사주풀이 · Saju', 'Saju Reading'],
    'sel.saju.d':  ['생년월일시로 사주팔자를 세우고<br>일간과 오행의 기운을 읽어드려요', 'Cast your Four Pillars from your birth data<br>and read your day master &amp; five elements'],
    'sel.tarot.t': ['타로점 · Tarot', 'Tarot Reading'],
    'sel.tarot.d': ['카드를 직접 섞고 뽑아서<br>지금 필요한 메시지를 확인해요', 'Shuffle and pick the cards yourself<br>to hear the message you need now'],
    'sel.gh.t':  ['궁합 · Compatibility', 'Couple Compatibility'],
    'sel.gh.d':  ['두 사람의 사주를 나란히 세우고<br>합과 상생의 케미를 읽어드려요', 'Cast both charts side by side<br>and read the chemistry between them'],
    'title.gh':  ['💞 사주 궁합', '💞 Compatibility'],
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
    'r.yinyang':   ['음양오행', 'Yin-Yang & Five Elements'],
    'r.daeun':     ['대운 (10년 주기 흐름)', 'Daeun — 10-Year Luck Cycles'],
    'r.persona':   ['성격 및 적성', 'Personality & Aptitude'],
    'r.wealth':    ['재물운', 'Wealth Luck'],
    'r.love':      ['애정 및 궁합', 'Love & Compatibility'],
    'r.forecast':  ['연간 · 월간 운세', 'Yearly · Monthly Fortune'],
    'r.overall':   ['🌟 총평 · 종합 해설', '🌟 Overall Reading'],
    'ov.saju': ['당신의 사주는 {il} 일간을 중심으로, 오행 가운데 {strong} 기운이 가장 도드라지고 {weak} 기운이 상대적으로 옅은 구성이에요. 도드라진 기운은 당신의 무기가 되고, 옅은 기운은 의식적으로 채워줄수록 삶의 균형이 좋아져요. 위의 풀이들을 하나의 이야기로 이어 읽으면, 지금 어떤 선택이 자연스러운지 감이 잡힐 거예요.',
      'Your chart centers on the day master {il}: among the five elements, {strong} shines strongest while {weak} runs relatively light. The strong element is your natural weapon, and consciously feeding the light one brings life into better balance. Read the sections above as one story, and the choices that feel natural right now will come into focus.'],
    'ai.loading': ['🤖 AI 상세 풀이를 준비하는 중…', '🤖 Preparing the AI reading…'],
    'load.saju':  ['AI가 사주를 깊이 읽고 있어요…', 'The AI is reading your chart…'],
    'load.tarot': ['AI가 카드의 이야기를 준비하고 있어요…', 'The AI is listening to your cards…'],
    'load.sub':   ['잠시만 기다려 주세요 (10~20초)', 'Just a moment (10–20s)'],
    'yy.yang':     ['양 陽', 'Yang'],
    'yy.yin':      ['음 陰', 'Yin'],
    'd.now':       ['현재', 'now'],
    'd.ageFmt':    ['{n}세~', 'age {n}+'],
    'd.note.gender': ['입력 화면에서 성별을 선택하면 대운 흐름이 표시돼요.', 'Select a gender on the input form to see your 10-year luck cycles.'],
    'd.note.approx': ['대운은 10년 단위로 바뀌는 인생의 큰 흐름이에요. 나이는 세는나이 기준입니다.', 'Daeun are the big 10-year currents of life. Ages are in traditional Korean counting.'],
    'f.yearFmt':   ['올해 {gz}년에는 {t}', 'This year ({gz}), {t}'],
    'f.monthFmt':  ['이번 달 {gz}월에는 {t}', 'This month ({gz} month), {t}'],
    'r.again':     ['다시 입력', 'New input'],
    'r.home':      ['처음으로', 'Home'],
    'p.year':  ['년주', 'Year'],
    'p.month': ['월주', 'Month'],
    'p.day':   ['일주', 'Day'],
    'p.time':  ['시주', 'Hour'],
    'p.unknown': ['모름', '—'],

    'disc': ['본 콘텐츠는 재미와 자기 성찰을 위한 것으로, 실제 미래를 예측하지 않습니다.', 'This content is for fun and self-reflection; it does not predict the actual future.'],

    'gh.title': ['💞 두 사람의 정보', '💞 Both of your birth details'],
    'gh.sub':   ['각자의 생년월일을 알려주세요', 'Enter each person’s birth details'],
    'gh.a':     ['첫 번째 사람', 'Person one'],
    'gh.b':     ['두 번째 사람', 'Person two'],
    'gh.go':    ['궁합 보기 💞', 'Read our match 💞'],
    'gh.score': ['궁합 점수', 'Match Score'],
    'gh.ilgan': ['일간 케미', 'Day-Master Chemistry'],
    'gh.branch': ['배우자궁 · 띠 인연', 'Spouse Seats & Zodiac Ties'],
    'gh.elem':  ['오행 주고받기', 'Elemental Give & Take'],
    'gh.overall': ['🌟 총평', '🌟 Overall'],
    'gh.good':  ['잘 맞는 점', 'Where You Click'],
    'gh.watch': ['조심할 점', 'Where to Be Gentle'],
    'gh.advice': ['더 좋아지는 법', 'How to Grow Closer'],
    'gh.of':    ['{a} ♥ {b}', '{a} ♥ {b}'],
    'gh.ilganOf': ['일간 {g}', 'Day master {g}'],
    'load.gh':  ['AI가 두 사주의 궁합을 깊이 읽고 있어요…', 'The AI is reading your two charts together…'],
    'h.gh':     ['{a} ♥ {b} 궁합', '{a} ♥ {b} match'],
    'gh.alert.date': ['두 사람의 생년월일을 모두 입력해주세요!', 'Please enter both birth dates!'],

    'ghr.ganhe': ['두 사람의 일간이 천간합(合)을 이루는, 사주에서 손꼽는 귀한 인연이에요. 서로에게 끌리는 이유가 명식에 새겨져 있네요.',
      'Your day masters form a Heavenly Stem union (合) — one of the classic marks of a fated pair. The pull between you is written into the charts.'],
    'ghr.비겁': ['{a}와 {b}는 서로 닮은 기운을 지닌, 친구 같은 인연이에요. 통하는 게 많은 만큼 양보의 미덕이 관계를 더 단단하게 해줘요.',
      '{a} and {b} carry kindred energies — like best friends. You understand each other easily; a little yielding makes it rock solid.'],
    'ghr.식상': ['{a}의 기운이 {b}를 북돋아 살리는 흐름이에요. {a}의 표현과 아이디어가 {b}에게 생기를 불어넣어요.',
      '{a}’s energy feeds {b}’s spark — {a}’s words and ideas bring {b} to life.'],
    'ghr.재성': ['{a}가 {b}를 아끼고 책임지고 싶어 하는 구도예요. 챙겨주고 싶은 마음이 자연스럽게 흘러갑니다.',
      'The charts set {a} up to cherish and provide for {b}; the urge to take care flows naturally.'],
    'ghr.관성': ['{b}가 {a}에게 든든한 기준이 되어주는 구도예요. {a}는 {b} 곁에서 더 좋은 사람이 되고 싶어져요.',
      '{b} gives {a} structure and steadiness; around {b}, {a} wants to be their best self.'],
    'ghr.인성': ['{b}가 {a}를 품고 길러주는 흐름이에요. 곁에 있으면 이상하게 마음이 놓이는 이유가 여기 있어요.',
      '{b} nourishes and shelters {a} — this is why being together simply feels safe.'],

    'ghb.d.liuhe': ['두 사람의 배우자궁(일지)이 육합(六合)으로 꼭 맞물려 있어요. 함께 있을 때 가장 편안해지는 조합이에요.',
      'Your spouse seats lock together in a Six Harmony (六合) — the kind of pair most at ease side by side.'],
    'ghb.d.sanhe': ['배우자궁이 삼합(三合)의 같은 팀이에요. 자연스럽게 같은 방향을 바라보게 되는 인연이에요.',
      'Your spouse seats belong to the same Triple Harmony (三合) team — you naturally end up facing the same way.'],
    'ghb.d.same': ['배우자궁이 같은 글자예요. 서로의 속마음을 거울처럼 알아보는 인연이에요.',
      'Your spouse seats share the same branch — you read each other like mirrors.'],
    'ghb.d.chong': ['배우자궁이 충(沖)으로 마주 서 있어요. 불꽃이 튀어 지루할 틈이 없지만, 부딪힌 날엔 한 템포 쉬어가는 지혜가 필요해요.',
      'Your spouse seats stand in a Clash (沖) — sparks fly and it’s never boring, but on rough days give it one beat before reacting.'],
    'ghb.d.none': ['배우자궁은 특별한 합도 충도 없는 담백한 사이예요. 꾸준함이 이 조합의 힘이 됩니다.',
      'Your spouse seats are plain and steady — no dramatic bond or clash. Consistency is this pair’s superpower.'],
    'ghb.y.good': ['띠 인연도 합(合)을 이루고 있어요 — 어른들이 봐도 고개를 끄덕일 조합이에요.',
      'Even your zodiac years harmonize — the kind of match elders nod at.'],
    'ghb.y.chong': ['띠끼리는 충이라 첫인상이 강렬했을 수 있어요. 오래 볼수록 진가가 드러나는 조합이에요.',
      'Your zodiac years clash — first impressions may have run hot; this pair grows better with time.'],
    'ghb.y.none': ['띠 인연은 무난하게 흘러가는 편이에요.', 'Your zodiac tie runs easygoing.'],

    'ghe.fill': ['{b}가 {a}에게 부족한 {el} 기운을 채워줘요', '{b} fills the {el} energy {a} lacks'],
    'ghe.none': ['서로의 오행이 비슷한 결이라, 부족한 기운은 함께 채워가면 돼요.',
      'Your five-element mixes run on similar lines — you can build the missing energies together.'],
    'ghy.comp': ['한 사람은 양(陽), 한 사람은 음(陰)의 기운이 강해 서로의 온도를 맞춰주는 조합이에요.',
      'One of you runs yang-bright, the other yin-deep — you balance each other’s temperature.'],
    'ghy.same': ['둘 다 비슷한 극의 기운이 강해 리듬이 잘 맞아요. 가끔은 서로의 브레이크가 되어주세요.',
      'You both run on the same current — great rhythm; just take turns being the brakes.'],
    'ghy.bal': ['음양이 고르게 어우러진 안정적인 조합이에요.', 'Your yin-yang mix is balanced and stable.'],

    'ghs.90': ['사주가 먼저 알아본 인연이에요. 명식 곳곳이 서로를 향해 맞물려 있어요.',
      'The charts recognized each other before you did — interlocking at every turn.'],
    'ghs.80': ['손꼽히게 좋은 조합이에요. 서로의 기운이 애쓰지 않아도 힘을 보태줍니다.',
      'A standout match — your energies lend each other strength without trying.'],
    'ghs.70': ['탄탄하게 잘 맞는 궁합이에요. 서로 다른 점은 관계를 넓혀주는 재료가 돼요.',
      'A solidly good match — your differences become material for growth.'],
    'ghs.60': ['서로 다른 색이 만나 하나의 그림을 완성하는 궁합이에요. 노력한 만큼 정직하게 깊어집니다.',
      'Two different colors completing one picture — this bond deepens honestly with effort.'],
    'ghg.none': ['무난하고 편안한 흐름 자체가 이 조합의 미덕이에요.', 'The easy, steady flow itself is this pair’s virtue.'],
    'ghgl.ganhe': ['일간 천간합(合)', 'Day-stem union (合)'],
    'ghgl.dliuhe': ['배우자궁 육합', 'Spouse-seat six harmony'],
    'ghgl.dsanhe': ['배우자궁 삼합', 'Spouse-seat triple harmony'],
    'ghgl.dsame': ['같은 배우자궁', 'Matching spouse seats'],
    'ghgl.ygood': ['띠 합', 'Zodiac harmony'],
    'ghgl.fill': ['오행 보완 {n}가지', '{n} elemental complement(s)'],
    'ghgl.yy': ['음양 보완', 'Yin-yang balance'],
    'ghwl.dchong': ['배우자궁 충 — 다툰 날엔 한 박자 쉬어가기', 'Spouse-seat clash — pause a beat on rough days'],
    'ghwl.ychong': ['띠 충 — 시간이 편이 되어주는 조합', 'Zodiac clash — time is on your side'],
    'ghwl.yysame': ['같은 극의 기운 — 번갈아 브레이크 되어주기', 'Same-pole energy — take turns being the brakes'],
    'ghw.none': ['크게 부딪히는 지점이 없는 편안한 명식이에요.', 'No major friction points — an easy pair of charts.'],
    'gha.static': ['서로의 다른 기운은 고치려 하기보다 빌려 쓰세요. 매일의 안부와 작은 고마움 인사가 좋은 합을 현실로 만듭니다.',
      'Borrow each other’s different energies instead of fixing them. Daily check-ins and small thank-yous turn a good chart into a good life.'],

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
    't.fanhint':  ['좌우로 쓸어 부채를 돌리고, 마음이 가는 카드를 눌러보세요', 'Swipe to spin the fan, then tap a card that calls to you'],
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
    't.overall': ['🌟 총평', '🌟 Overall'],
    'ov.base': ['이번 {sp} 리딩을 종합해 보면 — {major} {rev} 카드가 남긴 장면들을 천천히 되짚어 보면, 지금 마음이 어디로 향하는지 조금 더 선명해질 거예요.',
      'Looking at this {sp} reading as a whole — {major} {rev} Sit with the scenes the cards left behind, and where your heart wants to go will come into focus.'],
    'ov.major.many': ['메이저 카드가 여러 장 나와 인생의 큰 흐름이 움직이는 시기임을 보여줘요.', 'Several Major Arcana appeared — a sign that life’s bigger currents are on the move.'],
    'ov.major.some': ['메이저 카드가 함께 나와 중요한 메시지에 힘이 실려 있어요.', 'A Major Arcana card adds weight to the message.'],
    'ov.major.none': ['메이저 카드 없이 흘러가, 일상의 작은 선택들이 열쇠가 되는 시기예요.', 'With no Major Arcana, small everyday choices hold the key right now.'],
    'ov.rev.none': ['역방향 카드가 없어 에너지가 순하게 흐르고 있어요.', 'No reversed cards — the energy is flowing gently.'],
    'ov.rev.some': ['역방향 카드는 그 자리를 조금 더 섬세하게 살펴보라는 힌트예요.', 'The reversed card is a hint to look at that spot more tenderly.'],
    'ov.rev.many': ['역방향이 많아 잠시 멈춰 돌아보라는 신호가 함께 왔어요.', 'Many reversals came together — a sign to pause and look back for a moment.'],

    'h.title': ['🕘 지난 기록', '🕘 Past readings'],
    'h.sub':   ['최근 30개가 두 사람의 기기에서 함께 보여요', 'The last 30 readings are shared between your devices'],
    'h.sync':  ['공유 기록 불러오는 중…', 'Loading shared records…'],
    'h.del.confirm': ['이 기록을 삭제할까요?', 'Delete this reading?'],
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
  const VIEWS = ['v-select', 'v-saju-input', 'v-saju-result', 'v-gh-input', 'v-gh-result', 'v-tarot-topic', 'v-tarot-spread', 'v-tarot-table', 'v-history'];
  const BACK_MAP = {
    'v-select': null,
    'v-saju-input': 'v-select',
    'v-saju-result': 'v-saju-input',
    'v-gh-input': 'v-select',
    'v-gh-result': 'v-gh-input',
    'v-tarot-topic': 'v-select',
    'v-tarot-spread': 'v-tarot-topic',
    'v-tarot-table': 'v-tarot-spread',
    'v-history': 'v-select',
  };
  const TITLES = {
    'v-select': 'title.fortune',
    'v-saju-input': 'title.saju',
    'v-saju-result': 'title.saju',
    'v-gh-input': 'title.gh',
    'v-gh-result': 'title.gh',
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
    if (currentView === 'v-gh-result' && lastGhEntry) await renderGhResult(lastGhEntry);
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

  /* ═══════════ LLM integration (AWS Lambda proxy) ═══════════
     Deployed via API Gateway → Lambda "fortune-llm-proxy" (ap-northeast-2),
     see lambda/README.md. Receives { kind: 'saju'|'tarot', payload } and
     returns BOTH languages at once — { sections: {ko,en} } (saju) /
     { text: {ko,en} } (tarot) — which are stored on the history entry so
     switching KR/EN never re-calls the API. On any failure the static JSON
     templates below are used as-is, so the page always works. */
  const LLM_ENDPOINT = 'https://bzgjaonngg.execute-api.ap-northeast-2.amazonaws.com/';

  async function llmReading(kind, payload) {
    if (!LLM_ENDPOINT) return null;
    try {
      const r = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      if (!r.ok) return null;
      return await r.json(); // { text: {ko,en} } for tarot, { sections: {ko,en} } for saju
    } catch { return null; }
  }

  /* dedup concurrent LLM fetches (e.g. a language toggle while one is
     already in flight) — keyed by the entry/pick object identity */
  const llmPending = new Map();
  function llmOnce(key, fn) {
    if (!llmPending.has(key)) {
      llmPending.set(key, fn().finally(() => llmPending.delete(key)));
    }
    return llmPending.get(key);
  }

  /* full-screen "AI is thinking" overlay, shown while a reading waits on
     the proxy; always paired with a timeout race so a hung request can
     never trap the user on the overlay */
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const AI_WAIT_MS = 30000;
  function showAiOverlay(key) {
    $('aiOverlayMsg').textContent = t(key);
    $('aiOverlaySub').textContent = t('load.sub');
    $('aiOverlay').style.display = 'flex';
  }
  function hideAiOverlay() { $('aiOverlay').style.display = 'none'; }
  async function waitAi(key, promise) {
    if (!LLM_ENDPOINT) return;
    showAiOverlay(key);
    try { await Promise.race([promise, delay(AI_WAIT_MS)]); } catch {}
    hideAiOverlay();
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

  /* ═══════════ history — shared via DynamoDB, localStorage as cache ═══════════
     Every entry is pushed to the Lambda history API so BOTH devices see the
     same records (AI text included, so the other device replays without any
     API calls). localStorage keeps working as an offline cache: entries that
     fail to push are flagged _local and re-pushed on the next list sync. */
  const HKEY = 'fortune_history_v1';
  const SYNC_SPACE = 'hj-a8f3kx92-v1';

  function histList() {
    try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; }
  }
  function histWrite(list) {
    try { localStorage.setItem(HKEY, JSON.stringify(list)); } catch {}
  }

  async function histApi(kind, payload) {
    if (!LLM_ENDPOINT) return null;
    try {
      const r = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload: { space: SYNC_SPACE, ...payload } }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  function histPush(entry) {
    const { _local, ...clean } = entry;
    return histApi('hist_put', { entry: clean }).then(r => {
      if (r && r.ok && entry._local) {
        delete entry._local;
        const list = histList();
        const i = list.findIndex(e => e.ts === entry.ts && e.type === entry.type);
        if (i >= 0) { delete list[i]._local; histWrite(list); }
      }
      return r && r.ok;
    });
  }

  function histSave(entry) {
    entry._local = true; // cleared once the server accepts it
    const list = histList();
    list.unshift(entry);
    if (list.length > 30) list.length = 30;
    histWrite(list);
    histPush(entry);
  }

  /* re-persist an entry after it gained AI text (matched by timestamp+type) */
  function histUpdate(entry) {
    const list = histList();
    const i = list.findIndex(e => e.ts === entry.ts && e.type === entry.type);
    if (i >= 0) { list[i] = entry; histWrite(list); }
    histPush(entry);
  }

  /* ── history deletion disabled (kept for later) ──
  function histDelete(entry) {
    histWrite(histList().filter(e => !(e.ts === entry.ts && e.type === entry.type)));
    histApi('hist_delete', { ts: entry.ts });
  }
  */

  /* one-time migration: records saved before sharing existed carry no
     _local flag — mark them all so the next sync pushes them to the store */
  if (!localStorage.getItem('fortune_hist_migrated_v1')) {
    const list = histList();
    if (list.length) { list.forEach(e => { e._local = true; }); histWrite(list); }
    localStorage.setItem('fortune_hist_migrated_v1', '1');
  }

  /* pull the shared list; local-only entries are kept (and re-pushed) */
  async function histSync() {
    const body = await histApi('hist_list', {});
    if (!body || !Array.isArray(body.items)) return null;
    const locals = histList().filter(e => e._local);
    locals.forEach(e => { histPush(e); });
    const merged = locals
      .filter(l => !body.items.some(s => s.ts === l.ts && s.type === l.type))
      .concat(body.items)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30);
    histWrite(merged);
    return merged;
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

  const GAN_LIST = '甲乙丙丁戊己庚辛壬癸';
  const ZHI_LIST = '子丑寅卯辰巳午未申酉戌亥';
  const YANG_GAN = '甲丙戊庚壬';
  const YANG_ZHI = '子寅辰午申戌';
  // five-element cycles: SHENG[x] = what x generates, KE[x] = what x controls
  const SHENG = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const KE = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };

  // ten-gods style relation of another element to the day master's element
  function relationOf(dayEl, otherEl) {
    if (otherEl === dayEl) return '비겁';
    if (SHENG[otherEl] === dayEl) return '인성';
    if (SHENG[dayEl] === otherEl) return '식상';
    if (KE[otherEl] === dayEl) return '관성';
    return '재성'; // KE[dayEl] === otherEl
  }

  function countYinYang(pillars) {
    let yang = 0, yin = 0;
    ['year', 'month', 'day', 'time'].forEach(k => {
      const p = pillars[k];
      if (!p) return;
      YANG_GAN.includes(p[0]) ? yang++ : yin++;
      YANG_ZHI.includes(p[1]) ? yang++ : yin++;
    });
    return { yang, yin };
  }

  /* approximate current year/month gan-zhi (arithmetic; year switches around
     ipchun Feb 4, month branches follow solar months — close enough for a
     light fortune reading) */
  function currentGanZhi() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    let yy = y;
    if (m < 2 || (m === 2 && d < 4)) yy = y - 1;
    const yearGZ = GAN_LIST[(yy - 4) % 10] + ZHI_LIST[(yy - 4) % 12];
    const FIRST_MONTH_STEM = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
    const offset = m >= 2 ? m - 2 : m + 10;
    const stemIdx = (FIRST_MONTH_STEM[(yy - 4) % 10] + offset) % 10;
    const monthGZ = GAN_LIST[stemIdx] + ZHI_LIST[m % 12];
    return { yearGZ, monthGZ };
  }

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
        if (segEl.id === 'ghCalA' || segEl.id === 'ghCalB') {
          $('ghLeapRow' + segEl.id.slice(-1)).style.display = b.dataset.v === 'lunar' ? 'flex' : 'none';
        }
      });
    });
  }
  segInit($('calSeg'));
  segInit($('genderSeg'));
  segInit($('countrySeg'));
  segInit($('modeSeg'));
  ['ghCountryA', 'ghCalA', 'ghGenderA', 'ghCountryB', 'ghCalB', 'ghGenderB'].forEach(id => segInit($(id)));

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
      else if (b.dataset.go === 'gh') { ghPrefill(); show('v-gh-input'); ensureLunar().catch(() => {}); }
      else show('v-tarot-topic');
    });
  });

  let lastSajuEntry = null;

  $('sjGo').addEventListener('click', async () => {
    const dateStr = $('sjDate').value;
    if (!dateStr) { alert(t('alert.date')); return; }
    const [y, m, d] = dateStr.split('-').map(Number);
    const mode = segVal($('modeSeg'));
    const tm = $('sjTime').value;
    // Never block on a missing time: empty time (or "don't know") simply
    // switches the reading to three pillars automatically.
    const hasTime = mode === 'four' && !$('sjNoTime').checked && !!tm;
    let hh = 12, mi = 0;
    if (hasTime) [hh, mi] = tm.split(':').map(Number);
    const input = {
      cal: segVal($('calSeg')),
      leap: $('sjLeap').checked,
      country: segVal($('countrySeg')),
      gender: segVal($('genderSeg')),
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
        gender: input.gender,
        in: input,
        pillars: saju.pillars,
        daeun: saju.daeun,
      };
      histSave(entry);
      lastSajuEntry = entry;
      const reading = await renderSajuResult(entry);
      // hold on a loading screen until the AI reading lands (or times out)
      if (!entry.ai) await waitAi('load.saju', reading.aiPromise);
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

    // 10-year luck cycles — direction depends on gender, so only when selected
    let daeun = null;
    if (input.gender === 'M' || input.gender === 'F') {
      try {
        const yun = ec.getYun(input.gender === 'M' ? 1 : 0);
        daeun = yun.getDaYun()
          .filter(dy => dy.getGanZhi())
          .slice(0, 8)
          .map(dy => ({ a: dy.getStartAge(), gz: dy.getGanZhi() }));
      } catch (e) { daeun = null; }
    }

    return {
      pillars: {
        year: ec.getYear(),
        month: ec.getMonth(),
        day: ec.getDay(),
        time: input.hasTime ? ec.getTime() : null,
      },
      daeun,
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

    const T = en || data; // localized text source for the new sections
    const dayEl = GAN_EL[dayGan];

    // yin-yang balance
    const yy = countYinYang(pillars);
    const yyText = yy.yang - yy.yin >= 2 ? T.yinyang.yang
      : yy.yin - yy.yang >= 2 ? T.yinyang.yin : T.yinyang.balanced;

    // wealth: the element the day master controls
    const wealthEl = KE[dayEl];
    const wc = counts[wealthEl];
    const wealthKey = wc === 0 ? 'none' : wc >= 3 ? 'many' : 'some';
    const wealthText = T.wealth[wealthKey].replace('{el}', elName(wealthEl));

    // love: relation of the spouse seat (day branch) to the day master
    const dayZhi = pillars.day[1];
    const loveRel = relationOf(dayEl, ZHI_EL[dayZhi]);
    const supportEl = Object.keys(SHENG).find(x => SHENG[x] === dayEl);
    const loveText = T.love[loveRel] + ' ' + T.loveCompat.replace('{el}', elName(supportEl));

    // yearly / monthly flow
    const { yearGZ, monthGZ } = currentGanZhi();
    const gzLabel = (gz) => `${gz}(${pillarReading(gz[0], gz[1])})`;
    const yearText = tf2('f.yearFmt', { gz: gzLabel(yearGZ), t: T.flow[relationOf(dayEl, GAN_EL[yearGZ[0]])] });
    const monthText = tf2('f.monthFmt', { gz: gzLabel(monthGZ), t: T.flow[relationOf(dayEl, GAN_EL[monthGZ[0]])] });

    // detailed AI reading when a backend is configured (no-op otherwise);
    // fetched once — WITHOUT blocking the static render — with BOTH languages
    // at once, then stored on the history entry so a KR/EN toggle just
    // re-reads entry.ai without another API call. The five sections are
    // requested as parallel single-section calls because API Gateway caps
    // each request at 30s — one big call doesn't fit, five small ones do.
    let aiPromise = Promise.resolve();
    if (!entry.ai) {
      const basePayload = {
        pillars, counts,
        yinYang: yy,
        daeun: entry.daeun || null,
        current: { yearGZ, monthGZ },
        name: entry.name || null,
        gender: entry.gender || null,
        birth: describeBirth(entry),
      };
      const SECTIONS = ['personality', 'wealth', 'love', 'forecast', 'overall'];
      aiPromise = llmOnce(entry, () => Promise.all(
        SECTIONS.map(s => llmReading('saju', { ...basePayload, sections: [s] }))
      )).then(parts => {
        const merged = { ko: {}, en: {} };
        let ok = 0;
        (parts || []).forEach(p => {
          const sec = p && p.sections;
          if (sec && sec.ko && sec.en) {
            Object.assign(merged.ko, sec.ko);
            Object.assign(merged.en, sec.en);
            ok++;
          }
        });
        if (ok === SECTIONS.length) { // store only complete readings
          entry.ai = merged;
          histUpdate(entry);
        }
      });
    }

    // overall: strongest / weakest element synthesis (static fallback)
    const sorted = [...EL_ORDER].sort((a, b) => counts[b] - counts[a]);
    const ilLabel = lang === 'ko' ? `${base.hanja}(${base.ko})` : `${GAN_ROMA[dayGan]} (${GAN_EN_DESC[dayGan]})`;
    const overallText = tf2('ov.saju', { il: ilLabel, strong: elName(sorted[0]), weak: elName(sorted[4]) });

    return {
      ilgan, counts, total, notes, aiPromise, overallText,
      yy, yyText,
      aptText: T.aptitude[dayGan],
      wealthText, loveText, yearText, monthText,
      colors: Object.fromEntries(EL_ORDER.map(el => [el, data.elements[el].color])),
      emojis: Object.fromEntries(EL_ORDER.map(el => [el, data.elements[el].emoji])),
      balanceNote: en ? en.balance.note : data.balance.note,
    };
  }

  function tf2(key, vars) {
    let s = t(key);
    Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  /* ═══════════ saju: result rendering ═══════════ */
  /* pentagon radar chart of the five-element distribution; EL_ORDER follows
     the generating cycle (목→화→토→금→수), so adjacent vertices feed each other */
  function radarSvg(reading) {
    const CX = 150, CY = 122, R = 80;
    const max = Math.max(3, ...EL_ORDER.map(el => reading.counts[el]));
    const pt = (i, r) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
    };
    const poly = (r) => EL_ORDER.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');
    const valPts = EL_ORDER.map((el, i) => pt(i, Math.max(reading.counts[el] / max, 0.07) * R));
    const rings = [2 / 3, 1 / 3].map(f => `<polygon class="radar-ring" points="${poly(R * f)}"/>`).join('');
    const spokes = EL_ORDER.map((_, i) => {
      const [x, y] = pt(i, R);
      return `<line class="radar-ring" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join('');
    const dots = valPts.map(([x, y], i) =>
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${reading.colors[EL_ORDER[i]]}" stroke="#fff" stroke-width="1.6"/>`).join('');
    const labels = EL_ORDER.map((el, i) => {
      const [x, y] = pt(i, R + 24);
      return `<text class="radar-label" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${reading.emojis[el]} ${elName(el)} <tspan fill="${reading.colors[el]}">${reading.counts[el]}</tspan></text>`;
    }).join('');
    return `<svg class="radar" viewBox="0 0 300 230" role="img">
      <polygon class="radar-bg" points="${poly(R)}"/>
      ${rings}${spokes}
      <g class="radar-value">
        <polygon points="${valPts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"/>
        ${dots}
      </g>
      ${labels}
    </svg>`;
  }

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

    $('sjrBars').innerHTML = radarSvg(reading);

    $('sjrNotes').innerHTML =
      reading.notes.map(n => `<div class="enote">${n}</div>`).join('') +
      `<div class="enote" style="opacity:0.75">${reading.balanceNote}</div>`;

    // yin-yang bar (counts shown inside each side when there's room)
    const yyTotal = reading.yy.yang + reading.yy.yin;
    const yangPct = yyTotal ? Math.round(reading.yy.yang / yyTotal * 100) : 50;
    $('sjrYinYang').innerHTML = `
      <div class="yy-row">
        <span class="yy-label">☀️ ${t('yy.yang')}</span>
        <span class="yy-track"><span class="yy-yang" style="width:${yangPct}%">${yangPct >= 14 ? reading.yy.yang : ''}</span><span class="yy-yin" style="width:${100 - yangPct}%">${100 - yangPct >= 14 ? reading.yy.yin : ''}</span></span>
        <span class="yy-label">${t('yy.yin')} 🌙</span>
      </div>
      <div class="enote" style="margin-top:6px">${reading.yyText}</div>`;

    // daeun (10-year luck cycles)
    if (entry.daeun && entry.daeun.length) {
      const nowYear = new Date().getFullYear();
      const birthYear = entry.in ? entry.in.y : nowYear;
      const age = nowYear - birthYear + 1; // traditional Korean counting
      $('sjrDaeun').innerHTML = `
        <div class="daeun-scroll"><div class="daeun-row">
          ${entry.daeun.map(du => {
            const isNow = age >= du.a && age < du.a + 10;
            return `<div class="daeun-chip${isNow ? ' now' : ''}">
              <div class="da">${isNow ? t('d.now') + ' · ' : ''}${tf2('d.ageFmt', { n: du.a })}</div>
              <div class="dgz">${du.gz}</div>
              <div class="dko">${pillarReading(du.gz[0], du.gz[1])}</div>
            </div>`;
          }).join('')}
        </div></div>
        <div class="daeun-note">${t('d.note.approx')}</div>`;
    } else {
      $('sjrDaeun').innerHTML = `<div class="daeun-note">${t('d.note.gender')}</div>`;
    }

    // interpretation sections (static now, AI detail patched in when it arrives)
    const aiNote = (s) => s ? `<div class="enote ai">${s}</div>` : '';
    const applyAi = () => {
      const ai = entry.ai ? entry.ai[lang] || {} : {};
      $('sjrPersona').innerHTML = reading.aptText + aiNote(ai.personality);
      $('sjrWealth').innerHTML = reading.wealthText + aiNote(ai.wealth);
      $('sjrLove').innerHTML = reading.loveText + aiNote(ai.love);
      $('sjrForecast').innerHTML =
        `<div>${reading.yearText}</div><div style="margin-top:8px">${reading.monthText}</div>` + aiNote(ai.forecast);
      $('sjrOverall').innerHTML = reading.overallText + aiNote(ai.overall);
    };
    applyAi();
    const status = $('sjrAiStatus');
    if (!entry.ai && LLM_ENDPOINT) {
      status.textContent = t('ai.loading');
      status.style.display = 'block';
      reading.aiPromise.then(() => {
        if (lastSajuEntry !== entry) return; // a different chart took over
        status.style.display = 'none';
        applyAi();
      });
    } else {
      status.style.display = 'none';
    }
    return reading;
  }

  $('sjrAgain').addEventListener('click', () => { backOverride = null; show('v-saju-input'); });
  $('sjrHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ compatibility (gunghap) ═══════════ */
  // heavenly-stem unions (천간합) and branch relations (육합/충/삼합)
  const GANHE = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
  const LIUHE = { '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午' };
  const CHONG = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
  const sanheGroup = (z) => ['申子辰', '亥卯未', '寅午戌', '巳酉丑'].find(g => g.includes(z)) || null;

  let lastGhEntry = null;
  const GH_INPUTS_KEY = 'gh_inputs_v1';

  const setSeg = (segEl, v) => segEl.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === v));

  function ghPrefill() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(GH_INPUTS_KEY)); } catch {}
    if (!saved) return;
    ['A', 'B'].forEach(s => {
      const p = saved[s];
      if (!p) return;
      $('ghName' + s).value = p.name || '';
      $('ghDate' + s).value = p.date || '';
      $('ghTime' + s).value = p.time || '12:00';
      $('ghNoTime' + s).checked = !!p.noTime;
      $('ghLeap' + s).checked = !!p.leap;
      setSeg($('ghCountry' + s), p.country || 'KR');
      setSeg($('ghCal' + s), p.cal || 'solar');
      setSeg($('ghGender' + s), p.gender || '');
      $('ghLeapRow' + s).style.display = p.cal === 'lunar' ? 'flex' : 'none';
    });
  }
  function ghSaveInputs() {
    const grab = (s) => ({
      name: $('ghName' + s).value.trim(),
      date: $('ghDate' + s).value,
      time: $('ghTime' + s).value,
      noTime: $('ghNoTime' + s).checked,
      leap: $('ghLeap' + s).checked,
      country: segVal($('ghCountry' + s)),
      cal: segVal($('ghCal' + s)),
      gender: segVal($('ghGender' + s)),
    });
    try { localStorage.setItem(GH_INPUTS_KEY, JSON.stringify({ A: grab('A'), B: grab('B') })); } catch {}
  }

  function readGhPerson(s) {
    const dateStr = $('ghDate' + s).value;
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    const tm = $('ghTime' + s).value;
    const hasTime = !$('ghNoTime' + s).checked && !!tm;
    let hh = 12, mi = 0;
    if (hasTime) [hh, mi] = tm.split(':').map(Number);
    return {
      dateStr,
      name: $('ghName' + s).value.trim() || (s === 'A' ? 'A' : 'B'),
      input: {
        cal: segVal($('ghCal' + s)), leap: $('ghLeap' + s).checked,
        country: segVal($('ghCountry' + s)), gender: segVal($('ghGender' + s)),
        y, m, d, hasTime, hh, mi,
      },
    };
  }

  function ghAnalyze(a, b) {
    const gA = a.pillars.day[0], gB = b.pillars.day[0];
    const elA = GAN_EL[gA], elB = GAN_EL[gB];
    const ganhe = GANHE[gA] === gB;
    const dayRel = relationOf(elA, elB); // what B is to A in ten-gods terms
    const branchRel = (x, y) => x === y ? 'same'
      : LIUHE[x] === y ? 'liuhe'
      : CHONG[x] === y ? 'chong'
      : sanheGroup(x) && sanheGroup(x) === sanheGroup(y) ? 'sanhe' : 'none';
    const dayBranch = branchRel(a.pillars.day[1], b.pillars.day[1]);
    const yearBranch = branchRel(a.pillars.year[1], b.pillars.year[1]);
    const cA = countElements(a.pillars), cB = countElements(b.pillars);
    const fillsAB = EL_ORDER.filter(el => cA[el] === 0 && cB[el] >= 2); // b fills a's lack
    const fillsBA = EL_ORDER.filter(el => cB[el] === 0 && cA[el] >= 2);
    const yyA = countYinYang(a.pillars), yyB = countYinYang(b.pillars);
    const dominant = (yy) => yy.yang - yy.yin >= 2 ? 'yang' : yy.yin - yy.yang >= 2 ? 'yin' : 'bal';
    const dA = dominant(yyA), dB = dominant(yyB);
    const yyKind = dA !== 'bal' && dB !== 'bal' ? (dA !== dB ? 'comp' : 'same') : 'bal';

    let score = 60;
    if (ganhe) score += 12;
    score += { liuhe: 12, sanhe: 8, same: 4, chong: -8, none: 0 }[dayBranch];
    score += { liuhe: 4, sanhe: 4, same: 2, chong: -4, none: 0 }[yearBranch];
    score += Math.min(9, (fillsAB.length + fillsBA.length) * 3);
    score += yyKind === 'comp' ? 5 : yyKind === 'bal' ? 3 : 0;
    score += { '재성': 4, '관성': 4, '인성': 3, '식상': 3, '비겁': 2 }[dayRel];
    score = Math.max(58, Math.min(99, score));
    return { gA, gB, ganhe, dayRel, dayBranch, yearBranch, fillsAB, fillsBA, yyKind, score };
  }

  function ghChartHtml(p) {
    const defs = [['p.year', p.pillars.year], ['p.month', p.pillars.month], ['p.day', p.pillars.day], ['p.time', p.pillars.time]];
    const d = p.pillars.day[0];
    const gil = lang === 'ko' ? `${d}(${GAN_KO[d]}${GAN_EL[d]})` : `${d} (${GAN_EN_DESC[d]})`;
    return `<div class="gh-chart"><div class="gname">${p.name}</div><div class="gp">`
      + defs.map(([k]) => `<div class="lbl">${t(k)}</div>`).join('')
      + defs.map(([, v]) => v ? `<div>${v[0]}<br>${v[1]}</div>` : `<div style="opacity:0.4">–<br>–</div>`).join('')
      + `</div><div class="gil">${tf2('gh.ilganOf', { g: gil })}</div></div>`;
  }

  async function renderGhResult(entry) {
    lastGhEntry = entry;
    const A = entry.a, B = entry.b;
    const an = ghAnalyze(A, B);
    const nm = { a: A.name, b: B.name };

    $('ghrTitle').textContent = tf2('gh.of', nm);
    $('ghrSub').innerHTML = `${describeBirth(A)}<br>${describeBirth(B)}`;
    $('ghrCharts').innerHTML = ghChartHtml(A) + ghChartHtml(B);
    $('ghrScore').textContent = an.score + '%';
    $('ghrHearts').textContent = '💗'.repeat(Math.max(1, Math.round(an.score / 20)));

    // day-master chemistry
    const gilLine = `<b>${A.name} ${an.gA}(${lang === 'ko' ? GAN_KO[an.gA] + GAN_EL[an.gA] : GAN_EN_DESC[an.gA]})`
      + ` · ${B.name} ${an.gB}(${lang === 'ko' ? GAN_KO[an.gB] + GAN_EL[an.gB] : GAN_EN_DESC[an.gB]})</b>`;
    $('ghrIlgan').innerHTML = `<div>${gilLine}</div>`
      + (an.ganhe ? `<div class="enote">${t('ghr.ganhe')}</div>` : '')
      + `<div style="margin-top:8px">${tf2('ghr.' + an.dayRel, nm)}</div>`;

    // spouse seats & zodiac
    $('ghrBranch').innerHTML = `<div>${t('ghb.d.' + an.dayBranch)}</div>`
      + `<div style="margin-top:8px">${t(an.yearBranch === 'chong' ? 'ghb.y.chong' : an.yearBranch === 'none' ? 'ghb.y.none' : 'ghb.y.good')}</div>`;

    // elemental give & take
    const fills = an.fillsAB.map(el => tf2('ghe.fill', { a: A.name, b: B.name, el: elName(el) }))
      .concat(an.fillsBA.map(el => tf2('ghe.fill', { a: B.name, b: A.name, el: elName(el) })));
    $('ghrElem').innerHTML = (fills.length ? fills.map(x => `<div>💫 ${x}</div>`).join('') : `<div>${t('ghe.none')}</div>`)
      + `<div style="margin-top:8px">${t('ghy.' + (an.yyKind === 'comp' ? 'comp' : an.yyKind === 'same' ? 'same' : 'bal'))}</div>`;

    // AI reading — same non-blocking, both-languages, cached-on-entry
    // pattern as saju; sections fetched as parallel single-section calls
    let aiPromise = Promise.resolve();
    if (!entry.ai) {
      const payloadBase = {
        a: { name: A.name, gender: A.gender || null, birth: describeBirth(A), pillars: A.pillars },
        b: { name: B.name, gender: B.gender || null, birth: describeBirth(B), pillars: B.pillars },
        rel: {
          ganhe: an.ganhe, dayRel: an.dayRel, dayBranch: an.dayBranch, yearBranch: an.yearBranch,
          fillsAB: an.fillsAB, fillsBA: an.fillsBA, yy: an.yyKind, score: an.score,
        },
      };
      const SECS = ['overall', 'good', 'watch', 'advice'];
      aiPromise = llmOnce(entry, () => Promise.all(
        SECS.map(sec => llmReading('gunghap', { ...payloadBase, sections: [sec] }))
      )).then(parts => {
        const merged = { ko: {}, en: {} };
        let ok = 0;
        (parts || []).forEach(p => {
          const sec = p && p.sections;
          if (sec && sec.ko && sec.en) { Object.assign(merged.ko, sec.ko); Object.assign(merged.en, sec.en); ok++; }
        });
        if (ok === SECS.length) { entry.ai = merged; histUpdate(entry); }
      });
    }

    const band = an.score >= 90 ? '90' : an.score >= 80 ? '80' : an.score >= 70 ? '70' : '60';
    const goods = [];
    if (an.ganhe) goods.push(t('ghgl.ganhe'));
    if (an.dayBranch === 'liuhe') goods.push(t('ghgl.dliuhe'));
    if (an.dayBranch === 'sanhe') goods.push(t('ghgl.dsanhe'));
    if (an.dayBranch === 'same') goods.push(t('ghgl.dsame'));
    if (an.yearBranch === 'liuhe' || an.yearBranch === 'sanhe') goods.push(t('ghgl.ygood'));
    const nFills = an.fillsAB.length + an.fillsBA.length;
    if (nFills) goods.push(tf2('ghgl.fill', { n: nFills }));
    if (an.yyKind === 'comp') goods.push(t('ghgl.yy'));
    const watches = [];
    if (an.dayBranch === 'chong') watches.push(t('ghwl.dchong'));
    if (an.yearBranch === 'chong') watches.push(t('ghwl.ychong'));
    if (an.yyKind === 'same') watches.push(t('ghwl.yysame'));

    const aiNote = (s) => s ? `<div class="enote ai">${s}</div>` : '';
    const applyAi = () => {
      const ai = entry.ai ? entry.ai[lang] || {} : {};
      $('ghrOverall').innerHTML = t('ghs.' + band) + aiNote(ai.overall);
      $('ghrGood').innerHTML = (goods.length ? `✨ ${goods.join(' · ')}` : t('ghg.none')) + aiNote(ai.good);
      $('ghrWatch').innerHTML = (watches.length ? watches.map(x => `<div>⚠️ ${x}</div>`).join('') : t('ghw.none')) + aiNote(ai.watch);
      $('ghrAdvice').innerHTML = t('gha.static') + aiNote(ai.advice);
    };
    applyAi();
    const status = $('ghrAiStatus');
    if (!entry.ai && LLM_ENDPOINT) {
      status.textContent = t('ai.loading');
      status.style.display = 'block';
      aiPromise.then(() => {
        if (lastGhEntry !== entry) return;
        status.style.display = 'none';
        applyAi();
      });
    } else {
      status.style.display = 'none';
    }
    return { aiPromise };
  }

  $('ghGo').addEventListener('click', async () => {
    const A = readGhPerson('A'), B = readGhPerson('B');
    if (!A.dateStr || !B.dateStr) { alert(t('gh.alert.date')); return; }
    $('ghGo').disabled = true;
    $('ghLoading').style.display = 'block';
    try {
      await ensureLunar();
      const sa = computeSaju(A.input);
      const sb = computeSaju(B.input);
      const entry = {
        type: 'gunghap', ts: Date.now(),
        a: { name: A.name, gender: A.input.gender, in: A.input, pillars: sa.pillars },
        b: { name: B.name, gender: B.input.gender, in: B.input, pillars: sb.pillars },
      };
      histSave(entry);
      ghSaveInputs();
      const reading = await renderGhResult(entry);
      if (!entry.ai) await waitAi('load.gh', reading.aiPromise);
      backOverride = null;
      show('v-gh-result');
    } catch (e) {
      alert(t('alert.fail'));
    } finally {
      $('ghGo').disabled = false;
      $('ghLoading').style.display = 'none';
    }
  });

  $('ghrAgain').addEventListener('click', () => { backOverride = null; show('v-gh-input'); });
  $('ghrHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

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

  const tstate = { topic: null, spread: null, deck: [], picks: [], revealed: 0, replay: false, ts: null, histEntry: null, overall: null };
  let candidate = null;
  /* bumped every time #readings is cleared; in-flight appendReading calls
     from an older render (e.g. rapid language toggles) abort instead of
     appending duplicates into the freshly cleared list */
  let readingsGen = 0;

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
    tstate.histEntry = null;
    tstate.overall = null;
    tstate.picks = [];
    tstate.revealed = 0;
    candidate = null;
    show('v-tarot-table');
    $('shuffleBox').style.display = 'block';
    $('pickBox').style.display = 'none';
    $('revealBox').style.display = 'none';
    $('readings').innerHTML = '';
    readingsGen++;
    $('tarotOverallCard').style.display = 'none';
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
    fan.innerHTML = '<div class="fan-wheel" id="fanWheel"></div>';
    const wheel = $('fanWheel');
    setFanRot(0);
    const n = 78;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'fcard cback';
      const ang = -FAN_MAX + (FAN_MAX * 2 / (n - 1)) * i;
      c.style.transform = `rotate(${ang}deg) translateY(-${FAN_R}px)`;
      c.dataset.i = i;
      wheel.appendChild(c);
    }
  }

  /* the fan is a rotating WHEEL: a horizontal swipe rolls the whole arc
     around its pivot (with a little inertia), so every card can be brought
     to the comfortable center instead of scrolling a wide strip. A short
     tap (no real movement) picks a card: the tap point is mapped by ANGLE
     from the pivot — minus the current wheel rotation — to the nearest
     available card, so the thin sliver cards are as easy to hit as the
     wide middle ones (taps beyond the arc snap to the outermost card).

     two-step picking: the tapped card lifts OUT of the fan into the
     upright preview slot at the top (its empty spot stays visible in the
     fan); tapping the preview card confirms, tapping another fan card swaps */
  const FAN_R = 420, FAN_MAX = 62, FAN_PIVOT_Y = 590;
  const DEG_PER_PX = 180 / (Math.PI * FAN_R); // wheel degrees per pixel of drag
  let fanRot = 0;
  let fanDrag = null;
  let fanInertia = null;

  function setFanRot(v) {
    fanRot = Math.max(-FAN_MAX, Math.min(FAN_MAX, v));
    const w = $('fanWheel');
    if (w) w.style.transform = `rotate(${fanRot}deg)`;
  }

  $('fan').addEventListener('pointerdown', (e) => {
    if (!$('fanWheel')) return;
    cancelAnimationFrame(fanInertia);
    fanDrag = { x0: e.clientX, lastX: e.clientX, lastT: performance.now(), rot0: fanRot, moved: false, v: 0 };
    try { $('fan').setPointerCapture(e.pointerId); } catch {}
  });
  $('fan').addEventListener('pointermove', (e) => {
    if (!fanDrag) return;
    const dx = e.clientX - fanDrag.x0;
    if (Math.abs(dx) > 6) fanDrag.moved = true;
    if (!fanDrag.moved) return;
    const now = performance.now();
    const inst = (e.clientX - fanDrag.lastX) / Math.max(1, now - fanDrag.lastT); // px/ms
    fanDrag.v = fanDrag.v * 0.7 + inst * 0.3;
    fanDrag.lastX = e.clientX;
    fanDrag.lastT = now;
    setFanRot(fanDrag.rot0 + dx * DEG_PER_PX);
  });
  const endFanDrag = (e) => {
    if (!fanDrag) return;
    const drag = fanDrag;
    fanDrag = null;
    if (!drag.moved) { fanTapSelect(e); return; }
    // inertia: keep spinning in deg/ms, decaying until it fades or hits an end
    let v = drag.v * DEG_PER_PX;
    let prev = performance.now();
    const spin = (now) => {
      const dt = now - prev;
      prev = now;
      setFanRot(fanRot + v * dt);
      v *= Math.pow(0.94, dt / 16);
      if (Math.abs(v) > 0.002 && fanRot > -FAN_MAX && fanRot < FAN_MAX) {
        fanInertia = requestAnimationFrame(spin);
      }
    };
    fanInertia = requestAnimationFrame(spin);
  };
  $('fan').addEventListener('pointerup', endFanDrag);
  $('fan').addEventListener('pointercancel', () => { fanDrag = null; });

  function fanTapSelect(e) {
    if (!tstate.spread || $('pickBox').style.display !== 'block') return;
    if (tstate.picks.length >= NEED[tstate.spread]) return;
    const rect = $('fan').getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;   // pivot: (center, FAN_PIVOT_Y)
    const y = FAN_PIVOT_Y - (e.clientY - rect.top);
    const r = Math.hypot(x, y);
    if (r < FAN_R - 90 || r > FAN_R + 90) return;
    const deg = Math.max(-FAN_MAX, Math.min(FAN_MAX,
      Math.atan2(x, y) * 180 / Math.PI - fanRot));
    const idx = Math.round((deg + FAN_MAX) / (FAN_MAX * 2 / 77));
    const cards = $('fanWheel').children;
    for (let d = 0; d < 78; d++) {
      for (const j of [idx - d, idx + d]) {
        const el = cards[j];
        if (el && !el.classList.contains('gone') && !el.classList.contains('away')) {
          selectCandidate(el);
          return;
        }
      }
    }
  }

  function selectCandidate(el) {
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

  async function buildReveal() {
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

    // prefetch every AI reading in parallel now that the cards are fixed,
    // holding a loading screen so each reveal (and the overall note) is
    // instant instead of waiting on a live API call mid-flip
    const jobs = tstate.picks.map((pk, i) => fetchTarotAi(pk, i));
    jobs.push(fetchTarotOverall());
    if (tstate.picks.some(pk => !pk.ai) || !tstate.overall) {
      await waitAi('load.tarot', Promise.all(jobs));
    }
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
      await appendReading(i, readingsGen);
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
    // detailed AI reading when a backend is configured (no-op otherwise);
    // normally already prefetched in parallel right after the cards were
    // picked (see buildReveal), so this await is instant at reveal time
    await fetchTarotAi(pick, posIndex);
    result.llmText = pick.ai ? pick.ai[lang] || null : null;
    return result;
  }

  /* fetch the AI text for one pick — both languages at once, stored on the
     pick itself so KR/EN toggles and history replays never re-call the API */
  function fetchTarotAi(pick, posIndex) {
    if (pick.ai) return Promise.resolve();
    const card = dataCache['tarot'].cards[pick.id];
    return llmOnce(pick, () => llmReading('tarot', {
      card: { en: card.en, ko: card.ko, arcana: card.arcana, suit: card.suit, label: card.label },
      reversed: pick.rev,
      topic: tstate.topic, spread: tstate.spread,
      position: STR[POS_KEYS[tstate.spread][posIndex]][1],
    })).then(llmBody => {
      const txt = llmBody && llmBody.text;
      if (txt && txt.ko && txt.en) {
        pick.ai = txt;
        if (tstate.histEntry) histUpdate(tstate.histEntry);
      }
    });
  }

  /* fetch the AI overall synthesis of the whole spread (both languages) */
  function fetchTarotOverall() {
    if (tstate.overall) return Promise.resolve();
    const picks = tstate.picks;
    const cards = picks.map((pk, i) => {
      const c = dataCache['tarot'].cards[pk.id];
      return { en: c.en, ko: c.ko, reversed: pk.rev, position: STR[POS_KEYS[tstate.spread][i]][1] };
    });
    return llmOnce(picks, () => llmReading('tarot_overall', {
      topic: tstate.topic, spread: tstate.spread, cards,
    })).then(llmBody => {
      const txt = llmBody && llmBody.text;
      if (txt && txt.ko && txt.en && tstate.picks === picks) {
        tstate.overall = txt;
        if (tstate.histEntry) { tstate.histEntry.overall = txt; histUpdate(tstate.histEntry); }
      }
    });
  }

  async function appendReading(i, gen) {
    const pk = tstate.picks[i];
    const r = await getTarotReading(pk, tstate.topic, tstate.spread, i);
    if (gen !== undefined && gen !== readingsGen) return; // superseded render
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

  /* overall synthesis card at the bottom: static summary of the spread's
     texture (major/reversed mix) + AI synthesis patched in when it arrives */
  function tarotOverallStatic() {
    const n = tstate.picks.length;
    const majors = tstate.picks.filter(pk => dataCache['tarot'].cards[pk.id].arcana === 'major').length;
    const revs = tstate.picks.filter(pk => pk.rev).length;
    const majorTxt = t(majors === 0 ? 'ov.major.none' : n >= 3 && majors >= Math.ceil(n / 2) ? 'ov.major.many' : 'ov.major.some');
    const revTxt = t(revs === 0 ? 'ov.rev.none' : n >= 3 && revs >= Math.ceil(n / 2) ? 'ov.rev.many' : 'ov.rev.some');
    return tf2('ov.base', { sp: spreadName(), major: majorTxt, rev: revTxt });
  }

  function renderTarotOverall() {
    const picks = tstate.picks;
    $('tarotOverallCard').style.display = 'block';
    $('tarotOverallTitle').textContent = t('t.overall');
    $('tarotOverallText').innerHTML = tarotOverallStatic();
    const applyAi = () => {
      $('tarotOverallAi').innerHTML = tstate.overall
        ? `<div class="r-topic" style="background:#f4edfd">${tstate.overall[lang]}</div>` : '';
    };
    applyAi();
    const status = $('tarotAiStatus');
    if (!tstate.overall && LLM_ENDPOINT) {
      status.textContent = t('ai.loading');
      status.style.display = 'block';
      fetchTarotOverall().then(() => {
        if (tstate.picks !== picks) return;
        status.style.display = 'none';
        applyAi();
      });
    } else {
      status.style.display = 'none';
    }
  }

  function finishTarot() {
    $('revealTitle').textContent = t('t.done');
    $('tarotDisc').style.display = 'block';
    $('tarotDone').style.display = 'flex';
    renderTarotOverall();
    if (!tstate.replay) {
      tstate.ts = Date.now();
      const entry = {
        type: 'tarot', ts: tstate.ts,
        topic: tstate.topic, spread: tstate.spread,
        picks: tstate.picks,
        overall: tstate.overall || null,
      };
      histSave(entry);
      tstate.histEntry = entry; // late AI results re-persist via histUpdate
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
    if (tstate.picks.length && tstate.revealed >= tstate.picks.length) renderTarotOverall();
    // fire any missing AI fetches in parallel so the sequential re-render
    // below never waits on more than the slowest single call
    tstate.picks.slice(0, tstate.revealed).forEach((pk, i) => { fetchTarotAi(pk, i); });
    $('readings').innerHTML = '';
    const gen = ++readingsGen;
    for (let i = 0; i < tstate.revealed && gen === readingsGen; i++) await appendReading(i, gen);
  }

  $('trAgain').addEventListener('click', () => { backOverride = null; startTarotTable(); });
  $('trHome').addEventListener('click', () => { backOverride = null; show('v-select'); });

  /* ═══════════ history UI ═══════════ */
  $('historyBtn').addEventListener('click', () => { renderHistory(); show('v-history'); });

  /* render the cached list immediately, then refresh from the shared store */
  let histSyncSeq = 0;
  function renderHistory() {
    renderHistoryList(histList());
    const seq = ++histSyncSeq;
    $('histSyncNote').style.display = 'block';
    histSync().then(list => {
      if (seq !== histSyncSeq) return; // superseded by a newer refresh
      $('histSyncNote').style.display = 'none';
      if (list && currentView === 'v-history') renderHistoryList(list);
    });
  }

  function renderHistoryList(list) {
    const box = $('historyList');
    if (!list.length) {
      box.innerHTML = `<div class="h-empty">${t('h.empty')}</div>`;
      // $('historyClear').style.display = 'none';   // deletion disabled
      return;
    }
    // $('historyClear').style.display = 'inline';   // deletion disabled
    box.innerHTML = '';
    list.forEach(e => {
      const b = document.createElement('button');
      b.className = 'h-item';
      if (e.type === 'saju') {
        const title = e.name ? tf('h.of', e.name) : t('h.saju');
        b.innerHTML = `<span class="hi">📜</span><span><div class="ht">${title}</div><div class="hd">${describeBirth(e)} · ${fmtTs(e.ts)}</div></span>`;
      } else if (e.type === 'gunghap') {
        b.innerHTML = `<span class="hi">💞</span><span><div class="ht">${tf2('h.gh', { a: e.a.name, b: e.b.name })}</div><div class="hd">${fmtTs(e.ts)}</div></span>`;
      } else {
        b.innerHTML = `<span class="hi">🃏</span><span><div class="ht">${t('h.tarot')} · ${t('topic.' + e.topic)}</div><div class="hd">${t('sp.' + e.spread)} · ${fmtTs(e.ts)}</div></span>`;
      }
      /* ── per-entry delete button disabled (kept for later) ──
      const del = document.createElement('span');
      del.className = 'h-del';
      del.textContent = '✕';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!confirm(t('h.del.confirm'))) return;
        histDelete(e);
        renderHistoryList(histList());
      });
      b.appendChild(del);
      */
      b.addEventListener('click', () => openHistory(e));
      box.appendChild(b);
    });
  }

  async function openHistory(e) {
    if (!e) return;
    if (e.type === 'saju') {
      const reading = await renderSajuResult(e);
      // old entries saved before AI storage (or failed fetches) re-call the
      // API once here — hold the loading screen, then histUpdate persists it
      if (!e.ai) await waitAi('load.saju', reading.aiPromise);
      backOverride = 'v-history';
      show('v-saju-result');
    } else if (e.type === 'gunghap') {
      const reading = await renderGhResult(e);
      if (!e.ai) await waitAi('load.gh', reading.aiPromise);
      backOverride = 'v-history';
      show('v-gh-result');
    } else {
      await loadTarotData();
      if (lang === 'en') await loadTarotEn();
      tstate.replay = true;
      tstate.histEntry = e;
      tstate.topic = e.topic;
      tstate.spread = e.spread;
      tstate.picks = e.picks;
      tstate.revealed = e.picks.length;
      tstate.ts = e.ts;
      tstate.overall = e.overall || null;
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
      renderTarotOverall();
      // parallel AI fetch for entries that predate AI storage; the loading
      // screen holds until they land, then histUpdate persists them
      const jobs = e.picks.map((pk, i) => fetchTarotAi(pk, i));
      jobs.push(fetchTarotOverall());
      if (e.picks.some(pk => !pk.ai) || !tstate.overall) {
        await waitAi('load.tarot', Promise.all(jobs));
      }
      $('readings').innerHTML = '';
      const gen = ++readingsGen;
      for (let i = 0; i < e.picks.length && gen === readingsGen; i++) await appendReading(i, gen);
      $('tarotDisc').style.display = 'block';
      $('tarotDone').style.display = 'flex';
      backOverride = 'v-history';
    }
  }

  /* ── delete-all disabled (kept for later) ──
  $('historyClear').addEventListener('click', () => {
    if (confirm(t('h.clear.confirm'))) {
      localStorage.removeItem(HKEY);
      histApi('hist_clear', {});
      renderHistoryList([]);
    }
  });
  */

  /* init */
  applyStatic();
})();
