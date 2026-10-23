/*
 * The First Boba Tea Shop in London — la demo: la partita di metà gioco del libro (pp. 25 e 27),
 * sempre uguale. Le carte in cima al mazzo hanno un ordine fisso. Nel browser si chiama `BobaDemo`.
 *
 * Ogni passo ha una frase e, se serve, una mossa che la fa il giocatore:
 *   { t:'pesca', coda, pos } | { t:'resta' } | { t:'caccia' } | { t:'guarda' } (tocca il mazzo, non cambia lo stato).
 * `rifiuto:true` vorrebbe dire che il motore deve rifiutarla, con `motivo` (un pezzo del testo che dà):
 * in questa demo non ce n'è, perché nell'interfaccia le mosse non legali non si possono nemmeno fare.
 * Le code sono dal fondo alla cima, come nel motore: Q1 del libro = coda 0.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.BobaDemo = factory(root.Boba);
}(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';
  // Dal libro (p. 25 e p. 27). Le carte nere/rosse di Q, K, J nel disegno non mostrano il seme:
  // si sono scelti semi coerenti col colore e con gli scarti (nessun valore ha più di 4 carte).
  var CODE = [
    'Q2 P4 F4 F9'.split(' '),                         // Q1: 9♣ 4♣ 4♠ 2♦ (dalla cima al fondo)
    'C1 P8 Q9 P12'.split(' '),                        // Q2: D♠ 9♦ 8♠ A♥
    'Q1 F2 P7 C9 F10 C12 Q12'.split(' '),             // Q3: D♦ D♥ 10♣ 9♥ 7♠ 2♣ A♦
    'Q6 P6 P9 C11 C13'.split(' ')                     // Q4: R♥ F♥ 9♠ 6♠ 6♦
  ];
  var SCARTI = ('P1 P3 C4 P5 F7 C8 P11 F13 ' + 'F1 Q4 F5 Q8 Q11 ' + 'F8').split(' ');
  var IN_TESTA = 'Q7 F11 Q5 F6 C5 F12'.split(' ');

  function nuova() { return B.nuova('demo', { code: CODE, scarti: SCARTI, inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'Questa è una partita a metà, quella del libro. Quattro file di clienti: in ogni coda i valori salgono dal fondo alla cima (il più alto in cima), e i pari vanno bene. L\'Asso vale 1. A ogni turno scegli la coda e il posto dove entrerà il prossimo cliente, confermi, e solo dopo peschi.' },
    { testo: 'Scegli il posto fra il 6 di picche e il 9 di picche della coda 4: lì ci stanno i valori da 6 a 9. Poi conferma e pesca.',
      mossa: { t: 'pesca', coda: 3, pos: 2 } },
    { testo: 'Ora un posto più rischioso: nella coda 2, fra l\'Asso di cuori e l\'8 di picche. Guarda gli scarti: ci sono già tre 8. Prova questo posto e pesca.',
      mossa: { t: 'pesca', coda: 1, pos: 1 } },
    { testo: 'Il Fante non sta fra l\'Asso e l\'8. Se scegli Resta, tutta la coda va negli scarti, 8 di picche compreso: sarebbe il quarto 8 e perderesti. Scegli Caccialo: il Fante e la carta successiva del mazzo vanno negli scarti, poi si pesca di nuovo per lo stesso posto.',
      mossa: { t: 'caccia' } },
    { testo: 'Ora la coda 3, fra l\'Asso di quadri e il 2 di fiori: ci stanno solo l\'Asso e il 2.',
      mossa: { t: 'pesca', coda: 2, pos: 1 } },
    { testo: 'Il 5 non ci sta. Stavolta scegli Resta: tutta la coda 3 va negli scarti e il 5 comincia una coda nuova. Costa tante carte, ma non si è arrivati a quattro dello stesso valore (gli Assi sono tre).',
      mossa: { t: 'resta' } },
    { testo: 'Prima di pescare si può guardare il mazzo: mostra quali carte restano, in ordine di valore, ma non in che ordine usciranno. Tocca il mazzo.',
      mossa: { t: 'guarda' } },
    { testo: 'Un\'ultima mossa: sopra la Donna di picche, in cima alla coda 2. Un pari, una Donna, può starci.',
      mossa: { t: 'pesca', coda: 1, pos: 5 } },
    { testo: 'Si va avanti così. Perdi appena scarti la quarta carta di un valore, anche quella scartata dalla cima del mazzo con Caccialo. Vinci se finisci il mazzo senza averne scartate quattro uguali: il punteggio sono le carte rimaste in coda. Se il mazzo è vuoto puoi cacciare lo stesso e si scarta solo la carta in mano.' }
  ];

  return { nuova: nuova, passi: passi, CODE: CODE, SCARTI: SCARTI, IN_TESTA: IN_TESTA };
}));
