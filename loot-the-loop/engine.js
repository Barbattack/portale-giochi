/*
 * Loot the Loop — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una
 * lista di mosse la partita è sempre la stessa. Gira in node e nel browser
 * (nel browser si chiama `Tempio`). Regole: owner inbox/isaludo-regole-2026-10-22.md, sez. 7.
 *
 * Il mazzo è il tempio: 52 carte + 1 jolly. La prima carta (indice 0) è dove ti trovi.
 *   Assi = gioielli, 2-10 = ninnoli, J Q K (11 12 13) = trappole, jolly = uscita.
 * Carta: { id, seme, valore, su }. Semi S H D C (picche cuori quadri fiori), il jolly ha seme 'J'
 * e valore 0. id = valore + seme ("7C", "13S"); il jolly è "JOK". `su` = scoperta.
 *
 * Mosse (le fa sempre il giocatore):
 *   { t:'guardati' }                  Guardati intorno
 *   { t:'esplora', pos:0|1 }          Esplora, contando il valore della prima o della seconda carta
 *   { t:'segna' }                     Segna una strada
 *   { t:'torna', id:'7C' }            Torna su una strada (un appunto, per id)
 *   { t:'arrenditi' }                 Mi arrendo (L1)
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è
 * identico al precedente tranne `rifiuto` (il perché, corto, in italiano). Se è accettata
 * `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, mazzo:[carte], appunti:[carte], punti:[carte], turno,
 *          fine:null|{esito:'vinto'|'perso', motivo:'uscita'|'trappola'|'bloccato'|'arresa', punti:n},
 *          rifiuto, ultimo }
 *
 * L1: la partita è persa "per blocco" solo quando nessuna azione è possibile; per tutte le altre
 *     strade che finiscono in trappola c'è «Mi arrendo», che decide il giocatore.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tempio = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_APPUNTI = 3;
  var SEMI = ['S', 'H', 'D', 'C'];
  var NOME_SEME = { S: 'picche', H: 'cuori', D: 'quadri', C: 'fiori' };
  var SIMBOLO = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var LETTERA = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

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
  function carta(seme, valore, su) { return { id: seme === 'J' ? 'JOK' : valore + seme, seme: seme, valore: valore, su: !!su }; }
  /* "7C" scoperta, "-7C" coperta, "JOK" jolly scoperto, "-JOK" coperto */
  function daId(tok) {
    var su = true;
    if (tok[0] === '-') { su = false; tok = tok.slice(1); }
    if (tok === 'JOK') return carta('J', 0, su);
    return carta(tok.slice(-1), +tok.slice(0, -1), su);
  }
  function mazzoCompleto() {
    var m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= 13; v++) m.push(carta(s, v, false)); });
    m.push(carta('J', 0, false));
    return m;
  }
  function scopri(c) { return c.su ? c : { id: c.id, seme: c.seme, valore: c.valore, su: true }; }
  function copri(c) { return { id: c.id, seme: c.seme, valore: c.valore, su: false }; }
  function eJolly(c) { return c.seme === 'J'; }
  function eAsso(c) { return c.seme !== 'J' && c.valore === 1; }
  function eNinnolo(c) { return c.seme !== 'J' && c.valore >= 2 && c.valore <= 10; }
  function eTrappola(c) { return c.seme !== 'J' && c.valore >= 11; }
  function tipo(c) { return eJolly(c) ? 'uscita' : eAsso(c) ? 'gioiello' : eNinnolo(c) ? 'ninnolo' : 'trappola'; }
  /* un numero scoperto: l'unica carta con cui si esplora e che si può segnare */
  function numeroScoperto(c) { return !!c && c.su && eNinnolo(c); }
  function lettera(c) { return eJolly(c) ? '★' : (LETTERA[c.valore] || String(c.valore)); }
  function nomeBreve(c) { return eJolly(c) ? 'Jolly' : lettera(c) + SIMBOLO[c.seme]; }
  function nome(c) {
    if (eJolly(c)) return 'il Jolly';
    var v = c.valore, di = ' di ' + NOME_SEME[c.seme];
    if (v === 1) return "l'Asso" + di;
    if (v === 12) return 'la Donna' + di;
    if (v === 8) return "l'8" + di;
    return 'il ' + (NOME_VALORE[v] || v) + di;
  }
  /* "su" + l'articolo giusto: sul 7, sulla Donna, sull'Asso, sull'8 */
  function su(c) { return nome(c).replace(/^il /, 'sul ').replace(/^la /, 'sulla ').replace(/^l'/, "sull'"); }
  function assiNeiPunti(s) { return s.punti.filter(eAsso).length; }

  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['mazzo', 'appunti', 'punti'].forEach(function (k) { n[k] = s[k].slice(); });
    return n;
  }
  function rifiuta(s, perche) { var n = copia(s); n.rifiuto = perche; return n; }

  // ---------- partita ----------
  /* opzioni: { inTesta: ['4D','-9H',…] } mette quelle carte in cima, nell'ordine; le altre seguono
     in ordine fisso, coperte (serve alla demo e alle prove). Senza `inTesta` il mazzo è mescolato. */
  function nuova(seme, opz) {
    opz = opz || {};
    var s = { seme: String(seme), rng: 0, mazzo: [], appunti: [], punti: [], turno: 0,
      fine: null, rifiuto: null, ultimo: null };
    s.rng = xmur3(s.seme) | 0;
    var tutte = mazzoCompleto();
    if (opz.inTesta) {
      var testa = opz.inTesta.map(daId), usate = {};
      testa.forEach(function (c) { usate[c.id] = true; });
      s.mazzo = testa.concat(tutte.filter(function (c) { return !usate[c.id]; }));
    } else {
      s.mazzo = mescola(tutte, s);
    }
    return s;
  }

  // ---------- che cosa si può fare ----------
  /* dove ti porta Esplora scegliendo la carta in posizione `pos` (0 o 1): l'indice della carta
     su cui atterri (0 = giro completo; con più N che carte si gira: N modulo le carte), oppure null se quella scelta non si può fare. */
  function destinazione(s, pos) {
    var c = s.mazzo[pos];
    if ((pos !== 0 && pos !== 1) || !numeroScoperto(c)) return null;
    return c.valore % s.mazzo.length;
  }
  /* le mosse possibili ora (senza «Mi arrendo»: quella c'è sempre) */
  function mosse(s) {
    var m = [];
    if (s.fine) return m;
    if (s.mazzo.length && !s.mazzo[0].su) m.push({ t: 'guardati' });
    [0, 1].forEach(function (p) { if (destinazione(s, p) !== null) m.push({ t: 'esplora', pos: p }); });
    if (numeroScoperto(s.mazzo[0]) && s.appunti.length < MAX_APPUNTI) m.push({ t: 'segna' });
    s.appunti.forEach(function (c) { m.push({ t: 'torna', id: c.id }); });
    return m;
  }
  function ciSonoMosse(s) { return mosse(s).length > 0; }

  function chiudi(n, esito, motivo) { n.fine = { esito: esito, motivo: motivo, punti: n.punti.length }; }
  /* L1: persa per blocco solo se nessuna azione è possibile */
  function controllaBlocco(n) { if (!n.fine && !ciSonoMosse(n)) chiudi(n, 'perso', 'bloccato'); }

  function apply(s, m) {
    if (s.fine) return rifiuta(s, 'La partita è finita.');
    if (!m || !m.t) return rifiuta(s, 'Scegli un\'azione.');
    var n = copia(s), top = s.mazzo[0];
    n.rifiuto = null;

    if (m.t === 'guardati') {
      if (!top) return rifiuta(s, 'Il tempio è vuoto.');
      if (top.su) return rifiuta(s, 'La prima carta è già scoperta.');
      n.mazzo[0] = scopri(top);
      var scoperte = [top.id];
      if (n.mazzo[1] && !n.mazzo[1].su) { n.mazzo[1] = scopri(n.mazzo[1]); scoperte.push(n.mazzo[1].id); }
      n.ultimo = { t: 'guardati', scoperte: scoperte };

    } else if (m.t === 'esplora') {
      if (m.pos !== 0 && m.pos !== 1) return rifiuta(s, 'Scegli una delle prime due carte.');
      var c = s.mazzo[m.pos];
      if (!c) return rifiuta(s, 'Non c\'è una seconda carta.');
      if (!c.su) return rifiuta(s, 'Quella carta è coperta: non sai quanto vale.');
      if (!eNinnolo(c)) return rifiuta(s, 'Serve un numero da 2 a 10: ' + (eAsso(c) ? 'l\'Asso è un gioiello.' : eJolly(c) ? 'il Jolly è l\'uscita.' : 'questa è una trappola.'));
      var N = c.valore;
      var K = N % s.mazzo.length;      // il tempio è un anello: contando oltre l'ultima carta si gira
      n.mazzo = s.mazzo.slice(K).concat(s.mazzo.slice(0, K));
      var arrivo = n.mazzo[0], effetto;
      if (!arrivo.su) effetto = 'coperta';
      else if (eTrappola(arrivo)) { effetto = 'trappola'; chiudi(n, 'perso', 'trappola'); }
      else if (eJolly(arrivo)) {
        if (assiNeiPunti(n) === 4) { effetto = 'uscita'; chiudi(n, 'vinto', 'uscita'); }
        else effetto = 'uscita-chiusa';
      } else { effetto = 'presa'; n.punti.push(arrivo); n.mazzo.shift(); }
      n.ultimo = { t: 'esplora', pos: m.pos, n: N, arrivo: arrivo, effetto: effetto };
      if (effetto === 'uscita') n.fine.punti = n.punti.length;

    } else if (m.t === 'segna') {
      if (!top) return rifiuta(s, 'Il tempio è vuoto.');
      if (!numeroScoperto(top)) return rifiuta(s, 'La prima carta deve essere un numero scoperto.');
      if (s.appunti.length >= MAX_APPUNTI) return rifiuta(s, 'Hai già ' + MAX_APPUNTI + ' appunti: non c\'è posto.');
      n.appunti.push(n.mazzo.shift());
      n.ultimo = { t: 'segna', carta: top };

    } else if (m.t === 'torna') {
      if (!s.appunti.length) return rifiuta(s, 'Non hai nessun appunto.');
      var i = -1;
      s.appunti.forEach(function (a, k) { if (a.id === m.id) i = k; });
      if (i < 0) return rifiuta(s, 'Scegli uno dei tuoi appunti.');
      var nota = n.appunti.splice(i, 1)[0];
      n.mazzo.unshift(scopri(nota));
      n.ultimo = { t: 'torna', carta: nota };

    } else if (m.t === 'arrenditi') {
      chiudi(n, 'perso', 'arresa');
      n.ultimo = { t: 'arrenditi' };

    } else {
      return rifiuta(s, 'Azione sconosciuta.');
    }
    n.turno = s.turno + 1;
    controllaBlocco(n);
    return n;
  }

  return {
    MAX_APPUNTI: MAX_APPUNTI, SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO,
    nuova: nuova, apply: apply, mosse: mosse, ciSonoMosse: ciSonoMosse, destinazione: destinazione,
    daId: daId, carta: carta, mazzoCompleto: mazzoCompleto, copri: copri,
    tipo: tipo, eJolly: eJolly, eAsso: eAsso, eNinnolo: eNinnolo, eTrappola: eTrappola,
    numeroScoperto: numeroScoperto, lettera: lettera, nome: nome, su: su, nomeBreve: nomeBreve,
    assiNeiPunti: assiNeiPunti
  };
}));
