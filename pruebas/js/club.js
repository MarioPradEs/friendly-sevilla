'use strict';
// The club's management, as in the Android app: days with call-up, list and report; fines, squad,
// summary, accounts and seasons. What each role may do comes from `can` (the sheet checks it again).

// ---------- days ----------
function viewDays() {
  const all = days();
  const t = today();
  // What is coming first, today on top: a season of trainings would bury it under the past.
  const coming = all.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const past = all.filter(d => d.date < t).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  // A past season has nothing coming: its days show open.
  const pastOpen = S.showPast || !coming.length;
  // Who only takes attendance works on the active season and nothing else.
  let h = ROLE() === 'Lista' ? '<h2>Pasar lista</h2>' : seasonBar();
  if (can.editDays()) h += '<div class="row"><button class="btn primary wide" data-act="addDay">+ Añadir día</button></div>';
  if (!all.length) {
    h += '<p class="small">' + (editable() ? 'Añade un día de entrenamiento, partido, amistoso o torneo. Puedes prepararlo antes: nadie sale marcado hasta que lo marques ese mismo día.' : 'No hay días en esta temporada.') + '</p>';
  }
  if (coming.length) h += '<h2>Próximos</h2>' + coming.map(dayRow).join('');
  if (past.length) {
    h += '<button class="fold" data-act="togglePast"' + (coming.length ? '' : ' disabled') + '>Pasados (' + past.length + ') ' + (pastOpen ? '▾' : '▸') + '</button>';
    if (pastOpen) h += past.map(dayRow).join('');
  }
  if (can.editDays()) h += '<button class="btn wide mt" data-act="seasonTrainings">Crear entrenamientos de la temporada</button>';
  // The official league calendar needs the rivals from Equipos.
  if (can.editDays() && rivals().length) h += '<button class="btn wide mt" data-act="leagueCalendar">Crear calendario de liga</button>';
  return h;
}
/** One day in the list: what happened or who said what; the arrow says it opens. */
function dayRow(d) {
  const marks = marksOf(d.id).filter(m => calledUp(d).includes(m['Jugador ID']));
  const n = s => marks.filter(m => m['Estado'] === s).length;
  const unavailable = n('No puede');
  // Before the list is taken: who said they will come and who said they cannot.
  const marked = marks.map(m => m['Jugador ID']);
  const coachIds = coaches().map(p => p['ID']);
  const told = rows('Avisos').filter(a => a['Día ID'] === d.id && !marked.includes(a['Jugador ID']) && !coachIds.includes(a['Jugador ID']));
  const going = goingLine(told.filter(a => a['Tipo'] === 'Asistiré').map(a => a['Jugador ID'])), notGoing = told.filter(a => a['Tipo'] === 'No puedo ir').length;
  const result = d.match && d.gf !== '' && d.ga !== '' ? 'Resultado ' + d.gf + '-' + d.ga + verdict(d) : '';
  const info = [
    marks.length > unavailable ? (n('OK') + n('Tarde')) + ' de ' + (marks.length - unavailable) + ' vinieron' : '',
    n('Tarde') ? countOf(n('Tarde'), 'retraso', 'retrasos') : '',
    n('Falta') ? countOf(n('Falta'), 'falta', 'faltas') : '',
    unavailable ? countOf(unavailable, 'no puede', 'no pueden') : '',
    unmarked(d).length ? unmarked(d).length + ' sin marcar' : '',
    going,
    notGoing ? countOf(notGoing, 'avisa que no puede', 'avisan que no pueden') : '',
    notCalledUp(d).length ? countOf(notCalledUp(d).length, 'no convocado', 'no convocados') : '',
  ].filter(Boolean).join(' · ');
  return '<div class="card tap" data-act="openDay" data-day="' + esc(d.id) + '"><div class="row between nowrap head"><span class="title">' + esc(dayTitle(d)) + '</span><span class="arrow">›</span></div><div class="small">'
    + esc(fdate(d.date) + (d.time ? ' · ' + d.time : '')) + '</div>' + (d.off ? '<div class="small bold warn">' + esc(offLabel(d)) + '</div>' : '') + (result ? '<div class="small bold">' + esc(result) + '</div>' : '')
    + (info ? '<div class="small">' + esc(info) + '</div>' : '') + (keeperMissing(d) ? '<div class="small bold warn">Ningún portero ha dicho que va</div>' : '') + '</div>';
}
function verdict(d) {
  const us = Number(d.gf), them = Number(d.ga);
  if (isNaN(us) || isNaN(them)) return '';
  return us > them ? ' · Ganamos' : us < them ? ' · Perdimos' : ' · Empate';
}

/** A new day: only what is needed to create it. Nothing is saved until "Crear"; then it opens. */
function addDay() {
  let date = today(), kind = KINDS[0][0], title = '', time = '';
  const rv = rivals().map(r => r.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const read = () => { date = $('ndDate').value || date; time = $('ndTime').value; if ($('ndRival')) title = $('ndRival').value; };
  const draw = () => {
    const training = kind === KINDS[0][0];
    const rival = !rv.length ? '<input id="ndRival" maxlength="80" value="' + esc(title) + '">'
      : '<select id="ndRival" class="full"><option value="">Por confirmar</option>' + rv.map(r => '<option' + (r === title ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>';
    return '<form method="dialog"><div class="title">Nuevo día</div>'
      + '<label for="ndDate">Fecha</label><input id="ndDate" type="date" value="' + esc(date) + '">'
      + '<label>Tipo de día</label><div class="chips">' + KINDS.map(k => '<button type="button" class="btn' + (kind === k[0] ? ' on' : '') + '" data-kind="' + esc(k[0]) + '">' + esc(k[0]) + '</button>').join('') + '</div>'
      + (training ? '' : '<label for="ndRival">Rival</label>' + rival)
      + '<label for="ndTime">' + (training ? 'Hora' : 'Hora del partido') + '</label><input id="ndTime" type="time" value="' + esc(time) + '">'
      + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Crear</button></div></form>';
  };
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      read();
      kind = b.dataset.kind;
      dlg.innerHTML = draw();
    };
  }, () => {
    read();
    if (!date) { toast('Elige la fecha'); return false; }
    const id = uid();
    const k = KINDS.find(x => x[0] === kind);
    const season = activeSeason();
    send(k[1] ? { t: 'Partidos', op: 'u', v: { 'ID': id, 'Fecha': date, 'Tipo': k[1], 'Rival': title.trim(), 'Hora partido': normTime(time), 'Temporada': season } }
      : { t: 'Entrenamientos', op: 'u', v: { 'ID': id, 'Fecha': date, 'Hora': normTime(time), 'Temporada': season } });
    S.day = id; S.part = null; render(); window.scrollTo(0, 0);
  });
}

