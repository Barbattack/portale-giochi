/*
 * SYNDICATE — IL COPIONE DELLA PARTITA GUIDATA, rifatto sulla spina (Chiara, 23/10/2026, sera).
 * Spina: syndicate/design/2026-10-23-spina-tutorial.md (approvata da Damiano). Qui le bozze la seguono parola per parola dove si può.
 * Questo è il FILE DEI TESTI: tutorial.js lo legge e non contiene nessun testo suo. PENNA riscrive `bozza`, `regole` e `aiuti`;
 * intento, vede, concetti, modo e mossa sono il disegno e il contratto col motore (prova/prova-copione.js).
 *
 * LA PARTITA. È una partita vera del motore, `nuova('tut-281')`, sempre la stessa, dall'inizio. L'ho cercata col motore (prova/cerca-stesura.js)
 * perché avesse questa forma:
 *   - il primo turno si ragiona ad alta voce con i numeri della spina: restano 5 e 4, serve un 9 o un 10, e fra gli aspiranti c'è un solo 10;
 *   - nel secondo e nel terzo turno la mossa giusta è UNA SOLA (un affiliato, un aspirante): la trova il giocatore, il tutorial non la dice e
 *     aiuta solo se sbaglia, riportandolo al ragionamento;
 *   - poi il Capodecina è pieno: la scelta fra aspiranti e affiliati, e un sacrificio provato una volta;
 *   - da lì si vince ancora, in 17 mosse e senza altri sacrifici.
 *
 * Ogni passo ha anche `pezzi`: i pezzetti in cui si racconta, ognuno con la riga (e le frasi) della bozza da cui prende il testo e le cose da
 * accendere sul tavolo (vedi portale-giochi/design/pezzi.js). Le parole non si duplicano: i pezzetti puntano alla bozza.
 * Ogni passo: tipo ('leggi' | 'gioca'); modo (solo gioca: 'guidato' = la vignetta indica ogni tocco; 'trova' = la vignetta non indica le carte,
 * il giocatore trova l'affiliato e l'aspirante, e gli aiuti arrivano solo se sbaglia); intento; vede; concetti; titolo (leggi); bozza; mossa.
 */
