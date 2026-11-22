'use strict';
// The player's own screens: next days with notices, what he owes, his profile. Every role has them.

function viewHome() {
  const me = S.yo.jugadorId;
  const t = today();
  const all = days(activeSeason());
  const upcoming = all.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  let h = '';
  if (!me) h += '<p class="small">Tu cuenta no está unida a ningún jugador. Pide a la directiva que ponga tu Jugador ID en la pestaña Usuarios.</p>';
  h += '<h2>Próximos días</h2>';
  if (!upcoming.length) h += '<p class="small">No hay nada apuntado todavía.</p>';
  upcoming.forEach(d => {
    const sq = d.match ? squad(d) : [];
    const called = !!me && sq.includes(me);
    // The squad is only shown once the coach or the directiva confirm it.
    const confirmed = d.match && d.confirmed && sq.length > 0;
    const n = me ? noticeOf(d.id, me) : null;
    h += '<div class="card"><div class="title">' + esc(dayTitle(d)) + '</div>';
    h += '<div class="small">' + esc([fdate(d.date), d.time ? 'a las ' + d.time : '', d.side].filter(Boolean).join(' · ')) + '</div>';
    if (d.meet) h += '<div class="small">Convocatoria: ' + esc(d.meet) + '</div>';
    if (d.ground) h += '<div class="small">' + esc(d.ground + (d.address ? ' · ' + d.address : '')) + '</div>';
    if (d.match && me) h += '<div class="small bold">' + (!confirmed ? 'Convocatoria aún sin confirmar' : called ? 'Estás convocado' : 'No estás convocado') + '</div>';
    if (confirmed && called) {
      const p = rows('Jugadores').find(r => r['ID'] === me);
      const keeper = p && isKeeper(p) ? keeperKits(me) : [];
      if (keeper.length) h += '<div class="small bold">Portero: trae siempre tus dos equipaciones, ' + esc(kitOptions(keeper)) + '</div>';
      else {
        const kit = matchKits().find(k => k.name === d.kit);
        if (kit) h += '<div class="small bold">Juegas con la ' + esc(kit.description) + '</div>';
        h += '<div class="small">Lleva siempre las dos equipaciones.</div>';
      }
    }
    if (confirmed) {
      const names = players().filter(p => sq.includes(p['ID'])).map(p => (p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre']);
      h += '<div class="small">Convocados (' + names.length + '): ' + esc(names.join(', ')) + '</div>';
    }
    if (n) h += '<div class="notice">' + esc(noticeText(n, null, true)) + '</div>';
    // Before the squad is confirmed anyone can warn; after, in a match only the squad warns.
    if (me && (!d.match || !confirmed || called)) {
      h += '<div class="row"><button class="btn" data-act="warn" data-type="No puedo ir" data-day="' + esc(d.id) + '" data-pid="' + esc(me) + '">No puedo ir</button>'
        + '<button class="btn" data-act="warn" data-type="Llego tarde" data-day="' + esc(d.id) + '" data-pid="' + esc(me) + '">Llego tarde</button></div>';
    }
    h += '<div>';
    if (n) h += '<button class="link" data-act="unwarn" data-day="' + esc(d.id) + '" data-pid="' + esc(me) + '">Quitar aviso</button>';
    if (/^https:\/\//.test(d.maps || '')) h += '<a class="link" href="' + esc(d.maps) + '" target="_blank" rel="noopener">Cómo llegar</a>';
    h += '<button class="link" data-act="ics" data-day="' + esc(d.id) + '">Añadir al calendario</button></div></div>';
  });
  const played = all.filter(d => d.match && d.date < t && d.gf !== '').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (played.length) {
    h += '<h2>Últimos resultados</h2>';
    played.forEach(d => {
      const goals = rows('Acta').filter(x => x['Partido ID'] === d.id && x['Tipo'] === 'Gol').map(x => playerName(x['Jugador ID']));
      h += '<div class="card"><div class="title">' + esc(TEAM + ' ' + d.gf + ' – ' + d.ga + ' ' + d.title) + '</div>'
        + '<div class="small">' + esc([fdate(d.date), goals.length ? 'Goles: ' + goals.join(', ') : ''].filter(Boolean).join(' · ')) + '</div></div>';
    });
  }
  return h;
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
  let h = '<div class="card"><div class="title">Lo que debo</div>';
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
  let h = '<div class="card"><div class="title">' + esc((p['Dorsal'] ? '#' + p['Dorsal'] + ' ' : '') + p['Nombre']) + '</div><div class="small">' + esc(p['Posición'] || '') + '</div></div>';
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
  if (d.match && d.meet) lines.push('DESCRIPTION:' + clean('Convocatoria: ' + normTime(d.meet)));
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