function viewDay(d) {
  const coming = d.date >= today();
  if (ROLE() === 'Lista') {
    // Like a player, plus the list: the day as it is, nothing of it to change.
    return '<button class="link" data-act="closeDay">‹ Volver</button><div class="card"><div class="title">' + esc(dayTitle(d)) + '</div><div class="small">'
      + esc([fdate(d.date), d.time ? 'a las ' + d.time : '', d.side].filter(Boolean).join(' · ')) + '</div>'
      + (coming && !d.off ? '<div class="row">' + whoButton(d) + '</div>' : '') + '</div>' + offPart(d, false) + partList(d);
  }
  const parts = d.match ? ['Convocatoria', 'Pasar lista', 'Acta'] : ['Pasar lista'];
  // Opens where the work is: no squad yet, the call-up; a match already played, its report; else the list.
  if (!parts.includes(S.part)) S.part = d.match && !calledUp(d).length ? 'Convocatoria' : d.match && d.date < today() ? 'Acta' : 'Pasar lista';
  const edit = can.editDays();
  let h = '<div class="row between nowrap"><button class="link" data-act="closeDay">‹ Volver</button><span class="title grow">' + esc(dayTitle(d)) + '</span>'
    + (can.deleteDays() ? '<button class="btn sm danger" data-act="deleteDay" data-day="' + esc(d.id) + '">Borrar día</button>' : '') + '</div>';
  // The day's settings in one line; the pencil opens them, so the list below keeps the room.
  const head = [fdate(d.date), d.match ? d.side : '', d.time || 'sin hora', d.match && d.meet ? 'quedamos ' + d.meet : '', d.deadline ? 'plazo ' + deadlineText(d.deadline) : ''].filter(Boolean).join(' · ');
  const open = edit && S.headOpen === d.id;
  h += edit ? '<button class="field mt" data-act="dayHead" data-day="' + esc(d.id) + '"><span>' + esc(head) + '</span><span class="pen">' + (open ? '▴' : '✏️') + '</span></button>'
    : '<div class="small mt">' + esc(head) + '</div>';
  h += offPart(d, edit);
  if (S.announce && S.announce.day === d.id) {
    h += '<div class="row nowrap"><button class="btn grow" data-act="announce" data-day="' + esc(d.id) + '">📣 Avisar del cambio por WhatsApp</button>'
      + '<button class="icon-btn" data-act="noAnnounce" aria-label="No avisar">✕</button></div>';
  }
  if (open) {
    h += '<div class="card mt">';
    if (!d.off) h += '<button class="btn wide" data-act="dayOff" data-day="' + esc(d.id) + '">' + (d.match ? '⏸️ Aplazar partido' : '❌ Suspender entreno') + '</button>';
    h += '<label for="dayDate">Fecha</label><input id="dayDate" type="date" value="' + esc(d.date) + '" data-chg="dayDate" data-day="' + esc(d.id) + '">';
    h += '<label>Tipo de día</label><div class="chips">' + KINDS.map(k => '<button class="btn' + (d.label === k[0] ? ' on' : '') + '" data-act="dayKind" data-kind="' + esc(k[0]) + '" data-day="' + esc(d.id) + '">' + esc(k[0]) + '</button>').join('') + '</div>';
    h += '<label for="dayTitle">' + (d.match ? 'Rival' : 'Nombre (opcional)') + '</label><input id="dayTitle" value="' + esc(d.title) + '" maxlength="80" data-chg="dayTitle" data-day="' + esc(d.id) + '"' + (d.match ? ' list="rivalList"' : '') + '>';
    if (d.match) {
      h += '<datalist id="rivalList">' + rivals().map(r => '<option value="' + esc(r.name) + '">').join('') + '</datalist>';
      h += '<div class="chips mt"><span class="small bold">' + esc(TEAM) + ':</span>' + ['Local', 'Visitante'].map(s => '<button class="btn' + (d.side === s ? ' on' : '') + '" data-act="side" data-side="' + s + '" data-day="' + esc(d.id) + '">' + s + '</button>').join('') + '</div>';
      const where = d.side === 'Local' ? 'Jugamos en casa' : d.side === 'Visitante' ? 'Vamos al campo de ' + (d.title.trim() || 'el rival') + (groundOf(d).ground ? ' (' + groundOf(d).ground + ')' : '') : '';
      if (where) h += '<div class="small">' + esc(where) + '</div>';
    }
    h += '<div class="grid2"><div><label for="dayTime">' + (d.match ? 'Partido' : 'Hora') + '</label><input id="dayTime" type="time" value="' + esc(normTime(d.time)) + '" data-chg="dayTime" data-day="' + esc(d.id) + '"></div>';
    if (d.match) h += '<div><label for="dayMeet">Quedamos a las</label><input id="dayMeet" type="time" value="' + esc(normTime(d.meet)) + '" data-chg="dayMeet" data-day="' + esc(d.id) + '"></div>';
    h += '</div>';
    const choice = deadlineChoice(d);
    h += '<label for="dayDeadline">Plazo para responder</label><select id="dayDeadline" class="full" data-chg="dayDeadline" data-day="' + esc(d.id) + '">'
      + [['', 'Sin plazo'], ['1', 'El día antes a las 20:00'], ['2', '2 días antes a las 20:00'], ['3', '3 días antes a las 20:00']]
        .concat(choice === 'raw' ? [['raw', deadlineText(d.deadline)]] : [])
        .map(o => '<option value="' + o[0] + '"' + (choice === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    h += '</div>';
  }
  if (keeperMissing(d)) h += '<div class="small bold warn mt">Ningún portero ha dicho que va</div>';
  // Who comes only matters before the day; the reminder too, by WhatsApp to those who have not said. Not on a day that is off.
  if (coming && !d.off) {
    const silent = silentPlayers(d).length;
    h += '<div class="row nowrap">' + whoButton(d)
      + (edit && d.gf === '' ? '<button class="btn" data-act="remind" data-day="' + esc(d.id) + '">Recordar' + (silent ? ' (' + silent + ')' : '') + '</button>' : '') + '</div>';
  }
  if (parts.length > 1) h += '<div class="parts">' + parts.map((p, i) => '<button class="btn' + (S.part === p ? ' on' : '') + '" data-act="part" data-part="' + esc(p) + '">' + (i + 1) + '. ' + esc(p) + '</button>').join('') + '</div>';
  if (S.part === 'Convocatoria') h += partSquad(d);
  else if (S.part === 'Acta') h += partReport(d);
  else h += partList(d);
  return h;
}
/**
 * Postponed or cancelled: why, a new date for a match, taking it back, and the message for the group.
 * Whoever cannot change the day still sees why and can pass it on.
 */
function offPart(d, edit) {
  if (!d.off) return '';
  const postponed = d.off === POSTPONED;
  return '<div class="card mt off-card"><div class="bold warn">' + esc(offLabel(d)) + '</div><div class="row">'
    + (edit && postponed ? '<button class="btn primary" data-act="newDate" data-day="' + esc(d.id) + '">Poner nueva fecha</button>' : '')
    + (edit ? '<button class="btn" data-act="dayOn" data-day="' + esc(d.id) + '">' + (postponed ? 'Quitar aplazamiento' : 'Quitar suspensión') + '</button>' : '')
    + '<button class="btn" data-act="offWhatsApp" data-day="' + esc(d.id) + '">📣 Avisar por WhatsApp</button></div></div>';
}
/** Why a day is off: one tap on the reason, then "Aplazar" or "Suspender". */
function offDialog(dayId) {
  const d = findDay(dayId);
  if (!d || d.off || !can.editDays()) return;
  let reason = '';
  const draw = () => '<form method="dialog"><div class="title">' + (d.match ? 'Aplazar partido' : 'Suspender entreno') + '</div>'
    + '<p class="small">' + (d.match ? 'Queda aplazado hasta que pongas la nueva fecha. No cuenta para asistencia, multas ni MVP.' : 'No se hace: no cuenta para asistencia ni multas.') + '</p>'
    + '<label>Motivo</label>' + chipChoice('reason', OFF_REASONS.map(r => [r, r]), reason)
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok"' + (reason ? '' : ' disabled') + '>' + (d.match ? 'Aplazar' : 'Suspender') + '</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      reason = b.dataset.val;
      dlg.innerHTML = draw();
    };
  }, () => {
    if (!reason) return false;
    send({ t: d.match ? 'Partidos' : 'Entrenamientos', op: 'e', v: { 'ID': dayId, 'Estado': d.match ? POSTPONED : CANCELLED, 'Motivo': reason } });
    S.headOpen = null;
    render();
  });
}
/** On again: a match keeps the state it had (played or not), a training has none. */
function dayOn(dayId) {
  const d = findDay(dayId);
  if (!d || !d.off || !can.editDays()) return;
  send({ t: d.match ? 'Partidos' : 'Entrenamientos', op: 'e', v: { 'ID': dayId, 'Estado': d.match && d.gf !== '' && d.ga !== '' ? 'Jugado' : '', 'Motivo': '' } });
}
/** "Poner nueva fecha": the date alone, then the same steps as changing it in the day's settings. */
function newDateDialog(dayId) {
  const d = findDay(dayId);
  if (!d || !can.editDays()) return;
  openDialog('<form method="dialog"><div class="title">Nueva fecha</div><div class="small">' + esc(dayTitle(d)) + '</div>'
    + '<label for="ndNew">Fecha</label><input id="ndNew" type="date" value="' + esc(d.date) + '">'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>', null, () => {
    const date = $('ndNew').value;
    if (!date) { toast('Elige la fecha'); return false; }
    if (date === d.date) return;
    // The question about the answers may come next, in this same dialog.
    closeDialog();
    changeDate(dayId, date);
    return false;
  });
}
/**
 * A new date for any day. If someone already said whether they come, ask whether their answers go
 * (only the directiva may clear other people's answers in the sheet). A day that was off is on again.
 * Afterwards the group can be told.
 */
function changeDate(dayId, date) {
  const d = findDay(dayId);
  if (!d || !date || date === d.date) return;
  const n = rows('Avisos').filter(a => a['Día ID'] === dayId).length;
  if (n > 0 && can.clearAnswers()) {
    // The date field goes back to the stored date until the answer: "Cancelar" changes nothing.
    render();
    openDialog('<form method="dialog"><div class="title">Nueva fecha: ' + esc(shortDay(date)) + '</div>'
      + '<p>' + (n === 1 ? '1 persona ya había' : n + ' personas ya habían') + ' dicho si iba. ¿Borro las respuestas para que vuelvan a contestar con la nueva fecha?</p>'
      + '<div class="row end"><button type="button" class="btn" data-keep="1">Mantenerlas</button><button class="btn primary" value="ok">Borrar respuestas</button></div></form>', dlg => {
      dlg.onclick = e => {
        if (!e.target.closest('[data-keep]')) return;
        closeDialog();
        reschedule(dayId, date, false);
      };
    }, () => { reschedule(dayId, date, true); });
    return;
  }
  reschedule(dayId, date, false);
}
function reschedule(dayId, date, clearAnswers) {
  const d = findDay(dayId);
  if (!d) return;
  const v = { 'ID': dayId, 'Fecha': date };
  // "n days before" follows the new date; a stamp set some other way stays as it is.
  const choice = deadlineChoice(d);
  if (choice && choice !== 'raw') v['Responder antes'] = deadlineFor(date, Number(choice));
  if (d.off) { v['Estado'] = d.match && d.gf !== '' && d.ga !== '' ? 'Jugado' : ''; v['Motivo'] = ''; }
  S.announce = { day: dayId, text: movedMessage(Object.assign({}, d, { date: date }), clearAnswers) };
  send([{ t: d.match ? 'Partidos' : 'Entrenamientos', op: 'e', v: v }]
    .concat(clearAnswers ? rows('Avisos').filter(a => a['Día ID'] === dayId).map(a => ({ t: 'Avisos', op: 'd', v: { 'Día ID': dayId, 'Jugador ID': a['Jugador ID'] } })) : []));
}

/** "Quién viene ✅3 ⏰1 ❌1 ❔4": opens the names. */
function whoButton(d) {
  const w = whoCounts(d);
  return '<button class="btn grow who" data-act="who" data-day="' + esc(d.id) + '">Quién viene ✅' + w.going.length + ' ⏰' + w.late.length + ' ❌' + w.cant.length + ' ❔' + w.silent.length + '</button>';
}

/**
 * Who comes, from the notices: for those who see everybody's (directiva, coach, list). Coaches go
 * apart, they are not players. Once the deadline passes, those still silent show as a warning.
 */
