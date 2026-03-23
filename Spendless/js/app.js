// ── CONSTANTS ──
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CAT_ICONS = {
  Food: '🍔',
  Transport: '🚌',
  Data: '📶',
  Entertainment: '🎮',
  Groceries: '🛒',
  Other: '📦',
  Salary: '💼',
  Freelance: '💻',
  'Side hustle': '🌱',
  Gift: '🎁',
  Refund: '↩'
};

// ── STATE ──
let state = {
  transactions: [],
  settings: { dailyLimit: 200 },
  ui: {
    expInput: '0',
    incInput: '0',
    expCat: 'Food',
    incCat: 'Salary'
  }
};

// ── PERSISTENCE ──
function loadState() {
  try {
    const tx  = localStorage.getItem('sl_tx');
    const cfg = localStorage.getItem('sl_cfg');
    if (tx)  state.transactions = JSON.parse(tx);
    if (cfg) state.settings = { ...state.settings, ...JSON.parse(cfg) };
  } catch (e) {
    console.warn('Could not load saved data:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem('sl_tx',  JSON.stringify(state.transactions));
    localStorage.setItem('sl_cfg', JSON.stringify(state.settings));
  } catch (e) {
    console.warn('Could not save data:', e);
  }
}

// ── NAVIGATION ──
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (screenId === 'screen-home')     renderHome();
  if (screenId === 'screen-history')  renderHistory();
  if (screenId === 'screen-settings') renderSettings();
}

// ── NUMPAD INPUT ──
function numTap(type, digit) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  if (state.ui[key] === '0') {
    state.ui[key] = digit;
  } else {
    state.ui[key] += digit;
  }
  if (state.ui[key].length > 7) {
    state.ui[key] = state.ui[key].slice(0, 7);
  }
  renderInput(type);
}

function numDel(type) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  state.ui[key] = state.ui[key].slice(0, -1) || '0';
  renderInput(type);
}

function renderInput(type) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  const elId = type === 'expense' ? 'exp-disp' : 'inc-disp';
  const el = document.getElementById(elId);
  el.innerHTML = parseInt(state.ui[key]).toLocaleString() + '<span class="cursor"></span>';
}

function resetForm(type) {
  if (type === 'expense') {
    state.ui.expInput = '0';
    state.ui.expCat   = 'Food';
    document.getElementById('exp-note').value = '';
    renderInput('expense');
    document.querySelectorAll('#exp-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-expense');
      if (b.dataset.cat === 'Food') b.classList.add('sel-expense');
    });
  } else {
    state.ui.incInput = '0';
    state.ui.incCat   = 'Salary';
    document.getElementById('inc-note').value = '';
    renderInput('income');
    document.querySelectorAll('#inc-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-income');
      if (b.dataset.cat === 'Salary') b.classList.add('sel-income');
    });
  }
}

// ── CATEGORY SELECTION ──
function pickCat(btn, type) {
  const gridId = type === 'expense' ? 'exp-cats' : 'inc-cats';
  const cls    = type === 'expense' ? 'sel-expense' : 'sel-income';
  document.getElementById(gridId).querySelectorAll('.cat-btn').forEach(b => b.classList.remove(cls));
  btn.classList.add(cls);
  if (type === 'expense') state.ui.expCat = btn.dataset.cat;
  else                    state.ui.incCat  = btn.dataset.cat;
}

// ── SUBMIT TRANSACTION ──
function submitTx(type) {
  const raw    = type === 'expense' ? state.ui.expInput : state.ui.incInput;
  const amount = parseInt(raw);

  if (!amount || amount <= 0) {
    goTo('screen-home');
    return;
  }

  const cat  = type === 'expense' ? state.ui.expCat : state.ui.incCat;
  const note = document.getElementById(type === 'expense' ? 'exp-note' : 'inc-note').value.trim();

  state.transactions.unshift({
    id:   Date.now(),
    type,
    amount,
    cat,
    note,
    date: new Date().toISOString()
  });

  saveState();
  resetForm(type);
  goTo('screen-home');
}

// ── HELPERS ──
function todayStr() {
  return new Date().toDateString();
}

function fmt(n) {
  return 'R' + Math.abs(n).toLocaleString();
}

