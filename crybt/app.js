// CRYBT — l'interfaccia dello scheletro. Il motore (regole e stato) è in conto.js e engine.js: qui solo disegno e tocchi.
// Ogni schermata è una funzione «vista…»; i tocchi chiamano una azione del motore e ridisegnano. Testi provvisori (li rivede Penna).
(function () {
  'use strict';
  var E = window.Crybt, C = E.Conto, app = document.getElementById('app');
  var SEMI = ['♠', '♥', '♦', '♣'], NOMI_R = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SEMI_NOMI = ['picche', 'cuori', 'quadri', 'fiori'];
  var BOSS = { 11: ['Fante', 'Lupo mannaro'], 12: ['Regina', 'Spettro'], 13: ['Re', 'Lich'] };
  var CHIAVE_RECORD = 'crybt-record';
  var VENDITA = {
    cura: '1 punto = 2 punti vita, fino a 20', amuleto: 'A ogni incontro ti curi di 2', acqua: 'I mostri hanno −2 di forza',
    grimorio: 'Peschi 6 carte: una va agli scarti', torcia: 'Vedi il mostro prima dell’offerta; una volta per discesa lo scacci',
    specchio: 'L’eroe conta due volte'
  };
  var GUIDA = [
    ['Quanto valgono le carte', 'le figure (J, Q, K) valgono 10, l’Asso 1, le altre il loro numero. Serve solo per i quindici.'],
    ['Quindici — 2 punti', 'ogni gruppo di carte che sommate fanno 15. Ogni gruppo diverso conta a parte.'],
    ['Coppia — 2 punti', 'due carte dello stesso valore. Tre uguali fanno tre coppie (6 punti), quattro uguali sei coppie (12).'],
    ['Scala — 1 punto per carta', 'tre o più valori di fila, di qualsiasi seme. L’Asso sta solo sotto il 2. Se c’è una carta doppia, le scale sono due.'],
    ['Colore — 1 punto per carta', 'quattro o più carte dello stesso seme.'],
    ['Come si dichiara', 'tocchi le carte di una combinazione, poi premi cos’è. Quello che dimentichi è perso, e il mostro prende +1 per ogni combinazione dimenticata.']
  ];

  var g = null;     // la partita
  var ui = { sel: [], msg: '', ok: false, cimitero: null, presa: null, evid: [], guida: false, seme: null, record: 0, fine: null, ultimaFase: '' };

  // ---------- attrezzi ----------
  function el(tag, cls, testo) { var e = document.createElement(tag); if (cls) e.className = cls; if (testo != null) e.textContent = testo; return e; }
  function bottone(testo, cls, fn, id) {
    var b = el('button', cls, testo); b.type = 'button'; b.addEventListener('click', fn);
    if (id) b.id = id;
    return b;
  }
  function rossa(c) { return c.s === 1 || c.s === 2; }
  function nomeCarta(c) { return c.jolly ? 'Jolly' : NOMI_R[c.r] + ' di ' + SEMI_NOMI[c.s]; }
  function ordinate(carte) { return carte.slice().sort(function (a, b) { return a.r - b.r || a.s - b.s; }); }

  // una carta: pulsante se si può toccare, altrimenti un riquadro
  function classiCarta(c, opz) {
    return 'carta' + (rossa(c) ? ' R' : '') + (c.jolly ? ' jolly' : '') + (opz.sel ? ' scelta' : '') + (opz.evid ? ' evid' : '');
  }
  function cartaEl(c, opz) {
    var b = el(opz.tocco ? 'button' : 'span', classiCarta(c, opz));
    b.setAttribute('aria-label', nomeCarta(c)); b.setAttribute('data-id', c.id);
    var v = el('span', 'v', c.jolly ? 'JK' : NOMI_R[c.r]); v.appendChild(el('i', '', c.jolly ? '★' : SEMI[c.s]));
    b.appendChild(v); b.appendChild(el('span', 's', c.jolly ? '★' : SEMI[c.s]));
    if (opz.tocco) { b.type = 'button'; b.addEventListener('click', opz.tocco); }
    return b;
  }
  function slot(c, opz, etichetta) {
    var d = el('div', 'slot'); d.appendChild(cartaEl(c, opz)); d.appendChild(el('span', 'etic', etichetta || ''));
    return d;
  }
  function fila(carte, fare) {
    var f = el('div', 'fila n' + Math.max(4, carte.length));
    carte.forEach(function (c, i) { f.appendChild(fare(c, i)); });
    return f;
  }

  // ---------- il record ----------
  function leggiRecord() { try { return parseInt(localStorage.getItem(CHIAVE_RECORD), 10) || 0; } catch (e) { return 0; } }
  function scriviRecord(n) { try { localStorage.setItem(CHIAVE_RECORD, String(n)); } catch (e) { /* senza memoria va bene lo stesso */ } }
  function controllaFine() {
    if (g.fase !== 'fine' || ui.fine) return;
    ui.fine = E.aggiornaRecord(ui.record, g.giro);
    ui.record = ui.fine.record; scriviRecord(ui.record);
  }

  // ---------- i tocchi ----------
  // Fa l'azione del motore: se va, pulisce la scelta; se no, mostra il perché.
  function esegui(r, messaggio) {
    ui.ok = r.ok; ui.msg = r.ok ? (messaggio || '') : r.perche;
    if (r.ok) { ui.sel = []; ui.evid = []; }
    controllaFine(); disegna();
  }
  function tocca(lista, valore, quanti) {
    var p = lista.indexOf(valore);
    if (p >= 0) lista.splice(p, 1);
    else { if (lista.length >= quanti) lista.pop(); lista.push(valore); }
    ui.msg = ''; disegna();
  }
  function nuovaPartita() {
    var seme = ui.seme != null ? ui.seme : Math.floor(Math.random() * 900000) + 100000;
    ui.seme = null; ui.fine = null; ui.sel = []; ui.msg = ''; ui.cimitero = null;
    g = E.nuova(seme);
    try { history.replaceState(null, '', '#' + seme); } catch (e) { /* file:// */ }
    disegna();
  }

  // ---------- pezzi di schermata ----------
  function testa() {
    var t = el('div', 'top'); t.appendChild(el('h1', '', 'CRYBT'));
    var dx = el('div', 'dx');
    dx.appendChild(bottone('Come si conta', 'mini', function () { ui.guida = true; disegna(); }, 'come-si-conta'));
    t.appendChild(dx); app.appendChild(t);
  }
  function voce(etichetta, valore) {
    var v = el('div', 'voce'); v.appendChild(el('small', '', etichetta)); v.appendChild(el('b', '', valore));
    return v;
  }
  function stato() {
    var s = el('div', 'stato');
    s.appendChild(voce('VITA', g.vita + '/' + E.VITA_MAX));
    s.appendChild(voce('DISCESA', String(g.giro)));
    s.appendChild(voce('INCONTRO', g.incontro + ' di ' + E.INCONTRI));
    var cim = bottone('', 'voce', function () { ui.cimitero = 'vedi'; disegna(); }, 'apri-cimitero');
    cim.appendChild(el('small', '', 'CIMITERO')); cim.appendChild(el('b', '', String(g.cimitero.length)));
    s.appendChild(cim); app.appendChild(s);
    var p = el('div', 'chips');
    E.POTERI.filter(function (n) { return g.poteri[n]; }).forEach(function (n) { p.appendChild(el('span', 'chip', E.NEGOZIO[n].nome)); });
    if (!p.childNodes.length) p.appendChild(document.createTextNode('Nessun potere in questa discesa'));
    p.appendChild(el('span', '', ' · mazzo ' + g.mazzo.length + ' · scarti ' + g.scarti.length + ' · offerta ' + g.offerta.length));
    app.appendChild(p);
  }
  function avvisi() { g.note.forEach(function (n) { app.appendChild(el('div', 'nota', n)); }); }
  function messaggio() { app.appendChild(el('div', 'msg' + (ui.ok ? ' ok' : ''), ui.msg)); }
  function azioni(lista) {
    var a = el('div', 'azioni');
    lista.forEach(function (b) { a.appendChild(b); });
    app.appendChild(a);
  }

  // ---------- il mostro ----------
  function mostroCorrente() { return g.mostro || (g.usate && g.usate.mostro); }
  function nomeMostro(m) {
    if (!m) return 'Mostro nascosto';
    return BOSS[m.r] ? BOSS[m.r][0] + ', il ' + BOSS[m.r][1] : 'Mostro';
  }
  function forzaTesto() {
    var m = mostroCorrente();
    if (!m || m.jolly) return '';
    if (g.fase === 'conto' || g.fase === 'esito') return 'Forza ' + g.forza + (g.fase === 'esito' && g.esito.sfuggite ? ' + ' + g.esito.sfuggite + ' dimenticate = ' + g.esito.bersaglio : '');
    return 'Valore ' + C.valore(m) + ' + discesa ' + g.giro;
  }
  function titoloMostro(m) {
    if (!m || !g.visto) return 'Mostro nascosto';
    return m.jolly ? 'Jolly: divora il cimitero' : nomeMostro(m);
  }
  function mostroBox() {
    var m = mostroCorrente(), b = el('div', 'mostro'), t = el('div', 'testo');
    b.id = 'mostro';
    b.appendChild(m && g.visto ? cartaEl(m, {}) : el('span', 'dorso'));
    t.appendChild(el('span', 'nome', titoloMostro(m)));
    t.appendChild(el('b', '', forzaTesto()));
    if (g.visto && (g.fase === 'offerta' || g.fase === 'eroe')) t.appendChild(el('span', '', 'Visto con la Torcia: lo affronti dopo.'));
    b.appendChild(t); app.appendChild(b);
  }
  function effetti() {
    var r = [], m = mostroCorrente();
    if (g.mangiato) r.push('Luna piena: il Lupo mannaro ha mangiato il tuo eroe. Conti con le sole 4 carte.');
    if (g.spenti) r.push('Lo Spettro spegne i tuoi poteri in questo incontro.');
    if (m && m.r === 13) r.push(g.lich ? 'Il Lich brucia il cimitero: +' + g.lich + ' di forza.' : 'Il Lich non trova niente da bruciare.');
    r.forEach(function (x) { app.appendChild(el('div', 'nota', x)); });
  }

  // ---------- schermate ----------
  function vistaInizio() {
    var c = el('div', 'cop');
    c.appendChild(el('h1', '', 'CRYBT'));
    c.appendChild(el('p', '', 'Sei un negromante. Scendi nelle catacombe sotto la torre e sconfiggi i mostri: i loro corpi finiscono nel tuo cimitero e diventano il tuo esercito. Resisti più che puoi.'));
    if (ui.record) c.appendChild(el('p', '', 'Il tuo record: discesa ' + ui.record + ' (' + E.grado(ui.record) + ')'));
    c.appendChild(bottone('Scendi', 'grande primo', nuovaPartita, 'scendi'));
    app.appendChild(c);
  }

  function vistaOfferta() {
    var n = g.poteri.grimorio ? 2 : 1;
    mostroBox(); avvisi();
    app.appendChild(el('div', 'etichetta', 'La tua mano: ' + (n === 2 ? 'scegli la carta per l’offerta, poi quella da scartare' : 'scegli la carta per l’offerta')));
    app.appendChild(fila(g.mano, function (c) {
      var p = ui.sel.indexOf(c.id);
      return slot(c, { sel: p >= 0, tocco: function () { tocca(ui.sel, c.id, n); } }, p === 0 ? 'OFFERTA' : (p === 1 ? 'SCARTO' : ''));
    }));
    messaggio();
    var lista = [];
    if (E.puoScacciare(g)) lista.push(bottone('Scaccia il mostro', '', function () { esegui(E.scaccia(g), 'Il mostro va in fondo al mazzo. Ne giri un altro.'); }, 'scaccia'));
    var conferma = bottone('Conferma', 'conferma', function () { esegui(E.scegliOfferta(g, ui.sel[0], ui.sel[1]), 'Hai pescato l’eroe.'); }, 'conferma');
    conferma.disabled = ui.sel.length < n;
    lista.push(conferma); azioni(lista);
  }

  function vistaEroe() {
    mostroBox(); avvisi();
    app.appendChild(el('div', 'etichetta', 'La tua mano e l’eroe'));
    var carte = g.mano.concat([g.eroe]);
    app.appendChild(fila(carte, function (c, i) { return slot(c, {}, i === carte.length - 1 ? (g.scambiato ? 'EROE (dal cimitero)' : 'EROE') : ''); }));
    messaggio();
    var lista = [];
    if (g.cimitero.length && !g.scambiato) lista.push(bottone('Scambia l’eroe', '', function () { ui.cimitero = 'scambio'; ui.presa = null; disegna(); }, 'scambia'));
    lista.push(bottone('Affronta il mostro', 'conferma', function () { esegui(E.affronta(g), ''); }, 'affronta'));
    azioni(lista);
  }

  // Le carte che si contano, con i tasti di dichiarazione quando si conta. Vale per la mano e per l'offerta.
  function carteDelConto(conta) {
    var carte = g.conto.carte;
    if (!carte.length) { app.appendChild(slot(g.usate.eroe, {}, 'EROE')); return; }   // il jolly eroe: nessun conto
    app.appendChild(fila(carte, function (c, i) {
      var s = slot(c, { sel: conta && ui.sel.indexOf(i) >= 0, evid: ui.evid.indexOf(i) >= 0, tocco: conta ? function () { tocca(ui.sel, i, 99); } : null },
        c.copia ? 'COPIA' : (c.eroe ? 'EROE' : (c.paesano ? 'PAESANO' : '')));
      s.firstChild.setAttribute('data-i', i);
      return s;
    }));
  }
  function tastiTipi() {
    var t = el('div', 'tipi');
    C.TIPI.forEach(function (tp) {
      var b = bottone(C.NOMI[tp], '', function () { var r = E.dichiara(g, tp, ui.sel); esegui(r, r.ok ? r.formula + '.' : ''); });
      b.setAttribute('data-tipo', tp); t.appendChild(b);
    });
    app.appendChild(t);
  }
  function etichettaComb(d) { return C.NOMI[d.tipo] + ' ' + C.parola(d.punti); }
  function pannelloConto(chiuso) {
    var co = el('div', 'conto'), ri = el('div', 'riga');
    ri.appendChild(el('span', '', 'IL TUO CONTO')); ri.appendChild(el('b', '', String(C.totale(g.conto.dich)))); co.appendChild(ri);
    var fi = el('div', 'fiches'), run = 0;
    g.conto.dich.forEach(function (d) { run += d.punti; fi.appendChild(el('span', 'fiche', C.NOMI[d.tipo] + ' ' + C.parola(run))); });
    if (chiuso && g.conto.mancate.length) fi.appendChild(el('span', 'al-mostro', g.fase === 'esito' ? 'DIMENTICATE: +1 AL MOSTRO' : 'DIMENTICATE: PERSE'));
    if (chiuso) g.conto.mancate.forEach(function (d) {
      var f = bottone(etichettaComb(d) + (g.fase === 'esito' ? ' · +1' : ''), 'fiche perso', function () { ui.evid = d.idx; disegna(); });
      fi.appendChild(f);
    });
    co.appendChild(fi); app.appendChild(co);
  }

  function vistaConto() {
    mostroBox(); effetti(); avvisi(); carteDelConto(true); tastiTipi(); messaggio(); pannelloConto(false);
    azioni([bottone('Ho contato', 'conferma', function () { esegui(E.hoContato(g), ''); }, 'ho-contato')]);
  }

  function esitoBox() {
    var e = g.esito, box = el('div', 'esito ' + (e.vinto ? 'vinto' : 'perso'));
    if (e.jolly) box.appendChild(el('b', '', 'Il jolly vince da solo'));
    else box.appendChild(el('b', '', e.vinto ? 'Mostro sconfitto' : 'Subisci ' + e.danni + (e.danni === 1 ? ' danno' : ' danni')));
    if (!e.jolly) box.appendChild(document.createTextNode('Hai dichiarato ' + e.tuoi + ' punti; la forza era ' + e.bersaglio + '.'));
    if (g.morto) box.appendChild(el('small', '', 'Sei a 0 punti vita.'));
    app.appendChild(box);
  }
  function vistaEsito() {
    mostroBox(); effetti(); avvisi(); carteDelConto(false);
    if (!g.esito.jolly) pannelloConto(true);
    esitoBox();
    azioni([bottone(g.morto ? 'Fine' : 'Continua', 'conferma', function () { esegui(E.continua(g), ''); }, 'continua')]);
  }

  function vistaContoOfferta() {
    avvisi();
    app.appendChild(el('div', 'pannello', 'Torni su. Conta l’offerta: le 4 carte messe da parte e il paesano. In più, 1 punto per ogni carta del cimitero (ora ' + g.cimitero.length + ').'));
    if (g.regalo) app.appendChild(el('div', 'nota', 'Il paesano è un jolly: vale niente, ma ti regala un potere.'));
    carteDelConto(true); tastiTipi(); messaggio(); pannelloConto(false);
    azioni([bottone('Ho contato', 'conferma', function () { esegui(E.hoContato(g), ''); }, 'ho-contato')]);
  }

  function rigaOfferta() {
    var o = g.offertaConto, r = el('div', 'pannello');
    r.appendChild(el('div', 'etichetta', 'L’offerta vale'));
    r.appendChild(el('div', 'punti-grandi', String(o.dichiarati + o.cimitero + o.riserva)));
    var dettaglio = 'Conto ' + o.dichiarati + ' + cimitero ' + o.cimitero + (o.riserva ? ' + tenuti ' + o.riserva : '');
    r.appendChild(el('div', 'dettaglio', dettaglio + (o.sfuggite ? '. Dimenticate ' + o.sfuggite + ' (' + o.persi + ' punti persi).' : '.')));
    app.appendChild(r);
  }
  function voceVendita(nome) {
    var gratis = g.regalo && nome !== 'cura', preso = !!g.poteri[nome];
    var b = bottone('', 'v-' + nome + (preso ? ' preso' : '') + (gratis && !preso ? ' gratis' : ''), function () {
      esegui(gratis ? E.prendiGratis(g, nome) : E.compra(g, nome), '');
    });
    b.setAttribute('data-voce', nome);
    b.appendChild(el('span', '', nome === 'cura' ? 'Cura' : E.NEGOZIO[nome].nome));
    b.appendChild(el('span', 'costo', preso ? 'preso' : (nome === 'cura' ? '1' : (gratis ? 'gratis' : String(E.NEGOZIO[nome].costo)))));
    b.appendChild(el('small', '', VENDITA[nome]));
    return b;
  }
  function vistaNegozio() {
    avvisi(); rigaOfferta();
    app.appendChild(el('div', 'etichetta', 'Punti da spendere'));
    app.appendChild(el('div', 'punti-grandi', String(g.punti)));
    app.appendChild(el('div', 'dettaglio', E.CONFIG.tenerePunti ? 'I punti che non spendi restano per la discesa dopo.' : 'I punti che non spendi si perdono.'));
    if (E.regaloPossibile(g)) app.appendChild(el('div', 'nota', 'Il jolly ti regala un potere: toccane uno, è gratis.'));
    var v = el('div', 'vendita');
    ['cura'].concat(E.POTERI).forEach(function (n) { v.appendChild(voceVendita(n)); });
    app.appendChild(v); messaggio();
    azioni([bottone('Scendi', 'conferma', function () { esegui(E.esci(g), ''); }, 'scendi-giu')]);
  }

  function vistaFine() {
    var p = el('div', 'pannello fine');
    p.appendChild(el('h2', '', 'Sei morto'));
    p.appendChild(el('div', 'etichetta', 'Discesa'));
    p.appendChild(el('div', 'punteggio', String(g.giro)));
    p.appendChild(el('div', 'dettaglio', E.grado(g.giro)));
    p.appendChild(el('div', 'dettaglio', ui.fine.nuovo ? 'Nuovo record personale!' : 'Il tuo record: discesa ' + ui.record));
    p.appendChild(bottone('Nuova partita', 'grande primo', nuovaPartita, 'nuova-partita'));
    app.appendChild(p);
  }

  // ---------- i fogli: cimitero e guida ----------
  function foglioCimitero() {
    var f = el('div', 'foglio'), d = el('div', 'foglio-dentro'), scambio = ui.cimitero === 'scambio';
    f.id = 'foglio-cimitero';
    d.appendChild(el('h2', '', 'Il cimitero (' + g.cimitero.length + ')'));
    d.appendChild(el('p', '', scambio ? 'Scegli la carta che diventa il tuo eroe. L’eroe che lasci entra nel cimitero.' : 'Il tuo esercito: i mostri sconfitti e i paesani.'));
    var griglia = el('div', 'griglia-cimitero');
    ordinate(g.cimitero).forEach(function (c) {
      griglia.appendChild(cartaEl(c, { sel: ui.presa === c.id, tocco: scambio ? function () { ui.presa = c.id; disegna(); } : null }));
    });
    d.appendChild(griglia);
    var a = el('div', 'azioni');
    a.appendChild(bottone('Chiudi', '', function () { ui.cimitero = null; disegna(); }, 'chiudi-cimitero'));
    if (scambio) {
      var s = bottone('Scambia con questa', 'conferma', function () { ui.cimitero = null; esegui(E.scambia(g, ui.presa), 'Eroe scambiato.'); }, 'conferma-scambio');
      s.disabled = ui.presa == null; a.appendChild(s);
    }
    d.appendChild(a); f.appendChild(d); app.appendChild(f);
  }
  function foglioGuida() {
    var f = el('div', 'foglio'), d = el('div', 'foglio-dentro');
    f.id = 'guida'; d.appendChild(el('h2', '', 'Come si conta'));
    GUIDA.forEach(function (x) { var p = el('p', ''); p.appendChild(el('b', '', x[0] + ': ')); p.appendChild(document.createTextNode(x[1])); d.appendChild(p); });
    d.appendChild(bottone('Chiudi', 'quieto', function () { ui.guida = false; disegna(); }, 'chiudi-guida'));
    f.appendChild(d); app.appendChild(f);
  }

  // ---------- il disegno ----------
  var VISTE = { offerta: vistaOfferta, eroe: vistaEroe, conto: vistaConto, esito: vistaEsito, 'conto-offerta': vistaContoOfferta, negozio: vistaNegozio, fine: vistaFine };
  function disegna() {
    app.innerHTML = '';
    app.setAttribute('data-fase', g ? g.fase : 'inizio');
    testa();
    if (!g) vistaInizio();
    else { stato(); VISTE[g.fase](); }
    if (ui.cimitero) foglioCimitero();
    if (ui.guida) foglioGuida();
    var fase = g ? g.fase + g.incontro + g.giro : '';
    if (fase !== ui.ultimaFase) { window.scrollTo(0, 0); ui.ultimaFase = fase; }
  }

  var h = parseInt((location.hash || '').replace('#', ''), 10);
  ui.seme = isNaN(h) ? null : h; ui.record = leggiRecord();
  disegna();
})();