function whoComes(d) {
  if (!['Directiva', 'Entrenador', 'Lista'].includes(ROLE())) return '';
  const w = whoCounts(d);
  const name = p => p['Nombre'] + (isKeeper(p) ? ' (portero)' : '');
  const overdue = deadlinePassed(d) && w.silent.length > 0;
  const group = (title, list, text, cls, note) => '<div class="small' + (cls ? ' ' + cls : '') + '"><span class="bold">' + esc(title + ' (' + list.length + ')' + (note || '')) + '</span>'
    + (list.length ? ': ' + esc(list.map(text).join(', ')) : '') + '</div>';
  let h = '<div class="title">Quién viene</div><div class="small">' + esc(dayTitle(d) + ' · ' + fdate(d.date)) + '</div>';
  if (d.deadline) h += '<div class="small">Plazo para responder: ' + esc(deadlineText(d.deadline)) + '</div>';
  if (w.who.length) {
    h += group('✅ Asistirán', w.going, name)
      + group('⏰ Llegan tarde', w.late, p => { const n = noticeOf(d.id, p['ID']); return name(p) + (n['Hora llegada'] ? ' ' + n['Hora llegada'] : ''); })
      + group('❌ No pueden', w.cant, p => { const n = noticeOf(d.id, p['ID']); return name(p) + (n['Motivo'] ? ' · ' + n['Motivo'] : ''); })
      + group('❔ Sin responder', w.silent, name, overdue ? 'bold warn' : '', overdue ? ' (plazo vencido)' : '');
  } else h += '<div class="small">' + (d.match ? 'Aún no hay convocados.' : 'No hay jugadores.') + '</div>';
  coaches().forEach(c => {
    const n = noticeOf(d.id, c['ID']);
    const state = !n ? 'sin responder' : n['Tipo'] === 'Asistiré' ? 'asistirá' : n['Tipo'] === 'No puedo ir' ? 'no puede' : 'llega tarde' + (n['Hora llegada'] ? ' (' + n['Hora llegada'] + ')' : '');
    h += '<div class="small mt">🧢 Entrenador: ' + esc(c['Nombre'] + ' · ' + state) + '</div>';
  });
  return h;
}
function whoDialog(dayId) {
  const d = findDay(dayId);
  if (d) openDialog('<form method="dialog">' + whoComes(d) + '<div class="row end"><button type="button" class="btn" value="cancel">Cerrar</button></div></form>');
}

