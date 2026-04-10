/* app.js — Familiehub klientlogikk */

const DAGER     = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
const DAGERFULL = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
const MEMBERS   = [
  { id:'mamma', name:'Mamma', initials:'M', color:'#D4537E', bg:'#FBEAF0', textColor:'#72243E' },
  { id:'pappa', name:'Pappa', initials:'P', color:'#185FA5', bg:'#E6F1FB', textColor:'#0C447C' },
  { id:'emma',  name:'Emma',  initials:'E', color:'#1D9E75', bg:'#E1F5EE', textColor:'#085041' },
  { id:'liam',  name:'Liam',  initials:'L', color:'#7F77DD', bg:'#EEEDFE', textColor:'#3C3489' },
];

// ─── UKEBEREGNING ─────────────────────────────────────────────────────────────
const now       = new Date();
const dow       = now.getDay() === 0 ? 6 : now.getDay() - 1;
const weekStart = new Date(now);
weekStart.setDate(now.getDate() - dow);
const DATES  = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d.getDate();
});
const TODAY_I = dow;

// ─── TILSTAND ─────────────────────────────────────────────────────────────────
let STATE = {};
let choreFilter          = 'alle';
let pendingCalDay        = 0;
let selectedEventMembers = new Set(MEMBERS.map(m => m.id));
let saveTimer            = null;

// ─── API ──────────────────────────────────────────────────────────────────────
async function loadState() {
  const r = await fetch('/api/data');
  STATE   = await r.json();
  renderAll();
}

function scheduleSave() {
  const s = document.getElementById('saving');
  s.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(STATE),
    });
    s.classList.remove('show');
  }, 600);
}

// ─── SNARVEIER ────────────────────────────────────────────────────────────────
const dinners        = () => STATE.dinners        || [];
const fridgeItems    = () => STATE.fridgeItems    || [];
const chores         = () => STATE.chores         || [];
const familyEvents   = () => STATE.familyEvents   || [];
const calExtras      = () => STATE.calExtras      || [];
const manualGroceries= () => STATE.manualGroceries|| [];
const chatMsgs       = () => STATE.chatMsgs       || [];
const currentUser    = () => STATE.currentUser    || 'mamma';

// ─── HJELPEFUNKSJONER ─────────────────────────────────────────────────────────
function member(id)       { return MEMBERS.find(m => m.id === id) || MEMBERS[0]; }
function fridgeStatus(f)  { return f.qty === 0 ? 'out' : f.qty <= 1 ? 'low' : 'plenty'; }
function evTypeLabel(t)   { return {familie:'Familie',sport:'Sport',skole:'Skole'}[t] || 'Annet'; }

function hasPlentyOf(ing) {
  const n = ing.toLowerCase().trim();
  return fridgeItems().some(f => {
    const fn = f.name.toLowerCase();
    return (fn.includes(n) || n.includes(fn)) && fridgeStatus(f) === 'plenty';
  });
}

function getIngredients() {
  const all = dinners().flatMap(d => d.ingredients);
  return [...new Set(all.map(i => i.toLowerCase().trim()))].map(i => ({
    ing: i, covered: hasPlentyOf(i),
  }));
}

