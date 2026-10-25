/*
 * SOLATRO — LA PARTITA GUIDATA: il runner del tutorial (Chiara, 25/10/2026).
 * Script di SOLO PROTOTIPO. Si carica dopo engine.js, copione.js e pezzi.js, prima di tavolo.js. Non contiene testi: li legge da copione.js.
 *
 * Cosa fa, passo per passo del copione (SolatroCopione.passi):
 *   'leggi'  ogni riga della bozza è un pezzetto (pezzi.js): cartello in basso, la cosa di cui parla accesa sul tavolo, Ok; l'ultimo Ok fa da Avanti.
 *   'tocca'  prima il perché, a pezzetti; poi il promemoria in alto e la vignetta TOCCA (vignette.js) su una carta per volta, nell'ordine
 *            del copione. Si può toccare solo quella (`permesso`); toccate tutte, si passa al passo dopo.
 *   'tasto'  come 'tocca', ma la vignetta indica un tasto (Gioca, Scarta, Compra, Round 2, il gettone e poi Usa): la mossa va al motore.
 *   'trova'  il perché, poi nessuna vignetta sulle carte (body.trova): il giocatore sceglie; la vignetta compare sul tasto solo quando
 *            il tasto dice la combinazione attesa. Se preme Gioca con un'altra, o Scarta, il gioco risponde con l'aiuto del copione
 *            nel cartello del rifiuto, e la mossa non parte.
 * Finito l'ultimo passo, il tutorial si spegne e la partita continua da sola, nello stesso stato.
 */
