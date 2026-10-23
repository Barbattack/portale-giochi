/*
 * THE EMISSARY — IL COPIONE DELLA PARTITA GUIDATA (Chiara, terzo giro, 24/10/2026).
 * Questo è il FILE DEI TESTI del tutorial e delle regolette: tutorial.js lo legge e non contiene nessun testo suo.
 * PENNA riscrive qui le `bozza` e le `regole` senza toccare il codice: le altre chiavi (intento, vede, concetti, mossa, scena) sono
 * il disegno del tutorial e il contratto col motore, e non si cambiano senza rifare la prova (prova/prova-copione.js).
 *
 * Com'è fatta la partita guidata. È una PARTITA VERA, sempre la stessa, dall'inizio: otto regni in un ordine deciso da noi, la mano
 * di 8 carte decisa da noi, il mazzo in un ordine deciso da noi. Il tutorial guida tutto il regno 4 (quattro vittorie esatte su sei
 * dibattiti); alla fine il giocatore continua LA STESSA partita da solo, con le 8 carte nuove già in mano, e il resto glielo
 * insegnano i rifiuti del gioco col loro perché.
 *
 * Ogni passo ha anche `pezzi`: i pezzetti in cui si racconta, ognuno con la riga della bozza da cui prende il testo e le cose da accendere
 * sul tavolo (portale-giochi/design/pezzi.js). Le parole non si duplicano: i pezzetti puntano alla bozza.
 * Ogni passo ha:
 *   tipo      'leggi' (un cartello da leggere, col tasto Avanti dentro) oppure 'gioca' (una cosa da toccare, indicata dalla vignetta)
 *   intento   cosa deve capire il giocatore in questo passo, in una riga
 *   vede      cosa c'è sullo schermo in quel momento
 *   concetti  le parole che il giocatore incontra qui per la prima volta (vanno spiegate qui, non date per note)
 *   titolo    (solo leggi) il titolo del cartello — BOZZA
 *   bozza     il testo — BOZZA, da riscrivere (Penna). Nelle fasi «leggi» le righe sono paragrafi; **x** evidenzia.
 *   mossa     (solo gioca) la mossa che il motore deve ricevere; `rifiuto: true` = il motore la deve rifiutare, `motivo` è un pezzo
 *             del suo messaggio (la prova lo controlla)
 */