// ── HOME RENDER ──
function renderHome() {
  const today   = todayStr();
  const limit   = state.settings.dailyLimit;
  const todayTx = state.transactions.filter(t => new Date(t.date).toDateString() === today);

  const income  = todayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = todayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance   = income - expense;
  const remaining = limit - expense;
  const pct       = Math.min(100, Math.round((expense / limit) * 100));
  const statusCls = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';

  // Clock & date
  const now = new Date();
  document.getElementById('clock-home').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('home-day').textContent   = DAYS[now.getDay()] + ', ' + now.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Balances
  document.getElementById('home-balance').textContent = (balance < 0 ? '-' : '') + fmt(balance);
  document.getElementById('meta-inc').textContent     = fmt(income);
  document.getElementById('meta-exp').textContent     = fmt(expense);
  document.getElementById('spent-val').textContent    = fmt(expense);
  document.getElementById('pct-lbl').textContent      = pct + '% used';
  document.getElementById('limit-of').textContent     = 'of ' + fmt(limit);

  // Remaining
  const remEl = document.getElementById('limit-rem');
  remEl.className   = 'limit-remaining ' + statusCls;
  remEl.textContent = (remaining < 0 ? '-' : '') + fmt(remaining);

  // Progress bar
  const bar = document.getElementById('prog');
  bar.className  = 'progress-fill ' + statusCls;
  bar.style.width = pct + '%';

  // Alert banner
  const alert = document.getElementById('alert');
  if (pct >= 100) {
    alert.className   = 'alert-banner alert-over';
    alert.textContent = 'Daily limit exceeded — stop spending now';
  } else if (pct >= 75) {
    alert.className   = 'alert-banner alert-warn';
    alert.textContent = 'Warning: only ' + fmt(remaining) + ' left today';
  } else {
    alert.className   = 'alert-banner alert-ok';
    alert.textContent = "You're within your limit — keep it up";
  }

  // Transaction list
  const list = document.getElementById('tx-list');
  if (!todayTx.length) {
    list.innerHTML = '<div class="tx-empty">No transactions yet today</div>';
    return;
  }

  list.innerHTML = todayTx.slice(0, 20).map(t => `
    <div class="tx-item">
      <div class="tx-left">
        <div class="tx-icon ${t.type}">${CAT_ICONS[t.cat] || '💸'}</div>
        <div>
          <div class="tx-name">${t.note || t.cat}</div>
          <div class="tx-cat">${t.cat}</div>
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type === 'expense' ? '−' : '+'}${fmt(t.amount)}</div>
        <div class="tx-time">${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  `).join('');
}

// ── HISTORY RENDER ──
function renderHistory() {
  const grouped = {};
  state.transactions.forEach(t => {
    const d = new Date(t.date).toDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });

  const list = document.getElementById('history-list');

  if (!Object.keys(grouped).length) {
    list.innerHTML = '<div class="tx-empty" style="padding:40px 0">No history yet</div>';
    return;
  }

  list.innerHTML = Object.keys(grouped).map(day => {
    const txs = grouped[day];
    const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const d   = new Date(day);

    const dayHeader = `<div class="history-day-label">${DAYS[d.getDay()]}, ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} &nbsp;·&nbsp; <span style="color:var(--red)">${fmt(exp)}</span> spent</div>`;

    const rows = txs.map(t => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon ${t.type}">${CAT_ICONS[t.cat] || '💸'}</div>
          <div>
            <div class="tx-name">${t.note || t.cat}</div>
            <div class="tx-cat">${t.cat}</div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">${t.type === 'expense' ? '−' : '+'}${fmt(t.amount)}</div>
          <div class="tx-time">${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join('');

    return dayHeader + rows;
  }).join('');
}

// ── SETTINGS RENDER ──
function renderSettings() {
  document.getElementById('limit-input').value = state.settings.dailyLimit;

  const total   = state.transactions.length;
  const days    = new Set(state.transactions.map(t => new Date(t.date).toDateString())).size;
  const allExp  = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-days').textContent     = days;
  document.getElementById('stat-expenses').textContent = fmt(allExp);
}

function saveLimit() {
  const v = parseInt(document.getElementById('limit-input').value);
  if (v > 0) {
    state.settings.dailyLimit = v;
    saveState();
  }
}

function clearData() {
  if (confirm('Clear all transactions? This cannot be undone.')) {
    state.transactions = [];
    saveState();
    renderSettings();
  }
}

// ── CLOCK ──
function updateClock() {
  const el = document.getElementById('clock-home');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── INIT ──
loadState();
renderHome();
renderInput('expense');
renderInput('income');
updateClock();
setInterval(updateClock, 30000);
