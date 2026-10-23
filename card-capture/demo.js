/*
 * Card Capture — la demo: tre turni preparati, sempre uguali. Mostra un turno completo
 * (le quattro fasi), le tre azioni A, B e C, il jolly e un rifiuto col perché. Non mostra
 * la variante a due fasi né i poteri. Ogni passo ha una frase e, se serve, una mossa:
 * `rifiuto:true` vuol dire che il motore deve rifiutarla (la demo mostra il perché e
 * non la fa), altrimenti la mossa si fa. Ogni rifiuto ha `motivo`: un pezzo del testo che il motore
 * deve dare (la prova controlla che il rifiuto arrivi proprio da lì). Nel browser si chiama `CardCaptureDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.CardCaptureDemo = factory(root.CardCapture);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Si parte prima della fase nemica del turno 1: la fila ha due buchi, il mazzo nemico
  // ha in cima 5♠ e 7♣; il tuo mazzo ha in cima 4♣, 3♥, 4♦, 2♠. (F fiori, P picche, C cuori, Q quadri)
  function nuova() {
    var s = C.costruisci({
      turno: 0, fila: 'F6 - Q9 -', mazzoNemico: 'P5 F7 C8 Q6 P9 C10',
      mano: 'F3 X1 Q2 P4', mazzo: 'F4 C3 Q4 P2 F2 C2'
    });
    C.interno.iniziaTurno(s);
    return s;
  }

  var passi = [
    { testo: 'In alto il nemico: quattro carte in fila, il suo mazzo e la pila dove finiscono le tue carte perse. In basso le tue. Hai già visto la fase nemica: le carte sono scivolate verso la posizione 1, e quelle nuove sono entrate dalla 4.' },
    { testo: 'Fase di scarto: puoi mandare negli scarti le carte che non ti servono. Scarti il 2♦. Poi la pesca va da sola, e torni a quattro carte.',
      mossa: { t: 'scarta', carte: ['Q2'] } },
    { testo: 'Fase di cattura, azione A: per prendere una carta nemica devi spendere carte dello stesso seme, per un totale uguale o maggiore. Prova questa mossa: il 4♠ e il 3♣ contro il 6♣.',
      mossa: { t: 'cattura', azione: 'A', mie: ['F3', 'P4'], bersaglio: 'F6' }, rifiuto: true, motivo: '4♠ non è di fiori' },
    { testo: 'Con il jolly: fa da qualunque altra carta della tua mano, valore e seme. Qui copia il 3♣, quindi jolly e 3♣ fanno 6, come il 6♣. Lo catturi: le carte spese e quella catturata vanno nei tuoi scarti, e diventano il tuo mazzo.',
      mossa: { t: 'cattura', azione: 'A', mie: ['X1', 'F3'], bersaglio: 'F6', copie: { X1: 'F3' } } },
    { testo: 'Turno 2. Fase nemica: il 9♦ scivola in posizione 1 ed entra l\'8♥. Non c\'è niente da scartare: ora ti serve la fase di cattura.',
      mossa: { t: 'scarta', carte: [] } },
    { testo: 'Azione B, farti catturare: la carta nemica in posizione 1, il 9♦, e una carta a tua scelta, il 3♥, vanno nella pila nemica e non tornano più. Così la fila nemica si accorcia, ma tu perdi una carta. Se in posizione 1 ci fosse una figura o un Asso, perderesti.',
      mossa: { t: 'cattura', azione: 'B', carta: 'C3' } },
    { testo: 'Turno 3. Di nuovo niente da scartare.',
      mossa: { t: 'scarta', carte: [] } },
    { testo: 'Azione C, sacrificio: due carte della tua mano, il 4♦ e il 2♠, vanno nella pila nemica. In cambio scegli una carta della fila, l\'8♥, e la mandi in fondo al suo mazzo: tornerà più tardi.',
      mossa: { t: 'cattura', azione: 'C', mie: ['Q4', 'P2'], bersaglio: 'C8' } },
    { testo: 'Vinci quando il mazzo nemico e la fila sono vuoti e nessuna figura o Asso è finito nella pila nemica. Se ci finisce, o se non hai nessuna azione possibile, perdi subito. Tocca a te.' }
  ];

  return { nuova: nuova, passi: passi };
}));
