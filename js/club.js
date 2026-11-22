'use strict';
// The club's management, as in the Android app: days with call-up, list and report; fines, squad,
// summary, accounts and seasons. What each role may do comes from `can` (the sheet checks it again).

// ---------- days ----------
function viewDays() {
  const list = days().sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  // Who only takes attendance works on the active season and nothing else.
  let h = ROLE() === 'Lista' ? '<h2>Pasar lista</h2>' : seasonBar();
  if (can.editDays()) {
    h += '<div class="row"><button class="btn primary" data-act="addDay">+ Añadir día</button><button class="btn" data-act="seasonTrainings">Crear entrenamientos de la temporada</button></div>';
  }
  if (!list.length) {
    h += '<p class="small">' + (editable() ? 'Añade un día de entrenamiento, partido, amistoso o torneo. Puedes prepararlo antes: nadie sale marcado hasta que lo marques ese mismo día.' : 'No hay días en esta temporada.') + '</p>';
  }
  list.forEach(d => {
    const marks = marksOf(d.id).filter(m => calledUp(d).includes(m['Jugador ID']));
    const n = s => marks.filter(m => m['Estado'] === s).length;
    const unavailable = n('No puede');
    const result = d.match && d.gf !== '' && d.ga !== '' ? 'Resultado ' + d.gf + '-' + d.ga + verdict(d) : '';
    const info = [
      marks.length > unavailable ? (n('OK') + n('Tarde')) + ' de ' + (marks.length - unavailable) + ' vinieron' : '',
      n('Tarde') ? countOf(n('Tarde'), 'retraso', 'retrasos') : '',
      n('Falta') ? countOf(n('Falta'), 'falta', 'faltas') : '',
      unavailable ? countOf(unavailable, 'no puede', 'no pueden') : '',
      unmarked(d).length ? unmarked(d).length + ' sin marcar' : '',
      notCalledUp(d).length ? countOf(notCalledUp(d).length, 'no convocado', 'no convocados') : '',
    ].filter(Boolean).join(' · ');
    h += '<div class="card tap" data-act="openDay" data-day="' + esc(d.id) + '"><div class="title">' + esc(dayTitle(d)) + '</div><div class="small">'
      + esc(fdate(d.date) + (d.time ? ' · ' + d.time : '')) + '</div>' + (result ? '<div class="small bold">' + esc(result) + '</div>' : '')
      + '<div class="small">' + esc(info) + '</div></div>';
  });
  return h;
}
function verdict(d) {
  const us = Number(d.gf), them = Number(d.ga);
  if (isNaN(us) || isNaN(them)) return '';
  return us > them ? ' · Ganamos' : us < them ? ' · Perdimos' : ' · Empate';
}

function addDay() {
  const id = uid();
  send({ t: 'Entrenamientos', op: 'u', v: { 'ID': id, 'Fecha': today(), 'Temporada': activeSeason() } });
  S.day = id; S.part = null; render(); window.scrollTo(0, 0);
}

function viewDay(d) {
  const lista = ROLE() === 'Lista';
  if (lista) {
    // Like a player, plus the list: the day as it is, nothing of it to change.
    return '<button class="link" data-act="closeDay">‹ Volver</button><div class="card"><div class="title">' + esc(dayTitle(d)) + '</div><div class="small">'
      + esc([fdate(d.date), d.time ? 'a las ' + d.time : '', d.side].filter(Boolean).join(' · ')) + '</div></div>' + partList(d);
  }
  const parts = d.match && !lista ? ['Convocatoria', 'Pasar lista', 'Acta'] : ['Pasar lista'];
  if (!parts.includes(S.part)) S.part = d.match && !lista && !squad(d).length ? 'Convocatoria' : 'Pasar lista';
  const edit = can.editDays();
  let h = '<div class="row between"><button class="link" data-act="closeDay">‹ Volver</button>'
    + (can.deleteDays() ? '<button class="btn danger" data-act="deleteDay" data-day="' + esc(d.id) + '">Borrar día</button>' : '') + '</div>';
  h += '<div class="card">';
  h += '<label for="dayDate">Fecha</label><input id="dayDate" type="date" value="' + esc(d.date) + '" data-chg="dayDate" data-day="' + esc(d.id) + '"' + (edit ? '' : ' disabled') + '>';
  h += '<div class="chips mt">' + KINDS.map(k => '<button class="btn' + (d.label === k[0] ? ' on' : '') + '" data-act="dayKind" data-kind="' + esc(k[0]) + '" data-day="' + esc(d.id) + '"' + (edit ? '' : ' disabled') + '>' + esc(k[0]) + '</button>').join('') + '</div>';
  h += '<label for="dayTitle">' + (d.match ? 'Rival' : 'Nombre (opcional)') + '</label><input id="dayTitle" value="' + esc(d.title) + '" maxlength="80" data-chg="dayTitle" data-day="' + esc(d.id) + '"' + (d.match ? ' list="rivalList"' : '') + (edit ? '' : ' disabled') + '>';
  if (d.match) {
    h += '<datalist id="rivalList">' + rivals().map(r => '<option value="' + esc(r.name) + '">').join('') + '</datalist>';
    h += '<div class="chips mt"><span class="small bold">' + esc(TEAM) + ':</span>' + ['Local', 'Visitante'].map(s => '<button class="btn' + (d.side === s ? ' on' : '') + '" data-act="side" data-side="' + s + '" data-day="' + esc(d.id) + '"' + (edit ? '' : ' disabled') + '>' + s + '</button>').join('') + '</div>';
    const where = d.side === 'Local' ? 'Jugamos en casa' : d.side === 'Visitante' ? 'Vamos al campo de ' + (d.title.trim() || 'el rival') + (groundOf(d).ground ? ' (' + groundOf(d).ground + ')' : '') : '';
    if (where) h += '<div class="small">' + esc(where) + '</div>';
  }
  h += '<div class="grid2"><div><label for="dayTime">' + (d.match ? 'Partido' : 'Hora') + '</label><input id="dayTime" type="time" value="' + esc(normTime(d.time)) + '" data-chg="dayTime" data-day="' + esc(d.id) + '"' + (edit ? '' : ' disabled') + '></div>';
  if (d.match) h += '<div><label for="dayMeet">Convocatoria</label><input id="dayMeet" type="time" value="' + esc(normTime(d.meet)) + '" data-chg="dayMeet" data-day="' + esc(d.id) + '"' + (edit ? '' : ' disabled') + '></div>';
  h += '</div></div>';
  if (parts.length > 1) h += '<div class="parts">' + parts.map((p, i) => '<button class="btn' + (S.part === p ? ' on' : '') + '" data-act="part" data-part="' + esc(p) + '">' + (i + 1) + '. ' + esc(p) + '</button>').join('') + '</div>';
  if (S.part === 'Convocatoria') h += partSquad(d);
  else if (S.part === 'Acta') h += partReport(d);
  else h += partList(d);
  return h;
}

