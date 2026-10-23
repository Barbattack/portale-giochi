/*
 * Area 52 (titolo provvisorio) — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Area`). Regole: owner inbox/isaludo-regole-2026-10-22.md,
 * sezione 3, e il libro (pp. 13-18).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri (rossi), F fiori, P picche (neri).
 * Valori 1-13: Asso 1, Fante 11, Donna 12, Re 13. id = seme + valore ("Q1" = Asso di quadri).
 * Le nere sono i difensori, le rosse gli alieni.
 *
 * Mosse (si affronta sempre l'alieno attuale, inArrivo[0]):
 *   { t:'doppio',     carte:[id, id] }   due difensori la cui somma è esattamente il valore dell'alieno
 *   { t:'singolo',    carte:[id] }       un difensore di valore maggiore e di colore opposto
 *   { t:'sacrificio', carte:[id] }       si scarta un difensore, l'alieno va in fondo al mazzo alieni
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato
 * è identico tranne `rifiuto` (il perché, corto, in italiano). Se è accettata `rifiuto` è null
 * e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, ondata:1|2,
 *          difensori:[carte sul tavolo, fino a 6], mazzoDif:[carte; [0] è la cima],
 *          alieni:[mazzo coperto; [0] è la cima, i sacrificati vanno in fondo],
 *          inArrivo:[alieni scoperti, in ordine; [0] è l'attuale],
 *          scarti:[carte],
 *          fine:null|{ esito:'vittoria'|'sconfitta', punti, ... },
 *          rifiuto, ultimo }
 * ultimo: { t, alieno, usati:[carte usate], persi:[difensori scartati in più, seconda ondata],
 *           pescate:n (rifornimento), ondata2:bool (la seconda ondata è appena cominciata) }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Area = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAVOLO = 6;          // difensori sul tavolo
  var IN_ARRIVO = 3;       // alieni scoperti per volta
  var PENALITA = 50;       // meno 50 se perdi ancora nella prima ondata
  var SEMI = ['C', 'Q', 'F', 'P'];
  var ROSSI = ['C', 'Q'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var SIGLA_VALORE = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };

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
  function mescola(arr, s) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(prossimoCaso(s) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- carte ----------
  function carta(seme, valore) { return { id: seme + valore, seme: seme, valore: valore }; }
  function daId(id) { return carta(id[0], +id.slice(1)); }
  function mazzoCompleto() {
    var m = [];
    SEMI.forEach(function (se) { for (var v = 1; v <= 13; v++) m.push(carta(se, v)); });
    return m;
  }
  function eRossa(c) { return ROSSI.indexOf(c.seme) >= 0; }
  function nomeCarta(c) { return (NOME_VALORE[c.valore] || String(c.valore)) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return (SIGLA_VALORE[c.valore] || String(c.valore)) + SIMBOLO[c.seme]; }
  function ordina(carte) {
    return carte.slice().sort(function (a, b) { return a.valore - b.valore || SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme); });
  }
  var CHIAVI = ['difensori', 'mazzoDif', 'alieni', 'inArrivo', 'scarti'];
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    CHIAVI.forEach(function (k) { n[k] = s[k].slice(); });
    return n;
  }
  function togli(lista, id) { return lista.filter(function (c) { return c.id !== id; }); }

  // ---------- partita ----------
  function girane(s) {                  // gira le prossime tre (o quelle che restano) del mazzo alieni
    while (s.inArrivo.length < IN_ARRIVO && s.alieni.length) s.inArrivo.push(s.alieni.shift());
  }
  function nuova(seme) {
    var s = { seme: String(seme), rng: xmur3(String(seme)), ondata: 1, difensori: [], mazzoDif: [], alieni: [],
              inArrivo: [], scarti: [], fine: null, rifiuto: null, ultimo: null };
    var tutte = mazzoCompleto();
    var neri = mescola(tutte.filter(function (c) { return !eRossa(c); }), s);
    s.alieni = mescola(tutte.filter(eRossa), s);
    s.difensori = neri.splice(0, TAVOLO);
    s.mazzoDif = neri;
    girane(s);
    return s;
  }
  // Una scena preparata (per la demo e le prove): liste di id. `ondata` 1 o 2; i rng parte da `seme`.
  function costruisci(d) {
    var s = { seme: String(d.seme || 'scena'), rng: xmur3(String(d.seme || 'scena')), ondata: d.ondata || 1,
              difensori: [], mazzoDif: [], alieni: [], inArrivo: [], scarti: [], fine: null, rifiuto: null, ultimo: null };
    CHIAVI.forEach(function (k) { s[k] = (d[k] || []).map(daId); });
    return s;
  }

  // La mossa vera e propria. Restituisce un nuovo stato (rifiutata: lo stesso, con `rifiuto`).
  function apply(stato, mossa) {
    function no(testo) { var n = copia(stato); n.rifiuto = testo; return n; }
    if (stato.fine) return no('La partita è finita.');
    if (!mossa || ['doppio', 'singolo', 'sacrificio'].indexOf(mossa.t) < 0 || !Array.isArray(mossa.carte)) return no('Mossa non valida.');
    var ids = mossa.carte, doppio = mossa.t === 'doppio', k;
    if (ids.length !== (doppio ? 2 : 1)) return no(doppio ? 'Servono due difensori.' : 'Serve un difensore.');
    if (doppio && ids[0] === ids[1]) return no('Hai scelto due volte lo stesso difensore.');
    var usati = [];
    for (k = 0; k < ids.length; k++) {
      var c = stato.difensori.filter(function (x) { return x.id === ids[k]; })[0];
      if (!c) return no('Quel difensore non è sul tavolo.');
      usati.push(c);
    }
    var a = stato.inArrivo[0];
    if (doppio) {
      var somma = usati[0].valore + usati[1].valore;
      if (somma !== a.valore) return no('Fanno ' + somma + ': serve esattamente ' + a.valore + '.');
    } else if (mossa.t === 'singolo') {
      var d = usati[0];
      if (d.valore <= a.valore) return no('Il difensore deve valere di più dell\'alieno: ' + d.valore + ' non è più di ' + a.valore + '.');
      if (eRossa(d) === eRossa(a)) return no('Serve il colore opposto a quello dell\'alieno.');
    }

    var s = copia(stato);
    s.rifiuto = null;
    var persi = [];
    s.inArrivo.shift();
    if (mossa.t === 'doppio') {
      s.scarti.push(a);                                  // l'alieno va negli scarti, i difensori restano
      if (s.ondata === 2) {                              // seconda ondata: si perdono i difensori dello stesso colore dell'alieno
        persi = usati.filter(function (u) { return eRossa(u) === eRossa(a); });
        persi.forEach(function (u) { s.difensori = togli(s.difensori, u.id); s.scarti.push(u); });
      }
    } else if (mossa.t === 'singolo') {
      s.difensori = togli(s.difensori, usati[0].id);
      s.scarti.push(usati[0]);
      s.difensori.push(a);                               // l'alieno prende il posto del difensore
    } else {
      s.difensori = togli(s.difensori, usati[0].id);
      s.scarti.push(usati[0]);
      s.alieni.push(a);                                  // A1: in fondo, sotto tutte le coperte; gli scoperti restano in coda
    }
    // dopo ogni mossa: si rifornisce il tavolo fino a sei, finché c'è il mazzo dei difensori
    var pescate = 0;
    while (s.difensori.length < TAVOLO && s.mazzoDif.length) { s.difensori.push(s.mazzoDif.shift()); pescate++; }
    s.ultimo = { t: mossa.t, alieno: a, usati: usati, persi: persi, pescate: pescate, ondata2: false };

    // finite le tre scoperte si girano le prossime tre; finito il mazzo alieni, finisce l'ondata
    var vinto = false;
    if (!s.inArrivo.length) {
      if (s.alieni.length) girane(s);
      else if (s.ondata === 1) {
        s.ondata = 2;                                    // tutti gli scarti, difensori compresi, rimescolati
        s.alieni = mescola(s.scarti, s);
        s.scarti = [];
        girane(s);
        s.ultimo.ondata2 = true;
        if (!s.inArrivo.length) vinto = true;            // (non succede: ogni ondata lascia almeno uno scarto)
      } else vinto = true;
    }
    // Se l'ultimo alieno cade nello stesso colpo che svuota il tavolo è sconfitta (decisione di Damiano 23/10,
    // libro p. 14: «repel both waves without running out of resources»): punteggio −0, senza il −50.
    if (vinto && s.difensori.length) {
      s.fine = { esito: 'vittoria', punti: s.mazzoDif.length + s.difensori.length, nelMazzo: s.mazzoDif.length, sulTavolo: s.difensori.length };
    } else if (!s.difensori.length) {   // (anche con vinto: l'ondata è finita ma le forze sono esaurite)
      var rimasti = s.alieni.length + s.inArrivo.length, pen = s.ondata === 1 ? PENALITA : 0;
      s.fine = { esito: 'sconfitta', punti: 0 - rimasti - pen, rimasti: rimasti, penalita: pen };
    }
    return s;
  }

  // tutte le mosse possibili ora (per i giocatori automatici delle prove: l'app non le mostra mai)
  function mosseLegali(s) {
    var out = [], d = s.difensori, a = s.inArrivo[0], i, j;
    if (s.fine || !a) return out;
    for (i = 0; i < d.length; i++) for (j = i + 1; j < d.length; j++) {
      if (d[i].valore + d[j].valore === a.valore) out.push({ t: 'doppio', carte: [d[i].id, d[j].id] });
    }
    for (i = 0; i < d.length; i++) if (d[i].valore > a.valore && eRossa(d[i]) !== eRossa(a)) out.push({ t: 'singolo', carte: [d[i].id] });
    for (i = 0; i < d.length; i++) out.push({ t: 'sacrificio', carte: [d[i].id] });
    return out;
  }

  function carteNegliScarti(s) { return ordina(s.scarti); }
  function tutteLeCarte(s) {
    return s.difensori.concat(s.mazzoDif, s.alieni, s.inArrivo, s.scarti).map(function (c) { return c.id; }).sort();
  }

  return {
    TAVOLO: TAVOLO, IN_ARRIVO: IN_ARRIVO, PENALITA: PENALITA, SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO,
    nuova: nuova, costruisci: costruisci, apply: apply, mosseLegali: mosseLegali, carteNegliScarti: carteNegliScarti,
    tutteLeCarte: tutteLeCarte, mazzoCompleto: mazzoCompleto, daId: daId, nomeCarta: nomeCarta, sigla: sigla,
    ordina: ordina, eRossa: eRossa
  };
}));
