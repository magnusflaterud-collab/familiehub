/* app.js — Familiehub klientlogikk */

// ── Konstanter ────────────────────────────────────────────────────────────────
const DAYS_S  = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
const DAYS_L  = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
const MONTHS  = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];

// Tilstand
let choreFilter   = 'all';
let pendingDate   = null;
let addTab        = 'event';
let selectedWho   = new Set();

// ── Hjelp: datoer ─────────────────────────────────────────────────────────────
function fmtDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseDate(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); }
function isSameDay(a, b) { return fmtDate(a) === fmtDate(b); }
function getMon(d) { const r = new Date(d); const dow = r.getDay()===0?6:r.getDay()-1; r.setDate(r.getDate()-dow); r.setHours(0,0,0,0); return r; }
function getWeekNum(d) {
  const t = new Date(d); t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - (t.getDay()+6)%7);
  const w = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t-w)/86400000 - 3 + (w.getDay()+6)%7) / 7);
}
function shortDateLabel(d) { return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function fmtNorwegian(dateStr) {
  const d = parseDate(dateStr);
  return `${DAYS_L[d.getDay()===0?6:d.getDay()-1]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

// ── Hjelp: API ────────────────────────────────────────────────────────────────
async function apiGet(url)        { return fetch(url).then(r => r.json()); }
async function apiPost(url, data) { return fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})}).then(r=>r.json()); }
async function apiDel(url)        { return fetch(url, {method:'DELETE'}).then(r=>r.json()); }
async function apiPatch(url, d)   { return fetch(url, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()); }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Aktiv bruker ──────────────────────────────────────────────────────────────
function renderWho() {
  const c = document.getElementById('who-btns');
  c.innerHTML = MEMBERS.map(m =>
    `<div class="av-btn${m.id===activeUserId?' active':''}"
      style="background:${m.bg_color};color:${m.text_color};"
      onclick="setActive(${m.id})" title="${m.name}">${m.initials}</div>`
  ).join('');
}
function setActive(id) { activeUserId = id; renderWho(); toast(`Aktiv: ${memberName(id)}`); }
function member(id)    { return MEMBERS.find(m=>m.id===id); }
function memberName(id){ const m=member(id); return m?m.name:'?'; }

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${name}`).style.display = '';
  document.querySelector(`.tab-btn[onclick="showTab('${name}')"]`).classList.add('active');
  document.getElementById('scroll-today').style.display = name === 'kalender' ? '' : 'none';

  if (name === 'oppgaver')   loadChores();
  if (name === 'middag')     loadDinners();
  if (name === 'kjoleskap')  loadFridge();
  if (name === 'handlelist') loadGroceries();
  if (name === 'chat')       loadChat();
}

// ══════════════════════════════════════════════════════════════════════════════
// KALENDER — uendelig rulle
// ══════════════════════════════════════════════════════════════════════════════
function buildCalendar() {
  const container = document.getElementById('cal-container');
  const today     = new Date(); today.setHours(0,0,0,0);
  const start     = getMon(new Date(today.getTime() - 26*7*86400000));
  const WEEKS     = 26 + 1 + 52; // 26 back, current, 52 forward

  container.innerHTML = '';

  for (let w = 0; w < WEEKS; w++) {
    const mon   = new Date(start.getTime() + w*7*86400000);
    const sun   = new Date(mon.getTime() + 6*86400000);
    const wnum  = getWeekNum(mon);
    const isCur = mon <= today && today <= sun;

    const row = document.createElement('div');
    row.className = 'week-row' + (isCur ? ' current-week' : '');
    row.id = `week-${fmtDate(mon)}`;

    row.innerHTML = `<div class="week-label">
      <div class="week-num">Uke ${wnum}</div>
      <div class="week-dates">${shortDateLabel(mon)}<br>–${shortDateLabel(sun)}</div>
    </div>`;

    for (let d = 0; d < 7; d++) {
      const day    = new Date(mon.getTime() + d*86400000);
      const isToday = isSameDay(day, today);
      const dateStr = fmtDate(day);

      const col = document.createElement('div');
      col.className = 'day-col' + (isToday ? ' today' : '');
      col.dataset.date = dateStr;

      col.innerHTML = `
        <div class="day-header">
          <span class="day-name">${DAYS_S[d]}</span>
          <span class="day-num">${day.getDate()}</span>
        </div>
        <div class="day-events" id="day-${dateStr}"></div>
        <button class="day-add-btn" onclick="openDayModal('${dateStr}')">+ Legg til</button>`;
      row.appendChild(col);
    }

    container.appendChild(row);
  }
}

