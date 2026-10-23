/*
 * Il Lupo — il motore delle regole.
 * Ispirato a Lobo di James Ernest (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Lupo`). Regole: owner inbox/lobo-regole-2026-10-22.md.
 *
 * Carte: { id, seme, valore }. Valori 1-10, cinque semi (colori) R B V G P.
 * Il seme non conta mai nelle regole. id = seme + valore ("R7").
 *
 * Mosse (le fa sempre il giocatore, il Lupo non gioca):
 *   { t:'gioca', azione:'perfetta'|'somma'|'divisa'|'sopra', mie:[id], sue:[id] }
 *   { t:'fermati' }
 *   { t:'prossima' }                      // dopo la fine di una mano, se la partita continua
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata
 * lo stato è identico al precedente tranne `rifiuto` (il perché, corto, in italiano).
 * Se è accettata `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, livello, rng, tu:[carte], lupo:[carte], mazzo:[carte] (la prima è
 * scoperta), scarti:[carte], punti:{tu,lupo}, mano:n, fine:null|{chi,motivo,punti},
 * vincitore:null|'tu'|'lupo', senzaMosse:bool, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Lupo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MANO = 4, TRAGUARDO = 100;
  var SEMI = ['R', 'B', 'V', 'G', 'P'];
  var NOME_SEME = { R: 'rosso', B: 'blu', V: 'verde', G: 'giallo', P: 'viola' };
  var NOME_AZIONE = { perfetta: 'Perfetta', somma: 'Somma', divisa: 'Divisa', sopra: 'Sopra', fermati: 'Fermati' };
  // valore massimo delle carte per livello (facile senza 9 e 10, normale senza i 10)
  var LIVELLI = { facile: 8, normale: 9, difficile: 10 };

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
  function mazzoCompleto(livello) {
    var max = LIVELLI[livello] || LIVELLI.difficile, m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= max; v++) m.push(carta(s, v)); });
    return m;
  }
  function somma(carte) { return carte.reduce(function (t, c) { return t + c.valore; }, 0); }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['tu', 'lupo', 'mazzo', 'scarti'].forEach(function (k) { n[k] = s[k].slice(); });
    n.punti = { tu: s.punti.tu, lupo: s.punti.lupo };
    return n;
  }

  // ---------- pesca e rimescolamento ----------
  // Pesca n carte per `chi` ('tu' | 'lupo'). Se il mazzo non basta si prendono quelle
  // che ci sono e il resto arriva dagli scarti rimescolati (le carte in mano non si toccano).
  function pesca(s, chi, n) {
    var prese = [], rimescolato = false;
    while (n > 0) {
      if (!s.mazzo.length) {
        if (!s.scarti.length) break;
        s.mazzo = mescola(s.scarti, s); s.scarti = []; rimescolato = true;
      }
      var k = Math.min(n, s.mazzo.length);
      prese = prese.concat(s.mazzo.splice(0, k));
      n -= k;
    }
    s[chi] = s[chi].concat(prese);
    return { carte: prese, rimescolato: rimescolato };
  }
  // la prima carta del mazzo dev'essere sempre scoperta: se il mazzo è vuoto si rimescola subito
  function assicuraCima(s) {
    if (!s.mazzo.length && s.scarti.length) { s.mazzo = mescola(s.scarti, s); s.scarti = []; return true; }
    return false;
  }

  // ---------- mosse possibili (serve solo a dire «devi fermarti») ----------
  function ciSonoMosse(tu, lupo) {
    var i, j;
    for (i = 0; i < tu.length; i++) for (j = 0; j < lupo.length; j++) {
      if (tu[i].valore === lupo[j].valore) return true;           // perfetta
      if (lupo[j].valore < tu[i].valore) return true;             // sopra
    }
    var n = tu.length;
    for (var m = 1; m < (1 << n); m++) {                           // somma: 2+ carte tue
      var cnt = 0, tot = 0;
      for (i = 0; i < n; i++) if (m & (1 << i)) { cnt++; tot += tu[i].valore; }
      if (cnt >= 2 && lupo.some(function (c) { return c.valore === tot; })) return true;
    }
    // divisa: sottoinsiemi di 2+ carte del Lupo; dp[somma] = 0 mai, 1 con una carta, 2 con due o più
    var dp = [];
    for (i = 0; i <= 10; i++) dp.push(0);
    lupo.forEach(function (c) {
      for (var t = 10; t >= 0; t--) {
        if (!dp[t] || t + c.valore > 10) continue;
        dp[t + c.valore] = 2;
      }
      if (c.valore <= 10 && dp[c.valore] < 1) dp[c.valore] = 1;
    });
    return tu.some(function (c) { return dp[c.valore] === 2; });
  }
  function aggiornaMosse(s) { s.senzaMosse = !s.fine && !ciSonoMosse(s.tu, s.lupo); }

  // ---------- partita ----------
  /*
   * opzioni: { livello:'facile'|'normale'|'difficile' (default normale),
   *            inTesta:[id]   // solo prove e demo: queste carte stanno in cima al mazzo, in ordine;
   *                           // il resto è mescolato col seme
   *          }
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var livello = LIVELLI[opzioni.livello] ? opzioni.livello : 'normale';
    var s = {
      seme: String(seme), livello: livello, rng: xmur3(String(seme)) | 0,
      tu: [], lupo: [], mazzo: [], scarti: [],
      punti: { tu: 0, lupo: 0 }, mano: 0, fine: null, vincitore: null,
      senzaMosse: false, rifiuto: null, ultimo: null
    };
    var tutte = mazzoCompleto(livello), testa = (opzioni.inTesta || []).map(daId);
    var ids = {}; testa.forEach(function (c) { ids[c.id] = true; });
    s.mazzo = testa.concat(mescola(tutte.filter(function (c) { return !ids[c.id]; }), s));
    nuovaMano(s);
    return s;
  }
  // Distribuisce una mano. Se nel mazzo non bastano 4 + 4 carte più quella scoperta
  // si rimescola tutto (mazzo + scarti), come consiglia l'autore.
  function nuovaMano(s) {
    var rimescolato = false;
    if (s.mazzo.length < 2 * MANO + 1) {
      s.mazzo = mescola(s.mazzo.concat(s.scarti), s); s.scarti = []; rimescolato = true;
    }
    s.lupo = s.mazzo.splice(0, MANO);
    s.tu = s.mazzo.splice(0, MANO);
    s.mano += 1; s.fine = null;
    s.ultimo = { azione: 'mano', rimescolato: rimescolato };
    aggiornaMosse(s);
  }

  function chiudiMano(s, chi, motivo) {
    var punti = somma(chi === 'tu' ? s.tu : s.lupo);
    s.fine = { chi: chi, motivo: motivo, punti: punti };
    s.punti[chi] += punti;
    if (s.punti[chi] >= TRAGUARDO) s.vincitore = chi;
    s.senzaMosse = false;
  }

  function valoriTesto(carte) { return carte.map(function (c) { return c.valore; }).join(' + '); }

  function apply(stato, mossa) {
    var s = copia(stato);
    s.rifiuto = null;
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }

    if (!mossa || !mossa.t) return no('Mossa non valida');

    if (mossa.t === 'prossima') {
      if (!s.fine) return no('La mano non è finita');
      if (s.vincitore) return no('La partita è finita');
      s.scarti = s.scarti.concat(s.tu, s.lupo); s.tu = []; s.lupo = [];
      nuovaMano(s);
      return s;
    }
    if (s.fine) return no('La mano è finita');

    if (mossa.t === 'fermati') {
      chiudiMano(s, 'lupo', 'fermata');
      s.ultimo = { azione: 'fermati' };
      return s;
    }
    if (mossa.t !== 'gioca') return no('Mossa non valida');

    var az = mossa.azione;
    if (az !== 'perfetta' && az !== 'somma' && az !== 'divisa' && az !== 'sopra') return no('Scegli una mossa');
    if (s.senzaMosse) return no('Nessuna mossa possibile: devi fermarti');

    function trova(ids, mano) {
      var out = [], visti = {};
      for (var i = 0; i < (ids || []).length; i++) {
        var c = mano.filter(function (x) { return x.id === ids[i]; })[0];
        if (!c || visti[c.id]) return null;
        visti[c.id] = true; out.push(c);
      }
      return out;
    }
    var mie = trova(mossa.mie, s.tu), sue = trova(mossa.sue, s.lupo);
    if (!mie || !sue) return no('Carta non trovata');
    var nome = NOME_AZIONE[az] + ': ';
    if (!mie.length) return no('Scegli almeno una tua carta');
    if (!sue.length) return no('Scegli almeno una carta del Lupo');

    if (az === 'perfetta') {
      if (mie.length !== 1 || sue.length !== 1) return no(nome + 'serve 1 tua carta e 1 del Lupo');
      if (mie[0].valore !== sue[0].valore) return no(nome + 'il ' + sue[0].valore + ' del Lupo non è uguale al tuo ' + mie[0].valore);
    } else if (az === 'somma') {
      if (mie.length < 2) return no(nome + 'servono almeno 2 carte tue');
      if (sue.length !== 1) return no(nome + 'prendi 1 sola carta del Lupo');
      var tot = somma(mie);
      if (tot !== sue[0].valore) {
        var haTot = s.lupo.some(function (c) { return c.valore === tot; });
        return no('La somma fa ' + tot + (haTot ? ', ma hai scelto il ' + sue[0].valore + ' del Lupo' : ', il Lupo non ha un ' + tot));
      }
    } else if (az === 'divisa') {
      if (mie.length !== 1) return no(nome + 'gioca 1 sola carta tua');
      if (sue.length < 2) return no(nome + 'servono almeno 2 carte del Lupo');
      if (somma(sue) !== mie[0].valore) return no(nome + 'le carte del Lupo fanno ' + somma(sue) + ', la tua è un ' + mie[0].valore);
    } else { // sopra
      if (mie.length !== 1 || sue.length !== 1) return no(nome + 'serve 1 tua carta e 1 del Lupo');
      if (sue[0].valore >= mie[0].valore) return no(nome + 'il ' + sue[0].valore + ' del Lupo non è più piccolo del tuo ' + mie[0].valore);
    }

    // mossa accettata: le carte giocate e prese vanno negli scarti
    var idMie = mie.map(function (c) { return c.id; }), idSue = sue.map(function (c) { return c.id; });
    s.tu = s.tu.filter(function (c) { return idMie.indexOf(c.id) < 0; });
    s.lupo = s.lupo.filter(function (c) { return idSue.indexOf(c.id) < 0; });
    s.scarti = s.scarti.concat(mie, sue);
    var u = { azione: az, mie: mie, sue: sue, chi: null, quante: 0, carte: [], rimescolato: false };

    if (az === 'perfetta' || az === 'somma') { u.chi = 'tu'; u.quante = 1; }
    else if (az === 'divisa') { u.chi = 'lupo'; u.quante = 1; }
    else { u.chi = 'lupo'; u.quante = mie[0].valore - sue[0].valore; }
    var p = pesca(s, u.chi, u.quante);
    u.carte = p.carte; u.rimescolato = p.rimescolato;

    // la pescata fa parte della mossa: se il Lupo resta senza carte, i punti si contano dopo averla fatta
    if (!s.lupo.length) chiudiMano(s, 'tu', 'lupo-vuoto');
    else if (!s.tu.length) chiudiMano(s, 'lupo', 'senza-carte');
    else if (assicuraCima(s)) u.rimescolato = true;
    s.ultimo = u;
    aggiornaMosse(s);
    return s;
  }

  return {
    nuova: nuova, apply: apply, carta: carta, daId: daId, somma: somma, ciSonoMosse: ciSonoMosse,
    mazzoCompleto: mazzoCompleto, TRAGUARDO: TRAGUARDO, MANO: MANO, LIVELLI: LIVELLI,
    SEMI: SEMI, NOME_SEME: NOME_SEME, NOME_AZIONE: NOME_AZIONE
  };
}));