// ---------- 1. call-up ----------
function partSquad(d) {
  const sq = squad(d);
  const editing = can.callUp();
  let h = '<h2>Convocados: ' + sq.filter(id => playerIds().includes(id)).length + ' de ' + MAX_CALLED_UP + ' como máximo</h2>';
  const kits = matchKits();
  if (kits.length) {
    h += '<div class="chips"><span class="small bold">Equipación:</span>' + kits.map(k => '<button class="btn' + (d.kit === k.name ? ' on' : '') + '" data-act="kit" data-kit="' + esc(k.name) + '" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '>' + esc(k.name) + '</button>').join('') + '</div>';
    const chosen = kits.find(k => k.name === d.kit);
    const keepers = players().filter(p => sq.includes(p['ID']) && isKeeper(p)).map(p => { const o = kitOptions(keeperKits(p['ID'])); return o ? p['Nombre'] + ': ' + o : ''; }).filter(Boolean).join(' · ');
    h += '<p class="small">' + esc([chosen ? chosen.description : '', keepers ? 'porteros, siempre con sus dos: ' + keepers : ''].filter(Boolean).join(' · ') || 'Elige la equipación del partido') + '</p>';
  }
  const full = sq.filter(id => playerIds().includes(id)).length >= MAX_CALLED_UP;
  players().forEach(p => {
    const on = sq.includes(p['ID']);
    const n = noticeOf(d.id, p['ID']);
    h += '<div class="player row between"><div><div class="name">' + esc(p['Nombre']) + '</div>' + (n ? '<div class="small notice">' + esc(noticeText(n, markOf(d.id, p['ID']))) + '</div>' : '') + '</div>'
      + '<button class="btn' + (on ? ' on' : '') + '" data-act="callUp" data-pid="' + esc(p['ID']) + '" data-day="' + esc(d.id) + '"' + (editing && (on || !full) ? '' : ' disabled') + '>' + (on ? 'Convocado' : 'No convocado') + '</button></div>';
  });
  const size = sq.length;
  h += '<div class="row mt"><button class="btn primary" data-act="confirmSquad" data-day="' + esc(d.id) + '"' + (editing && size ? '' : ' disabled') + '>' + (d.confirmed ? 'Confirmada ✓' : 'Confirmar') + '</button>'
    + '<button class="btn" data-act="squadWhatsApp" data-day="' + esc(d.id) + '"' + (size ? '' : ' disabled') + '>WhatsApp</button></div>';
  return h;
}

/** Leaving someone out clears his marks and this day's unpaid fines; calling him back leaves him unmarked. */
function toggleCallUp(dayId, pid) {
  const d = findDay(dayId);
  if (!d || !d.match) return;
  if (squad(d).includes(pid)) {
    const m = markOf(dayId, pid);
    send([{ t: 'Convocatorias', op: 'd', v: { 'Partido ID': dayId, 'Jugador ID': pid } },
      m && can.mark() ? { t: 'Asistencia', op: 'd', v: { 'ID': m['ID'] } } : null].concat(dropDayFines(dayId, pid)));
  } else {
    if (squad(d).filter(id => playerIds().includes(id)).length >= MAX_CALLED_UP) { toast('Máximo ' + MAX_CALLED_UP + ' convocados'); return; }
    send({ t: 'Convocatorias', op: 'u', v: { 'Partido ID': dayId, 'Jugador ID': pid, 'Temporada': d.season || activeSeason() } });
  }
}

function squadText(d) {
  const rival = d.title.trim() || 'Rival por confirmar';
  const vs = d.side === 'Visitante' ? rival + ' vs ' + TEAM : TEAM + ' vs ' + rival;
  const place = groundOf(d);
  const kit = matchKits().find(k => k.name === d.kit);
  const sq = players().filter(p => squad(d).includes(p['ID']))
    .sort((a, b) => (Number(a['Dorsal']) || 1e9) - (Number(b['Dorsal']) || 1e9) || String(a['Nombre']).localeCompare(b['Nombre']));
  const L = ['🏆 *CONVOCATORIA ' + TEAM.toUpperCase() + '* 🏆', '', '🆚 *Partido:* ' + vs, '📅 *Fecha:* ' + fdate(d.date),
    '⏰ *Hora partido:* ' + (d.time || 'por confirmar'), '📣 *Convocatoria:* ' + (d.meet || 'por confirmar'), '📍 *Campo:* ' + (place.ground || 'por confirmar')];
  if (place.maps) L.push('🗺️ *Maps:* ' + place.maps);
  if (kit) L.push('👕 *Equipación:* ' + kit.description);
  sq.filter(isKeeper).forEach(k => { const o = kitOptions(keeperKits(k['ID'])); if (o) L.push('🧤 *' + k['Nombre'] + '* (trae las dos): ' + o); });
  L.push('🎒 *Traed siempre las dos equipaciones*', '', '📋 *CONVOCADOS (' + sq.length + '/' + MAX_CALLED_UP + '):*');
  sq.forEach(p => L.push((isKeeper(p) ? '🧤' : '⚽') + ' ' + (p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre']));
  L.push('', '⚠️ Confirmad asistencia por aquí. ¡Vamos equipo! 💪');
  return L.join('\n');
}

// ---------- 2. attendance ----------
function partList(d) {
  const who = calledUp(d);
  if (d.match && !who.length) {
    return '<p class="small">' + (can.callUp() ? 'Primero la convocatoria: elige quién va en «1. Convocatoria».' : 'Esperando la convocatoria del entrenador.') + '</p>';
  }
  const marking = can.mark();
  const left = unmarked(d).length;
  let h = '';
  if (marking && left) h += '<div class="row between"><span class="small">' + left + ' sin marcar</span><button class="link" data-act="markRest" data-day="' + esc(d.id) + '">Poner OK al resto</button></div>';
  players().filter(p => who.includes(p['ID'])).forEach(p => {
    const pid = p['ID'];
    const m = markOf(d.id, pid);
    const n = noticeOf(d.id, pid);
    h += '<div class="player"><div class="row between"><div><div class="name">' + esc(p['Nombre']) + '</div>' + (n ? '<div class="small notice">' + esc(noticeText(n, m)) + '</div>' : '') + '</div>'
      + (marking && can.fine() ? '<button class="link" data-act="noticeFor" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '">Aviso</button>' : '') + '</div><div class="marks">';
    STATES.forEach(s => {
      h += '<button class="btn mark-' + s.replace(' ', '') + (m && m['Estado'] === s ? ' on' : '') + '" data-act="mark" data-state="' + esc(s) + '" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking ? '' : ' disabled') + '>' + esc(s) + '</button>';
    });
    h += '<button class="btn kit' + (m && isTrue(m['Equipación incorrecta']) ? ' on' : '') + '" data-act="kitIssue" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking && came(m) ? '' : ' disabled') + '>Equipación</button>';
    if (m && m['Estado'] === 'Tarde') h += '<button class="btn' + (isTrue(m['Justificada']) ? ' on' : '') + '" data-act="excuse" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking ? '' : ' disabled') + '>Justificada</button>';
    if (m && m['Estado'] === 'No puede') {
      REASONS.forEach(r => { h += '<button class="btn' + (m['Motivo'] === r ? ' on' : '') + '" data-act="reason" data-reason="' + r + '" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking ? '' : ' disabled') + '>' + r + '</button>'; });
    }
    h += '</div></div>';
  });
  if (marking && can.fine()) {
    const toFine = finesToApply(d);
    h += '<div class="row mt"><button class="btn primary wide" data-act="applyFines" data-day="' + esc(d.id) + '"' + (toFine.length ? '' : ' disabled') + '>'
      + (toFine.length ? 'Poner ' + countOf(toFine.length, 'multa', 'multas') + ' · ' + money(toFine.reduce((s, x) => s + x.rule.cents, 0)) : 'Nada que multar') + '</button></div>';
  }
  return h;
}

/**
 * Someone who did not come cannot have anything else marked; someone who could not come loses this
 * day's unpaid fines. A lateness warned in time is justified (Mario's rule). Tapping the mark again clears it.
 */
function mark(dayId, pid, state) {
  const d = findDay(dayId);
  if (!d) return;
  const cur = markOf(dayId, pid);
  if (cur && cur['Estado'] === state) { send({ t: 'Asistencia', op: 'd', v: { 'ID': cur['ID'] } }); return; }
  const id = cur ? cur['ID'] : dayId + '_' + pid;
  const v = { 'ID': id, 'Estado': state };
  const comes = state === 'OK' || state === 'Tarde';
  if (!comes) v['Equipación incorrecta'] = 'false';
  if (state !== 'Tarde') v['Justificada'] = 'false';
  else if (warnedInTime(d, noticeOf(dayId, pid))) v['Justificada'] = 'true';
  if (state !== 'No puede') v['Motivo'] = '';
  else if (!cur || cur['Estado'] !== 'No puede') {
    const n = noticeOf(dayId, pid);
    v['Motivo'] = n && n['Tipo'] === 'No puedo ir' && REASONS.includes(n['Motivo']) ? n['Motivo'] : '';
  }
  const op = cur ? { t: 'Asistencia', op: 'e', v: v }
    : { t: 'Asistencia', op: 'u', v: Object.assign({ 'Fecha': d.date, 'Sesión': d.session, 'Día ID': dayId, 'Jugador ID': pid, 'Justificada': 'false', 'Equipación incorrecta': 'false', 'Motivo': '', 'Temporada': d.season || activeSeason() }, v) };
  send([op].concat(state === 'No puede' ? dropDayFines(dayId, pid) : []));
}

/** For when almost everyone came: the rest OK, or "No puede" for those who said so. Marks made stay. */
function markRest(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  send(unmarked(d).map(pid => {
    const n = noticeOf(dayId, pid);
    const cant = n && n['Tipo'] === 'No puedo ir';
    return { t: 'Asistencia', op: 'u', v: { 'ID': dayId + '_' + pid, 'Fecha': d.date, 'Sesión': d.session, 'Día ID': dayId, 'Jugador ID': pid,
      'Estado': cant ? 'No puede' : 'OK', 'Motivo': cant && REASONS.includes(n['Motivo']) ? n['Motivo'] : '', 'Justificada': 'false', 'Equipación incorrecta': 'false',
      'Temporada': d.season || activeSeason() } };
  }));
}

function toggleKitIssue(dayId, pid) {
  const m = markOf(dayId, pid);
  if (!came(m)) return;
  send({ t: 'Asistencia', op: 'e', v: { 'ID': m['ID'], 'Equipación incorrecta': isTrue(m['Equipación incorrecta']) ? 'false' : 'true' } });
}

/** Justifying also takes back this day's unpaid lateness fine; one already paid stays. */
function toggleExcuse(dayId, pid) {
  const m = markOf(dayId, pid);
  if (!m || m['Estado'] !== 'Tarde') return;
  if (isTrue(m['Justificada'])) { send({ t: 'Asistencia', op: 'e', v: { 'ID': m['ID'], 'Justificada': 'false' } }); return; }
  const late = lateRule();
  send([{ t: 'Asistencia', op: 'e', v: { 'ID': m['ID'], 'Justificada': 'true' } }].concat(late ? dropDayFines(dayId, pid, late.label) : []));
}

function toggleReason(dayId, pid, reason) {
  const m = markOf(dayId, pid);
  if (!m || m['Estado'] !== 'No puede') return;
  send({ t: 'Asistencia', op: 'e', v: { 'ID': m['ID'], 'Motivo': m['Motivo'] === reason ? '' : reason } });
}

/** What this day should cost and has not been fined yet: lateness not justified nor warned in time, and kit. */
function finesToApply(d) {
  const fined = new Set(fines(f => f.origin === d.id).map(f => f.player + '|' + f.label));
  const out = [];
  const late = lateRule(), kit = kitRule();
  calledUp(d).forEach(pid => {
    const m = markOf(d.id, pid);
    if (!m) return;
    if (late && m['Estado'] === 'Tarde' && !isTrue(m['Justificada']) && !warnedInTime(d, noticeOf(d.id, pid))) out.push({ pid: pid, rule: late });
    if (kit && came(m) && isTrue(m['Equipación incorrecta'])) out.push({ pid: pid, rule: kit });
  });
  return out.filter(x => !fined.has(x.pid + '|' + x.rule.label));
}

function applyFines(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  const list = finesToApply(d);
  send(list.map(x => ({ t: 'Multas', op: 'u', v: Object.assign({ 'ID': uid(), 'Fecha': d.date, 'Jugador ID': x.pid, 'Importe': amount(x.rule.cents), 'Origen': d.id,
    'Pagada': 'false', 'Temporada': d.season || activeSeason() }, fineReason(x.rule.label)) })));
  toast(list.length === 1 ? 'Multa puesta' : list.length + ' multas puestas');
}

// ---------- 3. match report ----------
function partReport(d) {
  const sq = players().filter(p => squad(d).includes(p['ID']));
  if (!sq.length) return '<p class="small">Primero hace falta la convocatoria: el acta solo puede nombrar a los convocados.</p>';
  const editing = can.report();
  const events = rows('Acta').filter(x => x['Partido ID'] === d.id);
  let h = '<h2>Resultado</h2><div class="grid2"><div><label for="gf">' + esc(TEAM) + '</label><input id="gf" inputmode="numeric" maxlength="2" value="' + esc(d.gf) + '" data-chg="result" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '></div>'
    + '<div><label for="ga">' + esc(d.title || 'Rival') + '</label><input id="ga" inputmode="numeric" maxlength="2" value="' + esc(d.ga) + '" data-chg="result" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '></div></div>';
  if (editing) h += '<div class="row mt"><button class="btn" data-act="addEvent" data-kind="goal" data-day="' + esc(d.id) + '">+ Gol</button><button class="btn" data-act="addEvent" data-kind="card" data-day="' + esc(d.id) + '">+ Tarjeta</button></div>';
  const goals = events.filter(e => e['Tipo'] === 'Gol').sort((a, b) => (Number(a['Minuto']) || 999) - (Number(b['Minuto']) || 999));
  const cards = events.filter(e => CARDS.includes(e['Tipo']));
  const row = (text, id) => '<div class="line"><span>' + esc(text) + '</span>' + (editing ? '<button class="link danger-text" data-act="removeEvent" data-id="' + esc(id) + '">Quitar</button>' : '') + '</div>';
  h += '<h2>Goles (' + goals.length + ')</h2>' + (goals.length ? '' : '<p class="small">Ninguno apuntado.</p>');
  goals.forEach(e => { h += row([playerName(e['Jugador ID']), e['Minuto'] ? 'min. ' + e['Minuto'] : '', e['Asistencia ID'] ? 'asist. ' + playerName(e['Asistencia ID']) : ''].filter(Boolean).join(' · '), e['ID']); });
  h += '<h2>Tarjetas (' + cards.length + ')</h2>' + (cards.length ? '' : '<p class="small">Ninguna.</p>');
  cards.forEach(e => {
    // Blank (older cards) or "Sí" carries a fine; "No" = part of the game.
    const fined = String(e['Multa'] || '').trim() !== 'No';
    const flip = editing ? '<button class="link" data-act="cardFine" data-id="' + esc(e['ID']) + '" data-val="' + (fined ? 'No' : 'Sí') + '">' + (fined ? 'Quitar multa' : 'Poner multa') + '</button>' : '';
    h += row([e['Tipo'], playerName(e['Jugador ID']), e['Minuto'] ? 'min. ' + e['Minuto'] : '', fined ? 'con multa' : 'sin multa'].filter(Boolean).join(' · '), e['ID']).replace('</span>', '</span>' + flip);
  });
  if (cards.length) h += '<p class="small">Las tarjetas con multa la crean en la hoja al sincronizar (la doble amarilla, sin importe hasta que lo ponga la directiva). Las de lance del juego no se pagan.</p>';
  const mvp = (events.find(e => e['Tipo'] === 'MVP') || {})['Jugador ID'];
  h += '<h2>Mejor jugador (MVP)</h2><div class="chips">' + sq.map(p => '<button class="btn' + (mvp === p['ID'] ? ' on' : '') + '" data-act="mvp" data-pid="' + esc(p['ID']) + '" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '>' + esc(p['Nombre']) + '</button>').join('') + '</div>';
  return h;
}

function setResult(dayId) {
  const gf = $('gf').value.replace(/\D/g, '').slice(0, 2), ga = $('ga').value.replace(/\D/g, '').slice(0, 2);
  const d = findDay(dayId);
  const played = gf !== '' || ga !== '';
  send({ t: 'Partidos', op: 'e', v: { 'ID': dayId, 'Goles a favor': gf, 'Goles en contra': ga, 'Estado': played ? 'Jugado' : (d && d.status !== 'Jugado' ? d.status : '') } });
}

function eventDialog(dayId, kind) {
  const d = findDay(dayId);
  const sq = players().filter(p => squad(d).includes(p['ID']));
  const types = kind === 'goal' ? ['Gol'] : CARDS;
  let type = types[0], pid = '', assist = '', fine = '';
  const select = (id, list, sel, empty) => '<select id="' + id + '" class="full">' + (empty ? '<option value="">' + esc(empty) + '</option>' : '')
    + list.map(x => '<option value="' + esc(x[0]) + '"' + (sel === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select>';
  const draw = () => '<form method="dialog"><div class="title">' + (kind === 'goal' ? 'Gol' : 'Tarjeta') + '</div>'
    + (types.length > 1 ? '<label for="evType">Tarjeta</label>' + select('evType', types.map(t => [t, t]), type) : '')
    + '<label for="evPid">Jugador</label>' + pickPlayer('evPid', sq, pid, 'Elige jugador')
    + (kind === 'goal' ? '<label for="evAssist">Asistencia (opcional)</label>' + pickPlayer('evAssist', sq.filter(p => p['ID'] !== pid), assist, 'Sin asistencia') : '')
    + (kind === 'card' ? '<label for="evFine">¿Paga multa?</label>' + select('evFine', [['Sí', 'Sí: fue intencionada, la paga'], ['No', 'No: lance del juego']], fine, 'Elige') : '')
    + '<label for="minute">Minuto (opcional)</label><input id="minute" inputmode="numeric" maxlength="3">'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok" id="evOk"' + (pid && (kind !== 'card' || fine) ? '' : ' disabled') + '>Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onchange = e => {
      const id = e.target.id;
      if (['evPid', 'evAssist', 'evType', 'evFine'].indexOf(id) < 0) return;
      if (id === 'evPid') { pid = e.target.value; if (assist === pid) assist = ''; }
      else if (id === 'evAssist') assist = e.target.value;
      else if (id === 'evType') type = e.target.value;
      else fine = e.target.value;
      const minute = $('minute').value;
      dlg.innerHTML = draw();
      $('minute').value = minute;
    };
  }, () => {
    send({ t: 'Acta', op: 'u', v: { 'ID': uid(), 'Partido ID': dayId, 'Tipo': type, 'Jugador ID': pid, 'Minuto': $('minute').value.replace(/\D/g, '').slice(0, 3),
      'Asistencia ID': assist !== pid ? assist : '', 'Multa': kind === 'card' ? fine : '', 'Temporada': d.season || activeSeason() } });
  });
}

function setMvp(dayId, pid) {
  const d = findDay(dayId);
  const old = rows('Acta').filter(x => x['Partido ID'] === dayId && x['Tipo'] === 'MVP');
  const same = old.some(x => x['Jugador ID'] === pid);
  send(old.map(x => ({ t: 'Acta', op: 'd', v: { 'ID': x['ID'] } }))
    .concat(same ? [] : [{ t: 'Acta', op: 'u', v: { 'ID': uid(), 'Partido ID': dayId, 'Tipo': 'MVP', 'Jugador ID': pid, 'Minuto': '', 'Asistencia ID': '', 'Temporada': d.season || activeSeason() } }]));
}

// ---------- day fields ----------
function dayField(dayId, field, value) {
  const d = findDay(dayId);
  if (!d) return;
  const t = d.match ? 'Partidos' : 'Entrenamientos';
  const col = { date: 'Fecha', title: d.match ? 'Rival' : 'Notas', time: d.match ? 'Hora partido' : 'Hora', meet: 'Hora convocatoria' }[field];
  if (!col || (field === 'meet' && !d.match)) return;
  const v = { 'ID': dayId };
  v[col] = field === 'time' || field === 'meet' ? normTime(value) : field === 'title' ? value.trim() : value;
  if (field === 'date' && !value) return;
  send({ t: t, op: 'e', v: v });
}

/**
 * A training turned into a match moves to Partidos, called up are those already marked; a match
 * turned into a training loses its call-up (everyone is expected at a training).
 */
function setKind(dayId, label) {
  const d = findDay(dayId);
  if (!d || d.label === label) return;
  const kind = KINDS.find(k => k[0] === label);
  const season = d.season || activeSeason();
  if (!d.match && kind[1]) {
    const marked = marksOf(dayId).map(m => m['Jugador ID']).filter(id => playerIds().includes(id));
    send([{ t: 'Entrenamientos', op: 'd', v: { 'ID': dayId } },
      { t: 'Partidos', op: 'u', v: { 'ID': dayId, 'Fecha': d.date, 'Tipo': kind[1], 'Rival': d.title, 'Hora partido': normTime(d.time), 'Temporada': season } }]
      .concat(marked.map(pid => ({ t: 'Convocatorias', op: 'u', v: { 'Partido ID': dayId, 'Jugador ID': pid, 'Temporada': season } }))));
    S.part = null;
  } else if (d.match && !kind[1]) {
    send([{ t: 'Partidos', op: 'd', v: { 'ID': dayId } },
      { t: 'Entrenamientos', op: 'u', v: { 'ID': dayId, 'Fecha': d.date, 'Hora': normTime(d.time), 'Notas': d.title, 'Temporada': season } }]
      .concat(squad(d).map(pid => ({ t: 'Convocatorias', op: 'd', v: { 'Partido ID': dayId, 'Jugador ID': pid } }))));
    S.part = null;
  } else {
    send({ t: 'Partidos', op: 'e', v: { 'ID': dayId, 'Tipo': kind[1] } });
  }
}

/** The day goes with its call-up, list, report and notices; fines already given stay. */
function deleteDay(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  confirmDialog('¿Borrar este día?', 'Se borra ' + dayTitle(d) + ' con su convocatoria, la lista y el acta. No se puede deshacer.', 'Borrar', () => {
    send([{ t: d.match ? 'Partidos' : 'Entrenamientos', op: 'd', v: { 'ID': dayId } }]
      .concat(squad(d).map(pid => ({ t: 'Convocatorias', op: 'd', v: { 'Partido ID': dayId, 'Jugador ID': pid } })))
      .concat(marksOf(dayId).map(m => ({ t: 'Asistencia', op: 'd', v: { 'ID': m['ID'] } })))
      .concat(rows('Acta').filter(x => x['Partido ID'] === dayId).map(x => ({ t: 'Acta', op: 'd', v: { 'ID': x['ID'] } })))
      .concat(rows('Avisos').filter(a => a['Día ID'] === dayId).map(a => ({ t: 'Avisos', op: 'd', v: { 'Día ID': dayId, 'Jugador ID': a['Jugador ID'] } }))));
    S.day = null;
    render();
  });
}

/** Every chosen weekday between two dates gets a training; a date that already has one is left as it is. */
function seasonTrainingsDialog() {
  const t = new Date();
  const end = (t.getMonth() + 1 >= 7 ? t.getFullYear() + 1 : t.getFullYear()) + '-06-30';
  const names = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const h = '<form method="dialog"><div class="title">Crear entrenamientos de la temporada</div>'
    + '<div class="grid2"><div><label for="stFrom">Desde</label><input id="stFrom" type="date" value="' + today() + '"></div><div><label for="stTo">Hasta</label><input id="stTo" type="date" value="' + end + '"></div></div>'
    + '<label>Días de la semana</label><div class="chips">' + names.map((n, i) => '<button type="button" class="btn" data-wd="' + (i + 1) + '">' + n + '</button>').join('') + '</div>'
    + '<label for="stTime">Hora (opcional)</label><input id="stTime" type="time">'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Crear</button></div></form>';
  openDialog(h, dlg => { dlg.onclick = e => { const b = e.target.closest('[data-wd]'); if (b) b.classList.toggle('on'); }; }, dlg => {
    const wds = [...dlg.querySelectorAll('[data-wd].on')].map(b => Number(b.dataset.wd));
    const from = $('stFrom').value, to = $('stTo').value, time = normTime($('stTime').value);
    if (!wds.length || !from || !to || to < from) { toast('Elige fechas y al menos un día'); return false; }
    const taken = new Set(rows('Entrenamientos').map(r => r['Fecha']));
    const ops = [];
    for (let d = new Date(from + 'T12:00:00'); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay() === 0 ? 7 : d.getDay();
      if (wds.includes(wd) && !taken.has(ymd(d))) ops.push({ t: 'Entrenamientos', op: 'u', v: { 'ID': uid(), 'Fecha': ymd(d), 'Hora': time, 'Temporada': activeSeason() } });
    }
    send(ops);
    toast(countOf(ops.length, 'entrenamiento creado', 'entrenamientos creados'));
  });
}

// ---------- fines ----------
function viewFines() {
  const list = fines(f => inSeason(f.row)).sort((a, b) => String(b.date).localeCompare(a.date));
  const pending = list.reduce((s, f) => s + f.rest, 0), paid = list.reduce((s, f) => s + f.amount - f.rest, 0);
  let h = seasonBar() + '<div class="row between"><div><div class="title">Por cobrar: ' + money(pending) + '</div><div class="small">Cobrado: ' + money(paid) + '</div></div><div class="row">'
    + (can.fine() ? '<button class="btn" data-act="editRules">Tarifas</button><button class="btn primary" data-act="newFine">+ Multa</button>' : '') + '</div></div>';
  if (!list.length) return h + '<p class="small">Aún no hay multas.</p>';
  h += '<div class="card">';
  list.forEach(f => {
    const day = findDay(f.origin);
    const card = f.id === 'M-' + f.origin;
    h += '<div class="line"><label class="check"><input type="checkbox" data-chg="finePaid" data-id="' + esc(f.id) + '"' + (f.isPaid ? ' checked' : '') + (can.collect() ? '' : ' disabled') + '>'
      + '<span><span class="bold">' + esc(playerName(f.player)) + '</span><br><span class="small">' + esc([f.label, day ? dayTitle(day) : '', fdate(f.date)].filter(Boolean).join(' · ')) + '</span></span></label>'
      + '<span class="right"><span class="' + payClass(f.rest, f.paid) + '">' + (!f.isPaid && f.paid ? money(f.paid) + ' de ' + money(f.amount) : money(f.amount)) + '</span>'
      + (can.fine() && !card ? '<button class="link danger-text" data-act="removeFine" data-id="' + esc(f.id) + '">Borrar</button>' : '') + '</span></div>';
  });
  h += '</div>';
  if (list.length) h += '<p class="small">Marca la casilla cuando la multa esté pagada.</p>';
  return h;
}

/** Collects the whole fine (the sheet writes down what was left), or undoes it with all its payments. */
function toggleFinePaid(id, checked) {
  const f = findFine(id);
  if (!f) return;
  if (checked) { send({ t: 'Multas', op: 'e', v: { 'ID': id, 'Pagada': 'true' } }); return; }
  send([{ t: 'Multas', op: 'e', v: { 'ID': id, 'Pagada': 'false' } }]
    .concat(rows('Contabilidad').filter(m => m['Multa ID'] === id).map(m => ({ t: 'Contabilidad', op: 'd', v: { 'ID': m['ID'] } }))));
}

function removeFine(id) {
  const f = findFine(id);
  if (!f) return;
  confirmDialog('¿Borrar la multa?', playerName(f.player) + ' · ' + f.label + ' · ' + money(f.amount) + '.' + (f.paid || f.isPaid ? ' Lo que ya pagó queda a su favor.' : ''), 'Borrar',
    () => send({ t: 'Multas', op: 'd', v: { 'ID': id } }));
}

function newFineDialog() {
  let pid = '', label = '';
  const draw = () => '<form method="dialog"><div class="title">Nueva multa</div><label for="finePid">Jugador</label>' + pickPlayer('finePid', players(), pid, 'Elige jugador')
    + '<label>Motivo</label><div class="chips">' + rules().map(r => '<button type="button" class="btn' + (label === r.label ? ' on' : '') + '" data-pick="rule" data-val="' + esc(r.label) + '">' + esc(r.label) + '</button>').join('') + '</div>'
    + '<input id="fineLabel" maxlength="80" placeholder="Motivo" value="' + esc(label) + '"><label for="fineAmount">Importe en euros</label><input id="fineAmount" inputmode="decimal">'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const amt = $('fineAmount').value, typed = $('fineLabel').value;
      label = typed;
      pid = $('finePid').value;
      let newAmt = amt;
      if (b.dataset.pick === 'rule') { label = b.dataset.val; newAmt = String(ruleFor(label).cents / 100).replace('.', ','); }
      dlg.innerHTML = draw();
      $('fineAmount').value = newAmt;
    };
  }, () => {
    const text = $('fineLabel').value.trim(), c = parseMoney($('fineAmount').value);
    pid = $('finePid').value;
    if (!pid || !text || !c) { toast('Falta el jugador, el motivo o el importe'); return false; }
    send({ t: 'Multas', op: 'u', v: Object.assign({ 'ID': uid(), 'Fecha': today(), 'Jugador ID': pid, 'Importe': amount(c), 'Origen': '', 'Pagada': 'false', 'Temporada': activeSeason() }, fineReason(text)) });
  });
}

function rulesDialog() {
  const draft = rules().map(r => ({ label: r.label, amount: String(r.cents / 100).replace('.', ',') }));
  const draw = () => '<form method="dialog"><div class="title">Tarifas del equipo</div>'
    + draft.map((r, i) => '<div class="row nowrap"><input data-rl="' + i + '" value="' + esc(r.label) + '" maxlength="40"><input class="narrow" data-ra="' + i + '" value="' + esc(r.amount) + '" inputmode="decimal" placeholder="€"><button type="button" class="link danger-text" data-rx="' + i + '">Quitar</button></div>').join('')
    + '<button type="button" class="link" data-radd="1">Añadir tarifa</button>'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>';
  const read = dlg => dlg.querySelectorAll('[data-rl]').forEach(inp => { const i = Number(inp.dataset.rl); draft[i].label = inp.value; draft[i].amount = dlg.querySelector('[data-ra="' + i + '"]').value; });
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      if (e.target.dataset.rx) { read(dlg); draft.splice(Number(e.target.dataset.rx), 1); dlg.innerHTML = draw(); }
      if (e.target.dataset.radd) { read(dlg); draft.push({ label: '', amount: '' }); dlg.innerHTML = draw(); }
    };
  }, dlg => {
    read(dlg);
    const clean = draft.map(r => ({ label: r.label.trim(), cents: parseMoney(r.amount) })).filter(r => r.label);
    if (clean.some(r => r.cents === null)) { toast('Revisa los importes'); return false; }
    const before = rules();
    const ops = before.filter(r => !clean.some(c => c.label === r.label)).map(r => ({ t: 'Tarifas', op: 'd', v: { 'Motivo': r.label } }));
    clean.forEach(c => {
      const old = before.find(r => r.label === c.label);
      if (!old) ops.push({ t: 'Tarifas', op: 'u', v: { 'Motivo': c.label, 'Importe': c.cents ? amount(c.cents) : '' } });
      else if (old.cents !== c.cents) ops.push({ t: 'Tarifas', op: 'e', v: { 'Motivo': c.label, 'Importe': c.cents ? amount(c.cents) : '' } });
    });
    send(ops);
  });
}

// ---------- squad ----------
function stats(pid) {
  const ev = rows('Acta').filter(x => { const d = findDay(x['Partido ID']); return d && inSeason(d.row); });
  const mine = ev.filter(x => x['Jugador ID'] === pid);
  return { goals: mine.filter(x => x['Tipo'] === 'Gol').length, assists: ev.filter(x => x['Tipo'] === 'Gol' && x['Asistencia ID'] === pid).length,
    yellows: mine.filter(x => x['Tipo'] === 'Amarilla').length, reds: mine.filter(x => x['Tipo'] === 'Roja' || x['Tipo'] === 'Doble amarilla').length,
    mvps: mine.filter(x => x['Tipo'] === 'MVP').length };
}

function viewSquad() {
  const list = players().map(p => ({ p: p, s: stats(p['ID']) })).sort((a, b) => b.s.goals - a.s.goals || b.s.assists - a.s.assists);
  let h = seasonBar();
  list.forEach(({ p, s }) => {
    const pid = p['ID'];
    const open = S.open === pid;
    const seasonFines = fines(f => f.player === pid && inSeason(f.row)).sort((a, b) => String(b.date).localeCompare(a.date));
    const pendingFines = seasonFines.reduce((t, f) => t + f.rest, 0);
    h += '<div class="card"><div class="tap" data-act="openPlayer" data-pid="' + esc(pid) + '"><div class="row nowrap"><span class="num">' + esc(p['Dorsal'] || '–') + '</span><div><div class="name">' + esc(p['Nombre']) + '</div>'
      + '<div class="small">' + esc([p['Apodo'], p['Posición']].filter(Boolean).join(' · ')) + '</div></div></div>'
      + '<div class="small">' + esc([countOf(s.goals, 'gol', 'goles'), countOf(s.assists, 'asistencia', 'asistencias'), countOf(s.yellows, 'amarilla', 'amarillas'), countOf(s.reds, 'roja', 'rojas'), 'MVP ' + s.mvps].join(' · ')) + '</div>'
      + (pendingFines ? '<div class="small owed bold">Multas pendientes: ' + money(pendingFines) + '</div>' : '') + '</div>';
    if (open) {
      const acc = can.accounts() ? account(pid) : null;
      h += '<hr><div class="bold">Multas</div>' + (seasonFines.length ? '' : '<div class="small">Ninguna esta temporada.</div>');
      seasonFines.forEach(f => { h += moneyLine(f.label + ' · ' + fdate(f.date), f.amount, f.rest, can.collect() && f.rest > 0 ? payButton('fine', f.id, pid) : ''); });
      if (acc) {
        const before = acc.fines.filter(f => earlier(seasonOf(f.row)));
        if (before.length) h += '<div class="bold mt">Multas de temporadas anteriores</div>';
        before.forEach(f => { h += moneyLine(f.label + ' · ' + fdate(f.date) + ' (' + shortSeason(f.season) + ')', f.amount, f.rest, can.collect() ? payButton('fine', f.id, pid) : ''); });
        h += '<div class="row between mt"><span class="bold">Cuotas, equipación y ropa</span>' + (can.collect() ? '<button class="link" data-act="addCharge" data-pid="' + esc(pid) + '">+ Cargo</button>' : '') + '</div>';
        if (!acc.charges.length) h += '<div class="small">Nada cargado esta temporada.</div>';
        acc.charges.forEach(c => {
          const what = [c.category, c.concept].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · ') + (earlier(seasonOf({ 'Temporada': c.season })) ? ' (' + shortSeason(c.season) + ')' : '');
          h += moneyLine(what, c.amount, c.rest, can.collect() && c.rest > 0 ? payButton('charge', c.id, pid) : '');
        });
        if (acc.credit) h += '<div class="small paid bold mt">Saldo a favor: ' + money(acc.credit) + '</div>';
        h += '<div class="small bold mt">Total pendiente: ' + money(acc.total) + '</div>';
      }
      const info = [['Teléfono', p['Teléfono']], ['Nacimiento', p['Nacimiento'] ? fdate(p['Nacimiento']) : ''], ['Tallas', [p['Talla camiseta'], p['Talla pantalón']].filter(Boolean).join(' / ')],
        ['Posición preferida', p['Posición preferida']], ['Contacto de emergencia', p['Contacto emergencia']]].filter(x => x[1]);
      if (info.length) h += '<hr>' + info.map(x => '<div class="small">' + esc(x[0] + ': ' + x[1]) + '</div>').join('');
    }
    h += '</div>';
  });
  return h + '<p class="small">Los números salen de las actas de los partidos. Toca un jugador para ver sus datos.</p>';
}
const moneyLine = (text, amt, rest, extra) => '<div class="line"><span class="' + payClass(rest, amt - rest) + '">' + esc(text) + '</span><span class="right"><span class="bold ' + payClass(rest, amt - rest) + '">' + paidText(amt, rest) + '</span>' + (extra || '') + '</span></div>';
const payButton = (kind, id, pid) => '<button class="link" data-act="pay" data-kind="' + kind + '" data-id="' + esc(id) + '" data-pid="' + esc(pid) + '">Cobrar</button>';

/** A payment, whole or in part, of a fine or a charge; a fine can also be paid from his credit. */
function payDialog(kind, id, pid) {
  const acc = account(pid);
  const item = kind === 'fine' ? acc.fines.find(f => f.id === id) || findFine(id) : acc.charges.find(c => c.id === id);
  if (!item) return;
  const title = kind === 'fine' ? 'Multa: ' + item.label + ' · ' + playerName(pid) : [item.category, item.concept].filter(Boolean).join(' · ') + ' · ' + playerName(pid);
  const credit = kind === 'fine' ? acc.credit : 0;
  const h = '<form method="dialog"><div class="title">Cobrar</div><div class="small">' + esc(title) + '</div><p>Falta: <b>' + money(item.rest) + '</b></p>'
    + '<label for="payAmount">Lo que paga ahora (€)</label><input id="payAmount" inputmode="decimal" value="' + esc(String(item.rest / 100).replace('.', ',')) + '">'
    + (credit > 0 ? '<button type="button" class="btn" data-credit="1">Pagar con su saldo (' + money(Math.min(credit, item.rest)) + ')</button>' : '')
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Cobrar</button></div></form>';
  openDialog(h, dlg => {
    dlg.onclick = e => {
      if (!e.target.dataset.credit) return;
      const c = Math.min(credit, item.rest);
      send([{ t: 'Contabilidad', op: 'u', v: { 'ID': uid(), 'Fecha': today(), 'Tipo': 'Traspaso', 'Categoría': 'Multa', 'Concepto': 'Multa: ' + item.label + ' (de su saldo)',
        'Importe': amount(c), 'Multa ID': id, 'Registrado por': by(), 'Jugador ID': pid, 'Cargo ID': '', 'Temporada': activeSeason() } }]
        .concat(c >= item.rest ? [{ t: 'Multas', op: 'e', v: { 'ID': id, 'Pagada': 'true' } }] : []));
      closeDialog();
    };
  }, () => {
    const c = parseMoney($('payAmount').value);
    if (!c) { toast('Pon un importe'); return false; }
    if (kind === 'fine') {
      send([{ t: 'Contabilidad', op: 'u', v: { 'ID': uid(), 'Fecha': today(), 'Tipo': 'Ingreso', 'Categoría': 'Multa', 'Concepto': 'Multa: ' + item.label,
        'Importe': amount(c), 'Multa ID': id, 'Registrado por': by(), 'Jugador ID': pid, 'Cargo ID': '', 'Temporada': activeSeason() } }]
        .concat(c >= item.rest ? [{ t: 'Multas', op: 'e', v: { 'ID': id, 'Pagada': 'true' } }] : []));
    } else {
      send({ t: 'Contabilidad', op: 'u', v: { 'ID': uid(), 'Fecha': today(), 'Tipo': 'Ingreso', 'Categoría': item.category, 'Concepto': item.concept || item.category,
        'Importe': amount(c), 'Multa ID': '', 'Registrado por': by(), 'Jugador ID': pid, 'Cargo ID': id, 'Temporada': activeSeason() } });
    }
    toast('Cobrado ' + money(c));
  });
}

function chargeDialog(pids, onlyOne) {
  let category = '', chosen = new Set(pids);
  const all = players();
  const draw = () => '<form method="dialog"><div class="title">' + (onlyOne ? 'Cargo · ' + esc(playerName(pids[0])) : 'Cargo a jugadores') + '</div>'
    + '<p class="small">Lo que tienen que pagar. Se cobra desde la ficha de cada jugador en Plantilla, entero o a plazos.</p>'
    + '<label>Categoría</label><div class="chips">' + CHARGE_CATEGORIES.map(c => '<button type="button" class="btn' + (category === c ? ' on' : '') + '" data-pick="cat" data-val="' + c + '">' + c + '</button>').join('') + '</div>'
    + '<label for="chConcept">Motivo</label><input id="chConcept" maxlength="80"><label for="chAmount">Importe por jugador (€)</label><input id="chAmount" inputmode="decimal">'
    + (onlyOne ? '' : '<label>Jugadores</label><div class="chips"><button type="button" class="btn' + (chosen.size === all.length ? ' on' : '') + '" data-pick="all">Todos</button>'
      + all.map(p => '<button type="button" class="btn' + (chosen.has(p['ID']) ? ' on' : '') + '" data-pick="pid" data-val="' + esc(p['ID']) + '">' + esc(p['Nombre']) + '</button>').join('') + '</div>')
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const keep = [$('chConcept').value, $('chAmount').value];
      if (b.dataset.pick === 'cat') category = b.dataset.val;
      if (b.dataset.pick === 'all') chosen = chosen.size === all.length ? new Set() : new Set(all.map(p => p['ID']));
      if (b.dataset.pick === 'pid') { const v = b.dataset.val; if (chosen.has(v)) chosen.delete(v); else chosen.add(v); }
      dlg.innerHTML = draw();
      $('chConcept').value = keep[0]; $('chAmount').value = keep[1];
    };
  }, () => {
    const c = parseMoney($('chAmount').value);
    if (!category || !c || !chosen.size) { toast('Falta la categoría, el importe o los jugadores'); return false; }
    const concept = $('chConcept').value.trim();
    send(all.filter(p => chosen.has(p['ID'])).map(p => ({ t: 'Cargos', op: 'u', v: { 'ID': uid(), 'Fecha': today(), 'Jugador ID': p['ID'], 'Categoría': category,
      'Concepto': concept, 'Importe': amount(c), 'Registrado por': by(), 'Temporada': activeSeason() } })));
  });
}

