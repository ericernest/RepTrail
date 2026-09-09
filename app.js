
(() => {
  'use strict';

  const STORE_KEY = 'reptrail.state.v2';
  const LEGACY_STORE_KEYS = ['myWorkoutPwa.v1'];
  const storage = getStorage();
  const state = loadState();
  let currentDay = 'day1';
  let deferredInstallPrompt = null;
  let editingSessionId = null;
  let editingMetricDate = null;
  let editingPlankId = null;
  let calendarCursor = new Date();
  let selectedHistoryDate = null;
  let plankTotalSeconds = 60;
  let plankRemainingSeconds = 60;
  let plankTimerId = null;
  let plankRunning = false;

  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  selectedHistoryDate = today();

  const inputNumber = (input) => {
    if (!input || input.value.trim() === '') return null;
    const n = Number(input.value);
    return Number.isFinite(n) ? n : null;
  };

  function finiteNumber(value){
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function displayNumber(value, suffix=''){
    const number = finiteNumber(value);
    return number === null ? '—' : `${number}${suffix}`;
  }

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
      metrics: Array.isArray(parsed?.metrics) ? parsed.metrics.filter(Boolean) : [],
      planks: Array.isArray(parsed?.planks) ? parsed.planks.filter(Boolean) : []
    };
  }

  function loadState(){
    try {
      const raw = storage.getItem(STORE_KEY) || LEGACY_STORE_KEYS.map(k => storage.getItem(k)).find(Boolean);
      if (!raw) return {sessions:[], metrics:[], planks:[]};
      return normalizeState(JSON.parse(raw));
    } catch {
      return {sessions:[], metrics:[], planks:[]};
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
    const reps = (Array.isArray(record.reps) ? record.reps : []).map(finiteNumber).filter(v => v !== null);
    if (reps.length !== ex.sets) return {text:'记录完整后判断', cls:''};
    const min = Math.min(...reps);
    const allTop = reps.every(r => r >= ex.repMax);
    const rir = finiteNumber(record.rir);
    if (min < ex.repMin) {
      const weight = finiteNumber(record.weight);
      if (weight === null) return {text:'请先填写重量', cls:'warn'};
      const lower = Math.max(0, Math.round(weight * 0.9 * 2) / 2);
      return {text:`建议降重至约 ${lower} kg`, cls:'danger'};
    }
    if (allTop && Number.isFinite(rir) && rir >= 3) {
      const weight = finiteNumber(record.weight);
      if (weight === null) return {text:'请先填写重量', cls:'warn'};
      const next = Math.round((weight + ex.increment) * 2) / 2;
      return {text:`下次可试 ${next} kg`, cls:'good'};
    }
    return {text:'下次保持重量', cls:'warn'};
  }

  function renderDay(){
    const day = window.WORKOUT_DATA[currentDay];
    $('#daySummary').innerHTML = `<h2>${day.title}</h2><p>${day.subtitle} · 约 ${day.durationText || '55–65 分钟'}</p>`;
    const list = $('#exerciseList');
    list.innerHTML = '';

    day.exercises.forEach(ex => {
      const editingSession = state.sessions.find(s => s.id === editingSessionId && s.dayId === currentDay);
      const last = editingSession?.exercises?.find(x => x.id === ex.id) || latestExerciseRecord(ex.id);
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
        if (ex.type === 'weight') lastLine = `上次：${displayNumber(last.weight, ' kg')} · ${(Array.isArray(last.reps) ? last.reps.map(v => displayNumber(v)).join('/') : '—')} · RIR ${displayNumber(last.rir)}`;
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
          <div class="field rir"><label>最后一组 RIR</label><select class="rir"><option value="">未填</option>${[0,1,2,3,4,5].map(v=>`<option ${last?.rir === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
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
        const speedOptions = ['不适用', '4.5 km/h', '5.0 km/h', '5.5 km/h', '6.0 km/h'];
        const inclineOptions = ['不适用', '0%', '3%', '5%', '7%', '10%'];
        const defaultSpeed = ex.target?.match(/\d+(?:\.\d+)?\s*km\/h/i)?.[0]?.replace(/\s+/g, ' ').trim();
        const defaultIncline = ex.target?.match(/\d+%/)?.[0];
        controls = `<div class="cardio-grid">
          <div class="field"><label>完成分钟</label><input class="cardio-duration" type="number" min="0" max="180" inputmode="numeric" placeholder="15" value="${last?.duration || ''}"></div>
          <div class="field"><label>速度</label><select class="cardio-speed">${speedOptions.map(option => `<option ${last?.speed === option || (!last?.speed && option === defaultSpeed) ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
          <div class="field"><label>坡度</label><select class="cardio-incline">${inclineOptions.map(option => `<option ${last?.incline === option || (!last?.incline && option === defaultIncline) ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
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
        <div class="complete-row"><label class="check"><input class="complete" type="checkbox" ${last?.complete ? 'checked' : ''}>完成</label></div>
      `;
      list.appendChild(article);
    });
  }

  function collectCurrentWorkout(){
    const day = window.WORKOUT_DATA[currentDay];
    const editingSession = state.sessions.find(s => s.id === editingSessionId);
    const records = [];
    $$('.exercise', $('#exerciseList')).forEach((card, idx) => {
      const ex = day.exercises[idx];
      const record = {id:ex.id, name:ex.name, type:ex.type, complete:$('.complete', card)?.checked ?? false};

      if (ex.type === 'weight') {
        record.weight = inputNumber($('.weight', card));
        record.reps = $$('.rep', card).map(inputNumber).filter(v => v !== null);
        const rirRaw = $('.field.rir select', card)?.value ?? '';
        record.rir = rirRaw === '' ? null : finiteNumber(rirRaw);
      } else if (ex.type === 'bodyweight') {
        record.reps = $$('.rep', card).map(inputNumber).filter(v => v !== null);
      } else if (ex.type === 'duration') {
        record.durations = $$('.duration-set', card).map(inputNumber).filter(v => v !== null);
      } else {
        record.duration = inputNumber($('.cardio-duration', card)) || 0;
        record.speed = $('.cardio-speed', card)?.value || '不适用';
        record.incline = $('.cardio-incline', card)?.value || '不适用';
      }
      records.push(record);
    });
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      date: editingSession?.date || today(),
      createdAt: editingSession?.createdAt || new Date().toISOString(),
      dayId: currentDay,
      dayTitle: day.title,
      durationMinutes: day.durationMinutes || 60,
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
    if (editingSessionId) {
      const index = state.sessions.findIndex(s => s.id === editingSessionId);
      if (index >= 0) state.sessions[index] = session;
      editingSessionId = null;
      $('#saveWorkout').textContent = '保存本次训练';
      $('#cancelEditWorkout').hidden = true;
    } else {
      state.sessions.push(session);
    }
    persist();
    renderDay();
    renderHistory();
    toast('本次训练已保存');
  });

  $('#cancelEditWorkout').addEventListener('click', () => {
    editingSessionId = null;
    $('#saveWorkout').textContent = '保存本次训练';
    $('#cancelEditWorkout').hidden = true;
    renderDay();
  });

  $$('.day-switch button').forEach(btn => btn.addEventListener('click', () => {
    currentDay = btn.dataset.day;
    $$('.day-switch button').forEach(b => b.classList.toggle('active', b === btn));
    renderDay();
    window.scrollTo({top:0, behavior:'smooth'});
  }));

  function dateKey(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function formatDuration(seconds){
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(total/60)}分${String(total%60).padStart(2,'0')}秒`;
  }
  function activityDates(){
    return new Set([...state.sessions.map(s=>s.date), ...state.planks.map(p=>p.date)].filter(Boolean));
  }
  function renderCalendar(){
    const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
    $('#calendarTitle').textContent = `${y}年${m+1}月`;
    const first = new Date(y,m,1), days = new Date(y,m+1,0).getDate();
    const offset = (first.getDay()+6)%7, active = activityDates();
    const cells=[];
    for(let i=0;i<offset;i++) cells.push('<span class="calendar-empty"></span>');
    for(let day=1;day<=days;day++){
      const key=dateKey(new Date(y,m,day));
      cells.push(`<button type="button" class="calendar-day ${active.has(key)?'has-record':''} ${key===selectedHistoryDate?'selected':''} ${key===today()?'today':''}" data-date="${key}"><span>${day}</span>${active.has(key)?'<i class="green-dot"></i>':''}</button>`);
    }
    $('#calendarGrid').innerHTML=cells.join('');
    $$('.calendar-day').forEach(btn=>btn.addEventListener('click',()=>{selectedHistoryDate=btn.dataset.date;renderCalendar();renderSelectedDay();}));
  }
  function renderStats(){
    const dates=[...activityDates()].sort();
    const longest = dates.reduce((best, value, index) => {
      let run=1;
      for(let i=index;i>0;i--){const a=new Date(dates[i-1]),b=new Date(dates[i]); if((b-a)/86400000===1) run++; else break;}
      return Math.max(best,run);
    },0);
    const countDay=id=>new Set(state.sessions.filter(s=>s.dayId===id&&s.date).map(s=>s.date)).size;
    const workoutMinutes=state.sessions.reduce((sum,s)=>sum+(finiteNumber(s.durationMinutes)||({day1:60,day2:60,day3:60,day4:45}[s.dayId]||60)),0);
    const plankSeconds=state.planks.reduce((sum,p)=>sum+(finiteNumber(p.durationSeconds)||0),0);
    const first=dates[0];
    const cards=[['训练天数',dates.length+' 天'],['最长连续',longest+' 天'],['Day 1',countDay('day1')+' 天'],['Day 2',countDay('day2')+' 天'],['Day 3',countDay('day3')+' 天'],['Day 4',countDay('day4')+' 天'],['总训练时长',formatDuration(workoutMinutes*60)],['平板支撑',formatDuration(plankSeconds)]];
    $('#historyStats').innerHTML=`<div class="stats-caption">${first?`从 ${first} 开始统计`:'有记录后会自动统计'}</div>${cards.map(([label,value])=>`<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('')}`;
  }
  function historyDetail(e){
    const reps=Array.isArray(e?.reps)?e.reps.map(v=>displayNumber(v)).join(' / '):'—';
    if(e?.type==='weight') return `${displayNumber(e.weight,' kg')} · ${reps} · RIR ${displayNumber(e.rir)}`;
    if(e?.type==='bodyweight') return reps;
    if(e?.type==='duration') return `${Array.isArray(e.durations)?e.durations.map(v=>displayNumber(v)).join(' / '):'—'} 秒`;
    return `${displayNumber(e?.duration)} min · 速度 ${escapeHtml(e?.speed||'—')} · 坡度 ${escapeHtml(e?.incline||'—')}`;
  }
  function renderSelectedDay(){
    $('#selectedDateTitle').textContent=`${selectedHistoryDate} 训练记录`;
    const sessions=state.sessions.filter(s=>s.date===selectedHistoryDate), planks=state.planks.filter(p=>p.date===selectedHistoryDate);
    const sessionHtml=sessions.map(s=>`<article class="history-item"><div class="history-head"><div><h3>${escapeHtml(s.dayTitle||'训练记录')}</h3><p>${(s.exercises||[]).filter(e=>e?.complete).length}/${(s.exercises||[]).length} 个动作完成</p></div><div class="record-actions"><button class="text-action" data-action="edit-session" data-id="${s.id}">编辑</button><button class="text-action danger-action" data-action="delete-session" data-id="${s.id}">删除</button></div></div><div class="history-grid">${(s.exercises||[]).map(e=>`<div class="history-row"><div><strong>${escapeHtml(e.name||'未命名动作')}</strong><span>${historyDetail(e)}</span></div><em class="history-status ${e.complete?'done':''}">${e.complete?'完成':'未完成'}</em></div>`).join('')}</div></article>`).join('');
    const plankHtml=planks.map(p=>`<article class="history-item plank-record"><div><h3>平板支撑</h3><p>${formatDuration(p.durationSeconds)}</p></div><div class="record-actions"><button class="text-action" data-action="edit-plank" data-id="${p.id}">编辑</button><button class="text-action danger-action" data-action="delete-plank" data-id="${p.id}">删除</button></div></article>`).join('');
    $('#dayHistoryList').innerHTML=sessionHtml+plankHtml||'<div class="empty">这一天还没有训练记录。</div>';
  }
  function renderHistory(){ renderCalendar(); renderStats(); renderSelectedDay(); renderPlankTimer(); }

  function renderPlankTimer(){
    const minutes=String(Math.floor(plankRemainingSeconds/60)).padStart(2,'0');
    const seconds=String(plankRemainingSeconds%60).padStart(2,'0');
    $('#plankTimerDisplay').textContent=`${minutes}:${seconds}`;
    $('#plankStartPause').textContent=plankRunning?'暂停':'开始';
    $('#plankComplete').textContent=editingPlankId?'更新记录':'完成并记录';
  }
  function stopPlankTimer(){ if(plankTimerId){clearInterval(plankTimerId);plankTimerId=null;} plankRunning=false; }
  function setPlankTimer(){
    stopPlankTimer();
    const min=Math.max(0,Math.min(60,Number($('#plankMinutes').value)||0));
    const sec=Math.max(0,Math.min(59,Number($('#plankSeconds').value)||0));
    plankTotalSeconds=min*60+sec;
    if(!plankTotalSeconds){toast('请设置大于 0 秒的时间');return;}
    plankRemainingSeconds=plankTotalSeconds; renderPlankTimer();
  }
  $('#setPlankTimer').addEventListener('click',setPlankTimer);
  $('#plankStartPause').addEventListener('click',()=>{
    if(plankRunning){stopPlankTimer();renderPlankTimer();return;}
    if(!plankRemainingSeconds){plankRemainingSeconds=plankTotalSeconds;}
    plankRunning=true; renderPlankTimer();
    plankTimerId=setInterval(()=>{plankRemainingSeconds=Math.max(0,plankRemainingSeconds-1);if(!plankRemainingSeconds){stopPlankTimer();toast('时间到，可以完成记录');}renderPlankTimer();},1000);
  });
  $('#plankReset').addEventListener('click',()=>{stopPlankTimer();editingPlankId=null;plankRemainingSeconds=plankTotalSeconds;renderPlankTimer();});
  $('#plankComplete').addEventListener('click',()=>{
    const duration=Math.max(1,plankTotalSeconds-plankRemainingSeconds||plankTotalSeconds);
    const entry={id:editingPlankId||(`${Date.now()}-${Math.random()}`),date:editingPlankId?(state.planks.find(p=>p.id===editingPlankId)?.date||today()):today(),createdAt:new Date().toISOString(),durationSeconds:duration};
    const index=state.planks.findIndex(p=>p.id===editingPlankId);
    if(index>=0) state.planks[index]=entry; else state.planks.push(entry);
    editingPlankId=null; stopPlankTimer(); plankRemainingSeconds=plankTotalSeconds; persist(); renderHistory(); toast('平板支撑已记录');
  });
  $('#dayHistoryList').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]'); if(!btn)return;
    const {action,id}=btn.dataset;
    if(action==='delete-session' && confirm('删除这条训练记录？')){state.sessions=state.sessions.filter(s=>s.id!==id);persist();renderHistory();return;}
    if(action==='delete-plank' && confirm('删除这条平板支撑记录？')){state.planks=state.planks.filter(p=>p.id!==id);persist();renderHistory();return;}
    if(action==='edit-session'){
      const session=state.sessions.find(s=>s.id===id); if(!session)return;
      editingSessionId=id; currentDay=session.dayId||'day1';
      $$('.day-switch button').forEach(b=>b.classList.toggle('active',b.dataset.day===currentDay));
      $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.panel==='trainingPanel'));
      $$('.panel').forEach(p=>p.classList.toggle('active',p.id==='trainingPanel'));
      $('#saveWorkout').textContent='更新这次训练'; $('#cancelEditWorkout').hidden=false; renderDay(); window.scrollTo({top:0,behavior:'smooth'}); return;
    }
    if(action==='edit-plank'){
      const plank=state.planks.find(p=>p.id===id); if(!plank)return;
      editingPlankId=id; plankTotalSeconds=plank.durationSeconds; plankRemainingSeconds=plankTotalSeconds;
      $('#plankMinutes').value=Math.floor(plankTotalSeconds/60); $('#plankSeconds').value=plankTotalSeconds%60; renderPlankTimer();
    }
  });
  $('#calendarPrev').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});
  $('#calendarNext').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});

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
      `<article class="metric-item"><div class="history-head"><div><h3>${m.date}</h3><p>${Number.isFinite(m.weight)?`体重 ${m.weight} kg`:'体重 —'} · ${Number.isFinite(m.waist)?`腰围 ${m.waist} cm`:'腰围 —'}</p>${m.note?`<p>${escapeHtml(m.note)}</p>`:''}</div><div class="record-actions"><button class="text-action" data-metric-action="edit" data-date="${m.date}">编辑</button><button class="text-action danger-action" data-metric-action="delete" data-date="${m.date}">删除</button></div></div></article>`
    ).join('');
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  $('#metricDate').value = today();
  $('#metricForm').addEventListener('submit', e => {
    e.preventDefault();
    const date = editingMetricDate || today();
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
    editingMetricDate = null;
    $('#metricDateHint').textContent = '保存时自动记录今天的日期';
    toast('身体数据已保存');
  });

  $('#metricList').addEventListener('click', e => {
    const btn=e.target.closest('button[data-metric-action]'); if(!btn)return;
    const metric=state.metrics.find(m=>m.date===btn.dataset.date); if(!metric)return;
    if(btn.dataset.metricAction==='delete' && confirm('删除这条身体数据？')){state.metrics=state.metrics.filter(m=>m.date!==metric.date);persist();renderMetrics();return;}
    if(btn.dataset.metricAction==='edit'){
      editingMetricDate=metric.date; $('#metricDate').value=metric.date; $('#metricWeight').value=metric.weight??''; $('#metricWaist').value=metric.waist??''; $('#metricNote').value=metric.note||''; $('#metricDateHint').textContent=`正在编辑 ${metric.date}`; window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
    }
  });

  $$('.bottom-nav button').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.panel;
    $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === id));
    if (id === 'historyPanel') renderHistory();
    if (id === 'dataPanel') renderMetrics();
    window.scrollTo({top:0, behavior:'smooth'});
  }));

  $$('.guide-tabs button').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.guide;
    $$('.guide-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.guide-content').forEach(card => card.classList.toggle('active', card.id === id));
  }));

  const guideSidebar = $('#guideSidebar');
  const guideOverlay = $('#guideOverlay');
  const guideMenuBtn = $('#guideMenuBtn');
  const closeGuide = () => {
    guideSidebar.classList.remove('open');
    guideOverlay.hidden = true;
    guideMenuBtn.setAttribute('aria-expanded', 'false');
  };
  guideMenuBtn.addEventListener('click', () => {
    guideSidebar.classList.add('open');
    guideOverlay.hidden = false;
    guideMenuBtn.setAttribute('aria-expanded', 'true');
  });
  $('#guideCloseBtn').addEventListener('click', closeGuide);
  guideOverlay.addEventListener('click', closeGuide);

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
      state.planks = Array.isArray(parsed.planks) ? parsed.planks : [];
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
    state.sessions = []; state.metrics = []; state.planks = []; persist();
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
