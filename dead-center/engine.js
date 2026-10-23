/*
 * La baita — il motore delle regole (gioco di Wil Su, collezione Isaludo).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 4; libro, pagine 19-23.
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista
 * di mosse la partita è sempre la stessa. Gira in node e nel browser (si chiama `Baita`).
 *
 * Carte: { id, seme, valore }. Semi H cuori, D quadri, C fiori, S picche. Asso 1, Fante 11,
 * Donna 12, Re 13. id = seme + valore ("S12" = Donna di picche). Il jolly è { id:'J1', seme:'J', valore:0 }.
 *
 * La baita: 9 pile in griglia 3x3, indici 0..8 = riga * 3 + colonna; ogni pila è un array e la
 * carta in cima è l'ultima. Gli zombie (le 12 figure) stanno sui 12 posti intorno:
 * T0..T2 in alto (uno per colonna), R0..R2 a destra (uno per riga), B0..B2 in basso, L0..L2 a sinistra.
 *
 * Il turno ha tre passi, e `fase` dice quale tocca:
 *   'scopri'  { t:'scopri', dove:'T1' }  gira uno zombie coperto (finché ce ne sono); poi si pesca da sé
 *   'gioca'   { t:'gioca',  dove:4 }     la carta pescata va su una pila della baita
 *   'abbatti' { t:'abbatti', dove:'T1' } oppure { t:'passa' }   facoltativo
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è
 * identico al precedente tranne `rifiuto` (il perché, corto, in italiano). Se è accettata
 * `rifiuto` è null e `ultimo` descrive cosa è successo.
 *
 * Stato: { seme, rng, jolly, baita:[9 pile], zombie:{posto: carta|null} (i coperti sono NASCOSTI
 * al giocatore: la app non li mostra mai), coperto:{posto: bool}, uccisi:[carte], mazzo:[carte],
 * mano: carta|null (la pescata, da giocare), fase, pilaGiocata: cella|null,
 * fine: null|{vinto, punti, motivo}, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Baita = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMI = ['H', 'D', 'C', 'S'];
  var SIMBOLO = { H: '♥︎', D: '♦︎', C: '♣︎', S: '♠︎', J: '★' };
  var NOME_SEME = { H: 'cuori', D: 'quadri', C: 'fiori', S: 'picche' };
  var ZOMBIE = ['T0', 'T1', 'T2', 'R0', 'R1', 'R2', 'B0', 'B1', 'B2', 'L0', 'L1', 'L2'];
  var LIVELLI = {
    normale: { jolly: 2, nome: 'Normale' },
    difficile: { jolly: 1, nome: 'Difficile' },
    difficilissimo: { jolly: 0, nome: 'Difficilissimo' }
  };
  var SOGLIA = 10;

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
  function jolly(n) { return { id: 'J' + n, seme: 'J', valore: 0 }; }
  function daId(id) { return id[0] === 'J' ? jolly(+id.slice(1)) : carta(id[0], +id.slice(1)); }
  function eJolly(c) { return c.seme === 'J'; }
  function colore(c) { return c.seme === 'H' || c.seme === 'D' ? 'rosso' : 'nero'; }
  function etichetta(c) {
    if (eJolly(c)) return 'Jolly';
    var v = c.valore;
    return v === 1 ? 'A' : v === 11 ? 'F' : v === 12 ? 'D' : v === 13 ? 'R' : String(v);
  }
  function nomeValore(v) { return v === 1 ? 'Asso' : v === 11 ? 'Fante' : v === 12 ? 'Donna' : v === 13 ? 'Re' : String(v); }
  function nomeCarta(c) { return eJolly(c) ? 'Jolly' : nomeValore(c.valore) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return eJolly(c) ? 'Jolly' : etichetta(c) + SIMBOLO[c.seme]; }
  function figure() {
    var f = [];
    SEMI.forEach(function (s) { [11, 12, 13].forEach(function (v) { f.push(carta(s, v)); }); });
    return f;
  }
  function numeri() {                   // le 40 carte dall'Asso al 10
    var m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= 10; v++) m.push(carta(s, v)); });
    return m;
  }
  function tuttoIlMazzo(nJolly) {
    var m = numeri().concat(figure());
    for (var i = 1; i <= nJolly; i++) m.push(jolly(i));
    return m;
  }
  function cima(pila) { return pila[pila.length - 1]; }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    n.baita = s.baita.map(function (p) { return p.slice(); });
    n.zombie = {}; n.coperto = {};
    ZOMBIE.forEach(function (p) { n.zombie[p] = s.zombie[p]; n.coperto[p] = s.coperto[p]; });
    n.uccisi = s.uccisi.slice();
    n.mazzo = s.mazzo.slice();
    return n;
  }

  // ---------- nomi, per i messaggi ----------
  function nomePosto(id) {
    var n = +id[1] + 1;
    if (id[0] === 'T') return 'in alto sulla colonna ' + n;
    if (id[0] === 'B') return 'in basso sulla colonna ' + n;
    if (id[0] === 'L') return 'a sinistra della riga ' + n;
    return 'a destra della riga ' + n;
  }
  function nomeCella(i) { return 'riga ' + (Math.floor(i / 3) + 1) + ', colonna ' + (i % 3 + 1); }
  function eCella(x) { return typeof x === 'number' && x === Math.floor(x) && x >= 0 && x < 9; }
  function ePosto(x) { return typeof x === 'string' && ZOMBIE.indexOf(x) >= 0; }

  // ---------- la geometria ----------
  // gli zombie vicini alla pila: l'angolo ne ha due, il lato uno, il centro nessuno
  function vicini(cella) {
    var r = Math.floor(cella / 3), c = cella % 3, v = [];
    if (r === 0) v.push('T' + c);
    if (c === 2) v.push('R' + r);
    if (r === 2) v.push('B' + c);
    if (c === 0) v.push('L' + r);
    return v;
  }
  // le due pile d'appoggio: le altre due della linea che porta allo zombie (colonna per T/B, riga per L/R)
  function appoggio(cella, posto) {
    var r = Math.floor(cella / 3), c = cella % 3, ls = [], k;
    if (posto[0] === 'T' || posto[0] === 'B') { for (k = 0; k < 3; k++) if (k !== r) ls.push(k * 3 + c); }
    else { for (k = 0; k < 3; k++) if (k !== c) ls.push(r * 3 + k); }
    return ls;
  }

  // ---------- le regole di posa e di abbattimento ----------
  /*
   * Posa: la carta giocata va sulla cima `top` se
   *   il jolly è dall'una o dall'altra parte, oppure stesso valore,
   *   oppure stesso colore e la cima vale di più (si sale restando nel colore),
   *   oppure colore opposto e la cima vale di meno (si scende cambiando colore).
   * Restituisce null se va bene, altrimenti il perché (corto).
   */
  function perchePosa(giocata, top) {
    if (eJolly(giocata) || eJolly(top)) return null;
    if (giocata.valore === top.valore) return null;
    if (colore(giocata) === colore(top)) {
      if (top.valore > giocata.valore) return null;
      return 'stesso colore, la carta in cima deve valere di più';
    }
    if (top.valore < giocata.valore) return null;
    return 'colore opposto, la carta in cima deve valere di meno';
  }
  function posaValida(giocata, top) { return perchePosa(giocata, top) === null; }

  /*
   * Abbattimento: la forza sono le due carte d'appoggio (valore, il jolly vale 0). Devono fare
   * almeno 10; poi il Re vuole due carte del suo seme, la Donna del suo colore, il Fante niente.
   * Il jolly d'appoggio conta come tutti i semi e tutti i colori.
   * Restituisce null se riesce, altrimenti il perché.
   */
  function percheAbbatti(a, b, zombie) {
    var somma = a.valore + b.valore;
    if (somma < SOGLIA) return 'le due carte d’appoggio fanno ' + somma + ': ne servono almeno ' + SOGLIA;
    if (zombie.valore === 13) {
      if (!(eJolly(a) || a.seme === zombie.seme) || !(eJolly(b) || b.seme === zombie.seme)) {
        return 'per il Re le due carte d’appoggio devono essere tutte e due di ' + NOME_SEME[zombie.seme];
      }
    } else if (zombie.valore === 12) {
      var col = colore(zombie);
      if (!(eJolly(a) || colore(a) === col) || !(eJolly(b) || colore(b) === col)) {
        return 'per la Donna le due carte d’appoggio devono essere tutte e due ' + (col === 'rosso' ? 'rosse' : 'nere');
      }
    }
    return null;
  }

  // ---------- la partita ----------
  /*
   * nuova(seme, opzioni)
   *   opzioni.livello: 'normale' (2 jolly, predefinito) | 'difficile' (1) | 'difficilissimo' (0)
   *   opzioni.jolly:   il numero di jolly, se si vuole dirlo a mano (solo prove)
   *   Solo prove e demo: opzioni.baita (9 id, riga per riga), opzioni.zombie (12 id nell'ordine di ZOMBIE),
   *   opzioni.inTesta (id in cima al mazzo, in ordine).
   * Preparazione come nel libro: mazzo di 52 più i jolly; si separano le 12 figure; il resto si
   * mescola e se ne scoprono 9 (la baita); le figure si mescolano e vanno coperte sui 12 posti.
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var liv = LIVELLI[opzioni.livello || 'normale'];
    var nJ = opzioni.jolly != null ? opzioni.jolly : liv.jolly;
    var s = {
      seme: String(seme), rng: xmur3(String(seme)) | 0, jolly: nJ,
      baita: [], zombie: {}, coperto: {}, uccisi: [], mazzo: [], mano: null,
      fase: 'scopri', pilaGiocata: null, fine: null, rifiuto: null, ultimo: null
    };
    var i, fuori = {};
    var testa = (opzioni.inTesta || []).map(daId);
    testa.forEach(function (c) { fuori[c.id] = true; });
    var cabina = opzioni.baita ? opzioni.baita.map(daId) : null;
    if (cabina) cabina.forEach(function (c) { fuori[c.id] = true; });
    var resto = numeri(); for (i = 1; i <= nJ; i++) resto.push(jolly(i));
    resto = mescola(resto.filter(function (c) { return !fuori[c.id]; }), s);
    if (!cabina) cabina = resto.splice(0, 9);              // le prime 9 del mazzo mescolato sono la baita
    cabina.forEach(function (c) { s.baita.push([c]); });
    s.mazzo = testa.concat(resto);
    var fig = opzioni.zombie ? opzioni.zombie.map(daId) : mescola(figure(), s);
    ZOMBIE.forEach(function (p, k) { s.zombie[p] = fig[k]; s.coperto[p] = true; });
    s.ultimo = { azione: 'inizio' };
    return s;
  }

  function morti(s) { return s.uccisi.length; }
  function coperti(s) { return ZOMBIE.filter(function (p) { return s.zombie[p] && s.coperto[p]; }); }
  function posaPossibile(s) {           // c'è almeno una pila dove la carta in mano va bene
    return s.baita.some(function (p) { return posaValida(s.mano, cima(p)); });
  }

  // pesca la carta del turno; se non si può, la partita è persa
  function pesca(s) {
    if (!s.mazzo.length) {
      s.mano = null; s.fase = 'persa';
      s.fine = { vinto: false, punti: 0, motivo: 'mazzo' };
      return;
    }
    s.mano = s.mazzo.shift();
    s.fase = 'gioca';
    if (!posaPossibile(s)) {
      s.fase = 'persa';
      s.fine = { vinto: false, punti: 0, motivo: 'blocco' };
    }
  }
  // inizia il turno dopo: si scopre (se ci sono coperti) oppure si pesca subito
  function prossimoTurno(s) {
    s.pilaGiocata = null; s.mano = null;
    if (coperti(s).length) s.fase = 'scopri';
    else pesca(s);
  }

  function apply(stato, mossa) {
    var s = copia(stato);
    s.rifiuto = null;
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }

    if (!mossa || !mossa.t) return no('Mossa non valida');
    if (s.fine) return no('La partita è finita');
    if (mossa.t !== 'scopri' && mossa.t !== 'gioca' && mossa.t !== 'abbatti' && mossa.t !== 'passa') return no('Mossa non valida');
    var f = s.fase, dove = mossa.dove;

    if (mossa.t !== f && !(mossa.t === 'passa' && f === 'abbatti')) {
      if (f === 'scopri') return no('Prima devi scoprire uno zombie');
      if (f === 'gioca') return no('Ora devi giocare la carta pescata su una pila');
      return no('Ora puoi solo abbattere uno zombie, oppure non abbattere nessuno');
    }

    if (f === 'scopri') {
      if (dove === undefined || dove === null || dove === '') return no('Scegli prima uno zombie');
      if (!ePosto(dove)) return no('Scegli uno zombie coperto');
      if (!s.zombie[dove]) return no('Lì non c’è nessuno zombie');
      if (!s.coperto[dove]) return no('Quello zombie è già scoperto');
      s.coperto[dove] = false;
      var z = s.zombie[dove];
      pesca(s);
      s.ultimo = { azione: 'scopri', posto: dove, zombie: z, pescata: s.mano };
      return s;
    }

    if (f === 'gioca') {
      if (dove === undefined || dove === null || dove === '') return no('Scegli prima una pila');
      if (!eCella(dove)) return no('Scegli una pila della baita');
      var top = cima(s.baita[dove]), perche = perchePosa(s.mano, top);
      if (perche) return no('Non si può giocare ' + sigla(s.mano) + ' su ' + sigla(top) + ': ' + perche);
      var giocata = s.mano;
      s.baita[dove].push(giocata);
      s.mano = null; s.pilaGiocata = dove;
      s.ultimo = { azione: 'gioca', carta: giocata, cella: dove };
      if (vicini(dove).length) s.fase = 'abbatti';
      else { prossimoTurno(s); s.ultimo.senzaZombie = true; }     // il centro non ha zombie vicini
      return s;
    }

    // abbatti, oppure passa
    if (mossa.t === 'passa') {
      s.ultimo = { azione: 'passa', cella: s.pilaGiocata };
      prossimoTurno(s);
      return s;
    }
    if (dove === undefined || dove === null || dove === '') return no('Scegli prima uno zombie');
    if (!ePosto(dove)) return no('Scegli uno zombie');
    if (!s.zombie[dove]) return no('Lì non c’è nessuno zombie');
    if (vicini(s.pilaGiocata).indexOf(dove) < 0) return no('Quello zombie non è vicino alla pila dove hai giocato');
    if (s.coperto[dove]) return no('Quello zombie è ancora coperto');
    var ap = appoggio(s.pilaGiocata, dove).map(function (k) { return cima(s.baita[k]); });
    var z2 = s.zombie[dove], motivo = percheAbbatti(ap[0], ap[1], z2);
    if (motivo) return no(motivo.charAt(0).toUpperCase() + motivo.slice(1));
    s.zombie[dove] = null;
    s.uccisi.push(z2);
    s.ultimo = { azione: 'abbatti', posto: dove, zombie: z2, appoggio: ap, cella: s.pilaGiocata };
    if (morti(s) === 12) {
      s.fase = 'vinta'; s.pilaGiocata = null; s.mano = null;
      s.fine = { vinto: true, punti: s.mazzo.length, motivo: 'vittoria' };
      return s;
    }
    prossimoTurno(s);
    return s;
  }

  return {
    nuova: nuova, apply: apply, carta: carta, jolly: jolly, daId: daId, figure: figure, numeri: numeri,
    tuttoIlMazzo: tuttoIlMazzo, cima: cima, vicini: vicini, appoggio: appoggio,
    posaValida: posaValida, perchePosa: perchePosa, percheAbbatti: percheAbbatti,
    morti: morti, coperti: coperti, colore: colore, eJolly: eJolly,
    etichetta: etichetta, nomeValore: nomeValore, nomeCarta: nomeCarta, sigla: sigla,
    nomePosto: nomePosto, nomeCella: nomeCella,
    SEMI: SEMI, SIMBOLO: SIMBOLO, NOME_SEME: NOME_SEME, ZOMBIE: ZOMBIE, LIVELLI: LIVELLI, SOGLIA: SOGLIA
  };
}));
