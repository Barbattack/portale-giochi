/*
 * Loot the Loop — la demo: lo stesso esempio del libro (pagine 36-37), con un tempio preparato,
 * sempre uguale. Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il
 * motore deve rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione
 * spiega (la prova controlla che il rifiuto arrivi proprio da lì).
 * `anteprima:pos` mostra, senza mossa, dove atterrerebbe Esplora con quella carta.
 * Nel browser si chiama `TempioDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.TempioDemo = factory(root.Tempio);
}(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';
  // il tempio, dalla cima ("-" = coperta; 13S = Re di picche, 11H = Fante di cuori, 1C = Asso di fiori). Dopo l'Asso e la coperta che la segue, il resto in ordine fisso.
  var IN_TESTA = '4D 6D 10H -9H 13S -3S 11H -3H 1C -8D'.split(' ');
  var APPUNTI = ['7C', '5H', '2S'];

  function nuova() {
    var s = T.nuova('demo', { inTesta: IN_TESTA });
    s.appunti = APPUNTI.map(T.daId);
    s.mazzo = s.mazzo.filter(function (c) { return APPUNTI.indexOf(c.id) < 0; });
    return s;
  }

  var passi = [
    { testo: 'Sei dentro un tempio a forma di anello: il mazzo. Sei sulla prima carta, «Sei qui», e davanti a te c\'è tutto il resto, in fila. I numeri da 2 a 10 sono ninnoli, gli Assi gioielli, J Q K trappole, la stella è l\'uscita. Le carte col dorso non le conosci ancora.' },
    { testo: 'Con Esplora conti tante carte quanto vale una delle prime due, e arrivi sulla carta dopo. Il numero sotto ogni carta dice quanto contare per arrivarci. Qui il 6 ti porta sulla J, il 4 sul K: due trappole. Sei bloccato? Non ancora.',
      anteprima: 1 },
    { testo: 'Prova questa mossa: Segna una strada, con il 4 che hai in cima.',
      mossa: { t: 'segna' }, rifiuto: true, motivo: 'Hai già 3 appunti' },
    { testo: 'Gli appunti sono pieni, e non si può cambiarne uno con la carta in cima. Rimetti in cima il 7♣ dagli appunti: ti dà una carta in più davanti, e cambia i conti.',
      mossa: { t: 'torna', id: '7C' } },
    { testo: 'Ora il 7♣ è la prima carta e il 4♦ la seconda. Esplora con il 4♦: conti 4 carte e superi il K, atterrando su una carta coperta.',
      mossa: { t: 'esplora', pos: 1 } },
    { testo: 'Prova questa mossa: Segna una strada, con la carta coperta che hai in cima.',
      mossa: { t: 'segna' }, rifiuto: true, motivo: 'numero scoperto' },
    { testo: 'Con la prima carta coperta puoi solo guardare. Guardati intorno: gira le prime due, ma la seconda, il K, era già scoperta, e resta com\'è.',
      mossa: { t: 'guardati' } },
    { testo: 'Un 9♥. Ora gli appunti hanno un posto libero: segna il 9♥.',
      mossa: { t: 'segna' } },
    { testo: 'Vuoi arrivare sull\'Asso di fiori. Rimetti in cima il 5♥: sai che contando 5 ci arrivi.',
      mossa: { t: 'torna', id: '5H' } },
    { testo: 'Esplora con il 5♥ in cima: sposti 5 carte in fondo e atterri sull\'Asso. Un gioiello che prendi: va nei punti e esce dal tempio.',
      mossa: { t: 'esplora', pos: 0 } },
    { testo: 'La carta dopo l\'Asso ha il dorso: Guardati intorno. Se tutte le strade finissero in una trappola potresti arrenderti con «Mi arrendo». Per vincere ti servono tutti e quattro gli Assi e poi il Jolly. Ora gioca tu.',
      mossa: { t: 'guardati' } }
  ];

  return { nuova: nuova, passi: passi, IN_TESTA: IN_TESTA, APPUNTI: APPUNTI };
}));
