// CRYBT — il motore: le regole e lo stato della partita. Niente DOM. Le regole stanno in
// «owner inbox/crybt-regole-2026-10-27.md»; i numeri dei passi (P1..P10) sono quelli dell'incontro in quel file.
// Si gioca chiamando le azioni qui sotto (nuova, scegliOfferta, scambia, affronta, dichiara, hoContato, continua, compra, prendiGratis, esci);
// ognuna cambia la partita g e risponde { ok: true } oppure { ok: false, perche }. Stesso seme e stesse azioni: stessa partita.
// Le fasi: offerta -> eroe -> conto -> esito (x4) -> conto-offerta -> negozio -> (discesa dopo) oppure fine.
(function (radice) {
  'use strict';
  var Conto = (typeof module !== 'undefined' && module.exports) ? require('./conto.js') : radice.Conto;

  // L'INTERRUTTORE (Damiano, 27/10): i punti dell'offerta che non spendi si PERDONO. Con true si TENGONO per la discesa dopo.
  // È l'unico posto del motore che lo sa: la sola riga che lo legge è in esci().
  var CONFIG = { tenerePunti: false };

  var VITA_MAX = 20, INCONTRI = 4;
  // Il negozio: costi dopo la metà (Specchio 15 e Torcia 2 non dimezzati). Il Sigillo è tolto. La cura è a parte (1 punto = 2 vita).
  var NEGOZIO = {
    torcia: { nome: 'Torcia', costo: 2 },
    amuleto: { nome: 'Amuleto d’osso', costo: 3 },
    acqua: { nome: 'Acqua santa', costo: 3 },
    grimorio: { nome: 'Grimorio nero', costo: 5 },
    specchio: { nome: 'Specchio rotto', costo: 15 }
  };
  var POTERI = Object.keys(NEGOZIO);
  var GRADI = [{ da: 7, nome: 'Dio oscuro' }, { da: 5, nome: 'Signore della cripta' }, { da: 3, nome: 'Ladro di tombe' }, { da: 1, nome: 'Cibo per vermi' }];

  function no(perche) { return { ok: false, perche: perche }; }
  var OK = { ok: true };

  // ---------- le carte e il mazzo ----------
  function mazzoCompleto() {
    var m = [];
    for (var s = 0; s < 4; s++) for (var r = 1; r <= 13; r++) m.push({ id: s * 13 + r - 1, r: r, s: s });
    m.push({ id: 52, r: 0, s: -1, jolly: true }, { id: 53, r: 0, s: -1, jolly: true });
    return m;
  }
  function casuale(seme) { // mulberry32
    var a = seme >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mescola(g, carte) {
    var m = carte.slice();
    for (var i = m.length - 1; i > 0; i--) { var j = Math.floor(g.rnd() * (i + 1)), t = m[i]; m[i] = m[j]; m[j] = t; }
    return m;
  }
  // La cima del mazzo è la fine della lista. Se il mazzo è finito: rimescoli gli scarti; se non ci sono, metà del cimitero
  // (le entrate per prime, per eccesso) torna nel mazzo.
  function rifornisci(g) {
    if (g.scarti.length) {
      g.mazzo = mescola(g, g.scarti); g.scarti = [];
      g.note.push('Il mazzo era finito: ho rimescolato gli scarti.');
      return;
    }
    if (!g.cimitero.length) throw new Error('CRYBT: non ci sono più carte da pescare');
    g.mazzo = mescola(g, g.cimitero.splice(0, Math.ceil(g.cimitero.length / 2)));
    g.note.push('Mazzo e scarti finiti: metà del cimitero torna nel mazzo.');
  }
  function pesca(g) {
    if (!g.mazzo.length) rifornisci(g);
    return g.mazzo.pop();
  }
  function pescaN(g, n) {
    var m = [];
    for (var i = 0; i < n; i++) m.push(pesca(g));
    return m;
  }
  function trova(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  function senza(lista, tolte) { return lista.filter(function (c) { return tolte.indexOf(c) < 0; }); }

  // ---------- la partita ----------
  function nuova(seme) {
    var g = { seme: seme, rnd: casuale(seme), mazzo: [], scarti: [], cimitero: [], offerta: [], vita: VITA_MAX, giro: 1, incontro: 1,
      poteri: {}, torciaUsata: false, punti: 0, riserva: 0, regalo: false, paesano: null, offertaConto: null, morto: false, note: [], fase: '' };
    g.mazzo = mescola(g, mazzoCompleto());
    iniziaIncontro(g);
    return g;
  }
  function azzeraIncontro(g) {
    g.mano = []; g.eroe = null; g.mostro = null; g.visto = false; g.scambiato = false; g.prestito = null; g.mangiato = false;
    g.spenti = false; g.lich = 0; g.forza = 0; g.conto = null; g.esito = null; g.usate = null;
  }
  // P1 (Amuleto), P2 (pesca 5, o 6 col Grimorio), P3 (con la Torcia si gira il mostro: resta lì ad aspettare il P7)
  function iniziaIncontro(g) {
    azzeraIncontro(g);
    if (g.poteri.amuleto) g.vita = Math.min(VITA_MAX, g.vita + 2);
    g.mano = pescaN(g, g.poteri.grimorio ? 6 : 5);
    if (g.poteri.torcia) { g.mostro = pesca(g); g.visto = true; }
    g.fase = 'offerta';
  }

  // La Torcia nuova: scacci qualunque mostro, una volta per discesa, solo mentre lo vedi (prima di scegliere l'offerta).
  function puoScacciare(g) { return !!g.poteri.torcia && !g.torciaUsata && g.fase === 'offerta' && g.visto; }
  function scaccia(g) {
    if (!puoScacciare(g)) return no('Adesso non puoi scacciare il mostro.');
    var nuovo = pesca(g);
    g.mazzo.unshift(g.mostro);
    g.mostro = nuovo; g.torciaUsata = true;
    return OK;
  }

  // P4 (e col Grimorio la sesta carta agli scarti), P5 (si pesca l'eroe)
  function scegliOfferta(g, idOfferta, idScarto) {
    if (g.fase !== 'offerta') return no('Adesso non si sceglie l’offerta.');
    var carta = trova(g.mano, idOfferta), scarto = g.poteri.grimorio ? trova(g.mano, idScarto) : null;
    if (!carta) return no('Scegli una carta della mano.');
    if (g.poteri.grimorio && (!scarto || scarto === carta)) return no('Col Grimorio scegli anche la carta da scartare.');
    g.offerta.push(carta);
    if (scarto) g.scarti.push(scarto);
    g.mano = senza(g.mano, [carta, scarto]);
    g.eroe = pesca(g);
    g.fase = 'eroe';
    return OK;
  }

  // P6: scambi l'eroe, una volta, con una carta del cimitero. L'eroe lasciato entra nel cimitero (il jolly no: agli scarti).
  function scambia(g, idCimitero) {
    if (g.fase !== 'eroe' || g.scambiato) return no('Non puoi scambiare l’eroe.');
    var presa = trova(g.cimitero, idCimitero);
    if (!presa) return no('Scegli una carta del cimitero.');
    g.cimitero = senza(g.cimitero, [presa]);
    (g.eroe.jolly ? g.scarti : g.cimitero).push(g.eroe);
    g.eroe = presa; g.prestito = presa; g.scambiato = true;
    return OK;
  }

  // Brucia il cimitero (agli scarti), compresa la carta presa in prestito come eroe: il Lich la conta nella sua forza, il jolly-mostro no (deciso 27/10).
  function brucia(g, conPrestito) {
    var n = g.cimitero.length;
    g.scarti = g.scarti.concat(g.cimitero); g.cimitero = [];
    if (conPrestito && g.prestito) { n++; g.prestito = null; }
    return n;
  }
  // I boss, per valore della carta. Il Fante mangia l'eroe dello stesso seme; la Regina spegne i poteri dello scontro; il Re è il Lich.
  var BOSS = {
    11: function (g) { if (!g.eroe.jolly && g.eroe.s === g.mostro.s) g.mangiato = true; },
    12: function (g) { g.spenti = true; },
    13: function (g) { g.lich = brucia(g, true); }
  };
  function forza(g) {
    var f = Conto.valore(g.mostro) + g.giro + g.lich;
    return g.poteri.acqua && !g.spenti ? f - 2 : f;
  }
  // P7: giri il mostro (con la Torcia è già girato). Un jolly-mostro brucia il cimitero, va agli scarti, e giri un altro mostro.
  function giraMostro(g) {
    g.mostro = g.mostro || pesca(g);
    while (g.mostro.jolly) {
      brucia(g, true);
      g.scarti.push(g.mostro);
      g.note.push('Un jolly: il cimitero brucia e si gira un altro mostro.');
      g.mostro = pesca(g);
    }
    g.visto = true;
  }
  // Le carte che si contano: le 4 in mano, l'eroe (se non è stato mangiato) e, con lo Specchio acceso, la sua copia.
  function manoConto(g) {
    var c = g.mano.map(function (x) { return Object.assign({}, x); });
    if (!g.mangiato) {
      c.push(Object.assign({}, g.eroe, { eroe: true }));
      if (g.poteri.specchio && !g.spenti) c.push(Object.assign({}, g.eroe, { eroe: true, copia: true }));
    }
    return ordina(c);
  }
  function ordina(c) {
    return c.sort(function (a, b) { return (a.jolly ? 99 : a.r) - (b.jolly ? 99 : b.r) || a.s - b.s; });
  }
  function affronta(g) {
    if (g.fase !== 'eroe') return no('Adesso non si affronta il mostro.');
    giraMostro(g);
    if (BOSS[g.mostro.r]) BOSS[g.mostro.r](g);
    g.forza = forza(g);
    if (g.eroe.jolly) { g.conto = { carte: [], dich: [], mancate: [] }; return chiudiIncontro(g, { jolly: true, vinto: true, tuoi: 0, persi: 0, sfuggite: 0, bersaglio: g.forza, danni: 0 }); }
    g.conto = { carte: manoConto(g), dich: [], mancate: [] };
    g.fase = 'conto';
    return OK;
  }

  // P8: il conto lo dichiari tu. Vale per la mano e per l'offerta.
  function dichiara(g, tipo, idx) {
    if (g.fase !== 'conto' && g.fase !== 'conto-offerta') return no('Adesso non si conta.');
    var r = Conto.dichiara(g.conto.carte, tipo, idx, g.conto.dich);
    if (r.ok) g.conto.dich.push(r.comb);
    return r;
  }
  function hoContato(g) {
    if (g.fase !== 'conto' && g.fase !== 'conto-offerta') return no('Adesso non si conta.');
    var c = g.conto;
    c.mancate = Conto.sfuggite(c.carte, c.dich);
    return g.fase === 'conto' ? giudicaMano(g) : chiudiOfferta(g);
  }
  // P9: quello che dimentichi è perso e dà +1 al mostro per ogni combinazione
  function giudicaMano(g) {
    var c = g.conto, tuoi = Conto.totale(c.dich), bersaglio = g.forza + c.mancate.length;
    return chiudiIncontro(g, { jolly: false, vinto: tuoi >= bersaglio, tuoi: tuoi, persi: Conto.totale(c.mancate), sfuggite: c.mancate.length,
      bersaglio: bersaglio, danni: Math.max(0, bersaglio - tuoi) });
  }
  // P9-P10: il mostro battuto entra nel cimitero (altrimenti agli scarti e perdi vita); le carte usate vanno agli scarti,
  // tranne la carta del cimitero usata come eroe, che ci torna se non è stata mangiata né bruciata dal Lich.
  function chiudiIncontro(g, esito) {
    g.esito = esito;
    if (esito.vinto) g.cimitero.push(g.mostro); else { g.scarti.push(g.mostro); g.vita = Math.max(0, g.vita - esito.danni); }
    g.scarti = g.scarti.concat(g.mano);
    (g.prestito && !g.mangiato ? g.cimitero : g.scarti).push(g.eroe);
    g.usate = { mano: g.mano, eroe: g.eroe, mostro: g.mostro };
    g.mano = []; g.eroe = null; g.mostro = null; g.prestito = null;
    g.morto = g.vita <= 0;
    g.fase = 'esito';
    return OK;
  }

  function continua(g) {
    if (g.fase !== 'esito') return no('Adesso non si continua.');
    g.note = [];
    if (g.morto) g.fase = 'fine';
    else if (g.incontro < INCONTRI) { g.incontro++; iniziaIncontro(g); }
    else fineDiscesa(g);
    return OK;
  }

  // ---------- l'offerta e il negozio ----------
  // Dopo il quarto incontro: i poteri finiscono (durano una discesa), si gira il paesano e si conta l'offerta come una mano.
  function fineDiscesa(g) {
    g.poteri = {};
    g.paesano = pesca(g);
    g.regalo = !!g.paesano.jolly;
    var carte = g.offerta.map(function (x) { return Object.assign({}, x); });
    carte.push(Object.assign({}, g.paesano, { paesano: true }));
    g.conto = { carte: ordina(carte), dich: [], mancate: [] };
    g.fase = 'conto-offerta';
  }
  // I punti: quelli dichiarati, +1 per ogni carta nel cimitero (prima che il paesano ci entri), più quelli tenuti dalla discesa prima.
  // Il paesano si rialza: entra nel cimitero (il jolly no, agli scarti).
  function chiudiOfferta(g) {
    var c = g.conto, dichiarati = Conto.totale(c.dich);
    g.offertaConto = { dichiarati: dichiarati, cimitero: g.cimitero.length, riserva: g.riserva, persi: Conto.totale(c.mancate), sfuggite: c.mancate.length };
    g.punti = dichiarati + g.cimitero.length + g.riserva; g.riserva = 0;
    (g.paesano.jolly ? g.scarti : g.cimitero).push(g.paesano);
    g.paesano = null;
    g.fase = 'negozio';
    return OK;
  }
  function cura(g) {
    if (g.vita >= VITA_MAX) return no('Hai già tutta la vita.');
    if (g.punti < 1) return no('Non hai punti.');
    g.punti--; g.vita = Math.min(VITA_MAX, g.vita + 2);
    return OK;
  }
  function compra(g, nome) {
    if (g.fase !== 'negozio') return no('Il negozio è chiuso.');
    if (nome === 'cura') return cura(g);
    var p = NEGOZIO[nome];
    if (!p) return no('Questo non si vende.');
    if (g.poteri[nome]) return no('Ce l’hai già.');
    if (g.punti < p.costo) return no('Non bastano i punti.');
    g.punti -= p.costo; g.poteri[nome] = true;
    return OK;
  }
  // Il jolly come paesano: un potere gratis a tua scelta (e puoi spendere lo stesso l'offerta)
  function regaloPossibile(g) { return g.regalo && POTERI.some(function (n) { return !g.poteri[n]; }); }
  function prendiGratis(g, nome) {
    if (g.fase !== 'negozio' || !regaloPossibile(g)) return no('Non c’è nessun regalo.');
    if (!NEGOZIO[nome] || g.poteri[nome]) return no('Scegli un potere che non hai.');
    g.poteri[nome] = true; g.regalo = false;
    return OK;
  }
  // Si torna giù: i punti non spesi si perdono (o si tengono, con l'interruttore); si rimescolano nel mazzo gli scarti
  // e le quattro carte dell'offerta (il cimitero no); il contatore sale e comincia la discesa dopo.
  function esci(g) {
    if (g.fase !== 'negozio') return no('Il negozio è chiuso.');
    if (regaloPossibile(g)) return no('Il jolly ti regala un potere: prendilo prima di scendere.');
    g.riserva = CONFIG.tenerePunti ? g.punti : 0; g.punti = 0;
    g.mazzo = mescola(g, g.mazzo.concat(g.scarti, g.offerta));
    g.scarti = []; g.offerta = []; g.offertaConto = null; g.conto = null; g.regalo = false;
    g.giro++; g.incontro = 1; g.torciaUsata = false; g.note = [];
    iniziaIncontro(g);
    return OK;
  }

  // ---------- fuori partita: gradi, record, controllo ----------
  function grado(giro) {
    for (var i = 0; i < GRADI.length; i++) if (giro >= GRADI[i].da) return GRADI[i].nome;
    return GRADI[GRADI.length - 1].nome;
  }
  // Il record personale: il giro più alto in cui sei arrivato. Dà il nuovo record e se questa partita lo ha battuto.
  function aggiornaRecord(vecchio, giro) {
    var v = vecchio || 0;
    return { record: Math.max(v, giro), nuovo: giro > v };
  }
  // Tutte le carte della partita, ovunque stiano (per controllare che siano sempre 54, ognuna una volta)
  function tutteLeCarte(g) {
    var l = [].concat(g.mazzo, g.scarti, g.cimitero, g.offerta, g.mano);
    [g.eroe, g.mostro, g.paesano].forEach(function (c) { if (c) l.push(c); });
    return l;
  }

  var API = { CONFIG: CONFIG, NEGOZIO: NEGOZIO, POTERI: POTERI, VITA_MAX: VITA_MAX, INCONTRI: INCONTRI, GRADI: GRADI, Conto: Conto,
    nuova: nuova, scaccia: scaccia, puoScacciare: puoScacciare, scegliOfferta: scegliOfferta, scambia: scambia, affronta: affronta,
    dichiara: dichiara, hoContato: hoContato, continua: continua, compra: compra, prendiGratis: prendiGratis, regaloPossibile: regaloPossibile,
    esci: esci, grado: grado, aggiornaRecord: aggiornaRecord, tutteLeCarte: tutteLeCarte, forza: forza, mazzoCompleto: mazzoCompleto };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else radice.Crybt = API;
})(typeof window !== 'undefined' ? window : this);