// ---------- summary ----------
function viewSummary() {
  const ds = days();
  const lines = players().map(p => {
    const pid = p['ID'];
    const marks = ds.map(d => calledUp(d).includes(pid) ? markOf(d.id, pid) : null).filter(Boolean);
    const n = s => marks.filter(m => m['Estado'] === s).length;
    const callDays = ds.filter(d => d.match);
    const callMarks = callDays.map(d => (calledUp(d).includes(pid) ? markOf(d.id, pid) : null)).filter(Boolean).filter(m => m['Estado'] !== 'No puede');
    const notCalled = callDays.filter(d => !squad(d).includes(pid)).length;
    const pending = fines(f => f.player === pid && inSeason(f.row)).reduce((s, f) => s + f.rest, 0);
    const reasons = REASONS.map(r => [r, marks.filter(m => m['Estado'] === 'No puede' && m['Motivo'] === r).length]).filter(x => x[1]);
    const counted = n('OK') + n('Tarde') + n('Falta');
    return { p: p, late: n('Tarde'), excused: marks.filter(m => m['Estado'] === 'Tarde' && isTrue(m['Justificada'])).length, absent: n('Falta'), justified: n('No puede'),
      kit: marks.filter(m => isTrue(m['Equipación incorrecta'])).length, pending: pending, percent: counted ? Math.floor((n('OK') + n('Tarde')) * 100 / counted) : null,
      calledUp: callMarks.length, came: callMarks.filter(came).length, notCalled: notCalled, callDays: callMarks.length + notCalled, reasons: reasons };
  }).sort((a, b) => b.pending - a.pending);
  let h = seasonBar();
  lines.forEach(l => {
    h += '<div class="card row between nowrap"><div><div class="name">' + esc(l.p['Nombre']) + '</div><div class="small">'
      + esc(countOf(l.late, 'retraso', 'retrasos') + (l.excused ? ' (' + l.excused + ' justif.)' : '') + ' · ' + countOf(l.absent, 'falta', 'faltas') + ' · Equipación: ' + l.kit) + '</div>'
      + (l.callDays ? '<div class="small">' + esc(l.calledUp === 0 ? 'No convocado (' + countOf(l.notCalled, 'partido', 'partidos') + ')' : 'Convocado ' + l.calledUp + ' de ' + l.callDays + ' · vino a ' + l.came) + '</div>' : '')
      + (l.justified ? '<div class="small">' + esc('No pudo ' + l.justified + (l.reasons.length ? ': ' + l.reasons.map(x => x[0] + ' ' + x[1]).join(', ') : '')) + '</div>' : '')
      + '</div><div class="right col"><span class="title">' + (l.percent === null ? '–' : l.percent + ' %') + '</span>' + (l.pending ? '<span class="small owed">Debe ' + money(l.pending) + '</span>' : '') + '</div></div>';
  });
  return h + '<p class="small">El porcentaje es de asistencia. No estar convocado o no poder ir no cuenta en contra.</p>';
}

