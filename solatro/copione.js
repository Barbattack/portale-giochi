/*
 * SOLATRO — IL COPIONE DELLA PARTITA GUIDATA (Chiara, 25/10/2026).
 * Questo è il FILE DEI TESTI del tutorial e delle regolette: tutorial.js lo legge e non contiene nessun testo suo.
 * PENNA riscrive qui le `bozza` e le `regole` senza toccare il codice: le altre chiavi (tipo, intento, vede, accendi, tocca, mossa,
 * attesa) sono il disegno del tutorial e il contratto col motore, e non si cambiano senza rifare la prova (prova/prova-copione.js).
 *
 * Com'è fatta la partita guidata. È una PARTITA VERA, sempre la stessa, dall'inizio: le prime 20 carte del mazzo sono decise da noi
 * (`inTesta`, come prevede il motore per le prove), il resto lo mescola il seme «tutorial-1», scelto perché all'inizio del round 2 esca
 * un jolly, uno solo. Il tutorial guida tutto il round 1 (scarto ragionato, colore, full da trovare, coppia), il negozio, e l'inizio del
 * round 2 (il jolly, i gettoni); poi il giocatore continua LA STESSA partita da solo, e il resto glielo insegnano i rifiuti del gioco.
 *
 * Ogni passo ha:
 *   tipo      'leggi'  un cartello da leggere, a pezzetti (pezzi.js), con Ok e alla fine Avanti
 *             'segna'  (negozio) bonus da toccare per segnarli, uno per volta: si paga dopo, col tasto unico (mossa { t:'negozio', compra:[...] })
 *             'tocca'  carte da toccare, una per volta, indicate dalla vignetta (nessuna mossa al motore: è la scelta)
 *             'tasto'  un tasto da toccare: la mossa arriva al motore (`mossa`), la prova la controlla
 *             'trova'  la mossa la trova il giocatore: il tutorial non indica le carte; accetta solo la combinazione `attesa`, e quando
 *                      il giocatore sbaglia dice `aiuto` (con {nome} e {punti} della combinazione che ha scelto)
 *   intento   cosa deve capire il giocatore in questo passo, in una riga
 *   vede      cosa c'è sullo schermo in quel momento
 *   pezzi     i pezzetti: ognuno prende una riga della bozza (`riga`) e accende sul tavolo le cose di cui parla (`accendi`)
 *   titolo    (leggi) il titolo del cartello — BOZZA
 *   bozza     il testo — BOZZA, da riscrivere (Penna). Le righe sono i pezzetti; **x** evidenzia.
 *   segna     (segna) i bonus da segnare, in ordine (id del motore)
 *   tocca     (tocca) le carte da toccare, in ordine (id del motore: C cuori, Q quadri, F fiori, P picche; 1 Asso, 11 Fante, 12 Donna, 13 Re)
 *   mossa     (tasto) la mossa che il motore riceve
 *   attesa    (trova) la combinazione che chiude il passo (id del motore)
 *
 * Chiavi di `accendi`: 'monete' (la moneta del round), 'traguardo' (la cassa: punti su traguardo), 'giocate', 'scarti', 'mano',
 * 'carta:<id>', 'tasto:gioca', 'tasto:scarta', 'tasto:<testo>', 'jolly', 'gettoni', 'bonus:<id>', 'spesa', 'articoli'.
 */
