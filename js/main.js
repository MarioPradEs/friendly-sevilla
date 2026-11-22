'use strict';
// Navigation by role, sign-in, dialogs and the wiring of every button to its action.

const PORTAL = { inicio: viewHome, pagos: viewMoney, perfil: viewProfile };

function tabsFor() {
  const r = ROLE();
  if (r === 'Directiva') return [['dias', '📅', 'Días'], ['multas', '⚠', 'Multas'], ['plantilla', '👥', 'Plantilla'], ['resumen', '📊', 'Resumen'], ['cuentas', '€', 'Cuentas'], ['yo', '☺', 'Yo']];
  if (r === 'Entrenador') return [['dias', '📅', 'Días'], ['multas', '⚠', 'Multas'], ['plantilla', '👥', 'Plantilla'], ['resumen', '📊', 'Resumen'], ['yo', '☺', 'Yo']];
  const t = [['inicio', '⌂', 'Inicio'], ['pagos', '€', 'Pagos'], ['perfil', '☺', 'Mi perfil']];
  if (r === 'Lista') t.push(['dias', '✓', 'Lista']);
  return t;
}

function renderStatus() {
  if (!S.yo) return;
  const when = S.lastSync ? new Date(S.lastSync) : null;
  const parts = [(S.yo.nombre || S.yo.email) + (S.yo.rol ? ' · ' + S.yo.rol : '')];
  if (S.syncing) parts.push('Sincronizando…');
  else if (S.queue.length) parts.push('Pendiente de enviar');
  else if (when) parts.push('Al día · ' + pad(when.getDate()) + '/' + pad(when.getMonth() + 1) + ' ' + pad(when.getHours()) + ':' + pad(when.getMinutes()));
  $('status').innerHTML = esc(parts.join(' · ')) + (S.error ? '<div class="error">' + esc(S.error) + '</div>' : '');
}

