'use strict';
// The player's own screens: next days with notices, what he owes, his profile. Every role has them.

function viewHome() {
  const me = S.yo.jugadorId;
  const t = today();
  const all = days(activeSeason());
  const upcoming = all.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  let h = '';
  if (!me) h += '<p class="small">Tu cuenta no está unida a ningún jugador. Pide a la directiva que ponga tu Jugador ID en la pestaña Usuarios.</p>';
  // What the player still owes in fines, to be paid before the next match.
  const owed = me ? fines(f => f.player === me).reduce((s, f) => s + f.rest, 0) : 0;
  if (owed > 0) h += '<div class="card"><span class="bold warn">Llevas ' + money(owed) + ' sin pagar en multas. Págalas antes del próximo partido.</span></div>';
  // For the staff, what is left to do comes first, each a tap from its day.
  h += todoCard(todoList());
  const meRow = me ? rows('Jugadores').find(r => r['ID'] === me) : null;
  const meCoach = isCoach(meRow);
  const nextMatch = upcoming.find(d => d.match && d.gf === '');
  // The first day still without my answer, if it is not the match: right at the top, so nobody forgets.
  const toAnswer = me ? upcoming.find(d => d !== nextMatch && !noticeOf(d.id, me) && canAnswer(d, me, meCoach)) : null;
  if (toAnswer) h += '<h2>Te falta responder</h2>' + dayCard(toAnswer, me, meCoach, false);
  // The next match, big, with the answer right there; it is not repeated below.
  if (nextMatch) h += dayCard(nextMatch, me, meCoach, true);
  // Matches still being voted, where this player was called up.
  if (me) allDays().filter(d => voteOpen(d) && squad(d).includes(me)).forEach(d => { h += voteCard(d, me); });
  h += birthdayCard();
  if (me) h += attendanceCard(me);
  if (meCoach) h += coachCard(me);
  const rest = upcoming.filter(d => d !== nextMatch && d !== toAnswer);
  if (rest.length) h += '<h2>Próximos días</h2>';
  if (!upcoming.length) h += '<p class="small">No hay nada apuntado todavía.</p>';
  rest.forEach(d => { h += dayCard(d, me, meCoach, false); });
  const played = all.filter(d => d.match && d.date < t && d.gf !== '').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (played.length) {
    h += '<h2>Últimos resultados</h2>';
    played.forEach(d => {
      const goals = rows('Acta').filter(x => x['Partido ID'] === d.id && x['Tipo'] === 'Gol').map(x => playerName(x['Jugador ID']));
      const mvps = rows('Acta').filter(x => x['Partido ID'] === d.id && x['Tipo'] === 'MVP').map(x => playerName(x['Jugador ID']));
      h += '<div class="card"><div class="title">' + esc(TEAM + ' ' + d.gf + ' – ' + d.ga + ' ' + d.title) + '</div>'
        + '<div class="small">' + esc([fdate(d.date), goals.length ? 'Goles: ' + goals.join(', ') : '', mvps.length ? 'MVP: ' + mvps.join(' y ') + ' ⭐' : '', ledText(d.id)].filter(Boolean).join(' · ')) + '</div></div>';
    });
  }
  return h;
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
  const answers = canAnswer(d, me, meCoach);
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
  if (answers) {
    // One row, the main answer first; the chosen one is filled, and tapping it again takes it back.
    h += '<div class="answer">' + ANSWERS.map(a => {
      const chosen = !!n && n['Tipo'] === a[0];
      const main = chosen || (!n && a[0] === 'Asistiré');
      return '<button class="btn' + (main ? ' primary' : '') + '" data-act="' + (chosen ? 'unwarn' : 'warn') + '" data-type="' + esc(a[0]) + '" data-day="' + esc(d.id) + '" data-pid="' + esc(me) + '">'
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
    ds.filter(d => d.match && d.date >= iso && d.date <= week && !d.confirmed).forEach(d => {
      const w = whoCounts(d);
      out.push({ text: 'Convocatoria sin confirmar: ' + dayTitle(d) + ' del ' + shortDay(d.date) + ' · ✅' + w.going.length + ' ❔' + w.silent.length, day: d.id });
    });
  }
  if (can.report()) {
    ds.filter(d => d.match && d.date >= lastWeeks && d.date < iso && calledUp(d).length).filter(d => {
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
  return '<div class="row between"><span class="gold small bold">PRÓXIMO ' + esc(d.label.toUpperCase()) + '</span><span class="pill">' + count + '</span></div>'
    + '<div class="match-title">' + esc(title) + '</div><div class="gold">' + esc(when) + '</div>'
    + (g.ground ? '<div class="small">📍 ' + esc(g.ground) + '</div>' : '')
    + (kit ? '<div class="small">👕 ' + esc(kit.name) + '</div>' : '');
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
  const w = d.match && voteWindow(d);
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
