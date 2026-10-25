/*
 * Skyway — il motore delle regole (di Wil Su, collezione Isaludo).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 1; libro, pagine 7-10.
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista
 * di mosse la partita è sempre la stessa. Gira in node e nel browser (si chiama `Skyway`).
 *
 * Carte: { id, seme, valore }. Semi H cuori, D quadri, C fiori, S picche. Asso = 1.
 * Il mazzo sono le 40 carte numerate (Asso-10), niente figure (le tre figure dei giri
 * sono solo segnalini: le mostra l'interfaccia, non sono carte del mazzo).
 *
 * Il mercato: tre pile scoperte, [2, 2, 1] carte, date sempre allo stesso modo: la prima pila
 * prende le prime due carte, la seconda le due dopo, la terza l'ultima. In ogni pila la carta
 * data per seconda sta SOPRA (libro p. 9). Una pila è un array dal fondo alla cima.
 *
 * La griglia: 9 caselle, indice = riga * 3 + colonna (0 in alto a sinistra, 8 in basso a destra).
 * Ogni casella è un array di carte dal fondo alla cima, al massimo 3.
 *
 * Mossa (una sola, la fa sempre il giocatore):
 *   { t:'gioca', pila: 0..2, casella: 0..8 }   // prendi la pila, le altre vanno negli scarti,
 *                                              // la posi sopra la casella; oltre 3, cadono quelle in fondo
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è
 * identico al precedente tranne `rifiuto` (il perché, corto, in italiano). Se è accettata
 * `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, mazzo:[carte] (la prima è la cima), scarti:[carte], mercato:[pila,pila,pila],
 *          griglia:[9 caselle], giro:1..3, ultima:true se il mercato che c'è è l'ultimo della partita,
 *          fine:null | {vinto, lunghezze:{H,D,C,S}, punteggio, sequenze}, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Skyway = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GIRI = 3;            // si passa tre volte per il mazzo
  var ALTEZZA = 3;         // una casella tiene al massimo 3 carte
  var LATO = 3;            // griglia 3x3
  var MERCATO = [2, 2, 1]; // carte di ogni pila del mercato
  var LUNGHEZZA_VINCENTE = 5;
  var SEMI = ['H', 'D', 'C', 'S'];
  var SIMBOLO = { H: '♥︎', D: '♦︎', C: '♣︎', S: '♠︎' };
  var NOME_SEME = { H: 'cuori', D: 'quadri', C: 'fiori', S: 'picche' };
  var NOME_CASELLA = ['in alto a sinistra', 'in alto al centro', 'in alto a destra',
                      'a sinistra al centro', 'al centro', 'a destra al centro',
                      'in basso a sinistra', 'in basso al centro', 'in basso a destra'];

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
  function mescola(arr, s) {            // Fisher-Yates
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(prossimoCaso(s) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- carte ----------
  function carta(seme, valore) { return { id: seme + valore, seme: seme, valore: valore }; }
  function daId(id) { return carta(id[0], +id.slice(1)); }
  function etichetta(v) { return v === 1 ? 'A' : String(v); }
  function nomeValore(v) { return v === 1 ? 'Asso' : String(v); }
  function nomeCarta(c) { return nomeValore(c.valore) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return (c.valore === 1 ? 'A' : c.valore) + SIMBOLO[c.seme]; }
  function mazzoCompleto() {            // le 40 carte dall'Asso al 10
    var m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= 10; v++) m.push(carta(s, v)); });
    return m;
  }

  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    n.mazzo = s.mazzo.slice();
    n.scarti = s.scarti.slice();
    n.mercato = s.mercato.map(function (p) { return p.slice(); });
    n.griglia = s.griglia.map(function (c) { return c.slice(); });
    return n;
  }

  // ---------- il mercato ----------
  /*
   * Distribuisce cinque carte in tre pile (2, 2, 1), sempre nello stesso ordine. Se il mazzo
   * finisce a metà: si rimescolano gli scarti e si continua; si gira il segnalino del giro
   * successivo. Al terzo giro, invece, quel rimescolamento è l'ultimo e il mercato che si sta
   * completando è l'ultimo della partita (`ultima`). Anche se il terzo mazzo finisce proprio con
   * la quinta carta del mercato, quel mercato è l'ultimo.
   */
  function riempiMercato(n) {
    var m = [];
    MERCATO.forEach(function (quante) {
      var pila = [];
      for (var k = 0; k < quante; k++) {
        if (!n.mazzo.length) {
          if (!n.scarti.length) break;                // non può succedere (vedi le prove), ma non si blocca
          if (n.giro < GIRI) n.giro++; else n.ultima = true;
          n.mazzo = mescola(n.scarti, n);
          n.scarti = [];
        }
        pila.push(n.mazzo.shift());
      }
      m.push(pila);
    });
    n.mercato = m;
    if (n.giro === GIRI && !n.mazzo.length) n.ultima = true;
  }

  // ---------- il conteggio ----------
  function vicine(a, b) {
    return Math.abs(Math.floor(a / LATO) - Math.floor(b / LATO)) + Math.abs((a % LATO) - (b % LATO)) === 1;
  }
  /*
   * La sequenza crescente più lunga di un seme. Ogni carta di quel seme è un nodo (casella, valore);
   * da un nodo si passa a un altro se la casella è vicina (in orizzontale o in verticale, e quindi
   * DIVERSA) e il valore è più grande (strettamente: due carte dello stesso seme non hanno mai lo
   * stesso valore). Si può tornare su una casella già usata, con un'altra carta; lo strato non conta.
   * I valori crescono, quindi non ci sono cicli: si guardano i nodi dal valore più alto al più
   * basso, e per ognuno la strada più lunga che parte da lui. Ricerca completa, non a caso.
   * Restituisce { lung, percorso: [{ casella, strato, carta }] }.
   */
  function sequenza(griglia, seme) {
    var nodi = [];
    griglia.forEach(function (cas, c) {
      cas.forEach(function (cr, strato) { if (cr.seme === seme) nodi.push({ casella: c, strato: strato, carta: cr }); });
    });
    nodi.sort(function (a, b) { return a.carta.valore - b.carta.valore; });
    var best = [], dopo = [], i, j;
    for (i = nodi.length - 1; i >= 0; i--) {
      best[i] = 1; dopo[i] = -1;
      for (j = i + 1; j < nodi.length; j++) {
        if (nodi[j].carta.valore > nodi[i].carta.valore && vicine(nodi[i].casella, nodi[j].casella) && best[j] + 1 > best[i]) {
          best[i] = best[j] + 1; dopo[i] = j;
        }
      }
    }
    var inizio = -1;
    for (i = 0; i < nodi.length; i++) if (inizio < 0 || best[i] > best[inizio]) inizio = i;
    var percorso = [];
    for (i = inizio; i >= 0; i = dopo[i]) percorso.push(nodi[i]);
    return { lung: percorso.length, percorso: percorso };
  }
  function sequenze(griglia) {
    var out = {};
    SEMI.forEach(function (s) { out[s] = sequenza(griglia, s); });
    return out;
  }
  function chiudi(s) {              // calcola la fine della partita
    var q = sequenze(s.griglia), l = {}, tot = 0, vinto = true;
    SEMI.forEach(function (x) { l[x] = q[x].lung; tot += q[x].lung; if (q[x].lung < LUNGHEZZA_VINCENTE) vinto = false; });
    s.fine = { vinto: vinto, lunghezze: l, punteggio: tot, sequenze: q };
  }

  // ---------- partita ----------
  /*
   * opzioni (solo prove e demo):
   *   griglia: [9 caselle, ognuna una lista di id dal fondo];  scarti: [id];
   *   mercato: [pila, pila, pila] (liste di id dal fondo; se manca si distribuisce dal mazzo);
   *   inTesta: [id] in cima al mazzo, in ordine;  giro: 1..3;  ultima: true;  finita: true.
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var s = {
      seme: String(seme), rng: xmur3(String(seme)) | 0,
      mazzo: [], scarti: [], mercato: [[], [], []],
      griglia: [], giro: opzioni.giro || 1, ultima: !!opzioni.ultima,
      fine: null, rifiuto: null, ultimo: null
    };
    var usate = {}, i;
    function prendi(ids) { return ids.map(function (id) { usate[id] = true; return daId(id); }); }
    for (i = 0; i < LATO * LATO; i++) s.griglia.push(prendi((opzioni.griglia && opzioni.griglia[i]) || []));
    s.scarti = prendi(opzioni.scarti || []);
    if (opzioni.mercato) s.mercato = opzioni.mercato.map(prendi);
    var testa = prendi(opzioni.inTesta || []);
    var resto = mescola(mazzoCompleto().filter(function (c) { return !usate[c.id]; }), s);
    s.mazzo = testa.concat(resto);
    if (!opzioni.mercato) riempiMercato(s);
    s.ultimo = { azione: 'inizio' };
    if (opzioni.finita) chiudi(s);
    return s;
  }

  function apply(stato, mossa) {
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }
    if (!mossa || mossa.t !== 'gioca') return no('Mossa non valida');
    if (stato.fine) return no('La partita è finita');
    var p = mossa.pila, c = mossa.casella;
    if (typeof p !== 'number' || p !== Math.floor(p) || p < 0 || p >= stato.mercato.length) return no('Scegli prima una pila');
    if (typeof c !== 'number' || c !== Math.floor(c) || c < 0 || c >= LATO * LATO) return no('Scegli prima una casella');
    if (!stato.mercato[p].length) return no('Quella pila è vuota');

    var s = copia(stato);
    var presa = s.mercato[p];
    var scartate = [];
    s.mercato.forEach(function (altra, k) { if (k !== p) altra.forEach(function (x) { scartate.push(x); }); });
    var casella = s.griglia[c].concat(presa), cadute = [];
    while (casella.length > ALTEZZA) cadute.push(casella.shift());       // cade il fondo
    s.griglia[c] = casella;
    s.scarti = s.scarti.concat(scartate, cadute);
    s.mercato = [[], [], []];
    s.rifiuto = null;
    s.ultimo = { azione: 'gioca', pila: presa, casella: c, scartate: scartate, cadute: cadute };
    if (s.ultima) chiudi(s);
    else riempiMercato(s);
    return s;
  }

  /*
   * cosaCade(stato, pila, casella) — pura: le carte che cadrebbero (dal fondo) se si posasse quella pila su quella casella.
   * Elenco vuoto se non cade niente, o se la pila o la casella non vanno bene. Non cambia lo stato. È lo stesso conto di apply.
   */
  function cosaCade(stato, pila, casella) {
    if (typeof pila !== 'number' || pila !== Math.floor(pila) || pila < 0 || pila >= stato.mercato.length) return [];
    if (typeof casella !== 'number' || casella !== Math.floor(casella) || casella < 0 || casella >= LATO * LATO) return [];
    if (!stato.mercato[pila].length) return [];
    var tot = stato.griglia[casella].length + stato.mercato[pila].length;
    return stato.griglia[casella].concat(stato.mercato[pila]).slice(0, Math.max(0, tot - ALTEZZA));
  }

  function tutte(s) {                // tutte le carte del tavolo, per le prove
    var a = s.mazzo.concat(s.scarti);
    s.mercato.forEach(function (p) { a = a.concat(p); });
    s.griglia.forEach(function (c) { a = a.concat(c); });
    return a;
  }

  return {
    nuova: nuova, apply: apply, cosaCade: cosaCade, sequenza: sequenza, sequenze: sequenze, vicine: vicine, tutte: tutte,
    carta: carta, daId: daId, mazzoCompleto: mazzoCompleto,
    etichetta: etichetta, nomeValore: nomeValore, nomeCarta: nomeCarta, sigla: sigla,
    GIRI: GIRI, ALTEZZA: ALTEZZA, LATO: LATO, MERCATO: MERCATO, LUNGHEZZA_VINCENTE: LUNGHEZZA_VINCENTE,
    SEMI: SEMI, SIMBOLO: SIMBOLO, NOME_SEME: NOME_SEME, NOME_CASELLA: NOME_CASELLA
  };
}));
