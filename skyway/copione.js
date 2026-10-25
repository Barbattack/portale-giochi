/*
 * SKYWAY — IL COPIONE DEL TUTORIAL (Erbottega, 25/10/2026). È IL FILE DEI TESTI: Penna riscrive solo i `testo`; il resto è il contratto col motore.
 * Spina: reference/giochi-di-carte/spine-dieci-giochi-2026-10-24.md, sezione 10 (Skyway), con la rettifica del 25/10: i numeri di una strada salgono ma
 * NON devono essere consecutivi. Metodo: reference/giochi-di-carte/metodo.md, «Il tutorial». Stessa architettura di il-lupo/copione.js.
 *
 * LA PARTITA. È una partita vera del motore, sempre la stessa, dalla stessa griglia avviata: diciassette carte già posate, quattro strade di quattro carte
 * (una per seme), da farle diventare di cinque. Il primo mercato è fissato (`mercato`); i due successivi con `inTesta`; il resto del mazzo è mescolato
 * col seme e la partita, finito il tutorial, CONTINUA da lì. Nessuna regola forzata: solo carte messe dove servono.
 *
 *   caselle  0 1 2      griglia di partenza (dal fondo alla cima)
 *            3 4 5      0: 2♥          1: 5♥ 9♣       2: 6♥ 3♦
 *            6 7 8      3: 4♣ 4♠ A♦    4: 6♠ 7♣ 6♦    5: 8♥ 4♦
 *                       6: 2♠ 3♣       7: 8♦ 9♠ 5♣    8: vuota
 *   cuori   2♥(0) 5♥(1) 6♥(2) 8♥(5)    quadri  3♦(2) 4♦(5) 6♦(4) 8♦(7)
 *   fiori   3♣(6) 5♣(7) 7♣(4) 9♣(1)    picche  2♠(6) 4♠(3) 6♠(4) 9♠(7)
 *
 *   turno 1  guidato   il mercato è 7♦ 9♥ | 8♣ 5♠ | 4♥. Solo il 9♥ allunga una strada (i cuori: 8♥ → 9♥) e solo in basso a destra, vicino all'8♥, senza
 *                      che cada niente che serva: le altre due pile non allungano niente, da nessuna parte. Cuori a cinque.
 *   turno 2  guidato   il mercato è 3♥ 5♦ | 7♠ 7♥ | 6♣: nessuna posa allunga niente. La posa guidata è la pila da una carta (6♣) a sinistra al centro: la casella ha
 *                      già tre carte, cade il 4♣ (i fiori restano 3, 5, 7, 9) e la griglia non si riempie. È la migliore: ogni altra posa che non spezza niente
 *                      aggiunge carte alla griglia; la pila da due carte nella stessa casella farebbe cadere anche il 4♠ (le picche scenderebbero); a destra al
 *                      centro cadrebbe l'8♥ e i cuori scenderebbero da 5 a 3. (Una posa che non fa cadere niente, per esempio il 6♣ in basso a destra, riempie
 *                      la griglia: le caselle sono 9 per 3 carte, e ogni carta che non serve toglie posto.)
 *   turno 3  «trova»   il mercato è 8♠ 10♣ | 2♦ 10♥ | 3♠. L'unica posa che allunga una strada senza spezzarne un'altra è la prima pila in alto a sinistra
 *                      (10♣ vicino al 9♣: i fiori a cinque). Più di una posa allunga qualcosa ma fa cadere una carta che serve: il tutorial lo dice.
 *   Alla fine: cuori 2,5,6,8,9 (cinque) · fiori 3,5,7,9,10 (cinque) · picche 2,4,6,9 (quattro) · quadri 3,4,6,8 (quattro). Totale 18.
 *
 * Ogni pezzetto (pezzi.js) è { testo, accendi, acceso }: `testo` si riscrive (**così** = grassetto); `accendi` sono le chiavi che tutorial.js traduce in elementi
 * del tavolo (griglia, mercato, giri, mazzo, scarti, pila:N, casella:N, carta:ID); `acceso` dice la stessa cosa a parole, per chi lavora sul testo.
 * Ogni passo: tipo ('leggi' | 'gioca'); modo (solo gioca: 'guidato' = la vignetta indica ogni tocco; 'trova' = nessuna indicazione, il giocatore trova la
 * posa); intento; insegna (la riga della spina); titolo; pezzi; mossa { t:'gioca', pila, casella }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkywayCopione = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PARTITA = {
    seme: 'tutorial',
    griglia: [['H2'], ['H5', 'C9'], ['H6', 'D3'], ['C4', 'S4', 'D1'], ['S6', 'C7', 'D6'], ['H8', 'D4'], ['S2', 'C3'], ['D8', 'S9', 'C5'], []],
    mercato: [['D7', 'H9'], ['C8', 'S5'], ['H4']],
    inTesta: 'H3 D5 S7 H7 C6 S8 C10 D2 H10 S3'.split(' ')     // il mercato del turno 2, poi quello del turno 3
  };

  var PASSI = [
    // ---------- 1. LA STORIA ----------
    { tipo: 'leggi', titolo: 'Lo svincolo',
      intento: 'La storia del libro in una riga, che cosa sono le carte e i semi, lo scopo: quattro strade, una per seme, di almeno cinque carte.',
      insegna: 'La storia; flusso 3 (la vittoria: una strada di almeno 5 carte per ogni seme).',
      pezzi: [
        { testo: 'Sei un **urbanista** e devi progettare uno svincolo autostradale, famoso per quanto è intricato. Lo costruisci su questa griglia di nove caselle.',
          accendi: ['griglia'], acceso: 'la griglia 3×3' },
        { testo: 'Ogni carta è un pezzo di strada, e ogni **seme** è una strada diversa: cuori ♥, quadri ♦, fiori ♣, picche ♠. In questa casella se ne incrociano tre.',
          accendi: ['casella:7'], acceso: 'la casella in basso al centro, dove stanno tre semi diversi' },
        { testo: 'Il tuo scopo: costruire **quattro strade**, una per seme, ognuna lunga almeno **cinque carte**. Ma prima: che cos\'è una strada?',
          accendi: ['griglia'], acceso: 'la griglia' }
      ] },

    // ---------- 2. CHE COS'È UNA STRADA (sulla griglia avviata, prima del mercato) ----------
    { tipo: 'leggi', titolo: 'Che cos\'è una strada',
      intento: 'Una strada, mostrata sui cuori della griglia già avviata: stesso seme, caselle vicine (non in diagonale), numeri che salgono ma non consecutivi; lo strato non conta; si può tornare su una casella ma a ogni passo si cambia.',
      insegna: 'Che cos\'è una strada (spina, sezione «Che cos\'è una strada», con la rettifica del 25/10).',
      pezzi: [
        { testo: 'Una **strada** è una fila di carte dello stesso seme, in caselle vicine, con i numeri che salgono. Guarda i cuori accesi: sono una strada.',
          accendi: ['carta:H2', 'carta:H5', 'carta:H6', 'carta:H8'], acceso: 'i quattro cuori: 2♥, 5♥, 6♥, 8♥' },
        { testo: 'Parte dal 2♥ in alto a sinistra, va a destra al 5♥, ancora a destra al 6♥, poi scende all\'8♥. I numeri **salgono** sempre, ma possono saltare: tra il 2 e il 5 mancano il 3 e il 4, e va bene.',
          accendi: ['carta:H2', 'carta:H5', 'carta:H6', 'carta:H8'], acceso: 'gli stessi quattro cuori' },
        { testo: 'Caselle **vicine** sono quelle che si toccano di lato: a destra, a sinistra, in alto, in basso. In diagonale no: il 5♥ e l\'8♥ non sono vicini, li unisce il 6♥, che li tocca tutti e due di lato.',
          accendi: ['carta:H5', 'carta:H8'], acceso: 'il 5♥ e l\'8♥' },
        { testo: 'In una casella le carte stanno una sull\'altra, ma sullo schermo le vedi in fila: a sinistra quella in fondo, a destra quella in cima. Il 5♥ è sotto il 9♣, e per la strada conta lo stesso.',
          accendi: ['carta:H5', 'carta:C9'], acceso: 'il 5♥ e il 9♣, nella stessa casella' },
        { testo: 'Una strada può anche tornare in una casella già usata: per esempio 1 in una casella, 4 in quella accanto, 6 di nuovo nella prima. Ma a ogni passo cambia casella: due carte nella stessa casella non sono vicine.',
          accendi: ['griglia'], acceso: 'la griglia' },
        { testo: 'La strada dei cuori ha **quattro** carte. Anche picche, fiori e quadri ne hanno già una da quattro. Per vincere ne servono cinque, per ogni seme.',
          accendi: ['griglia'], acceso: 'la griglia' }
      ] },

    // ---------- 3. IL MERCATO E LA POSA, QUANTO BASTA ----------
    { tipo: 'leggi', titolo: 'Il mercato',
      intento: 'Il mercato (tre pile, 2+2+1), si prende una pila e le altre vanno negli scarti, la pila si posa sopra una casella; una casella tiene tre carte; come si fa la mossa coi tocchi.',
      insegna: 'Flusso 2 (il mercato, la posa) senza ancora la caduta, che si vede quando succede.',
      pezzi: [
        { testo: 'In alto c\'è il **mercato**: tre pile di carte, due da due carte e una da una carta sola. A ogni turno ne arriva uno nuovo dal mazzo.',
          accendi: ['mercato'], acceso: 'le tre pile del mercato' },
        { testo: 'Del mercato prendi **una** pila sola. Le altre due finiscono negli scarti: il mucchio accanto al mazzo.',
          accendi: ['mercato', 'scarti'], acceso: 'il mercato e il mucchio degli scarti' },
        { testo: 'La pila va in cima a una casella così com\'è: la sua carta di sinistra va sotto, quella di destra in cima. Una casella tiene al massimo tre carte: cosa succede se sono di più, lo vedi tra poco.',
          accendi: ['griglia'], acceso: 'la griglia' },
        { testo: 'Per posare tocchi la pila e la casella, nell\'ordine che vuoi. Sotto la griglia compare un tasto che dice cosa succede: lo tocchi, e la pila è posata.',
          accendi: ['mercato', 'griglia'], acceso: 'il mercato e la griglia (il tasto compare solo dopo aver toccato una pila e una casella)' }
      ] },

    // ---------- 4. TURNO 1: IL GIOCO RAGIONA AD ALTA VOCE ----------
    { tipo: 'gioca', modo: 'guidato', titolo: 'Il tuo turno',
      intento: 'Il ragionamento di ogni turno, nelle prime due domande: dove sono le mie strade, quale carta ne allunga una. Una pila allunga i cuori (9♥ dopo l\'8♥); si posa dove non cade niente.',
      insegna: 'Ragionamento 1 (guardo le tre pile: quale carta allunga quale strada) e flusso 2.',
      pezzi: [
        { testo: 'A ogni turno la prima domanda è: **quale carta allunga una strada?** Guarda dove finiscono le tue. Quella dei cuori finisce con l\'8♥, a destra al centro.',
          accendi: ['carta:H2', 'carta:H5', 'carta:H6', 'carta:H8'], acceso: 'la strada dei cuori' },
        { testo: 'Per allungarla serve un cuori più alto dell\'8, in una casella vicina alla sua. Eccolo: il 9♥, nella prima pila.',
          accendi: ['pila:0', 'carta:H8'], acceso: 'la prima pila (7♦ 9♥) e l\'8♥' },
        { testo: 'La casella in basso a destra tocca quella dell\'8♥ ed è vuota. Le due carte della pila ci stanno.',
          accendi: ['casella:8', 'carta:H8'], acceso: 'la casella in basso a destra (vuota) e l\'8♥' },
        { testo: 'E le altre pile? L\'8♣, il 5♠ e il 4♥ sono più bassi dell\'ultima carta della strada del loro seme: non allungano niente.',
          accendi: ['pila:1', 'pila:2'], acceso: 'la seconda e la terza pila' },
        { testo: 'Tocca la pila del 9♥, poi la casella in basso a destra. Sotto la griglia compare il tasto **Posa qui**: toccalo.',
          accendi: ['pila:0', 'casella:8'], acceso: 'la prima pila e la casella in basso a destra (il tasto compare solo dopo)' }
      ],
      mossa: { t: 'gioca', pila: 0, casella: 8 } },

    // ---------- 5. TURNO 2: LA CADUTA, QUANDO SUCCEDE DAVVERO ----------
    { tipo: 'gioca', modo: 'guidato', titolo: 'Cosa cade',
      intento: 'Quando nessuna carta allunga niente, conta cosa cade (e la posa migliore è la pila da una carta dove cade solo una carta che non serve: la griglia non si riempie): una casella tiene tre carte, le altre cadono dal fondo. A sinistra al centro cade il 4♣ (i fiori restano 3, 5, 7, 9); a destra al centro cadrebbe l\'8♥ (i cuori scenderebbero da 5 a 3).',
      insegna: 'Ragionamento 2 (guardo cosa cade) e flusso 2 (una casella tiene tre carte, il resto cade dal fondo).',
      pezzi: [
        { testo: 'Mercato nuovo. **Quale carta allunga una strada?** Stavolta nessuna: ognuna è più bassa dell\'ultima carta della strada del suo seme.',
          accendi: ['mercato'], acceso: 'il nuovo mercato' },
        { testo: 'Allora passa alla seconda domanda: **cosa cade?** Una casella tiene tre carte: se con la pila diventano di più, quelle in fondo, a sinistra, cadono negli scarti. Questa ne ha già tre.',
          accendi: ['casella:7'], acceso: 'la casella in basso al centro, che ha già tre carte' },
        { testo: 'A destra al centro ci sono due carte, e in fondo c\'è l\'8♥. Con la pila 3♥ 5♦ cadrebbe lui, e la strada dei cuori tornerebbe da cinque carte a tre.',
          accendi: ['casella:5', 'carta:H8'], acceso: 'la casella a destra al centro e l\'8♥' },
        { testo: 'A sinistra al centro in fondo c\'è il 4♣: se cade, ai fiori resta la strada 3, 5, 7, 9. Una pila va posata a ogni turno: se non allunga niente, mettila al posto di una carta che non serve, e i posti liberi restano alle carte buone.',
          accendi: ['casella:3', 'carta:C4'], acceso: 'la casella a sinistra al centro e il 4♣' },
        { testo: 'Tocca la pila del 6♣, una carta sola, poi la casella a sinistra al centro. Prima di posare, il tasto ti dice cosa cade: **Posa qui: cade il 4♣**. Toccalo.',
          accendi: ['pila:2', 'casella:3'], acceso: 'la terza pila (6♣, una carta sola) e la casella a sinistra al centro (il tasto compare solo dopo)' }
      ],
      mossa: { t: 'gioca', pila: 2, casella: 3 } },

    // ---------- 6. TURNO 3: LA POSA CHE ALLUNGA LA TROVA IL GIOCATORE ----------
    { tipo: 'gioca', modo: 'trova', titolo: 'Trovala tu',
      intento: 'Terzo turno: il giocatore trova da solo la posa che allunga una strada. Il tutorial non la dice e aiuta solo se sbaglia (vedi AIUTI). Una sola posa allunga senza spezzare altro.',
      insegna: 'Ragionamento 1 e 2 insieme: quale carta allunga quale strada, e cosa cade.',
      pezzi: [
        { testo: 'Adesso la posa la trovi tu. I cuori sono già a cinque carte; fiori, picche e quadri sono a quattro.',
          accendi: ['mercato'], acceso: 'il mercato' },
        { testo: 'Ricorda le due domande: **quale carta allunga una strada?** E dove la posi, **cosa cade?**',
          accendi: ['griglia'], acceso: 'la griglia' }
      ],
      mossa: { t: 'gioca', pila: 0, casella: 0 } },

    // ---------- 7. COME SI CONTA E QUANDO SI VINCE; POI SI CONTINUA DA SOLI ----------
    { tipo: 'leggi', titolo: 'Come si conta',
      intento: 'Il mazzo si passa tre volte; alla fine si conta la strada più lunga di ogni seme; si vince con cinque in tutti e quattro; il punteggio è la somma. Poi si continua nella stessa partita.',
      insegna: 'Flusso 1 (tre giri) e 3 (come si conta, quando si vince).',
      pezzi: [
        { testo: 'Il mazzo si passa **tre volte**: quando finisce, gli scarti si rimescolano e diventano il mazzo nuovo. Le tre figure in alto segnano il giro: a ogni giro se ne gira una.',
          accendi: ['giri'], acceso: 'i segnalini dei giri' },
        { testo: 'Finito il terzo giro, per ogni seme si conta la strada più lunga. I cuori: 2, 5, 6, 8, 9, cinque carte.',
          accendi: ['carta:H2', 'carta:H5', 'carta:H6', 'carta:H8', 'carta:H9'], acceso: 'la strada dei cuori' },
        { testo: 'I fiori: 3, 5, 7, 9, 10. Anche questa è di cinque carte.',
          accendi: ['carta:C3', 'carta:C5', 'carta:C7', 'carta:C9', 'carta:C10'], acceso: 'la strada dei fiori' },
        { testo: 'Le picche (2, 4, 6, 9) e i quadri (3, 4, 6, 8) ne hanno quattro: manca ancora una carta a testa.',
          accendi: ['carta:S2', 'carta:S4', 'carta:S6', 'carta:S9', 'carta:D3', 'carta:D4', 'carta:D6', 'carta:D8'], acceso: 'le strade delle picche e dei quadri' },
        { testo: 'Vinci se **tutti e quattro** i semi hanno una strada di almeno cinque carte. Solo allora hai un punteggio, la somma delle quattro strade: adesso farebbe 18, ma due sono ancora corte.',
          accendi: ['griglia'], acceso: 'la griglia' },
        { testo: 'Da qui continui da solo, nella stessa partita: la griglia è questa. Tocca **Continua**.',
          accendi: ['griglia'], acceso: 'la griglia' }
      ] }
  ];

  // GLI AIUTI del turno «trova»: arrivano solo se il giocatore sbaglia, uno più chiaro dell'altro (il terzo dice la posa). BOZZA.
  var AIUTI = [
    'Non ancora. Per allungare una strada serve una carta del suo seme, più alta della sua ultima carta, in una casella vicina a quella.',
    'La strada dei fiori è 3, 5, 7, 9, e finisce col 9♣ in alto al centro. Nel mercato c\'è un fiori più alto del 9?',
    'Il 10♣ è nella prima pila. Posala in alto a sinistra, accanto al 9♣: lì c\'è una carta sola, e non cade niente.'
  ];
  // se la posa allunga una strada ma ne spezza un'altra facendo cadere una carta che la reggeva (conta come uno sbaglio, ma dice questo)
  var AIUTO_COSTOSO = 'Questa posa allunga una strada, ma fa cadere una carta che ne reggeva un\'altra. Prima di posare leggi il tasto: ti dice cosa cade.';

  return { partita: PARTITA, passi: PASSI, aiuti: AIUTI, aiutoCostoso: AIUTO_COSTOSO };
}));
