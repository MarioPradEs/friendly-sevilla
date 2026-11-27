'use strict';
// The player's own screens: next days with notices, what he owes, his profile. Every role has them.

function viewHome() {
  const me = S.yo.jugadorId;
  const t = today();
  const all = days(activeSeason());
  const upcoming = all.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  let h = '';
  if (!me) h += '<p class="small">Tu cuenta no está unida a ningún jugador. Pide a la directiva que ponga tu Jugador ID en la pestaña Usuarios.</p>';
  const meRow = me ? rows('Jugadores').find(r => r['ID'] === me) : null;
  const meCoach = isCoach(meRow);
  // Each day carries an anchor, so a pending line can bring it into view.
  const card = (d, hero) => '<div id="day-' + esc(d.id) + '">' + dayCard(d, me, meCoach, hero) + '</div>';
  // A postponed match is not the next one: it waits for its new date.
  const nextMatch = upcoming.find(d => d.match && !d.off && d.gf === '');
  // Right on top, in red, only when there is something: what is left to do.
  h += pendingCard(pendingList());
  // Then the next match, then how I am doing.
  if (nextMatch) h += card(nextMatch, true);
  if (me) h += attendanceCard(me);
  if (meCoach) h += coachCard(me);
  // Matches still being voted, where this player was called up.
  if (me) allDays().filter(d => voteOpen(d) && squad(d).includes(me)).forEach(d => { h += '<div id="day-vote-' + esc(d.id) + '">' + voteCard(d, me) + '</div>'; });
  // The coming days: only the next training, the matches a week ahead; the rest, folded.
  const rest = upcoming.filter(d => d !== nextMatch);
  if (rest.length) h += '<h2>Próximos días</h2>';
  if (!upcoming.length) h += '<p class="small">No hay nada apuntado todavía.</p>';
  const fold = homeWindow(rest, [nextMatch].filter(Boolean));
  fold.shown.forEach(d => { h += card(d, false); });
  if (fold.folded.length) {
    h += '<button class="btn wide mt" data-act="foldDays">' + (S.allDays ? 'Ocultar el calendario ▴' : 'Ver calendario completo (' + fold.folded.length + ' días más) ▾') + '</button>';
    if (S.allDays) fold.folded.forEach(d => { h += card(d, false); });
  }
  h += birthdayCard();
  const played = all.filter(d => d.match && d.date < t && d.gf !== '').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (played.length) {
    h += '<h2>Últimos resultados</h2>';
    // Only the last one shows; the earlier ones, folded, a tap away.
    (S.allHomeResults ? played : played.slice(0, 1)).forEach(d => {
      const goals = rows('Acta').filter(x => x['Partido ID'] === d.id && x['Tipo'] === 'Gol').map(x => playerName(x['Jugador ID']));
      const mvps = rows('Acta').filter(x => x['Partido ID'] === d.id && x['Tipo'] === 'MVP').map(x => playerName(x['Jugador ID']));
      h += '<div class="card"><div class="title">' + esc(TEAM + ' ' + d.gf + ' – ' + d.ga + ' ' + d.title) + '</div>'
        + '<div class="small">' + esc([fdate(d.date), goals.length ? 'Goles: ' + goals.join(', ') : '', mvps.length ? 'MVP: ' + mvps.join(' y ') + ' ⭐' : '', ledText(d.id)].filter(Boolean).join(' · ')) + '</div></div>';
    });
    if (played.length > 1) h += '<button class="btn wide" data-act="foldResults">' + (S.allHomeResults ? 'Ver solo el último ▴' : 'Ver ' + (played.length - 1) + ' resultados más ▾') + '</button>';
  }
  return h;
}

/** Inicio's coming days: only the next training (even with more planned), the matches up to a week ahead, and always the first match. Same as the app's HomePlan.window. */
function homeWindow(rest, above) {
  const firsts = splitUpcoming(rest, above).shown;
  const x = new Date(today() + 'T12:00:00'); x.setDate(x.getDate() + 7);
  const limit = ymd(x);
  const shown = rest.filter(d => firsts.includes(d) || (d.match && d.date <= limit));
  return { shown: shown, folded: rest.filter(d => !shown.includes(d)) };
}

/**
 * Everything left to do, as the red card lists it: the days to answer on Inicio, the MVP vote, unpaid
 * fines and, for the staff, their tasks. Same as the app's HomePlan.pending.
 */
function pendingList() {
  const me = S.yo && S.yo.jugadorId;
  const out = [];
  if (me && editable()) {
    const t = today();
    const meCoach = isCoach(rows('Jugadores').find(r => r['ID'] === me));
    const upcoming = days(activeSeason()).filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const nextMatch = upcoming.find(d => d.match && !d.off && d.gf === '');
    const shown = [nextMatch].filter(Boolean).concat(homeWindow(upcoming.filter(d => d !== nextMatch), [nextMatch].filter(Boolean)).shown)
      .sort((a, b) => a.date.localeCompare(b.date));
    shown.filter(d => !d.off && !noticeOf(d.id, me) && canAnswer(d, me, meCoach))
      .forEach(d => out.push({ text: 'Responder: ' + dayTitle(d) + ' · ' + shortDay(d.date), go: 'day-' + d.id }));
    const vote = allDays().find(d => voteOpen(d) && squad(d).includes(me) && !myVote(d.id, me));
    if (vote) out.push({ text: 'Votar el MVP: ' + dayTitle(vote), go: 'day-vote-' + vote.id });
    const owed = fines(f => f.player === me).reduce((s, f) => s + f.rest, 0);
    if (owed > 0) out.push({ text: 'Multas sin pagar: ' + money(owed) + '. Págalas antes del próximo partido.' });
  }
  todoList().forEach(x => out.push({ text: x.text, day: x.day }));
  return out;
}

/** In red, on top of Inicio, only when there is something. A day to answer scrolls to it; a task opens where it is done. */
function pendingCard(list) {
  if (!list.length) return '';
  return '<div class="card pending"><div class="bold">❗ Pendiente (' + list.length + ')</div>'
    + list.map(x => x.go ? '<button class="todo-line" data-act="goTo" data-go="' + esc(x.go) + '"><span>' + esc(x.text) + '</span><span class="arrow">›</span></button>'
      : x.day !== undefined ? '<button class="todo-line" data-act="todo" data-day="' + esc(x.day) + '"><span>' + esc(x.text) + '</span><span class="arrow">›</span></button>'
        : '<div class="todo-line"><span>' + esc(x.text) + '</span></div>').join('') + '</div>';
}

/** The count for Inicio's tab: a red dot with how many things are left. */
function pendingBadge() {
  const n = pendingList().length;
  return n ? ' <span class="badge">' + n + '</span>' : '';
}

/** Before the squad is confirmed anyone can answer, which helps the coach pick it; after, in a match only the squad (and the coaches). */
function canAnswer(d, me, meCoach) {
  if (!me) return false;
  const sq = d.match ? squad(d) : [];
  return !d.match || !d.confirmed || !sq.length || sq.includes(me) || meCoach;
}

/** What is stored in the sheet, and what the button says. */
const ANSWERS = [['Asistiré', 'Voy'], ['Llego tarde', 'Tarde'], ['No puedo ir', 'No voy']];