function scrollToToday() {
  const cur = document.querySelector('.current-week');
  if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadCalendarData() {
  const today = new Date();
  const from  = fmtDate(new Date(today.getTime() - 26*7*86400000));
  const to    = fmtDate(new Date(today.getTime() + 52*7*86400000));

  const data = await apiGet(`/api/calendar?from=${from}&to=${to}`);

  data.events.forEach(ev => {
    const c = document.getElementById(`day-${ev.date}`);
    if (c) c.appendChild(makeEventEl(ev));
  });
  data.chores.forEach(ch => {
    const c = document.getElementById(`day-${ch.date}`);
    if (c) c.appendChild(makeChoreCalEl(ch));
  });
  data.dinners.forEach(din => {
    const c = document.getElementById(`day-${din.date}`);
    if (c) c.appendChild(makeDinnerCalEl(din));
  });
}

function makeEventEl(ev) {
  const el = document.createElement('div');
  el.className = 'cal-ev event';
  el.dataset.id = ev.id;
  el.innerHTML = `<span class="ev-del" onclick="delEvent(${ev.id},this)">✕</span>
    <div class="ev-title">${ev.title}</div>
    ${ev.time ? `<div class="ev-sub">${ev.time}${ev.place?' · '+ev.place:''}</div>` : ''}`;
  return el;
}
function makeChoreCalEl(ch) {
  const el = document.createElement('div');
  el.className = 'cal-ev chore' + (ch.done ? ' done' : '');
  el.dataset.id = ch.id;
  el.style.cssText = `background:${ch.bg_color};border-color:${ch.color};color:${ch.text_color};`;
  el.innerHTML = `<span class="ev-del" onclick="delChore(${ch.id},this)">✕</span>
    <div class="ev-title" onclick="toggleChore(${ch.id},this)">${ch.done?'✓ ':''}${ch.name}</div>
    <div class="ev-sub">${ch.who_name||''}${ch.pts?' · '+ch.pts+'pt':''}</div>`;
  return el;
}
function makeDinnerCalEl(din) {
  const el = document.createElement('div');
  el.className = 'cal-ev dinner';
  el.dataset.id = din.id;
  el.innerHTML = `<span class="ev-del" onclick="delDinner(${din.id},this)">✕</span>
    <div class="ev-title">🍽 ${din.name}</div>`;
  return el;
}

// ── Slett fra kalender ────────────────────────────────────────────────────────
async function delEvent(id, el) {
  await apiDel(`/api/events/${id}`); el.closest('.cal-ev').remove(); toast('Slettet');
}
async function delChore(id, el) {
  await apiDel(`/api/chores/${id}`); el.closest('.cal-ev').remove(); toast('Slettet');
}
async function delDinner(id, el) {
  await apiDel(`/api/dinners/${id}`); el.closest('.cal-ev').remove(); toast('Slettet');
}
async function toggleChore(id, el) {
  await apiPost(`/api/chores/${id}/toggle`);
  const card = el.closest('.cal-ev');
  card.classList.toggle('done');
  el.textContent = (card.classList.contains('done') ? '✓ ' : '') + el.textContent.replace('✓ ','');
}

// ── Dag-modal ─────────────────────────────────────────────────────────────────
function openDayModal(dateStr) {
  pendingDate = dateStr;
  const d = parseDate(dateStr);
  document.getElementById('day-modal-title').textContent = `${DAYS_L[d.getDay()===0?6:d.getDay()-1]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  switchAddTab('event');
  openModal('day-modal');
}

function switchAddTab(tab) {
  addTab = tab;
  document.querySelectorAll('#day-modal .mtab').forEach((b,i) => b.classList.toggle('active', ['event','chore','dinner'][i]===tab));
  document.getElementById('add-event-form').style.display  = tab==='event'  ? '' : 'none';
  document.getElementById('add-chore-form').style.display  = tab==='chore'  ? '' : 'none';
  document.getElementById('add-dinner-form').style.display = tab==='dinner' ? '' : 'none';

  if (tab === 'event') {
    selectedWho = new Set(MEMBERS.map(m=>m.id));
    renderWhoChecks('ae-who');
    populateMemberSelect('ae-who', null); // just checks
  }
  if (tab === 'chore') populateMemberSelect('ac-who');
}

function renderWhoChecks(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = MEMBERS.map(m =>
    `<div class="who-check${selectedWho.has(m.id)?' sel':''}"
      style="${selectedWho.has(m.id)?'border-color:'+m.color+';background:'+m.bg_color+';color:'+m.text_color+';':''}"
      onclick="toggleWho(${m.id},'${containerId}')">${m.name}</div>`
  ).join('');
}
function toggleWho(id, containerId) {
  selectedWho.has(id) ? selectedWho.delete(id) : selectedWho.add(id);
  renderWhoChecks(containerId);
}
function populateMemberSelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = MEMBERS.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

async function saveEvent() {
  const title = document.getElementById('ae-title').value.trim();
  if (!title || !pendingDate) return;
  const res = await apiPost('/api/events', {
    title, date: pendingDate,
    time:  document.getElementById('ae-time').value.trim(),
    place: document.getElementById('ae-place').value.trim(),
    type:  document.getElementById('ae-type').value,
    who:   [...selectedWho],
  });
  const c = document.getElementById(`day-${pendingDate}`);
  if (c) c.appendChild(makeEventEl({...res, title, time: document.getElementById('ae-time').value.trim(), place: document.getElementById('ae-place').value.trim(), date: pendingDate}));
  document.getElementById('ae-title').value = '';
  closeModal('day-modal'); toast('Hendelse lagt til ✓');
}

async function saveChoreFromCal() {
  const name = document.getElementById('ac-name').value.trim();
  if (!name || !pendingDate) return;
  const who_id = parseInt(document.getElementById('ac-who').value);
  const pts    = parseInt(document.getElementById('ac-pts').value);
  const res    = await apiPost('/api/chores', {name, who_id, date: pendingDate, pts});
  const m      = member(who_id);
  const c      = document.getElementById(`day-${pendingDate}`);
  if (c && m) c.appendChild(makeChoreCalEl({...res, name, who_name: m.name, color: m.color, bg_color: m.bg_color, text_color: m.text_color, pts, done: false}));
  document.getElementById('ac-name').value = '';
  closeModal('day-modal'); toast('Oppgave lagt til ✓');
}

async function saveDinnerFromCal() {
  const name = document.getElementById('ad-name').value.trim();
  if (!name || !pendingDate) return;
  const ings = document.getElementById('ad-ings').value.split(',').map(s=>s.trim()).filter(Boolean);
  const res  = await apiPost('/api/dinners', {name, date: pendingDate, ingredients: ings});
  const c    = document.getElementById(`day-${pendingDate}`);
  if (c) c.appendChild(makeDinnerCalEl({...res, name, date: pendingDate}));
  document.getElementById('ad-name').value = '';
  document.getElementById('ad-ings').value = '';
  closeModal('day-modal'); toast('Middag lagt til ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// OPPGAVER
// ══════════════════════════════════════════════════════════════════════════════
async function loadChores() {
  const data = await apiGet('/api/chores');
  renderChoreFilter(data);
  renderChoreList(data);
}

function renderChoreFilter(data) {
  const c = document.getElementById('chore-filter');
  const all = [{id:'all', name:'Alle', initials:'AL', color:'#888', bg_color:'#f0f0f0', text_color:'#333'}, ...MEMBERS];
  c.innerHTML = all.map(m =>
    `<div class="mf-btn${choreFilter===String(m.id)?' active':''}" onclick="setChoreFilter('${m.id}')">
      <div class="mf-av" style="background:${m.bg_color};color:${m.text_color};">${m.initials}</div>${m.name}
    </div>`
  ).join('');
  c._data = data;
}

function setChoreFilter(id) {
  choreFilter = String(id);
  const data = document.getElementById('chore-filter')._data || [];
  renderChoreFilter(data);
  renderChoreList(data);
}

function renderChoreList(data) {
  const filtered = choreFilter === 'all' ? data : data.filter(c => String(c.who_id) === choreFilter);
  const el = document.getElementById('chore-list');
  if (!filtered.length) { el.innerHTML = '<div class="empty">Ingen oppgaver ennå.</div>'; return; }
  el.innerHTML = filtered.map(c => {
    const m = member(c.who_id);
    return `<div class="chore-card${c.done?' done':''}" id="chore-${c.id}">
      <div class="chore-check${c.done?' checked':''}"
        style="${c.done&&m?'background:'+m.color+';border-color:'+m.color+';':''}"
        onclick="toggleChoreCard(${c.id})">${c.done?'✓':''}</div>
      <div class="chore-info">
        <div class="chore-name">${c.name}</div>
        <div class="chore-meta">${fmtNorwegian(c.date)} · ${c.who_name||'?'} · ${c.pts}pt</div>
      </div>
      <span class="chore-pts">${c.pts}pt</span>
      <span class="chore-del" onclick="deleteChoreCard(${c.id})">🗑</span>
    </div>`;
  }).join('');
}

async function toggleChoreCard(id) {
  await apiPost(`/api/chores/${id}/toggle`);
  loadChores();
}
async function deleteChoreCard(id) {
  await apiDel(`/api/chores/${id}`);
  document.getElementById(`chore-${id}`)?.remove();
  toast('Slettet');
}

async function saveChoreStandalone() {
  const name = document.getElementById('cm-name').value.trim();
  const date = document.getElementById('cm-date').value;
  if (!name || !date) return;
  await apiPost('/api/chores', {
    name, date,
    who_id: parseInt(document.getElementById('cm-who').value),
    pts:    parseInt(document.getElementById('cm-pts').value),
  });
  document.getElementById('cm-name').value = '';
  closeModal('chore-modal'); loadChores(); toast('Oppgave lagt til ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// MIDDAG
// ══════════════════════════════════════════════════════════════════════════════
async function loadDinners() {
  const today = new Date();
  const from  = fmtDate(new Date(today.getTime() - 7*86400000));
  const to    = fmtDate(new Date(today.getTime() + 30*86400000));
  const data  = await apiGet(`/api/calendar?from=${from}&to=${to}`);
  const el    = document.getElementById('dinner-list');
  if (!data.dinners.length) { el.innerHTML = '<div class="empty">Ingen middager lagt til ennå.</div>'; return; }
  el.innerHTML = data.dinners.map(d =>
    `<div class="dinner-card">
      <div class="dinner-top">
        <div class="dinner-name">${d.name}</div>
        <div class="dinner-date">${fmtNorwegian(d.date)}</div>
        <span style="cursor:pointer;font-size:12px;color:var(--tx3);" onclick="delDinnerCard(${d.id})">🗑</span>
      </div>
      <div class="ings">${d.ingredients.map(i=>`<span class="ing">${i}</span>`).join('')}</div>
    </div>`
  ).join('');
}

async function delDinnerCard(id) {
  await apiDel(`/api/dinners/${id}`);
  loadDinners(); toast('Slettet');
}

async function saveDinnerStandalone() {
  const name = document.getElementById('dm-name').value.trim();
  const date = document.getElementById('dm-date').value;
  if (!name || !date) return;
  const ings = document.getElementById('dm-ings').value.split(',').map(s=>s.trim()).filter(Boolean);
  await apiPost('/api/dinners', {name, date, ingredients: ings});
  document.getElementById('dm-name').value = '';
  document.getElementById('dm-ings').value = '';
  closeModal('dinner-modal'); loadDinners(); toast('Middag lagt til ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// KJØLESKAP
// ══════════════════════════════════════════════════════════════════════════════
async function loadFridge() {
  const data = await apiGet('/api/fridge');
  const el   = document.getElementById('fridge-view');
  const secs = {fridge: 'Kjøleskap', pantry: 'Pantry', freezer: 'Fryser'};
  let html = '';
  for (const [key, label] of Object.entries(secs)) {
    const items = data.filter(i => i.section === key);
    if (!items.length && key !== 'fridge') continue;
    html += `<div class="fridge-section">
      <div class="fridge-section-title">${label}</div>
      <div class="fridge-grid">
        ${items.map(i => {
          const st = i.qty === 0 ? 'out' : i.qty <= 1 ? 'low' : 'plenty';
          const lb = {plenty:'Nok', low:'Lite', out:'Tomt'}[st];
          return `<div class="fridge-item ${key}-sec" id="fi-${i.id}">
            <span class="fi-badge ${st}">${lb}</span>
            <div class="fi-name">${i.name}</div>
            <div class="fi-unit">${i.unit}</div>
            <div class="fi-row">
              <button class="fi-btn" onclick="adjFridge(${i.id},-1)">−</button>
              <span class="fi-num">${i.qty}</span>
              <button class="fi-btn" onclick="adjFridge(${i.id},1)">+</button>
            </div>
            <span class="fi-del" onclick="delFridge(${i.id})">🗑</span>
          </div>`;
        }).join('')}
        ${key==='fridge' ? `<div class="fridge-item fridge-sec" style="display:flex;align-items:center;justify-content:center;cursor:pointer;border-style:dashed;color:#378ADD;" onclick="openModal('fridge-modal')">+ Legg til</div>` : ''}
      </div>
    </div>`;
  }
  el.innerHTML = html || '<div class="empty">Kjøleskapet er tomt.</div>';
}

async function adjFridge(id, delta) {
  const data = await apiPatch(`/api/fridge/${id}`, {delta});
  loadFridge();
}
async function delFridge(id) {
  await apiDel(`/api/fridge/${id}`); loadFridge(); toast('Slettet');
}
async function saveFridgeItem() {
  const name = document.getElementById('fm-name').value.trim();
  if (!name) return;
  await apiPost('/api/fridge', {
    name,
    section: document.getElementById('fm-sec').value,
    qty:     parseFloat(document.getElementById('fm-qty').value) || 1,
    unit:    document.getElementById('fm-unit').value.trim() || 'stk',
  });
  document.getElementById('fm-name').value = '';
  document.getElementById('fm-unit').value = '';
  document.getElementById('fm-qty').value  = '1';
  closeModal('fridge-modal'); loadFridge(); toast('Vare lagt til ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLELISTE
// ══════════════════════════════════════════════════════════════════════════════
async function loadGroceries() {
  const data = await apiGet('/api/groceries');
  const el   = document.getElementById('groc-list');
  if (!data.length) { el.innerHTML = '<div class="empty">Handlelisten er tom.</div>'; return; }
  el.innerHTML = data.map(g =>
    `<div class="groc-item${g.checked?' checked':''}">
      <input type="checkbox"${g.checked?' checked':''} onchange="toggleGroc(${g.id})">
      <span class="groc-name">${g.name}</span>
      <button class="groc-del" onclick="delGroc(${g.id})">×</button>
    </div>`
  ).join('');
}

async function addGrocery() {
  const inp = document.getElementById('groc-input');
  const val = inp.value.trim(); if (!val) return;
  const items = val.split(',').map(s=>s.trim()).filter(Boolean);
  for (const name of items) await apiPost('/api/groceries', {name});
  inp.value = ''; loadGroceries();
}

async function toggleGroc(id) { await apiPost(`/api/groceries/${id}/toggle`); loadGroceries(); }
async function delGroc(id)    { await apiDel(`/api/groceries/${id}`); loadGroceries(); }

// ══════════════════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════════════════
async function loadChat() {
  const data = await apiGet('/api/messages');
  const el   = document.getElementById('chat-msgs');
  el.innerHTML = data.map(msg => {
    const isMe = msg.user_id === CURRENT_USER.id;
    return `<div class="chat-msg ${isMe?'me':'other'}">
      ${!isMe ? `<div class="chat-msg-name">${msg.user_name||'?'}</div>` : ''}
      <div class="chat-bubble">${msg.text}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendMsg() {
  const inp  = document.getElementById('chat-in');
  const text = inp.value.trim(); if (!text) return;
  inp.value  = '';
  await apiPost('/api/messages', {text});
  loadChat();
}

// ── MODALER ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  document.querySelectorAll('.modal-bg.open').forEach(m => {
    if (e.target === m) closeModal(m.id);
  });
});

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Fyll inn bruker-velger
  renderWho();

  // Fyll inn select-bokser i modaler
  const selects = ['ac-who','cm-who'];
  selects.forEach(id => {
    const s = document.getElementById(id);
    if (s) s.innerHTML = MEMBERS.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  });

  // Standard dato for standalone-modaler
  const todayStr = fmtDate(new Date());
  ['cm-date','dm-date'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = todayStr;
  });

  // Bygg kalenderen
  buildCalendar();

  // Scroll til i dag
  scrollToToday();

  // Hent data
  loadCalendarData();

  // Vis "i dag"-knapp i kalender-tab
  document.getElementById('scroll-today').style.display = '';
});
