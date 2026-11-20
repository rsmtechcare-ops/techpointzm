import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.TECHPOINT_CONFIG || {};
cfg.SUPABASE_URL = String(cfg.SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1.*$/,'').replace(/\/+$/,'');
const publicKey = String(cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '').trim();
const configured = /^https:\/\/.+/.test(cfg.SUPABASE_URL || '') && publicKey.length > 20 && !String(cfg.SUPABASE_URL).includes('PASTE_') && !publicKey.includes('PASTE_');
const db = configured ? createClient(cfg.SUPABASE_URL, publicKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(Number(value || 0));
const fmtDate = value => value ? new Date(value).toLocaleDateString('en-ZM', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = value => value ? new Date(value).toLocaleString('en-ZM', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paymentLabel = value => ({ cash:'Cash', airtel_money:'Airtel Money', mtn_momo:'MTN MoMo', bank_transfer:'Bank transfer', card:'Card / POS', other:'Other' }[value] || String(value || '—'));
const lsGet = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } };
const lsSet = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const rawGet = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const rawSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
const state = { user:null, business:null, products:[], devices:[], sales:[], expenses:[], movements:[], cart:[], holds:[], photos:lsGet('tpz:photos',{})||{}, quickMode:'top', debtorList:[], view:'dashboard', authMode:'login', activeReceipt:null };
let toastTimer;
let qrLibPromise = null;
let tpHtml5 = null;
let scanRunning = false;
const scriptCache = new Map();
const qrCache = new Map();

function toast(message, error = false) {
  const el = $('toast'); el.textContent = message; el.style.background = error ? '#9e303b' : '#14263d'; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}
function showMessage(message, ok = false) { $('authMessage').textContent = message; $('authMessage').classList.toggle('ok', ok); }
function setConnection(online, label = '') {
  $('syncStatus').textContent = online ? 'Cloud connected' : 'No internet connection';
  $('connectionBanner').textContent = label || (online ? '' : 'You are offline. Live sales and database changes are paused until connection returns.');
  $('connectionBanner').classList.toggle('hidden', online);
  $('syncStatus').parentElement.querySelector('i').style.background = online ? '#20b77b' : '#ce8b28';
}
function showDialog(id) { if (!$(id).open) $(id).showModal(); }
function closeDialog(id) { if ($(id).open) $(id).close(); }

function showAuth() { $('authScreen').classList.remove('hidden'); $('appShell').classList.add('hidden'); $('mobileNav').classList.add('hidden'); }
function showApp() { $('authScreen').classList.add('hidden'); $('appShell').classList.remove('hidden'); $('mobileNav').classList.remove('hidden'); }

async function authSubmit(event) {
  event.preventDefault();
  if (!db) { showMessage('Cannot connect right now. Please check your internet and try again.'); return; }
  const email = $('authEmail').value.trim(); const password = $('authPassword').value;
  $('authSubmit').disabled = true; $('authSubmit').textContent = state.authMode === 'login' ? 'Signing in…' : 'Creating account…'; showMessage('');
  try {
    if (false) {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) { showMessage('Account created. Check your email to confirm the address, then sign in.', true); return; }
      state.user = data.user;
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.user = data.user;
    }
    await enterWorkspace();
  } catch (error) { showMessage(/invalid login/i.test(error.message||'') ? 'Wrong email or password. Please try again.' : (error.message || 'Could not sign in.')); }
  finally { $('authSubmit').disabled = false; $('authSubmit').textContent = state.authMode === 'login' ? 'Sign in to your shop' : 'Create secure account'; }
}

async function enterWorkspace() {
  if (!db || !state.user) return;
  let ensureError = null;
  if (await netOk()) ({ error: ensureError } = await db.rpc('ensure_my_business', { p_business_name: cfg.BUSINESS_DEFAULT_NAME || 'TechPoint ZM', p_phone: cfg.BUSINESS_DEFAULT_PHONE || '', p_email: cfg.BUSINESS_DEFAULT_EMAIL || '' }));
  if (ensureError && !isNetErr(ensureError)) throw ensureError;
  showApp(); gateOnBoot(); await loadAll(); navigate('dashboard');
}

async function signOut() { if (db) await db.auth.signOut(); state.user = null; state.business = null; state.cart = []; hideLock(); showAuth(); }

async function loadAll() {
  if (!db) return;
  if (!(await netOk())) { setConnection(false); await useSnapshotIfNeeded(); return; }
  await syncQueue();
  setConnection(true);
  const [businessRes, productsRes, devicesRes, salesRes, expensesRes, movementsRes] = await Promise.all([
    db.from('businesses').select('*').maybeSingle(),
    db.from('products').select('*').order('created_at', { ascending:false }),
    db.from('available_device_units').select('*').order('created_at', { ascending:false }),
    db.from('sales').select('*, sale_items(*), sale_payments(*)').order('created_at', { ascending:false }).limit(300),
    db.from('expenses').select('*').order('expense_date', { ascending:false }).limit(300),
    db.from('stock_movements').select('*').order('created_at', { ascending:false }).limit(500)
  ]);
  const bad = [businessRes,productsRes,devicesRes,salesRes,expensesRes,movementsRes].find(r => r.error);
  if (bad) { if (isNetErr(bad.error)) { _net = { ok:false, at:Date.now() }; setConnection(false); await useSnapshotIfNeeded(); return; } throw bad.error; }
  state.business = businessRes.data; state.products = productsRes.data || []; state.devices = devicesRes.data || []; state.sales = salesRes.data || []; state.expenses = expensesRes.data || []; state.movements = movementsRes.data || [];
  paintAll(); saveSnapshot(); migratePhotos();
}

function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const hr=new Date().getHours();const hello=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';const names = { dashboard:['OVERVIEW',hello], inventory:['INVENTORY','Your stock'], checkout:['POINT OF SALE','New sale'], transactions:['TRANSACTIONS','Sales & receipts'], expenses:['BUSINESS COSTS','Expenses'], reports:['PERFORMANCE','Business reports'], settings:['SETTINGS','Business profile'], team:['TEAM','Team & access'] };
  $('pageCrumb').textContent = names[view][0]; $('pageTitle').textContent = names[view][1];
  window.scrollTo({ top:0, behavior:'smooth' });
  if (view === 'checkout') renderCart();
}

function paintAll() { renderDashboard(); renderWeekChart(); renderInventory(); renderDeviceTable(); renderSelects(); renderSales(); renderExpenses(); renderReports(); renderSettings(); renderQuickSell(); renderHolds(); renderDebtors(); renderImeiLookup(); }

function renderDashboard() {
  const d = today(); const todays = state.sales.filter(s => s.status === 'completed' && localDay(new Date(s.sale_date)) === d);
  $('todaySales').textContent = money(todays.reduce((a,s)=>a+Number(s.total),0)); $('todayCount').textContent = `${todays.length} transaction${todays.length===1?'':'s'}`;
  $('productCount').textContent = state.products.filter(p=>p.is_active).length;
  $('stockCount').textContent = state.products.filter(p=>p.is_active).reduce((n,p)=>n+Number(p.stock_qty||0),0);
  $('balanceCount').textContent = money(state.sales.filter(s=>s.status==='completed').reduce((n,s)=>n+Number(s.balance_due||0),0));
  const low = state.products.filter(p=>p.is_active && Number(p.stock_qty) <= Number(p.reorder_level));
  $('lowStockList').innerHTML = low.length ? low.slice(0,6).map(p=>`<div class="list-row"><div class="list-main"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.sku)} · reorder at ${p.reorder_level}</small></div><div class="list-value"><strong>${p.stock_qty} left</strong><small>Restock soon</small></div></div>`).join('') : '<div class="empty-inline">All products are above their low-stock level.</div>';
  const recent = state.sales.slice(0,5);
  $('recentSalesList').innerHTML = recent.length ? recent.map(s=>`<div class="list-row"><div class="list-main"><strong>${escapeHtml(s.receipt_number)} · ${escapeHtml(s.customer_name)}</strong><small>${fmtDateTime(s.sale_date)} · ${escapeHtml(paymentLabel(s.payment_method))}</small></div><div class="list-value"><strong>${money(s.total)}</strong><small>${escapeHtml(s.payment_status.replace('_',' '))}</small></div></div>`).join('') : '<div class="empty-inline">No sales recorded yet.</div>';
  $('businessAvatar').textContent = (state.business?.business_name || 'T').slice(0,1).toUpperCase(); $('sideBusinessName').textContent = state.business?.business_name || 'TechPoint ZM';
}

function filteredProducts() {
  const q = $('inventorySearch').value.trim().toLowerCase(); const f = $('inventoryFilter').value;
  return state.products.filter(p => {
    const units = state.devices.filter(d=>d.product_id===p.id);
    const search = [p.name,p.sku,p.category,...units.map(d=>d.imei)].join(' ').toLowerCase().includes(q);
    const low = Number(p.stock_qty) <= Number(p.reorder_level);
    const type = f==='phones' ? p.item_type==='phone' : f==='accessories' ? p.item_type==='accessory' : (f==='clothing'||f==='shoes') ? p.item_type===f : true;
    return search && type && (f==='archived' ? !p.is_active : p.is_active) && (f!=='low' || low);
  });
}
function renderInventory() {
  const products = filteredProducts();
  $('inventoryCards').innerHTML = products.length ? products.map(p=>{
    const tracked = p.track_imei; const low = Number(p.stock_qty)<=Number(p.reorder_level);
    const icon = ({phone:'📱',accessory:'🎧',clothing:'👕',shoes:'👟'})[p.item_type]||'📦';
    const photo = p.image_url || state.photos[p.id];
    const thumb = photo ? `<img src="${photo}" alt="">` : `<span>${icon}</span>`;
    return `<article class="product-card"><div class="product-top"><button type="button" class="product-thumb" data-action="product-photo" data-id="${p.id}" title="${photo?'Change photo':'Add a photo'}">${thumb}</button><span class="badge ${low?'low':''}">${low?'Low stock':`${p.stock_qty} available`}</span></div><h3>${escapeHtml(p.name)}</h3><p class="sku-line">${escapeHtml(p.sku)} · ${escapeHtml(p.category)}</p><div class="product-data"><div><span>SELLING PRICE</span><strong>${money(p.selling_price)}</strong></div><div><span>BUYING COST</span><strong>${money(p.purchase_price)}</strong></div></div><div class="product-actions">${tracked?`<button class="mini-btn" data-action="register-device" data-id="${p.id}">+ Register IMEI</button>`:`<button class="mini-btn" data-action="adjust-stock" data-id="${p.id}">Adjust stock</button>`}<button class="mini-btn" data-action="share-product" data-id="${p.id}">Share</button><button class="mini-btn" data-action="print-label" data-id="${p.id}">QR label</button><button class="mini-btn" data-action="edit-product" data-id="${p.id}">Edit</button>${p.is_active?`<button class="mini-btn" data-action="archive-product" data-id="${p.id}">Archive</button>`:`<button class="mini-btn" data-action="restore-product" data-id="${p.id}">Restore</button>`}<button class="mini-btn danger" data-action="delete-product" data-id="${p.id}">Delete</button>${photo?`<button class="mini-btn" data-action="remove-photo" data-id="${p.id}">Remove photo</button>`:''}</div><div style="margin-top:9px">${tracked?'<span class="badge imei">IMEI tracked</span>':''}</div></article>`;
  }).join('') : '<div class="empty-inline">No matching products. Add your first product to start tracking stock.</div>';
}
function renderDeviceTable() {
  const allDevices = state.devices;
  $('deviceTable').innerHTML = allDevices.map(d=>{
    const p = state.products.find(x=>x.id===d.product_id);
    return `<tr><td><strong>${escapeHtml(p?.name||'Device')}</strong><br><small>${escapeHtml(d.colour||'')} ${escapeHtml(d.serial_number||'')}</small></td><td>${escapeHtml(d.imei)}</td><td>${escapeHtml(d.storage||'—')}</td><td>${escapeHtml(d.device_condition)}</td><td>${d.battery_health?`${d.battery_health}%`:'—'}</td><td>${money(d.purchase_cost)}</td><td><span class="status-pill">In stock</span></td><td><button class="row-del" title="Remove this phone" data-action="delete-device" data-id="${d.id}">🗑</button></td></tr>`;
  }).join(''); $('deviceEmpty').classList.toggle('hidden',allDevices.length>0);
}
function renderSelects() {
  const active = state.products.filter(p=>p.is_active);
  $('deviceProduct').innerHTML = active.filter(p=>p.track_imei).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('') || '<option value="">Add an IMEI-tracked phone product first</option>';
  $('cartProduct').innerHTML = active.filter(p=>p.stock_qty>0).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${p.stock_qty} available</option>`).join('') || '<option value="">No items available to sell</option>';
  updateCartProductDetails();
}
function updateCartProductDetails() {
  const p = state.products.find(x=>x.id===$('cartProduct').value);
  if (!p) { $('devicePickWrap').classList.add('hidden'); $('cartPrice').value=''; return; }
  $('cartPrice').value = p.selling_price;
  $('devicePickWrap').classList.toggle('hidden',!p.track_imei);
  $('cartQty').disabled = p.track_imei; $('cartQty').value = p.track_imei ? 1 : 1;
  if (p.track_imei) {
    const devices = state.devices.filter(d=>d.product_id===p.id);
    $('cartDevice').innerHTML = devices.map(d=>`<option value="${d.id}">${escapeHtml(d.imei)} · ${escapeHtml(d.storage)} · ${escapeHtml(d.colour)} · ${d.battery_health||'?'}% battery</option>`).join('') || '<option value="">No registered device in stock</option>';
  }
}
function renderCart() {
  const count = state.cart.reduce((n,x)=>n+x.quantity,0); const subtotal = state.cart.reduce((n,x)=>n+x.quantity*x.unit_price,0);
  $('cartLineCount').textContent = `${count} item${count===1?'':'s'}`;
  $('cartItems').innerHTML = state.cart.length ? state.cart.map((item,i)=>{
    const qty = item.device_unit_id ? '<span class="qty-fixed">IMEI unit</span>' : `<div class="qty-stepper"><button type="button" data-action="cart-dec" data-index="${i}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-action="cart-inc" data-index="${i}" aria-label="Increase quantity">+</button></div>`;
    return `<div class="cart-line"><div><strong>${escapeHtml(item.name)}</strong><small>${item.device_details?.imei?`IMEI ${escapeHtml(item.device_details.imei)} · `:''}${item.quantity} × ${money(item.unit_price)}</small></div><div class="cart-line-right"><strong>${money(item.quantity*item.unit_price)}</strong><div class="cart-line-tools">${qty}<button class="remove-line" data-action="remove-cart" data-index="${i}">Remove</button></div></div></div>`;
  }).join('') : '<div class="empty-inline">Your sale basket is empty.</div>';
  $('cartSubtotal').textContent = money(subtotal); updateCartTotal();
}
function updateCartTotal() {
  const subtotal = state.cart.reduce((n,x)=>n+x.quantity*x.unit_price,0); const discount = Number($('saleDiscount').value||0); const total = Math.max(0,subtotal-discount);
  const paid = Number($('salePaid').value||0); $('cartDiscount').textContent = money(discount); $('cartTotal').textContent = money(total); $('cartBalance').textContent = money(Math.max(0,total-paid));
  if ($('salePaid').dataset.auto !== 'false') $('salePaid').value = total.toFixed(2);
  const actualPaid = Number($('salePaid').value||0); $('cartBalance').textContent = money(Math.max(0,total-actualPaid));
  $('completeSaleButton').disabled = state.cart.length===0;
}