(function (root) {
  'use strict';
  var prom = function (carta, dove, sostituto, sacrifica) { return { t: 'promuovi', carta: carta, dove: dove, sostituto: sostituto, sacrifica: sacrifica || null }; };
  var PARTITA = { seme: 'tut-281', scelta: ['C3', 'F5', 'Q4'] };
  // La stesura che il seme produce (per chi legge; la prova lo verifica): aspiranti Soldato A♦ 2♠ A♥ 2♦ 8♦ 4♥ 2♥ 10♠ A♠ ·
  // Capodecina 9♥ 10♦ 4♠ 8♠ 7♣ 9♠ 6♣ · Consigliere 3♠ 2♣ 9♣ 7♦ 4♣ · Sottocapo 3♣ 7♥ 3♦ · Boss A♣ ·
  // le 15 della scelta: 3♥ 8♣ 5♥ 6♠ 9♦ 6♦ 7♠ 5♣ 4♦ 6♥ 10♣ 10♥ 8♥ 5♠ 5♦.

  var PASSI = [
    { tipo: 'leggi', intento: 'La storia: chi sei, com\'è fatta la famiglia, cosa vuoi ottenere.',
      vede: 'La stesura di una partita vera: cinque colonne sotto la scalinata (Soldato a sinistra, Boss a destra), i riquadri degli affiliati vuoti, le file degli aspiranti, le 15 carte in fondo.',
      pezzi: [{ riga: 0, accendi: [] }, { riga: 1, frasi: [0], accendi: ['scalinata'] }, { riga: 1, frasi: [1], accendi: ['zona-affiliati:Soldato', 'aspiranti:Soldato'] }, { riga: 2, accendi: ['livello:Boss'] }],
      concetti: ['la famiglia', 'i cinque livelli: Soldato, Capodecina, Consigliere, Sottocapo, Boss', 'affiliati (al massimo tre per livello)', 'aspiranti', 'lo scopo: portare un tuo uomo oltre il Boss'],
      titolo: 'La famiglia', bozza: 'Chicago, anni Trenta. Sei a capo di un\'operazione di polizia: infiltri i tuoi uomini sotto copertura nella **famiglia**.\nLa famiglia ha cinque livelli, dal **Soldato** in basso fino al **Boss** in cima. A ogni livello ci sono al massimo **tre affiliati**, e davanti a loro una fila di **aspiranti** che aspettano di entrare.\nVuoi portare un tuo uomo **oltre il Boss**: quel giorno smantelli tutta la famiglia in un colpo solo.' },

    { tipo: 'leggi', intento: 'Come si sale: il livello pieno, il posto che si libera, e chi la famiglia accetta al posto di chi sale (somma o prodotto).',
      vede: 'Stesso schermo.',
      pezzi: [{ riga: 0, accendi: ['zona-affiliati:Soldato'] }, { riga: 1, accendi: ['aspiranti:Soldato'] }, { riga: 2, accendi: [] }, { riga: 3, accendi: ['carta:F5', 'carta:Q4'] }, { riga: 4, accendi: ['carta:P10'] }, { riga: 5, accendi: [] }],
      concetti: ['livello pieno: tre affiliati', 'quando uno sale, un aspirante dello stesso livello prende il suo posto', 'va d\'accordo coi due rimasti: ultima cifra della somma o del prodotto', 'il 10 conta zero, l\'Asso conta 1', 'si perde se nessuno può più salire'],
      titolo: 'Come si sale', bozza: 'Puoi far salire un affiliato al livello superiore, solo se i posti nell\'attuale livello sono pieni.\nQuando lo fai salire, il posto che libera deve venire subito occupato da un aspirante. Ma la famiglia non accetta chiunque: entra solo chi va "d\'accordo" con i due rimasti.\nVa d\'accordo se il suo numero è l\'ultima cifra della loro somma o del loro prodotto.\nEsempio: restano un 5 e un 4?\n5 + 4 fa 9, 5 × 4 fa 20: può entrare un 9, oppure un 10, che conta come zero.\nSe nessuno può più salire, hai perso.' },

    { tipo: 'gioca', modo: 'guidato', intento: 'La scelta dei tre affiliati Soldato, ragionata ad alta voce: si scelgono guardando chi potrà salire.',
      vede: 'Le 15 carte in fondo; la vignetta indica il 3♥, il 5♣ e il 4♦, poi Conferma.',
      pezzi: [{ riga: 0, accendi: ['resto'] }, { riga: 1, accendi: ['carta:C3', 'carta:F5', 'carta:Q4', 'carta:P10'] }, { riga: 2, accendi: ['carta:C3', 'carta:F5', 'carta:Q4'] }],
      concetti: ['i tre affiliati Soldato li scegli tu fra 15 carte, le altre 12 escono', 'Conferma'],
      bozza: 'Inizio della partita: i primi tre affiliati del livello Soldato li scegli tu, fra le 15 carte in basso, le altre vengono scartate.\nRagioniamo. Prendiamo un 3, un 5 e un 4. Se un giorno sale il 3, restano 5 e 4: serve un 9 o un 10, e fra gli aspiranti Soldato c\'è un 10. Buon segno.\nScegli il 3 di cuori, il 5 di fiori e il 4 di quadri, poi Conferma.',
      mossa: { t: 'scegli', carte: ['C3', 'F5', 'Q4'] } },

    { tipo: 'gioca', modo: 'guidato', intento: 'Un turno ragionato ad alta voce insieme al giocatore, con i numeri della spina.',
      vede: 'Soldato pieno: 3♥ 5♣ 4♦ fra gli affiliati, gli aspiranti sotto. La vignetta indica il 3♥, poi «Fra gli affiliati», poi il 10♠, poi Conferma.',
      pezzi: [{ riga: 0, frasi: [0], accendi: ['affiliati:Soldato'] }, { riga: 0, frasi: [1, 2], accendi: ['carta:F5', 'carta:Q4'] }, { riga: 0, frasi: [3, 4, 5], accendi: ['carta:P10'] }, { riga: 1, accendi: ['zona-affiliati:Capodecina', 'zona-aspiranti:Capodecina'] }, { riga: 2, accendi: ['carta:C3'] }],
      concetti: ['chi sale entra nel livello sopra: fra gli affiliati o fra gli aspiranti, lo scegli tu'],
      bozza: 'Il livello Soldato è pieno: qualcuno può salire. Ragioniamo insieme. Se faccio salire il 3, restano 5 e 4: 5 + 4 fa 9, 5 × 4 fa 20. Serve un 9 o un 10. Fra gli aspiranti Soldato c\'è il 10 di picche? Sì: allora il 3 può salire.\nQuando sale, scegli dove entra nel livello sopra: fra gli affiliati o fra gli aspiranti. Il Capodecina è vuoto: lo facciamo entrare fra gli affiliati, per cominciare a riempirlo.\nTocca il 3 di cuori, poi «Fra gli affiliati», poi il 10 di picche, poi Conferma.',
      mossa: prom('C3', 'membri', 'P10') },

    { tipo: 'gioca', modo: 'trova', intento: 'La mossa la trova il giocatore: fra i tre affiliati Soldato uno solo può salire, con un solo aspirante. Il tutorial non lo dice; aiuta solo se sbaglia.',
      vede: 'Soldato: 10♠ 5♣ 4♦. Nessuna vignetta sulle carte: solo su «Fra gli affiliati» e su Conferma, quando tocca.',
      pezzi: [{ riga: 0, frasi: [0, 1], accendi: ['affiliati:Soldato'] }, { riga: 0, frasi: [2, 3], accendi: ['aspiranti:Soldato'] }, { riga: 1, accendi: ['zona-affiliati:Capodecina'] }],
      concetti: ['il ragionamento a ogni turno: se sale lui, chi resta? i due conti; c\'è un aspirante con quel numero?'],
      bozza: 'Ora tocca a te. Guarda i tre affiliati Soldato: 10, 5 e 4. Per ognuno chiediti: **se faccio salire lui, chi resta?** Fai i due conti con i due che restano, e cerca fra gli aspiranti Soldato qualcuno con quel numero.\nUno solo dei tre può salire. Trovalo: toccalo, fallo entrare fra gli affiliati del Capodecina, tocca l\'aspirante che prende il suo posto, poi Conferma.',
      mossa: prom('F5', 'membri', 'C4') },

    { tipo: 'gioca', modo: 'trova', intento: 'Ancora il giocatore: stesso ragionamento, di nuovo una sola mossa giusta; riempie il Capodecina.',
      vede: 'Soldato: 10♠ 4♥ 4♦. Capodecina: 3♥ 5♣. Nessuna vignetta sulle carte.',
      pezzi: [{ riga: 0, accendi: ['affiliati:Soldato'] }, { riga: 1, accendi: ['zona-affiliati:Capodecina'] }],
      concetti: [],
      bozza: 'Ancora tu. Soldato: 10, 4 e 4. Stesso ragionamento: se sale lui, chi resta, i due conti, c\'è l\'aspirante? Ricorda che il 10 conta zero.\nFallo entrare fra gli affiliati del Capodecina: così saranno tre, e anche da lì si potrà salire.',
      mossa: prom('P10', 'membri', 'Q8') },

    { tipo: 'leggi', intento: 'Dove entra chi sale quando il livello sopra è pieno: fra gli aspiranti (nessuno esce) o fra gli affiliati (uno dei quattro esce per sempre: il sacrificio, che pesa sul punteggio).',
      vede: 'Capodecina pieno: 3♥ 5♣ 10♠. Soldato: 8♦ 4♥ 4♦.',
      pezzi: [{ riga: 0, accendi: ['affiliati:Capodecina'] }, { riga: 1, accendi: ['zona-aspiranti:Capodecina'] }, { riga: 2, accendi: ['affiliati:Capodecina', 'punti'] }],
      concetti: ['il sacrificio', 'ogni sacrificato pesa sul punteggio: meno sono, meglio è', 'gli aspiranti non hanno limite'],
      titolo: 'Dove entra chi sale', bozza: 'Il Capodecina ora è pieno. Chi sale dal Soldato può entrare in due modi.\nFra gli **aspiranti** del Capodecina: nessuno esce, e un giorno potrà diventare affiliato prendendo il posto di qualcuno che sale.\nFra gli **affiliati**: ma sono già tre, e un livello non ne tiene quattro. Uno dei quattro esce **per sempre**: è il **sacrificio**, e ogni sacrificato pesa sul tuo punteggio. Meno sono, meglio è.' },

    { tipo: 'gioca', modo: 'guidato', intento: 'Un turno ragionato ad alta voce in cui chi sale entra fra gli aspiranti del livello pieno: nessuno esce.',
      vede: 'Soldato: 8♦ 4♥ 4♦. La vignetta indica il 4♥, poi «Fra gli aspiranti», poi il 2♠, poi Conferma.',
      pezzi: [{ riga: 0, frasi: [0], accendi: ['affiliati:Soldato'] }, { riga: 0, frasi: [1], accendi: ['carta:Q8', 'carta:Q4'] }, { riga: 0, frasi: [2], accendi: ['carta:P2', 'carta:Q2', 'carta:C2'] }, { riga: 1, accendi: ['carta:C4', 'zona-aspiranti:Capodecina'] }],
      concetti: [],
      bozza: 'Soldato: 8, 4 e 4. Se sale un 4, restano 8 e 4: 8 + 4 fa 12, 8 × 4 fa 32. Serve un 2, e fra gli aspiranti Soldato ce ne sono tre: prendiamo il 2 di picche.\nFacciamo salire il 4 di cuori **fra gli aspiranti** del Capodecina: nessuno esce.',
      mossa: prom('C4', 'candidati', 'P2') },

    { tipo: 'gioca', modo: 'guidato', intento: 'Un sacrificio provato una volta, per sentire cosa costa: chi sale entra fra gli affiliati del livello pieno, e uno dei quattro esce.',
      vede: 'Soldato: 8♦ 2♠ 4♦. Dopo «Fra gli affiliati» e il 2♦ compare la riga dei quattro fra cui scegliere chi esce. La vignetta indica il 2♠, poi «Fra gli affiliati», poi il 2♦, poi il 3♥ da sacrificare, poi Conferma.',
      pezzi: [{ riga: 0, frasi: [0, 1], accendi: ['affiliati:Soldato'] }, { riga: 0, frasi: [2], accendi: ['carta:Q2'] }, { riga: 1, frasi: [0], accendi: ['affiliati:Capodecina'] }, { riga: 1, frasi: [1], accendi: ['carta:C3', 'punti'] }],
      concetti: ['si sceglie chi sacrificare fra i quattro'],
      bozza: 'Proviamo anche l\'altra strada, una volta, per sentire cosa costa. Soldato: 8, 2 e 4. Se sale il 2, restano 8 e 4: serve un 2, e c\'è il 2 di quadri.\nStavolta fallo entrare **fra gli affiliati** del Capodecina, che è pieno: uno dei quattro deve uscire. Scegli il 3 di cuori: è il tuo primo sacrificio, e il tuo primo punto.',
      mossa: prom('P2', 'membri', 'Q2', 'C3') },

    { tipo: 'leggi', intento: 'Da qui il giocatore continua da solo nella stessa partita, col ragionamento in mano; sa che si può ancora vincere e che il gioco dice perché quando una mossa non vale.',
      vede: 'Il tavolo dopo cinque turni: Soldato 8♦ 2♦ 4♦, Capodecina 5♣ 10♠ 2♠ con il 4♥ fra gli aspiranti. Carte sacrificate: 1.',
      pezzi: [{ riga: 0, accendi: ['scalinata'] }, { riga: 1, accendi: ['punti'] }, { riga: 2, accendi: ['livello:Boss', 'arrendo'] }],
      concetti: ['continuare da soli', 'Mi arrendo', 'il gioco dice perché quando una mossa non vale'],
      titolo: 'Ora tocca a te', bozza: 'Il ragionamento è sempre lo stesso, a ogni turno: guardo un livello pieno; per ognuno dei tre mi chiedo **se sale lui, chi resta**, e faccio i due conti; cerco fra gli aspiranti di quel livello qualcuno con quel numero; quando sale, scelgo se entra fra gli affiliati o fra gli aspiranti.\nDa qui continui da solo, in questa stessa partita: **si può ancora vincere**, e senza altri sacrifici. Se una mossa non vale, il gioco te lo dice e ti dice i numeri.\nVinci quando fai salire qualcuno oltre il Boss. Se nessuno può più salire hai perso; «Mi arrendo» chiude la partita quando vuoi.' }
  ];

  // GLI AIUTI dei turni «trova»: arrivano solo se il giocatore sbaglia, e lo riportano al ragionamento senza dirgli la risposta. BOZZA.
  //   {a} e {b} sono i numeri dei due affiliati che restano; {s} e {p} l'ultima cifra della loro somma e del loro prodotto (uguale: una sola).
  var AIUTI = {
    affiliato: 'Non è lui. Se sale lui, chi resta? Fai i due conti con i due che restano, e cerca quel numero fra gli aspiranti Soldato.',
    sostituto: 'Restano {a} e {b}: il sostituto deve valere {s} o {p}. Cercalo fra gli aspiranti Soldato.',
    sostitutoUno: 'Restano {a} e {b}: il sostituto deve valere {s}. Cercalo fra gli aspiranti Soldato.',
    destinazione: 'Prima decidi dove entra: fra gli affiliati del Capodecina.',
    // il rifiuto del motore, detto coi numeri veri (in partita e nel tutorial)
    rifiuto: 'Non vale. Restano {a} e {b}: il sostituto deve valere {s} o {p}.',
    rifiutoUno: 'Non vale. Restano {a} e {b}: il sostituto deve valere {s}.'
  };

  // LE REGOLETTE: «Come si gioca», una schermata sola. [icona, titolo, testo] — BOZZA (Penna). <i>x</i> evidenzia.
  var REGOLE = [
    ['scopo', 'La famiglia', 'Cinque livelli, dal Soldato al Boss. A ogni livello al massimo tre <i>affiliati</i>, e davanti una fila di <i>aspiranti</i>. Vinci quando fai salire un tuo uomo oltre il Boss.'],
    ['promozione', 'Come si sale', 'Da un livello <i>pieno</i> (tre affiliati) uno sale al livello sopra, e sceglie se entrare fra gli affiliati o fra gli aspiranti.'],
    ['sostituto', 'Chi prende il suo posto', 'Un aspirante dello stesso livello, ma solo se va d\'accordo coi due rimasti: il suo numero è l\'ultima cifra della loro <i>somma</i> o del loro <i>prodotto</i>. Restano 5 e 4? Un 9 (5+4) o un 10 (5×4=20; il 10 conta zero). L\'Asso conta 1.'],
    ['ragionamento', 'Il ragionamento, a ogni turno', 'Guardo un livello pieno. Per ognuno dei tre: <i>se sale lui, chi resta?</i> I due conti. C\'è un aspirante con quel numero? Se sì, può salire.'],
    ['sacrificio', 'Il sacrificio', 'Se chi sale entra fra gli affiliati di un livello già pieno, uno dei quattro esce <i>per sempre</i>: lo scegli tu. Ogni sacrificato è un punto, e meno punti è meglio.'],
    ['punti', 'Vincere e perdere', 'Vinci quando qualcuno sale oltre il Boss. Perdi se nessuno può più salire, o se ti arrendi. Il punteggio sono i sacrificati: zero è la partita perfetta.']
  ];

  root.SyndicateCopione = { partita: PARTITA, passi: PASSI, aiuti: AIUTI, regole: REGOLE };
  if (typeof module === 'object' && module.exports) module.exports = root.SyndicateCopione;
}(typeof self !== 'undefined' ? self : this));