// ---------- accounts ----------
function viewAccounts() {
  const mov = rows('Contabilidad').filter(m => inSeason(m)).sort((a, b) => String(b['Fecha']).localeCompare(a['Fecha']));
  const sum = t => mov.filter(m => m['Tipo'] === t).reduce((s, m) => s + cents(m['Importe']), 0);
  const view = S.accView || 'Movimientos';
  let h = seasonBar() + '<div class="row between"><div><div class="title">Saldo: ' + money(sum('Ingreso') - sum('Gasto')) + '</div><div class="small">Ingresos ' + money(sum('Ingreso')) + ' · Gastos ' + money(sum('Gasto')) + '</div></div>'
    + (editable() ? '<button class="btn primary" data-act="newMovement">+ Movimiento</button>' : '') + '</div>'
    + '<div class="chips">' + ['Movimientos', 'Por jugador'].map(v => '<button class="btn' + (view === v ? ' on' : '') + '" data-act="accView" data-view="' + v + '">' + v + '</button>').join('') + '</div>';
  if (view === 'Movimientos') {
    if (!mov.length) return h + '<p class="small">Aún no hay movimientos. Lo que se cobre (también a plazos) aparece aquí solo.</p>';
    h += '<div class="card">';
    mov.forEach(m => {
      const sign = m['Tipo'] === 'Ingreso' ? '+' : m['Tipo'] === 'Gasto' ? '−' : '⇄ ';
      const cls = m['Tipo'] === 'Ingreso' ? 'paid' : m['Tipo'] === 'Gasto' ? 'owed' : 'small';
      h += '<div class="line"><span><span>' + esc(m['Concepto'] || m['Categoría']) + '</span><br><span class="small">' + esc([m['Categoría'], m['Jugador ID'] ? playerName(m['Jugador ID']) : '', fdate(m['Fecha']), m['Registrado por']].filter(Boolean).join(' · ')) + '</span></span>'
        + '<span class="right"><span class="bold ' + cls + '">' + sign + money(cents(m['Importe'])) + '</span>' + (editable() ? '<button class="link danger-text" data-act="removeMovement" data-id="' + esc(m['ID']) + '">Borrar</button>' : '') + '</span></div>';
    });
    return h + '</div>';
  }
  const all = players().map(p => ({ p: p, a: account(p['ID']) })).sort((x, y) => y.a.total - x.a.total);
  h += '<div class="row between"><span class="title">Pendiente de cobrar: ' + money(all.reduce((s, x) => s + x.a.total, 0)) + '</span><button class="btn" data-act="moneyWhatsApp">WhatsApp</button></div>';
  all.forEach(({ p, a }) => {
    const pid = p['ID'];
    h += '<div class="card"><div class="tap row between" data-act="openPlayer" data-pid="' + esc(pid) + '"><span class="name">' + esc(p['Nombre']) + '</span><span class="bold ' + (a.total ? 'owed' : 'paid') + '">'
      + (a.total ? 'Debe ' + money(a.total) + (a.credit ? ' · a favor ' + money(a.credit) : '') : a.credit ? 'A favor ' + money(a.credit) : 'Al día') + '</span></div>';
    if (S.open === pid) {
      a.charges.forEach(c => { h += moneyLine([c.category, c.concept].filter(Boolean).join(' · ') + (earlier(seasonOf({ 'Temporada': c.season })) ? ' (' + shortSeason(c.season) + ')' : ''), c.amount, c.rest, ''); });
      a.fines.forEach(f => { h += moneyLine('Multa: ' + f.label + ' (' + fdate(f.date) + ')', f.amount, f.rest, ''); });
      if (a.credit) h += '<div class="small paid bold">Saldo a favor: ' + money(a.credit) + '</div>';
      rows('Cargos').filter(c => c['Jugador ID'] === pid && inSeason(c)).forEach(c => {
        h += '<div class="line small"><span>' + esc('Cargo · ' + [c['Categoría'], c['Concepto']].filter(Boolean).join(' · ') + ' · ' + fdate(c['Fecha'])) + '</span><span class="right">' + money(cents(c['Importe']))
          + (editable() ? '<button class="link danger-text" data-act="removeCharge" data-id="' + esc(c['ID']) + '">Quitar</button>' : '') + '</span></div>';
      });
      h += '<div class="bold mt">Total pendiente: ' + money(a.total) + '</div>';
    }
    h += '</div>';
  });
  return h;
}

