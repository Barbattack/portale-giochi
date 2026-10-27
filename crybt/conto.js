// CRYBT — il conto della mano: le combinazioni del cribbage e il controllo di quello che dichiari.
// Ripreso da prova-conteggio/engine.js (che resta com'è); qui in più il jolly, che non fa mai parte di una combinazione, e funzioni più corte.
// Carta = { id, r: 1..13 (1 = Asso, 11 J, 12 Q, 13 K), s: 0..3 (picche, cuori, quadri, fiori) }; il jolly ha jolly:true, r:0, s:-1.
// Una combinazione = { tipo: 'quindici'|'coppia'|'scala'|'colore', idx: [indici nella mano, ordinati], punti }.
(function (radice) {
  'use strict';
  var TIPI = ['quindici', 'coppia', 'scala', 'colore'];
  var NOMI = { quindici: 'Quindici', coppia: 'Coppia', scala: 'Scala', colore: 'Colore' };
  var PAROLE = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici',
    'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti', 'ventuno', 'ventidue', 'ventitré',
    'ventiquattro', 'venticinque', 'ventisei', 'ventisette', 'ventotto', 'ventinove'];

  function valore(c) { return c.jolly ? 0 : Math.min(c.r, 10); }
  function parola(n) { return PAROLE[n] !== undefined ? PAROLE[n] : String(n); }
  function chiave(tipo, idx) { return tipo + ':' + idx.join(','); }
  function no(perche) { return { ok: false, perche: perche }; }
  function si(punti) { return { ok: true, punti: punti }; }

  // tutti i sottoinsiemi non vuoti degli indici dati
  function sottoinsiemi(indici) {
    var out = [], n = indici.length;
    for (var k = 1; k < (1 << n); k++) out.push(indici.filter(function (_, i) { return k & (1 << i); }));
    return out;
  }

  function quindici(c) {
    var somma = c.reduce(function (s, x) { return s + valore(x); }, 0);
    return somma === 15 ? si(2) : no('Queste carte non fanno quindici.');
  }
  function coppia(c) {
    if (c.length !== 2) return no('Una coppia è fatta di due carte.');
    return c[0].r === c[1].r ? si(2) : no('Non sono due carte uguali.');
  }
  function scala(c, mano) {
    if (c.length < 3) return no('Una scala ha almeno tre carte.');
    var r = c.map(function (x) { return x.r; }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < r.length; i++) if (r[i] !== r[i - 1] + 1) return no('Queste carte non fanno una scala.');
    var presenti = {}; mano.forEach(function (x) { if (!x.jolly) presenti[x.r] = true; });
    if (presenti[r[0] - 1] || presenti[r[r.length - 1] + 1]) return no('La scala si dichiara per intero.');
    return si(c.length);
  }
  function colore(c, mano) {
    if (c.length < 4) return no('Il colore vuole almeno quattro carte.');
    if (c.some(function (x) { return x.s !== c[0].s; })) return no('Non sono tutte dello stesso seme.');
    var tutte = mano.filter(function (x) { return x.s === c[0].s; }).length;
    return tutte === c.length ? si(c.length) : no('Il colore si dichiara per intero.');
  }
  var CONTROLLO = { quindici: quindici, coppia: coppia, scala: scala, colore: colore };

  // Controlla se le carte scelte (idx) sono davvero una combinazione del tipo dichiarato. Non dice mai cosa manca: solo perché no.
  function riconosci(mano, tipo, idx) {
    if (!idx.length) return no('Tocca prima le carte.');
    var c = idx.map(function (i) { return mano[i]; });
    if (c.some(function (x) { return x.jolly; })) return no('Il jolly non conta niente.');
    var f = CONTROLLO[tipo];
    return f ? f(c, mano) : no('Scegli che combinazione è.');
  }

  // Tutte le combinazioni che la mano contiene (ogni combinazione una volta sola). Il jolly non ne fa parte.
  function combinazioni(mano) {
    var utili = [], out = [];
    mano.forEach(function (c, i) { if (!c.jolly) utili.push(i); });
    sottoinsiemi(utili).forEach(function (idx) {
      TIPI.forEach(function (tipo) { var v = riconosci(mano, tipo, idx); if (v.ok) out.push({ tipo: tipo, idx: idx, punti: v.punti }); });
    });
    return out;
  }
  function totale(lista) { return lista.reduce(function (s, x) { return s + x.punti; }, 0); }

  // Dichiarazione: controlla e, se va, dice la formula col totale che sale.
  function dichiara(mano, tipo, idx, dichiarate) {
    idx = idx.slice().sort(function (a, b) { return a - b; });
    var v = riconosci(mano, tipo, idx);
    if (!v.ok) return no(v.perche);
    if (dichiarate.some(function (d) { return chiave(d.tipo, d.idx) === chiave(tipo, idx); })) return no('Questa l’hai già dichiarata.');
    var nuovo = totale(dichiarate) + v.punti;
    return { ok: true, comb: { tipo: tipo, idx: idx, punti: v.punti }, totale: nuovo, formula: NOMI[tipo] + ' ' + parola(nuovo) };
  }

  // Le combinazioni sfuggite: nell'ordine in cui le leggerebbe un giocatore (quindici, coppie, scale, colore).
  function sfuggite(mano, dichiarate) {
    var fatte = {}; dichiarate.forEach(function (d) { fatte[chiave(d.tipo, d.idx)] = true; });
    return combinazioni(mano).filter(function (c) { return !fatte[chiave(c.tipo, c.idx)]; })
      .sort(function (a, b) { return TIPI.indexOf(a.tipo) - TIPI.indexOf(b.tipo) || a.idx.length - b.idx.length || a.idx.join().localeCompare(b.idx.join()); });
  }

  var API = { TIPI: TIPI, NOMI: NOMI, valore: valore, parola: parola, riconosci: riconosci, combinazioni: combinazioni,
    totale: totale, dichiara: dichiara, sfuggite: sfuggite, chiave: chiave };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else radice.Conto = API;
})(typeof window !== 'undefined' ? window : this);