// ---------- 1. call-up ----------
function partSquad(d) {
  const sq = squad(d);
  const editing = can.callUp();
  const size = calledUp(d).length;
  let h = '<h2>Convocados: ' + size + ' de ' + MAX_CALLED_UP + ' como máximo</h2>';
  const answered = answeredNotCalled(d);
  if (editing && answered.length) h += '<button class="btn primary wide" data-act="callUpAnswered" data-day="' + esc(d.id) + '">Convocar a los que van (' + answered.length + ')</button>';
  const kits = matchKits();
  if (kits.length) {
    h += '<div class="chips"><span class="small bold">Equipación:</span>' + kits.map(k => '<button class="btn' + (d.kit === k.name ? ' on' : '') + '" data-act="kit" data-kit="' + esc(k.name) + '" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '>' + esc(k.name) + '</button>').join('') + '</div>';
    const chosen = kits.find(k => k.name === d.kit);
    const keepers = squadPlayers().filter(p => sq.includes(p['ID']) && isKeeper(p)).map(p => { const o = kitOptions(keeperKits(p['ID'])); return o ? p['Nombre'] + ': ' + o : ''; }).filter(Boolean).join(' · ');
    h += '<p class="small">' + esc([chosen ? chosen.description : '', keepers ? 'porteros, siempre con sus dos: ' + keepers : ''].filter(Boolean).join(' · ') || 'Elige la equipación del partido') + '</p>';
  }
  const full = size >= MAX_CALLED_UP;
  const canNotice = can.mark() && can.fine();
  squadPlayers().forEach(p => {
    const on = sq.includes(p['ID']);
    const n = noticeOf(d.id, p['ID']);
    h += '<div class="player row between nowrap"><div class="grow"><div class="name">' + esc(p['Nombre']) + '</div>' + (n ? '<div class="small notice">' + esc(noticeText(n, markOf(d.id, p['ID']))) + '</div>' : '') + '</div>'
      + '<button class="btn' + (on ? ' on' : '') + '" data-act="callUp" data-pid="' + esc(p['ID']) + '" data-day="' + esc(d.id) + '"' + (editing && (on || !full) ? '' : ' disabled') + '>' + (on ? 'Convocado' : 'No convocado') + '</button>'
      + (canNotice ? '<button class="box more" data-act="markMenu" data-pid="' + esc(p['ID']) + '" data-day="' + esc(d.id) + '" aria-label="Más">⋯</button>' : '') + '</div>';
  });
  // One step: confirming is what the players need, and the group needs the message.
  if (!d.confirmed) {
    h += '<div class="row mt"><button class="btn primary wide" data-act="confirmSend" data-day="' + esc(d.id) + '"' + (size ? '' : ' disabled') + '>' + (editing ? 'Confirmar y enviar' : 'Enviar por WhatsApp') + '</button></div>';
  } else {
    h += '<div class="row mt nowrap"><button class="btn grow" data-act="confirmSquad" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '>✓ Confirmada</button>'
      + '<button class="btn primary grow" data-act="squadWhatsApp" data-day="' + esc(d.id) + '">Enviar otra vez</button></div>';
  }
  return h;
}
/** Those not called up yet who said they come (or come late), in squad order; never the coaches. */
function answeredNotCalled(d) {
  const sq = squad(d);
  return squadPlayers().map(p => p['ID']).filter(pid => { const n = noticeOf(d.id, pid); return !sq.includes(pid) && n && (n['Tipo'] === 'Asistiré' || n['Tipo'] === 'Llego tarde'); });
}
/** One tap calls them all, up to the most a match takes. */
function callUpAnswered(dayId) {
  const d = findDay(dayId);
  if (!d || !d.match || !can.callUp()) return;
  const add = answeredNotCalled(d).slice(0, Math.max(MAX_CALLED_UP - calledUp(d).length, 0));
  if (!add.length) { toast('Máximo ' + MAX_CALLED_UP + ' convocados'); return; }
  send(add.map(pid => ({ t: 'Convocatorias', op: 'u', v: { 'Partido ID': dayId, 'Jugador ID': pid, 'Temporada': d.season || activeSeason() } })));
}
/** Confirms the squad (whoever may) and sends it to the group in the same tap. */
function confirmAndSend(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  if (can.callUp() && !d.confirmed) send({ t: 'Partidos', op: 'e', v: { 'ID': dayId, 'Convocatoria confirmada': 'true' } });
  shareText(squadText(findDay(dayId)));
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
  const sq = squadPlayers().filter(p => squad(d).includes(p['ID']))
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
  if (marking && left) {
    // "Asistiré" to OK, "No puedo ir" to No puede; the rest stays to be checked.
    const told = fromNotices(d).length;
    h += '<div class="row between"><span class="small">' + left + ' sin marcar</span><span class="row tight">'
      + (told ? '<button class="btn sm" data-act="markNotices" data-day="' + esc(d.id) + '">Según avisos (' + told + ')</button>' : '')
      + '<button class="btn sm" data-act="markRest" data-day="' + esc(d.id) + '">OK al resto</button></span></div>';
  }
  squadPlayers().filter(p => who.includes(p['ID'])).forEach(p => {
    const pid = p['ID'];
    const m = markOf(d.id, pid);
    const n = noticeOf(d.id, pid);
    const tags = [n ? noticeText(n, m) : '', m && isTrue(m['Equipación incorrecta']) ? '👕 equipación mal' : '', m && m['Estado'] === 'Tarde' && isTrue(m['Justificada']) ? 'retraso justificado' : ''].filter(Boolean);
    h += '<div class="player"><div class="row between nowrap"><div class="grow"><div class="name">' + esc(p['Nombre']) + '</div>' + (tags.length ? '<div class="small notice">' + esc(tags.join(' · ')) + '</div>' : '') + '</div>';
    // The three marks of every day in one row; the rarer ones go in the menu.
    MARKS.forEach(x => {
      h += '<button class="box ' + x[2] + (m && m['Estado'] === x[0] ? ' on' : '') + '" title="' + esc(x[0]) + '" aria-label="' + esc(x[0]) + '" data-act="mark" data-state="' + esc(x[0]) + '" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking ? '' : ' disabled') + '>' + x[1] + '</button>';
    });
    if (marking) h += '<button class="box more" data-act="markMenu" data-list="1" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '" aria-label="Más">⋯</button>';
    h += '</div>';
    if (m && m['Estado'] === 'No puede') {
      h += '<div class="row"><span class="small bold">No puede ir</span><select data-chg="absReason" data-pid="' + esc(pid) + '" data-day="' + esc(d.id) + '"' + (marking ? '' : ' disabled') + '><option value="">Motivo</option>'
        + REASONS.map(r => '<option' + (m['Motivo'] === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>';
    }
    h += '</div>';
  });
  if (marking && can.fine()) {
    const toFine = finesToApply(d);
    h += '<div class="row mt"><button class="btn primary wide" data-act="applyFines" data-day="' + esc(d.id) + '"' + (toFine.length ? '' : ' disabled') + '>'
      + (toFine.length ? 'Poner ' + countOf(toFine.length, 'multa', 'multas') + ' · ' + money(toFine.reduce((s, x) => s + x.rule.cents, 0)) : 'Nada que multar') + '</button></div>';
  }
  return h;
}
/** [state, symbol, class] of the marks in sight; "No puede" is in the menu. */
const MARKS = [['OK', '✓', 'ok'], ['Tarde', '⏰', 'late'], ['Falta', '✗', 'miss']];
/** The rarer things of a player's row: could not come, kit, excused lateness, clearing, his notice. */
function markMenu(dayId, pid, inList) {
  const d = findDay(dayId);
  if (!d) return;
  const m = markOf(dayId, pid);
  const n = noticeOf(dayId, pid);
  const tick = (on, text) => (on ? '✓ ' : '') + text;
  const opts = [];
  if (inList && can.mark()) {
    opts.push(['cant', tick(m && m['Estado'] === 'No puede', 'No puede ir')]);
    if (came(m)) opts.push(['kit', tick(isTrue(m['Equipación incorrecta']), 'Equipación incorrecta')]);
    if (m && m['Estado'] === 'Tarde') opts.push(['excuse', tick(isTrue(m['Justificada']), 'Retraso justificado')]);
    if (m) opts.push(['clear', 'Quitar marca']);
  }
  if (can.mark() && can.fine()) opts.push(['notice', n ? 'Cambiar su aviso' : 'Apuntar su aviso']);
  if (!opts.length) return;
  openDialog('<form method="dialog"><div class="title">' + esc(playerName(pid)) + '</div><div class="menu">'
    + opts.map(o => '<button type="button" class="menu-item" data-mm="' + o[0] + '">' + esc(o[1]) + '</button>').join('')
    + '</div><div class="row end"><button type="button" class="btn" value="cancel">Cerrar</button></div></form>', dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-mm]');
      if (!b) return;
      closeDialog();
      const a = b.dataset.mm;
      if (a === 'cant') mark(dayId, pid, 'No puede');
      else if (a === 'kit') toggleKitIssue(dayId, pid);
      else if (a === 'excuse') toggleExcuse(dayId, pid);
      else if (a === 'clear') { const cur = markOf(dayId, pid); if (cur) send({ t: 'Asistencia', op: 'd', v: { 'ID': cur['ID'] } }); }
      else noticeForDialog(dayId, pid);
    };
  });
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
/** Those still unmarked who said "Asistiré" or "No puedo ir". */
function fromNotices(d) {
  return unmarked(d).filter(pid => { const n = noticeOf(d.id, pid); return n && (n['Tipo'] === 'Asistiré' || n['Tipo'] === 'No puedo ir'); });
}
/** Marks only what the players said; everyone else stays unmarked, to be checked one by one. */
function markNotices(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  send(fromNotices(d).map(pid => {
    const n = noticeOf(dayId, pid);
    const cant = n['Tipo'] === 'No puedo ir';
    return { t: 'Asistencia', op: 'u', v: { 'ID': dayId + '_' + pid, 'Fecha': d.date, 'Sesión': d.session, 'Día ID': dayId, 'Jugador ID': pid,
      'Estado': cant ? 'No puede' : 'OK', 'Motivo': cant && REASONS.includes(n['Motivo']) ? n['Motivo'] : '', 'Justificada': 'false', 'Equipación incorrecta': 'false',
      'Temporada': d.season || activeSeason() } };
  }));
}

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
  if (!m || m['Estado'] !== 'No puede' || m['Motivo'] === reason) return;
  send({ t: 'Asistencia', op: 'e', v: { 'ID': m['ID'], 'Motivo': reason } });
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
  const sq = squadPlayers().filter(p => squad(d).includes(p['ID']));
  if (!sq.length) return '<p class="small">Primero hace falta la convocatoria: el acta solo puede nombrar a los convocados.</p>';
  const editing = can.report();
  const events = rows('Acta').filter(x => x['Partido ID'] === d.id);
  // The result and the goals first: that is what is filled in after every match.
  let h = '<h2>Resultado</h2><div class="grid2"><div><label for="gf">' + esc(TEAM) + '</label><input id="gf" inputmode="numeric" maxlength="2" value="' + esc(d.gf) + '" data-chg="result" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '></div>'
    + '<div><label for="ga">' + esc(d.title || 'Rival') + '</label><input id="ga" inputmode="numeric" maxlength="2" value="' + esc(d.ga) + '" data-chg="result" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '></div></div>';
  if (editing) h += '<div class="row mt"><button class="btn" data-act="addEvent" data-kind="goal" data-day="' + esc(d.id) + '">+ Gol</button><button class="btn" data-act="addEvent" data-kind="card" data-day="' + esc(d.id) + '">+ Tarjeta</button></div>';
  const goals = events.filter(e => e['Tipo'] === 'Gol').sort((a, b) => (Number(a['Minuto']) || 999) - (Number(b['Minuto']) || 999));
  const cards = events.filter(e => CARDS.includes(e['Tipo']));
  const row = (text, id, extra) => '<div class="line"><span>' + esc(text) + '</span>' + (editing ? '<span class="right">' + (extra || '') + '<button class="btn sm danger" data-act="removeEvent" data-id="' + esc(id) + '">Quitar</button></span>' : '') + '</div>';
  h += '<h2>Goles (' + goals.length + ')</h2>' + (goals.length ? '' : '<p class="small">Ninguno apuntado.</p>');
  goals.forEach(e => { h += row([playerName(e['Jugador ID']), e['Minuto'] ? 'min. ' + e['Minuto'] : '', e['Asistencia ID'] ? 'asist. ' + playerName(e['Asistencia ID']) : ''].filter(Boolean).join(' · '), e['ID']); });
  h += '<h2>Tarjetas (' + cards.length + ')</h2>' + (cards.length ? '' : '<p class="small">Ninguna.</p>');
  cards.forEach(e => {
    // Blank (older cards) or "Sí" carries a fine; "No" = part of the game.
    const fined = String(e['Multa'] || '').trim() !== 'No';
    const flip = '<button class="btn sm" data-act="cardFine" data-id="' + esc(e['ID']) + '" data-val="' + (fined ? 'No' : 'Sí') + '">' + (fined ? 'Quitar multa' : 'Poner multa') + '</button>';
    h += row([e['Tipo'], playerName(e['Jugador ID']), e['Minuto'] ? 'min. ' + e['Minuto'] : '', fined ? 'con multa' : 'sin multa'].filter(Boolean).join(' · '), e['ID'], flip);
  });
  if (cards.length) h += '<p class="small">Las tarjetas con multa la crean en la hoja al sincronizar (la doble amarilla, sin importe hasta que lo ponga la directiva). Las de lance del juego no se pagan.</p>';
  // Who was in goal in each part, and on whom each rival goal went: the goalkeepers' numbers.
  h += '<h2>Porteros</h2>';
  ['1', '2'].forEach(part => {
    const ks = events.filter(e => e['Tipo'] === 'Portero' && String(e['Parte']) === part);
    if (!ks.length) h += '<p class="small">' + part + 'ª parte: sin portero</p>';
    ks.forEach(e => { h += row(part + 'ª parte · ' + playerName(e['Jugador ID']), e['ID']); });
  });
  const against = events.filter(e => e['Tipo'] === 'Gol en contra')
    .sort((a, b) => String(a['Parte']).localeCompare(String(b['Parte'])) || (Number(a['Minuto']) || 999) - (Number(b['Minuto']) || 999));
  h += '<h2>Goles en contra (' + against.length + ')</h2>';
  against.forEach(e => { h += row([playerName(e['Jugador ID']), e['Parte'] ? e['Parte'] + 'ª parte' : '', e['Minuto'] ? 'min. ' + e['Minuto'] : ''].filter(Boolean).join(' · '), e['ID']); });
  const missing = Math.max((parseInt(d.ga, 10) || 0) - against.length, 0);
  if (missing) h += '<p class="small bold warn">' + (missing === 1 ? 'Falta 1 gol en contra' : 'Faltan ' + missing + ' goles en contra') + ' por poner a un portero.</p>';
  if (editing) h += '<div class="row mt"><button class="btn" data-act="addKeeper" data-kind="keeper" data-day="' + esc(d.id) + '">+ Portero</button><button class="btn" data-act="addKeeper" data-kind="against" data-day="' + esc(d.id) + '">+ Gol en contra</button></div>';
  const mvp = (events.find(e => e['Tipo'] === 'MVP') || {})['Jugador ID'];
  const votes = rows('Votos MVP').filter(v => v['Partido ID'] === d.id);
  if (ROLE() === 'Directiva' && (votes.length || voteOpen(d))) {
    const count = {};
    votes.forEach(v => { count[v['Votado ID']] = (count[v['Votado ID']] || 0) + 1; });
    // The three most voted, then who voted whom: the votes guide, the directiva picks the MVP.
    const top = Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b)).slice(0, 3);
    h += '<h2>Votación del MVP (' + votes.length + ')</h2><p class="small">' + (voteOpen(d)
      ? 'Abierta hasta el ' + esc(voteUntil(d)) + '. Los votos orientan: el MVP lo eliges tú abajo.'
      : 'Cerrada. Los votos orientan: el MVP lo eliges tú abajo.') + '</p>'
      + top.map((id, i) => '<div class="bold">' + (i + 1) + '. ' + esc(playerName(id)) + ' · ' + count[id] + (count[id] === 1 ? ' voto' : ' votos') + '</div>').join('')
      + votes.map(v => '<div class="small">' + esc(playerName(v['Jugador ID']) + ' → ' + playerName(v['Votado ID'])) + '</div>').join('');
  }
  h += '<h2>Mejor jugador (MVP)</h2><div class="chips">' + sq.map(p => '<button class="btn' + (mvp === p['ID'] ? ' on' : '') + '" data-act="mvp" data-pid="' + esc(p['ID']) + '" data-day="' + esc(d.id) + '"' + (editing ? '' : ' disabled') + '>' + esc(p['Nombre']) + '</button>').join('') + '</div>';
  // Who led and the coach's notes go last: written once, rarely changed.
  return h + '<hr>' + benchPart(d, sq) + coachNotePart(d);
}

