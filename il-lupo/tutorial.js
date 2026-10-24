/*
 * IL LUPO — IL TUTORIAL A PEZZETTI (Erbottega, 24/10/2026). Si carica dopo engine.js, copione.js, demo.js e pezzi.js, prima di app.js.
 * Non contiene testi: li legge da copione.js. Fa tre cose, appoggiandosi al DOM che app.js disegna:
 *   1. ogni passo si racconta un pezzetto alla volta (pezzi.js): il cartello sta in basso, la cosa di cui parla si accende sul tavolo, e il
 *      pezzetto dopo arriva solo quando si tocca Ok; la traduzione delle chiavi del copione in elementi è `risolvi`;
 *   2. finiti i pezzetti di un passo «gioca», l'ultimo resta in alto in due righe (il promemoria: non copre il tavolo, si tocca per aprirlo)
 *      e arriva la vignetta TOCCA di vignette.js (che legge il primo `.suggerita` che app.js segna);
 *   3. nei passi «leggi» l'ultimo Ok fa da Avanti (o da Continua, all'ultimo).
 * Il turno «trova» non ha niente di suo qui: app.js non segna ciò che il giocatore deve trovare, e gli aiuti li dà app.js dal copione.
 */
(function () {
  'use strict';
  var C = self.LupoCopione;
  if (!C || !window.Pezzi) return;
  var app = document.getElementById('app');

  // ---------- il copione nel formato di pezzi.js ----------
  var INFO = C.passi.map(function (p) {
    return { tipo: p.tipo, titolo: p.titolo, modo: p.modo, pezzi: p.pezzi, bozza: p.pezzi.map(function (z) { return z.testo; }).join('\n') };
  });

  function q(sel) { return [].slice.call(app.querySelectorAll(sel)); }
  function primoTesto(el) { var t = ''; [].slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 3) t += n.textContent; }); return t.trim(); }
  // le cose da accendere sul tavolo, dalle chiavi del copione agli elementi
  function risolvi(k) {
    var m;
    if (k === 'lupo') return q('.lupo .carta');
    if (k === 'tue') return q('.mano .carta');
    if (k === 'mazzo') return q('.mazzo');
    if (k === 'striscia') return q('.striscia');
    if ((m = /^regola:(.+)$/.exec(k))) return q('.regola').filter(function (x) { return x.getAttribute('data-az') === m[1].toLowerCase(); });
    if (k === 'azione') return q('.mosse .unica');
    if (k === 'punti') return q('.punti');
    if ((m = /^carta:(\w+)$/.exec(k))) return q('.carta[data-id="' + m[1] + '"]');
    if ((m = /^tasto:(.+)$/.exec(k))) return q('.mosse button').filter(function (x) { return primoTesto(x) === m[1]; });   // solo Fermati: le altre mosse stanno nella striscia (regola:Nome)
    return [];
  }

  var okDato = false, ultimoPasso = -2;
  function tastoFine() { return app.querySelector('.passo ~ .azioni .conferma'); }   // l'Avanti / Continua di app.js
  var pezzi = window.Pezzi({
    app: app, risolvi: risolvi,
    etichettaFine: function () { var x = tastoFine(); return x ? x.textContent.trim() : 'Avanti'; },
    alFine: function (info) {
      if (info.tipo === 'leggi') { var x = tastoFine(); if (x) x.click(); }
      else { okDato = true; document.body.classList.remove('pezzi'); sistema(); window.dispatchEvent(new Event('resize')); }   // promemoria e vignetta
    }
  });

  function paragrafi(passo, righe) {
    righe.forEach(function (r) {
      if (!r.trim()) return;
      var p = document.createElement('p');
      r.split(/\*\*/).forEach(function (pezzo, i) { if (i % 2) { var b = document.createElement('b'); b.textContent = pezzo; p.appendChild(b); } else p.appendChild(document.createTextNode(pezzo)); });
      passo.appendChild(p);
    });
  }

  function sistema() {
    var passo = app.querySelector('.passo');
    var idx = passo ? +passo.getAttribute('data-passo') : -1;
    var info = passo ? INFO[idx] : null;
    var nuovo = idx !== ultimoPasso; ultimoPasso = idx;
    if (nuovo) okDato = false;
    var inPezzi = !!info && !okDato && pezzi.mostra(info, nuovo);
    if (!info && pezzi.attivi()) pezzi.chiudi();
    document.body.classList.toggle('pezzi', inPezzi);
    if (passo && info && !passo.getAttribute('data-fatto')) {      // il promemoria: l'ultimo pezzetto, in due righe; si tocca per aprirlo
      passo.setAttribute('data-fatto', '1');
      passo.textContent = ''; paragrafi(passo, [pezzi.ultimoTesto(info)]); passo.classList.add('promemoria');
      passo.addEventListener('click', function () { passo.classList.toggle('aperto'); });
    }
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
