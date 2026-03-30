// ─────────────────────────────────────────
// SPENDLESS — app.js
// All fixes: decimal formatting, category
// reset bug, negative limit display,
// onboarding hints
// ─────────────────────────────────────────

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
  ui: { expInput: '0', incInput: '0', expCat: 'Food', incCat: 'Salary' }
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
  } catch (e) { console.warn('Could not load saved data:', e); }
}

function saveState() {
  try {
    localStorage.setItem('sl_tx',      JSON.stringify(state.transactions));
    localStorage.setItem('sl_cfg',     JSON.stringify(state.settings));
    localStorage.setItem('sl_bills',   JSON.stringify(state.bills));
    localStorage.setItem('sl_buckets', JSON.stringify(state.buckets));
  } catch (e) { console.warn('Could not save data:', e); }
}

// ── LANDING ─────────────────────────────
function enterApp() {
  localStorage.setItem('enteredApp', 'true');
  const landing = document.getElementById('screen-landing');
  landing.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  landing.style.opacity    = '0';
  landing.style.transform  = 'scale(0.98)';
  setTimeout(() => goTo('screen-home'), 320);
}

// ── NAVIGATION ──────────────────────────
function goTo(screenId, fromPop = false) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (!fromPop) {
    history.pushState({ page: screenId }, '', '#' + screenId);
  }

  if (screenId === 'screen-home')     renderHome();
  if (screenId === 'screen-bills')    renderBills();
  if (screenId === 'screen-buckets')  renderBuckets();
  if (screenId === 'screen-history')  renderHistory();
  if (screenId === 'screen-settings') renderSettings();
}

// ── BACK BUTTON ─────────────────────────
window.onpopstate = function(event) {
  if (event.state && event.state.page) {
    goTo(event.state.page, true);
  }
};

// ── NUMPAD ──────────────────────────────
function numTap(type, digit) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  let current = state.ui[key];

  if (digit === '.') {
    if (current.includes('.')) return;
    state.ui[key] = current + '.';
    renderInput(type);
    return;
  }

  if (current.includes('.')) {
    const decimals = current.split('.')[1];
    if (decimals && decimals.length >= 2) return;
  }

  if (current === '0') {
    state.ui[key] = digit;
  } else {
    state.ui[key] = current + digit;
  }

  if (state.ui[key].replace('.', '').length > 8) {
    state.ui[key] = current;
    return;
  }

  renderInput(type);
}

function numDel(type) {
  const key = type === 'expense' ? 'expInput' : 'incInput';
  let current = state.ui[key];
  if (current.length <= 1) {
    state.ui[key] = '0';
  } else {
    state.ui[key] = current.slice(0, -1);
  }
  renderInput(type);
}

// ── RENDER INPUT DISPLAY ─────────────────
// Uses correct IDs: exp-input-disp / inc-input-disp
// Shows raw decimal string while typing (15. stays 15.)
// Integer part gets locale formatting; decimal shown as-is
function renderInput(type) {
  const key  = type === 'expense' ? 'expInput' : 'incInput';
  const elId = type === 'expense' ? 'exp-input-disp' : 'inc-input-disp';
  const raw  = state.ui[key];

  let display;
  if (raw.includes('.')) {
    const parts  = raw.split('.');
    const intPart = parts[0] === '' ? '0' : parseInt(parts[0]).toLocaleString();
    display = intPart + '.' + parts[1];
  } else {
    display = parseInt(raw).toLocaleString();
  }

  document.getElementById(elId).innerHTML =
    display + '<span class="cursor"></span>';
}

// ── RESET FORM ───────────────────────────
// Only clears amount + note. Category is intentionally NOT reset.
// Category only changes via pickCat() or after successful submit.
function resetForm(type) {
  if (type === 'expense') {
    state.ui.expInput = '0';
    document.getElementById('exp-note').value = '';
    renderInput('expense');
  } else {
    state.ui.incInput = '0';
    document.getElementById('inc-note').value = '';
    renderInput('income');
  }
}

// Called by Cancel buttons in HTML
function onFormClear(type) {
  resetForm(type);
}

// ── CATEGORY PICK ────────────────────────
function pickCat(btn, type) {
  const gridId = type === 'expense' ? 'exp-cats' : 'inc-cats';
  const cls    = type === 'expense' ? 'sel-expense' : 'sel-income';
  document.getElementById(gridId).querySelectorAll('.cat-btn').forEach(b => b.classList.remove(cls));
  btn.classList.add(cls);
  if (type === 'expense') {
    state.ui.expCat = btn.dataset.cat;
    localStorage.setItem('lastExpenseCategory', btn.dataset.cat);
  } else {
    state.ui.incCat = btn.dataset.cat;
    localStorage.setItem('lastIncomeCategory', btn.dataset.cat);
  }
}