/** One coming day as the player sees it; the next match ("hero") in the club's black and gold. */
function dayCard(d, me, meCoach, hero) {
  const sq = d.match ? squad(d) : [];
  const called = !!me && sq.includes(me);
  // The squad is only shown once the coach or the directiva confirm it.
  const confirmed = d.match && d.confirmed && sq.length > 0;
  const n = me ? noticeOf(d.id, me) : null;
  // Postponed or cancelled: why, instead of the answer buttons.
  const answers = !d.off && canAnswer(d, me, meCoach);
  let h = '<div class="card' + (hero ? ' match-card' : '') + '">';
  if (hero) h += nextMatchHead(d);
  else {
    h += '<div class="title">' + esc(dayTitle(d)) + '</div>';
    h += '<div class="small">' + esc([fdate(d.date), d.time ? 'a las ' + d.time : d.match ? 'hora por confirmar' : '', d.side].filter(Boolean).join(' · ')) + '</div>';
    if (d.meet) h += '<div class="small">Quedamos a las ' + esc(d.meet) + '</div>';
    if (d.ground) h += '<div class="small">' + esc(d.ground + (d.address ? ' · ' + d.address : '')) + '</div>';
  }
  if (d.match && me && !meCoach) h += '<div class="small bold">' + (!confirmed ? 'Convocados aún sin confirmar' : called ? 'Estás convocado' : 'No estás convocado') + '</div>';
  if (confirmed && called) {
    const p = rows('Jugadores').find(r => r['ID'] === me);
    const keeper = p && isKeeper(p) ? keeperKits(me) : [];
    if (keeper.length) h += '<div class="small bold">Portero: trae siempre tus dos equipaciones, ' + esc(kitOptions(keeper)) + '</div>';
    else {
      // The hero already shows the match kit.
      const kit = matchKits().find(k => k.name === d.kit);
      if (kit && !hero) h += '<div class="small bold">Juegas con la ' + esc(kit.description) + '</div>';
      h += '<div class="small">Lleva siempre las dos equipaciones.</div>';
    }
  }
  if (confirmed) {
    const names = squadPlayers().filter(p => sq.includes(p['ID'])).map(p => (p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre']);
    h += '<div class="small">Convocados (' + names.length + '): ' + esc(names.join(', ')) + '</div>';
  }
  if (d.off) h += '<div class="bold warn mt">' + esc(offLabel(d)) + '</div>';
  if (answers) {
    // One row, the main answer first; the chosen one is filled, and tapping it again takes it back.
    h += '<div class="answer">' + ANSWERS.map(a => {
      const chosen = !!n && n['Tipo'] === a[0];
      return '<button class="btn' + (chosen ? ' primary' : '') + '" data-act="' + (chosen ? 'unwarn' : 'warn') + '" data-type="' + esc(a[0]) + '" data-day="' + esc(d.id) + '" data-pid="' + esc(me) + '">'
        + (chosen ? '✓ ' : '') + a[1] + '</button>';
    }).join('') + '</div>';
  }
  if (n) h += '<div class="notice">' + esc(ownNoticeText(n) + (answers ? ' · tócalo otra vez para quitarlo' : '')) + '</div>';
  // Answers are still taken after the deadline: it only tells him he is late.
  if (answers && !n && d.deadline) h += '<div class="small' + (deadlinePassed(d) ? ' bold warn">El plazo para responder terminó' : '">Responde antes del ' + esc(deadlineText(d.deadline))) + '</div>';
  h += '<div class="row">';
  // The match's own link, else the club's or the rival's ground; trainings at the club's.
  const maps = d.match ? groundOf(d).maps : ((clubTeam() || {}).maps || '');
  if (/^https:\/\//.test(maps || '')) h += '<a class="btn" href="' + esc(maps) + '" target="_blank" rel="noopener">📍 Cómo llegar</a>';
  h += '<button class="btn" data-act="ics" data-day="' + esc(d.id) + '">📅 Calendario</button></div></div>';
  return h;
}

/**
 * What the directiva, the coach or the list still has to do, most urgent first: a list to take, a
 * call-up to confirm, a report to fill in, fines to collect. Only what this person can do, and only recent days.
 */
function todoList() {
  if (!editable()) return [];
  const iso = today();
  const shift = n => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + n); return ymd(x); };
  const week = shift(7), lastWeeks = shift(-14);
  const ds = days(activeSeason()).sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  if (can.mark()) {
    ds.filter(d => d.date >= lastWeeks && d.date <= iso && unmarked(d).length && !(d.match && !calledUp(d).length))
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(d => {
        const now = d.date === iso;
        out.push({ text: (now ? 'Pasar lista hoy: ' : 'Lista sin pasar: ') + dayTitle(d) + (now ? '' : ' del ' + shortDay(d.date)) + ' · ' + unmarked(d).length + ' sin marcar', day: d.id });
      });
  }
  if (can.callUp()) {
    ds.filter(d => d.off === POSTPONED).forEach(d => out.push({ text: 'Partido aplazado sin nueva fecha: ' + dayTitle(d), day: d.id }));
    ds.filter(d => d.match && !d.off && d.date >= iso && d.date <= week && !d.confirmed).forEach(d => {
      const w = whoCounts(d);
      out.push({ text: 'Convocatoria sin confirmar: ' + dayTitle(d) + ' del ' + shortDay(d.date) + ' · ✅' + w.going.length + ' ❔' + w.silent.length, day: d.id });
    });
  }
  if (can.report()) {
    ds.filter(d => d.match && !d.off && d.date >= lastWeeks && d.date < iso && calledUp(d).length).filter(d => {
      const ev = rows('Acta').filter(x => x['Partido ID'] === d.id);
      const againstMissing = (parseInt(d.ga, 10) || 0) > ev.filter(x => x['Tipo'] === 'Gol en contra').length;
      return d.gf === '' || d.ga === '' || againstMissing || ev.filter(x => x['Tipo'] === 'Gol').length < (parseInt(d.gf, 10) || 0);
    }).forEach(d => out.push({ text: 'Acta por completar: ' + dayTitle(d) + ' del ' + shortDay(d.date), day: d.id }));
  }
  if (can.collect()) {
    const owed = fines(f => f.rest > 0 && inSeason(f.row, activeSeason()));
    if (owed.length) out.push({ text: countOf(owed.length, 'multa', 'multas') + ' por cobrar · ' + money(owed.reduce((s, f) => s + f.rest, 0)), day: '' });
  }
  return out;
}
/** Each line opens where it is done: its day, or the fines when it has none. */
function todoCard(todos) {
  if (!todos.length) return '';
  return '<div class="card todo"><div class="bold">📋 Pendiente</div>'
    + todos.map(x => '<button class="todo-line" data-act="todo" data-day="' + esc(x.day) + '"><span>' + esc(x.text) + '</span><span class="arrow">›</span></button>').join('') + '</div>';
}

function viewMoney() {
  const me = S.yo.jugadorId;
  if (!me) return '<p class="small">Tu cuenta no está unida a ningún jugador.</p>';
  const active = activeSeason();
  const mineAll = fines(f => f.player === me);
  const led = ledger(me);
  const owedCharges = led.charges.filter(c => c.rest > 0);
  const owedFines = mineAll.filter(f => f.rest > 0);
  const total = owedCharges.reduce((s, c) => s + c.rest, 0) + owedFines.reduce((s, f) => s + f.rest, 0);
  const tag = s => (s && active && s !== active ? ' · ' + s : '');
  let h = '';
  // The coach sees only fines: fees and debts are for the board.
  if (ROLE() !== 'Entrenador') {
  h += '<div class="card"><div class="title">Lo que debo</div>';
  if (!owedCharges.length && !owedFines.length) h += '<div class="small paid">Estás al día.</div>';
  owedCharges.forEach(c => {
    h += '<div class="line"><span>' + esc([c.category, c.concept].filter(Boolean).join(' · ') + tag(c.season)) + '</span><span class="' + payClass(c.rest, c.paid) + '">' + paidText(c.amount, c.rest) + '</span></div>';
  });
  owedFines.forEach(f => {
    h += '<div class="line"><span>Multa: ' + esc(f.label + ' · ' + fdate(f.date) + tag(f.season)) + '</span><span class="' + payClass(f.rest, f.paid) + '">' + paidText(f.amount, f.rest) + '</span></div>';
  });
  if (total) h += '<div class="line total"><span>Total</span><span>' + money(total) + '</span></div>';
  if (led.credit) h += '<div class="line"><span class="paid">A favor</span><span class="paid">' + money(led.credit) + '</span></div>';
  h += '</div>';
  const paidCharges = led.charges.filter(c => c.amount > 0 && c.rest === 0);
  if (paidCharges.length) {
    h += '<h2>Pagado</h2><div class="card">';
    paidCharges.forEach(c => { h += '<div class="line"><span>' + esc([c.category, c.concept].filter(Boolean).join(' · ') + tag(c.season)) + '</span><span class="paid">' + money(c.amount) + ' ✓</span></div>'; });
    h += '</div>';
  }
  const mov = rows('Contabilidad').filter(m => m['Jugador ID'] === me);
  const pays = mov.filter(m => m['Tipo'] === 'Ingreso').sort((a, b) => String(b['Fecha']).localeCompare(a['Fecha']));
  if (pays.length) {
    h += '<h2>Mis pagos</h2><div class="card">';
    pays.forEach(m => { h += '<div class="line"><span>' + esc([m['Categoría'], m['Concepto'], fdate(m['Fecha'])].filter(Boolean).join(' · ')) + '</span><span>' + money(cents(m['Importe'])) + '</span></div>'; });
    h += '</div>';
  }
  const used = mov.filter(m => m['Tipo'] === 'Traspaso').sort((a, b) => String(b['Fecha']).localeCompare(a['Fecha']));
  if (used.length) {
    h += '<h2>Pagado con mi saldo</h2><div class="card">';
    used.forEach(m => { h += '<div class="line"><span>' + esc([String(m['Concepto'] || '').replace('(de su saldo)', '').trim(), fdate(m['Fecha'])].filter(Boolean).join(' · ')) + '</span><span>−' + money(cents(m['Importe'])) + '</span></div>'; });
    h += '</div>';
  }
  }
  const season = mineAll.filter(f => !active || seasonOf(f.row) === active).sort((a, b) => String(b.date).localeCompare(a.date));
  h += '<h2>Mis multas · debo ' + money(season.reduce((s, f) => s + f.rest, 0)) + '</h2><div class="card">';
  if (!season.length) h += '<div class="small">No tienes multas.</div>';
  season.forEach(f => {
    h += '<div class="line"><span>' + esc(f.label + ' · ' + fdate(f.date)) + '</span><span class="' + payClass(f.rest, f.paid) + '">'
      + (f.rest === 0 ? money(f.amount) + ' pagada' : paidText(f.amount, f.rest)) + '</span></div>';
  });
  return h + '</div>';
}

const PROFILE = [['Apodo', 'Apodo', 'text'], ['Teléfono', 'Teléfono', 'tel'], ['Nacimiento', 'Fecha de nacimiento', 'date'],
  ['Talla camiseta', 'Talla camiseta', 'text'], ['Talla pantalón', 'Talla pantalón', 'text'], ['Posición preferida', 'Posición preferida', 'text'],
  ['Contacto emergencia', 'Contacto de emergencia (nombre y teléfono)', 'text']];

function viewProfile() {
  const me = S.yo.jugadorId;
  const p = rows('Jugadores').find(r => r['ID'] === me);
  if (!p) return '<p class="small">Tu cuenta no está unida a ningún jugador. Pide a la directiva que ponga tu Jugador ID en la pestaña Usuarios.</p>';
  let h = '<div class="card"><div class="title">' + esc((p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre']) + (isCoach(p) ? ' <span class="small">🧢 Entrenador</span>' : '') + '</div>'
    + (isCoach(p) ? '' : '<div class="small">' + esc(p['Posición'] || '') + '</div>') + '</div>';
  h += '<p class="small">El nombre y el dorsal los cambia la directiva. Teléfono, nacimiento y contacto de emergencia solo los ven la directiva y el entrenador.</p><form id="profile">';
  PROFILE.forEach(f => { h += '<label for="pf-' + esc(f[0]) + '">' + esc(f[1]) + '</label><input id="pf-' + esc(f[0]) + '" name="' + esc(f[0]) + '" type="' + f[2] + '" value="' + esc(p[f[0]] || '') + '" maxlength="80">'; });
  return h + '<div class="row"><button class="btn primary" type="submit">Guardar mis datos</button></div></form>';
}

function saveProfile(form) {
  const me = S.yo.jugadorId;
  const p = rows('Jugadores').find(r => r['ID'] === me) || {};
  const v = { 'ID': me };
  let changed = false;
  PROFILE.forEach(f => { const val = form.elements[f[0]].value.trim(); if (val !== (p[f[0]] || '')) { v[f[0]] = val; changed = true; } });
  if (!changed) { toast('No hay cambios'); return; }
  send({ t: 'Jugadores', op: 'e', v: v });
  toast('Guardado. Se envía a la hoja en unos segundos.');
}

// ---------- notices: the player's own, or one the directiva writes down for him ----------
function warnDialog(dayId, type, pid) {
  const d = findDay(dayId);
  if (!d) return;
  const cur = noticeOf(dayId, pid);
  const same = cur && cur['Tipo'] === type ? cur : null;
  let reason = same ? same['Motivo'] || '' : '';
  const own = pid === S.yo.jugadorId;
  // Nothing to ask for "Asistiré": it is saved straight away.
  if (type === 'Asistiré') {
    send({ t: 'Avisos', op: 'u', v: { 'Día ID': dayId, 'Fecha': d.date, 'Jugador ID': pid, 'Tipo': type, 'Hora llegada': '', 'Motivo': '', 'Temporada': d.season, 'Avisado': '', 'A tiempo': '' } });
    toast(own ? 'Apuntado: vas' : 'Aviso apuntado');
    return;
  }
  let h = '<form method="dialog"><div class="title">' + esc(type) + (own ? '' : ' · ' + esc(playerName(pid))) + '</div><div class="small">' + esc(dayTitle(d) + ' · ' + fdate(d.date)) + '</div>';
  if (type === 'No puedo ir') {
    h += '<label>Motivo</label><div class="chips">' + REASONS.map(r => '<button type="button" class="btn' + (reason === r ? ' on' : '') + '" data-reason="' + r + '">' + r + '</button>').join('') + '</div>';
  } else {
    h += '<label for="arrival">Hora aproximada de llegada</label><input id="arrival" type="time" value="' + esc(same ? same['Hora llegada'] || '' : '') + '">'
      + '<label for="lateReason">Motivo (opcional)</label><input id="lateReason" maxlength="80" value="' + esc(reason) + '">'
      + '<p class="small">Si avisa antes de la hora, el retraso cuenta como justificado y sin multa.</p>';
  }
  h += '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" id="warnOk" value="ok"' + (type === 'No puedo ir' && !reason ? ' disabled' : '') + '>Avisar</button></div></form>';
  openDialog(h, dlg => {
    dlg.onclick = e => {
      const r = e.target.closest('[data-reason]');
      if (!r) return;
      reason = r.dataset.reason;
      dlg.querySelectorAll('[data-reason]').forEach(b => b.classList.toggle('on', b === r));
      $('warnOk').disabled = false;
    };
  }, () => {
    const arrival = type === 'Llego tarde' ? $('arrival').value : '';
    const why = type === 'Llego tarde' ? $('lateReason').value.trim() : reason;
    const v = { 'Día ID': dayId, 'Fecha': d.date, 'Jugador ID': pid, 'Tipo': type, 'Hora llegada': arrival, 'Motivo': why, 'Temporada': d.season };
    // A new kind of notice is stamped again by the sheet: the old "in time" no longer counts meanwhile.
    if (!cur || cur['Tipo'] !== type) { v['Avisado'] = ''; v['A tiempo'] = ''; }
    send({ t: 'Avisos', op: 'u', v: v });
    toast('Aviso apuntado');
  });
}

function calendar(dayId) {
  const d = findDay(dayId);
  if (!d) return;
  const day = d.date.replace(/-/g, '');
  const start = normTime(d.time);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Friendly Sevilla Club//ES', 'BEGIN:VEVENT',
    'UID:' + d.id + '@friendlysevillaclub', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'];
  if (/^\d{2}:\d{2}$/.test(start)) {
    const hh = Number(start.slice(0, 2)), mm = start.slice(3);
    lines.push('DTSTART:' + day + 'T' + pad(hh) + mm + '00', 'DTEND:' + day + 'T' + pad(Math.min(hh + 2, 23)) + mm + '00');
  } else {
    const n = new Date(d.date + 'T12:00:00'); n.setDate(n.getDate() + 1);
    lines.push('DTSTART;VALUE=DATE:' + day, 'DTEND;VALUE=DATE:' + ymd(n).replace(/-/g, ''));
  }
  const clean = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, ' ');
  const rival = d.title.trim() || 'rival por confirmar';
  const title = !d.match ? 'Entrenamiento ' + TEAM + (d.title.trim() ? ' · ' + d.title.trim() : '') : d.side === 'Visitante' ? rival + ' vs ' + TEAM : TEAM + ' vs ' + rival;
  lines.push('SUMMARY:' + clean(title));
  const place = groundOf(d);
  if (place.ground || d.address) lines.push('LOCATION:' + clean([place.ground, d.address].filter(Boolean).join(', ')));
  if (d.match && d.meet) lines.push('DESCRIPTION:' + clean('Quedamos a las ' + normTime(d.meet)));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  const ics = lines.join('\r\n');
  // An iPhone app on the home screen does not download files: opening the event directly offers to add it.
  if (navigator.standalone || /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    return;
  }
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'friendly-' + d.date + '.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- kits and grounds ----------
function kitsAll() {
  return rows('Equipaciones').filter(k => k['Nombre']).map(k => {
    const shirt = k['Camiseta'] || '', shorts = k['Pantalón'] || '', socks = k['Medias'] || '';
    const colours = [['camiseta', shirt], ['pantalón', shorts], ['medias', socks]].filter(x => x[1].trim()).map(x => x[0] + ' ' + x[1].trim()).join(', ');
    const plain = !!k['Color camiseta'] && k['Color camiseta'] === k['Color pantalón'] && k['Color pantalón'] === k['Color medias'];
    return { name: k['Nombre'].trim(), shirt: shirt, shorts: shorts, socks: socks, player: (k['Jugador ID'] || '').trim(), plain: plain,
      description: colours ? k['Nombre'].trim() + ' (' + colours + ')' : k['Nombre'].trim() };
  });
}
const matchKits = () => kitsAll().filter(k => !k.player);
const keeperKits = pid => kitsAll().filter(k => k.player === pid);
function kitOptions(kits) {
  if (!kits.length) return '';
  if (kits.every(k => k.plain)) return kits.map(k => k.shirt.trim()).join(' y ') + (kits.length > 1 ? ', enteras' : ' entera');
  return [['camiseta', kits.map(k => k.shirt.trim())], ['pantalón', kits.map(k => k.shorts.trim())], ['medias', kits.map(k => k.socks.trim())]]
    .map(x => { const v = x[1].filter(Boolean).filter((s, i, a) => a.indexOf(s) === i); return v.length ? x[0] + ' ' + v.join(' y ') : ''; })
    .filter(Boolean).join(', ');
}
function teamsAll() {
  return rows('Equipos').filter(t => (t['Equipo'] || '').trim()).map(t => ({ id: t['ID'], name: t['Equipo'].trim(), ground: t['Campo'] || '', maps: t['URL Google Maps'] || '' }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
const clubTeam = () => teamsAll().find(t => t.name.toLowerCase() === TEAM.toLowerCase());
const rivals = () => teamsAll().filter(t => t.name.toLowerCase() !== TEAM.toLowerCase());
/** Where the match is: what the sheet says, else the club's or the rival's ground. */
function groundOf(d) {
  if (d.ground) return { ground: d.ground, maps: d.maps || '' };
  const place = d.side === 'Local' ? clubTeam() : d.side === 'Visitante' ? rivals().find(r => r.name.toLowerCase() === d.title.trim().toLowerCase()) : null;
  return { ground: place ? place.ground : '', maps: place ? place.maps : '' };
}

/**
 * The player's attendance at a glance: the percentage, the days in a row he came and his last
 * days as V (came), X (missed) and – (could not come), to keep it all green.
 */
function attendanceCard(me) {
  const trail = allDays().filter(d => inSeason(d.row) && markOf(d.id, me))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)))
    .map(d => { const s = markOf(d.id, me)['Estado']; return s === 'OK' || s === 'Tarde' ? true : s === 'Falta' ? false : null; });
  const s = stats(me);
  const k = keeperStats(me);
  const played = k.parts > 0 || s.goals + s.assists + s.yellows + s.reds + s.mvps > 0;
  if (!trail.length && !played) return '';
  const counted = trail.filter(x => x !== null);
  const percent = counted.length ? Math.floor(counted.filter(Boolean).length * 100 / counted.length) + ' %' : '—';
  let streak = 0;
  for (let i = counted.length - 1; i >= 0 && counted[i]; i--) streak++;
  const dots = trail.slice(-12).map(x => '<span class="dot ' + (x === true ? 'v' : x === false ? 'x' : 'n') + '">' + (x === true ? 'V' : x === false ? 'X' : '–') + '</span>').join('');
  return '<div class="card"><div class="row between"><div><div class="small">Tu asistencia</div><div class="big bold">' + percent + '</div></div>'
    + '<div class="right-text"><div class="small">Racha</div><div class="bold">' + (streak ? '🔥 ' + streak + (streak === 1 ? ' seguido' : ' seguidos') : 'Empieza hoy') + '</div></div></div>'
    + '<div class="dots">' + dots + '</div>'
    + '<div class="statline">' + [['⚽', s.goals, 'Goles'], ['🅰️', s.assists, 'Asist.'], ['🟨', s.yellows, 'Amarillas'], ['🟥', s.reds, 'Rojas'], ['⭐', s.mvps, 'MVP']]
      .map(x => '<div><div class="bold">' + x[0] + ' ' + x[1] + '</div><div class="small">' + x[2] + '</div></div>').join('') + '</div>'
    + (k.parts ? '<div class="statline">' + [['🧤', k.conceded, 'Encajados'], ['🛡️', k.clean, 'Partes a cero'], ['🥅', k.cleanMatches, 'Partidos a cero'], ['⏱️', k.parts, 'Partes jugadas']]
      .map(x => '<div><div class="bold">' + x[0] + ' ' + x[1] + '</div><div class="small">' + x[2] + '</div></div>').join('') + '</div>' : '')
    + '</div>';
}

/** The coach's own record: matches he led this season with their result in. */
function coachCard(me) {
  const c = coachStats(me);
  const streak = !c.streak ? '—' : c.streak + ' ' + ({ V: ['victoria', 'victorias seguidas'], E: ['empate', 'empates seguidos'], D: ['derrota', 'derrotas seguidas'] }[c.last][c.streak === 1 ? 0 : 1]);
  return '<div class="card"><div class="title">🧢 Como entrenador</div>'
    + '<div class="statline">' + [[c.matches, 'Partidos dirigidos'], [c.won + ' V · ' + c.drawn + ' E · ' + c.lost + ' D', 'Balance'], [c.matches ? Math.round(c.won * 100 / c.matches) + ' %' : '—', '% victorias']]
      .map(x => '<div><div class="bold">' + esc(x[0]) + '</div><div class="small">' + x[1] + '</div></div>').join('') + '</div>'
    + '<div class="statline">' + [[c.gf + ' / ' + c.ga, 'Goles a favor / en contra'], [streak, 'Racha actual']]
      .map(x => '<div><div class="bold">' + esc(x[0]) + '</div><div class="small">' + x[1] + '</div></div>').join('') + '</div>'
    + (c.matches ? '' : '<div class="small mt">Aún no hay partidos con resultado en los que conste que dirigiste.</div>') + '</div>';
}

/** Day and month of someone's birthday, "11-27": the sheet sends others only that ("Cumple"). */
function birthdayOf(p) {
  if (p['Cumple']) return String(p['Cumple']);
  const n = String(p['Nacimiento'] || '');
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(n) ? n.slice(5) : '';
}
/** Today's birthdays first, then the rest of the week; the directiva and the coach congratulate by WhatsApp. */
function birthdayCard() {
  const t = new Date(today() + 'T12:00:00');
  const list = players().map(p => {
    const b = birthdayOf(p);
    if (!b) return null;
    const m = Number(b.slice(0, 2)), d = Number(b.slice(3, 5));
    const on = y => { const last = new Date(y, m, 0).getDate(); return new Date(y, m - 1, Math.min(d, last), 12); };
    let next = on(t.getFullYear());
    if (ymd(next) < today()) next = on(t.getFullYear() + 1);
    return (next - t) / 86400000 <= 7 ? { p: p, date: next } : null;
  }).filter(Boolean).sort((a, b) => a.date - b.date);
  if (!list.length) return '';
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const now = list.filter(x => ymd(x.date) === today()), soon = list.filter(x => ymd(x.date) !== today());
  let h = '<div class="card">';
  now.forEach(x => {
    h += '<div class="row between"><span class="bold">🎂 ¡Hoy cumple ' + esc(x.p['Nombre']) + '!</span>'
      + (can.club() ? '<button class="btn sm" data-act="congratulate" data-pid="' + esc(x.p['ID']) + '">Felicitar</button>' : '') + '</div>';
  });
  if (soon.length) h += '<div class="small">🎈 Esta semana: ' + esc(soon.map(x => x.p['Nombre'] + ' (' + days[x.date.getDay()] + ' ' + x.date.getDate() + ')').join(' · ')) + '</div>';
  return h + '</div>';
}
function birthdayText(pid) {
  return '🎉 *¡Feliz cumpleaños, ' + playerName(pid) + '!* 🎂' + String.fromCharCode(10, 10) + 'De parte de todo el ' + TEAM + '. ¡A celebrarlo! 🥳⚽';
}

/** The next match at a glance, in the club's black and gold: the top of its card. */
function nextMatchHead(d) {
  const days = Math.round((new Date(d.date + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 86400000);
  const count = days === 0 ? 'HOY' : days === 1 ? 'MAÑANA' : 'EN ' + days + ' DÍAS';
  const rival = d.title.trim() || 'Rival por confirmar';
  const title = d.side === 'Visitante' ? rival + ' vs ' + TEAM : TEAM + ' vs ' + rival;
  const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dt = new Date(d.date + 'T12:00:00');
  // Until the committee meeting the match may have no time yet.
  const when = [names[dt.getDay()] + ' ' + dt.getDate() + '/' + (dt.getMonth() + 1), d.time || 'hora por confirmar', d.meet ? 'quedamos a las ' + d.meet : ''].filter(Boolean).join(' · ');
  const g = groundOf(d);
  const kit = matchKits().find(k => k.name === d.kit);
  // The coach may show the shape of his board: on the right, beside the details.
  const shown = rows('Acta').find(x => x['Partido ID'] === d.id && x['Tipo'] === 'Formación visible');
  const pitch = shown ? formationSvg(String(shown['Notas'] || '').trim()) : '';
  const details = '<div class="match-title">' + esc(title) + '</div><div class="gold">' + esc(when) + '</div>'
    + (g.ground ? '<div class="small">📍 ' + esc(g.ground) + '</div>' : '')
    + (kit ? '<div class="small">👕 ' + esc(kit.name) + '</div>' : '');
  return '<div class="row between"><span class="gold small bold">PRÓXIMO ' + esc(d.label.toUpperCase()) + '</span><span class="pill">' + count + '</span></div>'
    + (pitch ? '<div class="match-body"><div class="grow">' + details + '</div>' + pitch + '</div>' : details);
}

// ---------- The formation the coach shows: only its shape, a dot per spot ----------
/**
 * Spots of a system, the goalkeeper first, x from the left and y from our goal (0 to 1): a usual
 * one, "4-4-2", spreads each line across; the coach's own one, "Name|x,y;…", has all eleven.
 * The same as the app's LineupPlan.spots.
 */
function formationSpots(system) {
  if (system.indexOf('|') >= 0) {
    const pts = system.split('|')[1].split(';').map(p => p.split(',').map(Number));
    if (pts.length !== 11 || pts.some(p => p.length < 2 || p.some(isNaN))) return [];
    return pts.map(p => [Math.min(Math.max(p[0], 0), 1), Math.min(Math.max(p[1], 0), 1)]);
  }
  const lines = system.split('-').map(n => Number(n.trim()));
  if (!lines.length || lines.some(n => !Number.isInteger(n) || n < 1 || n > 6)) return [];
  const out = [[0.5, 0.1]];
  lines.forEach((count, line) => {
    const y = 0.22 + line * (0.7 / lines.length);
    for (let i = 0; i < count; i++) out.push([(i + 1) / (count + 1), y]);
  });
  return out;
}

/** A small pitch with the dots; a usual system with its name underneath, the coach's own without. */
function formationSvg(system) {
  const spots = formationSpots(system);
  if (!spots.length) return '';
  const w = 90, h = 100, m = 3, bw = w * 0.56, bh = h * 0.14;
  const line = 'fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"';
  const svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Formación">'
    + '<rect width="' + w + '" height="' + h + '" rx="6" fill="#2E7D32"/>'
    + '<rect x="' + m + '" y="' + m + '" width="' + (w - 2 * m) + '" height="' + (h - 2 * m) + '" ' + line + '/>'
    + '<line x1="' + m + '" y1="' + h / 2 + '" x2="' + (w - m) + '" y2="' + h / 2 + '" ' + line + '/>'
    + '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + w * 0.13 + '" ' + line + '/>'
    + '<rect x="' + (w - bw) / 2 + '" y="' + m + '" width="' + bw + '" height="' + bh + '" ' + line + '/>'
    + '<rect x="' + (w - bw) / 2 + '" y="' + (h - m - bh) + '" width="' + bw + '" height="' + bh + '" ' + line + '/>'
    + spots.map(s => '<circle cx="' + (s[0] * w).toFixed(1) + '" cy="' + ((1 - s[1]) * h).toFixed(1) + '" r="4" fill="#fff"/>').join('')
    + '</svg>';
  const name = system.indexOf('|') < 0 ? '<div class="bold formation-name">' + esc(system) + '</div>' : '';
  return '<div class="formation">' + svg + name + '</div>';
}

// ---------- MVP vote: secret, never oneself, the match day and the next ----------
/** [opens, closes]: 2 hours after the match time (without one, the next day at 00:00), for 24 hours. */
function voteWindow(d) {
  const p = String(d.date || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(normTime(d.time || ''));
  const opens = m ? new Date(p[0], p[1] - 1, p[2], Number(m[1]) + 2, Number(m[2])) : new Date(p[0], p[1] - 1, p[2] + 1, 0, 0);
  return [opens, new Date(opens.getTime() + 24 * 3600000)];
}
function voteOpen(d) {
  // A postponed match has no MVP until it is played.
  const w = d.match && !d.off && voteWindow(d);
  const now = new Date();
  return !!w && now >= w[0] && now <= w[1];
}
function voteClosed(d) {
  const w = d.match && voteWindow(d);
  return !!w && new Date() > w[1];
}
/** "lunes 23/11 a las 12:00": until when one can vote. */
function voteUntil(d) {
  const w = voteWindow(d);
  if (!w) return '';
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const c = w[1];
  return days[c.getDay()] + ' ' + c.getDate() + '/' + (c.getMonth() + 1) + ' a las ' + String(c.getHours()).padStart(2, '0') + ':' + String(c.getMinutes()).padStart(2, '0');
}
/** The match this player must still vote for, if any. */
/** Matches whose vote was left for later ("Más tarde"): asked again on the next page load. */
const voteLater = new Set();
function pendingVote(me) {
  return allDays().find(d => voteOpen(d) && squad(d).includes(me) && !myVote(d.id, me) && !voteLater.has(d.id));
}
/** The vote after a match: it can wait ("Más tarde") but comes back each time the page opens until it is in; the card on Inicio stays. */
function votePrompt() {
  const me = S.yo && S.yo.jugadorId;
  const dlg = $('dlg');
  if (!me || !S.datos || (dlg.open && dlg.dataset.vote)) return;
  const d = pendingVote(me);
  if (!d || dlg.open) return;
  const options = squadPlayers().filter(p => squad(d).includes(p['ID']) && p['ID'] !== me);
  const match = d.side === 'Visitante' ? (d.title.trim() || 'el rival') + ' vs ' + TEAM : TEAM + ' vs ' + (d.title.trim() || 'el rival');
  openDialog('<form method="dialog"><div class="title">⭐ Vota al MVP</div><p>' + esc(match) + '. Elige al mejor de tus compañeros. Tu voto es secreto y no se puede cambiar.</p>'
    + pickPlayer('promptVote', options, '', 'Elige a un compañero')
    + '<p class="small">Puedes votar hasta el ' + esc(voteUntil(d)) + '.</p>'
    + '<div class="row end"><button type="button" class="btn" data-later="1">Más tarde</button><button class="btn primary" value="ok">Votar</button></div></form>', box => {
    box.onclick = e => {
      if (!e.target.closest('[data-later]')) return;
      voteLater.add(d.id);
      delete box.dataset.vote;
      closeDialog();
    };
  }, () => {
    const voted = $('promptVote').value;
    if (!voted) { toast('Elige a un compañero'); return false; }
    send({ t: 'Votos MVP', op: 'u', v: { 'Partido ID': d.id, 'Jugador ID': me, 'Votado ID': voted, 'Temporada': d.season || activeSeason() } });
    delete dlg.dataset.vote;
    toast('Voto guardado');
  });
  dlg.dataset.vote = d.id;
  // Only the two buttons close it: Escape would leave the vote neither given nor put off.
  dlg.onkeydown = e => { if (e.key === 'Escape') e.preventDefault(); };
  dlg.oncancel = e => e.preventDefault();
}
function myVote(dayId, me) {
  return rows('Votos MVP').find(v => v['Partido ID'] === dayId && v['Jugador ID'] === me);
}
function voteCard(d, me) {
  const cur = myVote(d.id, me);
  const options = squadPlayers().filter(p => squad(d).includes(p['ID']) && p['ID'] !== me);
  const match = d.side === 'Visitante' ? (d.title.trim() || 'el rival') + ' vs ' + TEAM : TEAM + ' vs ' + (d.title.trim() || 'el rival');
  // The vote stays: once given there is nothing to change.
  if (cur) {
    return '<div class="card"><div class="title">⭐ Vota al MVP</div><div class="small">' + esc(match + '. Tu voto es secreto y no se puede cambiar.') + '</div>'
      + '<div class="bold mt">Tu voto: ' + esc(playerName(cur['Votado ID'])) + ' ✓</div></div>';
  }
  return '<div class="card"><div class="title">⭐ Vota al MVP</div>'
    + '<div class="small">' + esc(match + ' · hasta el ' + voteUntil(d) + '. Tu voto es secreto y no se puede cambiar.') + '</div>'
    + pickPlayer('vote_' + d.id, options, '', 'Elige a un compañero')
    + '<div class="row end mt"><button class="btn primary" data-act="vote" data-day="' + esc(d.id) + '">Votar</button></div></div>';
}
function vote(dayId) {
  const me = S.yo.jugadorId;
  const sel = $('vote_' + dayId);
  const voted = sel && sel.value;
  if (!me || !voted || voted === me) { toast('Elige a un compañero'); return; }
  if (myVote(dayId, me)) return;
  const d = findDay(dayId);
  send({ t: 'Votos MVP', op: 'u', v: { 'Partido ID': dayId, 'Jugador ID': me, 'Votado ID': voted, 'Temporada': (d && d.season) || activeSeason() } });
  toast('Voto guardado');
}

// ---------- league table ("Clasificación") ----------
// Same rules as the app's LeaguePlan: our league matches count once the report has the score;
// the directiva types in the matches between the other teams.
/** Our club's key when Equipos has no row for it. */
const CLUB_KEY = 'club';
const clubId = () => { const c = clubTeam(); return c ? c.id : CLUB_KEY; };
const isWhole = v => /^-?\d+$/.test(String(v == null ? '' : v).trim());
function leagueTeamName(id) {
  if (id === clubId()) return TEAM;
  const r = rivals().find(t => t.id === id);
  return r ? r.name : '?';
}
/**
 * The typed-in results of the viewed season. Blank goals mean not played yet (null); a row missing a
 * team, or with goals that are not a number, is skipped. "Jornada" is its number, blank if unknown.
 */
function leagueResults() {
  const goals = v => { const t = String(v == null ? '' : v).trim(); return t === '' ? null : isWhole(t) ? Number(t) : undefined; };
  return rows('Resultados liga').filter(r => inSeason(r)).map(r => ({
    id: r['ID'], date: r['Fecha'] || '', homeId: String(r['Local ID'] || '').trim(), awayId: String(r['Visitante ID'] || '').trim(),
    homeGoals: goals(r['Goles local']), awayGoals: goals(r['Goles visitante']), season: r['Temporada'] || '', round: String(r['Jornada'] || '').trim(),
  })).filter(r => r.homeId && r.awayId && r.homeGoals !== undefined && r.awayGoals !== undefined);
}
/** Every league match with a score, newest first; resultId is null for ours (they come from the report). */
function leagueGames() {
  const own = clubId();
  const ours = days().filter(d => d.match && d.session === 'Partido' && isWhole(d.gf) && isWhole(d.ga) && d.title.trim()).map(d => {
    const rival = d.title.trim();
    const found = rivals().find(t => t.name.toLowerCase() === rival.toLowerCase());
    const rid = found ? found.id : 'name:' + rival;
    const us = Number(String(d.gf).trim()), them = Number(String(d.ga).trim());
    return d.side === 'Visitante'
      ? { date: d.date, homeId: rid, home: rival, awayId: own, away: TEAM, homeGoals: them, awayGoals: us, resultId: null, round: d.round || '' }
      : { date: d.date, homeId: own, home: TEAM, awayId: rid, away: rival, homeGoals: us, awayGoals: them, resultId: null, round: d.round || '' };
  });
  const others = leagueResults().filter(r => r.homeGoals !== null && r.awayGoals !== null).map(r => ({ date: r.date, homeId: r.homeId, home: leagueTeamName(r.homeId), awayId: r.awayId, away: leagueTeamName(r.awayId),
    homeGoals: r.homeGoals, awayGoals: r.awayGoals, resultId: r.id, round: r.round }));
  return ours.concat(others).sort((a, b) => b.date.localeCompare(a.date));
}
/** Our league matches already played (before today) with no score yet: they do not count until the report has it. */
function leagueMissing() {
  const t = today();
  return days().filter(d => d.match && !d.off && d.session === 'Partido' && d.date < t && d.title.trim() && !(isWhole(d.gf) && isWhole(d.ga)))
    .sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * Inicio shows only the next training and the next match; the rest stays folded behind "Ver más".
 * [above] is what Inicio already shows on top. Same rule as the app's UpcomingPlan.
 */
function splitUpcoming(rest, above) {
  const training = above.some(d => !d.match) ? null : rest.find(d => !d.match);
  const match = above.some(d => d.match) ? null : rest.find(d => d.match);
  const shown = rest.filter(d => d === training || d === match);
  return { shown: shown, folded: rest.filter(d => !shown.includes(d)) };
}

/**
 * Jornada [n] as Clasificación shows it: its results (oldest first), the matches still without score
 * (maybe not played yet) and the teams with no match in it. Same as the app's LeaguePlan.round.
 */
function leagueRound(n) {
  const own = clubId();
  const everyone = allLeagueTeams();
  const name = id => (everyone.find(x => x.id === id) || { name: '?' }).name;
  const rows = roundGames(n).filter(g => g.home && g.away);
  const busy = new Set(rows.flatMap(g => [g.home, g.away]));
  const dates = rows.map(g => g.date).filter(Boolean).sort();
  return { number: n, from: dates[0] || '', to: dates[dates.length - 1] || '',
    games: leagueGames().filter(g => String(g.round) === String(n)).sort((a, b) => a.date.localeCompare(b.date)),
    pending: rows.filter(g => g.hg === null || g.ag === null).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(g => ({ date: g.date, home: name(g.home), away: name(g.away), ours: g.home === own || g.away === own })),
    waiting: everyone.filter(x => !busy.has(x.id)).map(x => x.name) };
}

/** The jornadas with at least one result, newest first: what "Todas" lists. */
function leaguePlayedRounds() {
  return Array.from(new Set(leagueGames().map(g => String(g.round || '').trim()).filter(x => /^\d+$/.test(x)).map(Number))).sort((a, b) => b - a);
}

/**
 * The last round played. With jornada numbers: the highest one with a score in any match, up to
 * today. Without (results typed before numbers): the week (Monday to Sunday) of the latest league
 * date up to today. Its results, the matches with no score yet and the teams with no match at all.
 */
function leagueLastRound() {
  const t = today();
  const own = clubId();
  const all = leagueGames();
  const everyone = allLeagueTeams();
  const name = id => (everyone.find(x => x.id === id) || { name: '?' }).name;
  const numbered = all.filter(g => g.date <= t && /^\d+$/.test(String(g.round || '').trim()));
  if (numbered.length) return leagueRound(Math.max.apply(null, numbered.map(g => Number(g.round))));
  const ourAll = days().filter(d => d.match && !d.off && d.session === 'Partido' && d.title.trim());
  const ourDays = ourAll.filter(d => d.date <= t);
  const scored = all.filter(g => g.date <= t);
  const latest = scored.map(g => g.date).concat(ourDays.map(d => d.date)).sort().pop();
  if (!latest) return null;
  const day = new Date(latest + 'T12:00:00');
  const monday = new Date(day); monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const from = iso(monday), to = iso(sunday);
  const inWeek = date => date >= from && date <= to;
  const games = scored.filter(g => inWeek(g.date));
  // Ours later that same week count too: not played yet, so no score.
  const unscored = ourAll.filter(d => inWeek(d.date) && !(isWhole(d.gf) && isWhole(d.ga))).sort((a, b) => a.date.localeCompare(b.date));
  const unscoredTyped = leagueResults().filter(r => (r.homeGoals === null || r.awayGoals === null) && inWeek(r.date));
  const busy = new Set(games.flatMap(g => [g.homeId, g.awayId]));
  if (unscored.length) busy.add(own);
  unscored.forEach(d => { const r = rivals().find(x => x.name.toLowerCase() === d.title.trim().toLowerCase()); if (r) busy.add(r.id); });
  unscoredTyped.forEach(r => { busy.add(r.homeId); busy.add(r.awayId); });
  const pending = unscored.map(d => (d.side === 'Visitante' ? { date: d.date, home: d.title.trim(), away: TEAM, ours: true } : { date: d.date, home: TEAM, away: d.title.trim(), ours: true }))
    .concat(unscoredTyped.map(r => ({ date: r.date, home: name(r.homeId), away: name(r.awayId), ours: false })))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { number: null, from: from, to: to, games: games, pending: pending, waiting: everyone.filter(x => !busy.has(x.id)).map(x => x.name) };
}

/** Everyone who has played, best first: points (3 a win, 1 a draw), goal difference, goals scored, then name. */
function leagueTable() {
  const own = clubId();
  const table = {};
  const add = (id, name, scored, conceded) => {
    const r = table[id] || (table[id] = { teamId: id, name: name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, own: id === own });
    r.played++; r.goalsFor += scored; r.goalsAgainst += conceded;
    if (scored > conceded) r.won++; else if (scored === conceded) r.drawn++; else r.lost++;
  };
  leagueGames().forEach(g => { add(g.homeId, g.home, g.homeGoals, g.awayGoals); add(g.awayId, g.away, g.awayGoals, g.homeGoals); });
  const low = s => s.toLowerCase();
  return Object.keys(table).map(k => Object.assign(table[k], { goalDiff: table[k].goalsFor - table[k].goalsAgainst, points: table[k].won * 3 + table[k].drawn }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || (low(a.name) < low(b.name) ? -1 : low(a.name) > low(b.name) ? 1 : 0));
}

/** "Inicio" for the player: the home and the league table, one tap apart. */
function viewInicio() {
  S.homeTab = S.homeTab || 'inicio';
  return '<div class="chips">' + [['inicio', 'Inicio' + pendingBadge()], ['liga', 'Clasificación']].map(x => '<button class="btn' + (S.homeTab === x[0] ? ' on' : '') + '" data-act="homeTab" data-sub="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>'
    + (S.homeTab === 'liga' ? viewLeague() : viewHome());
}

/** The table and the results it comes from. Ours are never typed twice: they come from the report. */
function viewLeague() {
  const table = leagueTable();
  const games = leagueGames();
  const edit = can.league();
  let h = can.club() ? seasonBar() : '';
  if (edit) h += '<div class="row"><button class="btn primary wide" data-act="addRound"' + (rivals().length ? '' : ' disabled') + '>Jornadas: partidos y resultados</button></div>';
  const missing = leagueMissing();
  if (missing.length) {
    // Whoever fills in the report can go straight to the match; the rest just see which ones.
    h += '<div class="card todo"><div class="title">⚠️ ' + (missing.length === 1 ? 'A este partido le falta el resultado' : 'A estos partidos les falta el resultado') + '</div>'
      + missing.map(d => {
        const text = esc(d.title.trim() + ' · ' + shortDay(d.date));
        return can.report() ? '<button class="todo-line" data-act="todo" data-day="' + esc(d.id) + '"><span>' + text + '</span><span class="arrow">›</span></button>'
          : '<div class="line"><span>' + text + '</span></div>';
      }).join('') + '<div class="small">No cuentan en la tabla hasta que el acta tenga el resultado.</div></div>';
  }
  if (!table.length) return h + '<p class="small">Aún no hay resultados de liga. La directiva mete cada jornada con sus partidos; el nuestro sale también en Días para la convocatoria.</p>';
  const heads = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Pts'];
  h += '<div class="card standings"><table><thead><tr><th>#</th><th class="team">Equipo</th>' + heads.map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>'
    + table.map((r, i) => '<tr' + (r.own ? ' class="own"' : '') + '><td>' + (i + 1) + '</td><td class="team">' + esc(r.name) + '</td>'
      + [r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.goalDiff > 0 ? '+' + r.goalDiff : r.goalDiff].map(c => '<td>' + c + '</td>').join('')
      + '<td class="bold">' + r.points + '</td></tr>').join('') + '</tbody></table></div>';
  const last = leagueLastRound();
  const numbers = roundNumbers();
  const played = leaguePlayedRounds();
  // The jornada on screen: the one picked, else the last one played; 0 is "Todas".
  const picked = S.leagueRound === 0 || numbers.includes(S.leagueRound) ? S.leagueRound : null;
  const chosen = picked !== null && picked !== undefined ? picked : (last ? last.number : null);
  const shown = chosen === 0 ? null : chosen ? leagueRound(chosen) : last;
  const own = clubId();
  const gkey = g => [g.date, g.homeId, g.awayId, g.resultId].join('|');
  const line = g => {
    const score = '<span' + (g.homeId === own || g.awayId === own ? ' class="bold"' : '') + '>' + esc(g.home + ' ' + g.homeGoals + ' – ' + g.awayGoals + ' ' + g.away) + '</span>';
    const n = /^\d+$/.test(String(g.round || '').trim()) ? Number(g.round) : null;
    const ours = g.homeId === own || g.awayId === own;
    const body = '<span class="grow"><span class="small">' + esc([n ? 'J' + n : '', fdate(g.date), ours ? 'nuestro' : ''].filter(Boolean).join(' · ')) + '</span><br>' + score + '</span>';
    // A numbered match opens its jornada; an old typed-in one its own form. Only the directiva, in the active season.
    return edit && n ? '<div class="line tap edit" data-act="editRound" data-n="' + n + '">' + body + '<span class="pen" aria-label="Corregir">✏️</span></div>'
      : edit && g.resultId ? '<div class="line tap edit" data-act="editResult" data-id="' + esc(g.resultId) + '">' + body + '<span class="pen" aria-label="Corregir">✏️</span></div>'
        : '<div class="line">' + body + '</div>';
  };
  const span = r => (r && r.from ? (r.from === r.to ? fdate(r.from) : 'Del ' + fdate(r.from) + ' al ' + fdate(r.to)) : '');
  const picker = numbers.length
    ? '<select class="roundpick" data-chg="leagueRound" aria-label="Jornada"><option value="0"' + (chosen === 0 ? ' selected' : '') + '>Todas las jornadas</option>'
      + numbers.slice().sort((a, b) => b - a).map(n => '<option value="' + n + '"' + (chosen === n ? ' selected' : '') + '>Jornada ' + n + (played.includes(n) ? '' : ' · por jugar') + '</option>').join('') + '</select>'
    : '<h2>Última jornada</h2>';
  h += '<div class="row between">' + picker
    + (edit && shown && shown.number ? '<button class="btn sm" data-act="editRound" data-n="' + shown.number + '">Editar</button>' : '') + '</div>'
    + (shown && span(shown) ? '<div class="small">' + esc(span(shown)) + '</div>' : '');
  if (shown) {
    shown.pending.forEach(g => {
      h += '<div class="card todo"><div class="small">' + esc((g.date ? fdate(g.date) : 'Fecha por confirmar') + (g.ours ? ' · nuestro partido' : '')) + '</div>'
        + '<div' + (g.ours ? ' class="bold"' : '') + '>' + esc(g.home + ' – ' + g.away) + '</div>'
        + '<div class="small">' + (g.date && g.date > today() ? 'Por jugar' : '⚠️ Sin resultado: quizá aún no se ha jugado.') + '</div></div>';
    });
    if (shown.waiting.length) {
      h += '<div class="card todo"><div class="small">' + esc(shown.number
        ? 'Sin partido en esta jornada: ' + shown.waiting.join(', ') + '. Descansan o falta meterlo.'
        : '⚠️ Sin resultado esta jornada: ' + shown.waiting.join(', ') + '. Quizá aún no se ha jugado o descansan.') + '</div></div>';
    }
    // Results typed before jornadas had numbers: only by week, the rest on demand.
    const older = shown.number ? [] : games.filter(g => !shown.games.some(r => gkey(r) === gkey(g)));
    if (shown.games.length || (S.allResults && older.length)) h += '<div class="card">' + shown.games.concat(S.allResults ? older : []).map(line).join('') + '</div>';
    if (older.length) h += '<button class="btn wide" data-act="allResults">' + (S.allResults ? 'Ver solo la última jornada ▴' : 'Ver todos los resultados (' + older.length + ' más) ▾') + '</button>';
  } else {
    // "Todas": every jornada with a result, newest first; then any result with no jornada.
    played.forEach(n => {
      const r = leagueRound(n);
      h += '<div class="row between mt"><span class="bold">Jornada ' + n + '</span><span class="small">' + esc(span(r)) + '</span></div>'
        + '<div class="card">' + r.games.map(line).join('') + '</div>';
    });
    const loose = games.filter(g => !/^\d+$/.test(String(g.round || '').trim()));
    if (loose.length) h += '<div class="bold mt">Sin jornada</div><div class="card">' + loose.map(line).join('') + '</div>';
  }
  return h;
}

/** Every team of the league, us first: a jornada is typed in with all its matches, ours too. */
function allLeagueTeams() { return [clubTeam() || { id: CLUB_KEY, name: TEAM }].map(t => ({ id: t.id, name: t.name || TEAM })).concat(rivals()); }

/** Matches in a jornada: everyone plays once, so 12 teams make 6; with an odd number one rests. */
const roundSize = () => Math.max(1, Math.floor((rivals().length + 1) / 2));

/** The jornada numbers already used, in order. */
function roundNumbers() {
  const nums = leagueResults().map(r => r.round).concat(days().filter(d => d.match && d.session === 'Partido').map(d => d.round || ''))
    .filter(x => /^\d+$/.test(String(x).trim())).map(Number);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

/** The jornada to offer: the first one with a match still without score, else the next new one. */
function suggestedRound() {
  const used = roundNumbers();
  const open = used.find(n => roundGames(n).some(g => g.home && g.away && (g.hg === null || g.ag === null)));
  return open || ((used.length ? used[used.length - 1] : 0) + 1);
}

/**
 * The matches of jornada [n] as the editor shows them, ours first, then empty rows up to roundSize():
 * ours from its match day (score from the report), the rest from the typed-in results.
 */
function roundGames(n) {
  const own = clubId();
  const goals = v => (isWhole(v) ? Number(String(v).trim()) : null);
  const ours = days().filter(d => d.match && d.session === 'Partido' && String(d.round || '').trim() === String(n)).map(d => {
    const r = rivals().find(x => x.name.toLowerCase() === d.title.trim().toLowerCase());
    const rid = r ? r.id : '';
    return d.side === 'Visitante'
      ? { home: rid, away: own, hg: goals(d.ga), ag: goals(d.gf), date: d.date, resultId: '', dayId: d.id }
      : { home: own, away: rid, hg: goals(d.gf), ag: goals(d.ga), date: d.date, resultId: '', dayId: d.id };
  });
  const others = leagueResults().filter(r => r.round === String(n))
    .sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || a.date.localeCompare(b.date))
    .map(r => ({ home: r.homeId, away: r.awayId, hg: r.homeGoals, ag: r.awayGoals, date: r.date, resultId: r.id, dayId: '' }));
  const rows = ours.concat(others);
  while (rows.length < roundSize()) rows.push({ home: '', away: '', hg: null, ag: null, date: '', resultId: '', dayId: '' });
  return rows;
}

/** Same rules as the app: why a jornada cannot be saved yet, or '' when it can. */
function roundProblem(games) {
  const own = clubId();
  const full = games.filter(g => g.home && g.away);
  if (!full.length) return 'Elige los equipos de al menos un partido.';
  if (games.some(g => !!g.home !== !!g.away)) return 'Cada partido necesita los dos equipos.';
  const ids = full.flatMap(g => [g.home, g.away]);
  if (new Set(ids).size !== ids.length) return 'Un equipo no puede jugar dos veces en la misma jornada.';
  if (full.some(g => (g.hg === null) !== (g.ag === null))) return 'Pon los goles de los dos equipos, o de ninguno si no se ha jugado.';
  if (full.some(g => (g.home === own || g.away === own) && !g.date)) return 'Pon la fecha de nuestro partido: con ella sale en Días para la convocatoria.';
  return '';
}

/**
 * What saving jornada [n] writes: ours goes to its match day (created if it is not there yet, so it
 * shows in Días for the call-up) with the score in the report; the rest as typed-in results. A row
 * emptied that had a result removes it; our match day is never deleted from here.
 */
function roundOps(n, games) {
  const own = clubId();
  const ops = [];
  const str = v => (v === null ? '' : String(v));
  games.forEach(g => {
    if (!(g.home && g.away)) { if (g.resultId) ops.push({ t: 'Resultados liga', op: 'd', v: { 'ID': g.resultId } }); return; }
    if (g.home === own || g.away === own) {
      const home = g.home === own;
      const r = rivals().find(x => x.id === (home ? g.away : g.home));
      if (!r) return;
      if (g.resultId) ops.push({ t: 'Resultados liga', op: 'd', v: { 'ID': g.resultId } });
      const league = days().filter(d => d.match && d.session === 'Partido');
      const day = league.find(d => d.id === g.dayId) || league.find(d => String(d.round || '') === String(n))
        || league.find(d => d.date === g.date && d.title.trim().toLowerCase() === r.name.toLowerCase());
      const v = { 'ID': day ? day.id : uid(), 'Rival': r.name, 'Local/Visitante': home ? 'Local' : 'Visitante', 'Jornada': String(n),
        'Goles a favor': str(home ? g.hg : g.ag), 'Goles en contra': str(home ? g.ag : g.hg) };
      if (g.date) v['Fecha'] = g.date;
      if (!day) Object.assign(v, { 'Tipo': 'Liga', 'Hora partido': '', 'Temporada': activeSeason() });
      ops.push({ t: 'Partidos', op: 'u', v: v });
      return;
    }
    const old = g.resultId ? leagueResults().find(x => x.id === g.resultId) : null;
    ops.push({ t: 'Resultados liga', op: 'u', v: { 'ID': g.resultId || uid(), 'Fecha': g.date, 'Local ID': g.home, 'Visitante ID': g.away,
      'Goles local': str(g.hg), 'Goles visitante': str(g.ag), 'Jornada': String(n), 'Temporada': (old && old.season) || activeSeason() } });
  });
  return ops;
}

/**
 * A whole jornada: its number (‹ 5 ›) and every match, ours too, home on the left and away on the
 * right, each with its date and goals. "?" means not played yet. A team picked in another row is not
 * offered again. Ours becomes (or updates) its match day, so it shows in Días for the call-up.
 */
function roundDialog(start) {
  if (!can.league()) return;
  const own = clubId();
  const teams = allLeagueTeams();
  let n = start || suggestedRound();
  let games = roundGames(n);
  const read = () => {
    games.forEach((g, i) => {
      g.home = $('rdH' + i).value; g.away = $('rdA' + i).value; if (g.home === g.away) g.away = '';
      g.date = $('rdD' + i).value || '';
    });
  };
  const pick = (sid, i, sel, other) => {
    const taken = new Set(games.flatMap((g, j) => (j === i ? [] : [g.home, g.away])));
    return '<select id="' + sid + '" class="full"><option value="">Equipo</option>'
      + teams.filter(t => t.id === sel || (!taken.has(t.id) && t.id !== other))
        .map(t => '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>';
  };
  const step = (i, side) => {
    const v = games[i][side];
    return '<div class="row center"><button type="button" class="btn sm' + (v === null ? ' invisible' : '') + '" data-rg="' + i + '" data-side="' + side + '" data-step="-1"' + (v === null ? ' disabled' : '') + '>−</button>'
      + '<span class="title' + (v === null ? ' faint' : '') + '">' + (v === null ? '?' : v) + '</span><button type="button" class="btn sm" data-rg="' + i + '" data-side="' + side + '" data-step="1">+</button></div>';
  };
  const draw = () => {
    const problem = roundProblem(games);
    const started = games.some(g => g.home || g.away);
    return '<form method="dialog"><div class="row between"><button type="button" class="btn sm" data-rg="prev"' + (n > 1 ? '' : ' disabled') + '>‹</button>'
      + '<div class="title">Jornada ' + n + '</div><button type="button" class="btn sm" data-rg="next">›</button></div>'
      + '<div class="small">Todos los partidos de la jornada, el nuestro también: sale en Días para la convocatoria, la lista y el acta. «?» = aún no se ha jugado.</div>'
      + games.map((g, i) => {
        const ours = g.home === own || g.away === own;
        return '<div class="card round' + (ours ? ' ours' : '') + '"><div class="row between"><span class="small' + (ours ? ' bold' : '') + '">Partido ' + (i + 1) + (ours ? ' · nuestro' : '') + '</span>'
          + '<input id="rdD' + i + '" type="date" class="sm" value="' + esc(g.date) + '" aria-label="Fecha del partido ' + (i + 1) + '"></div>'
          + '<div class="pair"><div><label for="rdH' + i + '">Local</label>' + pick('rdH' + i, i, g.home, g.away) + step(i, 'hg') + '</div>'
          + '<div class="dash"></div>'
          + '<div><label for="rdA' + i + '">Visitante</label>' + pick('rdA' + i, i, g.away, g.home) + step(i, 'ag') + '</div></div></div>';
      }).join('')
      + '<button type="button" class="btn wide" data-rg="more">+ Otro partido</button>'
      + (problem && started ? '<div class="small warn">' + esc(problem) + '</div>' : '')
      + '<div class="row end"><button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok"' + (problem ? ' disabled' : '') + '>Guardar</button></div></form>';
  };
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-rg]');
      if (!b) return;
      const what = b.dataset.rg;
      if (what === 'prev' || what === 'next') { n = Math.max(1, n + (what === 'next' ? 1 : -1)); games = roundGames(n); dlg.innerHTML = draw(); return; }
      read();
      if (what === 'more') games.push({ home: '', away: '', hg: null, ag: null, date: '', resultId: '', dayId: '' });
      else {
        const g = games[Number(what)], side = b.dataset.side, other = side === 'hg' ? 'ag' : 'hg';
        const v = g[side];
        if (Number(b.dataset.step) > 0) { g[side] = v === null ? 0 : v + 1; if (g[other] === null) g[other] = 0; }
        else if (v === 0) { g.hg = null; g.ag = null; } else if (v !== null) g[side] = v - 1;
      }
      dlg.innerHTML = draw();
    };
    // Picking a team or a date redraws: the other lists leave the team out, and Guardar checks again.
    dlg.onchange = e => { if (!e.target || (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT')) return; read(); dlg.innerHTML = draw(); };
  }, () => {
    read();
    const problem = roundProblem(games);
    if (problem) { toast(problem); return false; }
    send(roundOps(n, games));
  });
}

/** Typing in or correcting a result between two other teams. Nothing is saved until "Guardar". */
function resultDialog(id) {
  if (!can.league()) return;
  const old = id ? leagueResults().find(r => r.id === id) : null;
  if (id && !old) return;
  const teams = rivals().slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  let date = old ? old.date : today(), home = old ? old.homeId : '', away = old ? old.awayId : '';
  const goals = { home: (old && old.homeGoals) || 0, away: (old && old.awayGoals) || 0 };
  const read = () => { date = $('lrDate').value || date; home = $('lrHome').value; away = $('lrAway').value; if (away === home) away = ''; };
  const pick = (sid, list, sel) => '<select id="' + sid + '" class="full"><option value="">Elige equipo</option>'
    + list.map(t => '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>';
  const stepper = side => '<div class="row"><span class="small">Goles</span><button type="button" class="btn sm" data-goal="' + side + '" data-step="-1"' + (goals[side] > 0 ? '' : ' disabled') + '>−</button>'
    + '<span class="title">' + goals[side] + '</span><button type="button" class="btn sm" data-goal="' + side + '" data-step="1">+</button></div>';
  const draw = () => '<form method="dialog"><div class="title">' + (old ? 'Corregir resultado' : 'Nuevo resultado') + '</div>'
    + '<label for="lrDate">Fecha</label><input id="lrDate" type="date" value="' + esc(date) + '">'
    + '<label for="lrHome">Local</label>' + pick('lrHome', teams, home) + stepper('home')
    + '<label for="lrAway">Visitante</label>' + pick('lrAway', teams.filter(t => t.id !== home), away) + stepper('away')
    + '<div class="row end">' + (old ? '<button type="button" class="btn danger" data-goal="delete">Borrar</button>' : '')
    + '<button type="button" class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok"' + (home && away && home !== away ? '' : ' disabled') + '>Guardar</button></div></form>';
  openDialog(draw(), dlg => {
    dlg.onclick = e => {
      const b = e.target.closest('[data-goal]');
      if (!b) return;
      read();
      if (b.dataset.goal === 'delete') {
        closeDialog();
        confirmDialog('¿Seguro?', 'Se borra el resultado ' + leagueTeamName(old.homeId) + ' ' + old.homeGoals + ' – ' + old.awayGoals + ' ' + leagueTeamName(old.awayId) + '. No se puede deshacer.', 'Borrar',
          () => send({ t: 'Resultados liga', op: 'd', v: { 'ID': old.id } }));
        return;
      }
      goals[b.dataset.goal] = Math.max(0, goals[b.dataset.goal] + Number(b.dataset.step));
      dlg.innerHTML = draw();
    };
    // Picking a team redraws: the away list leaves out the home team, and Guardar needs both.
    dlg.onchange = e => { if (!e.target || e.target.tagName !== 'SELECT') return; read(); dlg.innerHTML = draw(); };
  }, () => {
    read();
    if (!home || !away || home === away) { toast('Elige dos equipos distintos'); return false; }
    send({ t: 'Resultados liga', op: 'u', v: { 'ID': old ? old.id : uid(), 'Fecha': date, 'Local ID': home, 'Visitante ID': away,
      'Goles local': String(goals.home), 'Goles visitante': String(goals.away), 'Temporada': (old && old.season) || activeSeason() } });
  });
}
