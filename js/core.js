'use strict';
// Shared by every screen: talking to the sheet, local state, and the club's rules read from the rows.
// The same Apps Script API the Android app uses: "login" with a Google ID token, then "sync".
const API = 'https://script.google.com/macros/s/AKfycbyyqoFCGzhg2SGaucgW64WxV2d_l3ESVpqo976E8217vcF6bYh3EXYbpNKgGfevy36j1A/exec';
const CLIENT_ID = '448275437913-m1lfv3dq2r3ecsf55s7g5v5qfckpg8ji.apps.googleusercontent.com';
const TEAM = 'Friendly Sevilla';
const MAX_CALLED_UP = 18;
const STATES = ['OK', 'Tarde', 'Falta', 'No puede'];
const REASONS = ['Lesión', 'Trabajo', 'Otro'];
const KINDS = [['Entrenamiento', ''], ['Partido', 'Liga'], ['Amistoso', 'Amistoso'], ['Evento o torneo', 'Torneo']];
const CHARGE_CATEGORIES = ['Cuota', 'Equipación', 'Ropa', 'Otro'];
const MOVEMENT_CATEGORIES = ['Cuota', 'Equipación', 'A cuenta', 'Arbitraje', 'Campo', 'Material', 'Federación', 'Comida', 'Otro'];
const SHEET_FINE_REASONS = ['Tarde', 'Equipación', 'Amarilla', 'Doble amarilla', 'Roja', 'Otro'];
const CARDS = ['Amarilla', 'Doble amarilla', 'Roja'];

// ---------- storage (never required: the page works without it) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('fsc:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fsc:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem('fsc:' + k); } catch (e) { /* private mode */ } },
};

const S = {
  token: store.get('token', null),
  yo: store.get('yo', null),
  datos: store.get('datos', null),
  queue: store.get('queue', []),
  tab: null,
  day: null,
  part: null,
  open: null,
  viewSeason: '',
  syncing: false,
  lastSync: store.get('lastSync', null),
  error: '',
};

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => (n < 10 ? '0' : '') + n;
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const nowStamp = () => { const d = new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fdate = s => { const p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s || ''); };
const cents = s => { const n = parseFloat(String(s || '').replace(',', '.')); return isNaN(n) ? 0 : Math.round(n * 100); };
const money = c => { const e = c / 100; return (Number.isInteger(e) ? String(e) : e.toFixed(2).replace('.', ',')) + ' €'; };
/** 250 → "2.5": how the sheet keeps amounts. */
const amount = c => String(c / 100);
/** "2", "2,5", "2.50" → cents; null for anything else. */
function parseMoney(text) {
  const t = String(text || '').trim().replace('.', ',');
  const m = t.match(/^(\d*)(?:,(\d{0,2}))?$/);
  if (!m || (m[1] === '' && !m[2])) return null;
  return Number(m[1] || 0) * 100 + Number((m[2] || '').padEnd(2, '0') || 0);
}
/** "9", "9:30", "21h" → "09:00", "09:30", "21:00". */
function normTime(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(\d{1,2})(?:\s*[:.hH]\s*(\d{2})?)?\s*[hH]?$/);
  if (!m) return t;
  const h = Number(m[1]), mi = Number(m[2] || 0);
  return h > 23 || mi > 59 ? t : pad(h) + ':' + pad(mi);
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const rows = n => (S.datos && S.datos[n]) || [];
const isTrue = v => v === 'true' || v === true;
const countOf = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const by = () => (S.yo && (S.yo.nombre || S.yo.email)) || '';

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// ---------- roles ----------
const ROLE = () => (S.yo && S.yo.rol) || '';
const can = {
  editDays: () => ['Directiva', 'Entrenador'].includes(ROLE()) && editable(),
  deleteDays: () => ROLE() === 'Directiva' && editable(),
  callUp: () => ['Directiva', 'Entrenador'].includes(ROLE()) && editable(),
  report: () => ['Directiva', 'Entrenador'].includes(ROLE()) && editable(),
  mark: () => ['Directiva', 'Lista'].includes(ROLE()) && editable(),
  fine: () => ROLE() === 'Directiva' && editable(),
  collect: () => ROLE() === 'Directiva' && editable(),
  accounts: () => ROLE() === 'Directiva',
  seasons: () => ROLE() === 'Directiva',
  club: () => ['Directiva', 'Entrenador'].includes(ROLE()),
};

