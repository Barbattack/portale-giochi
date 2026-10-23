/*
 * THE FIRST BOBA TEA SHOP IN LONDON — IL COPIONE DELLA PARTITA GUIDATA, costruito sulla spina (Chiara, 23/10/2026, notte).
 * Spina: boba-tea/design/2026-10-23-spina-tutorial.md (approvata da Damiano: «sì, si capisce molto bene»). Le bozze la seguono parola per
 * parola dove si può. Questo è il FILE DEI TESTI: tutorial.js lo legge e non contiene nessun testo suo. PENNA riscrive `bozza`, `regole`
 * e `aiuti`; intento, vede, concetti, modo, pezzi e mossa sono il disegno e il contratto col motore (prova/prova-copione.js).
 *
 * LA PARTITA. È una partita vera del motore, `nuova('tut-311')`, sempre la stessa, dall'inizio. L'ho cercata col motore
 * (prova/cerca-stesura.js, 6.000 semi) perché avesse questa forma:
 *   - in partenza quattro clienti: 5♦ · 7♣ · 10♦ · R♠. C'è un Re e nessun Asso, così «davanti al Re ci sta un numero solo» e «dietro al Re
 *     tredici» sono il posto più stretto e il più largo di tutti gli otto, senza pari merito: il primo turno si ragiona ad alta voce con
 *     le parole della spina, e il cliente che arriva (un Asso) entra per forza;
 *   - nel secondo e nel terzo turno il posto con più spazio è UNO SOLO (fra l'Asso e il Re, 13; poi dietro al 10, 10): lo trova il
 *     giocatore, il tutorial non lo dice e aiuta solo se sbaglia. E dopo il secondo turno sul tavolo c'è proprio la frase della spina:
 *     fra l'Asso e l'8 ci stanno otto numeri;
 *   - il quarto turno porta il primo maleducato (un 5 fra l'8 e il Re) in una coda da tre: lo si caccia (via lui e il 5 che veniva dopo:
 *     la seconda fila degli scarti si vede), e il 9 che arriva entra;
 *   - il quinto porta il secondo maleducato (una Donna dietro al 7) in una coda da uno: lo si lascia stare, e lui comincia la coda nuova;
 *   - da lì, conoscendo l'ordine del mazzo, si può ancora vincere.
 *
 * Ogni passo ha `pezzi`: i pezzetti in cui si racconta, ognuno con la riga (e le frasi) della bozza da cui prende il testo e le cose da
 * accendere sul tavolo (portale-giochi/design/pezzi.js). Le chiavi le traduce `risolvi` in tutorial.js: bancone, code, coda:N, carte,
 * spazi, spazio:N:P (coda N, posto P: 0 = dietro al più basso), carta:ID, mano, mazzo, scarti, fila:K, tasto:testo.
 * Ogni passo: tipo ('leggi' | 'gioca'); modo (solo gioca: 'guidato' = la vignetta indica ogni tocco; 'trova' = la vignetta non indica né la
 * coda né il posto, il giocatore li trova, e gli aiuti arrivano solo se sbaglia); intento; vede; concetti; titolo (leggi); bozza; mossa.
 * Code e posti: code 1-4 come sullo schermo (nel motore 0-3); posto 0 = dietro al cliente più basso, n = davanti al più alto.
 */
