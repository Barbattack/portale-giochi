/*
 * Skyway — la demo: l'esempio di metà partita del libro (p. 9), una seconda mossa, e la griglia
 * vincente del libro (p. 10). Tutto preparato, sempre uguale.
 * Caselle: 0 in alto a sinistra ... 8 in basso a destra (riga * 3 + colonna). Pile del mercato: 0, 1, 2, da sinistra.
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vorrebbe dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), con `motivo`, un pezzo del testo che il motore
 * deve dare. In Skyway ogni mossa che l'interfaccia permette è valida, quindi nessun passo ha rifiuto.
 * Un passo con `scena` cambia il tavolo quando ci si arriva.
 * Nel browser si chiama `SkywayDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.SkywayDemo = factory(root.Skyway);
}(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  // metà partita, libro p. 9 (ogni casella dal fondo alla cima)
  var META = [
    ['H3', 'S7'], ['H10', 'D5'], ['D4'],
    [], ['H8'], ['H4', 'D2', 'C3'],
    ['S4', 'D6'], ['C8', 'S3', 'H2'], []
  ];
  var MERCATO = [['H7', 'C6'], ['S1', 'D9'], ['C2']];
  var IN_TESTA = ['C5', 'S9', 'D3', 'H6', 'S2'];       // il mercato che arriva dopo la prima mossa
  var SCARTI = ['H1', 'H5', 'H9', 'D1', 'D8', 'D10', 'C1', 'C4'];

  // la griglia vincente, libro p. 10
  var VINCENTE = [
    ['H3', 'S7'], ['H10', 'D5', 'D10'], ['D4', 'C1', 'D9'],
    ['S5', 'H6'], ['H8', 'H5'], ['H4', 'D2', 'C3'],
    ['S4', 'D6', 'C10'], ['C8', 'S3', 'H2'], ['S1', 'H7', 'C5']
  ];

  function nuova() { return S.nuova('demo', { griglia: META, mercato: MERCATO, inTesta: IN_TESTA, scarti: SCARTI }); }
  function scena(nome) {
    if (nome !== 'fine') return nuova();
    var usate = {};
    VINCENTE.forEach(function (c) { c.forEach(function (id) { usate[id] = true; }); });
    var resto = S.mazzoCompleto().map(function (c) { return c.id; }).filter(function (id) { return !usate[id]; });
    return S.nuova('demo-fine', { griglia: VINCENTE, scarti: resto, mercato: [[], [], []], giro: 3, finita: true });
  }

  var passi = [
    { testo: 'Sei un urbanista e disegni uno svincolo. In alto c’è il mercato: tre pile di carte, due da due carte e una da una. Ne scegli una sola, le altre vanno negli scarti. La metti in una delle nove caselle della griglia, sopra quello che c’è già, senza cambiare l’ordine: le carte stanno a ventaglio, la più in basso a sinistra e la più in alto a destra. Una casella tiene al massimo tre carte. Questo è l’esempio del libro, a metà partita.' },
    { testo: 'Prendi la pila 7♥ 6♣, la prima del mercato, e posala nella casella a destra al centro. Ha già tre carte: 4♥ 2♦ 3♣. Il 7♥ va sopra, e il 6♣ ancora sopra. Ora le carte sono cinque, e ne restano tre: quelle in fondo, il 4♥ e il 2♦, vanno negli scarti.',
      mossa: { t: 'gioca', pila: 0, casella: 5 } },
    { testo: 'Il mercato si rifà da solo, sempre nello stesso modo: due pile da due e una da una. Una pila da una carta si può scegliere come le altre. Prendi il 2♠ da solo e mettilo nella casella a sinistra al centro, che è vuota. Le altre due pile vanno negli scarti.',
      mossa: { t: 'gioca', pila: 2, casella: 3 } },
    { testo: 'Si passa tre volte per il mazzo. Quando il mazzo finisce si rimescolano gli scarti e si gira un segnalino (le tre figure in alto): giro 2, poi giro 3. Se il mazzo finisce a metà mercato, si rimescola e lo si completa. Al terzo giro, dopo l’ultimo mercato, la partita finisce. Qui sotto c’è la griglia vincente del libro.' },
    { scena: 'fine',
      testo: 'Per ogni seme conta la sequenza crescente più lunga, passando fra caselle vicine, in orizzontale o in verticale. Le carte non devono essere consecutive, e lo strato non conta. Si può tornare su una casella, ma a ogni passo si cambia casella. I cuori: 2♥ in basso al centro, 5♥ al centro, 6♥ a sinistra, 8♥ di nuovo al centro, 10♥ in alto: cinque carte. Tocca un seme per vedere la sua sequenza. Vinci se ogni seme ne ha almeno cinque; il punteggio è la somma delle quattro.' }
  ];

  return { nuova: nuova, scena: scena, passi: passi, META: META, MERCATO: MERCATO, IN_TESTA: IN_TESTA, SCARTI: SCARTI, VINCENTE: VINCENTE };
}));