// ── SUBMIT TRANSACTION ───────────────────
// Amount stored as parseFloat(toFixed(2)) — always 2 decimal precision
function submitTransaction(type) {
  const raw  = type === 'expense' ? state.ui.expInput : state.ui.incInput;
  let amount = parseFloat(raw);
  if (!amount || amount <= 0 || isNaN(amount)) { goTo('screen-home'); return; }

  // Enforce 2 decimal place precision on stored value
  amount = parseFloat(amount.toFixed(2));

  const cat  = type === 'expense' ? state.ui.expCat : state.ui.incCat;
  const note = document.getElementById(type === 'expense' ? 'exp-note' : 'inc-note').value.trim();

  state.transactions.unshift({
    id: Date.now(), type, amount, cat, note, date: new Date().toISOString()
  });

  if (type === 'income' && state.buckets.length) distributeToBuckets(amount);

  saveState();
  resetForm(type);       // clears input/note only — category stays
  goTo('screen-home');
}

// ── DELETE TRANSACTION (history) ────────
function deleteTx(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const el = document.querySelector(`[data-tx-id="${id}"]`);
  if (el) {
    el.classList.add('tx-deleting');
    setTimeout(() => {
      state.transactions.splice(idx, 1);
      saveState();
      renderHistory();
      if (document.getElementById('screen-home').classList.contains('active')) renderHome();
    }, 280);
  } else {
    state.transactions.splice(idx, 1);
    saveState();
    renderHistory();
  }
}

// ── DELETE TRANSACTION (home) ───────────
function deleteTxHome(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderHome();
}

// ── HELPERS ─────────────────────────────
function todayStr() { return new Date().toDateString(); }

