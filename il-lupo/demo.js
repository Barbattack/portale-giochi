/*
 * Il Lupo — la demo: una mano preparata, sempre uguale (carte in cima al mazzo in ordine fisso).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore
 * deve rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `LupoDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.LupoDemo = factory(root.Lupo);
}(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  // il Lupo: R7 B3 V5 G6 | tu: B7 R2 G4 P8 | poi il mazzo: P3 G2 R5 V1 B4 (la prima è la scoperta)
  var IN_TESTA = 'R7 B3 V5 G6 B7 R2 G4 P8 P3 G2 R5 V1 B4'.split(' ');

  function nuova() { return L.nuova('demo', { livello: 'facile', inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'In alto le carte del Lupo, in basso le tue: tutte scoperte. Con le tue devi togliere tutte le sue. La carta accanto al mazzo è la prossima che si pesca.' },
    { testo: 'Perfetta: il tuo 7 contro il 7 del Lupo, stesso valore. Le togli entrambe, e poi pesca tu una carta: la scoperta, il 3.',
      mossa: { t: 'gioca', azione: 'perfetta', mie: ['B7'], sue: ['R7'] }, chi: 'tu' },
    { testo: 'Divisa: il tuo 8 contro il 3 e il 5 del Lupo, che sommati fanno 8. Le togli, ma stavolta pesca il Lupo una carta: il 2.',
      mossa: { t: 'gioca', azione: 'divisa', mie: ['P8'], sue: ['B3', 'V5'] }, chi: 'lupo' },
    { testo: 'Sopra: il tuo 4 contro il 2 del Lupo, più piccolo. Le togli, e il Lupo pesca tante carte quanta è la differenza: 4 meno 2, due carte.',
      mossa: { t: 'gioca', azione: 'sopra', mie: ['G4'], sue: ['G2'] }, chi: 'lupo' },
    { testo: 'Prova questa mossa: Somma, con il tuo 2 e il tuo 3 contro il 6 del Lupo.',
      mossa: { t: 'gioca', azione: 'somma', mie: ['R2', 'P3'], sue: ['G6'] }, rifiuto: true, motivo: 'La somma fa 5, ma hai scelto il 6' },
    { testo: 'Somma giusta: il 2 e il 3 fanno 5, come il 5 del Lupo. Poi pesca tu una carta.',
      mossa: { t: 'gioca', azione: 'somma', mie: ['R2', 'P3'], sue: ['R5'] }, chi: 'tu' },
    { testo: 'Ora hai solo il 4 e il Lupo ha il 6 e l\'1: ogni mossa gli darebbe altre carte. Meglio fermarti: il Lupo segna i punti delle sue carte, 7. Puoi farlo in qualunque momento.',
      mossa: { t: 'fermati' } }
  ];

  return { nuova: nuova, passi: passi, IN_TESTA: IN_TESTA };
}));
