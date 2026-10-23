/*
 * La baita — la demo: una partita preparata, sempre uguale (baita, zombie e cima del mazzo fissi).
 * La baita e i casi sono quelli degli esempi del libro (pagine 21 e 22).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve
 * rifiutarla (la demo mostra il perché e non la fa), altrimenti la mossa si fa.
 * Ogni rifiuto ha `motivo`: un pezzo del testo che il motore deve dare, quello che la lezione spiega
 * (la prova controlla che il rifiuto arrivi proprio da lì).
 * Nel browser si chiama `BaitaDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.BaitaDemo = factory(root.Baita);
}(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';
  // la baita, riga per riga: 7♥ 4♠ A♠ / 6♣ 2♦ 10♣ / Jolly 8♥ 4♣
  var BAITA = 'H7 S4 S1  C6 D2 C10  J1 H8 C4'.split(/\s+/);
  // gli zombie nell'ordine T0 T1 T2 R0 R1 R2 B0 B1 B2 L0 L1 L2
  var ZOMBIE = 'C12 S11 C13  D11 H12 S13  H13 C11 D12  S12 D13 H11'.split(/\s+/);
  // in cima al mazzo: 3 di quadri, 7 di picche, jolly, 9 di picche
  var IN_TESTA = 'D3 S7 J2 S9'.split(' ');

  function nuova() { return B.nuova('demo', { baita: BAITA, zombie: ZOMBIE, inTesta: IN_TESTA }); }

  var passi = [
    { testo: 'Sei chiuso in una baita fatta di nove pile di carte, e intorno ci sono dodici zombie coperti, tre per lato. Devi abbatterli tutti prima che finisca il mazzo. Ogni turno ha tre passi: scopri uno zombie, gioca una carta su una pila, abbatti uno zombie se puoi. Sotto la baita c’è il mazzo, col numero delle carte che restano.' },
    { testo: 'Primo passo: scopri uno zombie, a tua scelta. Poi si pesca da sé. Scopri quello in alto sulla colonna 3.',
      mossa: { t: 'scopri', dove: 'T2' } },
    { testo: 'Prova questa mossa: gioca il 3♦ che hai in mano sulla pila in riga 1, colonna 2, che ha in cima il 4♠.',
      mossa: { t: 'gioca', dove: 1 }, rifiuto: true, motivo: 'colore opposto, la carta in cima deve valere di meno' },
    { testo: 'Secondo passo: la carta pescata va su una pila. Su una carta dello stesso colore si va solo se quella in cima vale di più; su una di colore opposto, solo se vale di meno; sul valore uguale sempre. Il 3♦ può andare sul 7♥, sull’8♥, sull’A♠ o sul Jolly. Giocalo sull’Asso di picche, in alto a destra.',
      mossa: { t: 'gioca', dove: 2 } },
    { testo: 'Prova questa mossa: abbatti lo zombie a destra, sulla riga 1. È il terzo passo: puoi abbattere uno zombie scoperto vicino alla pila dove hai giocato, e questa pila d’angolo ne ha due vicini, uno in alto e uno a destra (quelle di lato ne hanno uno, quella al centro nessuno).',
      mossa: { t: 'abbatti', dove: 'R0' }, rifiuto: true, motivo: 'ancora coperto' },
    { testo: 'Gli zombie coperti non si possono colpire: per questo conta l’ordine in cui li scopri. Abbatti il Re di fiori in alto: la forza viene dalle altre due carte della colonna, 10♣ e 4♣, che fanno 14 (ne servono almeno 10) e sono tutte e due di fiori, come vuole il Re.',
      mossa: { t: 'abbatti', dove: 'T2' } },
    { testo: 'Nuovo turno. Scopri lo zombie a destra della riga 1.',
      mossa: { t: 'scopri', dove: 'R0' } },
    { testo: 'Hai pescato il 7♠. Va sul 3♦, che ora è in cima alla pila in alto a destra: colore opposto, e la carta in cima vale di meno. Giocalo lì.',
      mossa: { t: 'gioca', dove: 2 } },
    { testo: 'Il Fante non ha vincoli di seme: bastano due carte che fanno 10 o più. Le altre due della riga sono 7♥ e 4♠, cioè 11. Abbatti il Fante di quadri.',
      mossa: { t: 'abbatti', dove: 'R0' } },
    { testo: 'Nuovo turno. Scopri lo zombie in basso sulla colonna 1.',
      mossa: { t: 'scopri', dove: 'B0' } },
    { testo: 'Ti è uscito il Jolly: si gioca su qualunque carta, e su un jolly va qualunque carta. Mettilo sul Jolly in basso a sinistra.',
      mossa: { t: 'gioca', dove: 6 } },
    { testo: 'Prova questa mossa: abbatti il Re di cuori in basso, con la colonna 1 che ha il 7♥ e il 6♣ come carte d’appoggio.',
      mossa: { t: 'abbatti', dove: 'B0' }, rifiuto: true, motivo: 'tutte e due di cuori' },
    { testo: 'Abbattere è facoltativo: se non ci riesci, o non ti conviene, scegli di non abbattere nessuno e il turno passa.',
      mossa: { t: 'passa' } },
    { testo: 'Ultimo turno della prova. Scopri lo zombie a sinistra della riga 1.',
      mossa: { t: 'scopri', dove: 'L0' } },
    { testo: 'Hai pescato il 9♠. Va sul 7♥, in alto a sinistra: colore opposto, e la carta in cima vale di meno. Giocalo lì.',
      mossa: { t: 'gioca', dove: 0 } },
    { testo: 'La Donna vuole carte d’appoggio del suo colore. Le altre due della riga sono 4♠ e 7♠, tutte e due nere come la Donna di picche, e fanno 11. Abbattila.',
      mossa: { t: 'abbatti', dove: 'L0' } },
    { testo: 'Hai abbattuto 3 zombie su 12 e il mazzo ha ancora molte carte. Per il Re servono due carte dello stesso seme, per la Donna dello stesso colore, per il Fante basta la somma; il Jolly come appoggio vale 0 e conta come ogni seme, quindi va in coppia con un 10. Se pescando non puoi giocare su nessuna pila, o se il mazzo è finito, hai perso. Si vince abbattendoli tutti, e il punteggio sono le carte rimaste nel mazzo.' }
  ];

  return { nuova: nuova, passi: passi, BAITA: BAITA, ZOMBIE: ZOMBIE, IN_TESTA: IN_TESTA };
}));
