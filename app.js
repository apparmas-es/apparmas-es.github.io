'use strict';
/* ============================================================
   TEST ARMAS D·E — simulacros del examen teórico de la licencia D y E
   Basada en TES Test. Sin cuentas ni base de datos: las preguntas están
   en data.js y el progreso se guarda en el propio móvil (localStorage).
   ============================================================ */

const EXAM_SIZE = 20;      // preguntas por examen (Resolución de 19/10/1998)
const PASS_SCORE = 16;     // apto con al menos 16 de 20
const LETTERS = ['A','B','C'];
const ROMAN = ['I','II','III','IV','V','VI','VII'];

const HISTORY_KEY = 'armas_history_v1';
const PROGRESS_KEY = 'armas_progress_v1';
const THEME_KEY = 'armas_theme_v1';
const SEEN_KEY = 'armas_seen_v1';
const MODE_KEY = 'armas_exam_mode_v1';
const STATS_KEY = 'armas_qstats_v1';

let currentTest = null;   // {questions:[ids], answers:[idx|null], examMode, startedAt, finished}
let currentIndex = 0;
let justAnswered = false;
let reviewFilter = 'wrong';

const QUESTION_BY_ID = new Map(QUESTIONS.map(q=>[q.id, q]));
const temaOf = t => TEMAS.find(x=>x.t===t);

/* ---------------- utilidades ---------------- */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
function prefersReducedMotion(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
function screen(){ return document.getElementById('screen'); }
function setSub(text){ document.getElementById('topbarSub').textContent = text; }

const ICON_PATHS = {
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross:'<path d="M6 6l12 12M18 6L6 18"/>',
  chevronLeft:'<path d="M15 5l-7 7 7 7"/>',
  chevronRight:'<path d="M9 5l7 7-7 7"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  play:'<path d="M7 4.5v15l12-7.5z"/>',
  home:'<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/>',
  redo:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'
};
function icon(name, size){
  size = size || 18;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||''}</svg>`;
}
function scopeSVG(size, color){
  size = size || 26; color = color || '#1F3A2A';
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
    <circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4.5"/>
    <path d="M16 2.5v6M16 23.5v6M2.5 16h6M23.5 16h6"/><circle cx="16" cy="16" r="1.2" fill="${color}" stroke="none"/></svg>`;
}

/* ---------------- frases de ánimo (temática de caza) ---------------- */
const CORRECT_PHRASES = [
  '¡En el blanco! Más certero que un rececho al amanecer.',
  '¡Diana! Ni el mejor perdiguero la levanta tan limpia.',
  'Correcta. Esa la tienes más guardada que el rifle en el armero.',
  '¡Pieza cobrada! Sigue así.',
  'Bien tirado. El reglamento te tiene miedo.',
  'Correcta. Ni un perdigón fuera de sitio.',
  '¡Al primer disparo! Así se aprueba.',
  'Acertada. Hoy vuelves con el morral lleno.',
  '¡Limpia como un cañón recién baqueteado!',
  'Correcta. La Guardia Civil estaría orgullosa.'
];
const WRONG_TEMPLATES = [
  'Fallo. Se te ha escapado la perdiz: era la {L}.',
  'Tiro alto. La buena era la {L}.',
  'Ese no entraba ni con choke. Correcta: {L}.',
  'Errado. Revisa la mira: la correcta es la {L}.',
  'Se fue entre los olivos. Era la {L}.',
  'Uy, eso huele a expediente sancionador. La buena: {L}.',
  'Has espantado la pieza. La correcta era la {L}.',
  'Fallo de puntería. La correcta era la {L}.'
];
function pickPhrase(correct, letter){
  if(correct) return CORRECT_PHRASES[Math.floor(Math.random()*CORRECT_PHRASES.length)];
  return WRONG_TEMPLATES[Math.floor(Math.random()*WRONG_TEMPLATES.length)].replace('{L}', letter);
}
function resultMessage(score){
  if(score === EXAM_SIZE) return '¡Pleno! Ni un solo fallo. Estás para presentarte mañana.';
  if(score >= 18) return 'Muy bien tirado. Con este nivel el examen es un paseo por el coto.';
  if(score >= PASS_SCORE) return 'Apto. Has aprobado, pero repasa los fallos para ir con margen.';
  if(score >= 13) return 'Te has quedado cerca. Repasa los fallos y vuelve a intentarlo.';
  return 'Hoy no ha habido suerte en la batida. Repasa los fallos y otro simulacro.';
}

