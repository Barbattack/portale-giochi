/*
 * Foursquare — il motore delle regole (di Wil Su, collezione Isaludo).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 6; libro, pagine 29-31.
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista
 * di mosse la partita è sempre la stessa. Gira in node e nel browser (si chiama `Foursquare`).
 *
 * Carte: { id, seme, valore }. Semi H cuori, D quadri, C fiori, S picche. Asso = 1.
 * Il mazzo sono le 40 carte numerate (Asso-10), niente figure. id = seme + valore ("D6").
 *
 * La griglia: un insieme di pile, ognuna in una casella (x, y) di un piano senza bordi
 * (x e y possono anche essere negativi: la griglia "si sposta" crescendo; chi mostra deve
 * solo normalizzare). Una pila = { carte:[dal fondo alla cima], su: true se la cima è scoperta }.
 * Le carte sotto la cima non contano mai: non si girano e non si confrontano.
 *
 * Mossa (una sola, la fa sempre il giocatore):
 *   { t:'posa', x, y }   // la prima carta del mazzo, scoperta, in (x, y):
 *                        // sopra la pila che c'è, oppure pila nuova accanto a una che c'è
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è
 * identico al precedente tranne `rifiuto` (il perché, corto, in italiano). Se è accettata
 * `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, griglia:{"x,y": pila}, mazzo:[carte] (la prima è quella da posare),
 *          fine:null | {vinto, rimaste, motivo}, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Foursquare = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LATO = 4;          // la griglia non supera 4 in larghezza e 4 in altezza
  var ALTEZZA_PILA = 4;  // una pila non ha più di 4 carte
  var MAX_COPERTE = 4;   // più di 4 pile con la cima coperta: si perde
  var SEMI = ['H', 'D', 'C', 'S'];
  var SIMBOLO = { H: '♥︎', D: '♦︎', C: '♣︎', S: '♠︎' };
  var NOME_SEME = { H: 'cuori', D: 'quadri', C: 'fiori', S: 'picche' };

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

  // ---------- caselle ----------
  function chiave(x, y) { return x + ',' + y; }
  function daChiave(k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    n.griglia = {};
    Object.keys(s.griglia).forEach(function (k) { n.griglia[k] = s.griglia[k]; });  // le pile non si modificano: si sostituiscono
    n.mazzo = s.mazzo.slice();
    return n;
  }
  function caselle(s) { return Object.keys(s.griglia).map(daChiave); }
  // il rettangolo che contiene tutte le pile: { x0, x1, y0, y1, larghezza, altezza } (null se vuota)
  function riquadro(s, extra) {
    var c = caselle(s);
    if (extra) c.push(extra);
    if (!c.length) return null;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    c.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    return { x0: x0, x1: x1, y0: y0, y1: y1, larghezza: x1 - x0 + 1, altezza: y1 - y0 + 1 };
  }
  function accanto(s, x, y) {
    return !!(s.griglia[chiave(x - 1, y)] || s.griglia[chiave(x + 1, y)] ||
              s.griglia[chiave(x, y - 1)] || s.griglia[chiave(x, y + 1)]);
  }
  function coperte(s) {
    return Object.keys(s.griglia).filter(function (k) { return !s.griglia[k].su; }).length;
  }
  function scoperte(s) {
    return Object.keys(s.griglia).filter(function (k) { return s.griglia[k].su; }).length;
  }
  function cima(p) { return p.carte[p.carte.length - 1]; }

  // ---------- girare ----------
  /*
   * Dopo la posa in (x, y): la carta posata è la sola più alta, o la sola più bassa, fra le cime
   * scoperte della riga (le coperte non contano), oppure è l'unica scoperta? Allora si gira la cima
   * di tutte le altre pile della riga. Poi lo stesso con la colonna. Alla pari non basta: serve
   * essere più alta (o più bassa) di TUTTE le altre scoperte.
   * Riga e colonna hanno in comune solo la pila posata, quindi l'ordine fra le due non cambia nulla.
   */
  function giraLinea(g, x, y, valore, orizzontale, girate) {
    var altre = Object.keys(g).map(daChiave).filter(function (p) {
      return !(p.x === x && p.y === y) && (orizzontale ? p.y === y : p.x === x);
    });
    if (!altre.length) return;
    var su = altre.filter(function (p) { return g[chiave(p.x, p.y)].su; })
      .map(function (p) { return cima(g[chiave(p.x, p.y)]).valore; });
    var gira = !su.length ||
      su.every(function (v) { return valore > v; }) ||
      su.every(function (v) { return valore < v; });
    if (!gira) return;
    altre.forEach(function (p) {
      var k = chiave(p.x, p.y), vecchia = g[k];
      g[k] = { carte: vecchia.carte, su: !vecchia.su };
      girate.push({ x: p.x, y: p.y, ora: vecchia.su ? 'coperta' : 'scoperta' });
    });
  }

  /*
   * Prova una posa su `s` senza fare controlli di fine partita. Restituisce { rifiuto } oppure
   * { stato } (il nuovo stato, senza `fine`). È qui che stanno tutte le regole della posa.
   */
  function prova(s, x, y) {
    if (!s.mazzo.length) return { rifiuto: 'Il mazzo è finito' };
    var k = chiave(x, y), pila = s.griglia[k], c = s.mazzo[0];
    var n = copia(s);
    n.mazzo.shift();
    var nuova;
    if (pila) {
      if (pila.carte.length >= ALTEZZA_PILA) return { rifiuto: 'La pila ha già ' + ALTEZZA_PILA + ' carte' };
      nuova = false;
      n.griglia[k] = { carte: pila.carte.concat([c]), su: true };
    } else {
      if (!accanto(s, x, y)) return { rifiuto: 'Una pila nuova va accanto a una pila che c’è' };
      var r = riquadro(s, { x: x, y: y });
      if (r.larghezza > LATO) return { rifiuto: 'La griglia sarebbe larga più di ' + LATO + ' colonne' };
      if (r.altezza > LATO) return { rifiuto: 'La griglia sarebbe alta più di ' + LATO + ' righe' };
      nuova = true;
      n.griglia[k] = { carte: [c], su: true };
    }
    var girate = [];
    giraLinea(n.griglia, x, y, c.valore, true, girate);     // la riga
    giraLinea(n.griglia, x, y, c.valore, false, girate);    // poi la colonna
    var cop = coperte(n);
    if (cop > MAX_COPERTE) return { rifiuto: 'Resterebbero ' + cop + ' pile coperte: il massimo è ' + MAX_COPERTE };
    n.ultimo = { azione: 'posa', carta: c, x: x, y: y, nuova: nuova, girate: girate, coperte: cop };
    return { stato: n };
  }

  // le caselle dove si può posare la prima carta del mazzo (per la fine partita e per le prove)
  function candidate(s) {
    var viste = {}, out = [];
    function aggiungi(x, y) { var k = chiave(x, y); if (!viste[k]) { viste[k] = true; out.push({ x: x, y: y }); } }
    caselle(s).forEach(function (p) {
      aggiungi(p.x, p.y); aggiungi(p.x - 1, p.y); aggiungi(p.x + 1, p.y); aggiungi(p.x, p.y - 1); aggiungi(p.x, p.y + 1);
    });
    return out;
  }
  function posePossibili(s) {
    if (s.fine) return [];
    return candidate(s).filter(function (p) { return !prova(s, p.x, p.y).rifiuto; });
  }
  // le caselle da far vedere al giocatore come "posti": quelle dove, per forma, una pila nuova
  // può stare (accanto a una pila e dentro il limite 4x4). Non dice nulla sulle coperte.
  function postiVisibili(s) {
    return candidate(s).filter(function (p) {
      var k = chiave(p.x, p.y);
      if (s.griglia[k]) return false;
      if (!accanto(s, p.x, p.y)) return false;
      var r = riquadro(s, p);
      return r.larghezza <= LATO && r.altezza <= LATO;
    });
  }

  // ---------- partita ----------
  /*
   * opzioni (solo prove e demo): { tavolo:[{x,y,carte:[id dal fondo], su}], inTesta:[id] }
   *   tavolo: pile già sul tavolo (se manca, la prima carta del mazzo va in (0,0));
   *   inTesta: carte in cima al mazzo, in ordine.
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var s = {
      seme: String(seme), rng: xmur3(String(seme)) | 0,
      griglia: {}, mazzo: [], fine: null, rifiuto: null, ultimo: null
    };
    var usate = {}, testa = (opzioni.inTesta || []).map(daId);
    testa.forEach(function (c) { usate[c.id] = true; });
    if (opzioni.tavolo) {
      opzioni.tavolo.forEach(function (p) {
        p.carte.forEach(function (id) { usate[id] = true; });
        s.griglia[chiave(p.x, p.y)] = { carte: p.carte.map(daId), su: p.su !== false };
      });
    }
    var resto = mescola(mazzoCompleto().filter(function (c) { return !usate[c.id]; }), s);
    s.mazzo = testa.concat(resto);
    if (!opzioni.tavolo) s.griglia[chiave(0, 0)] = { carte: [s.mazzo.shift()], su: true };
    s.ultimo = { azione: 'inizio' };
    return s;
  }

  function apply(stato, mossa) {
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }
    if (!mossa || mossa.t !== 'posa') return no('Mossa non valida');
    if (stato.fine) return no('La partita è finita');
    var x = mossa.x, y = mossa.y;
    if (typeof x !== 'number' || typeof y !== 'number' || x !== Math.floor(x) || y !== Math.floor(y) || !isFinite(x) || !isFinite(y)) {
      return no('Scegli prima dove');
    }
    var r = prova(stato, x, y);
    if (r.rifiuto) return no(r.rifiuto);
    var s = r.stato;
    s.rifiuto = null;
    // fine partita
    var box = riquadro(s);
    if (Object.keys(s.griglia).length === LATO * LATO && coperte(s) === 0 && box.larghezza === LATO && box.altezza === LATO) {
      s.fine = { vinto: true, rimaste: s.mazzo.length, motivo: 'griglia' };
    } else if (!s.mazzo.length) {
      s.fine = { vinto: false, rimaste: 0, motivo: 'mazzo' };
    } else if (!posePossibili(s).length) {
      s.fine = { vinto: false, rimaste: s.mazzo.length, motivo: 'nessuna posa' };
    }
    return s;
  }

  return {
    nuova: nuova, apply: apply, prova: prova, posePossibili: posePossibili, postiVisibili: postiVisibili,
    riquadro: riquadro, coperte: coperte, scoperte: scoperte, cima: cima, chiave: chiave, daChiave: daChiave,
    carta: carta, daId: daId, mazzoCompleto: mazzoCompleto,
    etichetta: etichetta, nomeValore: nomeValore, nomeCarta: nomeCarta, sigla: sigla,
    LATO: LATO, ALTEZZA_PILA: ALTEZZA_PILA, MAX_COPERTE: MAX_COPERTE,
    SEMI: SEMI, SIMBOLO: SIMBOLO, NOME_SEME: NOME_SEME
  };
}));