(function (root) {
  'use strict';
  var PARTITA = {
    seme: 'tutorial-1',
    // le prime 20 carte del mazzo, in ordine: la mano (8), le 2 pescate dopo lo scarto, le 5 dopo il colore, le 5 dopo il full
    inTesta: ['C7', 'P7', 'Q13', 'Q9', 'Q5', 'Q2', 'F3', 'P11',      // mano: 7♥ 7♠ K♦ 9♦ 5♦ 2♦ 3♣ J♠ (una coppia, quattro quadri)
      'Q10', 'F7',                                                  // dopo lo scarto di 3♣ e J♠: 10♦ (il quinto quadri) e 7♣ (il terzo 7)
      'C12', 'F12', 'P4', 'F9', 'C2',                               // dopo il colore: Q♥ Q♣ 4♠ 9♣ 2♥ (col 7♥ 7♠ 7♣ fanno un full)
      'Q4', 'F8', 'P3', 'C6', 'Q11']                                // dopo il full: 4♦ 8♣ 3♠ 6♥ J♦ (col 4♠ una coppia)
  };

  var PASSI = [
    { tipo: 'leggi', intento: 'Sapere da dove viene il gioco, con le parole dell\'autore: lo zio, le combinazioni, le monetine.',
      vede: 'La prima schermata di una partita vera: la fascia delle monete (round 1, 0 su 25, 3 giocate, 3 scarti), le 8 carte in mano, il tasto spento.',
      pezzi: [{ riga: 0, accendi: [] }, { riga: 1, accendi: ['monete'] }],
      titolo: 'Da dove viene', bozza: 'TechDweeb aveva fatto provare Balatro, un videogioco di carte, a suo zio, uno da poker. Allo zio piaceva fare combinazioni per prendere punti; appena spuntavano bustine di carte, buoni e le altre stranezze da videogioco, mollava.\nSolatro tiene solo quello, ed è nato per un mazzo vero: TechDweeb segna i round con una moneta da 25 centesimi ciascuno, come chi mette da parte gli spiccioli per la sala giochi del fine settimana.' },

    { tipo: 'leggi', intento: 'Capire come si vince e come si perde, prima di toccare qualsiasi cosa.',
      vede: 'Stessa schermata. La cassa dice 0 su 25.',
      pezzi: [{ riga: 0, accendi: ['traguardo'] }, { riga: 1, accendi: ['monete'] }],
      titolo: 'Come si vince, come si perde', bozza: 'Ogni round ha un **traguardo** di punti: il primo chiede 25, poi 50, 75… Lo raggiungi, e passi al round dopo.\nSe lo manchi, la partita finisce. Il tuo punteggio è il round a cui sei arrivato: si gioca per resistere più round possibile.' },

    { tipo: 'leggi', intento: 'Capire cosa si può fare nel round: tre giocate di combinazioni a punti fissi, tre scarti.',
      vede: 'Stessa schermata: 8 carte, 3 gettoni di giocate, 3 gettoni di scarti.',
      pezzi: [{ riga: 0, accendi: ['mano'] }, { riga: 1, accendi: ['giocate'] }, { riga: 2, accendi: ['scarti'] }],
      titolo: 'Cosa puoi fare', bozza: 'Hai 8 carte in mano.\nHai **3 giocate**: ogni volta scegli fino a 5 carte e fai una combinazione di poker. Ogni combinazione vale punti fissi (coppia 10, tris 30, full 60…) e il valore delle carte non conta: una coppia di 2 vale quanto una coppia di Assi.\nE hai **3 scarti**: butti le carte che non ti servono e ne peschi altre. Uno scarto non consuma una giocata.' },

    { tipo: 'tocca', intento: 'Fare il primo gesto: toccare due carte uguali.',
      vede: 'La vignetta indica il 7 di cuori, poi il 7 di picche.',
      pezzi: [{ riga: 0, accendi: ['carta:C7', 'carta:P7'] }],
      bozza: 'Guarda i due 7: una **coppia**. Toccali.', tocca: ['C7', 'P7'] },

    { tipo: 'leggi', intento: 'Capire il tasto: dice la combinazione e i punti di quello che hai scelto; dice il fatto, non cosa conviene.',
      vede: 'I due 7 alzati col bordo d\'oro; il tasto dice «Gioca: Coppia, 10 punti».',
      pezzi: [{ riga: 0, accendi: ['tasto:gioca'] }],
      titolo: 'Il tasto', bozza: 'Il tasto dice cosa fanno le carte che hai scelto: **Coppia, 10 punti**. Non ti dice se in mano c\'è di meglio: quello lo cerchi tu.' },

    { tipo: 'tocca', intento: 'Aggiungere una carta che non c\'entra, per vedere cosa succede.',
      vede: 'La vignetta indica il 3 di fiori.',
      pezzi: [{ riga: 0, accendi: ['carta:F3'] }],
      bozza: 'Ora tocca anche il 3 di fiori, che con i 7 non c\'entra niente.', tocca: ['F3'] },

    { tipo: 'leggi', intento: 'Capire che le carte giocate in più non danno punti ma escono dalla mano, e ne arrivano di nuove.',
      vede: 'Il 3 di fiori alzato ma segnato come carta che non conta (bordo tratteggiato); il tasto dice ancora «Coppia, 10 punti».',
      pezzi: [{ riga: 0, accendi: ['carta:F3', 'tasto:gioca'] }],
      titolo: 'Le carte in più', bozza: 'Sempre **Coppia, 10 punti**: il 3 ha il bordo tratteggiato perché non conta. Però se giochi esce anche lui, e al suo posto ne peschi una nuova: è un modo di cambiare carte senza spendere uno scarto.' },

    { tipo: 'tocca', intento: 'Imparare a togliere una scelta: si tocca di nuovo.',
      vede: 'La vignetta indica i due 7 e il 3, uno per volta.',
      pezzi: [{ riga: 0, accendi: ['carta:C7', 'carta:P7', 'carta:F3'] }],
      bozza: 'Prima di giocare, guardiamo il resto della mano. Togli le tre carte: toccale di nuovo.', tocca: ['C7', 'P7', 'F3'] },

    { tipo: 'leggi', intento: 'Il turno ragionato ad alta voce: coppia adesso (10) oppure uno scarto per cercare il colore (50), e cosa costa lo scarto.',
      vede: 'Nessuna carta scelta. I quattro quadri in mano.',
      pezzi: [{ riga: 0, accendi: ['carta:Q13', 'carta:Q9', 'carta:Q5', 'carta:Q2'] }, { riga: 1, accendi: ['traguardo', 'giocate'] }, { riga: 2, accendi: ['carta:F3', 'carta:P11', 'scarti'] }],
      titolo: 'Gioco o scarto?', bozza: 'Hai quattro carte di **quadri**. Con una quinta fai **Colore**, cinque carte dello stesso seme: 50 punti, cinque volte la coppia.\nTi servono 25 punti in 3 giocate. Con la coppia adesso fai 10; poi basterebbero un\'altra coppia e una giocata qualsiasi, perché anche senza combinazioni vale 5: si chiama **Carta alta**. E i punti oltre il traguardo si spendono nel **negozio**, dopo il round.\nProviamo il colore. Costa uno scarto su tre: butti il 3 di fiori e il Fante di picche, le due carte che non servono a niente. I 7 restano: se il quadri non arriva, hai ancora la coppia.' },

    { tipo: 'tocca', intento: 'Scegliere le due carte da scartare.',
      vede: 'La vignetta indica il 3 di fiori, poi il Fante di picche.',
      pezzi: [{ riga: 0, accendi: ['carta:F3', 'carta:P11'] }],
      bozza: 'Tocca il 3 di fiori e il Fante di picche.', tocca: ['F3', 'P11'] },

    { tipo: 'tasto', intento: 'Fare uno scarto: le carte escono, se ne pescano altrettante, un gettone di scarto si spegne.',
      vede: 'Le due carte alzate; il tasto Scarta dice «Scarta 2 carte».',
      pezzi: [{ riga: 0, accendi: ['tasto:scarta'] }],
      bozza: 'Ora **Scarta**: le due carte escono e ne peschi due.', mossa: { t: 'scarta', carte: ['F3', 'P11'] } },

    { tipo: 'leggi', intento: 'Vedere che lo scarto ha pagato: il quinto quadri è arrivato.',
      vede: 'In mano sono arrivati 10♦ e 7♣; i gettoni degli scarti sono 2.',
      pezzi: [{ riga: 0, accendi: ['carta:Q10', 'carta:F7'] }, { riga: 1, accendi: ['carta:Q13', 'carta:Q10', 'carta:Q9', 'carta:Q5', 'carta:Q2'] }],
      titolo: 'È arrivato', bozza: 'Sono arrivati il 10 di quadri e il 7 di fiori.\nCinque quadri: il **colore** c\'è.' },

    { tipo: 'tocca', intento: 'Scegliere le cinque carte del colore.',
      vede: 'La vignetta indica i cinque quadri, uno per volta.',
      pezzi: [{ riga: 0, accendi: ['carta:Q13', 'carta:Q10', 'carta:Q9', 'carta:Q5', 'carta:Q2'] }],
      bozza: 'Tocca i cinque quadri.', tocca: ['Q13', 'Q10', 'Q9', 'Q5', 'Q2'] },

    { tipo: 'tasto', intento: 'Giocare la prima combinazione e vedere i punti entrare nella cassa.',
      vede: 'I cinque quadri alzati; il tasto dice «Gioca: Colore, 50 punti».',
      pezzi: [{ riga: 0, accendi: ['tasto:gioca'] }],
      bozza: 'Il tasto dice **Colore, 50 punti**. Gioca.', mossa: { t: 'gioca', carte: ['Q13', 'Q10', 'Q9', 'Q5', 'Q2'] } },

    { tipo: 'leggi', intento: 'Capire che il traguardo è già passato ma conviene continuare: i punti in più si spendono.',
      vede: 'La cassa dice 50 su 25, piena; 2 giocate; cinque carte nuove in mano.',
      pezzi: [{ riga: 0, accendi: ['traguardo'] }, { riga: 1, accendi: ['mano'] }],
      titolo: '50 su 25', bozza: '50 su 25: il traguardo è già fatto, e hai ancora due giocate.\nLe giocate si fanno comunque tutte e tre, e ogni punto in più lo spendi nel negozio: vale la pena farne ancora. Intanto hai pescato cinque carte nuove.' },

    { tipo: 'trova', intento: 'La mossa la trova il giocatore: nella mano c\'è un full. Il tutorial non lo dice; aiuta solo se sbaglia.',
      vede: 'In mano: 7♥ 7♠ 7♣ Q♥ Q♣ 4♠ 9♣ 2♥. Nessuna vignetta sulle carte; la vignetta sul tasto compare solo quando il tasto dice 60.',
      pezzi: [{ riga: 0, accendi: ['mano'] }],
      bozza: 'Adesso la mossa la trovi tu. In questa mano c\'è una combinazione da **60 punti**. Tocca le carte e guarda cosa dice il tasto: quando dice 60, gioca.',
      attesa: 'full', aiuto: 'Con queste fai {nome}, {punti} punti. Si può fare di più: cerca una coppia da mettere insieme ai tre 7.',
      aiutoScarto: 'Non serve scartare: la combinazione da 60 è già in mano.' },

    { tipo: 'leggi', intento: 'Nominare quello che il giocatore ha trovato, e preparare l\'ultima giocata del round.',
      vede: 'La cassa dice 110 su 25; 1 giocata; in mano 4♠ 9♣ 2♥ 4♦ 8♣ 3♠ 6♥ J♦.',
      pezzi: [{ riga: 0, accendi: ['traguardo'] }, { riga: 1, accendi: ['carta:P4', 'carta:Q4', 'giocate'] }],
      titolo: 'Full, 60', bozza: '**Full**: tre 7 e due Donne, 60 punti. Sei a 110.\nResta l\'ultima giocata. C\'è una coppia di 4: altri 10 punti per il negozio.' },

    { tipo: 'tocca', intento: 'Scegliere la coppia.',
      vede: 'La vignetta indica il 4 di picche, poi il 4 di quadri.',
      pezzi: [{ riga: 0, accendi: ['carta:P4', 'carta:Q4'] }],
      bozza: 'Tocca i due 4.', tocca: ['P4', 'Q4'] },

    { tipo: 'tasto', intento: 'Fare la terza giocata e vedere che il round si chiude da solo.',
      vede: 'Il tasto dice «Gioca: Coppia, 10 punti».',
      pezzi: [{ riga: 0, accendi: ['tasto:gioca'] }],
      bozza: 'Gioca la coppia. È la terza giocata: dopo, il round si chiude da solo e si contano i punti.', mossa: { t: 'gioca', carte: ['P4', 'Q4'] } },

    { tipo: 'leggi', intento: 'Capire il negozio: i punti in più si spendono, un gettone per tipo, i gettoni restano e i punti no; si segna, si paga con un tasto.',
      vede: 'La schermata del negozio: «Round 1 superato, 120 su 25», 95 da spendere, i sei gettoni, in fondo il tasto «Round 2 · perdi i 95 punti rimasti».',
      pezzi: [{ riga: 0, accendi: ['spesa'] }, { riga: 1, accendi: ['articoli'] }, { riga: 2, accendi: ['bonus:giocata-extra', 'bonus:carta-extra'] }],
      titolo: 'Il negozio', bozza: 'Round 1 superato: 120 punti su 25. I **95 in più** li spendi qui.\nSei **bonus**, e non se ne possono avere due uguali. Quelli che compri restano tuoi finché non li usi, anche per più round; i punti che non spendi adesso, invece, si perdono.\nPrendiamo **Giocata extra**, 75: una giocata in più nel round che scegli tu. E **Carta extra**, 10: una carta in più in mano. Tocchi i bonus per segnarli; si paga alla fine, con un tasto solo.' },

    { tipo: 'segna', intento: 'Segnare un gettone: si tocca, e con un altro tocco si toglie.',
      vede: 'La vignetta indica Giocata extra.',
      pezzi: [{ riga: 0, accendi: ['bonus:giocata-extra'] }],
      bozza: 'Tocca **Giocata extra** per segnarlo. Se ci ripensi, lo tocchi di nuovo.', segna: ['giocata-extra'] },

    { tipo: 'segna', intento: 'Segnarne un secondo, e vedere che i punti da spendere scendono.',
      vede: 'Giocata extra segnato; 20 da spendere; il tasto dice «Compra Giocata extra, 75 punti»; la vignetta indica Carta extra.',
      pezzi: [{ riga: 0, accendi: ['bonus:carta-extra'] }],
      bozza: 'E **Carta extra**.', segna: ['carta-extra'] },

    { tipo: 'leggi', intento: 'Vedere che i punti non spesi si perdono, e conoscere di nome i due gettoni che salvano.',
      vede: '10 da spendere; nessun altro gettone a portata; il tasto dice «Compra 2 bonus, 85 punti · ne perdi 10 · Round 2».',
      pezzi: [{ riga: 0, accendi: ['spesa'] }, { riga: 1, accendi: ['bonus:scudo', 'bonus:punti-in-tasca'] }],
      titolo: 'Quello che resta', bozza: 'Restano 10 punti. L\'unico bonus da 10 è Carta extra, e l\'hai appena segnato: quei 10 vanno persi. Succede.\nQuando avrai più punti, guarda questi due: lo **Scudo** ti fa passare anche se manchi il traguardo, e i **Punti in tasca** aggiungono 25 punti al round in cui li usi.' },

    { tipo: 'tasto', intento: 'Pagare con un tasto solo e passare al round dopo.',
      vede: 'Il tasto «Compra 2 bonus, 85 punti · ne perdi 10 · Round 2» in fondo.',
      pezzi: [{ riga: 0, accendi: ['tasto:prossimo'] }],
      bozza: 'Il tasto in fondo dice quanto paghi e quanto perdi. Toccalo: compri i due bonus e passi al round 2, dove il traguardo sale a 50.', mossa: { t: 'negozio', compra: ['giocata-extra', 'carta-extra'] } },

    { tipo: 'leggi', intento: 'Il jolly, quando ne esce uno davvero: va da parte, vale la carta che serve, e il secondo li fa perdere tutti e due.',
      vede: 'Round 2, 0 su 50, 3 giocate; il posto del jolly è pieno, con la stella; 8 carte in mano.',
      pezzi: [{ riga: 0, accendi: ['jolly'] }, { riga: 1, accendi: ['jolly'] }],
      titolo: 'Il jolly', bozza: 'Hai pescato un **jolly**: va da parte, qui, e una carta nuova ha preso il suo posto.\nLo usi toccandolo insieme alle carte che giochi, anche in un round dopo: conta come una delle 5 e diventa da solo la carta che dà più punti. Ma se ne peschi un secondo mentre questo è qui, li perdi tutti e due: tenerlo a lungo è un rischio.' },

    { tipo: 'tasto', intento: 'Usare un gettone: si tocca, poi Usa.',
      vede: 'I due gettoni comprati, accanto al jolly; la vignetta indica Giocata extra, poi Usa.',
      pezzi: [{ riga: 0, accendi: ['gettoni'] }],
      bozza: 'I bonus comprati stanno qui. Usiamo subito **Giocata extra**: tocca il bonus, poi **Usa**. Così hai quattro giocate per arrivare a 50.', mossa: { t: 'usa', bonus: 'giocata-extra' } },

    { tipo: 'tasto', intento: 'Usare il secondo gettone.',
      vede: '4 giocate; la vignetta indica Carta extra, poi Usa.',
      pezzi: [{ riga: 0, accendi: ['bonus:carta-extra'] }],
      bozza: 'E **Carta extra**: la nona carta arriva alla prossima pescata.', mossa: { t: 'usa', bonus: 'carta-extra' } },

    { tipo: 'leggi', intento: 'Chiudere: da qui si continua da soli nella stessa partita; i rifiuti del gioco e «Come si gioca» insegnano il resto.',
      vede: 'Round 2, 0 su 50, 4 giocate, 3 scarti, jolly da parte, nessun gettone.',
      pezzi: [{ riga: 0, accendi: ['traguardo', 'giocate'] }, { riga: 1, accendi: ['tasto:Come si gioca'] }],
      titolo: 'Ora da solo', bozza: 'Round 2: 50 punti in 4 giocate, cioè più di una coppia a giocata. Hai 3 scarti e un jolly da parte. Da qui continui tu.\nQuando una mossa non si può fare, il gioco te lo dice e ti spiega perché. Le regole stanno sempre sotto **Come si gioca**.' }
  ];

  // LE REGOLETTE: «Come si gioca», una schermata sola. [icona, titolo, testo]. <i>x</i> evidenzia.
  var REGOLE = [
    ['scopo', 'Un traguardo che sale', 'Ogni round chiede un traguardo di punti: <i>25</i>, poi 50, 75, 100… Lo raggiungi e passi al round dopo; lo manchi e la partita finisce. Il punteggio è il round a cui arrivi.'],
    ['giocata', 'Tre giocate', 'Hai 8 carte. In ogni giocata scegli fino a <i>5 carte</i> e fai una combinazione di poker: vale punti fissi, il valore delle carte non conta. Le carte in più escono senza dare punti. Dopo ogni giocata la mano si riempie di nuovo; dopo la terza il round si chiude e si sommano i punti.'],
    ['scarto', 'Tre scarti', 'Butti da 1 a 5 carte e la mano si riempie di nuovo. Uno scarto <i>non consuma una giocata</i>.'],
    ['punti', 'Quanto vale', 'Carta alta 5 (una giocata senza combinazioni) · Coppia 10 · Doppia coppia 20 · Tris 30 · Scala 40 · Colore 50 · Full 60 · Poker 100 · Scala colore 125 · Scala reale 150.'],
    ['jolly', 'Il jolly', 'Se lo peschi va <i>da parte</i> e al suo posto peschi un\'altra carta. Lo aggiungi a una giocata quando vuoi, anche in un round dopo: conta come una delle 5 carte e diventa da solo quella che dà più punti. Se ne peschi un secondo mentre il primo è da parte, li perdi tutti e due.'],
    ['negozio', 'Il negozio', 'Fra un round e l\'altro, i punti oltre il traguardo si spendono in bonus, <i>uno per tipo</i>. Li usi quando vuoi durante un round, e dopo puoi ricomprarli. I bonus restano finché non li usi, i punti non spesi si perdono. Lo Scudo non si usa: scatta da solo quando manchi un traguardo.']
  ];

  root.SolatroCopione = { partita: PARTITA, passi: PASSI, regole: REGOLE };
  if (typeof module === 'object' && module.exports) module.exports = root.SolatroCopione;
}(typeof self !== 'undefined' ? self : this));