function renderSales() {
  const q = $('salesSearch').value.trim().toLowerCase(); const list = state.sales.filter(s=>`${s.receipt_number} ${s.customer_name} ${s.customer_phone}`.toLowerCase().includes(q));
  $('salesTable').innerHTML = list.map(s=>`<tr><td><strong>${escapeHtml(s.receipt_number)}</strong></td><td>${fmtDate(s.sale_date)}</td><td>${escapeHtml(s.customer_name)}<br><small>${escapeHtml(s.customer_phone)}</small></td><td><strong>${money(s.total)}</strong></td><td>${money(s.amount_paid)}</td><td>${money(s.balance_due)}</td><td><span class="status-pill ${s.payment_status==='paid'?'':s.payment_status==='part_paid'?'partial':'unpaid'}">${s.payment_status.replace('_',' ')}</span></td><td><button class="table-action" data-action="view-receipt" data-id="${s.id}">Receipt</button>${Number(s.balance_due)>0?`<button class="table-action" data-action="collect-payment" data-id="${s.id}">Collect</button>`:''}</td></tr>`).join(''); $('salesEmpty').classList.toggle('hidden',list.length>0);
}
function renderExpenses() {
  $('expenseTotal').textContent = money(state.expenses.reduce((n,e)=>n+Number(e.amount),0));
  $('expenseList').innerHTML = state.expenses.slice(0,30).map(e=>`<div class="list-row"><div class="list-main"><strong>${escapeHtml(e.description)}</strong><small>${escapeHtml(e.category)} · ${fmtDate(e.expense_date)} · ${escapeHtml(paymentLabel(e.payment_method))}</small></div><div class="list-value"><strong>${money(e.amount)}</strong></div><button class="row-del" title="Delete" data-action="delete-expense" data-id="${e.id}">🗑</button></div>`).join('') || '<div class="empty-inline">No expenses recorded.</div>';
}
function reportRange() { const from=$('reportFrom').value; const to=$('reportTo').value; return state.sales.filter(s=>s.status==='completed' && (!from||localDay(new Date(s.sale_date))>=from) && (!to||localDay(new Date(s.sale_date))<=to)); }
function renderReports() {
  const sales=reportRange(); const revenue=sales.reduce((n,s)=>n+Number(s.total),0);
  const gross=sales.reduce((n,s)=>n+(s.sale_items||[]).reduce((m,i)=>m+Number(i.line_total)-Number(i.unit_cost)*Number(i.quantity),0),0)-sales.reduce((n,s)=>n+Number(s.discount),0);
  const from=$('reportFrom').value, to=$('reportTo').value;
  const expenses=state.expenses.filter(e=>(!from||e.expense_date>=from)&&(!to||e.expense_date<=to)).reduce((n,e)=>n+Number(e.amount),0);
  $('reportRevenue').textContent=money(revenue); $('reportGross').textContent=money(gross); $('reportExpenses').textContent=money(expenses); $('reportBalances').textContent=money(state.sales.filter(s=>s.status==='completed').reduce((n,s)=>n+Number(s.balance_due),0));
  const byProduct=new Map(); for(const sale of sales) for(const item of sale.sale_items||[]){const v=byProduct.get(item.product_id)||{name:item.item_name,units:0,value:0,gross:0};v.units+=Number(item.quantity);v.value+=Number(item.line_total);v.gross+=Number(item.line_total)-Number(item.unit_cost)*Number(item.quantity);byProduct.set(item.product_id,v);}
  const arr=[...byProduct.values()].sort((a,b)=>b.value-a.value);
  $('productReportTable').innerHTML=arr.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${p.units}</td><td>${money(p.value)}</td><td>${money(p.gross)}</td></tr>`).join(''); $('productReportEmpty').classList.toggle('hidden',arr.length>0); renderMethods(sales); renderProfitByDay(sales); renderSlowMoving(); renderCloseout();
}
const localDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderWeekChart() {
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return {key:localDay(d),label:d.toLocaleDateString('en-ZM',{weekday:'short'}),total:0};});
  for(const s of state.sales){if(s.status!=='completed')continue;const k=localDay(new Date(s.sale_date));const day=days.find(x=>x.key===k);if(day)day.total+=Number(s.total);}
  const max=Math.max(1,...days.map(d=>d.total));
  $('weekTotal').textContent=money(days.reduce((n,d)=>n+d.total,0));
  $('weekChart').innerHTML=days.map(d=>`<div class="wk-col"><span class="wk-val">${d.total?Math.round(d.total).toLocaleString('en-ZM'):''}</span><div class="wk-bar" style="height:${Math.max(4,d.total/max*100)}%"></div><small>${d.label}</small></div>`).join('');
}
function renderMethods(sales) {
  const m=new Map();for(const s of sales)for(const p of s.sale_payments||[])m.set(p.method,(m.get(p.method)||0)+Number(p.amount));
  const rows=[...m.entries()].sort((a,b)=>b[1]-a[1]);
  $('methodBreakdown').innerHTML=rows.length?rows.map(([k,v])=>`<div class="list-row"><div class="list-main"><strong>${escapeHtml(paymentLabel(k))}</strong></div><div class="list-value"><strong>${money(v)}</strong></div></div>`).join(''):'<div class="empty-inline">No payments in the selected period.</div>';
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function exportSalesCsv() {
  const rows=[['Receipt','Date','Customer','Phone','Items','Total','Paid','Balance','Status','Method']];
  for(const s of reportRange())rows.push([s.receipt_number,fmtDateTime(s.sale_date),s.customer_name,s.customer_phone,(s.sale_items||[]).map(i=>`${i.item_name} x${i.quantity}`).join('; '),s.total,s.amount_paid,s.balance_due,s.payment_status,paymentLabel(s.payment_method)]);
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv'}));
  const a=document.createElement('a');a.href=url;a.download=`techpoint-sales-${today()}.csv`;a.click();URL.revokeObjectURL(url);toast('Sales CSV downloaded.');
}
function zmNumber(raw){let n=String(raw||'').replace(/[^\d]/g,'');if(!n)return '';if(n.startsWith('260'))return n;if(n.startsWith('0'))return '260'+n.slice(1);return n.length===9?'260'+n:n;}
let installEvent=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;$('installButton').classList.remove('hidden');});
window.addEventListener('appinstalled',()=>$('installButton').classList.add('hidden'));
function renderSettings() {
  $('defaultReorder').value = rawGet('tpz:reorder','5'); applyTheme(rawGet('tpz:theme','light'));
  $('paperSize').value = rawGet('tpz:paper','a4');
  updatePinUi();
  const b=state.business;if(!b)return;
  $('businessName').value=b.business_name||''; $('businessPhone').value=b.phone||''; $('businessEmail').value=b.email||''; $('businessAddress').value=b.address||''; $('receiptFooter').value=b.receipt_footer||''; $('warrantyNote').value=b.warranty_note||'';
  $('sideBusinessName').textContent=b.business_name||'TechPoint ZM'; $('businessAvatar').textContent=(b.business_name||'T').slice(0,1).toUpperCase();
}

async function addProduct(event) {
  event.preventDefault();
  const name=$('productName').value.trim(); const sku=$('productSku').value.trim() || `TPZ-${Date.now().toString().slice(-8)}`; const type=$('productType').value; const track=$('trackImei').checked; const qty=track?0:Number($('productOpeningStock').value||0);
  if(track && type!=='phone'){toast('IMEI tracking is only for phone products.',true);return;}
  const payload={name,sku,category:$('productCategory').value,item_type:type,track_imei:track,purchase_price:Number($('productCost').value),selling_price:Number($('productPrice').value),reorder_level:Number($('productReorder').value||0),updated_at:new Date().toISOString()};
  const editingId=$('editingProductId').value;
  if(editingId){
    const {error}=await db.from('products').update(payload).eq('id',editingId);if(error){toast(error.message,true);return;}
    closeDialog('productDialog');$('productForm').reset();$('productType').disabled=false;$('trackImei').disabled=false;$('productDialogHeading').textContent='Add a product';await loadAll();toast('Product details updated.');return;
  }
  const {data,error}=await db.from('products').insert({...payload,business_id:state.business.id,stock_qty:qty}).select().single();if(error){toast(error.message,true);return;}
  if(qty>0){const {error:movementError}=await db.from('stock_movements').insert({business_id:state.business.id,product_id:data.id,movement_type:'opening',quantity_change:qty,quantity_after:qty,reason:'Opening stock'});if(movementError)toast(`Product saved. Opening movement could not be logged: ${movementError.message}`,true);}
  closeDialog('productDialog');$('productForm').reset();$('productType').disabled=false;$('trackImei').disabled=false;$('productDialogHeading').textContent='Add a product';await loadAll();toast('Product saved to your TechPoint catalogue. Add another whenever you need.');
}
function openProductEditor(id) {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  $('productForm').reset(); $('editingProductId').value=p.id; $('productDialogHeading').textContent='Edit product details';
  $('productName').value=p.name; $('productSku').value=p.sku; $('productCategory').value=p.category; $('productType').value=p.item_type;
  $('productType').disabled=true; $('trackImei').checked=p.track_imei; $('trackImei').disabled=true;
  $('productCost').value=p.purchase_price; $('productPrice').value=p.selling_price; $('productReorder').value=p.reorder_level;
  $('openingStockField').classList.add('hidden'); showDialog('productDialog');
}

async function addDevice(event) {
  event.preventDefault();const productId=$('deviceProduct').value;if(!productId){toast('Add an IMEI-tracked phone model first.',true);return;}
  const {error}=await db.rpc('add_device_unit',{p_product_id:productId,p_imei:$('deviceImei').value.trim(),p_serial_number:$('deviceSerial').value.trim(),p_storage:$('deviceStorage').value,p_colour:$('deviceColour').value.trim(),p_battery_health:$('deviceBattery').value?Number($('deviceBattery').value):null,p_condition:$('deviceCondition').value,p_purchase_cost:Number($('deviceCost').value)});
  if(error){toast(error.message,true);return;}closeDialog('deviceDialog');$('deviceForm').reset();await loadAll();toast('Phone registered. IMEI is now in your device register.');
}
async function adjustStock(id) {
  const product=state.products.find(p=>p.id===id);const raw=prompt(`Stock adjustment for ${product?.name||'product'}\nEnter a positive number to add, or a negative number to remove.`,'5');if(raw===null)return;const change=Number(raw);if(!Number.isInteger(change)||change===0){toast('Enter a non-zero whole number.',true);return;}const reason=prompt('Reason for this stock movement (e.g. new supplier stock, damaged item):','Restock');if(reason===null)return;
  const {error}=await db.rpc('adjust_stock',{p_product_id:id,p_change:change,p_reason:reason});if(error){toast(error.message,true);return;}await loadAll();toast('Stock movement saved.');
}
async function archiveProduct(id) {
  if(!confirm('Archive this product? It will no longer appear in new sales, but its historical records will remain.'))return;
  const {error}=await db.from('products').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id);if(error){toast(error.message,true);return;}await loadAll();toast('Product archived.');
}
function addToCart(product, qty, price, device = null, quiet = false) {
  const p = product; if (!p) return false;
  if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(price) || price < 0) { toast('Check quantity and selling price.', true); return false; }
  if (device) {
    if (device.product_id !== p.id || !state.devices.some(d => d.id === device.id)) { toast('That phone is no longer available.', true); return false; }
    if (state.cart.some(i => i.device_unit_id === device.id)) { toast('This device is already in the basket.', true); return false; }
    state.cart.push({ product_id:p.id, device_unit_id:device.id, quantity:1, unit_price:price, name:p.name, device_details:{ imei:device.imei, storage:device.storage, colour:device.colour, battery_health:device.battery_health } });
  } else {
    const already = state.cart.filter(i => i.product_id === p.id && !i.device_unit_id).reduce((n,i) => n + i.quantity, 0);
    if (already + qty > Number(p.stock_qty)) { toast(`Only ${Math.max(0, Number(p.stock_qty) - already)} units remain.`, true); return false; }
    const existing = state.cart.find(i => i.product_id === p.id && !i.device_unit_id && Number(i.unit_price) === Number(price));
    if (existing) existing.quantity += qty;
    else state.cart.push({ product_id:p.id, device_unit_id:null, quantity:qty, unit_price:price, name:p.name, device_details:null });
  }
  renderCart(); $('salePaid').dataset.auto = 'true'; updateCartTotal();
  if (!quiet) toast('Item added to basket.');
  return true;
}
function addCartItem(event) {
  event.preventDefault(); const p = state.products.find(x => x.id === $('cartProduct').value); if (!p) { toast('Add products and stock first.', true); return; }
  const qty = p.track_imei ? 1 : Number($('cartQty').value); const price = Number($('cartPrice').value);
  let device = null; if (p.track_imei) { device = state.devices.find(d => d.id === $('cartDevice').value); if (!device) { toast('Select an available phone IMEI.', true); return; } }
  if (addToCart(p, qty, price, device)) $('cartQty').value = 1;
}
async function completeSale(event) {
  event.preventDefault();if(!state.cart.length){toast('Add at least one item to the sale.',true);return;}
  const subtotal=state.cart.reduce((n,i)=>n+i.quantity*i.unit_price,0),discount=Number($('saleDiscount').value||0),total=subtotal-discount,paid=Number($('salePaid').value||0);
  if(discount<0||discount>subtotal||paid<0||paid>total){toast('Check discount and amount paid.',true);return;}
  $('completeSaleButton').disabled=true;$('completeSaleButton').textContent='Saving sale…';
  try{
    const saleArgs={p_customer_name:$('customerName').value.trim()||'Walk-in customer',p_customer_phone:$('customerPhone').value.trim(),p_discount:discount,p_items:state.cart.map(i=>({product_id:i.product_id,device_unit_id:i.device_unit_id,quantity:i.quantity,unit_price:i.unit_price})),p_amount_paid:paid,p_payment_method:$('saleMethod').value,p_payment_reference:$('saleReference').value.trim(),p_notes:$('saleNotes').value.trim()};
    if(!(await netOk())){const local=queueSale(saleArgs);state.cart=[];$('checkoutForm').reset();$('salePaid').dataset.auto='true';$('saleDiscount').value='0';paintAll();openReceipt(local);toast('Saved offline ✓ It will sync automatically when the internet returns.');return;}
    const {data,error}=await db.rpc('create_sale',saleArgs);
    if(error)throw error;const saleId=data;state.cart=[];$('checkoutForm').reset();$('salePaid').dataset.auto='true';$('saleDiscount').value='0';await loadAll();const sale=state.sales.find(s=>s.id===saleId);if(sale)openReceipt(sale);toast('Sale saved. Receipt generated.');
  }catch(error){toast(error.message||'Sale could not be saved.',true);}
  finally{$('completeSaleButton').disabled=false;$('completeSaleButton').textContent='Complete sale & generate receipt';renderCart();updatePaymentHint();}
}
function openReceipt(sale) {
  state.activeReceipt=sale;const b=state.business;const items=sale.sale_items||[];const payments=sale.sale_payments||[];
  const itemRows=items.map(i=>{const d=i.device_details||{};const detail=d.imei?`<br><small>IMEI: ${escapeHtml(d.imei)} · ${escapeHtml(d.storage||'')} · ${escapeHtml(d.colour||'')} ${d.battery_health?`· Battery ${d.battery_health}%`:''}</small>`:'';return `<tr><td>${escapeHtml(i.item_name)}${detail}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`;}).join('');
  $('receiptContent').innerHTML=`<div class="receipt-brand"><img class="receipt-mark" src="assets/techpoint-mark-black.png" alt=""><h2>${escapeHtml(b.business_name||'TechPoint ZM')}</h2><p class="receipt-tagline">PHONES &amp; ACCESSORIES</p><p>${escapeHtml(b.address||'')}</p><p>${escapeHtml(b.phone||'')}${b.email?` · ${escapeHtml(b.email)}`:''}</p></div><div class="receipt-title">SALES RECEIPT</div><div class="receipt-meta"><div><span>RECEIPT NUMBER</span><strong>${escapeHtml(sale.receipt_number)}</strong></div><div><span>DATE & TIME</span><strong>${fmtDateTime(sale.sale_date)}</strong></div><div><span>CUSTOMER</span><strong>${escapeHtml(sale.customer_name)}</strong></div><div><span>PHONE</span><strong>${escapeHtml(sale.customer_phone||'—')}</strong></div></div><table><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>TOTAL</th></tr></thead><tbody>${itemRows}</tbody></table><div class="receipt-totals"><div><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div><div><span>Discount</span><strong>${money(sale.discount)}</strong></div><div class="grand"><span>TOTAL</span><strong>${money(sale.total)}</strong></div><div><span>Amount paid</span><strong>${money(sale.amount_paid)}</strong></div><div><span>Balance due</span><strong>${money(sale.balance_due)}</strong></div></div><div class="receipt-meta"><div><span>PAYMENT STATUS</span><strong>${escapeHtml(sale.payment_status.replace('_',' ').toUpperCase())}</strong></div><div><span>PAYMENT METHOD</span><strong>${escapeHtml(paymentLabel(sale.payment_method))}</strong></div></div>${payments.length?`<p class="receipt-note"><strong>Payments:</strong> ${payments.map(p=>`${money(p.amount)} - ${escapeHtml(paymentLabel(p.method))}${p.reference?` (${escapeHtml(p.reference)})`:''}`).join('; ')}</p>`:''}${sale.notes?`<p class="receipt-note"><strong>Note:</strong> ${escapeHtml(sale.notes)}</p>`:''}<p class="receipt-note">${escapeHtml(b.warranty_note||'Please keep this receipt for your records.')}</p><div class="receipt-thanks"><strong>${escapeHtml(b.receipt_footer||'Thank you for shopping with TechPoint ZM.')}</strong><br><br>Powered by RSM TechCare</div><div id="receiptQrBox" class="receipt-qr hidden"><img id="receiptQrImg" alt="WhatsApp QR code"><small>Scan to chat with us on WhatsApp</small></div>`;
  showDialog('receiptDialog'); paintReceiptQr(sale);
}
async function collectPayment(id) {
  const sale=state.sales.find(s=>s.id===id);if(!sale)return;$('paymentSaleId').value=id;$('paymentBalance').textContent=money(sale.balance_due);$('paymentAmount').max=sale.balance_due;$('paymentAmount').value=Number(sale.balance_due).toFixed(2);$('paymentReference').value='';updatePaymentRefHint();showDialog('paymentDialog');
}
async function savePayment(event) {
  event.preventDefault();const id=$('paymentSaleId').value;const {data,error}=await db.rpc('record_sale_payment',{p_sale_id:id,p_amount:Number($('paymentAmount').value),p_method:$('paymentMethod').value,p_reference:$('paymentReference').value.trim()});if(error){toast(error.message,true);return;}closeDialog('paymentDialog');await loadAll();const sale=state.sales.find(s=>s.id===id);if(sale){openReceipt(sale);toast(`Payment saved. Remaining balance ${money(data)}.`);}
}
async function saveExpense(event) {
  event.preventDefault();const payload={business_id:state.business.id,description:$('expenseDescription').value.trim(),category:$('expenseCategory').value,amount:Number($('expenseAmount').value),expense_date:$('expenseDate').value,payment_method:$('expenseMethod').value};const {error}=await db.from('expenses').insert(payload);if(error){toast(error.message,true);return;}$('expenseForm').reset();$('expenseDate').value=today();await loadAll();toast('Expense saved.');
}
async function saveBusiness(event) {
  event.preventDefault();const payload={business_name:$('businessName').value.trim(),phone:$('businessPhone').value.trim(),email:$('businessEmail').value.trim(),address:$('businessAddress').value.trim(),receipt_footer:$('receiptFooter').value.trim(),warranty_note:$('warrantyNote').value.trim(),updated_at:new Date().toISOString()};const {error}=await db.from('businesses').update(payload).eq('id',state.business.id);if(error){toast(error.message,true);return;}await loadAll();toast('Business details saved.');
}
function exportAll() {
  const backup={exported_at:new Date().toISOString(),business:state.business,products:state.products,devices:state.devices,sales:state.sales,expenses:state.expenses,stock_movements:state.movements};const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`techpoint-zm-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast('Your data export has been downloaded.');
}
function clickAction(button) {
  const {action,id,index}=button.dataset;
  if(action==='register-device'){ $('deviceProduct').value=id;showDialog('deviceDialog'); }
  if(action==='edit-product')openProductEditor(id);
  if(action==='adjust-stock')adjustStock(id);
  if(action==='archive-product')archiveProduct(id);
  if(action==='restore-product')restoreProduct(id);
  if(action==='delete-product')deleteProduct(id);
  if(action==='delete-expense')deleteExpense(id);
  if(action==='delete-device')deleteDevice(id);
  if(action==='remove-cart'){state.cart.splice(Number(index),1);renderCart();}
  if(action==='view-receipt'){const sale=state.sales.find(s=>s.id===id);if(sale)openReceipt(sale);}
  if(action==='collect-payment')collectPayment(id);
}