/** A payment written down by mistake can go; a fine paid with it owes that again. */
function removeMovement(id) {
  const m = rows('Contabilidad').find(x => x['ID'] === id);
  if (!m) return;
  confirmDialog('¿Seguro?', 'Se borra «' + (m['Concepto'] || m['Categoría']) + '» de ' + money(cents(m['Importe'])) + '. No se puede deshacer.', 'Borrar', () => {
    const ops = [{ t: 'Contabilidad', op: 'd', v: { 'ID': id } }];
    const fid = m['Multa ID'];
    if (fid) {
      const f = findFine(fid);
      const left = rows('Contabilidad').filter(x => x['Multa ID'] === fid && x['ID'] !== id).reduce((s, x) => s + cents(x['Importe']), 0);
      if (f) ops.push({ t: 'Multas', op: 'e', v: { 'ID': fid, 'Pagada': left > 0 && left >= f.amount ? 'true' : 'false' } });
    }
    send(ops);
  });
}

function removeCharge(id) {
  const c = rows('Cargos').find(x => x['ID'] === id);
  if (!c) return;
  confirmDialog('¿Seguro?', 'Se quita el cargo «' + (c['Concepto'] || c['Categoría']) + '» de ' + money(cents(c['Importe'])) + '. No se puede deshacer.', 'Borrar',
    () => send({ t: 'Cargos', op: 'd', v: { 'ID': id } }));
}

