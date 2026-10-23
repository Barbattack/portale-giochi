/*
 * The Sandwich Guy — la demo: una mano preparata, sempre uguale (le carte in cima al mazzo in ordine fisso).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `PaninoDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.PaninoDemo = factory(root.Panino);
}(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';
  // mano: A♦ 3♦ 5♦ 8♥ 8♠ 8♣ 10♥ Q♠ | poi il mazzo: 2♥ 9♥ R♠ 4♠ | A♣ 6♥ | 4♦ F♣ 7♦
  var IN_TESTA = 'Q1 Q3 Q5 C8 P8 F8 C10 P12 C2 C9 P13 P4 F1 C6 Q4 F11 Q7'.split(' ');

  function nuova() { return P.nuova('demo', { inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'Hai 8 carte in mano. A ogni turno scarti tre carte che fanno un panino: una delle tre sta esattamente in mezzo alle altre due, con lo stesso salto. I valori girano in tondo: Donna, Re, Asso, 2, 3. Se non riesci a fare un panino, perdi.' },
    { testo: 'Asso, 3 e 5 di quadri: il salto è sempre 2, e sono tutte dello stesso seme. Panino di qualità: peschi 4 carte. La mano però arriva al massimo a 8: la quarta non si pesca: resta in cima al mazzo.',
      mossa: { t: 'scarta', carte: ['Q1', 'Q3', 'Q5'] } },
    { testo: 'Prova questa mossa: 8 di cuori, 10 di cuori e 8 di fiori.',
      mossa: { t: 'scarta', carte: ['C8', 'C10', 'F8'] }, rifiuto: true, motivo: 'nessuna delle tre sta esattamente in mezzo' },
    { testo: 'Tre 8: il salto è 0, e vale. Ma i colori sono misti (rosso e nero): panino scarso, peschi solo 2 carte.',
      mossa: { t: 'scarta', carte: ['C8', 'P8', 'F8'] } },
    { testo: 'Donna, Re e Asso: il salto è 1, e il Re passa all\'Asso. Sono tutte nere ma di semi diversi, cioè stesso colore: peschi 3 carte.',
      mossa: { t: 'scarta', carte: ['P12', 'P13', 'F1'] } },
    { testo: 'Si va avanti così. Se peschi l\'ultima carta del mazzo vinci, ma poi continui a fare panini finché puoi: vale il punteggio più basso, cioè meno carte in mano. Se non puoi più fare un panino prima di finire il mazzo, perdi. Gli scarti e il mazzo si possono guardare quando vuoi.' }
  ];

  return { nuova: nuova, passi: passi, IN_TESTA: IN_TESTA };
}));