// Navigation and form events
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.view)));
document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.go)));
document.querySelectorAll('[data-auth-mode]').forEach(el=>el.addEventListener('click',()=>{state.authMode=el.dataset.authMode;document.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b===el));$('authSubmit').textContent=state.authMode==='login'?'Sign in to your shop':'Create secure account';$('authPassword').autocomplete=state.authMode==='login'?'current-password':'new-password';showMessage('');}));
$('authForm').addEventListener('submit',authSubmit);$('signOutButton').addEventListener('click',signOut);$('userMenu').addEventListener('click',()=>navigate('settings'));
$('addProductButton').addEventListener('click',()=>{ $('productForm').reset();$('editingProductId').value='';$('productDialogHeading').textContent='Add a product';$('productType').disabled=false;$('trackImei').disabled=false;$('openingStockField').classList.remove('hidden');showDialog('productDialog'); });$('addDeviceButton').addEventListener('click',()=>{if(!$('deviceProduct').options.length||!$('deviceProduct').value){toast('Create a phone model and turn on IMEI tracking first.',true);return;}showDialog('deviceDialog');});
$('productForm').addEventListener('submit',addProduct);$('deviceForm').addEventListener('submit',addDevice);$('addCartForm').addEventListener('submit',addCartItem);$('checkoutForm').addEventListener('submit',completeSale);$('paymentForm').addEventListener('submit',savePayment);$('expenseForm').addEventListener('submit',saveExpense);$('businessForm').addEventListener('submit',saveBusiness);
$('cartProduct').addEventListener('change',updateCartProductDetails);$('saleDiscount').addEventListener('input',updateCartTotal);$('salePaid').addEventListener('input',()=>{$('salePaid').dataset.auto='false';updateCartTotal();});$('inventorySearch').addEventListener('input',renderInventory);$('inventoryFilter').addEventListener('change',renderInventory);$('salesSearch').addEventListener('input',renderSales);$('reportFrom').addEventListener('change',renderReports);$('reportTo').addEventListener('change',renderReports);$('exportDataButton').addEventListener('click',exportAll);$('exportSalesCsv').addEventListener('click',exportSalesCsv);$('installButton').addEventListener('click',async()=>{if(!installEvent)return;installEvent.prompt();await installEvent.userChoice;installEvent=null;$('installButton').classList.add('hidden');});$('printReceiptButton').addEventListener('click',()=>window.print());
$('shareReceiptButton').addEventListener('click', shareReceiptOnWhatsApp);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b)clickAction(b);});
$('trackImei').addEventListener('change',()=>{if($('trackImei').checked){$('productType').value='phone';$('productType').disabled=true;$('openingStockField').classList.add('hidden');}else{$('productType').disabled=false;$('openingStockField').classList.remove('hidden');}});
$('productType').addEventListener('change',()=>{if($('productType').value!=='phone'&&$('trackImei').checked){$('trackImei').checked=false;$('productType').disabled=false;$('openingStockField').classList.remove('hidden');}});
$('expenseDate').value=today();$('reportFrom').value=new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);$('reportTo').value=today();$('salePaid').dataset.auto='true';
window.addEventListener('online',()=>heartbeat(true));window.addEventListener('offline',()=>{_net={ok:false,at:Date.now()};setConnection(false);});