function movementDialog() {
  let kind = 'Ingreso', category = '', pid = '';
  const draw = () => {
    const cats = kind === 'Cargo a jugador' ? CHARGE_CATEGORIES : MOVEMENT_CATEGORIES;
    return '<form method="dialog"><div class="title">Nuevo movimiento</div><div class="chips">' + ['Ingreso', 'Gasto', 'Cargo a jugador'].map(k => '<button type="button" class="btn' + (kind === k ? ' on' : '') + '" data-pick="kind" data-val="' + k + '">' + k + '</button>').join('') + '</div>'
      + '<label for="mvDate">Fecha</label><input id="mvDate" type="date" value="' + today() + '">'
      + '<label>Categoría</label><div class="chips">' + cats.map(c => '<button type="button" class="btn' + (category === c ? ' on' : '') + '" data-pick="cat" data-val="' + c + '">' + c + '</button>').join('') + '</div>'
      + '<label for="mvConcept">Motivo</label><input id="mvConcept" maxlength="80"><label for="mvAmount">Importe en euros</label><input id="mvAmount" inputmode="decimal">'
      + '<label for="mvPid">Jugador (opcional)</label>' + pickPlayer('mvPid', players(), pid, 'Ninguno')
      + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>';
  };
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      if (b.dataset.pick === 'kind' && b.dataset.val === 'Cargo a jugador') { closeDialog(); chargeDialog([], false); return; }
      const keep = [$('mvDate').value, $('mvConcept').value, $('mvAmount').value];
      pid = $('mvPid').value;
      if (b.dataset.pick === 'kind') { kind = b.dataset.val; category = ''; }
      if (b.dataset.pick === 'cat') category = b.dataset.val;
      dlg.innerHTML = draw();
      $('mvDate').value = keep[0]; $('mvConcept').value = keep[1]; $('mvAmount').value = keep[2];
    };
  }, () => {
    const c = parseMoney($('mvAmount').value);
    pid = $('mvPid').value;
    if (!category || !c) { toast('Falta la categoría o el importe'); return false; }
    send({ t: 'Contabilidad', op: 'u', v: { 'ID': uid(), 'Fecha': $('mvDate').value || today(), 'Tipo': kind, 'Categoría': category, 'Concepto': $('mvConcept').value.trim(),
      'Importe': amount(c), 'Multa ID': '', 'Registrado por': by(), 'Jugador ID': pid, 'Cargo ID': '', 'Temporada': activeSeason() } });
  });
}

