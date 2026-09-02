
(() => {
  'use strict';

  const STORE_KEY = 'reptrail.state.v2';
  const LEGACY_STORE_KEYS = ['myWorkoutPwa.v1'];
  const storage = getStorage();
  const state = loadState();
  let currentDay = 'day1';
  let deferredInstallPrompt = null;

  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  const inputNumber = (input) => {
    if (!input || input.value.trim() === '') return null;
    const n = Number(input.value);
    return Number.isFinite(n) ? n : null;
  };

  function getStorage(){
    try {
      const testKey = '__reptrail_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      return {getItem: () => null, setItem: () => {}, removeItem: () => {}};
    }
  }

  function normalizeState(parsed){
    return {
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions.filter(Boolean) : [],
      metrics: Array.isArray(parsed?.metrics) ? parsed.metrics.filter(Boolean) : []
    };
  }

  function loadState(){
    try {
      const raw = storage.getItem(STORE_KEY) || LEGACY_STORE_KEYS.map(k => storage.getItem(k)).find(Boolean);
      if (!raw) return {sessions:[], metrics:[]};
      return normalizeState(JSON.parse(raw));
    } catch {
      return {sessions:[], metrics:[]};
    }
  }

  function persist(){
    try {
      storage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      toast('本地存储空间不足，请先导出备份');
    }
  }

  function toast(message){
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1700);
  }

  function frameUrl(slug, i){
    return `./assets/${slug}/frame-${i}.svg`;
  }

  function latestExerciseRecord(exerciseId){
    for (let i = state.sessions.length - 1; i >= 0; i--){
      const e = state.sessions[i].exercises?.find(x => x.id === exerciseId);
      if (e) return e;
    }
    return null;
  }

  function weightSuggestion(ex, record){
    if (!record || ex.type !== 'weight') return null;
    const reps = record.reps.filter(Number.isFinite);
    if (reps.length !== ex.sets) return {text:'记录完整后判断', cls:''};
    const min = Math.min(...reps);
    const allTop = reps.every(r => r >= ex.repMax);
    const rir = Number(record.rir);
    if (min < ex.repMin) {
      const lower = Math.max(0, Math.round(record.weight * 0.9 * 2) / 2);
      return {text:`建议降重至约 ${lower} kg`, cls:'danger'};
    }
    if (allTop && Number.isFinite(rir) && rir >= 3) {
      const next = Math.round((record.weight + ex.increment) * 2) / 2;
      return {text:`下次可试 ${next} kg`, cls:'good'};
    }
    return {text:'下次保持重量', cls:'warn'};
  }

  function renderDay(){
    const day = window.WORKOUT_DATA[currentDay];
    $('#daySummary').innerHTML = `<h2>${day.title}</h2><p>${day.subtitle} · 约 55–65 分钟</p>`;
    const list = $('#exerciseList');
    list.innerHTML = '';

    day.exercises.forEach(ex => {
      const last = latestExerciseRecord(ex.id);
      const article = document.createElement('article');
      article.className = 'exercise';
      article.dataset.exerciseId = ex.id;

      let media = '';
      if (ex.slug) {
        media = `<div class="frames">
          ${[1,2,3].map(i => `<img loading="lazy" src="${frameUrl(ex.slug, i)}" alt="${ex.name} 姿势 ${i}">`).join('')}
        </div>`;
      }

      let target = '';
      if (ex.type === 'weight' || ex.type === 'bodyweight') target = `${ex.sets} × ${ex.repMin}–${ex.repMax}`;
      if (ex.type === 'duration') target = `${ex.sets} × ${ex.durationMin}–${ex.durationMax} 秒`;
      if (ex.type === 'cardio') target = `${ex.duration}`;

      let lastLine = '';
      if (last) {
        if (ex.type === 'weight') lastLine = `上次：${last.weight} kg · ${last.reps.join('/')} · RIR ${last.rir ?? '—'}`;
        else if (ex.type === 'duration') lastLine = `上次：${last.durations?.join('/')} 秒`;
        else if (ex.type === 'bodyweight') lastLine = `上次：${last.reps.join('/')}`;
        else lastLine = `上次：${last.duration ?? '—'} min`;
      }

      let controls = '';
      if (ex.type === 'weight') {
        const preWeight = last?.weight ?? ex.startWeight;
        controls = `<div class="inputs">
          <div class="field"><label>重量</label><input class="weight" type="number" step="0.5" min="0" value="${preWeight}"></div>
          ${[0,1,2].map((_,i)=>`<div class="field"><label>第${i+1}组</label><input class="rep" data-i="${i}" type="number" min="0" max="100" inputmode="numeric" placeholder="${ex.repMin}" value="${last?.reps?.[i] ?? ''}"></div>`).join('')}
          <div class="field rir"><label>最后一组 RIR</label><select class="rir"><option value="">未填</option>${[0,1,2,3,4,5].map(v=>`<option ${last?.rir === v ? 'selected' : (last?.rir == null && v === 2 ? 'selected' : '')}>${v}</option>`).join('')}</select></div>
        </div>`;
      } else if (ex.type === 'bodyweight') {
        controls = `<div class="inputs" style="grid-template-columns:repeat(3,1fr)">
          ${[0,1,2].map((_,i)=>`<div class="field"><label>第${i+1}组</label><input class="rep" data-i="${i}" type="number" min="0" max="100" inputmode="numeric" placeholder="${ex.repMin}" value="${last?.reps?.[i] ?? ''}"></div>`).join('')}
        </div>`;
      } else if (ex.type === 'duration') {
        controls = `<div class="inputs" style="grid-template-columns:repeat(3,1fr)">
          ${[0,1,2].map((_,i)=>`<div class="field"><label>第${i+1}组 秒</label><input class="duration-set" data-i="${i}" type="number" min="0" max="600" inputmode="numeric" placeholder="${ex.durationMin}" value="${last?.durations?.[i] ?? ''}"></div>`).join('')}
        </div>`;
      } else {
        controls = `<div class="cardio-row">
          <div class="field"><label>完成分钟</label><input class="cardio-duration" type="number" min="0" max="180" inputmode="numeric" placeholder="15" value="${last?.duration || ''}"></div>
          <div class="field"><label>强度 / 备注</label><input class="cardio-note" type="text" maxlength="50" placeholder="${ex.target || '中等强度'}" value="${escapeHtml(last?.note || '')}"></div>
        </div>`;
      }

      const suggestion = last && ex.type === 'weight' ? weightSuggestion(ex, last) : null;
      article.innerHTML = `
        <div class="exercise-head">
          <div><h3>${ex.name}</h3><div class="meta">目标：${target}${ex.rest ? ` · 休息 ${ex.rest}` : ''}${ex.unit ? ` · 起点 ${ex.startWeight ?? ''}${ex.unit}` : ''}</div>${lastLine ? `<div class="last">${lastLine}</div>` : ''}</div>
          ${suggestion ? `<span class="rec ${suggestion.cls}">${suggestion.text}</span>` : ''}
        </div>
        ${media}
        <p class="cue">${ex.cue}</p>
        ${controls}
        <div class="complete-row"><label class="check"><input class="complete" type="checkbox">完成</label></div>
      `;
      list.appendChild(article);
    });
  }

  function collectCurrentWorkout(){
    const day = window.WORKOUT_DATA[currentDay];
    const records = [];
    $$('.exercise', $('#exerciseList')).forEach((card, idx) => {
      const ex = day.exercises[idx];
      const record = {id:ex.id, name:ex.name, type:ex.type, complete:$('.complete', card)?.checked ?? false};

      if (ex.type === 'weight') {
        record.weight = inputNumber($('.weight', card));
        record.reps = $$('.rep', card).map(inputNumber).filter(v => v !== null);
        const rirRaw = $('.rir', card).value;
        record.rir = rirRaw === '' ? null : Number(rirRaw);
      } else if (ex.type === 'bodyweight') {
        record.reps = $$('.rep', card).map(inputNumber).filter(v => v !== null);
      } else if (ex.type === 'duration') {
        record.durations = $$('.duration-set', card).map(inputNumber).filter(v => v !== null);
      } else {
        record.duration = inputNumber($('.cardio-duration', card)) || 0;
        record.note = $('.cardio-note', card).value.trim();
      }
      records.push(record);
    });
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      date: today(),
      createdAt: new Date().toISOString(),
      dayId: currentDay,
      dayTitle: day.title,
      exercises: records
    };
  }

  $('#saveWorkout').addEventListener('click', () => {
    const session = collectCurrentWorkout();
    const hasAny = session.exercises.some(e =>
      e.complete ||
      (e.reps && e.reps.length > 0) ||
      (e.durations && e.durations.length > 0) ||
      (e.duration && e.duration > 0)
    );
    if (!hasAny) {
      toast('请先记录至少一个动作');
      return;
    }
    state.sessions.push(session);
    persist();
    renderDay();
    renderHistory();
    toast('本次训练已保存');
  });

  $$('.day-switch button').forEach(btn => btn.addEventListener('click', () => {
    currentDay = btn.dataset.day;
    $$('.day-switch button').forEach(b => b.classList.toggle('active', b === btn));
    renderDay();
    window.scrollTo({top:0, behavior:'smooth'});
  }));

  function renderHistory(){
    const box = $('#historyList');
    if (!state.sessions.length) {
      box.innerHTML = '<div class="empty">还没有训练记录。</div>';
      return;
    }
    box.innerHTML = [...state.sessions].reverse().slice(0,50).map(s => {
      const done = s.exercises.filter(e => e.complete).length;
      const detail = s.exercises.map(e => {
        if (e.type === 'weight') return `${e.name} ${e.weight ?? '—'}kg ${e.reps?.join('/') || '—'} RIR${e.rir ?? '—'}`;
        if (e.type === 'bodyweight') return `${e.name} ${e.reps?.join('/') || '—'}`;
        if (e.type === 'duration') return `${e.name} ${e.durations?.join('/') || '—'}秒`;
        return `${e.name} ${e.duration || 0}min`;
      }).join('；');
      return `<article class="history-item"><h3>${s.date} · ${s.dayTitle}</h3><p>完成 ${done}/${s.exercises.length} 项</p><p>${detail}</p></article>`;
    }).join('');
  }

  function renderMetrics(){
    const box = $('#metricList');
    const summary = $('#metricSummary');
    if (!state.metrics.length) {
      box.innerHTML = '<div class="empty">还没有身体数据。</div>';
      summary.textContent = '建议：每周多次晨起称重，关注周平均；腰围每周固定条件测一次。';
      return;
    }
    const sorted = [...state.metrics].sort((a,b)=>a.date.localeCompare(b.date));
    const first = sorted[0], last = sorted[sorted.length-1];
    const wDelta = Number.isFinite(first.weight) && Number.isFinite(last.weight) ? (last.weight-first.weight).toFixed(1) : null;
    const waistDelta = Number.isFinite(first.waist) && Number.isFinite(last.waist) ? (last.waist-first.waist).toFixed(1) : null;
    summary.innerHTML = `最早 → 最新：${wDelta !== null ? `体重 ${wDelta>0?'+':''}${wDelta} kg` : '体重数据不足'}；${waistDelta !== null ? `腰围 ${waistDelta>0?'+':''}${waistDelta} cm` : '腰围数据不足'}。`;
    box.innerHTML = [...sorted].reverse().slice(0,50).map(m =>
      `<article class="metric-item"><h3>${m.date}</h3><p>${Number.isFinite(m.weight)?`体重 ${m.weight} kg`:'体重 —'} · ${Number.isFinite(m.waist)?`腰围 ${m.waist} cm`:'腰围 —'}</p>${m.note?`<p>${escapeHtml(m.note)}</p>`:''}</article>`
    ).join('');
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  $('#metricDate').value = today();
  $('#metricForm').addEventListener('submit', e => {
    e.preventDefault();
    const date = $('#metricDate').value || today();
    const weightRaw = $('#metricWeight').value;
    const waistRaw = $('#metricWaist').value;
    const metric = {
      date,
      weight: weightRaw === '' ? null : Number(weightRaw),
      waist: waistRaw === '' ? null : Number(waistRaw),
      note: $('#metricNote').value.trim()
    };
    if (metric.weight === null && metric.waist === null) {
      toast('体重或腰围至少填一个');
      return;
    }
    const existing = state.metrics.findIndex(x => x.date === date);
    if (existing >= 0) state.metrics[existing] = metric; else state.metrics.push(metric);
    persist();
    renderMetrics();
    $('#metricWeight').value = '';
    $('#metricWaist').value = '';
    $('#metricNote').value = '';
    toast('身体数据已保存');
  });

  $$('.bottom-nav button').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.panel;
    $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === id));
    if (id === 'historyPanel') renderHistory();
    if (id === 'dataPanel') renderMetrics();
    window.scrollTo({top:0, behavior:'smooth'});
  }));

  $('#exportBtn').addEventListener('click', () => {
    const payload = JSON.stringify({version:1, exportedAt:new Date().toISOString(), ...state}, null, 2);
    const blob = new Blob([payload], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `健身记录备份-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.metrics)) throw new Error('格式不正确');
      state.sessions = parsed.sessions;
      state.metrics = parsed.metrics;
      persist(); renderDay(); renderHistory(); renderMetrics();
      toast('备份已导入');
    } catch {
      toast('导入失败：不是有效备份');
    } finally {
      e.target.value = '';
    }
  });

  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('确定清空全部训练记录和身体数据？此操作不可撤销。')) return;
    state.sessions = []; state.metrics = []; persist();
    renderDay(); renderHistory(); renderMetrics();
    toast('记录已清空');
  });

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('#installBtn').hidden = false;
  });

  $('#installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#installBtn').hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    $('#installBtn').hidden = true;
    toast('已安装到手机');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }

  renderDay();
  renderHistory();
  renderMetrics();
})();