function renderNav() {
  const tabs = tabsFor();
  if (!tabs.some(t => t[0] === S.tab)) S.tab = tabs[0][0];
  $('nav').innerHTML = tabs.map(t => '<button data-act="tab" data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '"><span class="ico">' + t[1] + '</span>' + t[2] + '</button>').join('');
}

function render() {
  if (!S.token) return;
  renderStatus(); renderNav();
  document.body.classList.toggle('wide', can.club());
  if (!S.datos) { $('view').innerHTML = '<p class="small">Cargando los datos de la hoja…</p>'; return; }
  let h;
  if (S.tab === 'dias') {
    const d = S.day && findDay(S.day);
    if (S.day && !d) S.day = null;
    h = d ? viewDay(d) : viewDays();
  } else if (S.tab === 'yo') {
    S.sub = S.sub || 'inicio';
    h = '<div class="chips">' + [['inicio', 'Inicio'], ['pagos', ROLE() === 'Entrenador' ? 'Mis multas' : 'Mis pagos'], ['perfil', 'Mi perfil']].map(x => '<button class="btn' + (S.sub === x[0] ? ' on' : '') + '" data-act="sub" data-sub="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>'
      + androidLink() + PORTAL[S.sub]();
  } else {
    h = ({ inicio: viewHome, pagos: viewMoney, perfil: viewProfile, multas: viewFines, plantilla: viewSquad, resumen: viewSummary, cuentas: viewAccounts }[S.tab] || viewHome)();
  }
  const y = window.scrollY;
  $('view').innerHTML = h;
  window.scrollTo(0, y);
}

/**
 * While someone types in the page, a sync coming back must not redraw it under their fingers:
 * the redraw waits until they leave the field.
 */
let redrawLater = false;
const typing = () => { const a = document.activeElement; return !!a && $('view').contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName); };
const renderNow = render;
render = function () {
  if (S.token && S.datos && typing()) { redrawLater = true; renderStatus(); return; }
  redrawLater = false;
  renderNow();
};
document.addEventListener('focusout', () => setTimeout(() => { if (redrawLater && !typing()) render(); }, 0));

// ---------- dialogs ----------
/** Closes the dialog, also on browsers without <dialog> (iPhones before iOS 15.4). */
function closeDialog() {
  const dlg = $('dlg');
  if (typeof dlg.close === 'function' && dlg.open) dlg.close();
  else dlg.removeAttribute('open');
  dlg.classList.remove('fallback');
}

/**
 * Cancelar only closes; the main button (value "ok") runs onOk, saved the moment it is pressed.
 * If onOk returns false (something missing), the dialog stays open with what was typed.
 * Enter in a field acts as the main button, never as Cancelar.
 */
function openDialog(html, setup, onOk) {
  const dlg = $('dlg');
  dlg.innerHTML = html;
  dlg.onclick = null;
  if (setup) setup(dlg);
  dlg.onsubmit = e => {
    e.preventDefault();
    const b = e.submitter || dlg.querySelector('button[value=ok]');
    if (!b || b.value !== 'ok') { closeDialog(); return; }
    if (onOk && onOk(dlg) === false) return;
    closeDialog();
  };
  dlg.onkeydown = e => { if (e.key === 'Escape') closeDialog(); };
  if (dlg.open) return;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else { dlg.setAttribute('open', ''); dlg.classList.add('fallback'); }
}
// Cancelar and the backdrop's close buttons are plain buttons: they never submit.
document.addEventListener('click', e => {
  const b = e.target.closest('#dlg button[value=cancel]');
  if (b) { e.preventDefault(); closeDialog(); }
});
function confirmDialog(title, text, ok, action) {
  openDialog('<form method="dialog"><div class="title">' + esc(title) + '</div><p>' + esc(text) + '</p><div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn danger" value="ok">' + esc(ok) + '</button></div></form>', null, action);
}

// ---------- actions ----------
const ACT = {
  tab: ds => { S.tab = ds.tab; S.day = null; S.open = null; render(); window.scrollTo(0, 0); },
  sub: ds => { S.sub = ds.sub; render(); },
  warn: ds => warnDialog(ds.day, ds.type, ds.pid),
  unwarn: ds => { if (confirm('¿Quitar el aviso?')) send({ t: 'Avisos', op: 'd', v: { 'Día ID': ds.day, 'Jugador ID': ds.pid } }); },
  ics: ds => calendar(ds.day),
  addDay: () => addDay(),
  seasonTrainings: () => seasonTrainingsDialog(),
  openDay: ds => { S.day = ds.day; S.part = null; render(); window.scrollTo(0, 0); },
  closeDay: () => { S.day = null; render(); },
  deleteDay: ds => deleteDay(ds.day),
  dayKind: ds => setKind(ds.day, ds.kind),
  side: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Local/Visitante': d.side === ds.side ? '' : ds.side } }); },
  part: ds => { S.part = ds.part; render(); },
  kit: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Equipación': d.kit === ds.kit ? '' : ds.kit } }); },
  callUp: ds => toggleCallUp(ds.day, ds.pid),
  confirmSquad: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Convocatoria confirmada': d.confirmed ? 'false' : 'true' } }); },
  squadWhatsApp: ds => { const d = findDay(ds.day); if (d) shareText(squadText(d)); },
  mark: ds => mark(ds.day, ds.pid, ds.state),
  markRest: ds => markRest(ds.day),
  kitIssue: ds => toggleKitIssue(ds.day, ds.pid),
  excuse: ds => toggleExcuse(ds.day, ds.pid),
  reason: ds => toggleReason(ds.day, ds.pid, ds.reason),
  applyFines: ds => applyFines(ds.day),
  noticeFor: ds => noticeForDialog(ds.day, ds.pid),
  addEvent: ds => eventDialog(ds.day, ds.kind),
  removeEvent: ds => send({ t: 'Acta', op: 'd', v: { 'ID': ds.id } }),
  mvp: ds => setMvp(ds.day, ds.pid),
  editRules: () => rulesDialog(),
  newFine: () => newFineDialog(),
  removeFine: ds => removeFine(ds.id),
  openPlayer: ds => { S.open = S.open === ds.pid ? null : ds.pid; render(); },
  pay: ds => payDialog(ds.kind, ds.id, ds.pid),
  addCharge: ds => chargeDialog([ds.pid], true),
  accView: ds => { S.accView = ds.view; S.open = null; render(); },
  newMovement: () => movementDialog(),
  removeMovement: ds => removeMovement(ds.id),
  removeCharge: ds => removeCharge(ds.id),
  moneyWhatsApp: () => shareText(moneyText()),
  seasons: () => seasonsDialog(),
};

/** The directiva writes down a notice a player gave by WhatsApp or phone, or removes it. */
function noticeForDialog(dayId, pid) {
  const n = noticeOf(dayId, pid);
  openDialog('<form method="dialog"><div class="title">Aviso · ' + esc(playerName(pid)) + '</div>' + (n ? '<p class="small">' + esc(noticeText(n, markOf(dayId, pid))) + '</p>' : '')
    + '<div class="row"><button type="button" class="btn" data-nt="No puedo ir">No puede ir</button><button type="button" class="btn" data-nt="Llego tarde">Llega tarde</button>'
    + (n ? '<button type="button" class="btn danger" data-nt="quitar">Quitar aviso</button>' : '') + '</div><div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button></div></form>', dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-nt]');
      if (!b) return;
      closeDialog();
      if (b.dataset.nt === 'quitar') send({ t: 'Avisos', op: 'd', v: { 'Día ID': dayId, 'Jugador ID': pid } });
      else warnDialog(dayId, b.dataset.nt, pid);
    };
  });
}