function bootError(msg){
  $('authScreen').classList.add('hidden');let b=document.getElementById('bootLoader');
  if(!b){b=document.createElement('div');b.id='bootLoader';b.style.cssText='position:fixed;inset:0;z-index:250;background:#000;color:#fff;display:grid;place-items:center;text-align:center;padding:24px;font-family:inherit';document.body.appendChild(b);}
  b.innerHTML=msg?`<div><img src="assets/techpoint-mark-white.png" style="width:150px;margin-bottom:18px"><p style="max-width:330px;margin:0 auto 16px;color:#ccc">${escapeHtml(msg)}</p><button class="btn btn-primary" style="background:#fff;color:#000" onclick="location.reload()">Try again</button></div>`:`<div><img src="assets/techpoint-mark-white.png" style="width:150px;margin-bottom:18px"><p style="color:#999;letter-spacing:2px;font-size:11px">OPENING YOUR SHOP…</p></div>`;
}
async function autoLogin(){
  bootError('');
  let {data,error}=await db.auth.signInWithPassword({email:cfg.OWNER_EMAIL,password:cfg.OWNER_PASSWORD});
  if(error){
    const r=await db.auth.signUp({email:cfg.OWNER_EMAIL,password:cfg.OWNER_PASSWORD});
    if(r.error){bootError('Could not open the shop: '+r.error.message);return;}
    if(!r.data.session){bootError('The shop account needs one more step: in Supabase, turn OFF “Confirm email” (Authentication → Sign In / Providers → Email), then tap Try again.');return;}
    data=r.data;
  }
  state.user=data.user||data.session?.user;await enterWorkspace();document.getElementById('bootLoader')?.remove();
}
const _getSession = db ? db.auth.getSession.bind(db.auth) : null;
function cachedUser() { try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) { const o = JSON.parse(localStorage.getItem(k)); return o?.user || o?.currentSession?.user || null; } } catch {} return null; }
if (db) db.auth.getSession = async () => {
  if (!navigator.onLine) { const u = cachedUser(); if (u) return { data:{ session:{ user:u } }, error:null }; }
  try { return await _getSession(); } catch (e) { const u = cachedUser(); if (u && isNetErr(e)) return { data:{ session:{ user:u } }, error:null }; throw e; }
};
if (!configured) { showAuth(); }
else {
  db.auth.getSession().then(async ({data,error})=>{if(error)throw error;if(data.session){state.user=data.session.user;await enterWorkspace();}else if(cfg.AUTO_LOGIN&&cfg.OWNER_EMAIL&&cfg.OWNER_PASSWORD)await autoLogin();else showAuth();}).catch(error=>{if(cfg.AUTO_LOGIN)bootError(error.message);else{showAuth();showMessage(error.message||'Could not restore session.');}});
  db.auth.onAuthStateChange((_event,session)=>{if(session){state.user=session.user;}else if(state.user&&!cfg.AUTO_LOGIN){state.user=null;state.business=null;showAuth();}});
}

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// ===== v0.4: splash, void sale, CSV import =====
(function(){
  const hasSession=Object.keys(localStorage).some(k=>/^sb-.*-auth-token$/.test(k));
  const sp=document.getElementById('splash');
  const close=()=>{sp.classList.add('out');setTimeout(()=>sp.remove(),450);};
  if(hasSession)sp.remove();else document.getElementById('splashGo').addEventListener('click',close);
})();
const _open=openReceipt;
openReceipt=function(sale){_open(sale);$('voidSaleButton').classList.toggle('hidden',!sale||sale.status!=='completed'||!!sale._pending);};
$('voidSaleButton').addEventListener('click',async()=>{
  const s=state.activeReceipt;if(!s)return;
  const reason=prompt(`Void receipt ${s.receipt_number}? Stock will be returned. Enter a reason:`);
  if(reason===null)return; if(!reason.trim()){toast('A reason is required.',true);return;}
  const {error}=await db.rpc('void_sale',{p_sale_id:s.id,p_reason:reason.trim()});
  if(error){toast(error.message,true);return;}
  closeDialog('receiptDialog');await loadAll();toast('Sale voided and stock returned.');
});
function parseCsv(t){const rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'&&t[i+1]==='"'){c+='"';i++;}else if(ch==='"')q=false;else c+=ch;}else if(ch==='"')q=true;else if(ch===','){r.push(c);c='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);c='';if(r.some(x=>x.trim()))rows.push(r);r=[];}else c+=ch;}r.push(c);if(r.some(x=>x.trim()))rows.push(r);return rows;}
$('importCsvButton').addEventListener('click',()=>$('csvFile').click());
$('csvFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;e.target.value='';
  const rows=parseCsv((await f.text()).replace(/^\ufeff/,''));const head=rows.shift().map(h=>h.trim().toLowerCase());
  const col=n=>head.indexOf(n);let ok=0,bad=0;
  for(const r of rows){
    const g=n=>(r[col(n)]||'').trim();const type=['phone','accessory','clothing','shoes','other'].includes(g('type'))?g('type'):'other';
    const qty=type==='phone'?0:Math.max(0,parseInt(g('qty'))||0);
    const {data,error}=await db.from('products').insert({business_id:state.business.id,name:g('name'),sku:g('sku')||`TPZ-${Date.now().toString().slice(-6)}${ok+bad}`,category:g('category')||'General',item_type:type,track_imei:type==='phone'&&g('imei')==='yes',purchase_price:Number(g('cost'))||0,selling_price:Number(g('price'))||0,reorder_level:parseInt(g('reorder'))||0,stock_qty:qty}).select().single();
    if(error||!g('name')){bad++;continue;}ok++;
    if(qty>0)await db.from('stock_movements').insert({business_id:state.business.id,product_id:data.id,movement_type:'opening',quantity_change:qty,quantity_after:qty,reason:'CSV import'});
  }
  await loadAll();toast(`Imported ${ok} product(s)${bad?`, ${bad} skipped`:''}.`,bad>0);
});

// ===== v0.5 — faster selling =====
const PAY_METHODS = ['cash','airtel_money','mtn_momo','bank_transfer','card','other'];

const THEMES = ['light','dark','black','royal'];
const THEME_BAR = { light:'#000000', dark:'#0a0e14', black:'#000000', royal:'#0a1a4a' };
function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'light';
  if (theme === 'light') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme;
  rawSet('tpz:theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', THEME_BAR[theme]);
  document.querySelectorAll('.theme-card').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}
function toggleTheme() { const cur = document.documentElement.dataset.theme || 'light'; applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]); }
function applyPaper(size) {
  const s = size === '58mm' ? '58mm' : 'a4';
  document.body.classList.toggle('paper-58', s === '58mm');
  rawSet('tpz:paper', s);
  let st = $('pageSizeStyle');
  if (!st) { st = document.createElement('style'); st.id = 'pageSizeStyle'; document.head.appendChild(st); }
  st.textContent = s === '58mm' ? '@page{size:58mm auto;margin:0}' : '';
  const sel = $('paperSize'); if (sel) sel.value = s;
}

function topSellerIds(days = 30) {
  const since = Date.now() - days * 86400000; const counts = new Map();
  for (const s of state.sales) {
    if (s.status !== 'completed') continue;
    if (new Date(s.sale_date).getTime() < since) continue;
    for (const i of s.sale_items || []) counts.set(i.product_id, (counts.get(i.product_id) || 0) + Number(i.quantity));
  }
  return [...counts.entries()].sort((a,b) => b[1] - a[1]).map(([id]) => id);
}
function renderQuickSell() {
  const grid = $('quickSellGrid'); if (!grid) return;
  const active = state.products.filter(p => p.is_active && Number(p.stock_qty) > 0);
  let list;
  if (state.quickMode === 'top') {
    const ids = topSellerIds(30);
    list = ids.map(id => active.find(p => p.id === id)).filter(Boolean).slice(0, 8);
    if (!list.length) list = active.slice(0, 8);
  } else {
    const q = ($('quickSearch')?.value || '').trim().toLowerCase();
    list = active.filter(p => [p.name,p.sku,p.category].join(' ').toLowerCase().includes(q)).slice(0, 24);
  }
  grid.innerHTML = list.length ? list.map(p => {
    const photo = p.image_url || state.photos[p.id]; const icon = ({phone:'📱',accessory:'🎧',clothing:'👕',shoes:'👟'})[p.item_type] || '📦';
    return `<button type="button" class="qs-tile" data-action="quick-add" data-id="${p.id}" title="Add ${escapeHtml(p.name)}"><div class="qs-media">${photo ? `<img src="${photo}" alt="">` : icon}</div>${p.track_imei ? '<span class="qs-flag">IMEI</span>' : ''}<div class="qs-body"><strong>${escapeHtml(p.name)}</strong><span class="qs-price">${money(p.selling_price)}</span><span class="qs-stock">${p.stock_qty} in stock</span></div></button>`;
  }).join('') : '<div class="empty-inline">No items available to sell.</div>';
}
function quickAdd(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  if (p.track_imei) {
    const devices = state.devices.filter(d => d.product_id === p.id);
    if (!devices.length) { toast('No IMEI is in stock for this phone.', true); return; }
    $('quickDeviceTitle').textContent = p.name;
    $('quickDeviceList').innerHTML = devices.map(d => `<button type="button" class="device-pick" data-action="quick-add-device" data-product="${p.id}" data-id="${d.id}"><span><strong>${escapeHtml(d.imei)}</strong><small>${escapeHtml([d.storage,d.colour].filter(Boolean).join(' · ') || 'Details not recorded')}${d.battery_health ? ` · ${d.battery_health}% battery` : ''}</small></span><span class="badge">${money(p.selling_price)}</span></button>`).join('');
    showDialog('quickDeviceDialog');
    return;
  }
  if (addToCart(p, 1, Number(p.selling_price), null, true)) toast(`${p.name} added.`);
}
function quickAddDevice(productId, deviceId) {
  const p = state.products.find(x => x.id === productId);
  const d = state.devices.find(x => x.id === deviceId && x.product_id === productId);
  if (!p || !d) return;
  if (addToCart(p, 1, Number(p.selling_price), d, true)) { closeDialog('quickDeviceDialog'); toast(`${p.name} · IMEI ${d.imei} added.`); }
}
function changeCartQty(index, delta) {
  const item = state.cart[index]; if (!item || item.device_unit_id) return;
  const p = state.products.find(x => x.id === item.product_id);
  const next = Number(item.quantity) + delta;
  if (next < 1) state.cart.splice(index, 1);
  else {
    const other = state.cart.filter((x,i) => i !== index && x.product_id === item.product_id && !x.device_unit_id).reduce((n,x) => n + Number(x.quantity), 0);
    if (p && other + next > Number(p.stock_qty)) { toast(`Only ${Number(p.stock_qty)} in stock.`, true); return; }
    item.quantity = next;
  }
  renderCart(); $('salePaid').dataset.auto = 'true'; updateCartTotal();
}

function loadHolds() { const h = lsGet('tpz:holds', []); return Array.isArray(h) ? h : []; }
function saveHolds(holds) { return lsSet('tpz:holds', holds); }
function renderHolds() {
  const holds = loadHolds();
  $('heldSalesBar').classList.toggle('hidden', !holds.length);
  $('heldSalesList').innerHTML = holds.map(h => {
    const n = (h.items || []).reduce((a,i) => a + Number(i.quantity), 0);
    const total = (h.items || []).reduce((a,i) => a + Number(i.quantity) * Number(i.unit_price), 0) - Number(h.discount || 0);
    return `<div class="held-chip"><button type="button" class="held-main" data-action="resume-hold" data-id="${h.id}"><strong>${escapeHtml(h.customer?.name || 'Held sale')}</strong><small>${n} item${n===1?'':'s'} · ${money(total)}</small></button><button type="button" class="held-x" data-action="delete-hold" data-id="${h.id}" aria-label="Delete held sale">×</button></div>`;
  }).join('');
}
function holdCurrentSale() {
  if (!state.cart.length) { toast('Add at least one item before holding.', true); return; }
  const holds = loadHolds();
  const id = (crypto.randomUUID ? crypto.randomUUID() : 'h' + Date.now());
  holds.unshift({ id, at:new Date().toISOString(), customer:{ name:$('customerName').value.trim(), phone:$('customerPhone').value.trim() }, items:state.cart.map(i => ({ ...i, device_details:i.device_details ? { ...i.device_details } : null })), discount:$('saleDiscount').value, paid:$('salePaid').value, method:$('saleMethod').value, reference:$('saleReference').value, notes:$('saleNotes').value });
  if (!saveHolds(holds)) { toast('Could not hold this sale: phone storage is full.', true); return; }
  state.cart = []; $('checkoutForm').reset(); $('saleDiscount').value = '0'; $('salePaid').dataset.auto = 'true';
  renderCart(); renderHolds(); updatePaymentHint(); toast('Sale held. Resume it from the Held sales bar.');
}
function resumeHold(id) {
  const holds = loadHolds(); const h = holds.find(x => x.id === id); if (!h) return;
  state.cart = (h.items || []).map(i => ({ ...i, device_details:i.device_details ? { ...i.device_details } : null }));
  $('customerName').value = h.customer?.name || ''; $('customerPhone').value = h.customer?.phone || '';
  $('saleDiscount').value = h.discount || '0'; $('salePaid').value = h.paid || '0'; $('salePaid').dataset.auto = 'false';
  $('saleMethod').value = h.method || 'cash'; $('saleReference').value = h.reference || ''; $('saleNotes').value = h.notes || '';
  if (!saveHolds(holds.filter(x => x.id !== id))) { toast('Storage error while resuming.', true); return; }
  renderCart(); renderHolds(); updateCartTotal(); updatePaymentHint(); navigate('checkout');
  const missing = state.cart.filter(i => i.device_unit_id && !state.devices.some(d => d.id === i.device_unit_id)).length;
  toast(missing ? `${missing} held phone(s) are no longer in stock. Remove them before completing.` : 'Sale resumed.', missing > 0);
}
function deleteHold(id) {
  if (!confirm('Delete this held sale?')) return;
  saveHolds(loadHolds().filter(h => h.id !== id)); renderHolds();
}