function memberPoints(id) {
  return chores().filter(c => c.done && c.doneBy === id).reduce((s, c) => s + c.pts, 0);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ─── RENDER: HVEM ─────────────────────────────────────────────────────────────
function renderWho() {
  document.getElementById('who-buttons').innerHTML = MEMBERS.map(m =>
    `<div class="avatar-btn${currentUser() === m.id ? ' selected' : ''}"
      style="background:${m.bg};color:${m.textColor};"
      onclick="setUser('${m.id}')" title="${m.name}">${m.initials}</div>`
  ).join('');
}
function setUser(id) { STATE.currentUser = id; scheduleSave(); renderAll(); }

// ─── RENDER: KALENDER ─────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('week-header').innerHTML = DAGER.map((d, i) =>
    `<div class="dlabel${i === TODAY_I ? ' tod' : ''}">${d}<br>
     <span style="font-size:11px;">${DATES[i]}</span></div>`
  ).join('');

  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  DAGER.forEach((_, i) => {
    const col = document.createElement('div');
    col.className = 'dcol' + (i === TODAY_I ? ' tod' : '');
    col.innerHTML = `<div class="dnum">${DATES[i]}</div>`;

    dinners().filter(d => d.day === i).forEach(d => {
      const e = document.createElement('div'); e.className = 'ev dinner';
      e.innerHTML = `<div class="ev-type">Middag</div><div class="ev-title">${d.name}</div>`;
      col.appendChild(e);
    });

    chores().filter(c => c.day === i).forEach(c => {
      const m = member(c.who);
      const e = document.createElement('div');
      e.className = 'ev chore' + (c.done ? ' ev-done' : '');
      e.style.cssText = `background:${m.bg};border-color:${m.color};color:${m.textColor}`;
      const tick = c.done
        ? `<span class="done-tick" onclick="toggleChore(${c.id})">✓</span>`
        : `<span class="undone-tick" style="border-color:${m.color};" onclick="toggleChore(${c.id})"></span>`;
      e.innerHTML = `<div class="ev-row">${tick}<div>
        <div class="ev-type">Oppgave</div>
        <div class="ev-title">${c.name}</div>
        <div class="ev-who">${m.name}</div>
      </div></div>`;
      col.appendChild(e);
    });

    familyEvents().filter(ev => ev.date === DATES[i]).forEach(ev => {
      const e = document.createElement('div'); e.className = 'ev event';
      e.innerHTML = `<div class="ev-type">${evTypeLabel(ev.type)}</div>
                     <div class="ev-title">${ev.title}</div>
                     <div class="ev-who">${ev.time}</div>`;
      col.appendChild(e);
    });

    calExtras().filter(x => x.day === i).forEach(x => {
      const e = document.createElement('div'); e.className = 'ev shop';
      e.innerHTML = `<div class="ev-type">Handling</div><div class="ev-title">${x.title}</div>`;
      col.appendChild(e);
    });

    const ab = document.createElement('button');
    ab.className = 'add-b'; ab.textContent = '+ Legg til';
    ab.onclick = () => { pendingCalDay = i; openM('cal'); };
    col.appendChild(ab);
    grid.appendChild(col);
  });

  document.getElementById('s-dinners').textContent = dinners().length;
  document.getElementById('s-chores').textContent  = chores().filter(c => c.done).length + '/' + chores().length;
  document.getElementById('s-events').textContent  = familyEvents().length;
  document.getElementById('s-pts').textContent     = memberPoints(currentUser());
}

// ─── RENDER: KJØLESKAP ────────────────────────────────────────────────────────
function renderFridge() {
  const secClass = { fridge: 'kj', pantry: 'pa', freezer: 'fr' };
  ['fridge', 'pantry', 'freezer'].forEach(sec => {
    const el    = document.getElementById((sec === 'freezer' ? 'freezer' : sec) + '-shelf');
    const items = fridgeItems().filter(f => f.section === sec);
    const cls   = secClass[sec];
    el.innerHTML = items.map(f => {
      const gi  = STATE.fridgeItems.indexOf(f);
      const st  = fridgeStatus(f);
      const lbl = { plenty: 'Nok', low: 'Lite', out: 'Tomt' }[st];
      return `<div class="f-item ${cls}">
        <span class="f-badge ${st}">${lbl}</span>
        <div class="f-name">${f.name}</div>
        <div class="f-unit">${f.unit}</div>
        <div class="f-qty-row">
          <button class="f-btn" onclick="adjF(${gi},-1)">−</button>
          <div class="f-num">${f.qty}</div>
          <button class="f-btn" onclick="adjF(${gi},1)">+</button>
        </div>
      </div>`;
    }).join('') + (sec === 'fridge' ? `<div class="f-add" onclick="openM('fridge')">+ Legg til</div>` : '');
  });
}
function adjF(i, d) { STATE.fridgeItems[i].qty = Math.max(0, STATE.fridgeItems[i].qty + d); scheduleSave(); renderAll(); }

