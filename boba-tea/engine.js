/*
 * The First Boba Tea Shop in London (titolo provvisorio) — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista di mosse
 * la partita è sempre la stessa. Gira in node e nel browser (nel browser si chiama `Boba`).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 5, e il libro (pp. 24-28).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri, F fiori, P picche. Valori 1-13, Asso 1.
 * Code: 4 liste di carte in ordine dal FONDO (valore più basso) alla CIMA (più alto), pari ammessi.
 * Posto: indice d'inserimento `pos` in una coda: 0 = sotto la più bassa, n = sopra la più alta,
 *   k = fra la carta k-1 e la carta k. Mazzo: la prima carta [0] è la cima.
 *
 * Mosse:
 *   { t:'pesca', coda:0-3, pos }   scelto il posto e confermato, si pesca
 *   { t:'resta' }                  (solo con un cliente che non sta) tutta la coda negli scarti, la carta comincia una coda nuova
 *   { t:'caccia' }                 (idem) scarti la carta e la prima del mazzo, peschi la successiva e la provi nello stesso posto
 * B1 (Damiano, 23/10): col mazzo vuoto si può cacciare, e si scarta solo la carta in mano; con una
 * carta sola nel mazzo si scartano tutte e due e il mazzo è finito.
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se rifiutata, è identico tranne `rifiuto`
 * (il perché, corto). Se accettata `rifiuto` è null e `ultimo` racconta cosa è successo.
 *
 * Stato: { seme, rng, code, mazzo, scarti,
 *          mano: null | carta (il cliente pescato che non sta: va deciso Resta o Caccialo),
 *          posto: null | {coda, pos} (il posto scelto, finché c'è un cliente da decidere),
 *          fine: null | { esito:'vittoria'|'sconfitta', motivo:'quattro'|'mazzo', valore (se quattro), punti:carte in coda },
 *          rifiuto, ultimo }
 * ultimo: { azione:'pesca'|'resta'|'caccia', coda, pos, scartate:[carte], pescata:carta|null (l'ultima pescata),
 *           entrata:bool, quarto:valore|null }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Boba = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMI = ['C', 'Q', 'F', 'P'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var SIGLA_VALORE = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var NUM_CODE = 4;

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
  function prossimoCaso(s) {
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
  function eRossa(c) { return c.seme === 'C' || c.seme === 'Q'; }
  function nomeCarta(c) { return (NOME_VALORE[c.valore] || String(c.valore)) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return (SIGLA_VALORE[c.valore] || String(c.valore)) + SIMBOLO[c.seme]; }
  function ordina(carte) {
    return carte.slice().sort(function (a, b) { return a.valore - b.valore || SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme); });
  }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    n.code = s.code.map(function (c) { return c.slice(); });
    n.mazzo = s.mazzo.slice();
    n.scarti = s.scarti.slice();
    return n;
  }

  // ---------- la regola della buona educazione ----------
  // La carta `c` sta nel posto `pos` della coda `coda` se non è più bassa di quella che le sta sotto
  // e non è più alta di quella che le sta sopra (i pari vanno bene).
  function entra(coda, pos, c) {
    if (pos > 0 && coda[pos - 1].valore > c.valore) return false;
    if (pos < coda.length && c.valore > coda[pos].valore) return false;
    return true;
  }
  function codaOrdinata(coda) {
    for (var i = 1; i < coda.length; i++) if (coda[i].valore < coda[i - 1].valore) return false;
    return true;
  }

  // ---------- scarti ----------
  function contaScarti(s) {
    var n = {};
    s.scarti.forEach(function (c) { n[c.valore] = (n[c.valore] || 0) + 1; });
    return n;
  }
  // tre file come consiglia il libro (p. 27): la prima volta che esce un valore va nella fila 1,
  // la seconda nella 2, la terza nella 3. Ogni fila è in ordine di valore.
  function fileScarti(s) {
    var viste = {}, file = [[], [], []];
    s.scarti.forEach(function (c) {
      var k = viste[c.valore] = (viste[c.valore] || 0) + 1;
      file[Math.min(k, 3) - 1].push(c);
    });
    return file.map(ordina);
  }
  function quartoValore(s) {
    var n = contaScarti(s);
    for (var v = 1; v <= 13; v++) if (n[v] >= 4) return v;
    return null;
  }
  function carteInCoda(s) { return s.code.reduce(function (a, c) { return a + c.length; }, 0); }

  // ---------- partita ----------
  // opzioni (per la demo e le prove): code (liste di id, dal fondo alla cima), scarti (id), inTesta (id in cima al mazzo)
  function nuova(seme, opzioni) {
    var o = opzioni || {};
    var s = { seme: String(seme), rng: xmur3(String(seme)), code: [], mazzo: [], scarti: [],
              mano: null, posto: null, fine: null, rifiuto: null, ultimo: null };
    var m = mescola(mazzoCompleto(), s);
    if (o.code) {
      s.code = o.code.map(function (l) { return l.map(daId); });
      s.scarti = (o.scarti || []).map(daId);
      var usate = {};
      o.code.forEach(function (l) { l.forEach(function (id) { usate[id] = true; }); });
      (o.scarti || []).forEach(function (id) { usate[id] = true; });
      m = m.filter(function (c) { return !usate[c.id]; });
    } else {
      for (var k = 0; k < NUM_CODE; k++) s.code.push([m.shift()]);
    }
    if (o.inTesta && o.inTesta.length) {
      var testa = o.inTesta.map(daId);
      m = testa.concat(m.filter(function (c) { return o.inTesta.indexOf(c.id) < 0; }));
    }
    s.mazzo = m;
    chiudiSeFinito(s);
    return s;
  }

  // dopo ogni azione: quarta carta di un valore = sconfitta (vale subito, anche per la carta scartata
  // dalla cima del mazzo); altrimenti mazzo finito e nessun cliente da decidere = vittoria.
  function chiudiSeFinito(s) {
    if (s.fine) return;
    var q = quartoValore(s);
    if (q) { s.fine = { esito: 'sconfitta', motivo: 'quattro', valore: q, punti: carteInCoda(s) }; s.mano = null; s.posto = null; return; }
    if (s.mazzo.length === 0 && !s.mano) s.fine = { esito: 'vittoria', motivo: 'mazzo', valore: null, punti: carteInCoda(s) };
  }

  // pesca la carta di cima e la prova nel posto scelto; riempie ultimo
  function provaCarta(s, u) {
    var c = s.mazzo.shift();
    u.pescata = c;
    var coda = s.code[s.posto.coda];
    if (entra(coda, s.posto.pos, c)) {
      coda.splice(s.posto.pos, 0, c);
      u.entrata = true; s.mano = null; s.posto = null;
    } else {
      u.entrata = false; s.mano = c;
    }
  }

  function apply(stato, mossa) {
    function no(testo) { var n = copia(stato); n.rifiuto = testo; return n; }
    if (stato.fine) return no('La partita è finita.');
    if (!mossa) return no('Mossa non valida.');
    var s, u;

    if (mossa.t === 'pesca') {
      if (stato.mano) return no('C\'è un cliente che non sta: prima decidi Resta o Caccialo.');
      if (typeof mossa.coda !== 'number' || mossa.coda < 0 || mossa.coda >= NUM_CODE || mossa.coda % 1) return no('Scegli prima una coda.');
      var cd = stato.code[mossa.coda];
      if (typeof mossa.pos !== 'number' || mossa.pos < 0 || mossa.pos > cd.length || mossa.pos % 1) return no('Scegli prima il posto nella coda.');
      if (!stato.mazzo.length) return no('Il mazzo è finito.');
      s = copia(stato); s.rifiuto = null;
      s.posto = { coda: mossa.coda, pos: mossa.pos };
      u = { azione: 'pesca', coda: mossa.coda, pos: mossa.pos, scartate: [], pescata: null, entrata: false, quarto: null };
      provaCarta(s, u);
      s.ultimo = u;
      chiudiSeFinito(s);
      u.quarto = s.fine && s.fine.motivo === 'quattro' ? s.fine.valore : null;
      return s;
    }

    if (mossa.t === 'resta' || mossa.t === 'caccia') {
      if (!stato.mano) return no('Non c\'è nessun cliente da decidere.');
      s = copia(stato); s.rifiuto = null;
      u = { azione: mossa.t, coda: s.posto.coda, pos: s.posto.pos, scartate: [], pescata: mossa.t === 'resta' ? s.mano : null, entrata: false, quarto: null };
      if (mossa.t === 'resta') {
        var cc = s.code[s.posto.coda];
        u.scartate = cc.slice();
        s.scarti = s.scarti.concat(cc);
        s.code[s.posto.coda] = [s.mano];
        u.entrata = true;            // la carta comincia una coda nuova
        s.mano = null; s.posto = null;
      } else {
        u.scartate.push(s.mano);
        if (s.mazzo.length) u.scartate.push(s.mazzo.shift());   // B1: col mazzo vuoto si scarta solo la carta in mano
        s.scarti = s.scarti.concat(u.scartate);
        s.mano = null;
        if (quartoValore(s)) { s.posto = null; }
        else if (s.mazzo.length) provaCarta(s, u);
        else s.posto = null;         // mazzo finito con la caccia: niente carta da provare
      }
      s.ultimo = u;
      chiudiSeFinito(s);
      u.quarto = s.fine && s.fine.motivo === 'quattro' ? s.fine.valore : null;
      return s;
    }
    return no('Mossa non valida.');
  }

  // ---------- cosa si può guardare ----------
  // Il mazzo si guarda come al tavolo: mostra QUALI carte restano, in ordine di valore, mai l'ordine in cui usciranno.
  function carteNelMazzo(s) { return ordina(s.mazzo); }
  function tutteLeCarte(s) {
    var t = [];
    s.code.forEach(function (c) { c.forEach(function (x) { t.push(x.id); }); });
    s.mazzo.concat(s.scarti).forEach(function (x) { t.push(x.id); });
    if (s.mano) t.push(s.mano.id);
    return t.sort();
  }

  return {
    SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO, NOME_VALORE: NOME_VALORE, NUM_CODE: NUM_CODE,
    nuova: nuova, apply: apply, entra: entra, codaOrdinata: codaOrdinata, contaScarti: contaScarti,
    fileScarti: fileScarti, carteInCoda: carteInCoda, carteNelMazzo: carteNelMazzo, tutteLeCarte: tutteLeCarte,
    mazzoCompleto: mazzoCompleto, daId: daId, nomeCarta: nomeCarta, sigla: sigla, ordina: ordina, eRossa: eRossa
  };
}));
