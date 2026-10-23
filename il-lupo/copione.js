/*
 * IL LUPO — IL COPIONE DEL TUTORIAL (Erbottega, 24/10/2026). È IL FILE DEI TESTI: Penna riscrive solo i `testo`; il resto è il contratto col motore.
 * Spina: reference/giochi-di-carte/spine-dieci-giochi-2026-10-24.md, sezione 2 (Il Lupo). Metodo: reference/giochi-di-carte/metodo.md, «Il tutorial».
 *
 * LA PARTITA. È una partita vera del motore, sempre la stessa, dall'inizio, al livello normale (carte da 1 a 9). Le carte in cima al mazzo sono
 * fissate con `inTesta` (lo stesso meccanismo che usava la vecchia demo: nessuna regola forzata, solo l'ordine del mazzo); il resto del mazzo è
 * mescolato col seme e la partita, finito il tutorial, CONTINUA da lì.
 *
 *   il Lupo   R3 B3 G4 P5            tu  B1 R4 V7 P7            il mazzo, dalla cima:  G9 V3 G3 B2 P3 …  (la prima è la scoperta)
 *
 *   turno 1  Perfetta  il tuo 4 sul 4 del Lupo (è l'unica: la prova lo controlla). Peschi tu il 9 scoperto.
 *   turno 2  Sopra     non c'è altro che Sopra (nessuna Perfetta, Somma o Divisa). Si sceglie apposta quello caro: il 9 sul 5, differenza 4;
 *                      ce n'è uno economico (il 7 sul 5, due carte) che il testo nomina per confronto. Il Lupo pesca V3 G3 B2 P3 e arriva a 6 carte.
 *   turno 3  Fermati   il Lupo ha R3 B3 V3 G3 B2 P3 (17 punti), tu B1 V7 P7: restano solo Sopra, ognuno dà al Lupo almeno tre carte e non lo svuoti
 *                      mai. La mossa la trova il giocatore; gli aiuti (sotto) arrivano solo se sbaglia, uno più chiaro dell'altro.
 *
 * Ogni pezzetto (pezzi.js) è { testo, accendi, acceso }: `testo` si riscrive (**così** = grassetto); `accendi` sono le chiavi che tutorial.js traduce
 * in elementi del tavolo (lupo, tue, mazzo, mosse, punti, carta:ID, tasto:Nome); `acceso` dice la stessa cosa a parole, per chi lavora sul testo.
 * Ogni passo: tipo ('leggi' | 'gioca'); modo (solo gioca: 'guidato' = la vignetta indica ogni tocco; 'trova' = nessuna indicazione, il
 * giocatore trova la mossa); intento (cosa insegna); insegna (la riga della spina); titolo (solo leggi, sta nel cartello); pezzi; mossa; chi (chi pesca dopo).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LupoCopione = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PARTITA = {
    seme: 'tutorial', livello: 'normale',
    inTesta: 'R3 B3 G4 P5 B1 R4 V7 P7 G9 V3 G3 B2 P3'.split(' ')   // il Lupo, tu, poi il mazzo dalla cima
  };

  var PASSI = [
    // ---------- 1. LA STORIA, IL TAVOLO, COME SI VINCE ----------
    { tipo: 'leggi', titolo: 'La partita',
      intento: 'La storia in una riga, chi sono i due lati del tavolo, lo scopo, come si segnano i punti e quando si arriva a 100.',
      insegna: 'La storia; flusso 1 (4 carte scoperte), 2 (togliere tutte le carte al Lupo, poi i tuoi punti), 4 (fermarsi, si gioca a 100).',
      pezzi: [
        { testo: 'Giochi contro il **Lupo**: queste in alto sono le sue carte. Lui non fa mai una mossa, le fai tutte tu. Il tuo scopo: togliergli **tutte** le carte.',
          accendi: ['lupo'], acceso: 'le quattro carte del Lupo' },
        { testo: 'Le tue carte sono queste, in basso. Quando il Lupo resta senza carte, segni tu i punti di quelle che hai ancora: ogni carta vale il suo numero.',
          accendi: ['tue'], acceso: 'le tue carte' },
        { testo: 'Puoi anche fermarti quando vuoi, col tasto **Fermati**. Allora segna il Lupo, i punti delle carte che ha lui. Segna lui anche se resti tu senza carte.',
          accendi: ['lupo', 'tasto:Fermati'], acceso: 'le carte del Lupo e il tasto Fermati' },
        { testo: 'Una partita è fatta di più **mani**: a ogni mano si riparte con quattro carte a testa, e i punti si sommano. Vince chi arriva prima a **100**.',
          accendi: ['punti'], acceso: 'la riga dei punti in alto' }
      ] },

    // ---------- 2. IL MAZZO E LE QUATTRO MOSSE (esempi veri, sul tavolo di partenza) ----------
    { tipo: 'leggi', titolo: 'Le mosse',
      intento: 'Il mazzo con la prima carta scoperta; le quattro mosse, ognuna con un esempio vero sul tavolo e con chi pesca dopo.',
      insegna: 'Flusso 1 (la prima carta del mazzo è scoperta) e 3 (le mosse e chi pesca dopo).',
      pezzi: [
        { testo: 'Accanto alle carte del Lupo c\'è il mazzo. **Pescare** vuol dire prendere la sua prima carta, che è sempre scoperta: sai già quale arriva.',
          accendi: ['mazzo'], acceso: 'il mazzo con la carta scoperta (9)' },
        { testo: 'Per togliere carte al Lupo hai quattro mosse: sono questi tasti. L\'ultimo, Fermati, lo conosci già.',
          accendi: ['mosse'], acceso: 'la riga dei quattro tasti delle mosse' },
        { testo: '**Perfetta**: una tua carta uguale a una sua. Il tuo 4 toglie il suo 4. Dopo, peschi tu.',
          accendi: ['carta:R4', 'carta:G4'], acceso: 'il tuo 4 e il 4 del Lupo' },
        { testo: '**Somma**: almeno due carte tue che, sommate, fanno una carta sua. Il tuo 1 e il tuo 4 fanno 5, e tolgono il suo 5. Dopo, peschi tu.',
          accendi: ['carta:B1', 'carta:R4', 'carta:P5'], acceso: 'il tuo 1, il tuo 4 e il 5 del Lupo' },
        { testo: '**Divisa**: il contrario. Una tua carta toglie almeno due carte sue che, sommate, fanno quanto lei: il tuo 7 toglie il 3 e il 4. Dopo, pesca il Lupo: una carta.',
          accendi: ['carta:V7', 'carta:R3', 'carta:G4'], acceso: 'il tuo 7, il 3 e il 4 del Lupo' },
        { testo: '**Sopra**: una tua carta più alta di una sua. Il tuo 7 toglie il 5. Dopo, il Lupo pesca tante carte quanta è la differenza: 7 meno 5, due.',
          accendi: ['carta:P7', 'carta:P5'], acceso: 'il tuo secondo 7 e il 5 del Lupo' }
      ] },

    // ---------- 3. TURNO 1: IL GIOCO RAGIONA AD ALTA VOCE, PRIMA DOMANDA ----------
    { tipo: 'gioca', modo: 'guidato',
      intento: 'Prima domanda del ragionamento («c\'è una Perfetta?»): è la mossa migliore, e la carta che peschi la vedi già (il 9 scoperto).',
      insegna: 'Ragionamento 1.',
      pezzi: [
        { testo: 'A ogni turno la prima domanda è: **c\'è una Perfetta?** Qui sì: il tuo 4 e il 4 del Lupo.',
          accendi: ['carta:R4', 'carta:G4'], acceso: 'il tuo 4 e il 4 del Lupo' },
        { testo: 'È la mossa migliore: spendi una carta e ne peschi una, così le tue carte restano quattro. E quella che peschi la vedi già: questo 9.',
          accendi: ['carta:G9'], acceso: 'il 9 scoperto del mazzo' },
        { testo: 'Tocca il tuo 4, poi il 4 del Lupo, poi **Perfetta**, poi **Conferma**.',
          accendi: ['carta:R4', 'carta:G4', 'tasto:Perfetta'], acceso: 'il tuo 4, il 4 del Lupo, il tasto Perfetta' }
      ],
      mossa: { t: 'gioca', azione: 'perfetta', mie: ['R4'], sue: ['G4'] }, chi: 'tu' },

    // ---------- 4. TURNO 2: SENZA PERFETTA, OGNI MOSSA HA UN PREZZO; IL SOPRA CARO FA RIEMPIRE IL LUPO ----------
    { tipo: 'gioca', modo: 'guidato',
      intento: 'Seconda domanda: senza Perfetta ogni mossa ha un prezzo. Qui restano solo i Sopra: uno economico (7 sul 5) e uno caro (9 sul 5), che si fa apposta per vedere il Lupo che si riempie.',
      insegna: 'Ragionamento 2 (il prezzo di Sopra: differenza piccola conviene) e flusso 3 (Sopra: il Lupo pesca tante carte quanta è la differenza).',
      pezzi: [
        { testo: 'Di nuovo: **c\'è una Perfetta?** No, nessuna tua carta è uguale a una sua. E non c\'è nemmeno una Somma o una Divisa: puoi fare solo un Sopra.',
          accendi: ['tue', 'lupo'], acceso: 'le tue carte e quelle del Lupo' },
        { testo: 'Senza Perfetta, la seconda domanda è: **quanto costa ogni mossa?** Col Sopra il prezzo sono le carte che pesca il Lupo: tante quanta è la differenza.',
          accendi: ['tasto:Sopra'], acceso: 'il tasto Sopra' },
        { testo: 'Il tuo 7 sul suo 5 costa due carte. Poco: il Sopra conviene così, con la differenza piccola.',
          accendi: ['carta:V7', 'carta:P5'], acceso: 'il tuo 7 e il 5 del Lupo' },
        { testo: 'Il tuo 9 sul 5 ne costa quattro: è la mossa sbagliata. La facciamo apposta, per vedere che cosa succede al Lupo.',
          accendi: ['carta:G9', 'carta:P5'], acceso: 'il tuo 9 e il 5 del Lupo' },
        { testo: 'Tocca il tuo 9, poi il 5 del Lupo, poi **Sopra**, poi **Conferma**.',
          accendi: ['carta:G9', 'carta:P5', 'tasto:Sopra'], acceso: 'il tuo 9, il 5 del Lupo, il tasto Sopra' }
      ],
      mossa: { t: 'gioca', azione: 'sopra', mie: ['G9'], sue: ['P5'] }, chi: 'lupo' },

    // ---------- 5. TURNO 3: LA MOSSA LA TROVA IL GIOCATORE (fermarsi) ----------
    { tipo: 'gioca', modo: 'trova',
      intento: 'Terza domanda: il conto della fine. Il giocatore trova da solo che la mossa giusta è fermarsi; il tutorial non lo dice e aiuta solo se sbaglia (vedi AIUTI).',
      insegna: 'Ragionamento 3 (riesco a svuotare il Lupo? se no, mi fermo adesso) e flusso 4 (il Lupo segna i punti delle sue carte).',
      pezzi: [
        { testo: 'Ecco il prezzo: il Lupo ha pescato quattro carte, e adesso ne ha sei. Tu ne hai tre.',
          accendi: ['lupo', 'tue'], acceso: 'le sei carte del Lupo e le tue tre' },
        { testo: '**Riesco a togliere al Lupo tutte le carte prima di finire le mie?** Fattela dopo le due di prima: c\'è una Perfetta, quanto costa ogni mossa. Stavolta la mossa la scegli tu.',
          accendi: ['lupo', 'tue'], acceso: 'le carte del Lupo e le tue' }
      ],
      mossa: { t: 'fermati' } },

    // ---------- 6. IL RAGIONAMENTO IN TRE DOMANDE, E SI CONTINUA DA SOLI NELLA STESSA PARTITA ----------
    { tipo: 'leggi', titolo: 'Ora tocca a te',
      intento: 'Il ragionamento in tre domande, nell\'ordine, e da qui si continua da soli nella stessa partita.',
      insegna: 'Ragionamento 1, 2, 3 per intero.',
      pezzi: [
        { testo: 'Ti sei fermato: il Lupo segna le sue sei carte, 17 punti. Andando avanti gliene avresti date altre, e ogni carta in più sono punti in più per lui.',
          accendi: ['lupo'], acceso: 'le sei carte del Lupo' },
        { testo: 'Da qui in poi, a ogni turno, ti fai tre domande. La prima: **c\'è una Perfetta?** È la mossa migliore: le tue carte non diminuiscono, e quella che peschi la vedi già.',
          accendi: ['tue', 'mazzo'], acceso: 'le tue carte e il mazzo' },
        { testo: 'La seconda, se non c\'è: **quanto costa ogni mossa?** Con la **Somma** spendi almeno due carte tue, ma il Lupo non pesca.',
          accendi: ['tasto:Somma'], acceso: 'il tasto Somma' },
        { testo: 'Con la **Divisa** spendi una carta sola, ma il Lupo prende la carta scoperta del mazzo: sai già quale.',
          accendi: ['tasto:Divisa', 'mazzo'], acceso: 'il tasto Divisa e il mazzo' },
        { testo: 'Col **Sopra** il Lupo prende tante carte quanta è la differenza: conviene solo se è piccola.',
          accendi: ['tasto:Sopra'], acceso: 'il tasto Sopra' },
        { testo: 'La terza: **riesco a togliere al Lupo tutte le carte prima di finire le mie?** Se no, ti fermi subito, finché il Lupo ha poche carte: sono i suoi punti.',
          accendi: ['lupo', 'tasto:Fermati'], acceso: 'le carte del Lupo e il tasto Fermati' },
        { testo: 'Da qui continui da solo, nella stessa partita: il Lupo ha 17 punti, tu zero. Tocca **Continua**, poi **Mano successiva**, e si riparte con quattro carte a testa.',
          accendi: ['punti'], acceso: 'la riga dei punti' }
      ] }
  ];

  // GLI AIUTI del turno «trova»: arrivano solo se il giocatore sbaglia, uno più chiaro dell'altro (il terzo dice la mossa). BOZZA.
  var AIUTI = [
    'Non ancora. Prima fai il conto: qui non c\'è una Perfetta, quindi ogni mossa ti lascia una carta in meno. Con tre carte riesci a togliere al Lupo tutte le sue sei?',
    'Ogni mossa che ti resta è un Sopra: a te toglie una carta, al Lupo ne dà almeno quattro. Se vai avanti resti senza carte, e il Lupo segna tutte le sue: più ne ha, più punti fa.',
    'Conviene fermarti adesso. Tocca Fermati, poi Conferma: il Lupo segna le sue sei carte, prima che diventino di più.'
  ];

  return { partita: PARTITA, passi: PASSI, aiuti: AIUTI };
}));
