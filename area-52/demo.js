/*
 * Area 52 — la demo: due scene preparate dagli esempi del libro (pp. 16-18), sempre uguali.
 * Scena 1 (prima ondata): i tre alieni 5♥, 8♦, K♥ contro i difensori J♠ 4♣ 3♣ 7♠ 6♣ 3♠.
 * Scena 2 (seconda ondata): 8♦, 9♠, Q♥ contro 7♠ 2♣ A♣ J♦ Q♣ 8♥.
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa. Ogni rifiuto
 * ha `motivo`: un pezzo del testo che il motore deve dare (la prova controlla che arrivi da lì).
 * Un passo con `scena` cambia il tavolo quando ci si arriva.
 * Nel browser si chiama `AreaDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.AreaDemo = factory(root.Area);
}(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';
  var TUTTI = A.mazzoCompleto().map(function (c) { return c.id; });
  function resto(usate) { return TUTTI.filter(function (id) { return usate.indexOf(id) < 0; }); }
  function rosse(ids) { return ids.filter(function (id) { return id[0] === 'C' || id[0] === 'Q'; }); }
  function nere(ids) { return ids.filter(function (id) { return id[0] === 'F' || id[0] === 'P'; }); }

  function scena1() {
    var dif = ['P11', 'F4', 'F3', 'P7', 'F6', 'P3'], arr = ['C5', 'Q8', 'C13'];
    var mazzoDif = ['F9', 'P10', 'F2', 'P5'], alieni = ['Q9', 'C2', 'Q6', 'C10'];
    var avanzo = resto(dif.concat(arr, mazzoDif, alieni));
    return A.costruisci({ ondata: 1, seme: 'demo-1', difensori: dif, inArrivo: arr,
      mazzoDif: mazzoDif.concat(nere(avanzo)), alieni: alieni.concat(rosse(avanzo)) });
  }
  function scena2() {
    var dif = ['P7', 'F2', 'F1', 'Q11', 'F12', 'C8'], arr = ['Q8', 'P9', 'C12'];
    var mazzoDif = ['P4', 'P10', 'F5'], alieni = ['C4', 'F8', 'Q3'];
    var scarti = ['P2', 'P3', 'C2', 'Q2', 'F3'];
    var avanzo = resto(dif.concat(arr, mazzoDif, alieni, scarti));
    return A.costruisci({ ondata: 2, seme: 'demo-2', difensori: dif, inArrivo: arr,
      mazzoDif: mazzoDif.concat(nere(avanzo)), alieni: alieni.concat(rosse(avanzo)), scarti: scarti });
  }
  function nuova() { return scena1(); }
  function scena(nome) { return nome === 'ondata2' ? scena2() : scena1(); }

  var passi = [
    { testo: 'Comandi una squadra di difensori, le carte nere sul tavolo, contro gli alieni, le carte rosse. A ogni turno si scoprono tre alieni e li affronti uno alla volta, nell\'ordine: il primo, a sinistra, è quello che ti attacca ora. Per ognuno scegli fra tre mosse: attacco doppio, attacco singolo o sacrificio. Dopo ogni mossa il tavolo torna a sei difensori, finché c\'è il mazzo dei difensori. Se resti senza difensori, perdi.' },
    { testo: 'Attacco singolo: un difensore di valore maggiore e di colore opposto a quello dell\'alieno. Il difensore va negli scarti e l\'alieno prende il suo posto, come difensore. Contro il 5 di cuori usa il 7 di picche.',
      mossa: { t: 'singolo', carte: ['P7'] } },
    { testo: 'Prova questa mossa: attacco doppio contro l\'8 di quadri, con il 4 di fiori e il 3 di fiori.',
      mossa: { t: 'doppio', carte: ['F4', 'F3'] }, rifiuto: true, motivo: 'serve esattamente 8' },
    { testo: 'Attacco doppio: due difensori che sommati fanno esattamente il valore dell\'alieno. Il 5 di cuori, che hai appena preso, più il 3 di fiori fanno 8. L\'alieno va negli scarti e i due difensori restano dove sono.',
      mossa: { t: 'doppio', carte: ['C5', 'F3'] } },
    { testo: 'Prova questa mossa: attacco singolo contro il Re di cuori, con il Fante di picche.',
      mossa: { t: 'singolo', carte: ['P11'] }, rifiuto: true, motivo: 'di più dell\'alieno' },
    { testo: 'Sacrificio: scarti un difensore e l\'alieno attuale va in fondo al mazzo degli alieni, coperto. Contro il Re non c\'è un attacco buono: sacrifica il 3 di picche. Il tavolo torna a sei con una carta nuova.',
      mossa: { t: 'sacrificio', carte: ['P3'] } },
    { testo: 'Finiti i tre alieni se ne scoprono altri tre, e così via. Quando il mazzo degli alieni finisce, si rimescolano tutti gli scarti, difensori compresi: è la seconda ondata, con alieni rossi e neri. In quella ondata, dopo un attacco doppio scarti anche ogni difensore usato che ha lo stesso colore dell\'alieno. Ecco una scena della seconda ondata.' },
    { scena: 'ondata2',
      testo: 'Seconda ondata. Contro l\'8 di quadri, rosso, attacco doppio con il 7 di picche e l\'Asso di fiori: fanno 8. I due difensori sono neri, l\'alieno è rosso, quindi non se ne perde nessuno.',
      mossa: { t: 'doppio', carte: ['P7', 'F1'] } },
    { testo: 'Prova questa mossa: attacco singolo contro il 9 di picche, con la Donna di fiori.',
      mossa: { t: 'singolo', carte: ['F12'] }, rifiuto: true, motivo: 'colore opposto' },
    { testo: 'Il 9 di picche è nero. Attacco doppio con l\'8 di cuori e l\'Asso di fiori: fanno 9. Ma l\'Asso di fiori ha lo stesso colore dell\'alieno, nero: dopo l\'attacco lo perdi.',
      mossa: { t: 'doppio', carte: ['C8', 'F1'] } },
    { testo: 'Ora ti aspetta la Donna di cuori, e hai perso un difensore che ti avrebbe aiutato: il libro avverte che in questa ondata conviene scegliere con cura. Perdi se resti senza difensori: il punteggio è meno gli alieni rimasti, scoperti compresi, e 50 in meno se eri ancora alla prima ondata. Vinci se sconfiggi tutta la seconda ondata: il punteggio sono le carte del mazzo dei difensori più i difensori sul tavolo.' }
  ];

  return { nuova: nuova, scena: scena, passi: passi };
}));
