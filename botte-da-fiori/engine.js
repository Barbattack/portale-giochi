/*
 * Botte da fiori — il motore delle regole.
 * Ispirato a Club Fight di D. Teuber (©2023).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Botte`).
 *
 * Carte: { id, seme, valore, etichetta }. Semi: C fiori, D quadri, H cuori,
 * S picche, J jolly (senza seme e senza valore: valore null). id = seme + valore,
 * il jolly è J1 / J2. Valori: Asso 1, 2-10, Fante 11, Donna 12, Re 13.
 *
 * Una mossa sola:
 *   { t:'gioca', carta:'C7', azione:'uguali'|'somma'|'qualsiasi'|'linea'|'sugiu'|'scala',
 *     scelte:[id di carte della griglia],      // somma, qualsiasi, scala
 *     linea:{ tipo:'riga'|'colonna', n:0..2 }, // linea
 *     dir:'basse'|'alte' }                     // sugiu, serve solo col 7
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata
 * lo stato è identico al precedente (la carta di fiori resta in mano) tranne
 * `rifiuto`, che contiene il perché in italiano corto. Se è accettata `rifiuto`
 * è null e `ultimo` descrive cosa è successo.
 *
 * Punto di cucitura per la grafica: la grafica legge lo stato e non lo scrive.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Botte = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MANO = 4;
  var ETICHETTA = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var NOME_SEME = { C: 'fiori', D: 'quadri', H: 'cuori', S: 'picche' };
  var NOME_AZIONE = {
    uguali: 'Uguali', somma: 'Somma', qualsiasi: 'Una qualsiasi',
    linea: 'Linea', sugiu: 'Su/Giù', scala: 'Scala'
  };
  // quale seme blocca quale azione (le prime tre non si bloccano mai)
  var BLOCCO = { linea: 'D', sugiu: 'S', scala: 'H' };
  var AZIONI = ['uguali', 'somma', 'qualsiasi', 'linea', 'sugiu', 'scala'];

  // ---------- generatore pseudo-casuale con seme ----------
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngDaSeme(seme) { return mulberry32(xmur3(String(seme))); }
  function mescola(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- carte ----------
  function carta(seme, valore) {
    return { id: seme + valore, seme: seme, valore: valore, etichetta: ETICHETTA[valore] || String(valore) };
  }
  function jolly(n) { return { id: 'J' + n, seme: 'J', valore: null, etichetta: 'Jolly' }; }
  function mazzoFiori() {
    var m = []; for (var v = 1; v <= 13; v++) m.push(carta('C', v)); return m;
  }
  function mazzoGriglia(njolly) {
    var m = [];
    ['D', 'H', 'S'].forEach(function (s) { for (var v = 1; v <= 13; v++) m.push(carta(s, v)); });
    for (var j = 1; j <= njolly; j++) m.push(jolly(j));
    return m;
  }

  function valoreTesto(v) { return NOME_VALORE[v] ? NOME_VALORE[v] + ' (' + v + ')' : String(v); }
  function valoreCon(v) { return v === 1 ? "l'Asso" : v === 11 ? 'il Fante' : v === 12 ? 'la Donna' : v === 13 ? 'il Re' : 'il ' + v; }

  // ---------- partita ----------
  /*
   * opzioni: { difficolta:'facile'|'difficile' (default facile),
   *            fiori:[carte], griglia:[carte]  // solo per le prove e la demo: mazzi già in ordine
   *          }
   * Il primo elemento di `fiori` è la prima carta della mano; i primi 9 elementi
   * di `griglia` sono la griglia (poi il mazzo, in ordine).
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var difficolta = opzioni.difficolta === 'difficile' ? 'difficile' : 'facile';
    var rng = rngDaSeme(seme);
    var fiori = opzioni.fiori ? opzioni.fiori.slice() : mescola(mazzoFiori(), rng);
    var gr = opzioni.griglia ? opzioni.griglia.slice()
      : mescola(mazzoGriglia(difficolta === 'difficile' ? 2 : 1), rng);
    var s = {
      seme: String(seme), difficolta: difficolta,
      griglia: gr.splice(0, 9),
      mazzoGriglia: gr,
      fiori: fiori,
      mano: [],
      scarti: [],
      turno: 1,
      fine: null,       // null | 'vinta' | 'persa'
      rifiuto: null,
      ultimo: null
    };
    while (s.griglia.length < 9) s.griglia.push(null);
    rifaiMano(s);
    return s;
  }

  function copia(s) { return JSON.parse(JSON.stringify(s)); }

  function rifaiMano(s) {
    while (s.mano.length < MANO && s.fiori.length) s.mano.push(s.fiori.shift());
  }
  // i posti vuoti si riempiono da sinistra a destra, partendo dalla riga in alto
  function riempiGriglia(s) {
    for (var i = 0; i < 9 && s.mazzoGriglia.length; i++) {
      if (!s.griglia[i]) s.griglia[i] = s.mazzoGriglia.shift();
    }
  }

  function carteInGriglia(s) { return s.griglia.filter(Boolean); }
  function contaSeme(s, seme) {
    return carteInGriglia(s).filter(function (c) { return c.seme === seme; }).length;
  }
  // quante carte restano da eliminare (griglia + mazzo della griglia)
  function dasEliminare(s) { return carteInGriglia(s).length + s.mazzoGriglia.length; }
  // fiori ancora da giocare (mano + mazzo dei fiori) = turni rimasti
  function turniRimasti(s) { return s.mano.length + s.fiori.length; }
  // per le prove e per niente altro: l'app NON deve mostrare i blocchi
  function azioniBloccate(s) {
    return AZIONI.filter(function (a) { return BLOCCO[a] && contaSeme(s, BLOCCO[a]) >= 3; });
  }

  function rifiutata(s, perche) { var n = copia(s); n.rifiuto = perche; n.ultimo = null; return n; }

  // ---------- le sei azioni: ognuna restituisce { tolte:[ids] } oppure { perche } ----------
  function trovaPerId(s, id) {
    for (var i = 0; i < 9; i++) if (s.griglia[i] && s.griglia[i].id === id) return s.griglia[i];
    return null;
  }
  function scelteValide(s, scelte) {
    var viste = {}, out = [];
    for (var i = 0; i < (scelte || []).length; i++) {
      var id = scelte[i];
      if (viste[id]) return { perche: 'Hai scelto due volte la stessa carta.' };
      viste[id] = true;
      var c = trovaPerId(s, id);
      if (!c) return { perche: 'Una carta scelta non è in griglia.' };
      out.push(c);
    }
    return { carte: out };
  }

  function uguali(s, c) {
    var t = carteInGriglia(s).filter(function (x) { return x.valore === c.valore; });
    if (!t.length) return { perche: 'Uguali: nessuna carta di valore ' + valoreTesto(c.valore) + ' in griglia.' };
    return { tolte: t };
  }
  function somma(s, c, m) {
    var r = scelteValide(s, m.scelte); if (r.perche) return r;
    if (!r.carte.length) return { perche: 'Somma: scegli le carte da togliere.' };
    if (r.carte.some(function (x) { return x.seme === 'J'; }))
      return { perche: 'Il jolly non ha valore: non si può usare nella somma.' };
    var tot = r.carte.reduce(function (a, x) { return a + x.valore; }, 0);
    if (tot !== c.valore) return { perche: 'La somma fa ' + tot + ', serve ' + c.valore + '.' };
    return { tolte: r.carte };
  }
  function qualsiasi(s, c, m) {
    var r = scelteValide(s, m.scelte); if (r.perche) return r;
    if (r.carte.length !== 1) return { perche: 'Una qualsiasi: scegli una carta sola.' };
    return { tolte: r.carte };
  }
  function indiciLinea(l) {
    var out = [], k;
    for (k = 0; k < 3; k++) out.push(l.tipo === 'riga' ? l.n * 3 + k : k * 3 + l.n);
    return out;
  }
  function linea(s, c, m) {
    var l = m.linea;
    if (!l || (l.tipo !== 'riga' && l.tipo !== 'colonna') || !(l.n >= 0 && l.n <= 2))
      return { perche: 'Linea: scegli una riga o una colonna.' };
    var carte = indiciLinea(l).map(function (i) { return s.griglia[i]; }).filter(Boolean);
    var nome = (l.tipo === 'riga' ? 'riga ' : 'colonna ') + (l.n + 1);
    // il jolly non fa da carta uguale, ma se sta nella linea viene tolto
    if (!carte.some(function (x) { return x.valore === c.valore; }))
      return { perche: 'Linea: nella ' + nome + ' non c\'è nessuna carta di valore ' + valoreTesto(c.valore) + '.' };
    return { tolte: carte };
  }
  function sugiu(s, c, m) {
    var v = c.valore;
    if (v === 1 || v === 13)
      return { perche: 'Su/Giù non si fa con ' + valoreCon(v) + ': serve un fiori dal 2 alla Donna.' };
    var dir = v < 7 ? 'basse' : v > 7 ? 'alte' : m.dir;
    if (v === 7 && dir !== 'basse' && dir !== 'alte')
      return { perche: 'Col 7 scegli prima: carte più basse o più alte.' };
    if (v !== 7 && m.dir && m.dir !== dir)
      return { perche: 'Con ' + valoreCon(v) + ' Su/Giù toglie solo le carte più ' + (dir === 'basse' ? 'basse.' : 'alte.') };
    var t = carteInGriglia(s).filter(function (x) {
      return x.valore !== null && (dir === 'basse' ? x.valore < v : x.valore > v);
    });
    if (!t.length) return { perche: 'Su/Giù: nessuna carta più ' + (dir === 'basse' ? 'bassa' : 'alta') + ' di ' + v + ' in griglia.' };
    return { tolte: t };
  }
  function scala(s, c, m) {
    var r = scelteValide(s, m.scelte); if (r.perche) return r;
    if (!r.carte.length) return { perche: 'Scala: scegli le carte da collegare.' };
    if (r.carte.some(function (x) { return x.seme === 'J'; }))
      return { perche: 'Il jolly non ha valore: non entra in una scala.' };
    var visti = {};
    for (var i = 0; i < r.carte.length; i++) {
      var v = r.carte[i].valore;
      if (visti[v]) return { perche: 'Scala: un solo valore per gradino, hai scelto due carte di valore ' + valoreTesto(v) + '.' };
      visti[v] = true;
    }
    var vals = r.carte.map(function (x) { return x.valore; }).concat([c.valore]).sort(function (a, b) { return a - b; });
    for (var k = 1; k < vals.length; k++)
      if (vals[k] !== vals[k - 1] + 1) return { perche: 'Scala: con ' + valoreCon(c.valore) + ' le carte scelte non fanno una sequenza.' };
    return { tolte: r.carte };
  }
  var FA = { uguali: uguali, somma: somma, qualsiasi: qualsiasi, linea: linea, sugiu: sugiu, scala: scala };

  function apply(s, m) {
    if (s.fine) return rifiutata(s, 'La partita è finita.');
    if (!m || m.t !== 'gioca' || !FA[m.azione]) return rifiutata(s, 'Scegli una mossa.');
    var c = null, ic = -1, i;
    for (i = 0; i < s.mano.length; i++) if (s.mano[i].id === m.carta) { c = s.mano[i]; ic = i; }
    if (!c) return rifiutata(s, 'Scegli una carta di fiori dalla mano.');

    // il blocco si conta sulla griglia com'è PRIMA della mossa
    var sem = BLOCCO[m.azione];
    if (sem) {
      var n = contaSeme(s, sem);
      if (n >= 3) return rifiutata(s, NOME_AZIONE[m.azione] + ' bloccata: in griglia ci sono ' + n + ' ' + NOME_SEME[sem] + '.');
    }
    var r = FA[m.azione](s, c, m);
    if (r.perche) return rifiutata(s, r.perche);
    if (!r.tolte || !r.tolte.length) return rifiutata(s, NOME_AZIONE[m.azione] + ': non toglie nessuna carta.');

    var n2 = copia(s);
    n2.mano.splice(ic, 1);
    n2.scarti.push(c);
    var ids = {}; r.tolte.forEach(function (x) { ids[x.id] = true; });
    for (i = 0; i < 9; i++) {
      if (n2.griglia[i] && ids[n2.griglia[i].id]) { n2.scarti.push(n2.griglia[i]); n2.griglia[i] = null; }
    }
    riempiGriglia(n2);
    rifaiMano(n2);
    n2.turno = s.turno + 1;
    n2.rifiuto = null;
    n2.ultimo = {
      azione: m.azione, carta: c, tolte: r.tolte,
      jollyTolto: r.tolte.some(function (x) { return x.seme === 'J'; })
    };
    if (dasEliminare(n2) === 0) n2.fine = 'vinta';
    else if (n2.mano.length === 0 && n2.fiori.length === 0) n2.fine = 'persa';
    return n2;
  }

  return {
    nuova: nuova, apply: apply, carta: carta, jolly: jolly,
    mazzoFiori: mazzoFiori, mazzoGriglia: mazzoGriglia,
    turniRimasti: turniRimasti, dasEliminare: dasEliminare, azioniBloccate: azioniBloccate,
    contaSeme: contaSeme, rngDaSeme: rngDaSeme, mescola: mescola,
    AZIONI: AZIONI, NOME_AZIONE: NOME_AZIONE, NOME_SEME: NOME_SEME, NOME_VALORE: NOME_VALORE,
    valoreTesto: valoreTesto
  };
}));
