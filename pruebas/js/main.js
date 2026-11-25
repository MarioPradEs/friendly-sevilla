'use strict';
/** What each version brought, newest first, for the directiva. Add a line here with every change. */
const CHANGELOG = [
  ["0.29.1", "25/11/2026", ["Clasificación: elige la jornada que quieres ver, o todas de la más reciente a la más antigua", "Las jornadas por jugar enseñan sus partidos y fechas"]],
  ["0.29.0", "25/11/2026", ["Jornadas: los 6 partidos de cada jornada, el nuestro también, con su fecha y sus goles", "Nuestro partido de la jornada sale en Días para la convocatoria, la lista y el acta", "Clasificación por jornada: la última jugada, con aviso de los partidos sin resultado", "El calendario oficial numera las jornadas"]],
  ["0.28.2", "25/11/2026", ["Clasificación: resultados de toda la jornada de una vez", "Voy / Tarde / No voy sin color hasta que eliges uno", "Buscador: la ficha ya no se vuelve a abrir al cambiar de sección", "Inicio: solo el próximo partido y el próximo entreno, el resto con «Ver más»", "Clasificación: solo la última jornada y aviso de los que no tienen resultado"]],
  ["0.28.1", "24/11/2026", ["Gastos: categoría Entrenador y lo pagado al entrenador en Cuentas", "Inicio: próximo partido arriba, luego tus estadísticas y los pendientes en naranja"]],
  ["0.28.0", "24/11/2026", ["Calendario de liga con ida y vuelta", "Aplazar partidos y suspender entrenos", "Al cambiar la fecha, borrar respuestas y avisar al grupo", "Buscador para la directiva y el entrenador", "Versiones de prueba (solo directiva)"]],
  ["0.27.1", "24/11/2026", ["Clasificación: aviso de los partidos de liga jugados a los que les falta el resultado"]],
  ["0.27.0", "24/11/2026", ["Nueva pestaña Clasificación en Inicio: la tabla de la liga con nuestros partidos del acta y los resultados de los demás equipos, que mete la directiva."]],
  ["0.26.0", "23/11/2026", ["Lista «Quién viene» en cada día", "Entrenador en la plantilla", "Quién dirigió y banquillo en el acta", "Estadísticas del entrenador", "Aviso si el entrenador no puede ir", "Notas privadas del entrenador", "Plazo para responder", "Voy / Tarde / No voy en una fila", "El próximo partido, una sola vez", "Días: primero lo que viene", "Convocar de un toque a los que van", "Confirmar y enviar la convocatoria a la vez", "«Quedamos a las» para la hora de quedar", "Votar el MVP más tarde", "Nuevo día con formulario corto", "Pasar lista en una fila por jugador", "Acta: goleador con un toque", "Plantilla única", "Barra inferior para directiva y entrenador", "Lista de pendientes en Inicio", "Se ve qué se puede pulsar"]],
  ["0.25.1", "23/11/2026", ["En la plantilla, primero jugador o portero y luego la posición"]],
  ["0.25.0", "23/11/2026", ["Porteros por parte en el acta", "Goles en contra por portero", "Estadísticas de portero en el portal", "Partes y partidos a cero de cada portero"]],
  ["0.24.0", "22/11/2026", ["Botón «Asistiré»", "Jugadores y porteros que van", "Recordatorio por WhatsApp", "Aviso «Ningún portero ha dicho que va»", "Aviso de multas sin pagar en el portal", "Pasar lista según avisos", "Asistencia y racha en el portal", "Estadísticas en el portal", "Cumpleaños", "Cómo llegar en entrenos y partidos", "Próximo partido destacado", "Votación del MVP (obligatoria tras el partido)", "Top 3 de votos para elegir el MVP", "Novedades y cambios"]],
  ["0.23.0", "22/11/2026", ["Tarjeta con o sin multa", "Desplegables", "Rival «Otro equipo»"]],
  ["0.22.1", "22/11/2026", ["La app abre en el portal del jugador"]],
  ["0.22.0", "22/11/2026", ["Engranaje de ajustes", "Lápiz para editar la plantilla"]],
  ["0.21.3", "22/11/2026", ["Arreglo de sincronización al cerrar sesión"]],
  ["0.21.2", "22/11/2026", ["Arreglo de descarga en Android 8 y 9"]],
  ["0.21.1", "22/11/2026", ["Aviso de versión nueva", "Descarga de la app desde la web"]],
  ["0.20.2", "22/11/2026", ["Pantalla de carga con reintentar"]],
  ["0.20.1", "22/11/2026", ["Botón «Mi portal de jugador»"]],
  ["0.20.0", "22/11/2026", ["Solicitudes de acceso"]],
  ["0.19.1", "22/11/2026", ["Web para iPhone", "El entrenador solo ve multas"]],
  ["0.19.0", "22/11/2026", ["Rol «Lista»", "Confirmar antes de borrar"]],
  ["0.18.0", "22/11/2026", ["Temporadas", "Pagos a plazos y saldo a favor", "Multas en la ficha del jugador", "Entrenamientos de toda la temporada", "Ranking", "Añadir al calendario", "Recordatorio de pagos", "Avisos apuntados por la directiva", "Equipaciones de portero"]],
  ["0.17.1", "21/11/2026", ["Equipación en el portal del jugador"]],
  ["0.17.0", "21/11/2026", ["Equipación del partido", "Confirmar convocatoria", "Convocatoria por WhatsApp"]],
  ["0.16.1", "21/11/2026", ["Local / Visitante"]],
  ["0.16.0", "21/11/2026", ["App Friendly Sevilla Club", "Entrada con Google", "Avisos «No puedo ir» y «Llego tarde»", "Acta del partido", "Perfil del jugador", "Cargos y pagos por jugador", "Rival desde la hoja"]],
  ["0.15.0", "21/11/2026", ["Conexión con la hoja de la directiva", "Portal del jugador", "Pestaña Cuentas", "Convocatoria de 18"]]];
