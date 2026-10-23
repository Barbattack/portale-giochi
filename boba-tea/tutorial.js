/*
 * THE FIRST BOBA TEA SHOP IN LONDON — LA PARTITA GUIDATA e LE REGOLETTE: prototipo di Chiara (23/10/2026, notte). Stessa strada maestra di
 * The Emissary e Syndicate. Script di SOLO PROTOTIPO. Si carica dopo engine.js, demo.js, copione.js, pezzi.js e spazi.js, prima di app.js.
 * Non contiene testi: li legge da copione.js.
 *
 *  1. Sostituisce `self.BobaDemo` con la partita guidata del copione (`nuova('tut-311')`, una partita vera dall'inizio), nel formato che app.js già legge.
 *  2. Alla fine, «Gioca» CONTINUA la stessa partita: avvolge `Boba.nuova` perché col seme «tutorial» restituisca lo stato in cui il tutorial è
 *     finito (rigiocando le mosse del copione col motore); il seme entra nell'indirizzo una volta sola e poi esce.
 *  3. A ogni ridisegno: i pezzetti (pezzi.js) con le cose accese, il promemoria in due righe, il modo «trova» (niente vignetta su coda e posto,
 *     aiuti solo se si sbaglia), «Tutorial» al posto di «Demo», il marchio del portale, le regolette quando si tocca «Come si gioca».
 */
