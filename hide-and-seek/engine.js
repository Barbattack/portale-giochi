/*
 * Il cortile — il motore delle regole (Hide and Seek di Wil Su, collezione Isaludo).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 9; libro, pagine 43-46.
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista
 * di mosse la partita è sempre la stessa. Gira in node e nel browser (si chiama `Cortile`).
 *
 * Carte: { id, seme, valore }. Semi H cuori, D quadri, C fiori, S picche. Asso 1, Fante 11,
 * Donna 12, Re 13. id = seme + valore ("S12" = Donna di picche).
 *
 * Il cortile: 12 compagni (le figure) in 4 colonne da 3, indici 0..11 = riga * 4 + colonna.
 * Intorno ci sono 14 posti per le ipotesi: T0..T3 in alto, B0..B3 in basso (uno per colonna),
 * L0..L2 a sinistra, R0..R2 a destra (uno per riga).
 *
 * Mosse (le fa sempre il giocatore):
 *   { t:'ipotesi', dove:'T0' }   // la prima carta del mazzo in un posto vuoto
 *   { t:'scopri',  dove:5 }      // gira un compagno coperto; le ipotesi del suo seme sulla sua riga e colonna vanno nei punti
 *   { t:'ritira',  dove:'L1' }   // scarta la prima carta del mazzo per togliere un'ipotesi dello stesso seme
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è
 * identico al precedente tranne `rifiuto` (il perché, corto, in italiano). Se è accettata
 * `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, cortile:[12 carte] (NASCOSTO al giocatore: la app non lo mostra mai),
 * scoperti:[12 bool], posti:{id: carta|null}, mazzo:[carte] (la prima è scoperta),
 * scarti:[carte], punti:[carte nei punti], fine:null|{punti,vinto}, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cortile = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRAGUARDO = 20;
  var SEMI = ['H', 'D', 'C', 'S'];
  var SIMBOLO = { H: '♥︎', D: '♦︎', C: '♣︎', S: '♠︎' };
  var NOME_SEME = { H: 'cuori', D: 'quadri', C: 'fiori', S: 'picche' };
  var POSTI = ['T0', 'T1', 'T2', 'T3', 'L0', 'L1', 'L2', 'R0', 'R1', 'R2', 'B0', 'B1', 'B2', 'B3'];
  var NOME_AZIONE = { ipotesi: 'Ipotesi', scopri: 'Scopri', ritira: 'Ritira' };

  // ---------- generatore pseudo-casuale con seme (lo stato si porta dietro `rng`) ----------
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
  function prossimoCaso(s) {            // mulberry32, il contatore sta in s.rng
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function mescola(arr, s) {            // Fisher-Yates: ogni ordine ha la stessa probabilità
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(prossimoCaso(s) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- carte ----------
  function carta(seme, valore) { return { id: seme + valore, seme: seme, valore: valore }; }
  function daId(id) { return carta(id[0], +id.slice(1)); }
  function etichetta(v) { return v === 1 ? 'A' : v === 11 ? 'F' : v === 12 ? 'D' : v === 13 ? 'R' : String(v); }
  function nomeValore(v) { return v === 1 ? 'Asso' : v === 11 ? 'Fante' : v === 12 ? 'Donna' : v === 13 ? 'Re' : String(v); }
  function nomeCarta(c) { return nomeValore(c.valore) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return etichetta(c.valore) + SIMBOLO[c.seme]; }
  function figure() {
    var f = [];
    SEMI.forEach(function (s) { [11, 12, 13].forEach(function (v) { f.push(carta(s, v)); }); });
    return f;
  }
  function mazzoRestante() {            // le 40 carte dall'Asso al 10
    var m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= 10; v++) m.push(carta(s, v)); });
    return m;
  }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['cortile', 'scoperti', 'mazzo', 'scarti', 'punti'].forEach(function (k) { n[k] = s[k].slice(); });
    n.posti = {};
    POSTI.forEach(function (p) { n.posti[p] = s.posti[p]; });
    return n;
  }

  // ---------- nomi dei posti, per i messaggi ----------
  function nomePosto(id) {
    var n = +id[1] + 1;
    if (id[0] === 'T') return 'in alto sulla colonna ' + n;
    if (id[0] === 'B') return 'in basso sulla colonna ' + n;
    if (id[0] === 'L') return 'a sinistra della riga ' + n;
    return 'a destra della riga ' + n;
  }
  function nomeCella(i) { return 'riga ' + (Math.floor(i / 4) + 1) + ', colonna ' + (i % 4 + 1); }
  // i quattro posti che guardano la cella i: capi della sua riga e della sua colonna
  function postiDellaCella(i) {
    var r = Math.floor(i / 4), c = i % 4;
    return ['L' + r, 'R' + r, 'T' + c, 'B' + c];
  }

  // ---------- la disposizione (buco H2) ----------
  /*
   * Si sceglie a caso FRA TUTTE le disposizioni valide, ciascuna con la stessa probabilità.
   * Una disposizione valida: 4 colonne, ognuna con un Fante, una Donna e un Re di tre semi
   * diversi, e le 12 figure usate una volta sola. Sono 576 * 6^4 = 746.496.
   *   1. Si estraggono tre permutazioni dei 4 semi: a per i Fanti, b per le Donne, c per i Re
   *      (la colonna i prende il Fante di seme a[i], la Donna b[i], il Re c[i]).
   *      Si ripete finché in ogni colonna i tre semi sono diversi. Le terne valide sono 576
   *      (i rettangoli latini 3x4) e ognuna esce con la stessa probabilità: estrazione uniforme
   *      su 24^3 terne, scartando quelle non valide.
   *   2. In ogni colonna si mescolano i tre compagni (3! ordini, uniformi, indipendenti).
   * La prova prove/uniformita.test.js controlla il risultato contro l'elenco completo.
   */
  function disposizione(s) {
    var a, b, c, ok, i;
    do {
      a = mescola([0, 1, 2, 3], s); b = mescola([0, 1, 2, 3], s); c = mescola([0, 1, 2, 3], s);
      ok = true;
      for (i = 0; i < 4; i++) if (a[i] === b[i] || a[i] === c[i] || b[i] === c[i]) { ok = false; break; }
    } while (!ok);
    var righe = [[], [], []];            // righe[r][col]
    for (i = 0; i < 4; i++) {
      var col = mescola([carta(SEMI[a[i]], 11), carta(SEMI[b[i]], 12), carta(SEMI[c[i]], 13)], s);
      for (var r = 0; r < 3; r++) righe[r][i] = col[r];
    }
    return righe[0].concat(righe[1], righe[2]);   // indice = riga * 4 + colonna
  }

  // ---------- partita ----------
  /*
   * opzioni (solo prove e demo): { griglia:[12 id], inTesta:[id] }
   *   griglia: i 12 compagni, in ordine riga per riga; inTesta: carte in cima al mazzo, in ordine.
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var s = {
      seme: String(seme), rng: xmur3(String(seme)) | 0,
      cortile: [], scoperti: [], posti: {}, mazzo: [], scarti: [], punti: [],
      fine: null, rifiuto: null, ultimo: null
    };
    s.cortile = opzioni.griglia ? opzioni.griglia.map(daId) : disposizione(s);
    for (var i = 0; i < 12; i++) s.scoperti.push(false);
    POSTI.forEach(function (p) { s.posti[p] = null; });
    var testa = (opzioni.inTesta || []).map(daId), ids = {};
    testa.forEach(function (c) { ids[c.id] = true; });
    s.mazzo = testa.concat(mescola(mazzoRestante().filter(function (c) { return !ids[c.id]; }), s));
    s.ultimo = { azione: 'inizio' };
    return s;
  }

  function scoperti(s) { return s.scoperti.filter(Boolean).length; }

  function apply(stato, mossa) {
    var s = copia(stato);
    s.rifiuto = null;
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }

    if (!mossa || !mossa.t) return no('Mossa non valida');
    if (s.fine) return no('La partita è finita');
    if (mossa.t !== 'ipotesi' && mossa.t !== 'scopri' && mossa.t !== 'ritira') return no('Mossa non valida');
    var dove = mossa.dove;
    if (dove === undefined || dove === null || dove === '') return no('Scegli prima dove');
    var eCella = typeof dove === 'number' && dove >= 0 && dove < 12 && dove === Math.floor(dove);
    var ePosto = typeof dove === 'string' && POSTI.indexOf(dove) >= 0;
    if (!eCella && !ePosto) return no('Posto non valido');

    if (mossa.t === 'ipotesi') {
      if (!ePosto) return no('Le ipotesi vanno nei posti intorno al cortile');
      if (!s.mazzo.length) return no('Il mazzo è finito: ora puoi solo scoprire');
      if (s.posti[dove]) return no('Quel posto è occupato');
      var c = s.mazzo.shift();
      s.posti[dove] = c;
      s.ultimo = { azione: 'ipotesi', carta: c, dove: dove };
      return s;
    }

    if (mossa.t === 'scopri') {
      if (!eCella) return no('Scegli una carta coperta del cortile');
      if (s.scoperti[dove]) return no('Quel compagno è già scoperto');
      s.scoperti[dove] = true;
      var comp = s.cortile[dove], prese = [];
      postiDellaCella(dove).forEach(function (p) {
        var g = s.posti[p];
        if (g && g.seme === comp.seme) { prese.push({ carta: g, dove: p }); s.punti.push(g); s.posti[p] = null; }
      });
      s.ultimo = { azione: 'scopri', cella: dove, compagno: comp, prese: prese };
      if (scoperti(s) === 12) s.fine = { punti: s.punti.length, vinto: s.punti.length >= TRAGUARDO };
      return s;
    }

    // ritira
    if (!ePosto) return no('Scegli un’ipotesi intorno al cortile');
    if (!s.mazzo.length) return no('Il mazzo è finito: ora puoi solo scoprire');
    var ip = s.posti[dove];
    if (!ip) return no('Lì non c’è nessuna ipotesi');
    var top = s.mazzo[0];
    if (ip.seme !== top.seme) {
      return no('La carta del mazzo è di ' + NOME_SEME[top.seme] + ', l’ipotesi è di ' + NOME_SEME[ip.seme]);
    }
    s.mazzo.shift();
    s.posti[dove] = null;
    s.scarti.push(top, ip);
    s.ultimo = { azione: 'ritira', carta: top, ipotesi: ip, dove: dove };
    return s;
  }

  return {
    nuova: nuova, apply: apply, disposizione: disposizione, carta: carta, daId: daId,
    figure: figure, mazzoRestante: mazzoRestante, scoperti: scoperti,
    etichetta: etichetta, nomeValore: nomeValore, nomeCarta: nomeCarta, sigla: sigla,
    nomePosto: nomePosto, nomeCella: nomeCella, postiDellaCella: postiDellaCella,
    TRAGUARDO: TRAGUARDO, SEMI: SEMI, SIMBOLO: SIMBOLO, NOME_SEME: NOME_SEME,
    NOME_AZIONE: NOME_AZIONE, POSTI: POSTI
  };
}));
