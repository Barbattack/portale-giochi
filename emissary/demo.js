/*
 * The Emissary — la demo: due scene preparate sull'esempio di metà partita del libro (p. 50), sempre uguali.
 * Scena 'inizio': le otto carte in mano e la scelta del regno 4 (la Donna di quadri, briscola quadri).
 * Scena 'meta': il regno 4 a metà, il sovrano ha appena detto 8♥, in mano 8♦ 6♣ 7♠ 4♦, due dibattiti già vinti.
 *   Dal libro: regni 1-8 = Q♥ Q♣ (vinto) Q♦ K♣ (vinto) K♥ Q♠; ho già visitato il 3 e il 6. I sovrani dei due regni
 *   vinti (K♠ e K♦) sono gli unici due che mancano all'appello. Il libro non dice cosa c'è negli scarti e nelle
 *   vittorie: la storia dei quattro dibattiti già giocati è ricostruita da noi, coerente con la mano (vedi sotto).
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve rifiutarla
 * (la demo mostra il perché e non la fa), altrimenti la mossa si fa. Ogni rifiuto ha `motivo`: un pezzo del
 * testo che il motore deve dare (la prova controlla che arrivi da lì). Un passo con `scena` cambia il tavolo.
 * Nel browser si chiama `EmissaryDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.EmissaryDemo = factory(root.Emissary);
}(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var REGNI = ['C12', 'F12', null, 'Q12', 'F13', null, 'C13', 'P12'];
  var ALLEATI = [{ id: 'P13', regno: 2, usato: false }, { id: 'Q13', regno: 5, usato: false }];
  var DECK = E.mazzoCompleto().filter(E.eMazzo).map(function (c) { return c.id; });
  function resto(usate, prima) {
    return prima.concat(DECK.filter(function (id) { return usate.indexOf(id) < 0 && prima.indexOf(id) < 0; }));
  }

  // Storia ricostruita, regno 4 (briscola quadri), mano di partenza 8♦ 6♣ 7♠ 4♦ 5♥ 4♥ 3♠ 2♦:
  //   2♥ risposto con 5♥ (vinto), 3♥ con 4♥ (vinto), 4♠ con 3♠ (perso), 3♦ con 2♦ (perso, quadri contro quadri), poi 8♥.
  var MANO8 = ['Q8', 'F6', 'P7', 'Q4', 'C5', 'C4', 'P3', 'Q2'];
  function inizio() {
    var mazzo = resto(MANO8, ['C2', 'C3', 'P4', 'Q3', 'C8', 'F5', 'P8']);
    return E.costruisci({ seme: 'demo-1', regni: REGNI, fase: 'scegli', corrente: null, alleati: ALLEATI, mano: MANO8, mazzo: mazzo });
  }
  function meta() {
    var mano = ['Q8', 'F6', 'P7', 'Q4'], scarti = ['C2', 'C3', 'P4', 'P3', 'Q3', 'Q2', 'C8'], vitt = ['C5', 'C4'];
    var mazzo = resto(mano.concat(scarti, vitt), ['F5', 'P8']);
    return E.costruisci({ seme: 'demo-2', regni: REGNI, fase: 'risposta', corrente: 4, alleati: ALLEATI,
      mano: mano, mazzo: mazzo, scarti: scarti, vittorie: vitt });
  }
  function nuova() { return inizio(); }
  function scena(nome) { return nome === 'meta' ? meta() : inizio(); }

  var passi = [
    { testo: 'Sei un giovane nobile mandato a conquistare l\'appoggio di otto regni. In ogni regno affronti il sovrano in una serie di dibattiti: ogni dibattito è una presa a carte. Il numero del regno, da 1 a sinistra fino a 8, è il numero ESATTO di dibattiti che devi vincere: né uno di più né uno di meno. Se sbagli anche una volta, perdi. Se riesci, il sovrano diventa tuo alleato.' },
    { scena: 'inizio',
      testo: 'Ogni giro peschi 8 carte, le guardi e scegli quale regno visitare. Ogni regno si visita una volta sola. Il seme del sovrano è la briscola. Qui il regno 3 e il regno 6 sono già tuoi. Scegli il regno 4: la Donna di quadri, briscola quadri, servono esattamente 4 vittorie.',
      mossa: { t: 'regno', n: 4 } },
    { scena: 'meta',
      testo: 'Saltiamo a metà del regno 4, come nell\'esempio del libro. Hai già vinto 2 dibattiti e te ne servono altri 2. Hai 4 carte in mano, cioè 4 dibattiti ancora da giocare. Il sovrano ha appena detto l\'8 di cuori. Non hai cuori, quindi puoi rispondere con qualunque carta. Vinci se giochi una carta più alta nel suo seme, oppure, quando la sua carta non è di briscola, una carta qualunque di briscola.' },
    { testo: 'Prova questa mossa: usa il Fante di cuori.',
      mossa: { t: 'fante', seme: 'C' }, rifiuto: true, motivo: 'prima che esca' },
    { testo: 'Il sovrano ha parlato e la briscola è quadri: l\'8 di cuori non è di briscola, quindi qualunque quadri vince. Rispondi con l\'8 di quadri. Va nella pila delle vittorie, e sono 3.',
      mossa: { t: 'gioca', carta: 'Q8' } },
    { testo: 'Fra un dibattito e l\'altro puoi usare i tuoi consiglieri, i quattro Fanti: ognuno una volta per regno. Ti serve una sola vittoria in più e hai ancora tre carte: sono troppi dibattiti. Il Fante di cuori scarta tutte le carte di briscola che hai in mano: il 4 di quadri. Poi i dibattiti saranno due.',
      mossa: { t: 'fante', seme: 'C' } },
    { testo: 'Ora il sovrano parla: apri il dibattito. La prima carta del mazzo si scopre negli scarti.',
      mossa: { t: 'apri' } },
    { testo: 'Prova questa mossa: rispondi al 5 di fiori con il 7 di picche.',
      mossa: { t: 'gioca', carta: 'P7' }, rifiuto: true, motivo: 'nel seme' },
    { testo: 'Devi rispondere nel seme se puoi: il 5 di fiori chiama una carta di fiori. Il tuo 6 di fiori è più alto, e vince: sono 4 vittorie.',
      mossa: { t: 'gioca', carta: 'F6' } },
    { testo: 'Hai già le 4 vittorie che servono, ma ti resta una carta in mano e il regno finisce solo quando la mano è vuota. Apri l\'ultimo dibattito.',
      mossa: { t: 'apri' } },
    { testo: 'Il sovrano dice l\'8 di picche e devi rispondere in picche: il tuo 7 è più basso, perdi il dibattito, e va bene così. Le vittorie restano 4, esattamente il numero del regno.',
      mossa: { t: 'gioca', carta: 'P7' } },
    { testo: 'Regno vinto: la Donna di quadri è tua alleata. Una volta sola in tutta la partita puoi usare il suo potere, quello del suo seme, con gli stessi tempi dei Fanti. Poi si rimescola tutto, i Fanti tornano disponibili e ricominci con 8 carte nuove. I poteri: cuori scarta le briscole in mano, fiori pesca una carta per ogni fiori che hai in mano al momento, picche scambia il sovrano di questo regno con quello di un regno non ancora visitato (nell\'ultimo regno non fa niente), quadri pesca due carte e ne scarta due. Se il mazzo finisce durante un regno si rimescolano gli scarti. Perdi al primo regno chiuso col numero sbagliato; vinci con tutti e otto. Il punteggio sono i regni vinti più gli alleati non usati, fino a 16, e si dà anche quando perdi.' }
  ];

  return { nuova: nuova, scena: scena, passi: passi };
}));