// Always shows 2 decimal places: R15.00, R1,200.50
function fmt(n) {
  const abs = Math.abs(n);
  return 'R' + abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function daysUntilDue(dueDay) {
  const now = new Date(), day = now.getDate(), month = now.getMonth(), year = now.getFullYear();
  let target = new Date(year, month, dueDay);
  if (dueDay <= day) target = new Date(year, month + 1, dueDay);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function dueCls(days)  { return days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'ok'; }
function dueLabel(days){ return days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`; }

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

  // FIX: cap displayed remaining at R0.00 — never show a negative number
  const displayRemaining = Math.max(0, remaining);
  const overspentBy      = remaining < 0 ? Math.abs(remaining) : 0;

  const now = new Date();
  document.getElementById('clock-home').textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  document.getElementById('home-day').textContent   = DAYS[now.getDay()] + ', ' + now.toLocaleDateString([], { month:'short', day:'numeric' });
  document.getElementById('home-balance').textContent = (balance < 0 ? '−' : '') + fmt(Math.abs(balance));
  document.getElementById('meta-inc').textContent     = fmt(income);
  document.getElementById('meta-exp').textContent     = fmt(expense);
  document.getElementById('spent-val').textContent    = fmt(expense);
  document.getElementById('pct-lbl').textContent      = pct + '% used';
  document.getElementById('limit-of').textContent     = 'of ' + fmt(limit);

  const remEl = document.getElementById('limit-rem');
  remEl.className   = 'limit-remaining ' + stCls;
  remEl.textContent = fmt(displayRemaining); // always R0.00 or positive

  const bar = document.getElementById('prog');
  bar.className   = 'progress-fill ' + stCls;
  bar.style.width = pct + '%'; // already capped at 100 via Math.min above

  const alertEl = document.getElementById('alert');
  if (pct >= 100) {
    alertEl.className   = 'alert-banner alert-over';
    // Show exact overspend amount — clear and actionable
    alertEl.textContent = overspentBy > 0
      ? `Limit exceeded — you've overspent by ${fmt(overspentBy)}`
      : 'Daily limit reached — no more spending today';
  } else if (pct >= 75) {
    alertEl.className   = 'alert-banner alert-warn';
    alertEl.textContent = 'Warning: only ' + fmt(displayRemaining) + ' left today';
  } else {
    alertEl.className   = 'alert-banner alert-ok';
    alertEl.textContent = "You're within your limit — keep it up";
  }

  renderBillsWidget();
  renderBucketsWidget();
  renderTxList(todayTx);

  // Auto-dismiss home hint once user has transactions
  if (state.transactions.length > 0) {
    dismissHint('hint-home');
  }
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
        return `<div class="bill-widget-item">
          <div class="bill-widget-left"><div>
            <div class="bill-widget-name">${b.name}</div>
            <div class="bill-widget-due ${cls}">${dueLabel(days)}</div>
          </div></div>
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
        ${state.buckets.map(b => {
          const allocated = b.balance || 0;
          const paid      = b.paidAmount || 0;
          const pending   = allocated - paid;
          return `<div class="bucket-widget-card">
            <div class="bucket-widget-top">
              <span class="bucket-widget-emoji">${b.emoji || '🪣'}</span>
              <span class="bucket-widget-name">${b.name}</span>
            </div>
            <div class="bucket-widget-amount">${fmt(paid)}</div>
            <div class="bucket-widget-pct">${b.pct}% · ${fmt(allocated)} allocated</div>
            ${pending > 0
              ? `<button class="bucket-widget-pay-btn" onclick="markBucketPaid('${b.id}')">Pay ${fmt(pending)}</button>`
              : `<div class="bucket-widget-paid-label">✓ Paid</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── TX LIST (home) ───────────────────────
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
      <div class="tx-right" style="display:flex;align-items:center;gap:8px;">
        <div>
          <div class="tx-amount ${t.type}">${t.type === 'expense' ? '−' : '+'}${fmt(t.amount)}</div>
          <div class="tx-time">${new Date(t.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
        </div>
        <button class="history-tx-delete" onclick="deleteTxHome(${t.id})" title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M6 6.5v4M8 6.5v4M3 3.5l.75 7.5a.5.5 0 00.5.5h5.5a.5.5 0 00.5-.5L11 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>`).join('');
}

// ── BILLS SCREEN ─────────────────────────
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
        const days    = daysUntilDue(b.dueDay);
        const cls     = b.paid ? 'ok' : dueCls(days);
        const cardCls = b.paid ? '' : (cls === 'urgent' ? 'urgent' : cls === 'soon' ? 'soon' : '');
        return `<div class="bill-card ${cardCls}">
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
  const s = ['th','st','nd','rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function openAddBill() {
  document.getElementById('bill-name').value   = '';
  document.getElementById('bill-amount').value = '';
  document.getElementById('bill-day').value    = '';
  document.getElementById('modal-bill').classList.add('open');
  setTimeout(() => document.getElementById('bill-name').focus(), 300);
}

function saveBill() {
  const name   = document.getElementById('bill-name').value.trim();
  const amount = parseFloat(document.getElementById('bill-amount').value);
  const day    = parseInt(document.getElementById('bill-day').value);
  if (!name || !amount || !day || day < 1 || day > 28) {
    alert('Please fill in all fields. Due day must be between 1 and 28.');
    return;
  }
  state.bills.push({ id: Date.now().toString(), name, amount: parseFloat(amount.toFixed(2)), dueDay: day, paid: false, paidMonth: null });
  saveState();
  closeModal('modal-bill');
  renderBills();
}

function toggleBillPaid(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;
  const nowMonth = new Date().toISOString().slice(0, 7);
  if (!bill.paid) {
    bill.paid = true; bill.paidMonth = nowMonth;
    state.transactions.unshift({ id: Date.now(), type: 'expense', amount: bill.amount, cat: 'Other', note: bill.name + ' (bill)', date: new Date().toISOString() });
  } else {
    bill.paid = false; bill.paidMonth = null;
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

function checkBillReset() {
  const nowMonth = new Date().toISOString().slice(0, 7);
  state.bills.forEach(b => {
    if (b.paid && b.paidMonth && b.paidMonth !== nowMonth) { b.paid = false; b.paidMonth = null; }
  });
  saveState();
}

// ── BUCKETS SCREEN ───────────────────────
function renderBuckets() {
  const totalPct  = state.buckets.reduce((s, b) => s + b.pct, 0);
  const remaining = 100 - totalPct;
  const barEl     = document.getElementById('pct-remaining-bar');
  const segments  = state.buckets.map((b, i) =>
    `<div class="pct-bar-fill" style="width:${b.pct}%;background:${BUCKET_COLORS[i % BUCKET_COLORS.length]}"></div>`
  ).join('');
  barEl.innerHTML = `
    <div class="pct-bar-track">${segments}</div>
    <div class="pct-bar-label">
      <span>${totalPct}% allocated</span>
      <span class="${remaining < 0 ? 'over' : 'ok'}">${Math.abs(remaining)}% ${remaining < 0 ? 'over!' : 'remaining'}</span>
    </div>`;

  const listEl = document.getElementById('buckets-list');
  listEl.innerHTML = state.buckets.length
    ? state.buckets.map((b, i) => {
        const color     = BUCKET_COLORS[i % BUCKET_COLORS.length];
        const allocated = b.balance || 0;
        const paid      = b.paidAmount || 0;
        const pending   = allocated - paid;
        const fillPct   = allocated > 0 ? Math.min(100, Math.round((paid / allocated) * 100)) : 0;
        return `<div class="bucket-card">
          <div class="bucket-card-top">
            <div class="bucket-card-left">
              <div class="bucket-card-emoji">${b.emoji || '🪣'}</div>
              <div>
                <div class="bucket-card-name">${b.name}</div>
                <div class="bucket-card-pct">${b.pct}% of income</div>
              </div>
            </div>
            <div class="bucket-card-right">
              <div class="bucket-card-amount" style="color:${color}">${fmt(paid)}</div>
              <div class="bucket-card-of">of ${fmt(allocated)} allocated</div>
            </div>
          </div>
          <div class="bucket-card-bar-track">
            <div class="bucket-card-bar-fill" style="width:${fillPct}%;background:${color}"></div>
          </div>
          <div class="bucket-card-footer">
            ${pending > 0
              ? `<span class="bucket-pending">${fmt(pending)} pending transfer</span>
                 <button class="bucket-pay-btn" onclick="markBucketPaid('${b.id}')">Mark Paid</button>`
              : `<span class="bucket-done">✓ Fully transferred</span>
                 <button class="bucket-unpay-btn" onclick="unmarkBucketPaid('${b.id}')">Undo</button>`}
            <button class="bucket-delete-btn" onclick="deleteBucket(${i})">✕ Remove</button>
          </div>
        </div>`;
      }).join('')
    : '<div class="tx-empty" style="padding:40px 0">No buckets yet — add one below</div>';
}

function markBucketPaid(id) {
  const b = state.buckets.find(bk => bk.id === id);
  if (!b) return;
  const pending = (b.balance || 0) - (b.paidAmount || 0);
  if (pending <= 0) return;
  b.paidAmount = (b.paidAmount || 0) + pending;
  state.transactions.unshift({ id: Date.now(), type: 'expense', amount: pending, cat: 'Other', note: b.name + ' (savings transfer)', date: new Date().toISOString() });
  saveState();
  renderBuckets();
  renderHome();
}

function unmarkBucketPaid(id) {
  const b = state.buckets.find(bk => bk.id === id);
  if (!b) return;
  b.paidAmount = 0;
  saveState();
  renderBuckets();
  renderHome();
}

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
  if (!name || !pct || pct < 1 || pct > 100) { alert('Please fill in all fields. Percentage must be between 1 and 100.'); return; }
  const totalUsed = state.buckets.reduce((s, b) => s + b.pct, 0);
  if (totalUsed + pct > 100) { alert(`Only ${100 - totalUsed}% remaining to allocate.`); return; }
  state.buckets.push({ id: Date.now().toString(), name, emoji, pct, balance: 0, totalReceived: 0, paidAmount: 0 });
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

function distributeToBuckets(amount) {
  state.buckets.forEach(b => {
    const share = Math.round(amount * (b.pct / 100) * 100) / 100;
    b.balance       = (b.balance || 0) + share;
    b.totalReceived = (b.totalReceived || 0) + share;
  });
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── HISTORY RENDER ───────────────────────
function renderHistory() {
  const grouped = {};
  state.transactions.forEach(t => {
    const d = new Date(t.date).toDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });

  const list = document.getElementById('history-list');
  if (!Object.keys(grouped).length) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">📭</div>
        <div class="history-empty-title">No transactions yet</div>
        <div class="history-empty-sub">Add income or expenses from the Today tab</div>
      </div>`;
    return;
  }

  list.innerHTML = Object.keys(grouped).map(day => {
    const txs     = grouped[day];
    const inc     = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp     = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net     = inc - exp;
    const netPos  = net >= 0;
    const d       = new Date(day);
    const isToday = d.toDateString() === new Date().toDateString();

    return `
      <div class="history-day-group">
        <div class="history-day-header">
          <div class="history-day-left">
            <div class="history-day-name">${isToday ? 'Today' : DAYS[d.getDay()]}</div>
            <div class="history-day-date">${d.toLocaleDateString([], { month:'short', day:'numeric', year: isToday ? undefined : 'numeric' })}</div>
          </div>
          <div class="history-day-summary">
            ${inc > 0 ? `<span class="history-day-inc">+${fmt(inc)}</span>` : ''}
            ${exp > 0 ? `<span class="history-day-exp">−${fmt(exp)}</span>` : ''}
            <span class="history-day-net ${netPos ? 'pos' : 'neg'}">${netPos ? '+' : '−'}${fmt(Math.abs(net))}</span>
          </div>
        </div>
        <div class="history-tx-group">
          ${txs.map(t => `
            <div class="history-tx-item" data-tx-id="${t.id}">
              <div class="history-tx-icon ${t.type}">${CAT_ICONS[t.cat] || '💸'}</div>
              <div class="history-tx-middle">
                <div class="history-tx-label">${t.note || t.cat}</div>
                <div class="history-tx-meta">
                  <span class="history-tx-cat">${t.cat}</span>
                  <span class="history-tx-dot">·</span>
                  <span class="history-tx-time">${new Date(t.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                </div>
              </div>
              <div class="history-tx-right">
                <div class="history-tx-amount ${t.type}">${t.type === 'expense' ? '−' : '+'}${fmt(t.amount)}</div>
                <button class="history-tx-delete" onclick="deleteTx(${t.id})" title="Delete transaction">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M6 6.5v4M8 6.5v4M3 3.5l.75 7.5a.5.5 0 00.5.5h5.5a.5.5 0 00.5-.5L11 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── SETTINGS ─────────────────────────────
function renderSettings() {
  document.getElementById('limit-input').value        = state.settings.dailyLimit;
  document.getElementById('stat-total').textContent   = state.transactions.length;
  document.getElementById('stat-days').textContent    = new Set(state.transactions.map(t => new Date(t.date).toDateString())).size;
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
    state.transactions = []; state.bills = []; state.buckets = [];
    saveState(); renderSettings();
  }
}

function updateClock() {
  const el = document.getElementById('clock-home');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// ── ONBOARDING HINTS ─────────────────────
// Each hint has its own localStorage key.
// Once dismissed it never appears again.

function initHints() {
  // Hint 1 — home screen: only if no transactions exist yet
  if (!localStorage.getItem('hint_home_dismissed') && state.transactions.length === 0) {
    const el = document.getElementById('hint-home');
    if (el) el.style.display = 'flex';
  }

  // Hint 2 — expense form: shown once until dismissed
  if (!localStorage.getItem('hint_expense_dismissed')) {
    const el = document.getElementById('hint-expense');
    if (el) el.style.display = 'block';
  }
}

function dismissHint(id) {
  const el = document.getElementById(id);
  if (el && el.style.display !== 'none') {
    el.style.transition = 'opacity 0.2s ease';
    el.style.opacity    = '0';
    setTimeout(() => { el.style.display = 'none'; }, 200);
  }
  const keyMap = {
    'hint-home':    'hint_home_dismissed',
    'hint-expense': 'hint_expense_dismissed'
  };
  if (keyMap[id]) localStorage.setItem(keyMap[id], 'true');
}

// ── RESTORE LAST-USED CATEGORIES ─────────
(function restoreCategories() {
  const lastExp = localStorage.getItem('lastExpenseCategory');
  const lastInc = localStorage.getItem('lastIncomeCategory');

  if (lastExp) {
    state.ui.expCat = lastExp;
    document.querySelectorAll('#exp-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-expense');
      if (b.dataset.cat === lastExp) b.classList.add('sel-expense');
    });
  }

  if (lastInc) {
    state.ui.incCat = lastInc;
    document.querySelectorAll('#inc-cats .cat-btn').forEach(b => {
      b.classList.remove('sel-income');
      if (b.dataset.cat === lastInc) b.classList.add('sel-income');
    });
  }
})();

// ── INIT ─────────────────────────────────
loadState();
checkBillReset();
renderInput('expense');
renderInput('income');
initHints();
updateClock();
setInterval(updateClock, 30000);

// Check if user has already entered the app
const hasEntered = localStorage.getItem('enteredApp');
if (hasEntered === 'true') {
  goTo('screen-home');
} else {
  history.replaceState({ page: 'screen-landing' }, '', '#screen-landing');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SpendLess: service worker registered'))
      .catch(err => console.warn('SpendLess: service worker failed:', err));
  });
}