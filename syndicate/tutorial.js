/*
 * SYNDICATE — LA PARTITA GUIDATA e LE REGOLETTE: prototipo di Chiara (23/10/2026). Stessa strada maestra di The Emissary.
 * Script di SOLO PROTOTIPO. Si carica dopo engine.js, demo.js e copione.js, prima di app.js. Non contiene testi: li legge da copione.js.
 *
 *  1. Sostituisce `self.SyndicateDemo` con la partita guidata del copione (la stesura del libro, p. 40), nel formato che app.js già legge.
 *  2. Alla fine, «Gioca» CONTINUA la stessa partita: avvolge `Syndicate.nuova` perché col seme «tutorial» restituisca lo stato in cui il
 *     tutorial è finito (rigiocando le mosse del copione col motore); il seme entra nell'indirizzo una volta sola e poi esce.
 *  3. A ogni ridisegno: le fasi «leggi» (cartello, tavolo spento, Avanti nel cartello), la fase «spiega» di ogni passo «gioca» (il perché a
 *     schermo oscurato con l'Ok nel cartello, poi la vignetta), «Tutorial» al posto di «Demo», il marchio del portale, le regolette al posto
 *     della demo quando si tocca «Come si gioca».
 */
(function () {
  'use strict';
  var S = self.Syndicate, C = self.SyndicateCopione;
  if (!S || !C) return;

  // ---------- 1. la partita guidata ----------
  function partita() { return S.nuova(C.partita.seme); }   // una partita vera del motore, sempre la stessa (cercata in prova/cerca-stesura.js)
  var passi = C.passi.map(function (p) {
    var o = { testo: p.tipo === 'leggi' ? p.titolo + '\n' + p.bozza : p.bozza };
    if (p.mossa) { o.mossa = p.mossa; if (p.rifiuto) { o.rifiuto = true; o.motivo = p.motivo; } }
    return o;
  });
  self.SyndicateDemo = { nuova: partita, scena: function () { return partita(); }, passi: passi };

  // ---------- 2. la continuazione ----------
  function statoDopoIlTutorial() {
    var s = partita();
    C.passi.forEach(function (p) { if (p.mossa && !p.rifiuto) { var n = S.apply(s, p.mossa); if (!n.rifiuto) s = n; } });
    return s;
  }
  var nuova0 = S.nuova;
  S.nuova = function (seme) {
    if (String(seme) !== 'tutorial') return nuova0(seme);
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]seme=tutorial/, '').replace(/^&/, '?')); } catch (e) { /* senza history va bene lo stesso */ }
    return statoDopoIlTutorial();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.azioni .conferma');
    if (!b || b.textContent.trim() !== 'Gioca' || !document.querySelector('.passo')) return;
    var q = location.search.replace(/[?&]seme=[^&]*/, '');
    try { history.replaceState(null, '', location.pathname + (q ? q + '&' : '?') + 'seme=tutorial'); } catch (e2) { /* idem */ }
  }, true);

  // ---------- il marchio del portale (segnaposto: i quattro semi in un quadrato) ----------
  var MARCHIO = '<svg class="marchio" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"/><text x="7" y="12" font-size="9" text-anchor="middle" fill="currentColor">♠</text><text x="19" y="12" font-size="9" text-anchor="middle" fill="currentColor">♥</text><text x="7" y="23" font-size="9" text-anchor="middle" fill="currentColor">♣</text><text x="19" y="23" font-size="9" text-anchor="middle" fill="currentColor">♦</text></svg>';

  // ---------- le regolette (icone qui, testi nel copione) ----------
  var ICONE = {
    scopo: '<svg viewBox="0 0 64 56"><polygon points="2,52 2,42 14,42 14,32 26,32 26,22 38,22 38,12 50,12 50,2 62,2 62,52" fill="#C9712A"/><g font-family="Barlow,sans-serif" font-weight="700" font-size="8" fill="#111"><text x="8" y="50">5</text><text x="20" y="40">4</text><text x="32" y="30">3</text><text x="44" y="20">2</text><text x="56" y="10">1</text></g></svg>',
    zone: '<svg viewBox="0 0 64 56"><rect x="6" y="3" width="52" height="24" fill="#26262E" stroke="#C9712A" stroke-width="2"/><g fill="#EFE9DC"><rect x="11" y="8" width="12" height="14" rx="1"/><rect x="26" y="8" width="12" height="14" rx="1"/><rect x="41" y="8" width="12" height="14" rx="1"/></g><rect x="6" y="31" width="52" height="22" fill="#101014" stroke="#A09C92" stroke-width="1"/><g fill="#EFE9DC"><rect x="11" y="36" width="12" height="12" rx="1"/><rect x="26" y="36" width="12" height="12" rx="1"/><rect x="41" y="36" width="12" height="12" rx="1"/></g></svg>',
    promozione: '<svg viewBox="0 0 64 56"><rect x="4" y="30" width="24" height="22" fill="#26262E" stroke="#C9712A" stroke-width="2"/><rect x="36" y="4" width="24" height="22" fill="#26262E" stroke="#C9712A" stroke-width="2"/><rect x="11" y="35" width="10" height="13" rx="1" fill="#EFE9DC"/><polygon points="26,33 40,19 40,25 48,25 48,13 40,13 40,19" fill="#C9712A"/><polyline points="24,36 44,16" stroke="#C9712A" stroke-width="4" fill="none"/><polygon points="46,10 48,22 38,20" fill="#C9712A"/></svg>',
    sostituto: '<svg viewBox="0 0 64 56"><g font-family="Barlow,sans-serif" font-weight="700" fill="#EFE9DC"><text x="32" y="20" font-size="13" text-anchor="middle">5 + 4 = 9</text><text x="32" y="40" font-size="13" text-anchor="middle">5 × 4 = 2<tspan fill="#C9712A">0</tspan></text></g><rect x="4" y="48" width="56" height="3" fill="#C9712A"/></svg>',
    sacrificio: '<svg viewBox="0 0 64 56"><g fill="#EFE9DC"><rect x="3" y="14" width="12" height="28" rx="1"/><rect x="18" y="14" width="12" height="28" rx="1"/><rect x="33" y="14" width="12" height="28" rx="1"/><rect x="48" y="14" width="12" height="28" rx="1"/></g><line x1="48" y1="14" x2="60" y2="42" stroke="#D7263D" stroke-width="4"/><line x1="60" y1="14" x2="48" y2="42" stroke="#D7263D" stroke-width="4"/></svg>',
    punti: '<svg viewBox="0 0 64 56"><circle cx="20" cy="28" r="15" fill="#C9712A"/><text x="20" y="34" font-size="17" font-weight="700" fill="#111" text-anchor="middle" font-family="Barlow,sans-serif">0</text><text x="48" y="24" font-size="9" font-weight="700" fill="#EFE9DC" text-anchor="middle" font-family="Barlow,sans-serif">meno</text><text x="48" y="36" font-size="9" font-weight="700" fill="#EFE9DC" text-anchor="middle" font-family="Barlow,sans-serif">è meglio</text></svg>'
  };
  var passa = false;
  function apriRegole() {
    chiudiRegole();
    var r = document.createElement('div'); r.className = 'regole'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-label', 'Come si gioca');
    var d = document.createElement('div'); d.className = 'dentro';
    d.innerHTML = '<h2>Come si gioca</h2><ol>' + C.regole.map(function (q) { return '<li>' + ICONE[q[0]] + '<div><b>' + q[1] + '</b><span>' + q[2] + '</span></div></li>'; }).join('') + '</ol>';
    var az = document.createElement('div'); az.className = 'azioni';
    var b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'chiudi'; b1.textContent = 'Torna al tavolo'; b1.addEventListener('click', chiudiRegole);
    var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'conferma'; b2.textContent = 'Impara giocando';
    b2.addEventListener('click', function () { chiudiRegole(); var b = tastoComeSiGioca(); if (b) { passa = true; b.click(); passa = false; } });
    az.appendChild(b1); az.appendChild(b2); d.appendChild(az); r.appendChild(d); document.body.appendChild(r);
    window.scrollTo(0, 0);
  }
  function chiudiRegole() { var r = document.querySelector('.regole'); if (r) r.parentNode.removeChild(r); }
  function tastoComeSiGioca() { return [].slice.call(document.querySelectorAll('.top .mini')).filter(function (b) { return b.textContent.trim() === 'Come si gioca'; })[0] || null; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.top .mini');
    if (!b || passa || b.textContent.trim() !== 'Come si gioca') return;
    e.preventDefault(); e.stopImmediatePropagation(); apriRegole();
  }, true);

  // ---------- 3. fasi, titoli, il tasto dentro il cartello, l'Ok ----------
  var app = document.getElementById('app');
  var ultimoPasso = '', okDato = false;

  // ---------- le parole nuove (decise da Damiano, 23/10): sullo schermo, ovunque app.js e il motore scrivano quelle vecchie ----------
  var LIVELLI = { 5: 'Soldato', 4: 'Capodecina', 3: 'Consigliere', 2: 'Sottocapo', 1: 'Boss' };
  var PAROLE = [
    [/\bGrado ([1-5])\b/g, function (m, n) { return LIVELLI[n]; }],
    [/\b(?:il |al |nel |dal |del )?grado ([1-5])\b/g, function (m, n) { var pre = m.split(' ')[0]; var art = { il: 'il livello', al: 'al livello', nel: 'nel livello', dal: 'dal livello', del: 'del livello' }[pre]; return (art || 'livello') + ' ' + LIVELLI[n]; }],
    [/\bFra i membri\b/g, 'Fra gli affiliati'], [/\bfra i membri\b/g, 'fra gli affiliati'], [/\bFra i candidati\b/g, 'Fra gli aspiranti'], [/\bfra i candidati\b/g, 'fra gli aspiranti'],
    [/\bi membri\b/g, 'gli affiliati'], [/\bi candidati\b/g, 'gli aspiranti'], [/\bMembri\b/g, 'Affiliati'], [/\bCandidati\b/g, 'Aspiranti'],
    [/\bmembri\b/g, 'affiliati'], [/\bmembro\b/g, 'affiliato'], [/\bcandidati\b/g, 'aspiranti'], [/\bcandidato\b/g, 'aspirante'],
    [/\bbanda\b/g, 'famiglia'], [/\bgradi\b/g, 'livelli'], [/\bgrado\b/g, 'livello'], [/\bun agente\b/g, 'un tuo uomo']
  ];
  function rinomina(radice) {
    var w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT), nodi = [];
    while (w.nextNode()) nodi.push(w.currentNode);
    nodi.forEach(function (n) {
      if (n.parentElement && n.parentElement.closest('.passo, .regole, .vignetta')) return;   // i miei testi usano già le parole nuove
      var v = n.textContent, o = v;
      PAROLE.forEach(function (p) { v = v.replace(p[0], p[1]); });
      if (v !== o) n.textContent = v;
    });
  }

  // ---------- il copione, passo per passo: dal testo che app.js mostra si risale al passo (tipo, modo) ----------
  function norm(s) { return s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
  var INFO = {}; C.passi.forEach(function (p) { INFO[norm(p.tipo === 'leggi' ? p.titolo + ' ' + p.bozza : p.bozza)] = p; });
  function cifra(txt) { var v = txt.replace(/[♠♥♦♣\s]/g, ''); return v === 'A' ? 1 : (+v) % 10; }
  function numeri(testo, a, b) {
    var s = (a + b) % 10, p = (a * b) % 10;
    return testo.replace('{a}', a === 0 ? '10 (che conta zero)' : a).replace('{b}', b === 0 ? '10 (che conta zero)' : b).replace('{s}', s).replace('{p}', p);
  }
  function restanti() {   // i due affiliati che restano se sale quello scelto (.carta.scelta nel riquadro degli affiliati)
    var sc = app.querySelector('.zona.membri .carta.scelta'); if (!sc) return null;
    var altri = [].slice.call(sc.parentNode.querySelectorAll('.carta')).filter(function (c) { return c !== sc; });
    if (altri.length !== 2) return null;
    return [cifra(altri[0].textContent), cifra(altri[1].textContent)];
  }
  // gli aiuti: il rifiuto del motore detto coi numeri veri (sempre); nel turno «trova», «Non ancora: tocca X» diventa il ragionamento, senza la risposta
  function aiuta(msg, trova) {
    var t = msg.textContent, r, prima = t;
    var fine = function () { if (msg.textContent !== prima) msg.scrollIntoView({ block: 'center' }); };   // l'aiuto si vede dove si è sbagliato: la pagina scorre fino a lui
    if (/Non vale: il sostituto/.test(t)) {
      r = restanti(); if (!r) return;
      var uno = (r[0] + r[1]) % 10 === (r[0] * r[1]) % 10;
      msg.textContent = numeri(uno ? C.aiuti.rifiutoUno : C.aiuti.rifiuto, r[0], r[1]);
    } else if (trova && /^Non ancora: tocca /.test(t)) {
      if (!app.querySelector('.zona.membri .carta.scelta')) msg.textContent = C.aiuti.affiliato;
      else if (!app.querySelector('.due button.scelta')) msg.textContent = C.aiuti.destinazione;
      else { r = restanti(); if (!r) return; var u = (r[0] + r[1]) % 10 === (r[0] * r[1]) % 10; msg.textContent = numeri(u ? C.aiuti.sostitutoUno : C.aiuti.sostituto, r[0], r[1]); }
    }
    fine();
  }

  // ---------- 3. i pezzetti, il promemoria, il modo «trova» ----------
  // le cose da accendere sul tavolo, dalle chiavi del copione agli elementi (portale-giochi/design/pezzi.js)
  var LIV = { Soldato: 1, Capodecina: 2, Consigliere: 3, Sottocapo: 4, Boss: 5 };
  function q(sel) { return [].slice.call(app.querySelectorAll(sel)); }
  function risolvi(k) {
    var m;
    if (k === 'scalinata') return q('.gtit');
    if (k === 'resto') return q('.resto .carta');
    if (k === 'punti') return q('.punti');
    if (k === 'arrendo') return q('.quieto');
    if ((m = /^livello:(\w+)$/.exec(k))) return q('.grado:nth-child(' + LIV[m[1]] + ') .gtit');
    if ((m = /^(zona-)?(affiliati|aspiranti):(\w+)$/.exec(k))) {
      var z = q('.grado:nth-child(' + LIV[m[3]] + ') .zona.' + (m[2] === 'affiliati' ? 'membri' : 'cand'));
      if (m[1] || !z.length) return z;
      var c = [].slice.call(z[0].querySelectorAll('.carta')); return c.length ? c : z;
    }
    if ((m = /^carta:(\w+)$/.exec(k))) return q('.carta[aria-label="' + S.nomeCarta(S.daId(m[1])) + '"]');
    if ((m = /^tasto:(.+)$/.exec(k))) return q('button').filter(function (x) { return x.textContent.trim() === m[1]; });
    return [];
  }
  var okDato = false, ultimoPasso = '';
  var pezzi = window.Pezzi({ app: app, risolvi: risolvi,
    etichettaFine: function () { var x = app.querySelector('.azioni .conferma'); return x ? x.textContent.trim() : 'Avanti'; },
    alFine: function (info) {
      if (info.tipo === 'leggi') { var x = app.querySelector('.azioni .conferma'); if (x) x.click(); }   // l'Avanti / Gioca di app.js
      else { okDato = true; document.body.classList.remove('pezzi'); sistema(); window.dispatchEvent(new Event('resize')); }   // promemoria, modo «trova» se c'è, e vignetta                                  // ora la vignetta, un tocco alla volta
    } });
  function testoDi(passo) {
    if (passo.getAttribute('data-chiave')) return passo.getAttribute('data-chiave');
    var c = passo.cloneNode(true); var x = c.querySelector('.azioni'); if (x) x.parentNode.removeChild(x); return c.textContent;
  }
  function paragrafi(passo, righe) {
    righe.forEach(function (r) {
      if (!r.trim()) return;
      var p = document.createElement('p');
      r.split(/\*\*/).forEach(function (pezzo, i) { if (i % 2) { var bb = document.createElement('b'); bb.textContent = pezzo; p.appendChild(bb); } else p.appendChild(document.createTextNode(pezzo)); });
      passo.appendChild(p);
    });
  }
  function sistema() {
    var passo = app.querySelector('.passo');
    var chiave = passo ? norm(testoDi(passo)) : '';
    var info = passo ? INFO[chiave] : null;
    var nuovo = chiave !== ultimoPasso; ultimoPasso = chiave;
    if (nuovo) okDato = false;
    var inPezzi = !!info && !okDato && pezzi.mostra(info, nuovo);
    if (!info && pezzi.attivi()) pezzi.chiudi();
    document.body.classList.toggle('pezzi', inPezzi);
    document.body.classList.remove('leggi', 'spiega');
    if (passo && info && !passo.getAttribute('data-fatto')) {      // il promemoria: l'ultimo pezzetto, in due righe; si tocca per aprirlo
      passo.setAttribute('data-fatto', '1'); passo.setAttribute('data-chiave', chiave);
      passo.textContent = ''; paragrafi(passo, [pezzi.ultimoTesto(info)]); passo.classList.add('promemoria');
      passo.addEventListener('click', function () { passo.classList.toggle('aperto'); });
    }
    var trova = !!info && info.modo === 'trova' && !inPezzi;
    if (document.body.classList.contains('trova') !== trova) { document.body.classList.toggle('trova', trova); window.dispatchEvent(new Event('resize')); }
    var msg = app.querySelector('.msg'); if (msg) aiuta(msg, !!info && info.modo === 'trova');
    rinomina(app);
    var pu = app.querySelector('.punti span');
    if (pu && pu.textContent.indexOf('Demo: passo ') === 0) pu.textContent = pu.textContent.replace('Demo: passo ', 'Tutorial · ');
    var top = app.querySelector('.top');
    if (top && !top.querySelector('.marchio')) { var mk = document.createElement('span'); mk.innerHTML = MARCHIO; top.insertBefore(mk.firstChild, top.firstChild); }
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
