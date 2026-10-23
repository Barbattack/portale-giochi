/*
 * Foursquare — la demo: l'esempio del libro (pagine 30-31), poi qualche mossa in più.
 * La partita è preparata, sempre uguale. Coordinate come nel libro: colonne A, B, C, D (x = 0, 1, 2, 3),
 * righe 1, 2, 3 (y = 1, 2, 3). La casella sopra la riga 1 è y = 0.
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `FoursquareDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.FoursquareDemo = factory(root.Foursquare);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  // le pile dell'esempio del libro, dal fondo alla cima. Le carte sotto la cima non contano: le ho scelte io.
  var TAVOLO = [
    { x: 0, y: 1, carte: ['S9'], su: true },                    // A1: 9♠
    { x: 1, y: 1, carte: ['S6', 'C10'], su: true },             // B1: 10♣
    { x: 1, y: 2, carte: ['C3', 'H8', 'D10'], su: false },      // B2: coperta
    { x: 2, y: 2, carte: ['H6', 'C6'], su: true },              // C2: 6♣
    { x: 3, y: 2, carte: ['S5', 'H7', 'H4'], su: true },        // D2: 4♥
    { x: 2, y: 3, carte: ['C4', 'S3'], su: true },              // C3: 3♠
    { x: 3, y: 3, carte: ['D5', 'H2'], su: true }               // D3: 2♥
  ];
  // in cima al mazzo: 6 di quadri, 8 di fiori, Asso di cuori, 4 di picche
  var IN_TESTA = ['D6', 'C8', 'H1', 'S4'];

  function nuova() { return C.nuova('demo', { tavolo: TAVOLO, inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'Questo è l’esempio del libro. Ogni mucchio di carte è una pila, e di ogni pila si vede solo la carta in cima: se è girata a faccia in giù, è un ristorante chiuso. Le colonne sono A, B, C, D e le righe 1, 2, 3. La carta da posare è il 6 di quadri, a sinistra: sotto c’è quante ne restano nel mazzo. I posti tratteggiati sono dove una pila nuova può stare.' },
    { testo: 'Prova questa mossa: il 6♦ in A3, colonna A e riga 3, in basso a sinistra.',
      mossa: { t: 'posa', x: 0, y: 3 }, rifiuto: true, motivo: 'accanto a una pila' },
    { testo: 'Prova questa mossa: il 6♦ in D1, sopra la colonna D.',
      mossa: { t: 'posa', x: 3, y: 1 }, rifiuto: true, motivo: '5 pile coperte' },
    { testo: 'Ora una posa che si può fare: il 6♦ sopra la pila B2, anche se la sua cima è coperta. Nella riga 2 c’è già un altro 6: il tuo non è più alto di tutti, e non gira niente. Nella colonna B è il più basso tra le carte scoperte, e gira il 10♣.',
      mossa: { t: 'posa', x: 1, y: 2 } },
    { testo: 'Il prossimo è l’8♣: posalo sopra il 9♠ di A1. Nella riga 1 l’altra pila è coperta, e le coperte non contano: l’8 è l’unica carta scoperta della riga, e la gira.',
      mossa: { t: 'posa', x: 0, y: 1 } },
    { testo: 'L’Asso vale 1, la carta più bassa. Posa l’Asso di cuori sopra il 3♠ di C3: è il più basso della riga 3 e il più basso della colonna C, e gira D3 e C2.',
      mossa: { t: 'posa', x: 2, y: 3 } },
    { testo: 'Una pila nuova sopra A1, nella casella sopra la riga 1: il 4♠. La griglia cresce verso l’alto; nella colonna A il 4 è più basso dell’8, e gira A1.',
      mossa: { t: 'posa', x: 0, y: 0 } },
    { testo: 'Ora la griglia è larga 4 e alta 4: non può più crescere, e le pile nuove restano solo dentro il quadrato. Si vince con 16 pile e tutte le cime scoperte, e il punteggio sono le carte rimaste nel mazzo. Si perde se ti restano più di 4 cime coperte, se non c’è nessuna posa possibile o se finisce il mazzo.' }
  ];

  return { nuova: nuova, passi: passi, TAVOLO: TAVOLO, IN_TESTA: IN_TESTA };
}));