// ---------- bench: who led the match ("Dirigió", several allowed), coaches on the bench ("Banquillo"), the coach's private note ----------
const actaOf = (dayId, type) => rows('Acta').filter(x => x['Partido ID'] === dayId && x['Tipo'] === type);
/** "Dirigió: Antonio y Luis" / "Dirigieron: ...", '' while nobody is written down. */
function ledText(dayId) {
  const names = actaOf(dayId, 'Dirigió').map(x => playerName(x['Jugador ID']));
  return names.length ? (names.length === 1 ? 'Dirigió: ' : 'Dirigieron: ') + andList(names) : '';
}
function benchPart(d, sq) {
  const editing = can.report();
  const cs = coaches();
  const led = actaOf(d.id, 'Dirigió').map(x => x['Jugador ID']);
  const onBench = actaOf(d.id, 'Banquillo').map(x => x['Jugador ID']);
  let h = '<h2>Banquillo</h2>';
  // A coach who cannot come leaves the match with nobody in charge until someone is chosen.
  if (!led.length) {
    cs.filter(c => { const n = noticeOf(d.id, c['ID']); return n && n['Tipo'] === 'No puedo ir'; })
      .forEach(c => { h += '<p class="small bold warn">' + esc(c['Nombre'] + ' no puede ir: elige quién dirige el partido') + '</p>'; });
  }
  if (!editing) {
    const benchNames = onBench.map(playerName);
    return h + '<p class="small">' + esc([ledText(d.id) || 'Sin apuntar quién dirigió', benchNames.length ? 'En el banquillo: ' + andList(benchNames) : ''].filter(Boolean).join(' · ')) + '</p>';
  }
  const box = (chg, p, on) => '<label class="check mt"><input type="checkbox" data-chg="' + chg + '" data-day="' + esc(d.id) + '" data-pid="' + esc(p['ID']) + '"' + (on ? ' checked' : '') + '>'
    + '<span>' + esc(p['Nombre']) + (isCoach(p) ? ' <span class="small">🧢 Entrenador</span>' : '') + '</span></label>';
  // Someone written down before who is no longer a candidate still shows, so he can be taken off.
  const known = cs.concat(sq).map(p => p['ID']);
  const gone = led.filter(id => !known.includes(id)).map(id => ({ 'ID': id, 'Nombre': playerName(id) }));
  h += '<div class="bold">Dirigió</div>' + cs.concat(sq, gone).map(p => box('led', p, led.includes(p['ID']))).join('');
  if (cs.length) h += '<div class="bold mt">Entrenadores en el banquillo</div>' + cs.map(p => box('bench', p, onBench.includes(p['ID']))).join('');
  return h;
}
/** Ticking adds the row, unticking removes it. */
function toggleActa(dayId, type, pid) {
  const d = findDay(dayId);
  if (!d || !can.report()) return;
  const cur = actaOf(dayId, type).filter(x => x['Jugador ID'] === pid);
  if (cur.length) { send(cur.map(x => ({ t: 'Acta', op: 'd', v: { 'ID': x['ID'] } }))); return; }
  send({ t: 'Acta', op: 'u', v: { 'ID': uid(), 'Partido ID': dayId, 'Tipo': type, 'Jugador ID': pid, 'Minuto': '', 'Asistencia ID': '', 'Temporada': d.season || activeSeason() } });
}
/** The coach's own note on the match: only the coach and the directiva see it (the sheet strips it for the rest too). */
const seesCoachNote = () => ['Directiva', 'Entrenador'].includes(ROLE());
const coachNote = dayId => (seesCoachNote() ? actaOf(dayId, 'Nota entrenador')[0] : null);
function coachNotePart(d) {
  if (!seesCoachNote()) return '';
  const n = coachNote(d.id);
  const text = n ? n['Notas'] || '' : '';
  if (!can.report()) return text ? '<h2>Notas del entrenador</h2><p class="small">' + esc(text) + '</p>' : '';
  // Saved a moment after typing stops (main.js), like the rest of the report: no button.
  return '<label for="coachNote">Notas del entrenador (solo las ven el entrenador y la directiva)</label><textarea id="coachNote" rows="3" maxlength="1000" data-day="' + esc(d.id) + '">' + esc(text) + '</textarea>'
    + '<div class="small">Se guardan solas al dejar de escribir.</div>';
}
/** One note per match; saving it empty removes it. */
function saveCoachNote(dayId, value) {
  const d = findDay(dayId);
  if (!d || !can.report()) return;
  const text = String(value || '').trim();
  const cur = coachNote(dayId);
  if ((cur ? cur['Notas'] || '' : '') === text) return;
  if (!text) { send({ t: 'Acta', op: 'd', v: { 'ID': cur['ID'] } }); toast('Notas borradas'); return; }
  send(cur ? { t: 'Acta', op: 'e', v: { 'ID': cur['ID'], 'Notas': text } }
    : { t: 'Acta', op: 'u', v: { 'ID': uid(), 'Partido ID': dayId, 'Tipo': 'Nota entrenador', 'Jugador ID': '', 'Minuto': '', 'Asistencia ID': '', 'Notas': text, 'Temporada': d.season || activeSeason() } });
  toast('Notas guardadas');
}

/**
 * A coach's matches of the season (chosen like a goalkeeper's): those with his "Dirigió" and both
 * scores in. The streak is the run of the same outcome counting back from the latest match.
 */
function coachStats(pid) {
  const ds = [...new Set(rows('Acta').filter(x => x['Tipo'] === 'Dirigió' && x['Jugador ID'] === pid).map(x => x['Partido ID']))]
    .map(findDay).filter(d => d && d.match && inSeason(d.row) && d.gf !== '' && d.ga !== '' && !isNaN(Number(d.gf)) && !isNaN(Number(d.ga)))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.time).localeCompare(String(a.time)));
  const out = ds.map(d => (Number(d.gf) > Number(d.ga) ? 'V' : Number(d.gf) < Number(d.ga) ? 'D' : 'E'));
  let streak = 0;
  while (streak < out.length && out[streak] === out[0]) streak++;
  const sum = k => ds.reduce((s, d) => s + Number(d[k]), 0);
  return { matches: ds.length, won: out.filter(x => x === 'V').length, drawn: out.filter(x => x === 'E').length, lost: out.filter(x => x === 'D').length,
    gf: sum('gf'), ga: sum('ga'), streak: streak, last: out[0] || '' };
}

function setResult(dayId) {
  const gf = $('gf').value.replace(/\D/g, '').slice(0, 2), ga = $('ga').value.replace(/\D/g, '').slice(0, 2);
  const d = findDay(dayId);
  const played = gf !== '' || ga !== '';
  // A postponed match stays postponed until its new date.
  send({ t: 'Partidos', op: 'e', v: { 'ID': dayId, 'Goles a favor': gf, 'Goles en contra': ga, 'Estado': d && d.off ? d.off : played ? 'Jugado' : (d && d.status !== 'Jugado' ? d.status : '') } });
}

function eventDialog(dayId, kind) {
  const d = findDay(dayId);
  const sq = squadPlayers().filter(p => squad(d).includes(p['ID']));
  const isCard = kind === 'card';
  let type = isCard ? CARDS[0] : 'Gol', pid = '', assist = '', fine = '';
  const names = list => list.map(p => [p['ID'], p['Nombre']]);
  const draw = () => '<form method="dialog"><div class="title">' + (isCard ? 'Tarjeta' : 'Gol') + '</div>'
    + (isCard ? '<label>Tarjeta</label>' + chipChoice('type', CARDS.map(c => [c, c]), type) : '')
    + '<label>' + (isCard ? 'Jugador' : 'Quién marcó') + '</label>' + chipChoice('pid', names(sq), pid)
    + (!isCard && pid ? '<label>Asistencia (opcional)</label>' + chipChoice('assist', names(sq.filter(p => p['ID'] !== pid)), assist) : '')
    + (isCard ? '<label>¿Paga multa?</label>' + chipChoice('fine', [['Sí', 'Sí: fue intencionada, la paga'], ['No', 'No: lance del juego']], fine) : '')
    + '<label for="minute">Minuto (opcional)</label><input id="minute" inputmode="numeric" maxlength="3">'
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok" id="evOk"' + (pid && (!isCard || fine) ? '' : ' disabled') + '>Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const v = b.dataset.val;
      if (b.dataset.k === 'pid') { pid = v; if (assist === pid) assist = ''; }
      // Tapping the chosen one again leaves the goal without assist.
      else if (b.dataset.k === 'assist') assist = assist === v ? '' : v;
      else if (b.dataset.k === 'type') type = v;
      else fine = v;
      const minute = $('minute').value;
      dlg.innerHTML = draw();
      $('minute').value = minute;
    };
  }, () => {
    send({ t: 'Acta', op: 'u', v: { 'ID': uid(), 'Partido ID': dayId, 'Tipo': type, 'Jugador ID': pid, 'Minuto': $('minute').value.replace(/\D/g, '').slice(0, 3),
      'Asistencia ID': assist !== pid ? assist : '', 'Multa': isCard ? fine : '', 'Temporada': d.season || activeSeason() } });
  });
}
/** Choose one by tapping its name: every option in sight, one tap instead of a drop-down. */
function chipChoice(key, options, selected) {
  return '<div class="chips">' + options.map(o => '<button type="button" class="btn' + (selected === o[0] ? ' on' : '') + '" data-k="' + key + '" data-val="' + esc(o[0]) + '">' + esc(o[1]) + '</button>').join('') + '</div>';
}