// ─── RENDER: OPPGAVER ─────────────────────────────────────────────────────────
function renderChores() {
  const all = [{ id: 'alle', name: 'Alle', initials: 'Alle', color: '#888780', bg: '#F1EFE8', textColor: '#444441' }, ...MEMBERS];
  document.getElementById('member-tabs').innerHTML = all.map(m =>
    `<div class="mtab${choreFilter === m.id ? ' active' : ''}" onclick="setChoreFilter('${m.id}')">
      <div style="width:20px;height:20px;border-radius:50%;background:${m.bg};color:${m.textColor};font-size:10px;font-weight:500;display:flex;align-items:center;justify-content:center;">${m.initials}</div>
      ${m.name}
    </div>`
  ).join('');

  const filtered = choreFilter === 'alle' ? chores() : chores().filter(c => c.who === choreFilter);
  document.getElementById('chore-list').innerHTML = filtered.length
    ? filtered.map(c => {
        const m = member(c.who);
        return `<div class="chore-card${c.done ? ' done-card' : ''}">
          <div class="chore-check${c.done ? ' checked' : ''}"
            style="${c.done ? 'background:' + m.color + ';border-color:' + m.color + ';' : ''}"
            onclick="toggleChore(${c.id})">${c.done ? '✓' : ''}</div>
          <div class="chore-info">
            <div class="chore-name">${c.name}</div>
            <div class="chore-meta">${DAGERFULL[c.day]} · ${m.name}${c.done && c.doneBy ? ' · Gjort av ' + member(c.doneBy).name : ''}</div>
          </div>
          <span class="chore-pts">${c.pts}pt</span>
        </div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--text-tertiary);padding:8px 0;">Ingen oppgaver.</div>';
}
function setChoreFilter(id) { choreFilter = id; renderChores(); }
function toggleChore(id) {
  const c = STATE.chores.find(x => x.id === id); if (!c) return;
  c.done = !c.done; c.doneBy = c.done ? currentUser() : null;
  scheduleSave(); renderAll();
}

// ─── RENDER: MIDDAG ───────────────────────────────────────────────────────────
function renderDinners() {
  document.getElementById('din-list').innerHTML = dinners().map(d =>
    `<div class="din-card">
      <div class="din-top">
        <div class="din-name">${d.name}</div>
        <div class="din-day-badge">${DAGERFULL[d.day]}</div>
      </div>
      <div class="ing-pills">${d.ingredients.map(i =>
        `<span class="ing-pill${hasPlentyOf(i) ? ' have' : ''}">${i}</span>`
      ).join('')}</div>
    </div>`
  ).join('');
}

// ─── RENDER: HENDELSER ────────────────────────────────────────────────────────
function renderEvents() {
  const sorted = [...familyEvents()].sort((a, b) => a.date - b.date);
  document.getElementById('event-list').innerHTML = sorted.length
    ? sorted.map(ev => {
        const pills = ev.who.map(id => {
          const m = member(id);
          return `<span class="event-who-pill" style="background:${m.bg};color:${m.textColor};">${m.name}</span>`;
        }).join('');
        return `<div class="event-card">
          <div class="event-date-box">
            <div class="event-date-d">${ev.date}</div>
            <div class="event-date-m">${ev.month}</div>
          </div>
          <div class="event-info">
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="event-title">${ev.title}</div>
              <span class="event-type-badge ${ev.type}">${evTypeLabel(ev.type)}</span>
            </div>
            <div class="event-sub">${ev.time}${ev.place ? ' · ' + ev.place : ''}</div>
            <div class="event-who-pills">${pills}</div>
          </div>
        </div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--text-tertiary);">Ingen hendelser planlagt ennå.</div>';
}

// ─── RENDER: HANDLELISTE ──────────────────────────────────────────────────────
function renderGroceries() {
  const items = getIngredients();
  const need  = items.filter(x => !x.covered);
  const have  = items.filter(x => x.covered);

  document.getElementById('g-need').innerHTML = need.length
    ? need.map(x => `<div class="g-row"><input type="checkbox" onchange="this.parentElement.classList.toggle('gck')"><span>${x.ing}</span><span class="gtag din">middag</span></div>`).join('')
    : '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">Alt er på lager!</div>';

  document.getElementById('g-manual').innerHTML = manualGroceries().length
    ? manualGroceries().map((it, i) =>
        `<div class="g-row${it.checked ? ' gck' : ''}">
          <input type="checkbox"${it.checked ? ' checked' : ''} onchange="toggleManual(${i})">
          <span>${it.name}</span><span class="gtag man">manuell</span>
          <button class="g-del" onclick="removeManual(${i})">×</button>
        </div>`).join('')
    : '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">Ingen manuelle varer ennå</div>';

  document.getElementById('g-have').innerHTML = have.length
    ? have.map(x => `<div class="g-row gck"><input type="checkbox" checked disabled><span>${x.ing}</span><span class="gtag cov">i kjøleskap</span></div>`).join('')
    : '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">Ingen hoppet over ennå</div>';
}
function addManual() {
  const inp = document.getElementById('manual-input');
  const val = inp.value.trim(); if (!val) return;
  val.split(',').map(s => s.trim()).filter(Boolean).forEach(v => STATE.manualGroceries.push({ name: v, checked: false }));
  inp.value = ''; scheduleSave(); renderGroceries();
}
function toggleManual(i)  { STATE.manualGroceries[i].checked = !STATE.manualGroceries[i].checked; scheduleSave(); renderGroceries(); }
function removeManual(i)  { STATE.manualGroceries.splice(i, 1); scheduleSave(); renderGroceries(); }

// ─── RENDER: CHAT ─────────────────────────────────────────────────────────────
function renderChat() {
  const box = document.getElementById('chat-msgs');
  box.innerHTML = chatMsgs().map(msg => {
    if (msg.type === 'leaderboard') {
      const sorted = [...MEMBERS].sort((a, b) => memberPoints(b.id) - memberPoints(a.id));
      const max    = Math.max(...sorted.map(m => memberPoints(m.id)), 1);
      return `<div class="msg bot"><div class="msg-name">Familiehub</div><div class="msg-bubble">
        <div style="font-weight:500;margin-bottom:8px;">Ukens poengliste</div>
        <div class="lb-card">${sorted.map((m, i) => `<div class="lb-row">
          <div class="lb-rank">${['🥇','🥈','🥉'][i] || i + 1}</div>
          <div class="lb-av" style="background:${m.bg};color:${m.textColor};">${m.initials}</div>
          <div class="lb-name">${m.name}</div>
          <div class="lb-bar-wrap"><div class="lb-bar" style="width:${Math.round(memberPoints(m.id) / max * 100)}%;background:${m.color};"></div></div>
          <div class="lb-pts">${memberPoints(m.id)}pt</div>
        </div>`).join('')}</div>
      </div></div>`;
    }
    const isMe = msg.from === currentUser();
    const m    = msg.from === 'bot' ? null : member(msg.from);
    return `<div class="msg ${isMe ? 'me' : 'bot'}">
      ${!isMe ? `<div class="msg-name">${m ? m.name : 'Familiehub'}</div>` : ''}
      <div class="msg-bubble">${msg.text}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function sendChat() {
  const inp = document.getElementById('chat-in');
  const txt = inp.value.trim(); if (!txt) return;
  STATE.chatMsgs.push({ from: currentUser(), text: txt }); inp.value = '';
  const low   = txt.toLowerCase();
  const reply = (text, type) => setTimeout(() => {
    STATE.chatMsgs.push(type ? { from: 'bot', type, text: '' } : { from: 'bot', text });
    scheduleSave(); renderChat();
  }, 400);

  if      (low.includes('poengliste') || low.includes('poeng') || low.includes('ledertavle')) reply('', 'leaderboard');
  else if (low.includes('oppgave'))  { const d = chores().filter(c => c.done).length; reply(`${d} av ${chores().length} gjort. ${chores().length - d} gjenstår!`); }
  else if (low.includes('middag'))   reply(`Denne uken: ${dinners().map(d => d.name).join(', ')}.`);
  else if (low.includes('handle'))   { const n = getIngredients().filter(x => !x.covered); reply(`Du trenger ${n.length} varer: ${n.map(x => x.ing).join(', ')}.`); }
  else if (low.includes('hendelse') || low.includes('plan')) {
    const e = [...familyEvents()].sort((a, b) => a.date - b.date).slice(0, 3);
    reply(`Kommende: ${e.map(x => x.title + ' (' + x.date + ' ' + x.month + ')').join(', ')}.`);
  }
  else if (low.includes('hei') || low.includes('hello')) reply(`Hei ${member(currentUser()).name}! 👋`);

  scheduleSave(); renderChat();
}

// ─── MODALER ──────────────────────────────────────────────────────────────────
function renderEventWhoChecks() {
  document.getElementById('ev-who-checks').innerHTML = MEMBERS.map(m =>
    `<div class="mcheck${selectedEventMembers.has(m.id) ? ' sel' : ''}"
      style="${selectedEventMembers.has(m.id) ? 'border-color:' + m.color + ';background:' + m.bg + ';color:' + m.textColor + ';' : ''}"
      onclick="toggleEventMember('${m.id}')">${m.name}</div>`
  ).join('');
}
function toggleEventMember(id) { selectedEventMembers.has(id) ? selectedEventMembers.delete(id) : selectedEventMembers.add(id); renderEventWhoChecks(); }
function openM(id) { if (id === 'event') { selectedEventMembers = new Set(MEMBERS.map(m => m.id)); renderEventWhoChecks(); } document.getElementById('m-' + id).classList.add('open'); }
function closeM(id) { document.getElementById('m-' + id).classList.remove('open'); }

function saveEvent() {
  const title = document.getElementById('ev-title').value.trim(); if (!title) return;
  STATE.familyEvents.push({ id: STATE.eventNextId++, title, date: parseInt(document.getElementById('ev-date').value) || 1,
    month: document.getElementById('ev-month').value, time: document.getElementById('ev-time').value.trim(),
    place: document.getElementById('ev-place').value.trim(), type: document.getElementById('ev-type').value, who: [...selectedEventMembers] });
  ['ev-title','ev-time','ev-place'].forEach(id => document.getElementById(id).value = '');
  scheduleSave(); closeM('event'); renderAll(); showToast('Hendelse lagt til ✓');
}
function saveDin() {
  const name = document.getElementById('din-name').value.trim(); if (!name) return;
  STATE.dinners.push({ day: parseInt(document.getElementById('din-day').value), name,
    ingredients: document.getElementById('din-ings').value.split(',').map(s => s.trim()).filter(Boolean) });
  ['din-name','din-ings'].forEach(id => document.getElementById(id).value = '');
  scheduleSave(); closeM('din'); renderAll(); showToast('Middag lagt til ✓');
}
function saveFridge() {
  const name = document.getElementById('fr-name').value.trim(); if (!name) return;
  STATE.fridgeItems.push({ name, qty: parseInt(document.getElementById('fr-qty').value) || 0,
    unit: document.getElementById('fr-unit').value.trim() || 'stk', section: document.getElementById('fr-section').value });
  ['fr-name','fr-unit'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fr-qty').value = '1';
  scheduleSave(); closeM('fridge'); renderAll(); showToast('Vare lagt til ✓');
}
function saveChore() {
  const name = document.getElementById('ch-name').value.trim(); if (!name) return;
  STATE.chores.push({ id: STATE.choreNextId++, name, who: document.getElementById('ch-who').value,
    day: parseInt(document.getElementById('ch-day').value), pts: parseInt(document.getElementById('ch-pts').value), done: false, doneBy: null });
  document.getElementById('ch-name').value = '';
  scheduleSave(); closeM('chore'); renderAll(); showToast('Oppgave lagt til ✓');
}
function saveCal() {
  const title = document.getElementById('cal-name').value.trim(); if (!title) return;
  STATE.calExtras.push({ day: pendingCalDay, type: document.getElementById('cal-type').value, title });
  document.getElementById('cal-name').value = '';
  scheduleSave(); closeM('cal'); renderAll(); showToast('Lagt til ✓');
}

// ─── NAVIGASJON ───────────────────────────────────────────────────────────────
function showPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(e => e.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelector(`.nav button[onclick="showPage('${p}')"]`).classList.add('active');
  renderAll();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function renderAll() { renderWho(); renderCalendar(); renderFridge(); renderChores(); renderDinners(); renderEvents(); renderGroceries(); renderChat(); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ch-who').innerHTML = MEMBERS.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.querySelectorAll('.modal-wrap').forEach(w => {
    w.addEventListener('click', e => { if (e.target === w) closeM(w.id.replace('m-', '')); });
  });
  loadState();
});