(function () {
  'use strict';
  var C = self.SolatroCopione, S = self.Solatro;
  if (!C || !S || !window.Pezzi) return;
  var app = document.getElementById('app');
  var attivo = false, idx = 0, okDato = false, toccate = [], ultimo = -1, ctx = null, pezzi = null;

  function q(sel) { return [].slice.call(app.querySelectorAll(sel)); }
  function passo() { return C.passi[idx]; }
  var INFO = C.passi.map(function (p) {
    return { tipo: p.tipo === 'leggi' ? 'leggi' : 'gioca', titolo: p.titolo || (p.tipo === 'trova' ? 'Trova tu' : 'Il tuo turno'), bozza: p.bozza, pezzi: p.pezzi };
  });

  // le cose da accendere sul tavolo di Solatro, dalle chiavi del copione agli elementi
  function risolvi(k) {
    var m;
    if (k === 'monete') return q('.banco .monete');
    if (k === 'traguardo') return q('.banco .cassa');
    if (k === 'giocate') return q('.banco .giocate');
    if (k === 'scarti') return q('.banco .scarti');
    if (k === 'mano') return q('.mano .carta');
    if (k === 'jolly') return q('.riserva .chip.jolly, .riserva .chip.nessuno');
    if (k === 'gettoni') return q('.riserva .gettone');
    if (k === 'spesa') return q('.spesa');
    if (k === 'articoli') return q('.articolo');
    if (k === 'tasto:gioca') return q('.azioni .gioca');
    if (k === 'tasto:scarta') return q('.azioni .scarta');
    if (k === 'tasto:prossimo') return q('.azioni .prossimo');
    if ((m = /^carta:(\w+)$/.exec(k))) return q('.carta[data-id="' + m[1] + '"]');
    if ((m = /^bonus:([\w-]+)$/.exec(k))) return q('.articolo[data-bonus="' + m[1] + '"], .riserva .gettone[data-bonus="' + m[1] + '"]');
    if ((m = /^tasto:(.+)$/.exec(k))) return q('button').filter(function (x) { return x.firstChild && x.firstChild.textContent.trim() === m[1]; });
    return [];
  }

  pezzi = window.Pezzi({ app: app, risolvi: risolvi,
    etichettaFine: function () { return idx === C.passi.length - 1 ? 'Gioca' : 'Avanti'; },
    alFine: function (info) {
      if (info.tipo === 'leggi') { avanza(); return; }
      okDato = true; document.body.classList.remove('pezzi'); sistema(ctx); window.dispatchEvent(new Event('resize'));
    } });

  function avanza() {
    idx++; okDato = false; toccate = [];
    if (idx >= C.passi.length) { attivo = false; pezzi.chiudi(); }
    if (ctx) ctx.render();
  }
  function inizia() { attivo = true; idx = 0; okDato = false; toccate = []; ultimo = -1; }
  function ferma() { attivo = false; pezzi.chiudi(); pulisci(); }
  function pulisci() {
    var p = app.querySelector('.passo'); if (p) p.parentNode.removeChild(p);
    document.body.classList.remove('pezzi', 'trova');
    q('.suggerita').forEach(function (e) { e.classList.remove('suggerita'); });
  }

  // il bersaglio della vignetta in questo momento
  function bersaglio(p, c) {
    if (p.tipo === 'tocca') {
      var id = p.tocca[toccate.length];
      return id ? app.querySelector('.carta[data-id="' + id + '"]') : null;
    }
    if (p.tipo === 'tasto') {
      var m = p.mossa;
      if (m.t === 'gioca') return app.querySelector('.azioni .gioca');
      if (m.t === 'scarta') return app.querySelector('.azioni .scarta');
      if (m.t === 'prossimo') return app.querySelector('.azioni .prossimo');
      if (m.t === 'compra') return app.querySelector('.articolo[data-bonus="' + m.bonus + '"] button');
      if (m.t === 'usa') return c.bonusAperto === m.bonus ? app.querySelector('.info .usa') : app.querySelector('.riserva .gettone[data-bonus="' + m.bonus + '"]');
    }
    if (p.tipo === 'trova') return c.lettura && c.lettura.ok && c.lettura.id === p.attesa ? app.querySelector('.azioni .gioca') : null;
    return null;
  }

  // il permesso: cosa si può toccare adesso. true, false, oppure il testo dell'aiuto (che il tavolo mostra come rifiuto)
  function permesso(az, c) {
    if (!attivo) return true;
    var p = passo();
    if (!okDato && p.tipo !== 'leggi') return false;
    if (p.tipo === 'leggi') return false;
    if (p.tipo === 'tocca') return az.tipo === 'carta' && az.id === p.tocca[toccate.length];
    if (p.tipo === 'tasto') {
      var m = p.mossa;
      if (m.t === 'usa') return (az.tipo === 'apri' || az.tipo === 'usa') && az.bonus === m.bonus;
      if (m.t === 'compra') return az.tipo === 'compra' && az.bonus === m.bonus;
      return az.tipo === m.t;
    }
    if (p.tipo === 'trova') {
      if (az.tipo === 'carta') return true;
      if (az.tipo === 'gioca') {
        var l = c.lettura;
        if (l && l.ok && l.id === p.attesa) return true;
        if (!l || !l.ok) return false;
        return p.aiuto.replace('{nome}', l.nome).replace('{punti}', l.punti);
      }
      if (az.tipo === 'scarta') return p.aiutoScarto || false;
      return false;
    }
    return false;
  }
  function fatto(az) {
    if (!attivo) return;
    var p = passo();
    if (p.tipo === 'tocca' && az.tipo === 'carta') { toccate.push(az.id); if (toccate.length >= p.tocca.length) avanza(); return; }
    if (p.tipo === 'tasto') { var m = p.mossa; if (az.tipo === m.t || (m.t === 'usa' && az.tipo === 'usa')) avanza(); return; }
    if (p.tipo === 'trova' && az.tipo === 'gioca') avanza();
  }

  // dopo ogni ridisegno del tavolo: pezzetti, promemoria, vignetta
  function paragrafo(testo) {
    var p = document.createElement('p');
    testo.split(/\*\*/).forEach(function (pezzo, i) { if (i % 2) { var b = document.createElement('b'); b.textContent = pezzo; p.appendChild(b); } else p.appendChild(document.createTextNode(pezzo)); });
    return p;
  }
  function sistema(c) {
    ctx = c;
    if (!attivo || !c) { pulisci(); if (pezzi.attivi()) pezzi.chiudi(); return; }
    var p = passo(), info = INFO[idx];
    var nuovo = idx !== ultimo; ultimo = idx;
    var inPezzi = !okDato && pezzi.mostra(info, nuovo);
    document.body.classList.toggle('pezzi', inPezzi);
    document.body.classList.toggle('trova', p.tipo === 'trova' && !inPezzi);
    var vecchio = app.querySelector('.passo'); if (vecchio) vecchio.parentNode.removeChild(vecchio);
    q('.suggerita').forEach(function (e) { e.classList.remove('suggerita'); });
    if (p.tipo === 'leggi' || inPezzi) return;
    // il promemoria: l'ultimo pezzetto, in alto, in due righe; si tocca per leggerlo tutto
    var passoEl = document.createElement('div'); passoEl.className = 'passo promemoria';
    passoEl.appendChild(paragrafo(pezzi.ultimoTesto(info)));
    passoEl.addEventListener('click', function () { passoEl.classList.toggle('aperto'); });
    var top = app.querySelector('.top');
    if (top && top.nextSibling) app.insertBefore(passoEl, top.nextSibling); else app.appendChild(passoEl);
    var b = bersaglio(p, c);
    if (b) b.classList.add('suggerita');
  }

  self.SolatroTutorial = { inizia: inizia, ferma: ferma, attivo: function () { return attivo; }, permesso: permesso, fatto: fatto, sistema: sistema,
    passo: function () { return attivo ? idx : -1; } };
}());
