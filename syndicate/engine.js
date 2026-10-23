/*
 * Syndicate (titolo provvisorio) — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Syndicate`). Regole: owner inbox/isaludo-regole-2026-10-22.md,
 * sezione 8, e il libro (pp. 39-42).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri (rossi), F fiori, P picche (neri).
 * Le 40 numerate: valore 1-10, Asso 1. Per la regola dei sostituti l'Asso vale 1 e il 10 vale 0.
 * id = seme + valore ("Q10" = dieci di quadri).
 *
 * Stato: { seme, rng, fase:'scelta'|'gioco'|'fine',
 *          gradi: { 5:{membri:[carte], candidati:[carte]}, 4:{...}, 3, 2, 1 },   // 5 a sinistra, il più basso
 *          resto:[le 15 carte fra cui scegliere i tre membri; vuota dopo la scelta],
 *          escluse:[le 12 uscite alla preparazione], sacrificate:[carte], usciti:[chi è stato promosso dal grado 1],
 *          fine:null|{ esito:'vittoria'|'sconfitta', motivo:'vittoria'|'nessuna-mossa'|'resa', punti:n carte sacrificate },
 *          rifiuto:null|testo, ultimo:null|descrizione dell'ultima mossa }
 *
 * Mosse:
 *   { t:'scegli',    carte:[id,id,id] }                         la preparazione: i 3 membri del grado 5
 *   { t:'promuovi',  carta:id, dove:'membri'|'candidati'|null,   il membro promosso; dove va nel grado sopra
 *                    sostituto:id, sacrifica:id|null }           (null dal grado 1); il candidato che lo sostituisce;
 *                                                                chi esce se il grado sopra arriverebbe a 4 membri
 *   { t:'arrenditi' }                                           si perde (libro p. 42: «or you give up, you lose»)
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato
 * è identico tranne `rifiuto` (il perché, corto, in italiano).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Syndicate = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMI = ['C', 'Q', 'F', 'P'];
  var ROSSI = ['C', 'Q'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var SIGLA_VALORE = { 1: 'A' };
  var NOME_VALORE = { 1: 'Asso' };
  var GRADI = [5, 4, 3, 2, 1];          // da sinistra a destra
  var COLONNE = { 5: 9, 4: 7, 3: 5, 2: 3, 1: 1 };
  var MEMBRI = 3;                        // si promuove da un grado con esattamente 3 membri; al massimo 3

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
    SEMI.forEach(function (se) { for (var v = 1; v <= 10; v++) m.push(carta(se, v)); });
    return m;
  }
  function eRossa(c) { return ROSSI.indexOf(c.seme) >= 0; }
  function cifra(c) { return c.valore % 10; }          // Asso 1, dieci 0
  function nomeCarta(c) { return (NOME_VALORE[c.valore] || String(c.valore)) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return (SIGLA_VALORE[c.valore] || String(c.valore)) + SIMBOLO[c.seme]; }

  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    n.gradi = {};
    GRADI.forEach(function (g) {
      n.gradi[g] = { membri: s.gradi[g].membri.slice(), candidati: s.gradi[g].candidati.slice() };
    });
    ['resto', 'escluse', 'sacrificate', 'usciti'].forEach(function (k) { n[k] = s[k].slice(); });
    return n;
  }
  function togli(lista, id) { return lista.filter(function (c) { return c.id !== id; }); }
  function trova(lista, id) { return lista.filter(function (c) { return c.id === id; })[0]; }
  function vuoto() { var o = {}; GRADI.forEach(function (g) { o[g] = { membri: [], candidati: [] }; }); return o; }

  // ---------- partita ----------
  function nuova(seme) {
    var s = { seme: String(seme), rng: xmur3(String(seme)), fase: 'scelta', gradi: vuoto(),
              resto: [], escluse: [], sacrificate: [], usciti: [], fine: null, rifiuto: null, ultimo: null };
    var mazzo = mescola(mazzoCompleto(), s), k = 0;
    GRADI.forEach(function (g) { s.gradi[g].candidati = mazzo.slice(k, k + COLONNE[g]); k += COLONNE[g]; });
    s.resto = mazzo.slice(k);
    return s;
  }
  // Una scena preparata (per la demo e le prove): liste di id.
  // d.gradi = { 5:{membri:[...], candidati:[...]}, ... }; d.resto, d.escluse, d.sacrificate, d.usciti.
  function costruisci(d) {
    var s = { seme: String(d.seme || 'scena'), rng: xmur3(String(d.seme || 'scena')), fase: 'gioco', gradi: vuoto(),
              resto: (d.resto || []).map(daId), escluse: (d.escluse || []).map(daId),
              sacrificate: (d.sacrificate || []).map(daId), usciti: (d.usciti || []).map(daId),
              fine: null, rifiuto: null, ultimo: null };
    GRADI.forEach(function (g) {
      var x = (d.gradi && d.gradi[g]) || {};
      s.gradi[g].membri = (x.membri || []).map(daId);
      s.gradi[g].candidati = (x.candidati || []).map(daId);
    });
    if (s.resto.length) s.fase = 'scelta';
    return s;
  }

  // il sostituto di `c` nel grado g, quando si promuove `m`: vale l'ultima cifra della somma o del prodotto dei due rimasti?
  function vale(rimasti, c) {
    var a = cifra(rimasti[0]), b = cifra(rimasti[1]);
    return cifra(c) === (a + b) % 10 || cifra(c) === (a * b) % 10;
  }
  function haMosse(s) {
    for (var i = 0; i < GRADI.length; i++) {
      var gr = s.gradi[GRADI[i]];
      if (gr.membri.length !== MEMBRI) continue;
      for (var j = 0; j < MEMBRI; j++) {
        var rim = gr.membri.filter(function (_, k) { return k !== j; });
        for (var k = 0; k < gr.candidati.length; k++) if (vale(rim, gr.candidati[k])) return true;
      }
    }
    return false;
  }

  function sconfitta(s, motivo) {
    s.fase = 'fine';
    s.fine = { esito: 'sconfitta', motivo: motivo, punti: s.sacrificate.length };
  }

  // La mossa vera e propria. Restituisce un nuovo stato (rifiutata: lo stesso, con `rifiuto`).
  function apply(stato, mossa) {
    function no(testo) { var n = copia(stato); n.rifiuto = testo; return n; }
    if (stato.fine) return no('La partita è finita.');
    if (!mossa || ['scegli', 'promuovi', 'arrenditi'].indexOf(mossa.t) < 0) return no('Mossa non valida.');
    var s, k;

    // ---- la preparazione: tre membri per il grado 5 ----
    if (stato.fase === 'scelta') {
      if (mossa.t !== 'scegli') return no('Prima scegli i tre membri del grado 5.');
      var ids = mossa.carte;
      if (!Array.isArray(ids) || ids.length !== MEMBRI) return no('Scegli esattamente 3 carte fra le ' + stato.resto.length + ' rimaste.');
      if (ids[0] === ids[1] || ids[0] === ids[2] || ids[1] === ids[2]) return no('Hai scelto due volte la stessa carta.');
      var scelte = [];
      for (k = 0; k < ids.length; k++) {
        var c = trova(stato.resto, ids[k]);
        if (!c) return no('Quella carta non è fra le rimaste.');
        scelte.push(c);
      }
      s = copia(stato);
      s.rifiuto = null; s.fase = 'gioco';
      s.gradi[5].membri = scelte;
      s.escluse = s.escluse.concat(stato.resto.filter(function (x) { return !trova(scelte, x.id); }));
      s.resto = [];
      s.ultimo = { t: 'scegli', membri: scelte };
      if (!haMosse(s)) sconfitta(s, 'nessuna-mossa');
      return s;
    }
    if (mossa.t === 'scegli') return no('I membri del grado 5 sono già scelti.');

    // ---- ci si arrende ----
    if (mossa.t === 'arrenditi') {
      s = copia(stato); s.rifiuto = null;
      s.ultimo = { t: 'arrenditi' };
      sconfitta(s, 'resa');
      return s;
    }

    // ---- una promozione ----
    var g = null, m;
    GRADI.forEach(function (x) { if (trova(stato.gradi[x].membri, mossa.carta)) g = x; });
    if (g === null) {
      var comeCandidato = GRADI.some(function (x) { return trova(stato.gradi[x].candidati, mossa.carta); });
      return no(comeCandidato ? 'Si promuove un membro, non un candidato.' : 'Quella carta non è un membro.');
    }
    var gr = stato.gradi[g];
    m = trova(gr.membri, mossa.carta);
    if (gr.membri.length !== MEMBRI) return no('Si promuove solo da un grado con esattamente 3 membri: il grado ' + g + ' ne ha ' + gr.membri.length + '.');
    if (g > 1 && mossa.dove !== 'membri' && mossa.dove !== 'candidati') return no('Scegli dove va il promosso: fra i membri o fra i candidati del grado ' + (g - 1) + '.');
    if (!mossa.sostituto) return no('Scegli il sostituto: un candidato dello stesso grado.');
    var sost = trova(gr.candidati, mossa.sostituto);
    if (!sost) return no('Il sostituto deve essere un candidato dello stesso grado.');
    var rimasti = gr.membri.filter(function (x) { return x.id !== m.id; });
    if (!vale(rimasti, sost)) return no('Non vale: il sostituto deve avere l\'ultima cifra della somma o del prodotto dei due membri rimasti.');

    var sopra = g > 1 ? stato.gradi[g - 1] : null;
    var serveSacrificio = !!sopra && mossa.dove === 'membri' && sopra.membri.length >= MEMBRI;
    var sacrificata = null;
    if (serveSacrificio) {
      if (!mossa.sacrifica) return no('Il grado ' + (g - 1) + ' avrebbe 4 membri: scegli chi sacrificare.');
      sacrificata = trova(sopra.membri.concat([m]), mossa.sacrifica);
      if (!sacrificata) return no('Si sacrifica uno dei quattro membri del grado ' + (g - 1) + '.');
    } else if (mossa.sacrifica) return no('Non c\'è nessuno da sacrificare.');

    s = copia(stato);
    s.rifiuto = null;
    var i = gr.membri.indexOf(m);                              // il sostituto prende il posto del promosso
    s.gradi[g].membri[i] = sost;
    s.gradi[g].candidati = togli(s.gradi[g].candidati, sost.id);
    if (g === 1) {
      s.usciti.push(m);                                        // promosso a «grado zero»: si vince
    } else if (mossa.dove === 'membri') {
      s.gradi[g - 1].membri.push(m);
      if (sacrificata) {
        s.gradi[g - 1].membri = togli(s.gradi[g - 1].membri, sacrificata.id);
        s.sacrificate.push(sacrificata);
      }
    } else {
      s.gradi[g - 1].candidati.push(m);
    }
    s.ultimo = { t: 'promuovi', carta: m, da: g, dove: g > 1 ? mossa.dove : null, sostituto: sost, sacrificata: sacrificata };
    if (g === 1) {
      s.fase = 'fine';
      s.fine = { esito: 'vittoria', motivo: 'vittoria', punti: s.sacrificate.length };
    } else if (!haMosse(s)) sconfitta(s, 'nessuna-mossa');
    return s;
  }

  // tutte le mosse possibili ora (per i giocatori automatici delle prove: l'app non le mostra mai)
  function mosseLegali(s) {
    var out = [];
    if (s.fine) return out;
    if (s.fase === 'scelta') {
      var r = s.resto;
      for (var a = 0; a < r.length; a++) for (var b = a + 1; b < r.length; b++) for (var c = b + 1; c < r.length; c++) {
        out.push({ t: 'scegli', carte: [r[a].id, r[b].id, r[c].id] });
      }
      return out;
    }
    GRADI.forEach(function (g) {
      var gr = s.gradi[g];
      if (gr.membri.length !== MEMBRI) return;
      gr.membri.forEach(function (m) {
        var rim = gr.membri.filter(function (x) { return x.id !== m.id; });
        gr.candidati.forEach(function (sost) {
          if (!vale(rim, sost)) return;
          if (g === 1) { out.push({ t: 'promuovi', carta: m.id, dove: null, sostituto: sost.id, sacrifica: null }); return; }
          out.push({ t: 'promuovi', carta: m.id, dove: 'candidati', sostituto: sost.id, sacrifica: null });
          var sopra = s.gradi[g - 1];
          if (sopra.membri.length >= MEMBRI) {
            sopra.membri.concat([m]).forEach(function (x) {
              out.push({ t: 'promuovi', carta: m.id, dove: 'membri', sostituto: sost.id, sacrifica: x.id });
            });
          } else out.push({ t: 'promuovi', carta: m.id, dove: 'membri', sostituto: sost.id, sacrifica: null });
        });
      });
    });
    return out;
  }

  function tutteLeCarte(s) {
    var t = s.resto.concat(s.escluse, s.sacrificate, s.usciti);
    GRADI.forEach(function (g) { t = t.concat(s.gradi[g].membri, s.gradi[g].candidati); });
    return t.map(function (c) { return c.id; }).sort();
  }

  return {
    GRADI: GRADI, MEMBRI: MEMBRI, SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO,
    nuova: nuova, costruisci: costruisci, apply: apply, mosseLegali: mosseLegali, haMosse: haMosse,
    tutteLeCarte: tutteLeCarte, mazzoCompleto: mazzoCompleto, daId: daId, nomeCarta: nomeCarta, sigla: sigla,
    eRossa: eRossa, cifra: cifra
  };
}));