/** A goalkeeper in a part (or both), or a rival goal on the keeper who was in goal then. */
function keeperDialog(dayId, kind) {
  const d = findDay(dayId);
  const sq = squadPlayers().filter(p => squad(d).includes(p['ID'])).sort((a, b) => isKeeper(b) - isKeeper(a));
  const inGoal = part => (rows('Acta').find(x => x['Partido ID'] === dayId && x['Tipo'] === 'Portero' && String(x['Parte']) === part) || {})['Jugador ID'] || '';
  const parts = kind === 'keeper' ? [['1', '1ª parte'], ['2', '2ª parte'], ['12', 'Las dos partes']] : [['1', '1ª parte'], ['2', '2ª parte']];
  let part = '1', pid = kind === 'against' ? inGoal('1') : '';
  const draw = () => '<form method="dialog"><div class="title">' + (kind === 'keeper' ? 'Portero' : 'Gol en contra') + '</div>'
    + (kind === 'keeper' ? '<label>Portero</label>' + chipChoice('pid', sq.map(p => [p['ID'], p['Nombre']]), pid) + '<label>Parte</label>' + chipChoice('part', parts, part)
      : '<label>Parte</label>' + chipChoice('part', parts, part) + '<label>Portero</label>' + chipChoice('pid', sq.map(p => [p['ID'], p['Nombre']]), pid))
    + (kind === 'keeper' ? '<p class="small">Si se cambia por lesión, añade también al que entró.</p>' : '<label for="minute">Minuto (opcional)</label><input id="minute" inputmode="numeric" maxlength="3">')
    + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok"' + (pid ? '' : ' disabled') + '>Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      if (b.dataset.k === 'part') { part = b.dataset.val; if (kind === 'against' && inGoal(part)) pid = inGoal(part); }
      else pid = b.dataset.val;
      const minute = $('minute') ? $('minute').value : '';
      dlg.innerHTML = draw();
      if ($('minute')) $('minute').value = minute;
    };
  }, () => {
    const base = { 'Partido ID': dayId, 'Jugador ID': pid, 'Asistencia ID': '', 'Multa': '', 'Temporada': d.season || activeSeason() };
    if (kind === 'against') {
      send({ t: 'Acta', op: 'u', v: Object.assign({ 'ID': uid(), 'Tipo': 'Gol en contra', 'Parte': part, 'Minuto': $('minute').value.replace(/\D/g, '').slice(0, 3) }, base) });
      return;
    }
    // Each part keeps the same keeper once.
    const ops = part.split('').filter(p => !rows('Acta').some(x => x['Partido ID'] === dayId && x['Tipo'] === 'Portero' && String(x['Parte']) === p && x['Jugador ID'] === pid))
      .map(p => ({ t: 'Acta', op: 'u', v: Object.assign({ 'ID': uid(), 'Tipo': 'Portero', 'Parte': p, 'Minuto': '' }, base) }));
    if (ops.length) send(ops);
  });
}

/**
 * A goalkeeper's season: parts played, goals let in and parts with none. A part is clean only once
 * the match has its result and every goal against is on a goalkeeper. A clean match is one played
 * whole without the rival scoring.
 */