// ---------- API ----------
// Android phones are offered the app; the sheet notes "web" as the version of whoever uses this page.
const ANDROID = /Android/i.test(navigator.userAgent);
const APK_URL = 'android/FriendlySevillaClub.apk';
const androidLink = () => (ANDROID ? '<a class="btn primary wide app-link" href="' + APK_URL + '">📲 Descargar app para Android</a>' : '');

async function api(body) {
  body = Object.assign({ version: 'web' }, body);
  // text/plain keeps it a simple request, so the browser does not ask Apps Script for CORS permission first.
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

let timer = null;
function later() { clearTimeout(timer); timer = setTimeout(sync, 700); }

async function sync() {
  if (!S.token) return;
  if (S.syncing) { later(); return; }
  S.syncing = true; S.error = ''; renderStatus();
  const ops = S.queue.slice();
  try {
    const r = await api({ action: 'sync', token: S.token, ops: ops });
    if (!r.ok) {
      if (r.error === 'SESION') {
        // What was not sent yet stays on this device and goes up after signing in again with the same account.
        S.syncing = false;
        store.set('queueOwner', S.yo && S.yo.email);
        S.token = null; store.del('token');
        show();
        $('loginMsg').textContent = 'La sesión ha caducado: vuelve a entrar.' + (S.queue.length ? ' Tus ' + countOf(S.queue.length, 'cambio', 'cambios') + ' sin enviar se guardan.' : '');
        return;
      }
      throw new Error(r.error + (r.detalle ? ': ' + r.detalle : ''));
    }
    S.queue = S.queue.slice(ops.length);
    // The sheet checks every change again; if it turned something down, say so instead of losing it quietly.
    if (r.ignoradas > 0) toast(countOf(r.ignoradas, 'cambio no permitido', 'cambios no permitidos') + ' para tu rol: no se ha guardado');
    S.yo = r.yo; S.datos = r.datos; S.lastSync = Date.now();
    // What was changed meanwhile still shows until it goes up too.
    S.queue.forEach(applyLocal);
    store.set('yo', S.yo); store.set('datos', S.datos); store.set('queue', S.queue); store.set('lastSync', S.lastSync);
  } catch (e) {
    S.error = 'Sin conexión con la hoja: lo cambiado se envía al volver a actualizar.';
  } finally {
    S.syncing = false;
    render();
    if (S.queue.length && !S.error) later();
  }
}

const KEYS = { Avisos: ['Día ID', 'Jugador ID'], Convocatorias: ['Partido ID', 'Jugador ID'], Tarifas: ['Motivo'], Temporadas: ['Nombre'] };
const keyOf = (t, v) => (KEYS[t] || ['ID']).map(c => v[c]).join('|');

function applyLocal(o) {
  if (!S.datos) return;
  const list = S.datos[o.t] || (S.datos[o.t] = []);
  const k = keyOf(o.t, o.v);
  const i = list.findIndex(r => keyOf(o.t, r) === k);
  if (o.op === 'd') { if (i >= 0) list.splice(i, 1); return; }
  if (i >= 0) list[i] = Object.assign({}, list[i], o.v);
  else if (o.op === 'u') list.push(Object.assign({}, o.v));
}

/** Writes one change or several: shown at once, sent to the sheet a moment later. */
function send(ops) {
  (Array.isArray(ops) ? ops : [ops]).filter(Boolean).forEach(o => { S.queue.push(o); applyLocal(o); });
  store.set('queue', S.queue); store.set('datos', S.datos);
  render(); later();
}

// ---------- seasons ----------
function activeSeason() { const t = rows('Temporadas').find(r => isTrue(r['Activa'])); return t ? t['Nombre'] : ''; }
const viewed = () => S.viewSeason || activeSeason();
const editable = () => !S.viewSeason || S.viewSeason === activeSeason();
const seasonOf = r => r['Temporada'] || activeSeason();
const inSeason = (r, s) => !activeSeason() || seasonOf(r) === (s || viewed());

// ---------- players ----------
function players() {
  return rows('Jugadores').filter(p => isTrue(p['Activo']))
    .sort((a, b) => (Number(a['Dorsal']) || 999) - (Number(b['Dorsal']) || 999) || String(a['Nombre']).localeCompare(b['Nombre']));
}
const playerIds = () => players().map(p => p['ID']);
const playerName = id => { const p = rows('Jugadores').find(r => r['ID'] === id); return p ? p['Nombre'] : 'Ya no está en el equipo'; };
const isKeeper = p => /portero/i.test(p['Posición'] || '');

// ---------- days ----------
function dayOf(r, match) {
  if (!match) {
    return { id: r['ID'], date: r['Fecha'], match: false, label: 'Entrenamiento', type: '', session: 'Entrenamiento',
      title: r['Notas'] || '', time: r['Hora'] || '', meet: '', season: r['Temporada'] || '', row: r };
  }
  // Anything that is not a friendly or a tournament is a league match, also an empty Tipo typed by hand.
  const kind = KINDS.slice(1).find(k => k[1] === r['Tipo']) || KINDS[1];
  return {
    id: r['ID'], date: r['Fecha'], match: true, label: kind[0], type: r['Tipo'] || 'Liga',
    session: r['Tipo'] === 'Amistoso' ? 'Amistoso' : r['Tipo'] === 'Torneo' ? 'Torneo' : 'Partido',
    title: r['Rival'] || '', time: r['Hora partido'] || '', meet: r['Hora convocatoria'] || '', side: r['Local/Visitante'] || '',
    ground: r['Campo'] || '', address: r['Dirección'] || '', maps: r['URL Google Maps'] || '', kit: r['Equipación'] || '',
    confirmed: isTrue(r['Convocatoria confirmada']), gf: r['Goles a favor'] || '', ga: r['Goles en contra'] || '',
    status: r['Estado'] || '', season: r['Temporada'] || '', row: r,
  };
}
function allDays() {
  return rows('Entrenamientos').filter(r => r['ID'] && r['Fecha']).map(r => dayOf(r, false))
    .concat(rows('Partidos').filter(r => r['ID'] && r['Fecha']).map(r => dayOf(r, true)));
}
const days = s => allDays().filter(d => inSeason(d.row, s));
const findDay = id => allDays().find(d => d.id === id);
const dayTitle = d => [d.label, d.title.trim()].filter(Boolean).join(' · ');
const squad = d => rows('Convocatorias').filter(c => c['Partido ID'] === d.id).map(c => c['Jugador ID']);
/** At a training everyone is expected; at a match only the called-up. */
function calledUp(d) { const ids = playerIds(); if (!d.match) return ids; const sq = squad(d); return ids.filter(id => sq.includes(id)); }
const notCalledUp = d => (d.match ? playerIds().filter(id => !squad(d).includes(id)) : []);
const marksOf = dayId => rows('Asistencia').filter(a => a['Día ID'] === dayId);
const markOf = (dayId, pid) => rows('Asistencia').find(a => a['Día ID'] === dayId && a['Jugador ID'] === pid);
const unmarked = d => calledUp(d).filter(id => !markOf(d.id, id));
const noticeOf = (dayId, pid) => rows('Avisos').find(a => a['Día ID'] === dayId && a['Jugador ID'] === pid);
const came = m => m && (m['Estado'] === 'OK' || m['Estado'] === 'Tarde');

/** When a day starts, as the sheet judges warnings: the meeting time of a match, else its time. */
function dayStart(d) {
  const t = normTime(d.match ? (d.meet || d.time) : d.time);
  return d.date + ' ' + (/^\d{2}:\d{2}$/.test(t) ? t : '23:59');
}
/** A lateness warning that justifies being late: stamped in time, or not stamped yet while the day has not started. */
function warnedInTime(d, n) {
  return !!n && n['Tipo'] === 'Llego tarde' && (isTrue(n['A tiempo']) || (!n['Avisado'] && nowStamp() < dayStart(d)));
}

function noticeText(n, m, own) {
  if (own) {
    if (n['Tipo'] === 'No puedo ir') return 'Has avisado: no puedes ir' + (n['Motivo'] ? ' (' + n['Motivo'] + ')' : '');
    return 'Has avisado: llegas tarde' + (n['Hora llegada'] ? ', sobre las ' + n['Hora llegada'] : '') + (n['Motivo'] ? ' (' + n['Motivo'] + ')' : '');
  }
  if (n['Tipo'] === 'Llego tarde' && m && m['Estado'] === 'OK') return 'Avisó que llegaba tarde y llegó a su hora 👏';
  const what = n['Tipo'] === 'No puedo ir' ? 'no puede' : 'llega tarde' + (n['Hora llegada'] ? ' (' + n['Hora llegada'] + ')' : '');
  const time = !n['Avisado'] ? '' : isTrue(n['A tiempo']) ? ' · a tiempo' : ' · avisó tarde';
  return 'Avisó: ' + what + (n['Motivo'] ? ' · ' + n['Motivo'] : '') + time + (n['Apuntado por'] ? ' · lo apuntó ' + n['Apuntado por'] : '');
}

// ---------- rules and fines ----------
const rules = () => rows('Tarifas').filter(t => t['Motivo']).map(t => ({ label: t['Motivo'], cents: cents(t['Importe']) }));
const ruleFor = label => rules().find(r => r.label === label);
const lateRule = () => ruleFor('Tarde');
const kitRule = () => ruleFor('Equipación');

function paidByFine() {
  const out = {};
  rows('Contabilidad').forEach(m => { if (m['Multa ID']) out[m['Multa ID']] = (out[m['Multa ID']] || 0) + cents(m['Importe']); });
  return out;
}
function fineOf(f, paid) {
  const amountC = cents(f['Importe']), got = paid[f['ID']] || 0;
  const done = isTrue(f['Pagada']) || (got > 0 && got >= amountC);
  return {
    id: f['ID'], date: f['Fecha'], player: f['Jugador ID'], season: f['Temporada'] || '', origin: f['Origen'] || '',
    amount: amountC, paid: got, isPaid: done, rest: done ? 0 : Math.max(amountC - got, 0),
    label: f['Motivo'] === 'Otro' && f['Notas'] ? f['Notas'] : (f['Motivo'] || 'Multa'), row: f,
  };
}
function fines(filter) { const paid = paidByFine(); return rows('Multas').map(f => fineOf(f, paid)).filter(filter || (() => true)); }
const findFine = id => fines(f => f.id === id)[0];
/** What a fine is called in the sheet: a known reason, or "Otro" with the text in Notas. */
function fineReason(label) {
  const known = SHEET_FINE_REASONS.concat(rules().map(r => r.label)).concat(rows('Multas').map(m => m['Motivo']).filter(m => m && m !== 'Otro'));
  return known.includes(label) ? { 'Motivo': label } : { 'Motivo': 'Otro', 'Notas': label };
}
/** Unpaid fines of a player for a day: they go when the day stops applying to him. */
function dropDayFines(dayId, pid, label) {
  if (!can.fine()) return [];
  // What was already paid of one stays in his favour: the sheet keeps it as "A cuenta".
  return fines(f => f.origin === dayId && f.player === pid && !f.isPaid && (!label || f.label === label))
    .map(f => ({ t: 'Multas', op: 'd', v: { 'ID': f.id } }));
}

// ---------- money ----------
/**
 * Same rule as the app: a payment made for a charge counts for it; money given without saying what for
 * (or more than a charge needed) pays the oldest charges first, and what is left stays in his favour.
 * In a past season only that season's records count.
 */
function ledger(pid, season) {
  const only = r => !season || seasonOf(r) === season;
  const charges = rows('Cargos').filter(c => c['Jugador ID'] === pid && only(c))
    .sort((a, b) => seasonOf(a).localeCompare(seasonOf(b)) || String(a['Fecha']).localeCompare(String(b['Fecha'])) || String(a['ID']).localeCompare(String(b['ID'])));
  const mine = rows('Contabilidad').filter(m => m['Jugador ID'] === pid && only(m));
  const incomes = mine.filter(m => m['Tipo'] === 'Ingreso' && !m['Multa ID'] && m['Categoría'] !== 'Multa');
  const known = new Set(charges.map(c => c['ID']));
  const linked = {};
  incomes.forEach(m => { if (known.has(m['Cargo ID'])) linked[m['Cargo ID']] = (linked[m['Cargo ID']] || 0) + cents(m['Importe']); });
  const spent = mine.filter(m => m['Tipo'] === 'Traspaso').reduce((s, m) => s + cents(m['Importe']), 0);
  let credit = incomes.filter(m => !known.has(m['Cargo ID'])).reduce((s, m) => s + cents(m['Importe']), 0) - spent;
  const paid = {};
  charges.forEach(c => { const got = linked[c['ID']] || 0, amt = cents(c['Importe']); paid[c['ID']] = Math.min(got, amt); if (got > amt) credit += got - amt; });
  charges.forEach(c => {
    const use = Math.min(credit, cents(c['Importe']) - paid[c['ID']]);
    if (use > 0) { paid[c['ID']] += use; credit -= use; }
  });
  return {
    charges: charges.map(c => ({ id: c['ID'], date: c['Fecha'], category: c['Categoría'] || '', concept: c['Concepto'] || '', season: c['Temporada'] || '',
      amount: cents(c['Importe']), paid: paid[c['ID']], rest: Math.max(cents(c['Importe']) - paid[c['ID']], 0) })),
    credit: Math.max(credit, 0),
  };
}
/** A player's account: in the active season everything still owed from before too; a past season only itself. */
function account(pid) {
  const season = editable() ? '' : viewed();
  const led = ledger(pid, season);
  const pending = fines(f => f.player === pid && f.rest > 0 && (!season || seasonOf(f.row) === season));
  const total = led.charges.reduce((s, c) => s + c.rest, 0) + pending.reduce((s, f) => s + f.rest, 0);
  return { charges: led.charges, credit: led.credit, fines: pending, total: total };
}
const earlier = s => s && s !== viewed();
const shortSeason = s => { const m = String(s || '').match(/^(\d{4})\/(\d{4})$/); return m ? m[1].slice(2) + '/' + m[2].slice(2) : s; };
const payClass = (rest, paid) => (rest === 0 ? 'paid' : paid > 0 ? 'part' : 'owed');
const paidText = (amt, rest) => (rest === 0 ? money(amt) + ' ✓' : amt - rest > 0 ? money(amt - rest) + ' de ' + money(amt) : money(amt));

/** A short list to pick one player from, instead of a wall of buttons on a phone. */
function pickPlayer(id, list, selected, empty) {
  return '<select id="' + id + '" class="full">' + (empty ? '<option value="">' + esc(empty) + '</option>' : '')
    + list.map(p => '<option value="' + esc(p['ID']) + '"' + (p['ID'] === selected ? ' selected' : '') + '>' + esc((p['Dorsal'] ? p['Dorsal'] + ' · ' : '') + p['Nombre']) + '</option>').join('') + '</select>';
}

// ---------- WhatsApp ----------
function shareText(text) {
  try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) { /* not allowed */ }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}