(function () {
  'use strict';
  var B = self.Boba, C = self.BobaCopione;
  if (!B || !C) return;

  // ---------- 1. la partita guidata ----------
  function partita() { return B.nuova(C.partita.seme); }
  var passi = C.passi.map(function (p) {
    var o = { testo: p.tipo === 'leggi' ? p.titolo + '\n' + p.bozza : p.bozza };
    if (p.mossa) { o.mossa = p.mossa; if (p.rifiuto) { o.rifiuto = true; o.motivo = p.motivo; } }
    return o;
  });
  self.BobaDemo = { nuova: partita, passi: passi };

  // ---------- 2. la continuazione ----------
  function statoDopoIlTutorial() {
    var s = partita();
    C.passi.forEach(function (p) { if (p.mossa && !p.rifiuto) { var n = B.apply(s, p.mossa); if (!n.rifiuto) s = n; } });
    return s;
  }
  var nuova0 = B.nuova;
  B.nuova = function (seme, opzioni) {
    if (String(seme) !== 'tutorial') return nuova0(seme, opzioni);
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
    code: '<svg viewBox="0 0 64 56"><rect x="2" y="2" width="60" height="7" fill="#FFB627"/><g fill="#FBF7EC"><rect x="5" y="13" width="11" height="9" rx="1"/><rect x="5" y="24" width="11" height="9" rx="1"/><rect x="5" y="35" width="11" height="9" rx="1"/><rect x="20" y="13" width="11" height="9" rx="1"/><rect x="35" y="13" width="11" height="9" rx="1"/><rect x="35" y="24" width="11" height="9" rx="1"/><rect x="50" y="13" width="11" height="9" rx="1"/><rect x="50" y="24" width="11" height="9" rx="1"/><rect x="50" y="35" width="11" height="9" rx="1"/><rect x="50" y="46" width="11" height="8" rx="1"/></g><g font-family="Barlow,sans-serif" font-weight="700" font-size="7" fill="#141414"><text x="10.5" y="20" text-anchor="middle">9</text><text x="10.5" y="31" text-anchor="middle">4</text><text x="10.5" y="42" text-anchor="middle">2</text></g></svg>',
    turno: '<svg viewBox="0 0 64 56"><rect x="6" y="6" width="14" height="38" rx="2" fill="#FBF7EC"/><rect x="8" y="22" width="10" height="7" rx="1" fill="none" stroke="#FFB627" stroke-width="2" stroke-dasharray="2 2"/><text x="13" y="16" font-size="8" font-weight="700" fill="#141414" text-anchor="middle" font-family="Barlow,sans-serif">1</text><rect x="38" y="12" width="20" height="28" rx="3" fill="#B79BE0"/><rect x="41" y="15" width="14" height="22" rx="2" fill="none" stroke="#FFB627" stroke-width="1.5"/><polygon points="24,25 34,19 34,31" fill="#FFB627"/><text x="48" y="30" font-size="9" font-weight="700" fill="#141414" text-anchor="middle" font-family="Barlow,sans-serif">2</text></svg>',
    spazio: '<svg viewBox="0 0 64 56"><rect x="6" y="4" width="22" height="10" rx="1" fill="#FBF7EC"/><text x="17" y="12" font-size="8" font-weight="700" fill="#141414" text-anchor="middle" font-family="Barlow,sans-serif">8</text><rect x="6" y="42" width="22" height="10" rx="1" fill="#FBF7EC"/><text x="17" y="50" font-size="8" font-weight="700" fill="#D1202F" text-anchor="middle" font-family="Barlow,sans-serif">A</text><line x1="17" y1="16" x2="17" y2="40" stroke="#FFB627" stroke-width="2"/><text x="17" y="31" font-size="11" font-weight="700" fill="#FFB627" text-anchor="middle" font-family="Barlow,sans-serif">8</text><rect x="38" y="20" width="22" height="10" rx="1" fill="#FBF7EC"/><text x="49" y="28" font-size="8" font-weight="700" fill="#141414" text-anchor="middle" font-family="Barlow,sans-serif">K</text><line x1="49" y1="4" x2="49" y2="18" stroke="#FFB627" stroke-width="2"/><text x="56" y="13" font-size="10" font-weight="700" fill="#FFB627" text-anchor="middle" font-family="Barlow,sans-serif">1</text></svg>',
    maleducato: '<svg viewBox="0 0 64 56"><g fill="#FBF7EC"><rect x="4" y="6" width="14" height="10" rx="1"/><rect x="4" y="18" width="14" height="10" rx="1"/><rect x="4" y="30" width="14" height="10" rx="1"/></g><line x1="2" y1="4" x2="20" y2="42" stroke="#E0304A" stroke-width="3"/><line x1="20" y1="4" x2="2" y2="42" stroke="#E0304A" stroke-width="3"/><rect x="26" y="20" width="12" height="18" rx="2" fill="#FBF7EC"/><text x="32" y="33" font-size="10" font-weight="700" fill="#E0304A" text-anchor="middle" font-family="Barlow,sans-serif">5</text><rect x="44" y="14" width="16" height="30" rx="2" fill="#B79BE0"/><rect x="46" y="16" width="12" height="26" rx="1" fill="none" stroke="#FFB627" stroke-width="1.5"/><text x="52" y="52" font-size="8" font-weight="700" fill="#FBF7EC" text-anchor="middle" font-family="Barlow,sans-serif">−2</text></svg>',
    scarti: '<svg viewBox="0 0 64 56"><rect x="2" y="2" width="60" height="52" rx="4" fill="#121014"/><g font-family="Barlow,sans-serif" font-weight="700" font-size="7"><text x="8" y="16" fill="#BBA9D6">1×</text><text x="8" y="31" fill="#BBA9D6">2×</text><text x="8" y="47" fill="#E0304A">3×</text></g><g fill="#FBF7EC"><rect x="20" y="9" width="9" height="9" rx="1"/><rect x="31" y="9" width="9" height="9" rx="1"/><rect x="42" y="9" width="9" height="9" rx="1"/><rect x="20" y="24" width="9" height="9" rx="1"/><rect x="31" y="24" width="9" height="9" rx="1"/></g><rect x="20" y="40" width="9" height="9" rx="1" fill="#FBF7EC" stroke="#E0304A" stroke-width="1.5"/><text x="24.5" y="47" font-size="6" font-weight="700" fill="#141414" text-anchor="middle" font-family="Barlow,sans-serif">8</text></svg>',
    fine: '<svg viewBox="0 0 64 56"><circle cx="18" cy="28" r="14" fill="#FFB627"/><polyline points="11,28 16,33 25,22" fill="none" stroke="#141414" stroke-width="4"/><circle cx="46" cy="28" r="14" fill="#121014"/><line x1="40" y1="22" x2="52" y2="34" stroke="#E0304A" stroke-width="4"/><line x1="52" y1="22" x2="40" y2="34" stroke="#E0304A" stroke-width="4"/></svg>'
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

  // ---------- 3. i pezzetti, il promemoria, il modo «trova», gli aiuti ----------
  var app = document.getElementById('app');
  function norm(s) { return s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
  var INFO = {}; C.passi.forEach(function (p) { INFO[norm(p.tipo === 'leggi' ? p.titolo + ' ' + p.bozza : p.bozza)] = p; });
  function q(sel) { return [].slice.call(app.querySelectorAll(sel)); }
  function primoTesto(el) { var t = ''; [].slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 3) t += n.textContent; }); return t.trim(); }
  // le cose da accendere sul tavolo, dalle chiavi del copione agli elementi (portale-giochi/design/pezzi.js)
  function risolvi(k) {
    var m;
    if (k === 'bancone') return q('.bancone');
    if (k === 'code') return q('.coda .testa');
    if (k === 'carte') return q('.cs:not(.fantasma)');
    if (k === 'spazi') return q('.sp, .slot[data-pos]');
    if (k === 'mano') return q('.inmano .carta');
    if (k === 'mazzo') return q('.pila');
    if (k === 'scarti') return q('.scarti');
    if ((m = /^coda:(\d)$/.exec(k))) return q('.coda:nth-of-type(' + m[1] + ')');
    if ((m = /^spazio:(\d):(\d+)$/.exec(k))) return q('.coda:nth-of-type(' + m[1] + ') .sp[data-pos="' + m[2] + '"], .coda:nth-of-type(' + m[1] + ') .slot[data-pos="' + m[2] + '"]');
    if ((m = /^fila:(\d)$/.exec(k))) return q('.scarti .fila:nth-of-type(' + m[1] + ')');
    if ((m = /^carta:(\w+)$/.exec(k))) return q('[aria-label="' + B.nomeCarta(B.daId(m[1])) + '"]');
    if ((m = /^tasto:(.+)$/.exec(k))) return q('button').filter(function (x) { return primoTesto(x) === m[1]; });
    return [];
  }
  var okDato = false, ultimoPasso = '';
  function tastoFine() { return app.querySelector('.passo ~ .azioni .conferma'); }   // l'Avanti / Gioca di app.js, non il «Conferma e pesca» del tavolo
  var pezzi = window.Pezzi({ app: app, risolvi: risolvi,
    etichettaFine: function () { var x = tastoFine(); return x ? x.textContent.trim() : 'Avanti'; },
    alFine: function (info) {
      if (info.tipo === 'leggi') { var x = tastoFine(); if (x) x.click(); }
      else { okDato = true; document.body.classList.remove('pezzi'); sistema(); window.dispatchEvent(new Event('resize')); }   // promemoria, modo «trova» se c'è, e vignetta
    } });
  function testoDi(passo) {
    if (passo.getAttribute('data-chiave')) return passo.getAttribute('data-chiave');
    var c = passo.cloneNode(true); [].slice.call(c.querySelectorAll('.azioni, .istruzione')).forEach(function (x) { x.parentNode.removeChild(x); }); return c.textContent;
  }
  function paragrafi(passo, righe) {
    righe.forEach(function (r) {
      if (!r.trim()) return;
      var p = document.createElement('p');
      r.split(/\*\*/).forEach(function (pezzo, i) { if (i % 2) { var bb = document.createElement('b'); bb.textContent = pezzo; p.appendChild(bb); } else p.appendChild(document.createTextNode(pezzo)); });
      passo.appendChild(p);
    });
  }
  // gli aiuti del turno «trova»: «Non ancora: tocca la coda N» / «tocca il posto …» diventano il ragionamento, senza la risposta
  function aiuta(msg, trova) {
    var t = msg.textContent, prima = t;
    if (trova && /^Non ancora: tocca la coda/.test(t)) msg.textContent = C.aiuti.coda;
    else if (trova && /^Non ancora: tocca il posto/.test(t)) msg.textContent = C.aiuti.posto;
    if (msg.textContent !== prima) msg.scrollIntoView({ block: 'center' });   // l'aiuto si vede dove si è sbagliato
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
    var pu = app.querySelector('.punti span');
    if (pu && pu.textContent.indexOf('Demo: passo ') === 0) pu.textContent = pu.textContent.replace('Demo: passo ', 'Tutorial · ');
    var top = app.querySelector('.top');
    if (top && !top.querySelector('.marchio')) { var mk = document.createElement('span'); mk.innerHTML = MARCHIO; top.insertBefore(mk.firstChild, top.firstChild); }
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
