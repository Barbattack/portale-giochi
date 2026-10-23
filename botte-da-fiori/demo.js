/*
 * Botte da fiori — la demo: una partita preparata, sempre uguale (mazzi in ordine fisso).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il
 * motore deve rifiutarla (e la demo mostra il perché), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la frase spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `BotteDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.BotteDemo = factory(root.Botte);
}(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';
  function lista(t) {
    return t.split(' ').map(function (x) { return x[0] === 'J' ? B.jolly(+x.slice(1)) : B.carta(x[0], +x.slice(1)); });
  }
  // griglia: H5 D9 S3 / D4 H10 D7 / S10 H6 J1; poi il mazzo in ordine
  var GRIGLIA = 'H5 D9 S3 D4 H10 D7 S10 H6 J1 ' +
    'H9 S8 S5 S11 H13 S12 H3 H1 D2 S6 D3 H7 H4 D8 H2 D10 S1';
  var FIORI = 'C10 C7 C2 C6 C5 C9 C12 C3 C8 C1 C4 C11 C13';

  function nuova() { return B.nuova('demo', { fiori: lista(FIORI), griglia: lista(GRIGLIA) }); }

  var passi = [
    { testo: 'Questa è la griglia: 9 carte. Con le tue carte di fiori devi toglierle tutte.' },
    { testo: 'Ogni turno giochi una carta di fiori e fai una mossa. Il 10 con «Uguali» toglie tutti i 10 della griglia.',
      mossa: { carta: 'C10', azione: 'uguali' } },
    { testo: 'Attenzione ai semi: tre carte dello stesso seme bloccano una mossa. Cuori: Scala. Quadri: Linea. Picche: Su/Giù. Guarda la griglia e prova una Scala.',
      mossa: { carta: 'C6', azione: 'scala', scelte: ['D7'] }, rifiuto: true, motivo: 'Scala bloccata: in griglia ci sono 3 cuori' },
    { testo: '«Una qualsiasi» non si blocca mai: togli la carta che vuoi. Togliamo un cuore.',
      mossa: { carta: 'C2', azione: 'qualsiasi', scelte: ['H9'] } },
    { testo: 'Ora i cuori sono due e la Scala si può fare: 5, 6 (il tuo fiori), 7, 8. Un solo valore per gradino.',
      mossa: { carta: 'C6', azione: 'scala', scelte: ['S5', 'D7', 'S8'] } },
    { testo: 'Ora Su/Giù col 7, scegliendo le carte più alte.',
      mossa: { carta: 'C7', azione: 'sugiu', dir: 'alte' }, rifiuto: true, motivo: 'Su/Giù bloccata: in griglia ci sono 3 picche' },
    { testo: '«Somma»: le carte tolte devono fare esattamente il valore del tuo fiori. Qui scegli il 4 e il Fante.',
      mossa: { carta: 'C7', azione: 'somma', scelte: ['D4', 'S11'] }, rifiuto: true, motivo: 'La somma fa 15, serve 7' },
    { testo: 'Così sì: 4 e 3 fanno 7.',
      mossa: { carta: 'C7', azione: 'somma', scelte: ['D4', 'S3'] } },
    { testo: '«Linea» toglie una riga o una colonna che ha una carta dello stesso valore: qui la Donna. Il jolly nella riga se ne va con le altre. Lo tolgono solo «Linea» e «Una qualsiasi».',
      mossa: { carta: 'C12', azione: 'linea', linea: { tipo: 'riga', n: 2 } }, jolly: true },
    { testo: '«Su/Giù»: dal 2 al 7 toglie le carte più basse del tuo fiori, dal 7 alla Donna le più alte. Il 5 toglie le più basse: i 5 restano.',
      mossa: { carta: 'C5', azione: 'sugiu' } },
    { testo: 'Ora Su/Giù con l\'Asso.',
      mossa: { carta: 'C1', azione: 'sugiu' }, rifiuto: true, motivo: "Su/Giù non si fa con l'Asso" },
    { testo: 'Se non puoi fare una mossa te lo diciamo, e la carta di fiori resta in mano. Tocca a te!' }
  ];

  return { nuova: nuova, passi: passi, GRIGLIA: GRIGLIA, FIORI: FIORI };
}));
