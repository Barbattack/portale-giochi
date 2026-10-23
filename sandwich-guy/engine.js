/*
 * The Sandwich Guy (titolo provvisorio) — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Panino`). Regole: owner inbox/isaludo-regole-2026-10-22.md,
 * sezione 2, e il libro (pp. 11-13).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri, F fiori, P picche.
 * Valori 1-13: Asso 1, Fante 11, Donna 12, Re 13. id = seme + valore ("Q1" = Asso di quadri).
 * Mazzo: la prima carta [0] è la cima. Mano: in ordine di arrivo (l'ordine di vista lo sceglie l'app).
 *
 * Mossa (l'unica):  { t:'scarta', carte:[id, id, id] }
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato
 * è identico tranne `rifiuto` (il perché, corto, in italiano). Se è accettata `rifiuto` è null
 * e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, mano:[carte], mazzo:[carte], scarti:[carte],
 *          vinto:bool (hai pescato l'ultima carta: si continua senza pescare),
 *          fine:null|{ esito:'vittoria'|'sconfitta', punti:carte in mano },
 *          rifiuto, ultimo }
 * ultimo: { carte:[carte scartate], tipo:'seme'|'colore'|'misto', previste, pescate (davvero),
 *           ignorate:n (non pescate per la mano piena: restano in cima al mazzo), haVinto:bool }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Panino = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MANO_MAX = 8;
  var SEMI = ['C', 'Q', 'F', 'P'];
  var ROSSI = ['C', 'Q'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var SIGLA_VALORE = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var PESCA = { seme: 4, colore: 3, misto: 2 };

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
  // ordine di vista: per valore, poi per seme
  function ordina(carte) {
    return carte.slice().sort(function (a, b) { return a.valore - b.valore || SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme); });
  }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['mano', 'mazzo', 'scarti'].forEach(function (k) { n[k] = s[k].slice(); });
    return n;
  }

  // ---------- il panino ----------
  // Tre valori fanno un panino se uno sta esattamente in mezzo agli altri due, con lo stesso
  // passo, girando dal Re all'Asso: a + c = 2·b (modulo 13). Un passo uguale nelle due metà
  // e sempre crescente (in tondo), quindi 8-10-8 non vale: 8→10 è +2, 10→8 è +11.
  function valePanino(a, b, c) {
    var v = [a % 13, b % 13, c % 13], k;
    for (k = 0; k < 3; k++) {
      var m = v[k], x = v[(k + 1) % 3], y = v[(k + 2) % 3];
      if ((((x + y - 2 * m) % 13) + 13) % 13 === 0) return true;
    }
    return false;
  }
  function ePanino(carte) {
    return carte.length === 3 && valePanino(carte[0].valore, carte[1].valore, carte[2].valore);
  }
  // quante carte si pescano: tre dello stesso seme 4; stesso colore, semi diversi 3; colori misti 2
  function tipoPanino(carte) {
    var semi = {}, rosse = 0;
    carte.forEach(function (c) { semi[c.seme] = true; if (eRossa(c)) rosse++; });
    if (Object.keys(semi).length === 1) return 'seme';
    if (rosse === 0 || rosse === carte.length) return 'colore';
    return 'misto';
  }
  // tutte le terne della mano che fanno un panino (liste di id)
  function mosseLegali(s) {
    var m = s.mano, out = [], i, j, k;
    for (i = 0; i < m.length; i++) for (j = i + 1; j < m.length; j++) for (k = j + 1; k < m.length; k++) {
      if (valePanino(m[i].valore, m[j].valore, m[k].valore)) out.push([m[i].id, m[j].id, m[k].id]);
    }
    return out;
  }
  function puoiFare(mano) {
    var n = mano.length, i, j, k;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) for (k = j + 1; k < n; k++) {
      if (valePanino(mano[i].valore, mano[j].valore, mano[k].valore)) return true;
    }
    return false;
  }

  // ---------- partita ----------
  // opzioni.inTesta: lista di id da mettere in cima al mazzo prima di pescare (per la demo e le prove)
  function nuova(seme, opzioni) {
    var o = opzioni || {};
    var s = { seme: String(seme), rng: xmur3(String(seme)), mano: [], mazzo: [], scarti: [],
              vinto: false, fine: null, rifiuto: null, ultimo: null };
    var m = mescola(mazzoCompleto(), s);
    if (o.inTesta && o.inTesta.length) {
      var testa = o.inTesta.map(daId);
      var resto = m.filter(function (c) { return o.inTesta.indexOf(c.id) < 0; });
      m = testa.concat(resto);
    }
    s.mano = m.splice(0, MANO_MAX);
    s.mazzo = m;
    controllaFine(s);
    return s;
  }
  // «Se in qualunque momento non puoi fare un panino, perdi.» Dopo la vittoria (mazzo finito)
  // si continua finché si può: quando non si può più la partita finisce, col punteggio.
  function controllaFine(s) {
    if (s.fine || puoiFare(s.mano)) return;
    s.fine = { esito: s.vinto ? 'vittoria' : 'sconfitta', punti: s.mano.length };
  }

  function apply(stato, mossa) {
    function no(testo) { var n = copia(stato); n.rifiuto = testo; return n; }
    if (stato.fine) return no('La partita è finita.');
    if (!mossa || mossa.t !== 'scarta' || !Array.isArray(mossa.carte)) return no('Mossa non valida.');
    var ids = mossa.carte;
    if (ids.length !== 3) return no('Servono esattamente tre carte.');
    if (ids[0] === ids[1] || ids[0] === ids[2] || ids[1] === ids[2]) return no('Hai scelto due volte la stessa carta.');
    var scelte = [], k, c;
    for (k = 0; k < 3; k++) {
      c = stato.mano.filter(function (x) { return x.id === ids[k]; })[0];
      if (!c) return no('Quella carta non è nella tua mano.');
      scelte.push(c);
    }
    if (!ePanino(scelte)) return no('Non è un panino: nessuna delle tre sta esattamente in mezzo alle altre due.');

    var s = copia(stato);
    s.rifiuto = null;
    s.mano = s.mano.filter(function (x) { return ids.indexOf(x.id) < 0; });
    s.scarti = s.scarti.concat(scelte);
    var tipo = tipoPanino(scelte), previste = PESCA[tipo];
    // Con la mano piena la pescata in più non si fa: la carta resta in cima al mazzo (X1, Damiano 23/10).
    // G2: se nel mazzo ne restano meno, peschi quelle che ci sono.
    var libere = MANO_MAX - s.mano.length;
    var pescate = Math.min(previste, libere, s.mazzo.length);
    var ignorate = previste - Math.min(previste, libere);   // quante non si pescano per la mano piena
    var prese = s.mazzo.splice(0, pescate);
    s.mano = s.mano.concat(prese);
    var haVinto = false;
    if (!s.vinto && s.mazzo.length === 0) { s.vinto = true; haVinto = true; }   // hai pescato davvero l'ultima carta
    s.ultimo = { carte: scelte, tipo: tipo, previste: previste, pescate: pescate, ignorate: ignorate, haVinto: haVinto };
    controllaFine(s);
    return s;
  }

  // ---------- cosa si può guardare ----------
  // Il mazzo si guarda come al tavolo, purché si rimescoli dopo: qui mostra QUALI carte restano,
  // in ordine di seme e valore, mai in che ordine usciranno (G1). Non cambia lo stato.
  function carteNelMazzo(s) { return ordina(s.mazzo); }
  function carteNegliScarti(s) { return ordina(s.scarti); }

  function tutteLeCarte(s) {
    return s.mano.concat(s.mazzo, s.scarti).map(function (c) { return c.id; }).sort();
  }

  return {
    MANO_MAX: MANO_MAX, SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO, NOME_VALORE: NOME_VALORE, PESCA: PESCA,
    nuova: nuova, apply: apply, ePanino: ePanino, valePanino: valePanino, tipoPanino: tipoPanino,
    mosseLegali: mosseLegali, puoiFare: puoiFare, carteNelMazzo: carteNelMazzo, carteNegliScarti: carteNegliScarti,
    tutteLeCarte: tutteLeCarte, mazzoCompleto: mazzoCompleto, daId: daId, nomeCarta: nomeCarta, sigla: sigla,
    ordina: ordina, eRossa: eRossa
  };
}));