/* ---------------- tema claro / oscuro ---------------- */
function currentTheme(){ return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function applyThemeIcon(){
  const t = currentTheme();
  document.getElementById('themeIcon').innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 18);
  document.getElementById('themeToggle').setAttribute('aria-label', t === 'dark' ? 'Modo claro' : 'Modo oscuro');
}
function toggleTheme(){
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  if(next === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  applyThemeIcon();
}

/* ---------------- datos guardados ---------------- */
function loadHistory(){ return Store.get(HISTORY_KEY, []); }
function saveHistory(h){ Store.set(HISTORY_KEY, h.slice(-200)); }
function loadSeen(){ const v = Store.get(SEEN_KEY, null); return (v && v.last) ? v : {n:0, last:{}}; }
function loadQStats(){ return Store.get(STATS_KEY, {}); }   // id -> [aciertos, fallos]
function examModeOn(){ return Store.get(MODE_KEY, false) === true; }
function setExamMode(on){ Store.set(MODE_KEY, !!on); }
function saveProgress(){ if(currentTest && !currentTest.finished) Store.set(PROGRESS_KEY, {test:currentTest, index:currentIndex}); }
function loadProgress(){
  const p = Store.get(PROGRESS_KEY, null);
  if(!p || !p.test || !Array.isArray(p.test.questions)) return null;
  if(!p.test.questions.every(id=>QUESTION_BY_ID.has(id))) return null;
  return p;
}
function clearProgress(){ Store.remove(PROGRESS_KEY); }

/* ---------------- construir un simulacro ----------------
   La Guardia Civil reparte las preguntas por tema en proporción 4,3,3,4,3,3,4
   (suma 24, pero el examen tiene 20). Se reparte en esa misma proporción:
   3,2,2,3,2,2,3 fijas y las 3 restantes, al azar, entre los temas II, III, V y VI. */
function temaCounts(){
  const weights = TEMAS.map(t=>t.n);
  const total = weights.reduce((a,b)=>a+b,0);
  const exact = weights.map(w=>w*EXAM_SIZE/total);
  const counts = exact.map(Math.floor);
  let left = EXAM_SIZE - counts.reduce((a,b)=>a+b,0);
  const order = shuffle(exact.map((x,i)=>({i, r:x-Math.floor(x)}))).sort((a,b)=>b.r-a.r);
  for(let k=0;k<left;k++) counts[order[k].i]++;
  return counts;
}
function pickFresh(pool, size){
  // Primero las preguntas que nunca han salido, luego las que salieron hace más tiempo.
  const seen = loadSeen();
  const ranked = shuffle(pool).sort((a,b)=>{
    const la = seen.last[a.id] ?? -1, lb = seen.last[b.id] ?? -1;
    return la - lb;
  });
  return ranked.slice(0, size);
}
function rememberSeen(ids){
  const seen = loadSeen();
  seen.n++;
  ids.forEach(id=>{ seen.last[id] = seen.n; });
  Store.set(SEEN_KEY, seen);
}
function buildExam(){
  const counts = temaCounts();
  let picked = [];
  TEMAS.forEach((t, i)=>{
    picked = picked.concat(pickFresh(QUESTIONS.filter(q=>q.t===t.t), counts[i]));
  });
  picked.sort((a,b)=>a.t-b.t);   // como en el examen: por orden de temas
  const ids = picked.map(q=>q.id);
  rememberSeen(ids);
  return {questions:ids, answers:new Array(ids.length).fill(null), phrases:new Array(ids.length).fill(null), examMode:examModeOn(), startedAt:Date.now(), finished:false};
}

/* ---------------- navegación ---------------- */
function goHome(){
  if(currentTest && !currentTest.finished) saveProgress();
  currentTest = null;
  renderHome();
}
function startExam(){
  clearProgress();
  currentTest = buildExam();
  currentIndex = 0;
  renderQuiz();
}
function continueTest(){
  const p = loadProgress();
  if(!p){ renderHome(); return; }
  currentTest = p.test;
  if(!currentTest.phrases) currentTest.phrases = new Array(currentTest.questions.length).fill(null);
  currentIndex = Math.min(p.index || 0, currentTest.questions.length-1);
  renderQuiz();
}
function discardProgress(){ clearProgress(); renderHome(); }
function toggleExamModeHome(el){ setExamMode(el.checked); }

/* ---------------- INICIO ---------------- */
function temaStats(history){
  const agg = TEMAS.map(()=>({ok:0, total:0}));
  history.forEach(h=>{ (h.temas||[]).forEach((x,i)=>{ if(agg[i]){ agg[i].ok += x[0]; agg[i].total += x[1]; } }); });
  return agg;
}
function renderHome(){
  setSub('Examen teórico de la licencia');
  window.scrollTo(0,0);
  const history = loadHistory();
  const passed = history.filter(h=>h.score >= PASS_SCORE).length;
  const best = history.length ? Math.max(...history.map(h=>h.score)) : null;
  const seen = loadSeen();
  const seenCount = Object.keys(seen.last).filter(id=>QUESTION_BY_ID.has(id)).length;
  const last5 = history.slice(-5);
  const progress = loadProgress();

  let continueHtml = '';
  if(progress){
    const answered = progress.test.answers.filter(a=>a!==null).length;
    continueHtml = `<div class="continue-banner">
      <div class="cb-text">Tienes un simulacro a medias: <b>${answered} de ${progress.test.questions.length}</b> respondidas.</div>
      <div class="cb-actions">
        <button class="btn-secondary" data-action="discardProgress">Descartar</button>
        <button class="btn-primary" data-action="continueTest">Continuar</button>
      </div>
    </div>`;
  }

  const agg = temaStats(history);
  const temasHtml = TEMAS.map((t,i)=>{
    const a = agg[i];
    const pct = a.total ? Math.round(a.ok/a.total*100) : null;
    const nQ = QUESTIONS.filter(q=>q.t===t.t).length;
    return `<div class="tema-item">
      <div class="ti-top"><b><span class="ti-roman">${ROMAN[i]}</span>${escapeHtml(t.name)}</b><span>${pct===null ? nQ+' preguntas' : pct+'% aciertos'}</span></div>
      <div class="stats-bar"><div class="stats-bar-fill ${pct!==null && pct<80?'low':''}" style="width:${pct===null?0:pct}%"></div></div>
    </div>`;
  }).join('');

  const historyHtml = history.length ? history.slice().reverse().slice(0,15).map((h,ri)=>{
    const idx = history.length-1-ri;
    const d = new Date(h.date);
    const when = d.toLocaleDateString('es-ES',{day:'numeric', month:'short'}) + ' · ' + d.toLocaleTimeString('es-ES',{hour:'2-digit', minute:'2-digit'});
    return `<button type="button" class="history-item" style="width:100%; cursor:pointer; font:inherit; color:inherit; text-align:left" data-action="openHistory" data-args='[${idx}]' aria-label="Ver simulacro del ${when}">
      <span>${h.score >= PASS_SCORE ? 'Apto' : 'No apto'} · ${when}${h.examMode?' · modo examen':''}</span>
      <span class="score ${h.score >= PASS_SCORE ? 'pass':'fail'}">${h.score}/${h.total}</span>
    </button>`;
  }).join('') : '<div class="empty-hint">Aún no has hecho ningún simulacro. ¡Al lío!</div>';

  screen().innerHTML = `
    <div class="home">
      ${continueHtml}
      <div class="hero">
        <div class="hero-top">
          <div>
            <h2>Licencia de armas <em>D y E</em></h2>
          </div>
        </div>
        <p>Simulacros como el examen real: ${EXAM_SIZE} preguntas del banco oficial de la Guardia Civil, repartidas por temas. Apruebas con ${PASS_SCORE} aciertos.</p>
        <div class="stat-row">
          <div class="stat"><b>${history.length}</b><span>simulacros</span></div>
          <div class="stat"><b>${passed}</b><span>aptos</span></div>
          <div class="stat"><b>${best===null?'—':best+'/'+EXAM_SIZE}</b><span>mejor nota</span></div>
        </div>
        <label class="mode-toggle">
          <input type="checkbox" data-change="toggleExamModeHome" ${examModeOn()?'checked':''}>
          <span>Modo examen: no ver aciertos hasta el final</span>
        </label>
      </div>

      <button class="btn-primary" data-action="startExam">${icon('play',18)} Nuevo simulacro</button>
      <div class="sim-hint">Has visto ${seenCount} de ${QUESTIONS.length} preguntas del banco. Primero salen las que nunca te han tocado.</div>

      <div class="section-label">Tus simulacros</div>
      <div class="history">${historyHtml}</div>

      <div class="section-label">Cómo vas por temas</div>
      <div class="tema-list">${temasHtml}</div>

      <div class="section-label">El examen</div>
      <div class="rules-card">
        <b>${EXAM_SIZE} preguntas</b> con tres respuestas (A, B y C) y solo una correcta. Para ser <b>apto</b> hay que acertar al menos <b>${PASS_SCORE}</b>, o sea, como mucho 4 fallos.
        Las preguntas salen del cuestionario público de la Guardia Civil (${QUESTIONS.length} preguntas en 7 temas).
      </div>
    </div>`;
}

/* ---------------- TEST ---------------- */
function q(i){ return QUESTION_BY_ID.get(currentTest.questions[i]); }
function selectAnswer(i){
  if(!currentTest || currentTest.finished) return;
  const prev = currentTest.answers[currentIndex];
  if(!currentTest.examMode && prev !== null) return;   // en práctica no se cambia
  currentTest.answers[currentIndex] = i;
  justAnswered = true;
  renderQuiz();
  // en modo examen se pasa sola a la siguiente para ir rápido
  if(currentTest.examMode && prev === null && currentIndex < currentTest.questions.length-1){
    setTimeout(()=>{ if(currentTest && !currentTest.finished){ currentIndex++; renderQuiz(); } }, 260);
  }
}
function nextQuestion(){ if(currentIndex < currentTest.questions.length-1){ currentIndex++; renderQuiz(); } }
function prevQuestion(){ if(currentIndex > 0){ currentIndex--; renderQuiz(); } }
function goToQuestion(i){ currentIndex = i; renderQuiz(); }

function renderQuiz(){
  const total = currentTest.questions.length;
  const question = q(currentIndex);
  const tema = temaOf(question.t);
  const userAnswer = currentTest.answers[currentIndex];
  const answered = userAnswer !== null;
  const exam = currentTest.examMode;
  setSub(`${exam?'Modo examen':'Simulacro'} · ${currentIndex+1}/${total}`);

  const optionsHtml = question.o.map((opt,i)=>{
    let cls = 'option', state = '';
    if(exam){
      if(i===userAnswer){ cls += ' chosen'; state = ', marcada'; if(justAnswered) cls += ' just'; }
    } else if(answered){
      cls += ' disabled';
      if(i===question.c){ cls += ' correct'; state = ', correcta'; if(justAnswered) cls += ' just'; }
      else if(i===userAnswer){ cls += ' incorrect'; state = ', tu respuesta, incorrecta'; if(justAnswered) cls += ' just'; }
    }
    const dis = (!exam && answered) ? 'disabled' : '';
    return `<button type="button" class="${cls}" data-action="selectAnswer" data-args='[${i}]' ${dis} aria-label="Opción ${LETTERS[i]}: ${escapeHtml(opt)}${state}">
      <div class="letter">${LETTERS[i]}</div><div>${escapeHtml(opt)}</div></button>`;
  }).join('');

  let feedbackHtml = '';
  if(answered && !exam){
    const ok = userAnswer === question.c;
    if(!currentTest.phrases[currentIndex]) currentTest.phrases[currentIndex] = pickPhrase(ok, LETTERS[question.c]);
    feedbackHtml = `<div class="feedback show ${ok?'ok':'no'}">${icon(ok?'check':'cross',15)} <span>${escapeHtml(currentTest.phrases[currentIndex])}</span></div>`;
  }

  const dotsHtml = currentTest.questions.map((_,i)=>{
    let cls = 'dot';
    if(i===currentIndex) cls += ' current';
    const a = currentTest.answers[i];
    let label = 'sin responder';
    if(a !== null){
      if(exam){ cls += ' answered-exam'; label = 'respondida'; }
      else { const ok = a === q(i).c; cls += ok ? ' answered-ok' : ' answered-no'; label = ok ? 'acertada' : 'fallada'; }
    }
    return `<button type="button" class="${cls}" data-action="goToQuestion" data-args='[${i}]' aria-label="Pregunta ${i+1}, ${label}">${i+1}</button>`;
  }).join('');

  const answeredCount = currentTest.answers.filter(a=>a!==null).length;
  const okCount = exam ? null : currentTest.answers.filter((a,i)=>a!==null && a===q(i).c).length;
  const failCount = exam ? null : answeredCount - okCount;
  const rightText = exam ? `${answeredCount} respondidas` : `${okCount} ✓ · ${failCount} ✗${failCount > EXAM_SIZE-PASS_SCORE ? ' · ya no da para apto' : ''}`;
  const last = currentIndex === total-1;

  screen().innerHTML = `
    <div class="quiz" style="--sc:var(--primary)">
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${answeredCount/total*100}%"></div></div>
        <div class="progress-text"><span>Pregunta ${currentIndex+1}/${total}</span><span>${rightText}</span></div>
      </div>
      <div class="q-card ${!prefersReducedMotion() && !justAnswered ? 'q-enter' : ''}">
        <div class="q-card-head">
          <div class="q-tag">Tema ${ROMAN[question.t-1]}<small>${escapeHtml(tema.name)} · pregunta ${question.n} del cuestionario</small></div>
          <div class="mascot ${answered && justAnswered?'react':''}">${scopeSVG(36, answered && !exam ? (userAnswer===question.c ? 'var(--ok)' : 'var(--danger)') : 'var(--accent-text)')}</div>
        </div>
        <div class="q-text">${escapeHtml(question.q)}</div>
        <div class="options">${optionsHtml}</div>
        ${feedbackHtml}
      </div>
      <div class="nav-buttons">
        <button class="btn-secondary" data-action="prevQuestion" ${currentIndex===0?'disabled':''}>${icon('chevronLeft',15)} Anterior</button>
        ${last
          ? `<button class="btn-primary" data-action="askFinish">${icon('flag',16)} Corregir</button>`
          : `<button class="btn-primary" data-action="nextQuestion">Siguiente ${icon('chevronRight',16)}</button>`}
      </div>
      ${exam ? '<div class="exam-note">Modo examen: puedes cambiar tus respuestas hasta corregir.</div>' : ''}
      <div class="dotnav">${dotsHtml}</div>
      <div class="nav-buttons" style="margin-bottom:28px">
        <button class="btn-secondary" data-action="goHome">${icon('home',15)} Salir (se guarda)</button>
        ${!last ? `<button class="btn-secondary" data-action="askFinish">${icon('flag',15)} Corregir ya</button>` : ''}
      </div>
    </div>`;
  justAnswered = false;
  saveProgress();
}

/* ---------------- corregir ---------------- */
function closeModal(){ const m = document.getElementById('modal'); if(m) m.remove(); }
function askFinish(){
  const blank = currentTest.answers.filter(a=>a===null).length;
  if(blank === 0){ finishTest(); return; }
  closeModal();
  const div = document.createElement('div');
  div.className = 'modal-back'; div.id = 'modal';
  div.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <h3 id="mTitle">¿Corregir ya?</h3>
    <p>Te quedan <b>${blank}</b> ${blank===1?'pregunta':'preguntas'} sin responder. Cuentan como fallo, igual que en el examen.</p>
    <div class="bottom-actions">
      <button class="btn-secondary" data-action="closeModal">Seguir</button>
      <button class="btn-primary" data-action="finishTest">Corregir</button>
    </div></div>`;
  div.addEventListener('click', e=>{ if(e.target === div) closeModal(); });
  document.body.appendChild(div);
}
function finishTest(){
  closeModal();
  const t = currentTest;
  t.finished = true;
  clearProgress();
  const score = t.answers.filter((a,i)=>a!==null && a===q(i).c).length;
  const temas = TEMAS.map(()=>[0,0]);
  const qstats = loadQStats();
  t.questions.forEach((id,i)=>{
    const qq = QUESTION_BY_ID.get(id);
    const ok = t.answers[i] === qq.c;
    temas[qq.t-1][1]++; if(ok) temas[qq.t-1][0]++;
    const s = qstats[id] || [0,0]; s[ok?0:1]++; qstats[id] = s;
  });
  Store.set(STATS_KEY, qstats);
  const history = loadHistory();
  history.push({date:Date.now(), score, total:t.questions.length, examMode:!!t.examMode, temas, questions:t.questions, answers:t.answers});
  saveHistory(history);
  reviewFilter = score === t.questions.length ? 'all' : 'wrong';
  renderResults(history.length-1);
}
function openHistory(idx){
  const h = loadHistory()[idx];
  if(!h) return;
  reviewFilter = h.score === h.total ? 'all' : 'wrong';
  renderResults(idx);
}
function setReviewFilter(f, idx){ reviewFilter = f; renderResults(idx, true); }

function renderResults(idx, keepScroll){
  const h = loadHistory()[idx];
  if(!h){ renderHome(); return; }
  currentTest = null;
  setSub('Resultado del simulacro');
  if(!keepScroll) window.scrollTo(0,0);
  const pass = h.score >= PASS_SCORE;
  const wrongCount = h.total - h.score;

  const items = (h.questions||[]).map((id,i)=>({qq:QUESTION_BY_ID.get(id), a:h.answers[i], i})).filter(x=>x.qq);
  const shown = reviewFilter === 'all' ? items : items.filter(x=>x.a !== x.qq.c);
  const reviewHtml = shown.map(({qq,a,i})=>{
    const ok = a === qq.c;
    let lines = '';
    if(a === null) lines += `<div class="ra user-blank">Sin responder</div>`;
    else if(!ok) lines += `<div class="ra user-wrong">${icon('cross',13)} Tu respuesta: ${LETTERS[a]}) ${escapeHtml(qq.o[a])}</div>`;
    lines += `<div class="ra correct-ans">${icon('check',13)} ${LETTERS[qq.c]}) ${escapeHtml(qq.o[qq.c])}</div>`;
    return `<div class="review-item" style="--sc:${ok?'var(--ok)':'var(--danger)'}">
      <div class="review-tag">Pregunta ${i+1} · Tema ${ROMAN[qq.t-1]} · nº ${qq.n}</div>
      <div class="rq">${escapeHtml(qq.q)}</div>${lines}</div>`;
  }).join('') || '<div class="empty-hint">Nada que repasar aquí. ¡Pleno!</div>';

  const temasLine = (h.temas||[]).map((x,i)=> x[1] ? `${ROMAN[i]}: ${x[0]}/${x[1]}` : '').filter(Boolean).join(' · ');

  screen().innerHTML = `
    <div class="results">
      <div class="result-hero ${pass?'pass':'fail'}">
        <div class="rh-mascot">${scopeSVG(54,'#fff')}</div>
        <div class="big-score">${h.score}/${h.total}</div>
        <div class="big-label">${wrongCount} ${wrongCount===1?'fallo':'fallos'} · necesitas ${PASS_SCORE} aciertos</div>
        <div class="rh-msg">${escapeHtml(resultMessage(h.score))}</div>
        <div class="verdict">${icon(pass?'check':'cross',16)} ${pass?'APTO':'NO APTO'}</div>
      </div>
      ${temasLine ? `<div class="sim-hint" style="margin:-8px 0 18px">Por temas: ${temasLine}</div>` : ''}
      <button class="btn-primary" data-action="startExam">${icon('redo',18)} Otro simulacro</button>

      <div class="section-label">Repaso</div>
      <div class="review-filter">
        <button class="btn-secondary ${reviewFilter==='wrong'?'active':''}" data-action="setReviewFilter" data-args='["wrong",${idx}]'>Fallos (${wrongCount})</button>
        <button class="btn-secondary ${reviewFilter==='all'?'active':''}" data-action="setReviewFilter" data-args='["all",${idx}]'>Todas (${h.total})</button>
      </div>
      ${reviewHtml}
      <div class="bottom-actions">
        <button class="btn-secondary" data-action="goHome">${icon('home',15)} Inicio</button>
      </div>
    </div>`;
}

/* ---------------- eventos ---------------- */
const ACTIONS = {goHome, toggleTheme, startExam, continueTest, discardProgress, selectAnswer, nextQuestion, prevQuestion,
  goToQuestion, askFinish, finishTest, closeModal, openHistory, setReviewFilter};
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const fn = ACTIONS[el.dataset.action];
  if(!fn) return;
  let args = [];
  try{ args = el.dataset.args ? JSON.parse(el.dataset.args) : []; }catch(err){ args = []; }
  fn.apply(null, args);
});
document.addEventListener('change', e=>{
  const el = e.target.closest('[data-change]');
  if(el && el.dataset.change === 'toggleExamModeHome') toggleExamModeHome(el);
});
document.addEventListener('keydown', e=>{
  if(!currentTest || currentTest.finished || document.getElementById('modal')) return;
  const k = e.key.toLowerCase();
  if(k==='a'||k==='b'||k==='c') selectAnswer('abc'.indexOf(k));
  else if(e.key==='ArrowRight') nextQuestion();
  else if(e.key==='ArrowLeft') prevQuestion();
});

/* ---------------- arranque ---------------- */
document.getElementById('brandLogo').innerHTML = scopeSVG(26, '#1F3A2A');
applyThemeIcon();
renderHome();
