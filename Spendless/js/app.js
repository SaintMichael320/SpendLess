// ─────────────────────────────────────────
// SPENDLESS — app.js
// ─────────────────────────────────────────

// ── CONSTANTS ──────────────────────────
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const CAT_ICONS = {
  Food:'🍔', Transport:'🚌', Data:'📶', Entertainment:'🎮', Groceries:'🛒', Other:'📦',
  Salary:'💼', Freelance:'💻', 'Side hustle':'🌱', Gift:'🎁', Refund:'↩'
};

const BUCKET_COLORS = ['#22c55e','#3b82f6','#f59e0b','#a855f7','#ec4899','#14b8a6','#f97316','#06b6d4'];

// ── STATE ───────────────────────────────
let state = {
  transactions: [],
  bills: [],
  buckets: [],
  settings: { dailyLimit: 200 },
  ui: {
    expInput: '0', incInput: '0',
    expCat: 'Food', incCat: 'Salary'
  }
};

// ── PERSISTENCE ─────────────────────────
function loadState() {
  try {
    const tx  = localStorage.getItem('sl_tx');
    const cfg = localStorage.getItem('sl_cfg');
    const bls = localStorage.getItem('sl_bills');
    const bks = localStorage.getItem('sl_buckets');
    if (tx)  state.transactions = JSON.parse(tx);
    if (cfg) state.settings     = { ...state.settings, ...JSON.parse(cfg) };
    if (bls) state.bills        = JSON.parse(bls);
    if (bks) state.buckets      = JSON.parse(bks);
  } catch (e) {
    console.warn('Could not load saved data:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem('sl_tx',      JSON.stringify(state.transactions));
    localStorage.setItem('sl_cfg',     JSON.stringify(state.settings));
    localStorage.setItem('sl_bills',   JSON.stringify(state.bills));
    localStorage.setItem('sl_buckets', JSON.stringify(state.buckets));
  } catch (e) {
    console.warn('Could not save data:', e);
  }
}

// ── NAVIGATION ──────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (screenId === 'screen-home')     renderHome();
  if (screenId === 'screen-bills')    renderBills();
  if (screenId === 'screen-buckets')  renderBuckets();
  if (screenId === 'screen-history')  renderHistory();
  if (screenId === 'screen-settings') renderSettings();
}

// ── NUMPAD ──────────────────────────────
function numTap(type, digit) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  state.ui[key] = state.ui[key] === '0' ? digit : state.ui[key] + digit;
  if (state.ui[key].length > 7) state.ui[key] = state.ui[key].slice(0, 7);
  renderInput(type);
}

function numDel(type) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  state.ui[key] = state.ui[key].slice(0, -1) || '0';
  renderInput(type);
}

function renderInput(type) {
  const key  = type === 'expense' ? 'expInput' : 'incInput';
  const elId = type === 'expense' ? 'exp-disp' : 'inc-disp';
  document.getElementById(elId).innerHTML =
    parseInt(state.ui[key]).toLocaleString() + '<span class="cursor"></span>';
}

function resetForm(type) {
  if (type === 'expense') {
    state.ui.expInput = '0'; state.ui.expCat = 'Food';
    document.getElementById('exp-note').value = '';
    renderInput('expense');
    document.querySelectorAll('#exp-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-expense');
      if (b.dataset.cat === 'Food') b.classList.add('sel-expense');
    });
  } else {
    state.ui.incInput = '0'; state.ui.incCat = 'Salary';
    document.getElementById('inc-note').value = '';
    renderInput('income');
    document.querySelectorAll('#inc-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-income');
      if (b.dataset.cat === 'Salary') b.classList.add('sel-income');
    });
  }
}

// ── CATEGORY PICK ───────────────────────
function pickCat(btn, type) {
  const gridId = type === 'expense' ? 'exp-cats' : 'inc-cats';
  const cls    = type === 'expense' ? 'sel-expense' : 'sel-income';
  document.getElementById(gridId).querySelectorAll('.cat-btn').forEach(b => b.classList.remove(cls));
  btn.classList.add(cls);
  if (type === 'expense') state.ui.expCat = btn.dataset.cat;
  else                    state.ui.incCat = btn.dataset.cat;
}

// ── SUBMIT TRANSACTION ──────────────────
function submitTx(type) {
  const raw    = type === 'expense' ? state.ui.expInput : state.ui.incInput;
  const amount = parseInt(raw);
  if (!amount || amount <= 0) { goTo('screen-home'); return; }

  const cat  = type === 'expense' ? state.ui.expCat : state.ui.incCat;
  const note = document.getElementById(type === 'expense' ? 'exp-note' : 'inc-note').value.trim();

  state.transactions.unshift({ id: Date.now(), type, amount, cat, note, date: new Date().toISOString() });

  // When income is logged, distribute to buckets
  if (type === 'income' && state.buckets.length) {
    distributeToBuckets(amount);
  }

  saveState();
  resetForm(type);
  goTo('screen-home');
}

