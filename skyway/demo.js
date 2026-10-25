/*
 * Skyway — la demo: la partita guidata del tutorial, sempre la stessa. Qui non ci sono testi né carte: li legge da copione.js
 * (il file dei testi, che Penna riscrive) e li porta nel formato che app.js già conosce: un elenco di passi, ognuno con `testo` e, se serve,
 * una `mossa` che il giocatore fa toccando pila e casella (`trova`: la posa la cerca lui, e `aiuti` arrivano solo se sbaglia).
 * Nel browser si chiama `SkywayDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./copione.js'));
  else root.SkywayDemo = factory(root.Skyway, root.SkywayCopione);
}(typeof self !== 'undefined' ? self : this, function (S, C) {
  'use strict';

  function nuova() { return S.nuova(C.partita.seme, { griglia: C.partita.griglia, mercato: C.partita.mercato, inTesta: C.partita.inTesta }); }
  function pulito(s) { return s.replace(/\*\*/g, ''); }

  var passi = C.passi.map(function (p) {
    var o = { testo: pulito(p.pezzi.map(function (z) { return z.testo; }).join(' ')) };
    if (p.titolo) o.testo = p.titolo + '\n' + o.testo;
    if (p.mossa) o.mossa = p.mossa;
    if (p.modo === 'trova') { o.trova = true; o.aiuti = C.aiuti; o.costoso = C.aiutoCostoso; }
    return o;
  });

  return { nuova: nuova, passi: passi, copione: C };
}));