(function (root) {
  'use strict';
  var PARTITA = {
    seme: 'tutorial',
    // i sovrani dei regni da 1 a 8 (Re e Donne); il regno 4 è la Donna di quadri: la briscola sarà quadri
    regni: ['C12', 'F12', 'P13', 'Q12', 'F13', 'Q13', 'C13', 'P12'],
    // la mano di partenza: 7♥ A♥ 2♠ 4♠ 6♣ 8♦ 5♦ 2♦ (tre briscole, un fiori solo, due picche basse)
    mano: ['C7', 'C1', 'P2', 'P4', 'F6', 'Q8', 'Q5', 'Q2'],
    // il mazzo, dalla cima: le prime sei sono le carte che il sovrano dirà nei sei dibattiti del regno 4, nell'ordine:
    //   3♥ (vinci col 7♥) · 6♠ (perdi col 4♠, dopo un rifiuto) · 3♣ (vinci col 6♣) · 4♣ (vinci col 2♦: briscola) · A♠ (vinci col 2♠) · 5♥ (perdi con l'A♥)
    // le altre 18 non escono nel regno 4: alla fine del regno si rimescola tutto.
    mazzo: ['C3', 'P6', 'F3', 'F4', 'P1', 'C5', 'C2', 'C4', 'C6', 'C8', 'Q1', 'Q3', 'Q4', 'Q6', 'Q7', 'F1', 'F2', 'F5', 'F7', 'F8', 'P3', 'P5', 'P7', 'P8']
  };

  var PASSI = [
    { tipo: 'leggi', intento: 'Capire come si vince e come si perde, prima di toccare qualsiasi cosa.',
      vede: 'La prima schermata di una partita vera: la corona con gli otto regni e i loro sovrani, 0 regni vinti, le 8 carte in mano.',
      pezzi: [{ riga: 0, accendi: ['regni'] }, { riga: 1, accendi: ['regni'] }, { riga: 2, accendi: ['conti'] }, { riga: 3, accendi: [] }],
      concetti: ['regno', 'sovrano', 'dibattito', 'numero esatto'],
      titolo: 'Lo scopo', bozza: 'Sei un inviato in visita a otto regni: sono qui sotto, numerati da 1 a 8. Ognuno ha il suo **sovrano**, un Re (K) o una Donna (Q).\nIn ogni regno sfidi il sovrano a carte, una volta dopo l\'altra. Ogni sfida si chiama **dibattito**.\nIl numero del regno è quanti dibattiti devi vincere lì: **esattamente** quel numero, né uno di più né uno di meno.\nSe in un regno sbagli il conto, la partita è persa. Se lo fai giusto in tutti e otto, hai vinto.' },

    { tipo: 'leggi', intento: 'Capire cosa si fa adesso: scegliere un regno, sapendo che le carte in mano sono i dibattiti da giocare.',
      vede: 'Stessa schermata: le 8 carte in mano, i regni da 1 a 8 nella corona.',
      pezzi: [{ riga: 0, accendi: ['mano'] }, { riga: 1, accendi: ['regni'] }, { riga: 2, accendi: ['regno:4'] }],
      concetti: ['mano = dibattiti', 'briscola (il seme del sovrano)'],
      titolo: 'Scegliere il regno', bozza: 'Il regno lo scegli tu, guardando le carte che hai in mano. Ogni carta in mano è un dibattito da giocare: adesso ne hai 8, quindi **8 dibattiti**.\nIl seme del sovrano è la **briscola** del suo regno, il seme più forte. Come funziona lo vedi fra poco.\nAndiamo nel regno 4. Il sovrano è la Donna di quadri: la briscola è quadri, e devi vincere 4 dibattiti.' },

    { tipo: 'gioca', intento: 'Fare la prima mossa: toccare il regno e confermare.',
      vede: 'La vignetta indica il regno 4 nella corona; poi Conferma, in basso.',
      pezzi: [{ riga: 0, accendi: ['regno:4'] }],
      concetti: ['Conferma: ogni mossa si sceglie e poi si conferma'],
      bozza: 'Tocca il regno 4, poi Conferma. Anche le carte si giocano così: un tocco, poi la conferma.', mossa: { t: 'regno', n: 4 } },

    { tipo: 'leggi', intento: 'Capire come funziona un dibattito: il sovrano gioca per primo, tu rispondi, chi ha la carta più alta vince.',
      vede: 'Il regno 4 è acceso d\'oro nella corona; la fascia dice «Regno 4 · briscola ♦ quadri», 0 / 4; le 8 carte in mano.',
      pezzi: [{ riga: 0, accendi: ['sovrano', 'mano'] }, { riga: 1, accendi: ['mano'] }, { riga: 2, accendi: ['pila:Vittorie', 'pila:Scarti'] }],
      concetti: ['il sovrano parla (gioca una carta)', 'rispondere nel seme', 'vittorie e scarti'],
      titolo: 'Il dibattito', bozza: 'Il sovrano gioca per primo una carta, e tu rispondi con una delle tue.\nSe hai carte **dello stesso seme** della sua, devi rispondere con una di quelle. Vince la carta più alta. L\'Asso vale 1: è la più bassa.\nSe vinci, la tua carta va fra le **vittorie**: sono quelle che contano, e alla fine del regno devono essere 4. Se perdi, va fra gli **scarti**. In tutti e due i casi non torna in mano.' },

    { tipo: 'gioca', intento: 'Aprire il primo dibattito: far parlare il sovrano.',
      vede: 'Il tasto «Apri il dibattito» in basso, indicato dalla vignetta.',
      pezzi: [{ riga: 0, accendi: ['pila:Mazzo'] }],
      concetti: ['aprire il dibattito'],
      bozza: 'Tocca «Apri il dibattito»: il sovrano gioca la sua carta.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Rispondere nel seme con una carta più alta, e vincere.',
      vede: 'Il sovrano ha detto 3 di cuori. In mano hai due cuori: 7 e Asso.',
      pezzi: [{ riga: 0, accendi: ['carta:C3', 'carta:C7', 'carta:C1'] }],
      concetti: [],
      bozza: 'Il sovrano ha giocato il 3 di cuori. Tu hai due cuori, quindi devi usare uno di quelli: il 7 è più alto e vince.', mossa: { t: 'gioca', carta: 'C7' } },

    { tipo: 'gioca', intento: 'Aprire il secondo dibattito.',
      vede: 'Vittorie 1 / 4; 7 carte in mano.',
      pezzi: [{ riga: 0, accendi: ['pila:Vittorie'] }],
      concetti: [],
      bozza: 'Il tuo 7 è andato fra le vittorie: una su quattro. Apri il secondo dibattito.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Scoprire sulla propria pelle che si deve rispondere nel seme: il gioco rifiuta la mossa e dice perché.',
      vede: 'Il sovrano ha detto 6 di picche. In mano hai il 2 e il 4 di picche, e l\'8 di quadri (briscola).',
      pezzi: [{ riga: 0, accendi: ['carta:P6', 'carta:Q8'] }],
      concetti: ['il rifiuto: quando una mossa non si può, il gioco lo dice'],
      bozza: 'Il sovrano ha giocato il 6 di picche. Prova a rispondere con l\'8 di quadri, la tua briscola più alta: vediamo se si può.', mossa: { t: 'gioca', carta: 'Q8' }, rifiuto: true, motivo: 'nel seme' },

    { tipo: 'gioca', intento: 'Perdere un dibattito di proposito, e capire che perdere fa parte del piano: servono 4 vittorie esatte.',
      vede: 'Il messaggio del rifiuto («Devi rispondere nel seme…»); il 6 di picche del sovrano; i tuoi 2 e 4 di picche.',
      pezzi: [{ riga: 0, accendi: ['carta:P2', 'carta:P4'] }],
      concetti: ['perdere va bene'],
      bozza: 'Hai ancora carte di picche, quindi devi rispondere con una di quelle. Col 4 perdi, e va bene così: ti servono 4 vittorie, non 8.', mossa: { t: 'gioca', carta: 'P4' } },

    { tipo: 'gioca', intento: 'Aprire il terzo dibattito.',
      vede: 'Vittorie 1 / 4; 6 carte in mano.',
      pezzi: [{ riga: 0, accendi: ['conti'] }],
      concetti: [],
      bozza: 'Una vinta, una persa. Apri il terzo dibattito.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Rispondere nel seme e vincere, da solo: la regola è già nota.',
      vede: 'Il sovrano ha detto 3 di fiori. In mano hai il 6 di fiori.',
      pezzi: [{ riga: 0, accendi: ['carta:F3', 'carta:F6'] }],
      concetti: [],
      bozza: 'Il 3 di fiori: questa la sai già. Il tuo 6 di fiori è più alto, rispondi e vinci.', mossa: { t: 'gioca', carta: 'F6' } },

    { tipo: 'leggi', intento: 'Capire la briscola: quando non puoi rispondere nel seme, una briscola vince contro qualsiasi carta non di briscola.',
      vede: 'Vittorie 2 / 4; 5 carte in mano: A♥, 2♠, 8♦, 5♦, 2♦. Nessun fiori.',
      pezzi: [{ riga: 0, accendi: ['mano'] }, { riga: 1, accendi: ['carta:Q8', 'carta:Q5', 'carta:Q2'] }, { riga: 2, accendi: ['carta:C1', 'carta:P2'] }],
      concetti: ['la briscola batte le altre carte', 'quando non hai il seme giochi quello che vuoi'],
      titolo: 'La briscola', bozza: 'Se il sovrano gioca un seme che **non hai**, puoi rispondere con la carta che vuoi.\nCon una **briscola** (qui, quadri) vinci, anche se è bassa: la briscola batte qualunque carta di un altro seme.\nCon una carta di un altro seme, invece, perdi.' },

    { tipo: 'gioca', intento: 'Aprire il quarto dibattito.',
      vede: 'Il tasto «Apri il dibattito».',
      pezzi: [{ riga: 0, accendi: ['conti'] }],
      concetti: [],
      bozza: 'Due vittorie, ne mancano due. Apri il quarto dibattito.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Vincere con una briscola bassa, perché non si ha il seme.',
      vede: 'Il sovrano ha detto 4 di fiori. Non hai più fiori. Hai tre quadri: 8, 5, 2.',
      pezzi: [{ riga: 0, accendi: ['carta:F4', 'carta:Q2'] }],
      concetti: [],
      bozza: 'Il 4 di fiori, e tu fiori non ne hai più. Rispondi col 2 di quadri: è una briscola, quindi vince.', mossa: { t: 'gioca', carta: 'Q2' } },

    { tipo: 'leggi', intento: 'Conoscere i consiglieri PRIMA di usarli: chi sono, quando si usano, cosa fanno, e perché servono adesso (troppe carte forti in mano).',
      vede: 'Vittorie 3 / 4; 4 carte in mano: A♥, 2♠, 8♦, 5♦. Sotto la mano, i quattro Fanti.',
      pezzi: [{ riga: 0, accendi: ['conti', 'carta:Q8', 'carta:Q5'] }, { riga: 1, accendi: ['fanti'] }, { riga: 2, accendi: ['fanti'] }, { riga: 3, accendi: ['fante:C'] }],
      concetti: ['consiglieri = i quattro Fanti', 'si usano fra un dibattito e l\'altro', 'una volta per regno', 'i quattro poteri'],
      titolo: 'I consiglieri', bozza: 'Hai 3 vittorie e te ne serve **una sola**. Ma hai ancora 4 carte, cioè 4 dibattiti da giocare, e due sono briscole: l\'8 e il 5 di quadri. Rischi di vincere troppo.\nPer aggiustare il conto hai i **consiglieri**: i quattro Fanti sotto la tua mano. Si usano prima di aprire un dibattito, ognuno **una volta per regno**.\n**Cuori**: scarti tutte le briscole che hai in mano. **Fiori**: peschi una carta per ogni fiori che hai. **Picche**: scambi questo sovrano con quello di un regno non ancora visitato, e la briscola cambia. **Quadri**: peschi 2 carte e ne scarti 2.\nAdesso ti serve il Fante di cuori.' },

    { tipo: 'gioca', intento: 'Usare un consigliere: toccarlo e confermare, e vedere che le briscole spariscono dalla mano.',
      vede: 'La vignetta indica il Fante di cuori, sotto la mano; poi Conferma.',
      pezzi: [{ riga: 0, accendi: ['fante:C'] }],
      concetti: [],
      bozza: 'Tocca il Fante di cuori, poi Conferma: l\'8 e il 5 di quadri finiscono negli scarti.', mossa: { t: 'fante', seme: 'C' } },

    { tipo: 'gioca', intento: 'Aprire il quinto dibattito.',
      vede: 'In mano: A♥ e 2♠. Il Fante di cuori è segnato come usato.',
      pezzi: [{ riga: 0, accendi: ['mano'] }],
      concetti: [],
      bozza: 'Ti restano 2 carte, quindi 2 dibattiti: uno da vincere e uno da perdere. Apri il quinto dibattito.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Vincere la quarta: il 2 batte l\'Asso, perché l\'Asso è la carta più bassa.',
      vede: 'Il sovrano ha detto Asso di picche. In mano: 2♠ e A♥.',
      pezzi: [{ riga: 0, accendi: ['carta:P1', 'carta:P2'] }],
      concetti: ['l\'Asso vale 1'],
      bozza: 'L\'Asso di picche, che vale 1: il tuo 2 di picche lo batte. Rispondi, e arrivi a 4 vittorie.', mossa: { t: 'gioca', carta: 'P2' } },

    { tipo: 'gioca', intento: 'Capire che il regno finisce quando la mano è vuota, non quando si è raggiunto il numero.',
      vede: 'Vittorie 4 / 4 (il numero è d\'oro); 1 carta in mano.',
      pezzi: [{ riga: 0, accendi: ['conti', 'mano'] }],
      concetti: ['il regno finisce a mano vuota'],
      bozza: 'Hai 4 vittorie, il numero giusto. Ma hai ancora una carta, e il regno finisce solo quando le hai giocate tutte. Apri l\'ultimo dibattito: questo devi perderlo.', mossa: { t: 'apri' } },

    { tipo: 'gioca', intento: 'Perdere l\'ultimo dibattito e chiudere il regno col numero esatto.',
      vede: 'Il sovrano ha detto 5 di cuori. In mano: A♥.',
      pezzi: [{ riga: 0, accendi: ['carta:C5', 'carta:C1'] }],
      concetti: [],
      bozza: 'Il 5 di cuori. Rispondi col tuo Asso di cuori, che vale 1, e perdi. Le vittorie restano 4, esatte: il regno è tuo.', mossa: { t: 'gioca', carta: 'P_FINE' } },

    { tipo: 'leggi', intento: 'Capire cosa si è guadagnato (un alleato) e che da qui si continua da soli, nella stessa partita: il resto lo insegna il gioco.',
      vede: 'Il regno 4 è spento con il ✓; la Donna di quadri è fra gli alleati; 8 carte nuove in mano; «Regni vinti 1 / 8».',
      pezzi: [{ riga: 0, accendi: ['alleati'] }, { riga: 1, accendi: ['mano', 'fanti'] }, { riga: 2, accendi: ['regni'] }],
      concetti: ['alleato', 'il potere di un alleato vale una volta sola in tutta la partita', 'quando una mossa non si può, il gioco dice perché'],
      titolo: 'Il primo regno è tuo', bozza: 'Hai chiuso il regno col numero giusto, e la Donna di quadri è diventata tua **alleata**: la trovi fra gli alleati, sotto i Fanti. Fa la stessa cosa del Fante di quadri, ma la puoi usare **una volta sola in tutta la partita**.\nLe carte sono state rimescolate: hai 8 carte nuove, e i Fanti sono di nuovo tutti disponibili.\nOra continui da solo, in questa stessa partita: scegli il prossimo regno. Se provi una mossa che non si può fare, il gioco te lo dice e ti spiega perché.' }
  ];
  // la carta dell'ultimo dibattito: l'Asso di cuori (sistemato qui perché la mano a quel punto ha solo quella)
  PASSI[19].mossa.carta = 'C1';

  // LE REGOLETTE: «Come si gioca», una schermata sola. [icona, titolo, testo] — BOZZA, da riscrivere (Penna). <i>x</i> evidenzia.
  // Testi del tutorial e delle regolette riscritti da Penna il 23/10/2026 (owner: `design/2026-10-23-testi-tutorial.md`), portati qui da Alfred.
  var REGOLE = [
    ['scopo', 'Otto regni, un numero esatto', 'In ogni regno sfidi il sovrano a carte, e ogni sfida è un dibattito: il numero del regno, da 1 a 8, è quanti dibattiti devi vincere lì, <i>esattamente</i>. Se in un regno sbagli il conto la partita è persa; se lo fai giusto in tutti e otto, hai vinto.'],
    ['presa', 'Il dibattito', 'Giochi un dibattito per ogni carta che hai in mano. Il sovrano gioca una carta e tu rispondi: se hai carte <i>del suo seme</i> devi usare una di quelle, e vince la più alta (l\'Asso vale 1).'],
    ['vinci', 'La briscola', 'Il seme del sovrano è la briscola del suo regno. Se non hai il seme della carta che ha giocato, rispondi con quella che vuoi: con una <i>briscola</i> vinci, con un altro seme perdi.'],
    ['fanti', 'I Fanti, i tuoi consiglieri', 'Servono ad aggiustare il conto: si usano prima di aprire un dibattito, ognuno <i>una volta per regno</i>. ♥ scarti tutte le briscole che hai in mano · ♣ peschi una carta per ogni fiori che hai · ♠ scambi il sovrano con quello di un regno non ancora visitato, e cambia la briscola di tutti e due · ♦ peschi 2 carte e ne scarti 2.'],
    ['alleato', 'Regno vinto: il sovrano è tuo alleato', 'Fa la stessa cosa del Fante del suo seme, ma lo usi <i>una volta sola</i> in tutta la partita. Poi mazzo, vittorie e scarti si rimescolano, i Fanti tornano disponibili, peschi 8 carte e scegli il prossimo regno.'],
    ['fine', 'I punti', 'Che tu vinca o perda, fai un punto per ogni regno vinto e uno per ogni alleato che non hai usato: al massimo 16. Se il mazzo finisce durante un regno, si rimescolano gli scarti.']
  ];

  root.EmissaryCopione = { partita: PARTITA, passi: PASSI, regole: REGOLE };
  if (typeof module === 'object' && module.exports) module.exports = root.EmissaryCopione;
}(typeof self !== 'undefined' ? self : this));