function moneyText() {
  const owing = players().map(p => ({ p: p, a: account(p['ID']) })).filter(x => x.a.total > 0).sort((x, y) => y.a.total - x.a.total);
  const L = ['💰 *PAGOS PENDIENTES ' + TEAM.toUpperCase() + '* 💰', ''];
  if (!owing.length) { L.push('✅ Todo el mundo está al día. ¡Gracias!'); return L.join('\n'); }
  owing.forEach(({ p, a }) => {
    const parts = {};
    a.charges.filter(c => c.rest > 0).forEach(c => { parts[c.category] = (parts[c.category] || 0) + c.rest; });
    const finesC = a.fines.reduce((s, f) => s + f.rest, 0);
    const list = Object.keys(parts).map(k => k + ' ' + money(parts[k])).concat(finesC ? ['Multas ' + money(finesC)] : []);
    L.push('• ' + (p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre'] + ': *' + money(a.total) + '* (' + list.join(' · ') + ')');
  });
  L.push('', 'Total pendiente: *' + money(owing.reduce((s, x) => s + x.a.total, 0)) + '*', '', '🙏 Poneos al día cuando podáis. Cada uno ve su desglose en la app. ¡Gracias!');
  return L.join('\n');
}

// ---------- seasons ----------
function seasonBar() {
  const all = rows('Temporadas').map(t => t['Nombre']).filter(Boolean).sort();
  if (!all.length) return '';
  return '<div class="row between season"><span><label for="seasonPick" class="inline">Temporada</label> <select id="seasonPick" data-chg="season">'
    + all.map(n => '<option' + (n === viewed() ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>'
    + (editable() ? '' : ' <span class="small notice">solo consulta</span>') + '</span>'
    + (can.seasons() ? '<button class="link" data-act="seasons">Gestionar</button>' : '') + '</div>';
}

function seasonsDialog() {
  const list = rows('Temporadas').filter(t => t['Nombre']).sort((a, b) => a['Nombre'].localeCompare(b['Nombre']));
  const years = list.map(t => parseInt(t['Nombre'], 10)).filter(n => !isNaN(n));
  const start = years.length ? Math.max.apply(null, years) + 1 : new Date().getFullYear();
  const contents = n => allDays().filter(d => seasonOf(d.row) === n).length + ['Multas', 'Contabilidad', 'Cargos'].reduce((s, t) => s + rows(t).filter(r => seasonOf(r) === n).length, 0);
  const active = activeSeason();
  const h = '<form method="dialog"><div class="title">Temporadas</div>'
    + list.map(t => {
      const n = t['Nombre'];
      const canDel = list.length > 1 && n !== active && contents(n) === 0;
      return '<div class="line"><span>' + esc(n) + (n === active ? ' <span class="paid">· activa</span>' : '') + '<br><span class="small">' + esc(fdate(t['Desde']) + ' – ' + fdate(t['Hasta'])) + '</span></span><span class="right">'
        + (n !== active ? '<button type="button" class="link" data-sact="activate" data-name="' + esc(n) + '">Activar</button>' : '')
        + (canDel ? '<button type="button" class="link danger-text" data-sact="delete" data-name="' + esc(n) + '">Borrar</button>' : '') + '</span></div>';
    }).join('')
    + '<div class="title mt">Nueva temporada</div><label for="snName">Nombre</label><input id="snName" value="' + start + '/' + (start + 1) + '">'
    + '<div class="grid2"><div><label for="snFrom">Desde</label><input id="snFrom" type="date" value="' + start + '-07-01"></div><div><label for="snTo">Hasta</label><input id="snTo" type="date" value="' + (start + 1) + '-06-30"></div></div>'
    + '<p class="small">La nueva pasa a ser la activa: lo nuevo se guarda en ella. Las demás quedan para consultar.</p>'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cerrar</button><button class="btn primary" value="ok">Crear temporada</button></div></form>';
  const activate = name => list.map(t => ({ t: 'Temporadas', op: 'e', v: { 'Nombre': t['Nombre'], 'Activa': t['Nombre'] === name ? 'true' : 'false' } }));
  openDialog(h, dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-sact]');
      if (!b) return;
      if (b.dataset.sact === 'activate') send(activate(b.dataset.name));
      else send({ t: 'Temporadas', op: 'd', v: { 'Nombre': b.dataset.name } });
      S.viewSeason = '';
      closeDialog();
    };
  }, () => {
    const name = $('snName').value.trim();
    if (!name || list.some(t => t['Nombre'] === name)) { toast('Ese nombre ya existe o está vacío'); return false; }
    if (!confirm('¿Crear la temporada ' + name + ' y hacerla la activa?')) return false;
    send(list.map(t => ({ t: 'Temporadas', op: 'e', v: { 'Nombre': t['Nombre'], 'Activa': 'false' } }))
      .concat([{ t: 'Temporadas', op: 'u', v: { 'Nombre': name, 'Desde': $('snFrom').value, 'Hasta': $('snTo').value, 'Activa': 'true' } }]));
    S.viewSeason = '';
  });
}