// Navigation by role, sign-in, dialogs and the wiring of every button to its action.

const PORTAL = { inicio: viewHome, liga: viewLeague, pagos: viewMoney, perfil: viewProfile };

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
  // Only the directiva follows what changes from version to version.
  $('news').classList.toggle('hidden', ROLE() !== 'Directiva');
  // The search is for the staff: actions, days and players one tap away.
  $('search').classList.toggle('hidden', !can.search());
  document.body.classList.toggle('wide', can.club());
  if (!S.datos) { $('view').innerHTML = '<p class="small">Cargando los datos de la hoja…</p>'; return; }
  let h;
  if (S.tab === 'dias') {
    const d = S.day && findDay(S.day);
    if (S.day && !d) S.day = null;
    h = d ? viewDay(d) : viewDays();
  } else if (S.tab === 'yo') {
    S.sub = S.sub || 'inicio';
    // The staff's home lives here, so the league table sits next to it.
    h = '<div class="chips">' + [['inicio', 'Inicio'], ['liga', 'Clasificación'], ['pagos', ROLE() === 'Entrenador' ? 'Mis multas' : 'Mis pagos'], ['perfil', 'Mi perfil']].map(x => '<button class="btn' + (S.sub === x[0] ? ' on' : '') + '" data-act="sub" data-sub="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>'
      + androidLink() + PORTAL[S.sub]();
  } else {
    h = ({ inicio: viewInicio, pagos: viewMoney, perfil: viewProfile, multas: viewFines, plantilla: viewSquad, resumen: viewSummary, cuentas: viewAccounts }[S.tab] || viewHome)();
  }
  const y = window.scrollY;
  $('view').innerHTML = h;
  window.scrollTo(0, y);
  // After a match the called-up must vote the MVP before going on.
  votePrompt();
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
  dlg.classList.remove('search');
}

/**
 * Cancelar only closes; the main button (value "ok") runs onOk, saved the moment it is pressed.
 * If onOk returns false (something missing), the dialog stays open with what was typed.
 * Enter in a field acts as the main button, never as Cancelar.
 */
