/*
 * THE EMISSARY — LA PARTITA GUIDATA e LE REGOLETTE: prototipo di Chiara (terzo giro, 24/10/2026).
 * Script di SOLO PROTOTIPO. Si carica dopo engine.js, demo.js e copione.js, prima di app.js. Non contiene testi: li legge da copione.js.
 *
 * Cosa fa:
 *  1. Sostituisce `self.EmissaryDemo` con la partita guidata del copione: `nuova()` costruisce LA partita (regni, mano e mazzo decisi),
 *     `passi` sono i passi del copione nel formato che app.js già legge ({ testo, mossa, rifiuto, motivo }); nessuna scena a metà.
 *  2. Quando il giocatore tocca «Gioca» alla fine, la partita CONTINUA: avvolge `Emissary.nuova` perché, col seme «tutorial», restituisca
 *     lo stato in cui il tutorial è finito (rigiocando le mosse del copione col motore), e mette quel seme nell'indirizzo una volta sola.
 *  3. A ogni ridisegno: segna le fasi «leggi» (body.leggi), spezza il testo in titolo e paragrafi, PORTA IL TASTO AVANTI DENTRO IL CARTELLO
 *     (correzione 1 di Damiano), scrive «Tutorial» al posto di «Demo», mette il marchio del portale, e apre le regolette al posto della demo
 *     quando si tocca «Come si gioca».
 */