(function (root) {
  'use strict';
  var pesca = function (coda, pos) { return { t: 'pesca', coda: coda - 1, pos: pos }; };
  var PARTITA = { seme: 'tut-311' };
  // La stesura che il seme produce (per chi legge; la prova lo verifica): code 5♦ · 7♣ · 10♦ · R♠; mazzo dalla cima A♠ 8♣ 6♣ 5♠ 5♥ 9♠ D♦ …

  var PASSI = [
    { tipo: 'leggi', intento: 'La storia: dove sei, le quattro code, la regola dell\'ordine in fila.',
      vede: 'Il tavolo di una partita vera all\'inizio: il bancone, quattro code con un cliente ciascuna (5♦, 7♣, 10♦, R♠), i numeri dello spazio sui posti, il mazzo, gli scarti vuoti.',
      pezzi: [{ riga: 0, frasi: [0, 1], accendi: ['bancone', 'code'] }, { riga: 1, frasi: [0], accendi: ['carte', 'bancone'] }, { riga: 1, frasi: [1], accendi: [] }],
      concetti: ['il chiosco e le quattro code', 'in ogni coda dal numero più basso in fondo al più alto davanti', 'due clienti uguali possono stare vicini'],
      titolo: 'Il chiosco', bozza: 'Londra, 2050: hai aperto il primo chiosco di **bubble tea** della città, e la novità piace così tanto che davanti al bancone si formano **quattro code**. Ogni carta è un cliente.\nGli inglesi adorano le code, ma in fila vogliono ordine: in ogni coda i clienti stanno dal **numero più basso, in fondo**, al **più alto, davanti**, verso il bancone. Due clienti con lo stesso numero possono stare vicini.' },

    { tipo: 'leggi', intento: 'Il turno (prima il posto, poi il cliente), e come si vince e come si perde.',
      vede: 'Stesso tavolo.',
      pezzi: [{ riga: 0, accendi: ['spazi'] }, { riga: 1, accendi: ['mazzo'] }, { riga: 2, accendi: ['mazzo', 'scarti'] }],
      concetti: ['prima scegli il posto, poi peschi', 'i posti: davanti al più alto, dietro al più basso, fra due vicini', 'si vince finendo il mazzo, il punteggio sono i clienti in coda', 'si perde al quarto cliente andato via con lo stesso numero'],
      titolo: 'Il turno', bozza: 'A ogni turno **prima scegli il posto**, poi vedi chi arriva. I posti sono le righe accese: davanti al cliente più alto, dietro al più basso, o fra due clienti vicini.\nSolo dopo peschi la prima carta del mazzo: è il cliente che arriva. Se il suo numero sta bene in quel posto, entra in coda; se no sono guai, e li vediamo fra poco.\nVinci se finisci il mazzo, e il punteggio sono i clienti rimasti in coda. Perdi appena se ne vanno **quattro clienti con lo stesso numero**: chi se ne va finisce negli scarti.' },

    { tipo: 'gioca', modo: 'guidato', intento: 'Il primo turno ragionato ad alta voce sugli spazi, con le parole della spina: davanti al Re uno solo, dietro al Re tredici.',
      vede: 'Su ogni posto il numero di clienti diversi che ci starebbero. La vignetta indica Coda 4, poi il posto dietro al Re, poi Conferma e pesca.',
      pezzi: [{ riga: 0, accendi: ['spazi'] }, { riga: 1, accendi: ['spazio:4:1'] }, { riga: 2, accendi: ['spazio:4:0'] }, { riga: 3, frasi: [0], accendi: ['spazi'] }, { riga: 3, frasi: [1], accendi: ['spazio:4:0'] }],
      concetti: ['lo spazio di un posto: quanti numeri ci starebbero', 'più spazio, più probabilità', 'Conferma e pesca'],
      bozza: 'Ragioniamo insieme: **dove c\'è più spazio?** Il numero scritto su ogni posto dice quanti numeri ci starebbero.\nDavanti al Re (K) ce ne sta uno solo, un altro Re: più in alto del Re non c\'è niente.\nDietro al Re ce ne stanno tredici, tutti i numeri dall\'Asso al Re: qualunque cliente arrivi, ci sta.\nPiù spazio vuol dire più probabilità che il prossimo cliente vada bene. Scegliamo dietro al Re: tocca Coda 4, poi il posto col 13, poi Conferma e pesca.',
      mossa: pesca(4, 0) },

    { tipo: 'gioca', modo: 'trova', intento: 'Il posto lo trova il giocatore: il posto con più spazio è uno solo (fra l\'Asso e il Re, tredici). Il tutorial non lo dice; aiuta solo se sbaglia.',
      vede: 'Coda 4: A♠ sotto, R♠ sopra. Nessuna vignetta sulle code né sui posti; solo su Conferma e pesca, quando tocca.',
      pezzi: [{ riga: 0, frasi: [0], accendi: ['carta:P1'] }, { riga: 0, frasi: [1, 2], accendi: ['spazi'] }],
      concetti: ['il ragionamento a ogni turno: confrontare gli spazi'],
      bozza: 'È arrivato un Asso, il numero più basso, ed è entrato dietro al Re. Adesso scegli tu: dove c\'è **più spazio**? Confronta i numeri sui posti di tutte le code: il più grande è uno solo.',
      mossa: pesca(4, 1) },

    { tipo: 'gioca', modo: 'trova', intento: 'Ancora il giocatore. Sul tavolo c\'è la frase della spina (fra l\'Asso e l\'8 otto numeri), ma il posto più largo è un altro (dietro al 10, dieci): lo trova lui.',
      vede: 'Coda 4: A♠ 8♣ R♠. Nessuna vignetta sulle code né sui posti.',
      pezzi: [{ riga: 0, accendi: ['spazio:4:1', 'spazio:4:2'] }, { riga: 1, accendi: ['spazi'] }],
      concetti: [],
      bozza: 'Fra l\'Asso e il Re è arrivato un 8: adesso fra l\'Asso e l\'8 ci stanno otto numeri, e fra l\'8 e il Re sei.\nOtto è tanto, ma c\'è un posto con ancora più spazio: guarda tutte le code e trovalo.',
      mossa: pesca(3, 0) },

    { tipo: 'gioca', modo: 'guidato', intento: 'Si prova apposta un posto più stretto, per far arrivare il maleducato.',
      vede: 'Coda 3: 6♣ 10♦. La vignetta indica Coda 4, il posto fra l\'8 e il Re, Conferma e pesca.',
      pezzi: [{ riga: 0, accendi: ['carta:F6'] }, { riga: 1, accendi: ['spazio:4:2'] }, { riga: 2, accendi: ['spazio:4:2'] }],
      concetti: [],
      bozza: 'È arrivato un 6 ed è entrato dietro al 10. Finora abbiamo scelto sempre il posto più largo, e ogni cliente è entrato.\nStavolta proviamo apposta un posto più stretto, per vedere cosa succede quando arriva qualcuno che non ci sta: fra l\'8 e il Re, dove ci stanno solo sei numeri.\nTocca Coda 4, poi il posto fra l\'8 e il Re, poi Conferma e pesca.',
      mossa: pesca(4, 2) },

    { tipo: 'gioca', modo: 'guidato', intento: 'Il maleducato: le due scelte e quanto costano, coi numeri di questa coda (tre contro due); si caccia.',
      vede: 'In mano il 5♠, segnato sul posto fra l\'8 e il Re. In basso i due tasti: Resta (la coda se ne va: 3 clienti) e Caccialo (lui e il prossimo: 2 clienti). La vignetta indica Caccialo.',
      pezzi: [{ riga: 0, accendi: ['mano'] }, { riga: 1, accendi: ['coda:4', 'tasto:Resta'] }, { riga: 2, accendi: ['tasto:Caccialo', 'mazzo'] }, { riga: 3, accendi: ['tasto:Caccialo'] }],
      concetti: ['il maleducato', 'lasciarlo stare: tutta la coda se ne va, lui comincia una coda nuova', 'cacciarlo: via lui e il cliente dopo, il successivo prova lo stesso posto'],
      bozza: 'È arrivato un 5, e fra l\'8 e il Re non ci sta: è un **maleducato** che salta la fila.\nHai due scelte. Con **Resta** lo lasci stare: tutta la coda se ne va indignata, e lui ne comincia una nuova da solo. Qui perderesti tre clienti.\nCon **Caccialo** chiami un vigile, che porta via lui e anche il prossimo cliente del mazzo: perdi due clienti. Poi ne arriva un altro, che prova lo stesso posto.\nTre clienti contro due: conviene cacciarlo. Tocca Caccialo.',
      mossa: { t: 'caccia' } },

    { tipo: 'gioca', modo: 'guidato', intento: 'Gli scarti su tre file e la bomba, visti sul tavolo (il 5 è già nella seconda fila); poi un posto in una coda corta, per il secondo maleducato.',
      vede: 'Coda 4: A♠ 8♣ 9♠ R♠. Scarti: 5♠ nella prima fila, 5♥ nella seconda. La vignetta indica Coda 2, il posto dietro al 7, Conferma e pesca.',
      pezzi: [{ riga: 0, frasi: [0], accendi: ['carta:P9'] }, { riga: 0, frasi: [1], accendi: ['scarti'] }, { riga: 1, accendi: ['fila:2', 'fila:3'] }, { riga: 2, accendi: ['spazio:2:0'] }],
      concetti: ['gli scarti si vedono, su tre file', 'la terza fila è la bomba'],
      bozza: 'Il vigile ha portato via il 5 e il cliente dopo, un altro 5; poi è arrivato un 9, ed è entrato fra l\'8 e il Re. Gli **scarti** stanno su tre file: il primo 5 nella prima, il secondo nella seconda.\nUn terzo 5 finirebbe nella terza fila, quella rossa, e lì sarebbe una **bomba**: al quarto 5 hai perso.\nAdesso proviamo apposta un posto in una coda con un cliente solo, dietro al 7: non è il più largo, ma se va male c\'è poco da perdere. Tocca Coda 2, poi il posto dietro al 7, poi Conferma e pesca.',
      mossa: pesca(2, 0) },

    { tipo: 'gioca', modo: 'guidato', intento: 'Il secondo maleducato, in una coda da un cliente: qui lasciarlo stare costa meno; si lascia stare.',
      vede: 'In mano la D♦, segnata dietro al 7♣. I due tasti con i costi: Resta (1 cliente), Caccialo (2 clienti). La vignetta indica Resta.',
      pezzi: [{ riga: 0, accendi: ['mano'] }, { riga: 1, frasi: [0], accendi: ['coda:2', 'tasto:Resta', 'tasto:Caccialo'] }, { riga: 1, frasi: [1], accendi: ['tasto:Resta'] }],
      concetti: ['quanto costa dipende dalla coda'],
      bozza: 'È arrivata una Donna (Q), e dietro al 7 non ci sta: un altro maleducato.\nPrima lasciarlo stare costava tre clienti; qui la coda ha un cliente solo, e costa uno, mentre cacciarlo ne costa due. Allora lo lasciamo stare: tocca Resta.',
      mossa: { t: 'resta' } },

    { tipo: 'leggi', intento: 'Il ragionamento in due domande, e da qui si continua da soli nella stessa partita.',
      vede: 'Il tavolo dopo cinque turni: Coda 1 5♦ · Coda 2 D♦ · Coda 3 6♣ 10♦ · Coda 4 A♠ 8♣ 9♠ R♠. Scarti: 5♠ 7♣ nella prima fila, 5♥ nella seconda. Mazzo: 41.',
      pezzi: [{ riga: 0, accendi: ['spazi'] }, { riga: 1, accendi: ['scarti'] }, { riga: 2, accendi: ['mazzo'] }],
      concetti: ['le due domande di ogni turno', 'continuare da soli', 'il mazzo si può guardare'],
      titolo: 'Ora tocca a te', bozza: 'A ogni turno, prima di scegliere, ti fai due domande. La prima: **dove c\'è più spazio?** Te lo dicono i numeri sui posti.\nLa seconda: **quanto mi costa se va male?** Lasciare stare un maleducato costa tutta la coda, cacciarlo due clienti. E se nella coda c\'è un numero già nella terza fila degli scarti, perdere la coda vuol dire perdere la partita.\nDa qui continui da solo, in questa stessa partita: scegli il posto con tanto spazio e un prezzo che puoi pagare. Prima di pescare puoi toccare il mazzo per vedere chi manca, non in che ordine arriva. Vinci se lo finisci.' }
  ];

  // GLI AIUTI dei turni «trova»: arrivano solo se il giocatore sbaglia, e lo riportano al ragionamento senza dirgli la risposta. BOZZA.
  var AIUTI = {
    coda: 'Non ancora. Cerca il numero più grande sui posti, in tutte e quattro le code, e tocca la sua coda.',
    posto: 'Guarda i numeri sui posti di questa coda, e tocca quello più grande.',
    // il messaggio del maleducato, coi numeri veri (in partita e nel tutorial): {carta} il cliente con l'articolo (Il 5♠, La D♦, L'A♥), {a} e {b} i numeri che stavano in quel posto
    nonSta: '{carta} salta la fila: qui ci stanno solo i numeri da {a} a {b}. Resta o Caccialo?',
    nonStaUno: '{carta} salta la fila: qui ci sta solo un altro {a}. Resta o Caccialo?',
    // le due righe piccole sotto i tasti: {n} i clienti della coda, {m} quanti se ne vanno cacciando (2, o 1 col mazzo vuoto)
    costoResta: 'la coda se ne va: {n}', costoCaccia: 'via lui e il prossimo: {m}', costoCacciaUno: 'via solo lui: 1'
  };

  // LE REGOLETTE: «Come si gioca», una schermata sola. [icona, titolo, testo] — BOZZA (Penna). <i>x</i> evidenzia.
  var REGOLE = [
    ['code', 'Quattro code', 'Davanti al tuo chiosco di bubble tea quattro code, e ogni carta è un cliente. In ogni coda si sta dal <i>più basso in fondo</i> al <i>più alto davanti</i>, dall\'Asso al Re (K); due uguali possono stare vicini.'],
    ['turno', 'Prima il posto, poi il cliente', 'Scegli una coda e un posto: davanti al più alto, dietro al più basso, o fra due vicini. Solo dopo peschi: se il cliente ci sta, entra. Prima di pescare puoi toccare il mazzo e vedere chi manca.'],
    ['spazio', 'Dove c\'è più spazio?', 'Il numero su ogni posto dice <i>quanti numeri ci starebbero</i>: fra un 8 e un Asso otto, davanti a un Re uno solo. Più spazio, più probabilità che il prossimo ci stia.'],
    ['maleducato', 'Il maleducato', 'Chi non ci sta salta la fila. <i>Resta</i>: tutta la coda se ne va, e lui ne comincia una nuova. <i>Caccialo</i>: il vigile porta via lui e il prossimo del mazzo, e il cliente dopo prova lo stesso posto.'],
    ['scarti', 'Gli scarti', 'Chi se ne va finisce qui, su tre file: il primo di ogni numero nella prima, il secondo nella seconda, il terzo nella terza, ed è una <i>bomba</i>: al quarto hai perso.'],
    ['fine', 'Vincere e perdere', 'Vinci se finisci il mazzo: il punteggio sono i clienti rimasti in coda. Perdi appena se ne va il quarto cliente con lo stesso numero. Col mazzo vuoto puoi ancora cacciare: se ne va solo lui.']
  ];

  root.BobaCopione = { partita: PARTITA, passi: PASSI, aiuti: AIUTI, regole: REGOLE };
  if (typeof module === 'object' && module.exports) module.exports = root.BobaCopione;
}(typeof self !== 'undefined' ? self : this));