function openDialog(html, setup, onOk) {
  const dlg = $('dlg');
  dlg.innerHTML = html;
  dlg.onclick = null; dlg.onchange = null; dlg.oninput = null;
  dlg.classList.remove('search');
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
  tab: ds => { S.tab = ds.tab; S.day = null; S.open = null; S.announce = null; render(); window.scrollTo(0, 0); },
  sub: ds => { S.sub = ds.sub; render(); },
  homeTab: ds => { S.homeTab = ds.sub; render(); window.scrollTo(0, 0); },
  addResult: () => resultDialog(''),
  addRound: () => roundDialog(),
  editRound: ds => roundDialog(Number(ds.n)),
  foldDays: () => { S.allDays = !S.allDays; render(); },
  allResults: () => { S.allResults = !S.allResults; render(); },
  editResult: ds => resultDialog(ds.id),
  warn: ds => warnDialog(ds.day, ds.type, ds.pid),
  // Tapping the chosen answer again takes it back: the line under the buttons says so.
  unwarn: ds => send({ t: 'Avisos', op: 'd', v: { 'Día ID': ds.day, 'Jugador ID': ds.pid } }),
  ics: ds => calendar(ds.day),
  addDay: () => addDay(),
  seasonTrainings: () => seasonTrainingsDialog(),
  leagueCalendar: () => leagueCalendarDialog(),
  openDay: ds => { S.day = ds.day; S.part = null; S.announce = null; render(); window.scrollTo(0, 0); },
  // A task on Inicio opens its day, or the fines when it has none.
  todo: ds => { S.tab = ds.day ? 'dias' : 'multas'; S.day = ds.day || null; S.part = null; S.open = null; render(); window.scrollTo(0, 0); },
  togglePast: () => { S.showPast = !S.showPast; render(); },
  dayHead: ds => { S.headOpen = S.headOpen === ds.day ? null : ds.day; render(); },
  who: ds => whoDialog(ds.day),
  closeDay: () => { S.day = null; S.announce = null; render(); },
  // Postponing or cancelling, taking it back, a new date, and telling the group.
  dayOff: ds => offDialog(ds.day),
  dayOn: ds => dayOn(ds.day),
  newDate: ds => newDateDialog(ds.day),
  offWhatsApp: ds => { const d = findDay(ds.day); if (d) shareText(offMessage(d)); },
  announce: () => { if (S.announce) shareText(S.announce.text); S.announce = null; render(); },
  noAnnounce: () => { S.announce = null; render(); },
  deleteDay: ds => deleteDay(ds.day),
  dayKind: ds => setKind(ds.day, ds.kind),
  side: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Local/Visitante': d.side === ds.side ? '' : ds.side } }); },
  part: ds => { S.part = ds.part; render(); },
  kit: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Equipación': d.kit === ds.kit ? '' : ds.kit } }); },
  callUp: ds => toggleCallUp(ds.day, ds.pid),
  callUpAnswered: ds => callUpAnswered(ds.day),
  confirmSend: ds => confirmAndSend(ds.day),
  confirmSquad: ds => { const d = findDay(ds.day); if (d) send({ t: 'Partidos', op: 'e', v: { 'ID': ds.day, 'Convocatoria confirmada': d.confirmed ? 'false' : 'true' } }); },
  squadWhatsApp: ds => { const d = findDay(ds.day); if (d) shareText(squadText(d)); },
  remind: ds => { const d = findDay(ds.day); if (d) shareText(reminderText(d)); },
  mark: ds => mark(ds.day, ds.pid, ds.state),
  markMenu: ds => markMenu(ds.day, ds.pid, !!ds.list),
  markRest: ds => markRest(ds.day),
  markNotices: ds => markNotices(ds.day),
  congratulate: ds => shareText(birthdayText(ds.pid)),
  vote: ds => vote(ds.day),
  kitIssue: ds => toggleKitIssue(ds.day, ds.pid),
  excuse: ds => toggleExcuse(ds.day, ds.pid),
  applyFines: ds => applyFines(ds.day),
  addEvent: ds => eventDialog(ds.day, ds.kind),
  addKeeper: ds => keeperDialog(ds.day, ds.kind),
  removeEvent: ds => send({ t: 'Acta', op: 'd', v: { 'ID': ds.id } }),
  cardFine: ds => send({ t: 'Acta', op: 'e', v: { 'ID': ds.id, 'Multa': ds.val } }),
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
    + '<div class="row"><button type="button" class="btn" data-nt="Asistiré">Asistirá</button><button type="button" class="btn" data-nt="No puedo ir">No puede ir</button><button type="button" class="btn" data-nt="Llego tarde">Llega tarde</button>'
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
  // Clasificación: which jornada to show (0 = all of them, newest first).
  leagueRound: el => { S.leagueRound = Number(el.value); render(); },
  // A new date may ask about the answers already given: blurred first, so the page can redraw.
  dayDate: el => { const v = el.value; el.blur(); changeDate(el.dataset.day, v); },
  dayTitle: el => dayField(el.dataset.day, 'title', el.value),
  dayTime: el => dayField(el.dataset.day, 'time', el.value),
  dayMeet: el => dayField(el.dataset.day, 'meet', el.value),
  dayDeadline: el => { el.blur(); setDeadline(el.dataset.day, el.value); },
  // Blurred first: a focused field holds the redraw back, and the warning above depends on these.
  led: el => { el.blur(); toggleActa(el.dataset.day, 'Dirigió', el.dataset.pid); },
  bench: el => { el.blur(); toggleActa(el.dataset.day, 'Banquillo', el.dataset.pid); },
  result: el => setResult(el.dataset.day),
  absReason: el => { el.blur(); toggleReason(el.dataset.day, el.dataset.pid, el.value); },
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
// The coach's notes save themselves a moment after typing stops; the text is taken now, so a redraw cannot lose it.
let noteTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id !== 'coachNote' || el.closest('dialog')) return;
  const day = el.dataset.day, text = el.value;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => saveCoachNote(day, text), 1200);
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
$('search').onclick = () => searchDialog();
$('news').onclick = () => openDialog('<form method="dialog"><div class="title">Novedades y cambios</div>'
  + CHANGELOG.map(v => '<h2>' + esc(v[0] + ' · ' + v[1]) + '</h2>' + v[2].map(c => '<p class="small">• ' + esc(c) + '</p>').join('')).join('')
  + '<div class="row end"><button type="button" class="btn" value="cancel">Cerrar</button></div></form>');
$('logout').onclick = () => {
  const pending = S.queue.length ? ' Tienes ' + countOf(S.queue.length, 'cambio', 'cambios') + ' sin enviar a la hoja: se perderán.' : '';
  if (confirm('¿Salir de tu cuenta en este dispositivo?' + pending)) logout();
};
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token && Date.now() - (S.lastSync || 0) > 60000) sync(); });

show();
if (S.token) sync();