function compressImage(file, max = 420, quality = .72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url); resolve(data);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
function dataUrlToBlob(d) { const [h,b64]=d.split(','); const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return new Blob([u],{type:'image/jpeg'}); }
async function uploadPhotoBlob(blob) {
  const path = `${state.business.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from('product-images').upload(path, blob, { contentType:'image/jpeg', cacheControl:'31536000' });
  if (error) throw error;
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
function pickProductPhoto(id) {
  // No "capture" attribute: phones offer BOTH "Take Photo" and "Photo Library / Choose File".
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none'; document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0]; input.remove(); if (!file) return;
    toast('Saving photo…');
    try {
      const data = await compressImage(file, 900, .8);
      try {
        const url = await uploadPhotoBlob(dataUrlToBlob(data));
        const { error } = await db.from('products').update({ image_url:url, updated_at:new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        if (state.photos[id]) { const n={...state.photos}; delete n[id]; lsSet('tpz:photos', n); state.photos=n; }
        await loadAll(); toast('Photo saved for everyone.');
      } catch (cloudErr) {
        const small = await compressImage(file, 420, .72); const next = { ...state.photos, [id]:small };
        if (!lsSet('tpz:photos', next)) { toast('Photo storage is full. Remove an old photo first.', true); return; }
        state.photos = next; renderInventory(); renderQuickSell(); toast('Saved on this phone only (cloud photos need the v0.6 SQL).', true);
      }
    } catch { toast('Could not use that photo.', true); }
  });
  input.click();
}
async function removeProductPhoto(id) {
  if (!confirm('Remove this product photo?')) return;
  const p = state.products.find(x => x.id === id);
  if (p?.image_url) { const { error } = await db.from('products').update({ image_url:null }).eq('id', id); if (error) { toast(error.message, true); return; } }
  const next = { ...state.photos }; delete next[id]; lsSet('tpz:photos', next); state.photos = next;
  await loadAll();
}
async function migratePhotos() {
  if (state.photoSync || state.photoSyncFailed || !state.business) return;
  const ids = Object.keys(state.photos).filter(id => { const p=state.products.find(x=>x.id===id); return p && !p.image_url; });
  if (!ids.length) return; state.photoSync = true; let n = 0;
  try {
    for (const id of ids) {
      const url = await uploadPhotoBlob(dataUrlToBlob(state.photos[id]));
      const { error } = await db.from('products').update({ image_url:url }).eq('id', id); if (error) throw error;
      const next = { ...state.photos }; delete next[id]; lsSet('tpz:photos', next); state.photos = next; n++;
    }
  } catch { state.photoSyncFailed = true; }
  state.photoSync = false;
  if (n) { await loadAll(); toast(`${n} photo${n===1?'':'s'} synced to the cloud.`); }
}
async function shareProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  const b = state.business || {};
  const text = `${b.business_name || 'TechPoint ZM'}\n${p.name}\n${money(p.selling_price)}\n${Number(p.stock_qty) > 0 ? 'In stock' : 'Out of stock'}${p.category ? ` · ${p.category}` : ''}\n\n${b.address ? b.address + '\n' : ''}${b.phone ? b.phone + '\n' : ''}Reply here to order or ask for delivery.`;
  const photo = state.photos[id];
  if (photo && navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(photo)).blob();
      const safe = String(p.name).replace(/[^\w-]+/g, '-').slice(0, 30) || 'product';
      const file = new File([blob], `${safe}.jpg`, { type:blob.type || 'image/jpeg' });
      if (navigator.canShare({ files:[file] })) { await navigator.share({ files:[file], text, title:p.name }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptCache.delete(src); reject(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
  scriptCache.set(src, promise); return promise;
}
function loadQrLib() {
  if (window.QRCode && window.QRCode.toDataURL) return Promise.resolve(window.QRCode);
  if (!qrLibPromise) {
    qrLibPromise = loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
      .then(() => { if (!window.QRCode || !window.QRCode.toDataURL) throw new Error('QR library did not start'); return window.QRCode; })
      .catch(e => { qrLibPromise = null; throw e; });
  }
  return qrLibPromise;
}
async function getQr(text, size = 180) {
  const key = `${size}|${text}`;
  if (qrCache.has(key)) return qrCache.get(key);
  const lib = await loadQrLib();
  const url = await lib.toDataURL(text, { width:size, margin:1, errorCorrectionLevel:'M' });
  qrCache.set(key, url); return url;
}
function paintReceiptQr(sale) {
  const box = $('receiptQrBox'); const img = $('receiptQrImg');
  if (!box || !img) return;
  box.classList.add('hidden'); img.removeAttribute('src');
  const phone = state.business?.phone; if (!phone) return;
  const token = sale?.id;
  getQr('https://wa.me/' + zmNumber(phone), 160).then(url => {
    if (!state.activeReceipt || state.activeReceipt.id !== token) return;
    img.src = url; box.classList.remove('hidden');
  }).catch(() => {});
}
async function printLabels(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  const suggested = Math.max(1, Math.min(20, Number(p.stock_qty) || 1));
  const raw = prompt(`How many QR labels for ${p.name}?`, String(suggested));
  if (raw === null) return;
  const count = Math.max(1, Math.min(50, parseInt(raw, 10) || 1));
  const w = window.open('', '_blank', 'width=780,height=900');
  if (!w) { toast('Allow pop-ups to print labels.', true); return; }
  w.document.write('<p style="font-family:Arial;padding:24px">Preparing QR labels…</p>');
  try {
    const qr = await getQr('TPZ:' + p.sku, 240);
    const b = state.business || {};
    const label = `<div class="label"><img src="${qr}" alt=""><div class="meta"><strong>${escapeHtml(String(p.name).slice(0, 42))}</strong><span>${escapeHtml(p.sku)}</span><b>${money(p.selling_price)}</b><small>${escapeHtml(b.business_name || 'TechPoint ZM')}</small></div></div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR labels</title><style>body{font-family:Arial,sans-serif;margin:8mm;color:#111}.sheet{display:grid;grid-template-columns:repeat(3,58mm);gap:5mm}.label{border:1px dashed #bbb;border-radius:2mm;padding:3mm;display:flex;gap:3mm;align-items:center;height:30mm;box-sizing:border-box;overflow:hidden}.label img{width:23mm;height:23mm;flex-shrink:0}.meta{min-width:0}.meta strong{display:block;font-size:8.5pt;line-height:1.1;max-height:19pt;overflow:hidden}.meta span{display:block;font-size:6.5pt;color:#555;margin-top:2px}.meta b{display:block;font-size:10.5pt;margin-top:2px}.meta small{display:block;font-size:5.8pt;color:#777;margin-top:2px}@page{size:A4;margin:8mm}</style></head><body><div class="sheet">${label.repeat(count)}</div></body></html>`;
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 700);
  } catch { w.close(); toast('QR labels need an internet connection the first time.', true); }
}
function receiptText(s) {
  const b = state.business || {};
  const lines = (s.sale_items || []).map(i => `${i.item_name} x${i.quantity}: ${money(i.line_total)}${i.device_details?.imei ? ` (IMEI ${i.device_details.imei})` : ''}`).join('\n');
  return `Hello ${s.customer_name || 'customer'},\n\nThank you for shopping at ${b.business_name || 'TechPoint ZM'}.\nReceipt: ${s.receipt_number}\nDate: ${fmtDateTime(s.sale_date)}\n\n${lines}\n\nSubtotal: ${money(s.subtotal)}\nDiscount: ${money(s.discount)}\nTOTAL: ${money(s.total)}\nPaid: ${money(s.amount_paid)}\nBalance: ${money(s.balance_due)}\n\n${b.warranty_note || ''}\n${b.receipt_footer || 'Thank you for shopping with us.'}\n\n${b.phone || ''}`.replace(/\n{3,}/g, '\n\n').trim();
}
function shareReceiptOnWhatsApp() {
  const s = state.activeReceipt; if (!s) return;
  const to = zmNumber(s.customer_phone || '');
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(receiptText(s))}`, '_blank', 'noopener');
}

function renderDebtors() {
  const listEl = $('debtorList'); if (!listEl) return;
  const map = new Map();
  for (const s of state.sales) {
    if (s.status !== 'completed' || Number(s.balance_due) <= 0) continue;
    const key = s.customer_phone ? zmNumber(s.customer_phone) : 'name:' + String(s.customer_name || 'Walk-in customer').toLowerCase();
    let d = map.get(key);
    if (!d) { d = { key, name:s.customer_name || 'Walk-in customer', phone:s.customer_phone || '', total:0, sales:[], oldest:s.sale_date }; map.set(key, d); }
    d.total += Number(s.balance_due); d.sales.push(s);
    if (new Date(s.sale_date) < new Date(d.oldest)) d.oldest = s.sale_date;
  }
  const list = [...map.values()].sort((a,b) => b.total - a.total);
  state.debtorList = list;
  $('debtorTotal').textContent = money(list.reduce((n,d) => n + d.total, 0));
  listEl.innerHTML = list.length ? list.map((d,i) => `<details class="debtor"><summary><div class="list-main"><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.phone || 'No phone number')} · ${d.sales.length} receipt${d.sales.length === 1 ? '' : 's'} · oldest ${fmtDate(d.oldest)}</small></div><div class="list-value"><strong>${money(d.total)}</strong><small>owed</small></div></summary><div class="debtor-sales">${d.sales.map(s => `<div class="debtor-sale"><span><strong>${escapeHtml(s.receipt_number)}</strong><small>${fmtDate(s.sale_date)} · ${money(s.balance_due)} of ${money(s.total)}</small></span><span class="debtor-sale-right"><button class="mini-btn" data-action="collect-payment" data-id="${s.id}">Collect</button></span></div>`).join('')}<div class="button-row"><button class="mini-btn" data-action="remind-debtor" data-index="${i}" ${d.phone ? '' : 'disabled'}>Remind on WhatsApp</button></div></div></details>`).join('') : '<div class="empty-inline">No outstanding balances.</div>';
}
function remindDebtor(index) {
  const d = state.debtorList[Number(index)]; if (!d) return;
  if (!d.phone) { toast('Add the customer phone on a sale to remind them.', true); return; }
  const b = state.business || {};
  const receipts = d.sales.map(s => `${s.receipt_number} (${money(s.balance_due)})`).join(', ');
  const text = `Hello ${d.name}, this is ${b.business_name || 'TechPoint ZM'}. A friendly reminder that ${money(d.total)} is still outstanding on ${receipts}. You can pay by cash, Airtel Money or MTN MoMo. Reply here if you would like the mobile money details. Thank you.`;
  window.open(`https://wa.me/${zmNumber(d.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function renderImeiLookup() {
  const input = $('imeiLookup'), box = $('imeiLookupResult'); if (!input || !box) return;
  const q = input.value.trim().toLowerCase();
  if (q.length < 4) {
    box.innerHTML = '<p class="helper-text">Search any IMEI or serial to see whether the phone is in stock, what it cost, who bought it and which receipt it was sold on.</p>';
    return;
  }
  const cards = [];
  for (const d of state.devices) {
    const hay = [d.imei, d.serial_number].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(q)) continue;
    const p = state.products.find(x => x.id === d.product_id);
    cards.push(`<div class="lookup-card"><div class="lookup-head"><strong>${escapeHtml(p?.name || 'Phone')}</strong><span class="badge">In stock</span></div><div class="lookup-grid"><div><span>IMEI</span><b>${escapeHtml(d.imei)}</b></div><div><span>Storage / colour</span><b>${escapeHtml([d.storage,d.colour].filter(Boolean).join(' · ') || '—')}</b></div><div><span>Condition</span><b>${escapeHtml(d.device_condition || '—')}</b></div><div><span>Battery</span><b>${d.battery_health ? d.battery_health + '%' : '—'}</b></div><div><span>Cost</span><b>${money(d.purchase_cost)}</b></div><div><span>In stock since</span><b>${fmtDate(d.created_at)}</b></div></div><p class="lookup-note">Not sold yet. After checkout the buyer and receipt will appear here.</p></div>`);
  }
  for (const s of state.sales) {
    for (const i of s.sale_items || []) {
      const det = i.device_details || {};
      const hay = [det.imei, det.serial_number].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) continue;
      cards.push(`<div class="lookup-card"><div class="lookup-head"><strong>${escapeHtml(i.item_name)}</strong><span class="badge ${s.status === 'voided' ? 'low' : ''}">${s.status === 'voided' ? 'Voided sale' : 'Sold'}</span></div><div class="lookup-grid"><div><span>IMEI</span><b>${escapeHtml(det.imei || '—')}</b></div><div><span>Sold on</span><b>${fmtDate(s.sale_date)}</b></div><div><span>Receipt</span><b>${escapeHtml(s.receipt_number)}</b></div><div><span>Customer</span><b>${escapeHtml(s.customer_name)}</b></div><div><span>Phone</span><b>${escapeHtml(s.customer_phone || '—')}</b></div><div><span>Sale price</span><b>${money(i.line_total)}</b></div><div><span>Cost</span><b>${money(i.unit_cost)}</b></div><div><span>Gross profit</span><b>${money(Number(i.line_total) - Number(i.unit_cost) * Number(i.quantity))}</b></div></div><div class="lookup-actions"><button class="mini-btn" data-action="view-receipt" data-id="${s.id}">Open receipt</button></div></div>`);
    }
  }
  box.innerHTML = cards.length ? cards.slice(0, 12).join('') : `<p class="helper-text">No phone matches “${escapeHtml(input.value.trim())}” in your recorded stock and sales.</p>`;
}

function renderProfitByDay(sales = reportRange()) {
  const map = new Map();
  for (const s of sales) {
    const k = localDay(new Date(s.sale_date));
    const r = map.get(k) || { revenue:0, gross:0, count:0 };
    r.revenue += Number(s.total);
    r.gross += (s.sale_items || []).reduce((m,i) => m + Number(i.line_total) - Number(i.unit_cost) * Number(i.quantity), 0) - Number(s.discount);
    r.count++; map.set(k, r);
  }
  const rows = [...map.entries()].sort((a,b) => b[0].localeCompare(a[0]));
  $('profitByDayTable').innerHTML = rows.map(([k,r]) => `<tr><td>${fmtDate(k + 'T12:00:00')}</td><td>${r.count}</td><td>${money(r.revenue)}</td><td>${money(r.gross)}</td></tr>`).join('');
  $('profitByDayEmpty').classList.toggle('hidden', rows.length > 0);
}
function renderSlowMoving() {
  const el = $('slowMovingList'); if (!el) return;
  const days = Number($('slowDays')?.value || 30);
  const cutoff = Date.now() - days * 86400000;
  const last = new Map();
  for (const s of state.sales) {
    if (s.status !== 'completed') continue;
    const t = new Date(s.sale_date).getTime();
    for (const i of s.sale_items || []) if (!last.has(i.product_id) || last.get(i.product_id) < t) last.set(i.product_id, t);
  }
  const rows = state.products.filter(p => p.is_active && Number(p.stock_qty) > 0)
    .map(p => ({ p, last:last.get(p.id) || 0 }))
    .filter(r => !r.last || r.last < cutoff)
    .sort((a,b) => (a.last || 0) - (b.last || 0));
  el.innerHTML = rows.length ? rows.slice(0, 15).map(r => {
    const d = r.last ? Math.floor((Date.now() - r.last) / 86400000) : null;
    return `<div class="list-row"><div class="list-main"><strong>${escapeHtml(r.p.name)}</strong><small>${d === null ? 'No sale in recorded history' : `Last sold ${d} days ago`} · ${r.p.stock_qty} in stock</small></div><div class="list-value"><strong>${money(Number(r.p.purchase_price) * Number(r.p.stock_qty))}</strong><small>cost tied up</small><button class="mini-btn" data-action="share-product" data-id="${r.p.id}">Share</button></div></div>`;
  }).join('') : '<div class="empty-inline">Nothing is sitting too long.</div>';
}