(function () {
  'use strict';
  var E = self.Emissary, C = self.EmissaryCopione;
  if (!E || !C) return;

  // ---------- 1. la partita guidata al posto della demo ----------
  function partita() {
    var P = C.partita;
    return E.costruisci({ seme: P.seme, regni: P.regni, fase: 'scegli', corrente: null, alleati: [], mano: P.mano, mazzo: P.mazzo });
  }
  var passi = C.passi.map(function (p) {
    var o = { testo: p.tipo === 'leggi' ? p.titolo + '\n' + p.bozza : p.bozza };
    if (p.mossa) { o.mossa = p.mossa; if (p.rifiuto) { o.rifiuto = true; o.motivo = p.motivo; } }
    return o;
  });
  self.EmissaryDemo = { nuova: partita, scena: function () { return partita(); }, passi: passi };

  // ---------- 2. la continuazione: dopo il tutorial si gioca la stessa partita ----------
  function statoDopoIlTutorial() {
    var s = partita();
    C.passi.forEach(function (p) { if (p.mossa && !p.rifiuto) { var n = E.apply(s, p.mossa); if (!n.rifiuto) s = n; } });
    return s;
  }
  var nuova0 = E.nuova;
  E.nuova = function (seme) {
    if (String(seme) !== 'tutorial') return nuova0(seme);
    // una volta sola: la prossima «Nuova partita» torna casuale
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]seme=tutorial/, '').replace(/^&/, '?')); } catch (e) { /* senza history va bene lo stesso */ }
    return statoDopoIlTutorial();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.azioni .conferma');
    if (!b || b.textContent.trim() !== 'Gioca' || !document.querySelector('.passo')) return;
    var q = location.search.replace(/[?&]seme=[^&]*/, '');
    try { history.replaceState(null, '', location.pathname + (q ? q + '&' : '?') + 'seme=tutorial'); } catch (e2) { /* idem */ }
  }, true);

  // ---------- il marchio del portale (segnaposto: i quattro semi in un quadrato; il portale non ha ancora un nome) ----------
  var MARCHIO = '<svg class="marchio" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"/><text x="7" y="12" font-size="9" text-anchor="middle" fill="currentColor">♠</text><text x="19" y="12" font-size="9" text-anchor="middle" fill="currentColor">♥</text><text x="7" y="23" font-size="9" text-anchor="middle" fill="currentColor">♣</text><text x="19" y="23" font-size="9" text-anchor="middle" fill="currentColor">♦</text></svg>';

  // ---------- le regolette (icone qui, testi nel copione) ----------
  var ICONE = {
    scopo: '<svg viewBox="0 0 64 56"><polygon points="8,40 8,16 18,28 26,12 32,24 38,12 46,28 56,16 56,40" fill="#E9B94A"/><rect x="8" y="40" width="48" height="10" fill="#C8203A"/><text x="32" y="48" font-size="8" font-weight="700" fill="#FBF7EC" text-anchor="middle" font-family="Barlow,sans-serif">1 2 3 4 5 6 7 8</text></svg>',
    presa: '<svg viewBox="0 0 64 56"><rect x="6" y="8" width="24" height="34" rx="3" fill="#FBF7EC"/><text x="18" y="31" font-size="16" fill="#D1202F" text-anchor="middle">♥</text><rect x="34" y="14" width="24" height="34" rx="3" fill="#FBF7EC"/><text x="46" y="37" font-size="16" fill="#D1202F" text-anchor="middle">♥</text><polygon points="29,30 36,26 36,34" fill="#E9B94A"/></svg>',
    vinci: '<svg viewBox="0 0 64 56"><polygon points="7,12 7,3 11,8 15,2 19,8 23,3 23,12" fill="#E9B94A"/><rect x="4" y="14" width="22" height="32" rx="3" fill="#FBF7EC"/><text x="15" y="36" font-size="15" fill="#D1202F" text-anchor="middle">♦</text><rect x="38" y="14" width="22" height="32" rx="3" fill="#FBF7EC"/><text x="49" y="36" font-size="15" fill="#141414" text-anchor="middle">♠</text><text x="49" y="11" font-size="12" fill="#FBF7EC" text-anchor="middle" font-weight="700" font-family="Barlow,sans-serif">8 › 7</text></svg>',
    fanti: '<svg viewBox="0 0 64 56"><g font-family="Barlow,sans-serif" font-weight="700" font-size="9"><rect x="2" y="10" width="13" height="36" rx="2" fill="#FBF7EC"/><text x="8.5" y="26" fill="#D1202F" text-anchor="middle">J</text><text x="8.5" y="40" fill="#D1202F" text-anchor="middle">♥</text><rect x="18" y="10" width="13" height="36" rx="2" fill="#FBF7EC"/><text x="24.5" y="26" fill="#141414" text-anchor="middle">J</text><text x="24.5" y="40" fill="#141414" text-anchor="middle">♣</text><rect x="34" y="10" width="13" height="36" rx="2" fill="#FBF7EC"/><text x="40.5" y="26" fill="#141414" text-anchor="middle">J</text><text x="40.5" y="40" fill="#141414" text-anchor="middle">♠</text><rect x="50" y="10" width="13" height="36" rx="2" fill="#FBF7EC"/><text x="56.5" y="26" fill="#D1202F" text-anchor="middle">J</text><text x="56.5" y="40" fill="#D1202F" text-anchor="middle">♦</text></g></svg>',
    alleato: '<svg viewBox="0 0 64 56"><rect x="20" y="4" width="24" height="34" rx="3" fill="#FBF7EC"/><text x="32" y="22" font-size="11" font-weight="700" fill="#D1202F" text-anchor="middle" font-family="Barlow,sans-serif">Q</text><text x="32" y="34" font-size="12" fill="#D1202F" text-anchor="middle">♦</text><polygon points="10,52 14,44 18,52" fill="#E9B94A"/><polygon points="46,52 50,44 54,52" fill="#E9B94A"/><rect x="10" y="50" width="44" height="4" fill="#E9B94A"/></svg>',
    fine: '<svg viewBox="0 0 64 56"><circle cx="18" cy="28" r="14" fill="#E9B94A"/><polyline points="11,28 16,33 25,22" fill="none" stroke="#121C44" stroke-width="4"/><circle cx="46" cy="28" r="14" fill="#141414"/><line x1="40" y1="22" x2="52" y2="34" stroke="#FBF7EC" stroke-width="4"/><line x1="52" y1="22" x2="40" y2="34" stroke="#FBF7EC" stroke-width="4"/></svg>'
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

  // ---------- 3. i pezzetti e il promemoria (stesso meccanismo di Syndicate: portale-giochi/design/pezzi.js) ----------
  function norm(x) { return x.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
  var INFO = {}; C.passi.forEach(function (p) { INFO[norm(p.tipo === 'leggi' ? p.titolo + ' ' + p.bozza : p.bozza)] = p; });
  function q(sel) { return [].slice.call(app.querySelectorAll(sel)); }
  function risolvi(k) {   // le cose da accendere sul tavolo di The Emissary
    var m;
    if (k === 'regni') return q('.regno');
    if (k === 'conti') return q('.conti');
    if (k === 'sovrano') return q('.sovrano');
    if (k === 'mano') return q('.mano .carta');
    if (k === 'fanti') { var p = q('.poteri'); return p.length ? [].slice.call(p[0].querySelectorAll('.potere')) : []; }
    if (k === 'alleati') { var p2 = q('.poteri'); return p2.length > 1 ? [].slice.call(p2[1].querySelectorAll('.potere')) : []; }
    if ((m = /^regno:(\d)$/.exec(k))) return q('.regno:nth-child(' + m[1] + ')');
    if ((m = /^carta:(\w+)$/.exec(k))) return q('.carta[aria-label="' + E.nomeCarta(E.daId(m[1])) + '"]');
    if ((m = /^pila:(.+)$/.exec(k))) return q('.pila').filter(function (x) { var n = x.querySelector('.nome'); return n && n.firstChild && n.firstChild.textContent === m[1]; });
    if ((m = /^fante:(\w)$/.exec(k))) return q('.potere[aria-label^="Fante di ' + E.NOME_SEME[m[1]] + '"]');
    if ((m = /^tasto:(.+)$/.exec(k))) return q('button').filter(function (x) { return x.textContent.trim() === m[1]; });
    return [];
  }
  var okDato = false, ultimoPasso = '';
  var pezzi = window.Pezzi({ app: app, risolvi: risolvi,
    etichettaFine: function () { var x = app.querySelector('.azioni .conferma'); return x ? x.textContent.trim() : 'Avanti'; },
    alFine: function (info) {
      if (info.tipo === 'leggi') { var x = app.querySelector('.azioni .conferma'); if (x) x.click(); }
      else { okDato = true; document.body.classList.remove('pezzi'); sistema(); window.dispatchEvent(new Event('resize')); }   // promemoria, modo «trova» se c'è, e vignetta
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
    if (passo && info && !passo.getAttribute('data-fatto')) {
      passo.setAttribute('data-fatto', '1'); passo.setAttribute('data-chiave', chiave);
      passo.textContent = ''; paragrafi(passo, [pezzi.ultimoTesto(info)]); passo.classList.add('promemoria');
      passo.addEventListener('click', function () { passo.classList.toggle('aperto'); });
    }
    var pu = app.querySelector('.punti span');
    if (pu && pu.textContent.indexOf('Demo: passo ') === 0) pu.textContent = pu.textContent.replace('Demo: passo ', 'Tutorial · ');
    var top = app.querySelector('.top');
    if (top && !top.querySelector('.marchio')) { var mk = document.createElement('span'); mk.innerHTML = MARCHIO; top.insertBefore(mk.firstChild, top.firstChild); }
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