const CHG = {
  dayDate: el => dayField(el.dataset.day, 'date', el.value),
  dayTitle: el => dayField(el.dataset.day, 'title', el.value),
  dayTime: el => dayField(el.dataset.day, 'time', el.value),
  dayMeet: el => dayField(el.dataset.day, 'meet', el.value),
  result: el => setResult(el.dataset.day),
  finePaid: el => toggleFinePaid(el.dataset.id, el.checked),
  season: el => { S.viewSeason = el.value === activeSeason() ? '' : el.value; S.day = null; S.open = null; render(); },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.closest('dialog') || b.disabled) return;
  const f = ACT[b.dataset.act];
  if (f) f(b.dataset);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.closest('dialog')) return;
  const f = el.dataset && CHG[el.dataset.chg];
  if (f) f(el);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'profile') return;
  e.preventDefault();
  saveProfile(e.target);
});

// ---------- sign-in ----------
async function onGoogle(resp) {
  const msg = $('loginMsg');
  msg.className = 'error';
  msg.textContent = 'Entrando…';
  const name = $('loginName').value.trim();
  store.set('loginName', name);
  try {
    // The name only matters the first time: an unknown account is left as a request for the directiva.
    const a = await api({ action: 'login', idToken: resp.credential, nombre: name });
    if (!a.ok) {
      const who = a.email ? ' (' + a.email + ')' : '';
      if (a.error === 'PENDIENTE') {
        msg.className = 'ok';
        msg.textContent = 'Solicitud enviada' + who + '. Podrás entrar cuando la directiva te acepte.';
      } else if (a.error === 'FALTA_NOMBRE') {
        msg.textContent = 'Tu cuenta' + who + ' aún no tiene acceso. Escribe tu nombre debajo y vuelve a entrar con Google para pedirlo.';
        $('loginName').focus();
      } else if (a.error === 'LLENO') {
        msg.textContent = 'Ahora hay demasiadas solicitudes pendientes. Avisa a la directiva.';
      } else {
        msg.textContent = 'No se ha podido entrar (' + a.error + ').';
      }
      return;
    }
    S.token = a.token;
    S.yo = { email: a.email, nombre: a.nombre, rol: a.rol, jugadorId: a.jugadorId };
    store.set('token', S.token); store.set('yo', S.yo);
    // Changes kept from an expired session only go up for the same account.
    const owner = store.get('queueOwner', null);
    if (owner && owner !== a.email) { S.queue = []; S.datos = null; store.set('queue', []); store.del('datos'); }
    store.del('queueOwner');
    $('loginMsg').textContent = '';
    show();
    sync();
  } catch (e) {
    $('loginMsg').textContent = 'Sin conexión con la hoja. Prueba otra vez.';
  }
}

function logout() {
  if (S.token) api({ action: 'logout', token: S.token }).catch(() => {});
  ['token', 'yo', 'datos', 'queue', 'lastSync'].forEach(k => store.del(k));
  Object.assign(S, { token: null, yo: null, datos: null, queue: [], lastSync: null, tab: null, day: null, open: null, viewSeason: '' });
  show();
}

function startGoogle() {
  if (!window.google || !google.accounts) { setTimeout(startGoogle, 200); return; }
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onGoogle, ux_mode: 'popup', auto_select: false });
  google.accounts.id.renderButton($('gbtn'), { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es' });
}

function show() {
  $('login').classList.toggle('hidden', !!S.token);
  $('app').classList.toggle('hidden', !S.token);
  if (S.token) { render(); return; }
  if (!$('loginName').value) $('loginName').value = store.get('loginName', '');
  $('loginApp').innerHTML = androidLink();
  startGoogle();
}

$('refresh').onclick = () => sync();
$('logout').onclick = () => {
  const pending = S.queue.length ? ' Tienes ' + countOf(S.queue.length, 'cambio', 'cambios') + ' sin enviar a la hoja: se perderán.' : '';
  if (confirm('¿Salir de tu cuenta en este dispositivo?' + pending)) logout();
};
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token && Date.now() - (S.lastSync || 0) > 60000) sync(); });

show();
if (S.token) sync();