function closeoutData(date) {
  const sales = new Map(PAY_METHODS.map(m => [m,0]));
  const exp = new Map(PAY_METHODS.map(m => [m,0]));
  for (const s of state.sales) {
    if (s.status !== 'completed') continue;
    for (const p of s.sale_payments || []) {
      if (localDay(new Date(p.paid_at)) !== date) continue;
      const m = PAY_METHODS.includes(p.method) ? p.method : 'other';
      sales.set(m, (sales.get(m) || 0) + Number(p.amount));
    }
  }
  for (const e of state.expenses) {
    if (e.expense_date !== date) continue;
    const m = PAY_METHODS.includes(e.payment_method) ? e.payment_method : 'other';
    exp.set(m, (exp.get(m) || 0) + Number(e.amount));
  }
  const expectedCash = (sales.get('cash') || 0) - (exp.get('cash') || 0);
  const countedRaw = rawGet('tpz:counted:' + date, '');
  return { sales, exp, expectedCash, counted:countedRaw === '' ? null : Number(countedRaw), note:rawGet('tpz:closeout-note:' + date, '') };
}
function updateCloseoutDiff(d) {
  const diffEl = $('closeoutDiff'); if (!diffEl) return;
  if (d.counted === null || !Number.isFinite(d.counted)) {
    diffEl.className = 'closeout-diff neutral';
    diffEl.textContent = 'Enter the cash you counted to see the difference.';
    return;
  }
  const diff = d.counted - d.expectedCash;
  diffEl.className = 'closeout-diff ' + (Math.abs(diff) < 0.01 ? 'ok' : 'bad');
  diffEl.textContent = Math.abs(diff) < 0.01 ? 'Balanced. Drawer matches the records.' : `Counted ${money(d.counted)} · ${diff > 0 ? 'over by ' : 'short by '}${money(Math.abs(diff))}.`;
}
function renderCloseout() {
  const dateEl = $('closeoutDate'); if (!dateEl) return;
  if (!dateEl.value) dateEl.value = today();
  const d = closeoutData(dateEl.value);
  $('closeoutCounted').value = d.counted === null ? '' : Number(d.counted).toFixed(2);
  $('closeoutNote').value = d.note || '';
  const rows = [];
  for (const m of PAY_METHODS) {
    const s = d.sales.get(m) || 0, e = d.exp.get(m) || 0;
    if (!s && !e) continue;
    rows.push(`<div class="closeout-row"><span>${paymentLabel(m)}${e ? ` · expenses ${money(e)}` : ''}</span><strong>${money(s)}</strong></div>`);
  }
  if (!rows.length) rows.push('<div class="empty-inline">No payments recorded on this day.</div>');
  rows.push(`<div class="closeout-row sub"><span>Expected cash in drawer</span><strong>${money(d.expectedCash)}</strong></div>`);
  $('closeoutSummary').innerHTML = rows.join('');
  updateCloseoutDiff(d);
}
function printCloseout() {
  const date = $('closeoutDate').value || today();
  const d = closeoutData(date); const b = state.business || {};
  const rows = PAY_METHODS.filter(m => (d.sales.get(m) || 0) || (d.exp.get(m) || 0)).map(m => `<tr><td>${paymentLabel(m)}</td><td>${money(d.sales.get(m) || 0)}</td><td>${money(d.exp.get(m) || 0)}</td><td>${money((d.sales.get(m) || 0) - (d.exp.get(m) || 0))}</td></tr>`).join('');
  const note = rawGet('tpz:closeout-note:' + date, '');
  const counted = d.counted === null ? '—' : money(d.counted);
  const diff = d.counted === null ? '—' : money(d.counted - d.expectedCash);
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) { toast('Allow pop-ups to print.', true); return; }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Close-out ${escapeHtml(date)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;letter-spacing:1px;color:#555;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:left}th{font-size:10px;text-transform:uppercase;color:#555}.big{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}.total{font-weight:900;font-size:19px;border-top:2px solid #111;margin-top:6px;padding-top:10px}.sign{margin-top:60px;border-top:1px solid #999;width:240px;padding-top:6px;font-size:11px;color:#555}</style></head><body><h1>${escapeHtml(b.business_name || 'TechPoint ZM')}</h1><p style="font-size:11px;color:#555;margin:4px 0">${escapeHtml(b.address || '')}${b.phone ? ' · ' + escapeHtml(b.phone) : ''}</p><h2>DAILY CLOSE-OUT · ${escapeHtml(fmtDate(date + 'T12:00:00'))}</h2><table><thead><tr><th>Method</th><th>Money in</th><th>Expenses</th><th>Net</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No payments recorded.</td></tr>'}</tbody></table><div class="big" style="margin-top:14px"><span>Expected cash in drawer</span><strong>${money(d.expectedCash)}</strong></div><div class="big"><span>Cash counted</span><strong>${counted}</strong></div><div class="big total"><span>Difference</span><strong>${diff}</strong></div><p style="font-size:11px;color:#555;margin-top:14px">Note: ${escapeHtml(note || '—')}</p><div class="sign">Counted by / signature</div><p style="font-size:9px;color:#888;margin-top:34px">Generated by TechPoint ZM · RSM TechCare</p></body></html>`;
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch {} }, 300);
}

let scanLock = false;
async function openScanner() {
  showDialog('scanDialog'); $('scanStatus').textContent = 'Starting camera…'; $('scanManual').value = '';
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
    if (!window.Html5Qrcode) throw new Error('Scanner library did not start');
    if (!tpHtml5) tpHtml5 = new window.Html5Qrcode('scanReader', { verbose:false });
    if (!scanRunning) {
      scanRunning = true;
      await tpHtml5.start({ facingMode:'environment' }, { fps:8, qrbox:(vw,vh) => { const s = Math.max(160, Math.floor(Math.min(vw,vh) * .7)); return { width:s, height:s }; } }, onScanSuccess, () => {});
      $('scanStatus').textContent = 'Point the camera at a barcode or TechPoint QR label.';
      if (!$('scanDialog').open) await stopScanner();
    }
  } catch {
    scanRunning = false;
    $('scanStatus').textContent = 'Camera not available. Type the barcode, SKU or IMEI below.';
  }
}
async function stopScanner() {
  if (!tpHtml5 || !scanRunning) return;
  try { await tpHtml5.stop(); } catch {}
  try { tpHtml5.clear(); } catch {}
  scanRunning = false;
}
async function handleScan(raw) {
  let code = String(raw || '').trim();
  if (!code) return false;
  code = code.replace(/^TPZ:/i, '').trim();
  const lower = code.toLowerCase();
  const device = state.devices.find(d => String(d.imei).toLowerCase() === lower || String(d.serial_number || '').toLowerCase() === lower);
  if (device) {
    const p = state.products.find(x => x.id === device.product_id);
    if (p) {
      const ok = addToCart(p, 1, Number(p.selling_price), device, true);
      if (ok) toast(`${p.name} · IMEI ${device.imei} added.`);
      return ok;
    }
  }
  const p = state.products.find(x => x.is_active && (String(x.sku).toLowerCase() === lower || String(x.name).toLowerCase() === lower));
  if (!p) {
    const sold = state.sales.find(s => (s.sale_items || []).some(i => String(i.device_details?.imei || '').toLowerCase() === lower));
    $('scanStatus').textContent = sold ? `That phone was already sold on receipt ${sold.receipt_number}.` : `No item matches “${code}”. Check the code or type the SKU below.`;
    return false;
  }
  if (p.track_imei) {
    closeDialog('scanDialog'); await stopScanner();
    setTimeout(() => quickAdd(p.id), 60);
    return true;
  }
  const ok = addToCart(p, 1, Number(p.selling_price), null, true);
  if (ok) toast(`${p.name} added.`);
  return ok;
}
async function onScanSuccess(text) {
  if (scanLock) return;
  scanLock = true;
  let ok = false;
  try { ok = await handleScan(text); } finally {
    if (ok) { await stopScanner(); closeDialog('scanDialog'); }
    setTimeout(() => { scanLock = false; }, ok ? 400 : 1500);
  }
}

function pinRecord() { const p = lsGet('tpz:pin', null); return p && p.hash && p.salt ? p : null; }
function hasPin() { return !!pinRecord(); }
async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randHex(n = 12) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}
function updatePinUi() {
  const on = hasPin();
  const s = $('pinStatus'); if (s) s.textContent = on ? 'A PIN is set on this phone.' : 'No PIN set.';
  $('removePinButton')?.classList.toggle('hidden', !on);
  $('lockNowButton')?.classList.toggle('hidden', !on);
  const set = $('setPinButton'); if (set) set.textContent = on ? 'Change PIN' : 'Set PIN';
}
async function savePin(event) {
  event.preventDefault();
  const pin = $('pinNew').value, confirmPin = $('pinConfirm').value;
  if (!/^\d{4}$/.test(pin)) { toast('Use exactly 4 digits.', true); return; }
  if (pin !== confirmPin) { toast('The two PINs do not match.', true); return; }
  if (!crypto.subtle) { toast('PIN lock needs a secure HTTPS connection.', true); return; }
  const salt = randHex();
  const hash = await hashPin(pin, salt);
  if (!lsSet('tpz:pin', { salt, hash, set_at:new Date().toISOString() })) { toast('Could not save the PIN on this phone.', true); return; }
  sessionStorage.setItem('tpz:unlocked', '1');
  closeDialog('pinDialog'); $('pinForm').reset(); updatePinUi(); resetIdle(); toast('App PIN saved.');
}
function removePin() {
  if (!hasPin()) return;
  if (!confirm('Remove the app PIN?')) return;
  localStorage.removeItem('tpz:pin'); sessionStorage.removeItem('tpz:unlocked');
  hideLock(); updatePinUi(); toast('PIN removed.');
}
function showLock() {
  if (!hasPin() || $('appShell').classList.contains('hidden')) return;
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch {} });
  $('lockScreen').classList.remove('hidden');
  $('lockMessage').textContent = ''; $('lockPin').value = '';
  setTimeout(() => $('lockPin').focus(), 80);
}
function hideLock() { $('lockScreen').classList.add('hidden'); }
async function unlock() {
  const rec = pinRecord(); if (!rec) return hideLock();
  const pin = $('lockPin').value;
  if (!/^\d{4}$/.test(pin)) { $('lockMessage').textContent = 'Enter 4 digits.'; return; }
  const hash = await hashPin(pin, rec.salt);
  if (hash !== rec.hash) {
    $('lockMessage').textContent = 'Wrong PIN. Try again.';
    $('lockPin').value = ''; $('lockPin').focus(); return;
  }
  sessionStorage.setItem('tpz:unlocked', '1');
  hideLock(); $('lockPin').value = ''; resetIdle();
}
function gateOnBoot() {
  if (hasPin() && sessionStorage.getItem('tpz:unlocked') !== '1') showLock();
  else resetIdle();
}
function lockNow(notify = false) {
  if (!hasPin()) { if (notify) toast('Set a PIN first.', true); return; }
  sessionStorage.removeItem('tpz:unlocked'); showLock();
}
let idleTimer = null;
function resetIdle() {
  clearTimeout(idleTimer);
  if (!hasPin()) return;
  idleTimer = setTimeout(() => { if (state.user && !$('appShell').classList.contains('hidden')) lockNow(); }, 5 * 60 * 1000);
}

function updatePaymentHint() {
  const m = $('saleMethod')?.value; const ref = $('saleReference'); if (!ref) return;
  const map = { airtel_money:'Airtel Money transaction ID', mtn_momo:'MTN MoMo transaction ID', bank_transfer:'Bank transfer reference', card:'Card / POS reference' };
  const label = ref.closest('.field')?.querySelector('label');
  if (label) label.textContent = `${map[m] || 'Payment reference'} (optional)`;
  ref.placeholder = map[m] ? 'Paste the ID from your SMS' : 'Mobile money transaction ID';
  ref.classList.toggle('ref-highlight', !!map[m]);
}
function updatePaymentRefHint() {
  const m = $('paymentMethod')?.value; const ref = $('paymentReference'); if (!ref) return;
  const map = { airtel_money:'Airtel Money transaction ID', mtn_momo:'MTN MoMo transaction ID', bank_transfer:'Bank transfer reference', card:'Card / POS reference' };
  ref.placeholder = map[m] || 'Reference';
}

$('themeToggle').addEventListener('click', toggleTheme);

