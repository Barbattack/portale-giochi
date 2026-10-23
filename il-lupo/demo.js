/*
 * Il Lupo — la demo: la partita guidata del tutorial, sempre la stessa. Qui non ci sono testi né carte: li legge da copione.js
 * (il file dei testi, che Penna riscrive) e li porta nel formato che app.js già conosce: un elenco di passi, ognuno con `testo` e, se serve,
 * una `mossa` che il giocatore fa toccando (`trova`: la mossa la cerca lui, e `aiuti` arrivano solo se sbaglia).
 * Nel browser si chiama `LupoDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./copione.js'));
  else root.LupoDemo = factory(root.Lupo, root.LupoCopione);
}(typeof self !== 'undefined' ? self : this, function (L, C) {
  'use strict';

  function nuova() { return L.nuova(C.partita.seme, { livello: C.partita.livello, inTesta: C.partita.inTesta }); }
  function pulito(s) { return s.replace(/\*\*/g, ''); }

  var passi = C.passi.map(function (p) {
    var o = { testo: pulito(p.pezzi.map(function (z) { return z.testo; }).join(' ')) };
    if (p.titolo) o.testo = p.titolo + '\n' + o.testo;
    if (p.mossa) { o.mossa = p.mossa; o.chi = p.chi; }
    if (p.modo === 'trova') { o.trova = true; o.aiuti = C.aiuti; }
    return o;
  });

  return { nuova: nuova, passi: passi, copione: C };
}));