// ── HELPERS ─────────────────────────────
function todayStr() { return new Date().toDateString(); }
function fmt(n)     { return 'R' + Math.abs(n).toLocaleString(); }

function daysUntilDue(dueDay) {
  const now   = new Date();
  const day   = now.getDate();
  const month = now.getMonth();
  const year  = now.getFullYear();

  let target = new Date(year, month, dueDay);
  if (dueDay <= day) target = new Date(year, month + 1, dueDay);

  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function dueCls(days) {
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'ok';
}

function dueLabel(days) {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// ── HOME RENDER ─────────────────────────
function renderHome() {
  const today   = todayStr();
  const limit   = state.settings.dailyLimit;
  const todayTx = state.transactions.filter(t => new Date(t.date).toDateString() === today);

  const income  = todayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = todayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance   = income - expense;
  const remaining = limit - expense;
  const pct       = Math.min(100, Math.round((expense / limit) * 100));
  const stCls     = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';

  const now = new Date();
  document.getElementById('clock-home').textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  document.getElementById('home-day').textContent   = DAYS[now.getDay()] + ', ' + now.toLocaleDateString([], { month:'short', day:'numeric' });

  document.getElementById('home-balance').textContent = (balance < 0 ? '-' : '') + fmt(balance);
  document.getElementById('meta-inc').textContent     = fmt(income);
  document.getElementById('meta-exp').textContent     = fmt(expense);
  document.getElementById('spent-val').textContent    = fmt(expense);
  document.getElementById('pct-lbl').textContent      = pct + '% used';
  document.getElementById('limit-of').textContent     = 'of ' + fmt(limit);

  const remEl = document.getElementById('limit-rem');
  remEl.className   = 'limit-remaining ' + stCls;
  remEl.textContent = (remaining < 0 ? '-' : '') + fmt(remaining);

  const bar = document.getElementById('prog');
  bar.className  = 'progress-fill ' + stCls;
  bar.style.width = pct + '%';

  const alertEl = document.getElementById('alert');
  if (pct >= 100) {
    alertEl.className   = 'alert-banner alert-over';
    alertEl.textContent = 'Daily limit exceeded — stop spending now';
  } else if (pct >= 75) {
    alertEl.className   = 'alert-banner alert-warn';
    alertEl.textContent = 'Warning: only ' + fmt(remaining) + ' left today';
  } else {
    alertEl.className   = 'alert-banner alert-ok';
    alertEl.textContent = "You're within your limit — keep it up";
  }

  renderBillsWidget();
  renderBucketsWidget();
  renderTxList(todayTx);
}

// ── BILLS WIDGET (home) ─────────────────
function renderBillsWidget() {
  const el = document.getElementById('bills-widget');
  if (!state.bills.length) { el.innerHTML = ''; return; }

  const unpaid  = state.bills.filter(b => !b.paid).sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay));
  const urgent2 = unpaid.slice(0, 2);
  if (!urgent2.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="bills-widget" style="margin-top:10px;">
      <div class="bills-widget-label">Upcoming bills</div>
      ${urgent2.map(b => {
        const days = daysUntilDue(b.dueDay);
        const cls  = dueCls(days);
        return `
          <div class="bill-widget-item">
            <div class="bill-widget-left">
              <div>
                <div class="bill-widget-name">${b.name}</div>
                <div class="bill-widget-due ${cls}">${dueLabel(days)}</div>
              </div>
            </div>
            <div class="bill-widget-amount">${fmt(b.amount)}</div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── BUCKETS WIDGET (home) ───────────────
function renderBucketsWidget() {
  const el = document.getElementById('buckets-widget');
  if (!state.buckets.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="buckets-widget" style="margin-top:10px;">
      <div class="buckets-widget-label">Buckets</div>
      <div class="buckets-widget-grid">
        ${state.buckets.map(b => `
          <div class="bucket-widget-card">
            <div class="bucket-widget-top">
              <span class="bucket-widget-emoji">${b.emoji || '🪣'}</span>
              <span class="bucket-widget-name">${b.name}</span>
            </div>
            <div class="bucket-widget-amount">${fmt(b.balance || 0)}</div>
            <div class="bucket-widget-pct">${b.pct}% of income</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── TX LIST ─────────────────────────────
function renderTxList(todayTx) {
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
        <div class="tx-time">${new Date(t.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
      </div>
    </div>`).join('');
}

// ── BILLS SCREEN ────────────────────────
function renderBills() {
  const totalMonthly = state.bills.reduce((s, b) => s + b.amount, 0);
  const unpaidCount  = state.bills.filter(b => !b.paid).length;

  document.getElementById('bills-summary').innerHTML = `
    <div class="bills-summary-total">Monthly commitments</div>
    <div class="bills-summary-amount">${fmt(totalMonthly)}</div>
    <div class="bills-summary-sub">${unpaidCount} of ${state.bills.length} bills still to pay this month</div>`;

  const sorted = [...state.bills].sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay));

  document.getElementById('bills-list').innerHTML = sorted.length
    ? sorted.map(b => {
        const days = daysUntilDue(b.dueDay);
        const cls  = b.paid ? 'ok' : dueCls(days);
        const cardCls = b.paid ? '' : (cls === 'urgent' ? 'urgent' : cls === 'soon' ? 'soon' : '');
        return `
          <div class="bill-card ${cardCls}">
            <div class="bill-card-left">
              <div class="bill-card-name">${b.name}</div>
              <div class="bill-card-due ${b.paid ? 'ok' : cls}">
                ${b.paid ? '✓ Paid this month' : dueLabel(days) + ' · ' + b.dueDay + ordinal(b.dueDay) + ' of month'}
              </div>
            </div>
            <div class="bill-card-right">
              <div class="bill-card-amount">${fmt(b.amount)}</div>
              <button class="bill-pay-btn ${b.paid ? 'paid' : 'unpaid'}" onclick="toggleBillPaid('${b.id}')">
                ${b.paid ? 'Paid' : 'Pay'}
              </button>
              <button class="bill-delete-btn" onclick="deleteBill('${b.id}')">✕</button>
            </div>
          </div>`;
      }).join('')
    : '<div class="tx-empty" style="padding:40px 0">No bills yet — add one below</div>';
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── ADD BILL ────────────────────────────
function openAddBill() {
  document.getElementById('bill-name').value   = '';
  document.getElementById('bill-amount').value = '';
  document.getElementById('bill-day').value    = '';
  document.getElementById('modal-bill').classList.add('open');
  setTimeout(() => document.getElementById('bill-name').focus(), 300);
}

function saveBill() {
  const name   = document.getElementById('bill-name').value.trim();
  const amount = parseInt(document.getElementById('bill-amount').value);
  const day    = parseInt(document.getElementById('bill-day').value);

  if (!name || !amount || !day || day < 1 || day > 28) {
    alert('Please fill in all fields. Due day must be between 1 and 28.');
    return;
  }

  state.bills.push({ id: Date.now().toString(), name, amount, dueDay: day, paid: false, paidMonth: null });
  saveState();
  closeModal('modal-bill');
  renderBills();
}

function toggleBillPaid(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;

  const nowMonth = new Date().toISOString().slice(0, 7);

  if (!bill.paid) {
    bill.paid      = true;
    bill.paidMonth = nowMonth;
    // Auto-log as expense
    state.transactions.unshift({
      id:     Date.now(),
      type:   'expense',
      amount: bill.amount,
      cat:    'Other',
      note:   bill.name + ' (bill)',
      date:   new Date().toISOString()
    });
  } else {
    bill.paid      = false;
    bill.paidMonth = null;
  }

  saveState();
  renderBills();
}

function deleteBill(id) {
  if (!confirm('Delete this bill?')) return;
  state.bills = state.bills.filter(b => b.id !== id);
  saveState();
  renderBills();
}

// Auto-reset bills at start of each new month
function checkBillReset() {
  const nowMonth = new Date().toISOString().slice(0, 7);
  state.bills.forEach(b => {
    if (b.paid && b.paidMonth && b.paidMonth !== nowMonth) {
      b.paid = false; b.paidMonth = null;
    }
  });
  saveState();
}

// ── BUCKETS SCREEN ───────────────────────
function renderBuckets() {
  const totalPct = state.buckets.reduce((s, b) => s + b.pct, 0);
  const remaining = 100 - totalPct;

  // Percentage bar
  const barEl = document.getElementById('pct-remaining-bar');
  const segments = state.buckets.map((b, i) =>
    `<div class="pct-bar-fill" style="width:${b.pct}%;background:${BUCKET_COLORS[i % BUCKET_COLORS.length]}"></div>`
  ).join('');

  barEl.innerHTML = `
    <div class="pct-bar-track">${segments}</div>
    <div class="pct-bar-label">
      <span>${totalPct}% allocated</span>
      <span class="${remaining < 0 ? 'over' : 'ok'}">${Math.abs(remaining)}% ${remaining < 0 ? 'over!' : 'remaining'}</span>
    </div>`;

  // Bucket cards
  const listEl = document.getElementById('buckets-list');
  listEl.innerHTML = state.buckets.length
    ? state.buckets.map((b, i) => {
        const color    = BUCKET_COLORS[i % BUCKET_COLORS.length];
        const fillPct  = b.balance && b.totalReceived ? Math.min(100, Math.round((b.balance / b.totalReceived) * 100)) : 100;
        return `
          <div class="bucket-card">
            <div class="bucket-card-top">
              <div class="bucket-card-left">
                <div class="bucket-card-emoji">${b.emoji || '🪣'}</div>
                <div>
                  <div class="bucket-card-name">${b.name}</div>
                  <div class="bucket-card-pct">${b.pct}% of income</div>
                </div>
              </div>
              <div class="bucket-card-right">
                <div class="bucket-card-amount" style="color:${color}">${fmt(b.balance || 0)}</div>
                <div class="bucket-card-of">received ${fmt(b.totalReceived || 0)}</div>
              </div>
            </div>
            <div class="bucket-card-bar-track">
              <div class="bucket-card-bar-fill" style="width:${fillPct}%;background:${color}"></div>
            </div>
            <button class="bucket-delete-btn" onclick="deleteBucket(${i})" style="margin-top:8px;float:right">✕ Remove</button>
          </div>`;
      }).join('')
    : '<div class="tx-empty" style="padding:40px 0">No buckets yet — add one below</div>';
}

// ── ADD BUCKET ───────────────────────────
function openAddBucket() {
  document.getElementById('bucket-name').value  = '';
  document.getElementById('bucket-emoji').value = '';
  document.getElementById('bucket-pct').value   = '';
  const used = state.buckets.reduce((s, b) => s + b.pct, 0);
  document.getElementById('bucket-pct-hint').textContent = `${100 - used}% of income still unallocated`;
  document.getElementById('modal-bucket').classList.add('open');
  setTimeout(() => document.getElementById('bucket-name').focus(), 300);
}

function saveBucket() {
  const name  = document.getElementById('bucket-name').value.trim();
  const emoji = document.getElementById('bucket-emoji').value.trim() || '🪣';
  const pct   = parseInt(document.getElementById('bucket-pct').value);

  if (!name || !pct || pct < 1 || pct > 100) {
    alert('Please fill in all fields. Percentage must be between 1 and 100.');
    return;
  }

  const totalUsed = state.buckets.reduce((s, b) => s + b.pct, 0);
  if (totalUsed + pct > 100) {
    alert(`Only ${100 - totalUsed}% remaining to allocate.`);
    return;
  }

  state.buckets.push({ id: Date.now().toString(), name, emoji, pct, balance: 0, totalReceived: 0 });
  saveState();
  closeModal('modal-bucket');
  renderBuckets();
}

function deleteBucket(index) {
  if (!confirm('Remove this bucket?')) return;
  state.buckets.splice(index, 1);
  saveState();
  renderBuckets();
}

// ── DISTRIBUTE INCOME TO BUCKETS ─────────
function distributeToBuckets(amount) {
  state.buckets.forEach(b => {
    const share = Math.round(amount * (b.pct / 100));
    b.balance       = (b.balance || 0) + share;
    b.totalReceived = (b.totalReceived || 0) + share;
  });
}

// ── MODAL HELPERS ───────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── HISTORY RENDER ──────────────────────
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
    return `
      <div class="history-day-label">
        ${DAYS[d.getDay()]}, ${d.toLocaleDateString([], { month:'short', day:'numeric' })}
        &nbsp;·&nbsp; <span style="color:var(--red)">${fmt(exp)}</span> spent
      </div>
      ${txs.map(t => `
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
            <div class="tx-time">${new Date(t.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
          </div>
        </div>`).join('')}`;
  }).join('');
}

// ── SETTINGS ────────────────────────────
function renderSettings() {
  document.getElementById('limit-input').value      = state.settings.dailyLimit;
  document.getElementById('stat-total').textContent = state.transactions.length;
  document.getElementById('stat-days').textContent  = new Set(state.transactions.map(t => new Date(t.date).toDateString())).size;
  document.getElementById('stat-bills').textContent   = state.bills.length;
  document.getElementById('stat-buckets').textContent = state.buckets.length;
  const allExp = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  document.getElementById('stat-expenses').textContent = fmt(allExp);
}

function saveLimit() {
  const v = parseInt(document.getElementById('limit-input').value);
  if (v > 0) { state.settings.dailyLimit = v; saveState(); }
}

function clearData() {
  if (confirm('Clear all transactions, bills, and buckets? This cannot be undone.')) {
    state.transactions = [];
    state.bills        = [];
    state.buckets      = [];
    saveState();
    renderSettings();
  }
}

// ── CLOCK ───────────────────────────────
function updateClock() {
  const el = document.getElementById('clock-home');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// ── INIT ────────────────────────────────
loadState();
checkBillReset();
renderHome();
renderInput('expense');
renderInput('income');
updateClock();
setInterval(updateClock, 30000);

// ── SERVICE WORKER ──────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('SpendLess: service worker registered'))
      .catch(err => console.warn('SpendLess: service worker failed:', err));
  });
}