$('paperSize').addEventListener('change', () => applyPaper($('paperSize').value));
document.querySelectorAll('[data-quick-mode]').forEach(b => b.addEventListener('click', () => {
  state.quickMode = b.dataset.quickMode;
  document.querySelectorAll('[data-quick-mode]').forEach(x => x.classList.toggle('active', x === b));
  renderQuickSell();
}));
$('quickSearch').addEventListener('input', () => {
  if (state.quickMode !== 'all') { state.quickMode = 'all'; document.querySelectorAll('[data-quick-mode]').forEach(x => x.classList.toggle('active', x.dataset.quickMode === 'all')); }
  renderQuickSell();
});
$('imeiLookup').addEventListener('input', renderImeiLookup);
$('slowDays').addEventListener('change', renderSlowMoving);
$('closeoutDate').addEventListener('change', renderCloseout);
$('closeoutCounted').addEventListener('input', () => {
  const date = $('closeoutDate').value || today();
  rawSet('tpz:counted:' + date, $('closeoutCounted').value);
  updateCloseoutDiff(closeoutData(date));
});
$('closeoutNote').addEventListener('input', () => {
  const date = $('closeoutDate').value || today();
  rawSet('tpz:closeout-note:' + date, $('closeoutNote').value);
});
$('printCloseout').addEventListener('click', printCloseout);
$('scanButton').addEventListener('click', openScanner);
$('scanManualForm').addEventListener('submit', async event => {
  event.preventDefault();
  const val = $('scanManual').value.trim(); if (!val) return;
  const ok = await handleScan(val);
  if (ok) { await stopScanner(); closeDialog('scanDialog'); $('scanManual').value = ''; }
});
$('scanDialog').addEventListener('close', () => { stopScanner(); });
$('holdSaleButton').addEventListener('click', holdCurrentSale);
$('clearCartButton').addEventListener('click', () => {
  if (!state.cart.length) return;
  if (!confirm('Clear the basket?')) return;
  state.cart = []; $('salePaid').dataset.auto = 'true'; renderCart(); updateCartTotal();
});
$('setPinButton').addEventListener('click', () => { $('pinForm').reset(); showDialog('pinDialog'); });
$('removePinButton').addEventListener('click', removePin);
$('lockNowButton').addEventListener('click', () => lockNow(true));
$('pinForm').addEventListener('submit', savePin);
$('unlockButton').addEventListener('click', unlock);
$('lockPin').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); unlock(); } });
$('lockSignOut').addEventListener('click', async () => {
  localStorage.removeItem('tpz:pin'); sessionStorage.removeItem('tpz:unlocked');
  hideLock(); await signOut();
});
$('printReceipt58Button').addEventListener('click', () => {
  const prev = rawGet('tpz:paper', 'a4');
  applyPaper('58mm');
  const restore = () => { applyPaper(prev); window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  setTimeout(() => { try { window.print(); } catch { restore(); } }, 80);
});
$('saleMethod').addEventListener('change', updatePaymentHint);
$('paymentMethod').addEventListener('change', updatePaymentRefHint);
document.addEventListener('click', event => {
  const b = event.target.closest('[data-action]'); if (!b) return;
  const { action, id, index } = b.dataset;
  if (action === 'quick-add') quickAdd(id);
  else if (action === 'quick-add-device') quickAddDevice(b.dataset.product, id);
  else if (action === 'cart-inc') changeCartQty(Number(index), 1);
  else if (action === 'cart-dec') changeCartQty(Number(index), -1);
  else if (action === 'resume-hold') resumeHold(id);
  else if (action === 'delete-hold') deleteHold(id);
  else if (action === 'remind-debtor') remindDebtor(index);
  else if (action === 'share-product') shareProduct(id);
  else if (action === 'print-label') printLabels(id);
  else if (action === 'product-photo') pickProductPhoto(id);
  else if (action === 'remove-photo') removeProductPhoto(id);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (hasPin()) sessionStorage.setItem('tpz:hiddenAt', String(Date.now())); return; }
  const t = Number(sessionStorage.getItem('tpz:hiddenAt') || 0);
  if (t && Date.now() - t > 5 * 60 * 1000) { sessionStorage.removeItem('tpz:unlocked'); showLock(); }
  sessionStorage.removeItem('tpz:hiddenAt'); resetIdle();
});
['pointerdown','keydown','touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive:true }));

applyTheme(rawGet('tpz:theme','light'));
applyPaper(rawGet('tpz:paper','a4'));
$('closeoutDate').value = $('closeoutDate').value || today();
renderHolds(); renderQuickSell(); updatePinUi(); updatePaymentHint(); updatePaymentRefHint();
if (hasPin()) resetIdle();

// ===== v0.6: delete / restore, settings tools, themes UI, update button =====
async function restoreProduct(id) {
  const { error } = await db.from('products').update({ is_active:true, updated_at:new Date().toISOString() }).eq('id', id);
  if (error) { toast(error.message, true); return; } await loadAll(); toast('Product restored.');
}
async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  const sold = state.sales.some(s => (s.sale_items || []).some(i => i.product_id === id));
  const archiveInstead = async () => {
    if (!p.is_active) { toast('This product has sales history, so it stays archived (hidden everywhere) to keep your reports correct.', true); return; }
    const { error } = await db.from('products').update({ is_active:false, updated_at:new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, true); return; } await loadAll(); toast('Archived. It is hidden from stock and selling but kept in your reports.');
  };
  if (sold) { if (confirm(`"${p.name}" has sales history, so it cannot be erased without breaking your reports.\n\nArchive it instead? It disappears from stock and selling.`)) await archiveInstead(); return; }
  if (!confirm(`Delete "${p.name}" permanently?\nIts stock records and registered phones will be removed too.`)) return;
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) { if (error.code === '23503') { await archiveInstead(); return; } toast(error.message, true); return; }
  if (state.photos[id]) { const n={...state.photos}; delete n[id]; lsSet('tpz:photos', n); state.photos=n; }
  await loadAll(); toast('Product deleted.');
}
async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  const { error } = await db.from('expenses').delete().eq('id', id);
  if (error) { toast(error.message, true); return; } await loadAll(); toast('Expense deleted.');
}
async function deleteDevice(id) {
  if (!confirm('Remove this phone from stock? Use this only for a registration mistake.')) return;
  const { error } = await db.rpc('delete_device_unit', { p_device_id:id });
  if (error) { toast(/function .*delete_device_unit/i.test(error.message) ? 'Run the v0.6 SQL in Supabase first.' : error.message, true); return; }
  await loadAll(); toast('Phone removed from stock.');
}
function exportProductsCsv() {
  const rows = [['Name','SKU','Category','Type','Buying cost','Selling price','In stock','Low-stock level','Active']];
  for (const p of state.products) rows.push([p.name,p.sku,p.category,p.item_type,p.purchase_price,p.selling_price,p.stock_qty,p.reorder_level,p.is_active?'yes':'archived']);
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type:'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = `techpoint-products-${today()}.csv`; a.click(); URL.revokeObjectURL(url); toast('Products CSV downloaded.');
}
document.querySelectorAll('.theme-card').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
$('defaultReorder').addEventListener('change', () => rawSet('tpz:reorder', String(Math.max(0, parseInt($('defaultReorder').value) || 0))));
$('addProductButton').addEventListener('click', () => setTimeout(() => { if (!$('editingProductId').value) $('productReorder').value = rawGet('tpz:reorder','5'); }, 0));
$('exportProductsCsv').addEventListener('click', exportProductsCsv);
$('settingsExportSales').addEventListener('click', exportSalesCsv);
$('showArchivedButton').addEventListener('click', () => { navigate('inventory'); $('inventoryFilter').value = 'archived'; renderInventory(); });
$('refreshAppButton').addEventListener('click', async () => {
  try { const regs = await navigator.serviceWorker?.getRegistrations(); for (const r of regs || []) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.reload();
});
applyTheme(rawGet('tpz:theme','light'));

// ===== v2.0 OFFLINE ENGINE =====
const OFFLINE_MSG = 'You are offline. Connect to the internet to do this — selling still works offline.';
const isNetErr = e => /failed to fetch|network|load failed|fetch|timeout|timed out|offline|abort/i.test((e && e.message) || String(e || ''));
let _net = { ok: navigator.onLine, at: 0 };
const isOffline = () => !navigator.onLine || _net.ok === false;
async function netOk(force = false) {
  if (!navigator.onLine) { _net = { ok:false, at:Date.now() }; return false; }
  if (!force && Date.now() - _net.at < 8000) return _net.ok;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 3500);
    await fetch(cfg.SUPABASE_URL + '/auth/v1/health', { mode:'no-cors', cache:'no-store', signal:c.signal });
    clearTimeout(t); _net = { ok:true, at:Date.now() };
  } catch { _net = { ok:false, at:Date.now() }; }
  return _net.ok;
}
// Block risky writes while offline with a friendly message (selling is queued instead).
const _rawRpc = db ? db.rpc.bind(db) : null, _rawFrom = db ? db.from.bind(db) : null;
function offlineBuilder() { const r = { data:null, error:{ message:OFFLINE_MSG } }; const b = {}; ['select','eq','neq','in','match','order','limit','single','maybeSingle','gte','lte'].forEach(m => b[m] = () => b); b.then = (res, rej) => Promise.resolve(r).then(res, rej); return b; }
if (db) {
  db.rpc = (n, a, o) => isOffline() ? Promise.resolve({ data:null, error:{ message:OFFLINE_MSG } }) : _rawRpc(n, a, o);
  db.from = t => { const b = _rawFrom(t); for (const m of ['insert','update','delete','upsert']) { if (typeof b[m] !== 'function') continue; const o = b[m].bind(b); b[m] = (...a) => isOffline() ? offlineBuilder() : o(...a); } return b; };
}
// phone storage (IndexedDB) for the last known shop data
const idbOpen = () => new Promise((res, rej) => { const r = indexedDB.open('tpz', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbSet(k, v) { const d = await idbOpen(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbGet(k) { const d = await idbOpen(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function saveSnapshot() { try { await idbSet('snap', { savedAt:Date.now(), business:state.business, products:state.products, devices:state.devices, sales:state.sales, expenses:state.expenses, movements:state.movements }); } catch {} }
async function useSnapshotIfNeeded() {
  if (!state.business) {
    let s = null; try { s = await idbGet('snap'); } catch {}
    if (!s || !s.business) { toast('No saved shop data on this phone yet. Open the app once with internet first.', true); return; }
    Object.assign(state, { business:s.business, products:s.products||[], devices:s.devices||[], sales:s.sales||[], expenses:s.expenses||[], movements:s.movements||[] });
    state.snapshotAt = s.savedAt; applyQueueToState(); paintAll();
  }
  setConnection(false);
}
// the offline sale queue
const getQueue = () => lsGet('tpz:queue', []) || [];
const setQueue = q => { lsSet('tpz:queue', q); updatePendingUi(); renderQueue(); };
const pendingCount = () => getQueue().length;
function localSaleFrom(args, qid) {
  const items = args.p_items.map(i => { const p = state.products.find(x => x.id === i.product_id) || {}; const c = state.cart.find(x => x.product_id === i.product_id && x.device_unit_id === i.device_unit_id) || {};
    return { product_id:i.product_id, device_unit_id:i.device_unit_id, item_name:p.name || c.name || 'Item', quantity:i.quantity, unit_price:i.unit_price, unit_cost:Number(p.purchase_price || 0), line_total:i.quantity * i.unit_price, device_details:c.device_details || null }; });
  const subtotal = items.reduce((n, i) => n + i.line_total, 0), total = subtotal - args.p_discount, paid = Math.min(args.p_amount_paid, total), now = new Date().toISOString();
  return { id:'local-' + qid, _pending:true, receipt_number:'OFFLINE-' + qid.slice(-5).toUpperCase(), customer_name:args.p_customer_name, customer_phone:args.p_customer_phone, status:'completed', subtotal, discount:args.p_discount, total, amount_paid:paid, balance_due:total - paid,
    payment_status: paid >= total ? 'paid' : paid > 0 ? 'part_paid' : 'unpaid', payment_method:args.p_payment_method, payment_reference:args.p_payment_reference, notes:args.p_notes, sale_date:now, created_at:now, sale_items:items, sale_payments: paid > 0 ? [{ method:args.p_payment_method, amount:paid }] : [] };
}
function applyLocalSale(sale) {
  if (state.sales.some(s => s.id === sale.id)) return;
  state.sales.unshift(sale);
  for (const i of sale.sale_items) { const p = state.products.find(x => x.id === i.product_id); if (p) p.stock_qty = Math.max(0, Number(p.stock_qty) - Number(i.quantity)); if (i.device_unit_id) state.devices = state.devices.filter(d => d.id !== i.device_unit_id); }
}
function applyQueueToState() { for (const q of getQueue()) applyLocalSale(q.sale); }
function queueSale(args) {
  const qid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sale = localSaleFrom(args, qid);
  const q = getQueue(); q.push({ qid, args, sale, createdAt:Date.now(), status:'pending', attempted:false, error:'' }); setQueue(q);
  applyLocalSale(sale); return sale;
}
async function alreadySaved(item) {
  try { const { data } = await db.from('sales').select('id,total,customer_name,created_at').gte('created_at', new Date(item.createdAt - 120000).toISOString()).limit(40);
    return (data || []).some(s => Math.abs(Number(s.total) - Number(item.sale.total)) < 0.005 && s.customer_name === item.sale.customer_name); } catch { return false; }
}
let _syncing = false;
async function syncQueue() {
  if (_syncing) return 0; let q = getQueue(); if (!q.some(i => i.status === 'pending')) return 0;
  if (!(await netOk(true))) return 0;
  _syncing = true; let ok = 0;
  for (const item of q) {
    if (item.status !== 'pending') continue;
    if (item.attempted && await alreadySaved(item)) { q = getQueue().filter(x => x.qid !== item.qid); setQueue(q); ok++; continue; }
    item.attempted = true; setQueue(q.map(x => x.qid === item.qid ? item : x));
    const { error } = await _rawRpc('create_sale', item.args);
    if (!error) { q = getQueue().filter(x => x.qid !== item.qid); setQueue(q); ok++; continue; }
    if (isNetErr(error)) { _net = { ok:false, at:Date.now() }; break; }
    item.status = 'failed'; item.error = error.message; q = getQueue().map(x => x.qid === item.qid ? item : x); setQueue(q);
  }
  _syncing = false;
  if (ok) { state.sales = state.sales.filter(s => !s._pending || getQueue().some(x => x.sale.id === s.id)); toast(`${ok} offline sale${ok === 1 ? '' : 's'} synced ✓`); }
  return ok;
}
// status pill + queue list
function updatePendingUi() {
  const n = pendingCount(), off = isOffline();
  $('syncStatus').textContent = off ? `Offline${n ? ` · ${n} waiting` : ''}` : n ? `Syncing · ${n} waiting` : 'Cloud connected';
  const b = $('connectionBanner');
  if (off) { b.textContent = 'You are offline. Keep selling — sales are saved on this phone and sync automatically when the internet returns.' + (state.snapshotAt ? ` Data as of ${new Date(state.snapshotAt).toLocaleString('en-ZM')}.` : ''); b.classList.remove('hidden'); }
}
const _setConn = setConnection; setConnection = function (online, label) { _setConn(online, label); updatePendingUi(); };
function renderQueue() {
  const el = document.getElementById('queueList'); if (!el) return; const q = getQueue();
  $('queueCount').textContent = q.length ? `${q.length} waiting` : 'All synced ✓';
  el.innerHTML = q.length ? q.map(i => `<div class="list-row"><div class="list-main"><strong>${escapeHtml(i.sale.receipt_number)} · ${escapeHtml(i.sale.customer_name)}</strong><small>${fmtDateTime(i.sale.sale_date)} · ${i.status === 'failed' ? '⚠ ' + escapeHtml(i.error) : 'waiting to sync'}</small></div><div class="list-value"><strong>${money(i.sale.total)}</strong>${i.status === 'failed' ? `<button class="mini-btn" data-action="queue-retry" data-id="${i.qid}">Retry</button><button class="mini-btn danger" data-action="queue-discard" data-id="${i.qid}">Discard</button>` : ''}</div></div>`).join('') : '<div class="empty-inline">No sales waiting. Everything is saved in the cloud.</div>';
}
async function heartbeat(force = false) {
  try { const was = _net.ok; const ok = await netOk(force); if (ok !== was || force) setConnection(ok);
    if (ok && state.user) { const n = await syncQueue(); if (n || (!was && ok)) await loadAll(); } } catch {}
}
setInterval(() => heartbeat(true), 25000);
const _paintAll = paintAll; paintAll = function () { _paintAll(); renderQueue(); updatePendingUi(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="queue-retry"],[data-action="queue-discard"]'); if (!b) return;
  const id = b.dataset.id, q = getQueue();
  if (b.dataset.action === 'queue-discard') { if (!confirm('Discard this offline sale? It will NOT be saved to the cloud.')) return; setQueue(q.filter(x => x.qid !== id)); state.sales = state.sales.filter(s => s.id !== 'local-' + id); loadAll(); }
  else { setQueue(q.map(x => x.qid === id ? { ...x, status:'pending', error:'' } : x)); heartbeat(true); }
});
// activity log (who did what)
async function loadAudit() {
  const el = $('auditList'); el.innerHTML = '<div class="empty-inline">Loading…</div>';
  const { data, error } = await db.from('audit_log').select('*').order('created_at', { ascending:false }).limit(60);
  if (error) { el.innerHTML = `<div class="empty-inline">${escapeHtml(/audit_log/.test(error.message) ? 'Run the v2.0 SQL in Supabase to turn on the activity log.' : error.message)}</div>`; return; }
  el.innerHTML = (data || []).length ? data.map(r => `<div class="list-row"><div class="list-main"><strong>${escapeHtml(r.action)} ${escapeHtml(r.table_name)}</strong><small>${escapeHtml(r.summary || '')} · ${escapeHtml((r.user_email || 'system'))}</small></div><div class="list-value"><small>${fmtDateTime(r.created_at)}</small></div></div>`).join('') : '<div class="empty-inline">No activity recorded yet.</div>';
}
$('refreshAuditButton').addEventListener('click', loadAudit);
renderQueue(); updatePendingUi(); heartbeat(false);
// a sale caught mid-sync when the app closed will be double-checked automatically
setQueue(getQueue().map(i => i.status === 'syncing' ? { ...i, status:'pending', attempted:true } : i));

// ===== v2.1: roles, team, system check, laptop tools =====
state.role = lsGet('tpz:role', 'owner') || 'owner';
function applyRole() {
  const r = state.role || 'owner';
  document.body.classList.remove('role-owner', 'role-manager', 'role-cashier'); document.body.classList.add('role-' + r);
  const tr = document.getElementById('teamRole'); if (tr) tr.textContent = 'You: ' + r[0].toUpperCase() + r.slice(1);
}
const _navigate = navigate;
navigate = function (view) {
  const blocked = { cashier:['reports','expenses','team'], manager:['team'] }[state.role] || [];
  if (blocked.includes(view)) { toast('Your role does not have access to that page.', true); view = 'dashboard'; }
  _navigate(view); if (view === 'team') loadTeam();
};
async function ensureRole() {
  applyRole(); if (state.roleLoaded || isOffline()) return;
  const { data, error } = await db.rpc('my_role');
  if (!error && data) { state.role = data; lsSet('tpz:role', data); state.roleLoaded = true; applyRole(); }
}
const _loadAll2 = loadAll; loadAll = async function () { await _loadAll2.apply(this, arguments); ensureRole(); };
// Team tab
let teamRows = [];
async function loadTeam() {
  const el = $('teamList'); if (!el) return;
  const { data, error } = await db.from('team_members').select('*').order('created_at');
  if (error) { el.innerHTML = `<div class="empty-inline">${escapeHtml(/team_members/.test(error.message) ? 'Run the v2.1 SQL in Supabase to turn on Team & access.' : error.message)}</div>`; return; }
  teamRows = data || []; const me = (state.user?.email || '').toLowerCase();
  el.innerHTML = teamRows.map(m => { const you = m.email.toLowerCase() === me; return `<div class="list-row"><div class="list-main"><strong>${escapeHtml(m.display_name || m.email)}${you ? ' (you)' : ''}${m.is_primary ? ' ★' : ''}</strong><small>${escapeHtml(m.email)}${m.active ? '' : ' · disabled'}</small></div><div class="list-value">
    <select class="select-input" data-team-role="${escapeHtml(m.email)}" ${m.is_primary ? 'disabled' : ''}><option value="owner" ${m.role==='owner'?'selected':''}>Owner</option><option value="manager" ${m.role==='manager'?'selected':''}>Manager</option><option value="cashier" ${m.role==='cashier'?'selected':''}>Cashier</option></select>
    ${m.is_primary ? '' : `<button class="mini-btn" data-team-toggle="${escapeHtml(m.email)}">${m.active ? 'Disable' : 'Enable'}</button><button class="row-del" title="Remove" data-team-del="${escapeHtml(m.email)}">🗑</button>`}</div></div>`; }).join('') || '<div class="empty-inline">No team members yet.</div>';
}
document.addEventListener('change', async e => {
  const s = e.target.closest('[data-team-role]'); if (!s) return;
  const { error } = await db.from('team_members').update({ role:s.value }).eq('email', s.dataset.teamRole);
  if (error) toast(error.message, true); else toast('Role updated.'); loadTeam();
});
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-team-toggle]'), d = e.target.closest('[data-team-del]');
  if (t) { const m = teamRows.find(x => x.email === t.dataset.teamToggle); const { error } = await db.from('team_members').update({ active:!m.active }).eq('email', m.email); if (error) toast(error.message, true); loadTeam(); }
  if (d && confirm('Remove this person from the team? They will no longer be able to open the shop.')) { const { error } = await db.from('team_members').delete().eq('email', d.dataset.teamDel); if (error) toast(error.message, true); else toast('Removed.'); loadTeam(); }
});
$('teamForm').addEventListener('submit', async e => {
  e.preventDefault(); const email = $('teamEmail').value.trim().toLowerCase();
  const { error } = await db.from('team_members').insert({ email, display_name:$('teamName').value.trim(), role:$('teamRoleSelect').value, added_by:state.user?.email || '' });
  if (error) { toast(/duplicate/i.test(error.message) ? 'That email is already on the team.' : error.message, true); return; }
  $('teamForm').reset(); toast('Added. Now create their login in Supabase → Authentication → Users.'); loadTeam();
});
$('openAuthUsers').addEventListener('click', () => { const ref = (cfg.SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1]; window.open(`https://supabase.com/dashboard/project/${ref}/auth/users`, '_blank', 'noopener'); });
// System check: proves the dashboard, stock, phones and sales agree
function runHealthCheck() {
  const out = [], ok = (t, d = '') => out.push({ good:true, t, d }), warn = (t, d = '') => out.push({ good:false, t, d });
  const active = state.products.filter(p => p.is_active), stock = active.reduce((n, p) => n + Number(p.stock_qty || 0), 0);
  const shownProducts = Number(($('productCount').textContent || '').replace(/[^\d]/g, '')), shownStock = Number(($('stockCount').textContent || '').replace(/[^\d]/g, ''));
  (shownProducts === active.length) ? ok('Dashboard product count matches inventory', `${active.length} active products`) : warn('Dashboard product count differs from inventory', `shows ${shownProducts}, inventory has ${active.length}`);
  (shownStock === stock) ? ok('Dashboard stock matches inventory', `${stock} units`) : warn('Dashboard stock differs from inventory', `shows ${shownStock}, inventory has ${stock}`);
  for (const p of active.filter(x => x.track_imei)) { const n = state.devices.filter(d => d.product_id === p.id).length; if (n !== Number(p.stock_qty)) warn(`Phone count mismatch: ${p.name}`, `stock says ${p.stock_qty}, but ${n} IMEI${n === 1 ? '' : 's'} registered. Register the missing IMEIs or remove extras.`); }
  active.filter(p => Number(p.stock_qty) < 0).forEach(p => warn(`Negative stock: ${p.name}`, `${p.stock_qty} — adjust stock to correct it.`));
  active.filter(p => Number(p.selling_price) <= 0).forEach(p => warn(`No selling price: ${p.name}`, 'Edit the product and set a price.'));
  active.filter(p => Number(p.selling_price) > 0 && Number(p.selling_price) < Number(p.purchase_price)).forEach(p => warn(`Selling below cost: ${p.name}`, `Cost K${p.purchase_price}, price K${p.selling_price}.`));
  const skus = {}; active.forEach(p => { (skus[String(p.sku).toLowerCase()] = skus[String(p.sku).toLowerCase()] || []).push(p.name); }); Object.values(skus).filter(a => a.length > 1).forEach(a => warn('Duplicate SKU', a.join(' / ')));
  state.sales.filter(s => s.status === 'completed' && !s._pending && Math.abs(Number(s.amount_paid) + Number(s.balance_due) - Number(s.total)) > 0.01).forEach(s => warn(`Receipt ${s.receipt_number} does not add up`, 'Paid + balance ≠ total.'));
  const n = pendingCount(); n ? warn(`${n} offline sale${n === 1 ? '' : 's'} waiting to sync`, 'Connect to the internet to send them.') : ok('No sales waiting to sync');
  const low = active.filter(p => Number(p.stock_qty) <= Number(p.reorder_level)).length; ok(`${low} product${low === 1 ? '' : 's'} at or below the low-stock level`);
  $('healthList').innerHTML = out.map(r => `<div class="list-row"><div class="list-main"><strong>${r.good ? '✅' : '⚠️'} ${escapeHtml(r.t)}</strong>${r.d ? `<small>${escapeHtml(r.d)}</small>` : ''}</div></div>`).join('');
  toast(out.some(r => !r.good) ? 'Check finished — some items need attention.' : 'All good — everything is in line ✓', out.some(r => !r.good));
}
$('runHealthButton').addEventListener('click', runHealthCheck);
// Paste from Excel
const ITEM_TYPES = { phone:'phone', phones:'phone', accessory:'accessory', accessories:'accessory', clothing:'clothing', clothes:'clothing', shoes:'shoes', shoe:'shoes', other:'other' };
function parseBulk(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(l.includes('\t') ? '\t' : ',').map(c => c.trim())).filter(c => !/^name$/i.test(c[0]))
    .map(c => ({ name:c[0], sku:c[1] || '', category:c[2] || 'General', item_type:ITEM_TYPES[(c[3] || 'other').toLowerCase()] || 'other', purchase_price:Number(String(c[4] || 0).replace(/[^\d.]/g, '')) || 0, selling_price:Number(String(c[5] || 0).replace(/[^\d.]/g, '')) || 0, qty:parseInt(c[6]) || 0, reorder_level:parseInt(c[7]) || 0 }));
}
$('bulkButton').addEventListener('click', () => { $('bulkText').value = ''; $('bulkPreview').textContent = 'Nothing pasted yet.'; showDialog('bulkDialog'); });
$('bulkText').addEventListener('input', () => { const r = parseBulk($('bulkText').value), bad = r.filter(x => !x.name || x.selling_price <= 0).length; $('bulkPreview').textContent = r.length ? `${r.length} product${r.length === 1 ? '' : 's'} ready${bad ? ` · ${bad} missing a name or price and will be skipped` : ''}.` : 'Nothing pasted yet.'; });
$('bulkForm').addEventListener('submit', async e => {
  e.preventDefault(); const rows = parseBulk($('bulkText').value).filter(x => x.name && x.selling_price > 0);
  if (!rows.length) { toast('Nothing to add. Check that each row has a name and a price.', true); return; }
  $('bulkImportBtn').disabled = true;
  const stamp = Date.now().toString().slice(-6);
  const payload = rows.map((r, i) => ({ business_id:state.business.id, name:r.name, sku:r.sku || `TPZ-${stamp}${i}`, category:r.category, item_type:r.item_type, track_imei:false, purchase_price:r.purchase_price, selling_price:r.selling_price, reorder_level:r.reorder_level, stock_qty:r.qty }));
  const { data, error } = await db.from('products').insert(payload).select();
  if (error) { toast(/duplicate/i.test(error.message) ? 'One of the SKUs already exists. Change it and try again.' : error.message, true); $('bulkImportBtn').disabled = false; return; }
  const moves = (data || []).filter(p => p.stock_qty > 0).map(p => ({ business_id:state.business.id, product_id:p.id, movement_type:'opening', quantity_change:p.stock_qty, quantity_after:p.stock_qty, reason:'Bulk import' }));
  if (moves.length) await db.from('stock_movements').insert(moves);
  $('bulkImportBtn').disabled = false; closeDialog('bulkDialog'); await loadAll(); toast(`${data.length} products added.`);
});
// Laptop: keyboard shortcuts + USB barcode scanner (keyboard-wedge)
document.addEventListener('keydown', e => {
  if (!state.user) return;
  const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'n')) { e.preventDefault(); navigate('checkout'); return; }
  if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); navigate(['dashboard','inventory','checkout','transactions','expenses','reports'][Number(e.key) - 1]); return; }
  if (e.ctrlKey && e.key === 'Enter' && state.view === 'checkout') { e.preventDefault(); const f = $('checkoutForm'); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable:true })); return; }
  if (e.key === '/' && !typing) { const i = document.querySelector('.view.active input[type="search"], .view.active .search-input'); if (i) { e.preventDefault(); i.focus(); } return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const now = performance.now();
  if (e.key === 'Enter') { const code = scanBuf; scanBuf = ''; if (code.length >= 4 && scanFast) { e.preventDefault(); if (state.view !== 'checkout') navigate('checkout'); handleScan(code).then(ok => { if (!ok) toast(`No item matches “${code}”.`, true); }); } return; }
  if (e.key.length !== 1) return;
  if (now - scanLast > 120) { scanBuf = ''; scanFast = true; }
  if (scanBuf && now - scanLast > 60) scanFast = false;
  scanBuf += e.key; scanLast = now;
});
let scanBuf = '', scanLast = 0, scanFast = true;
applyRole();
