/*
 * Il cortile — la demo: una partita preparata, sempre uguale (disposizione e cima del mazzo fisse).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `CortileDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.CortileDemo = factory(root.Cortile);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  // il cortile, riga per riga (ogni colonna ha Fante, Donna e Re di tre semi diversi)
  var GRIGLIA = 'S12 C13 D11 S13  D13 S11 H13 C11  H11 D12 C12 H12'.split(/\s+/);
  // in cima al mazzo: 7 di picche, 4 di cuori, 9 di quadri, 6 di quadri
  var IN_TESTA = 'S7 H4 D9 D6'.split(' ');

  function nuova() { return C.nuova('demo', { griglia: GRIGLIA, inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'Questo è il cortile: dodici compagni coperti, in quattro colonne da tre. In ogni colonna ci sono un Fante, una Donna e un Re di tre semi diversi, ma non sai dove. Intorno ci sono 14 posti per le ipotesi. La carta accanto al cortile è la prima del mazzo, e sotto c’è quante ne restano.' },
    { testo: 'Ipotesi: la prima carta del mazzo va in un posto vuoto intorno al cortile. Un posto a capo di una riga parla di quella riga, uno a capo di una colonna parla di quella colonna. Qui scommetti che nella riga 1 c’è una picche.',
      mossa: { t: 'ipotesi', dove: 'L0' } },
    { testo: 'Un’altra ipotesi, stavolta sui cuori: la scommetti sulla colonna 3, in basso.',
      mossa: { t: 'ipotesi', dove: 'B2' } },
    { testo: 'Una terza, sui quadri: in alto sulla colonna 4.',
      mossa: { t: 'ipotesi', dove: 'T3' } },
    { testo: 'Scopri un compagno: lo giri. Le ipotesi sulla sua riga e sulla sua colonna che hanno il suo seme vanno nei punti, al massimo 4. Le altre restano dove sono. Scopri la carta in alto a sinistra.',
      mossa: { t: 'scopri', dove: 0 } },
    { testo: 'Prova questa mossa: Ritira, con l’ipotesi di cuori che hai messo in basso sulla colonna 3.',
      mossa: { t: 'ritira', dove: 'B2' }, rifiuto: true, motivo: 'è di quadri, l’ipotesi è di cuori' },
    { testo: 'Ritira: scarti la prima carta del mazzo per togliere un’ipotesi dello stesso seme. Vanno via tutte e due, ed è l’unico modo per liberare un posto. Qui il 6 di quadri toglie il 9 di quadri.',
      mossa: { t: 'ritira', dove: 'T3' } },
    { testo: 'Scopri la carta in riga 2, colonna 3.',
      mossa: { t: 'scopri', dove: 6 } },
    { testo: 'Hai 2 punti e 2 compagni scoperti su 12. La partita finisce quando li scopri tutti, e si vince con 20 punti o più. Scoprire presto dà poche informazioni; scoprire tardi può lasciare i posti pieni di ipotesi sbagliate.' }
  ];

  return { nuova: nuova, passi: passi, GRIGLIA: GRIGLIA, IN_TESTA: IN_TESTA };
}));