function keeperStats(pid) {
  const ev = rows('Acta').filter(x => { const d = findDay(x['Partido ID']); return d && inSeason(d.row); });
  let parts = 0, clean = 0, cleanMatches = 0;
  const days = [...new Set(ev.filter(x => x['Tipo'] === 'Portero' && x['Jugador ID'] === pid).map(x => x['Partido ID']))];
  days.forEach(id => {
    const mine = [...new Set(ev.filter(x => x['Partido ID'] === id && x['Tipo'] === 'Portero' && x['Jugador ID'] === pid).map(x => String(x['Parte'])))];
    parts += mine.length;
    const d = findDay(id);
    const result = parseInt(d.ga, 10);
    const against = ev.filter(x => x['Partido ID'] === id && x['Tipo'] === 'Gol en contra');
    if (!isNaN(result) && against.length >= result) clean += mine.filter(p => !against.some(x => String(x['Parte']) === p)).length;
    if (result === 0 && mine.includes('1') && mine.includes('2')) cleanMatches++;
  });
  return { parts: parts, conceded: ev.filter(x => x['Tipo'] === 'Gol en contra' && x['Jugador ID'] === pid).length, clean: clean, cleanMatches: cleanMatches };
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
  // "n days before" follows the new date; a stamp set some other way stays as it is.
  const choice = deadlineChoice(d);
  if (field === 'date' && choice && choice !== 'raw') v['Responder antes'] = deadlineFor(value, Number(choice));
  send({ t: t, op: 'e', v: v });
}
function setDeadline(dayId, choice) {
  const d = findDay(dayId);
  if (!d || choice === 'raw') return;
  send({ t: d.match ? 'Partidos' : 'Entrenamientos', op: 'e', v: { 'ID': dayId, 'Responder antes': choice ? deadlineFor(d.date, Number(choice)) : '' } });
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
      { t: 'Partidos', op: 'u', v: { 'ID': dayId, 'Fecha': d.date, 'Tipo': kind[1], 'Rival': d.title, 'Hora partido': normTime(d.time), 'Responder antes': d.deadline, 'Temporada': season } }]
      .concat(marked.map(pid => ({ t: 'Convocatorias', op: 'u', v: { 'Partido ID': dayId, 'Jugador ID': pid, 'Temporada': season } }))));
    S.part = null;
  } else if (d.match && !kind[1]) {
    send([{ t: 'Partidos', op: 'd', v: { 'ID': dayId } },
      { t: 'Entrenamientos', op: 'u', v: { 'ID': dayId, 'Fecha': d.date, 'Hora': normTime(d.time), 'Notas': d.title, 'Responder antes': d.deadline, 'Temporada': season } }]
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

/**
 * The official league calendar in one go: the first round as the league sends it (date, rival, home
 * or away) and, if wanted, the return round with the sides swapped. Times are left out: the committee
 * sets them in the match week. Nothing is created until "Crear".
 */
function leagueCalendarDialog() {
  const names = rivals().map(r => r.name);
  if (!can.editDays() || !names.length) return;
  // The first round as a starting point: every rival once, a week apart from today, alternating home and away.
  let first = names.map((rival, i) => ({ date: addDays(today(), 7 * i), rival: rival, home: i % 2 === 0 }));
  let withReturn = true;
  let returnStart = addDays(first.map(f => f.date).sort().pop(), 7);
  let returnDates = {};
  const back = () => first.map((f, i) => ({ date: returnDates[i] || addDays(returnStart, 7 * i), rival: f.rival, home: !f.home }));
  const all = () => first.concat(withReturn ? back() : []);
  // A date button: what it says plus ✏️, with the date input laid over it so a tap opens the picker.
  const dateBtn = (key, date) => '<span class="btn sm datebtn">' + esc(shortDay(date)) + ' ✏️<input type="date" data-fd="' + key + '" value="' + esc(date) + '" aria-label="Fecha"></span>';
  const draw = () => {
    const n = all().length;
    return '<form method="dialog"><div class="title">Calendario de liga</div>'
      + '<p class="small">Pon cada jornada como la manda la liga: fecha, rival y si jugáis en casa o fuera. La hora se pone luego, cuando la decida el comité.</p>'
      + '<div class="bold">Ida</div>'
      + first.map((f, i) => '<div class="fixture"><div class="row tight"><span class="num">J' + (i + 1) + '</span>' + dateBtn('f' + i, f.date)
        + '<button type="button" class="btn sm' + (f.home ? ' on' : '') + '" data-fside="' + i + '">' + (f.home ? 'Casa' : 'Fuera') + '</button></div>'
        + '<select class="full" data-frival="' + i + '" aria-label="Rival">' + names.map(r => '<option' + (r === f.rival ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></div>').join('')
      + '<label class="check mt"><input type="checkbox" data-fret="1"' + (withReturn ? ' checked' : '') + '><span>Crear también la vuelta (casa y fuera cambiados)</span></label>'
      + (withReturn ? '<label for="lcReturn">Primera jornada de la vuelta</label><input id="lcReturn" type="date" data-fstart="1" value="' + esc(returnStart) + '">'
        + '<div class="bold mt">Vuelta</div>'
        + back().map((f, i) => '<div class="fixture"><div class="row tight"><span class="num">J' + (first.length + i + 1) + '</span>' + dateBtn('r' + i, f.date)
          + '<span class="small">' + (f.home ? 'Casa' : 'Fuera') + '</span></div><div class="small">' + esc(f.rival) + '</div></div>').join('') : '')
      + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok"' + (n ? '' : ' disabled') + '>Crear ' + n + ' partidos</button></div></form>';
  };
  const redraw = dlg => { const y = dlg.scrollTop; dlg.innerHTML = draw(); dlg.scrollTop = y; };
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const pick = e.target.closest('input[data-fd]');
      // Desktop browsers open the picker only from their own icon: ask for it on any tap.
      if (pick) { try { pick.showPicker(); } catch (x) { /* not supported: the input takes the tap itself */ } return; }
      const b = e.target.closest('[data-fside]');
      if (!b) return;
      const i = Number(b.dataset.fside);
      first = first.map((f, j) => (j === i ? Object.assign({}, f, { home: !f.home }) : f));
      redraw(dlg);
    };
    dlg.onchange = e => {
      const t = e.target, ds = (t && t.dataset) || {};
      if (ds.fd && t.value) {
        const i = Number(ds.fd.slice(1));
        if (ds.fd[0] === 'f') first = first.map((f, j) => (j === i ? Object.assign({}, f, { date: t.value }) : f));
        else returnDates = Object.assign({}, returnDates, { [i]: t.value });
      } else if (ds.frival) {
        first = pickRival(first, Number(ds.frival), t.value);
      } else if (ds.fret) {
        withReturn = !!t.checked;
      } else if (ds.fstart && t.value) {
        returnStart = t.value; returnDates = {};
      } else return;
      redraw(dlg);
    };
  }, () => {
    const made = createFixtures(all());
    toast(countOf(made, 'partido creado', 'partidos creados'));
  });
}
/** Choosing a rival already in another row swaps the two, so each rival plays once a round. */
function pickRival(round, index, rival) {
  const other = round.findIndex(f => f.rival === rival);
  const old = round[index].rival;
  return round.map((f, i) => (i === index ? Object.assign({}, f, { rival: rival }) : i === other ? Object.assign({}, f, { rival: old }) : f));
}
/**
 * One league match per fixture, with its rival and side and no time yet. A league match against the
 * same rival on the same date that is already there is left as it is, so creating twice adds nothing.
 * Like any new match day, nobody is called up yet.
 */
function createFixtures(fixtures) {
  const taken = new Set(allDays().filter(d => d.match && d.session === 'Partido').map(d => d.date + '|' + d.title.trim().toLowerCase()));
  const ops = [];
  fixtures.forEach(f => {
    const key = f.date + '|' + f.rival.trim().toLowerCase();
    if (!f.rival.trim() || taken.has(key)) return;
    taken.add(key);
    ops.push({ t: 'Partidos', op: 'u', v: { 'ID': uid(), 'Fecha': f.date, 'Tipo': 'Liga', 'Rival': f.rival.trim(), 'Local/Visitante': f.home ? 'Local' : 'Visitante',
      'Hora partido': '', 'Temporada': activeSeason() } });
  });
  send(ops);
  return ops.length;
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
      + (can.fine() && !card ? '<button class="btn sm danger" data-act="removeFine" data-id="' + esc(f.id) + '">Borrar</button>' : '') + '</span></div>';
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
    + draft.map((r, i) => '<div class="row nowrap"><input data-rl="' + i + '" value="' + esc(r.label) + '" maxlength="40"><input class="narrow" data-ra="' + i + '" value="' + esc(r.amount) + '" inputmode="decimal" placeholder="€"><button type="button" class="btn sm danger" data-rx="' + i + '">Quitar</button></div>').join('')
    + '<button type="button" class="btn sm" data-radd="1">Añadir tarifa</button>'
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
  // Coaches after the players, with no player numbers.
  const list = squadPlayers().map(p => ({ p: p, s: stats(p['ID']) })).sort((a, b) => b.s.goals - a.s.goals || b.s.assists - a.s.assists)
    .concat(coaches().map(p => ({ p: p, s: null })));
  let h = seasonBar();
  list.forEach(({ p, s }) => {
    const pid = p['ID'];
    const open = S.open === pid;
    const seasonFines = fines(f => f.player === pid && inSeason(f.row)).sort((a, b) => String(b.date).localeCompare(a.date));
    const pendingFines = seasonFines.reduce((t, f) => t + f.rest, 0);
    h += '<div class="card"><div class="tap" data-act="openPlayer" data-pid="' + esc(pid) + '"><div class="row nowrap"><span class="num">' + esc(p['Dorsal'] || '–') + '</span><div class="grow"><div class="name">' + esc(p['Nombre']) + (s ? '' : ' <span class="small">🧢 Entrenador</span>') + '</div>'
      + '<div class="small">' + esc([p['Apodo'], s ? p['Posición'] : ''].filter(Boolean).join(' · ')) + '</div></div><span class="arrow">' + (open ? '▴' : '▾') + '</span></div>'
      + (s ? '<div class="small">' + esc([countOf(s.goals, 'gol', 'goles'), countOf(s.assists, 'asistencia', 'asistencias'), countOf(s.yellows, 'amarilla', 'amarillas'), countOf(s.reds, 'roja', 'rojas'), 'MVP ' + s.mvps].join(' · ')) + '</div>' : '')
      + (pendingFines ? '<div class="small owed bold">Multas pendientes: ' + money(pendingFines) + '</div>' : '') + '</div>';
    if (open) {
      const acc = can.accounts() ? account(pid) : null;
      h += '<hr><div class="bold">Multas</div>' + (seasonFines.length ? '' : '<div class="small">Ninguna esta temporada.</div>');
      seasonFines.forEach(f => { h += moneyLine(f.label + ' · ' + fdate(f.date), f.amount, f.rest, can.collect() && f.rest > 0 ? payButton('fine', f.id, pid) : ''); });
      if (acc) {
        const before = acc.fines.filter(f => earlier(seasonOf(f.row)));
        if (before.length) h += '<div class="bold mt">Multas de temporadas anteriores</div>';
        before.forEach(f => { h += moneyLine(f.label + ' · ' + fdate(f.date) + ' (' + shortSeason(f.season) + ')', f.amount, f.rest, can.collect() ? payButton('fine', f.id, pid) : ''); });
        h += '<div class="row between mt"><span class="bold">Cuotas, equipación y ropa</span>' + (can.collect() ? '<button class="btn sm" data-act="addCharge" data-pid="' + esc(pid) + '">+ Cargo</button>' : '') + '</div>';
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
const payButton = (kind, id, pid) => '<button class="btn sm" data-act="pay" data-kind="' + kind + '" data-id="' + esc(id) + '" data-pid="' + esc(pid) + '">Cobrar</button>';

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
  const lines = squadPlayers().map(p => {
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
  const coachPaid = mov.filter(m => m['Tipo'] === 'Gasto' && m['Categoría'] === COACH_CATEGORY).reduce((s, m) => s + cents(m['Importe']), 0);
  let h = seasonBar() + '<div class="row between"><div><div class="title">Saldo: ' + money(sum('Ingreso') - sum('Gasto')) + '</div><div class="small">Ingresos ' + money(sum('Ingreso')) + ' · Gastos ' + money(sum('Gasto')) + '</div>'
    + (coachPaid ? '<div class="small bold">Pagado al entrenador: ' + money(coachPaid) + '</div>' : '') + '</div>'
    + (editable() ? '<button class="btn primary" data-act="newMovement">+ Movimiento</button>' : '') + '</div>'
    + '<div class="chips">' + ['Movimientos', 'Por jugador'].map(v => '<button class="btn' + (view === v ? ' on' : '') + '" data-act="accView" data-view="' + v + '">' + v + '</button>').join('') + '</div>';
  if (view === 'Movimientos') {
    if (!mov.length) return h + '<p class="small">Aún no hay movimientos. Lo que se cobre (también a plazos) aparece aquí solo.</p>';
    h += '<div class="card">';
    mov.forEach(m => {
      const sign = m['Tipo'] === 'Ingreso' ? '+' : m['Tipo'] === 'Gasto' ? '−' : '⇄ ';
      const cls = m['Tipo'] === 'Ingreso' ? 'paid' : m['Tipo'] === 'Gasto' ? 'owed' : 'small';
      h += '<div class="line"><span><span>' + esc(m['Concepto'] || m['Categoría']) + '</span><br><span class="small">' + esc([m['Categoría'], m['Jugador ID'] ? playerName(m['Jugador ID']) : '', fdate(m['Fecha']), m['Registrado por']].filter(Boolean).join(' · ')) + '</span></span>'
        + '<span class="right"><span class="bold ' + cls + '">' + sign + money(cents(m['Importe'])) + '</span>' + (editable() ? '<button class="btn sm danger" data-act="removeMovement" data-id="' + esc(m['ID']) + '">Borrar</button>' : '') + '</span></div>';
    });
    return h + '</div>';
  }
  const all = players().map(p => ({ p: p, a: account(p['ID']) })).sort((x, y) => y.a.total - x.a.total);
  h += '<div class="row between"><span class="title">Pendiente de cobrar: ' + money(all.reduce((s, x) => s + x.a.total, 0)) + '</span><button class="btn" data-act="moneyWhatsApp">WhatsApp</button></div>';
  all.forEach(({ p, a }) => {
    const pid = p['ID'];
    h += '<div class="card"><div class="tap row between" data-act="openPlayer" data-pid="' + esc(pid) + '"><span class="name">' + esc(p['Nombre']) + '</span><span class="bold ' + (a.total ? 'owed' : 'paid') + '">'
      + (a.total ? 'Debe ' + money(a.total) + (a.credit ? ' · a favor ' + money(a.credit) : '') : a.credit ? 'A favor ' + money(a.credit) : 'Al día') + ' <span class="arrow">' + (S.open === pid ? '▴' : '▾') + '</span></span></div>';
    if (S.open === pid) {
      a.charges.forEach(c => { h += moneyLine([c.category, c.concept].filter(Boolean).join(' · ') + (earlier(seasonOf({ 'Temporada': c.season })) ? ' (' + shortSeason(c.season) + ')' : ''), c.amount, c.rest, ''); });
      a.fines.forEach(f => { h += moneyLine('Multa: ' + f.label + ' (' + fdate(f.date) + ')', f.amount, f.rest, ''); });
      if (a.credit) h += '<div class="small paid bold">Saldo a favor: ' + money(a.credit) + '</div>';
      rows('Cargos').filter(c => c['Jugador ID'] === pid && inSeason(c)).forEach(c => {
        h += '<div class="line small"><span>' + esc('Cargo · ' + [c['Categoría'], c['Concepto']].filter(Boolean).join(' · ') + ' · ' + fdate(c['Fecha'])) + '</span><span class="right">' + money(cents(c['Importe']))
          + (editable() ? '<button class="btn sm danger" data-act="removeCharge" data-id="' + esc(c['ID']) + '">Quitar</button>' : '') + '</span></div>';
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
      + '<label for="mvPid">Persona (opcional)</label>' + pickPlayer('mvPid', players(), pid, 'Ninguno')
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
      if (b.dataset.pick === 'cat') {
        category = b.dataset.val;
        // Paying the coach: with one coach in the squad, he is filled in.
        const coaches = players().filter(p => p['Posición'] === 'Entrenador');
        if (category === COACH_CATEGORY && !pid && coaches.length === 1) pid = coaches[0]['ID'];
      }
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
    + (can.seasons() ? '<button class="btn sm" data-act="seasons">Gestionar</button>' : '') + '</div>';
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
        + (n !== active ? '<button type="button" class="btn sm" data-sact="activate" data-name="' + esc(n) + '">Activar</button>' : '')
        + (canDel ? '<button type="button" class="btn sm danger" data-sact="delete" data-name="' + esc(n) + '">Borrar</button>' : '') + '</span></div>';
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

/** Who said "Asistiré", field players and goalkeepers apart, goalkeepers by name: "Asisten 4 jugadores y 1 portero (Chino)". */
function goingLine(ids) {
  const going = squadPlayers().filter(p => ids.includes(p['ID']));
  if (!going.length) return '';
  const keepers = going.filter(isKeeper), field = going.length - keepers.length;
  const parts = [field ? (field === 1 ? '1 jugador' : field + ' jugadores') : '',
    keepers.length ? (keepers.length === 1 ? '1 portero' : keepers.length + ' porteros') + ' (' + keepers.map(p => p['Nombre']).join(', ') + ')' : ''].filter(Boolean);
  return (going.length === 1 ? 'Asiste ' : 'Asisten ') + parts.join(' y ');
}

// ---------- search (directiva and coach) ----------
// Same rules as the app's SearchPlan: type "multa", "acta", "entreno" or a name and go straight there.
/** Lower case without accents: "Árbitro" finds "arbitro". */
const searchNorm = text => String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');

/**
 * Everything the search can find for whoever is searching: title, hint, where it goes and other words
 * it answers to. "go" is a tab (and a sub-tab), a day, a player, and something to start there.
 */
function searchShortcuts() {
  const directiva = ROLE() === 'Directiva', plays = !!(S.yo && S.yo.jugadorId), finesToo = can.fine();
  const out = [];
  const add = (title, hint, go, words) => out.push({ title: title, hint: hint, go: go, words: words || '' });
  // The staff's league table lives in Yo.
  const league = { tab: 'yo', sub: 'liga' };
  add('Añadir día', 'Entreno, partido, amistoso o torneo', { tab: 'dias', action: 'newDay' }, 'nuevo crear dia entreno entrenamiento partido evento');
  add('Calendario de liga', 'Crear la ida y la vuelta', { tab: 'dias', action: 'calendar' }, 'jornadas ida vuelta temporada partidos liga');
  add('Entrenos de la temporada', 'Crear todos los entrenamientos', { tab: 'dias', action: 'season' }, 'entrenamientos temporada crear');
  add('Clasificación', 'La tabla de la liga', league, 'tabla liga puntos');
  if (directiva) add('Meter resultado de otro equipo', 'Para la clasificación', league, 'resultado liga clasificacion otros equipos');
  if (finesToo) {
    add('Poner multa', 'Multas', { tab: 'multas', action: 'newFine' }, 'multa sancion nueva');
    add('Cobrar multas', 'Multas', { tab: 'multas' }, 'multas pagos pendientes deudas cobrar');
  }
  if (directiva) {
    add('Apuntar gasto o ingreso', 'Cuentas', { tab: 'cuentas', action: 'newMovement' }, 'movimiento gasto ingreso cuentas dinero contabilidad cuota');
    add('Resumen del dinero', 'Cuentas', { tab: 'cuentas' }, 'resumen dinero caja saldo');
  }
  add('Plantilla', 'Jugadores y estadísticas', { tab: 'plantilla' }, 'jugadores equipo estadisticas goles');
  if (plays) {
    add('Pendientes', 'Lo que queda por hacer', { tab: 'yo', sub: 'inicio' }, 'tareas pendiente inicio');
    add('Mi perfil', 'Yo', { tab: 'yo', sub: 'perfil' }, 'perfil datos tallas telefono');
    add('Mis pagos', 'Yo', { tab: 'yo', sub: 'pagos' }, 'mis multas pagos');
  }
  // Recent and coming days: their report, list or call-up.
  const iso = today(), from = addDays(iso, -45), to = addDays(iso, 90);
  allDays().filter(d => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
    const when = (d.date === iso ? 'hoy ' : '') + shortDay(d.date);
    const x = d.match && d.date < iso ? ['Acta · ' + dayTitle(d) + ' · ' + when, 'Resultado, goles y tarjetas', 'acta resultado goles tarjetas partido lista']
      : d.match ? [dayTitle(d) + ' · ' + when, 'Convocatoria, quién viene, aplazar', 'convocatoria convocar partido aplazar quien viene recordar hora']
        : [dayTitle(d) + ' · ' + when, d.date <= iso ? 'Pasar lista' : 'Quién viene, suspender', 'entreno entrenamiento lista asistencia suspender'];
    add(x[0], x[1], { tab: 'dias', day: d.id }, x[2] + (d.date === iso ? ' hoy' : ''));
  });
  // People: their card in Plantilla (the web has no player editor) and their fines.
  players().forEach(p => {
    const extra = [p['Apodo'], p['Dorsal']].filter(x => String(x || '').trim()).join(' ');
    add('Ficha de ' + p['Nombre'], 'Plantilla', { tab: 'plantilla', pid: p['ID'] }, 'jugador ficha ' + extra);
    if (finesToo) add('Multas de ' + p['Nombre'], 'Multas', { tab: 'multas', pid: p['ID'] }, 'multas pagos deuda ' + extra);
  });
  return out;
}

/**
 * Every word typed must be found (a plural also finds the singular). Nothing typed: the actions, not
 * every day and person. Actions before days and people, and titles that start like the first word first.
 */
function searchFind(query, all) {
  const tokens = searchNorm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return all.filter(s => !s.go.day && !s.go.pid);
  const has = (text, t) => text.indexOf(t) >= 0 || (t.length > 3 && /s$/.test(t) && text.indexOf(t.slice(0, -1)) >= 0)
    || (t.length > 4 && /es$/.test(t) && text.indexOf(t.slice(0, -2)) >= 0);
  const rank = s => {
    const title = searchNorm(s.title);
    const entity = s.go.day || s.go.pid ? 10 : 0;
    return entity + (title.indexOf(tokens[0]) === 0 ? 0 : title.split(' ').some(w => w.indexOf(tokens[0]) === 0) ? 1 : 2);
  };
  return all.filter(s => { const text = searchNorm(s.title + ' ' + s.hint + ' ' + s.words); return tokens.every(t => has(text, t)); })
    .map((s, i) => ({ s: s, r: rank(s), i: i })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.s).slice(0, 20);
}

/** The full-screen search: type and tap where to go. Nothing typed shows every action. */
function searchDialog() {
  if (!can.search()) return;
  const all = searchShortcuts();
  let found = searchFind('', all);
  const list = q => (found.length ? found.map((s, i) => '<button type="button" class="todo-line" data-go="' + i + '"><span><span>' + esc(s.title) + '</span><br><span class="small">' + esc(s.hint) + '</span></span><span class="arrow">›</span></button>').join('')
    : '<p class="small">Nada con «' + esc(q) + '». Prueba con otra palabra: multa, acta, lista, calendario…</p>');
  openDialog('<form method="dialog"><div class="row nowrap head"><button type="button" class="icon-btn" value="cancel" aria-label="Cerrar">✕</button>'
    + '<input id="searchQ" type="search" autocomplete="off" placeholder="Multa, acta, entreno, un jugador…" aria-label="Buscar">'
    + '<button class="hidden" value="ok" tabindex="-1">Ir</button></div><div id="searchList" class="menu">' + list('') + '</div></form>', dlg => {
    dlg.classList.add('search');
    dlg.oninput = e => {
      if (!e.target || e.target.id !== 'searchQ') return;
      found = searchFind(e.target.value, all);
      $('searchList').innerHTML = list(e.target.value);
    };
    dlg.onclick = e => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      closeDialog();
      goTo(found[Number(b.dataset.go)].go);
    };
  }, () => {
    // Enter goes to the first result.
    if (!found.length) return false;
    closeDialog();
    goTo(found[0].go);
    return false;
  });
  setTimeout(() => { const q = $('searchQ'); if (q && q.focus) q.focus(); }, 0);
}

/** Goes where a search result says, and opens the form where the app does. */
function goTo(go) {
  S.tab = go.tab; S.day = go.day || null; S.part = null; S.open = go.pid || null; S.headOpen = null;
  if (go.sub) S.sub = go.sub;
  if (go.tab === 'cuentas') S.accView = 'Movimientos';
  render(); window.scrollTo(0, 0);
  if (go.action === 'newDay' && can.editDays()) addDay();
  else if (go.action === 'calendar' && can.editDays() && rivals().length) leagueCalendarDialog();
  else if (go.action === 'season' && can.editDays()) seasonTrainingsDialog();
  else if (go.action === 'newFine' && can.fine()) newFineDialog();
  else if (go.action === 'newMovement' && editable()) movementDialog();
}
