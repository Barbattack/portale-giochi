/*
 * Skyway — la parte che parla col browser. Legge lo stato del motore (engine.js)
 * e lo mostra; non contiene regole. Cambia lo stato solo con Skyway.apply.
 * Nessun suggerimento in partita: si sceglie una pila e una casella (in qualsiasi ordine, toccare di nuovo toglie) e
 * compare un tasto che dice cosa succede («Posa qui», «Posa qui: cadono il 4♥ e il 2♦»): lo si tocca e la pila è posata.
 * Il tasto dice solo il fatto, mai se la posa è buona. Gli aiuti visivi (bordo che pulsa) ci sono solo nel tutorial.
 */
(function () {
  'use strict';
  var S = self.Skyway, D = self.SkywayDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'skyway-visto';

  // Il titolo sta in un punto solo: il <title> di index.html. Qui lo si legge.
  var TITOLO = document.title;
  var CREDITI = { autore: 'Wil Su', collezione: 'Isaludo', link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
                  ispirato: 'prende spunto da Aucteraden, un gioco per il mazzo Decktet' };
  // le tre figure che segnano i giri (la scelta di quali è libera, dice il libro): Fante, Donna, Re
  var SEGNALINI = [{ s: 'S', v: 'F' }, { s: 'H', v: 'D' }, { s: 'C', v: 'R' }];

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore (la partita in corso)
  var sel;           // { pila, casella } (ognuno può essere null)
  var msg, msgOk;
  var demo;          // { i, st, sel, fatto, msg, ok }
  var abbandona;     // true quando si chiede conferma per la nuova partita
  var evid;          // il seme della strada da evidenziare a fine partita, o null

  function el(tag, cls, testo) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (testo != null) e.textContent = testo;
    return e;
  }
  function bottone(testo, cls, fn) {
    var b = el('button', cls, testo); b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function leggiVisto() { try { return localStorage.getItem(CHIAVE) === '1'; } catch (e) { return false; } }
  function scriviVisto() { try { localStorage.setItem(CHIAVE, '1'); } catch (e) { /* senza localStorage la pagina funziona lo stesso */ } }
  function semeIniziale() {
    var m = /[?&]seme=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }
  function crediti() {
    var f = document.getElementById('crediti');
    f.textContent = TITOLO + ' di ' + CREDITI.autore + ', dalla collezione ';
    var a = el('a', null, CREDITI.collezione); a.href = CREDITI.link; a.rel = 'noopener';
    f.appendChild(a);
    f.appendChild(document.createTextNode(': ' + CREDITI.ispirato + '.'));
  }
  function lista(carte) { return carte.map(S.sigla).join(' '); }
  function nomeCasella(c) { return S.NOME_CASELLA[c]; }
  // «l'» davanti a 1 e 8 (l'A♥, l'8♥), «il» davanti agli altri (carte da 1 a 10)
  function articolo(c) { return (c.valore === 1 || c.valore === 8 ? 'l\u2019' : 'il ') + S.sigla(c); }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  // il testo del tasto: il fatto, e basta (cosa cade, se cade qualcosa)
  function etichettaPosa(st, p, c) {
    var cad = S.cosaCade(st, p, c);
    if (!cad.length) return 'Posa qui';
    return 'Posa qui: ' + (cad.length === 1 ? 'cade ' : 'cadono ') + elenco(cad.map(articolo));
  }
  function nomePila(st, p) { var pila = st.mercato[p]; return 'La pila del ' + S.sigla(pila[pila.length - 1]); }
  function iniziale(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  // le carte che cadrebbero con la posa scelta: lo stesso conto del tasto «Posa qui: cade…» (S.cosaCade), solo con pila e casella scelte
  function cadeScelta(st, s) {
    if (s.pila == null || s.casella == null) return null;
    var o = {};
    S.cosaCade(st, s.pila, s.casella).forEach(function (c) { o[c.id] = true; });
    return o;
  }
  // il tasto unico sotto il tavolo: assente finché non ci sono una pila e una casella
  function posaDi(st, s, click) {
    if (s.pila == null || s.casella == null) return null;
    return { testo: etichettaPosa(st, s.pila, s.casella), click: click };
  }
  function rigaPosa(p, suggerita) {
    var r = el('div', 'posa');
    if (p) {
      var b = bottone(p.testo, suggerita ? 'suggerita' : '', p.click);
      b.setAttribute('data-vignetta', 'Posa qui');
      r.appendChild(b);
    }
    return r;
  }
  // ---------- carte, ventaglio, griglia ----------
  /* Una pila di carte in fila, tutte uguali: dal fondo (a sinistra) alla cima (a destra). `posti`: quanti posti ha la casella (i vuoti si disegnano come incavi);
     `cade`: gli id delle carte che con la posa scelta cadrebbero (pendono fuori dalla casella). */
  function ventaglio(carte, tag, cls, etichetta, evidenzia, posti, cade) {
    var e = el(tag, 'ventaglio ' + (carte.length ? 'pieno ' : '') + (cls || ''));
    carte.forEach(function (c, i) {
      var k = el('span', 'carta ' + c.seme + ' i' + i + (i === carte.length - 1 ? ' cima' : '') + (evidenzia && evidenzia[c.id] ? ' evid' : '') + (cade && cade[c.id] ? ' cade' : ''));
      k.setAttribute('data-id', c.id);
      k.appendChild(el('span', 'v', S.etichetta(c.valore)));
      k.appendChild(el('span', 's alto', S.SIMBOLO[c.seme]));
      k.appendChild(el('span', 's basso', S.SIMBOLO[c.seme]));
      e.appendChild(k);
    });
    for (var j = carte.length; j < (posti || 0); j++) { var po = el('span', 'posto'); po.setAttribute('aria-hidden', 'true'); e.appendChild(po); }
    e.setAttribute('aria-label', etichetta + ': ' + (carte.length ? 'dal fondo alla cima ' + carte.map(S.nomeCarta).join(', ') : 'vuota'));
    return e;
  }
  /* o: { stato, scelte:{pile:{i:classe}, caselle:{i:classe}}, clicPila(i) | null, clicCasella(i) | null, evidenzia:{id:true}, cade:{id:true} (le carte che cadrebbero, nella casella scelta) } */
  function tavolo(o) {
    var st = o.stato, box = el('div'), i, b;
    box.appendChild(el('div', 'etichetta', st.fine ? 'Mercato: la partita è finita' : 'Mercato: prendi una pila'));
    var mer = el('div', 'zona mercato');
    for (i = 0; i < 3; i++) {
      (function (k) {
        var carte = st.mercato[k] || [];
        b = ventaglio(carte, o.clicPila && carte.length ? 'button' : 'div', (carte.length ? '' : 'vuotoMercato ') + ((o.scelte.pile && o.scelte.pile[k]) || ''), 'Pila ' + (k + 1) + ' del mercato');
        if (o.clicPila && carte.length) { b.type = 'button'; b.addEventListener('click', function () { o.clicPila(k); }); b.setAttribute('data-vignetta', nomePila(st, k)); }
        mer.appendChild(b);
      }(i));
    }
    box.appendChild(mer);
    box.appendChild(el('div', 'etichetta', 'Griglia'));
    var gr = el('div', 'zona griglia');
    var ult = st.ultimo && st.ultimo.azione === 'gioca' ? st.ultimo.casella : -1;
    for (i = 0; i < 9; i++) {
      (function (k) {
        var cl = ((o.scelte.caselle && o.scelte.caselle[k]) || '') + (k === ult && !(o.scelte.caselle && o.scelte.caselle[k]) ? ' ultima' : '');
        var c = ventaglio(st.griglia[k], o.clicCasella ? 'button' : 'div', cl, 'Casella ' + nomeCasella(k), o.evidenzia, S.ALTEZZA, o.cade);
        if (o.clicCasella) { c.type = 'button'; c.addEventListener('click', function () { o.clicCasella(k); }); c.setAttribute('data-vignetta', iniziale(nomeCasella(k))); }
        gr.appendChild(c);
      }(i));
    }
    box.appendChild(gr);
    return box;
  }
  function barra(st) {
    var b = el('div', 'barra');
    var giri = el('div', 'giri');
    giri.setAttribute('aria-label', 'Giro ' + st.giro + ' di ' + S.GIRI);
    SEGNALINI.forEach(function (m, i) {
      var giu = i < st.giro;               // un segnalino si gira a ogni giro: nel giro 1 è girato il primo
      var e = el('span', 'segnalino ' + (giu ? 'giu' : 'su ' + m.s));
      if (!giu) { e.appendChild(el('span', null, m.v)); e.appendChild(el('span', null, S.SIMBOLO[m.s])); }
      giri.appendChild(e);
    });
    giri.appendChild(el('span', 'testo', 'giro ' + st.giro + ' di ' + S.GIRI));
    b.appendChild(giri);
    var mu = el('div', 'mucchi');
    [['mazzo', 'Mazzo', st.mazzo.length], ['scarti', 'Scarti', st.scarti.length]].forEach(function (x) {
      var m = el('div', 'mucchio ' + x[0]);
      m.setAttribute('aria-label', x[1] + ': ' + x[2] + (x[2] === 1 ? ' carta' : ' carte'));
      m.appendChild(el('span', 'icona ' + x[0]));
      m.appendChild(el('b', null, String(x[2])));
      mu.appendChild(m);
    });
    b.appendChild(mu);
    return b;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, TITOLO));
    var dx = el('div'); dx.style.display = 'flex'; dx.style.gap = '6px';
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }

  // ---------- il conteggio finale (partita e demo) ----------
  var NOMI = { H: 'Cuori', D: 'Quadri', C: 'Fiori', S: 'Picche' };
  function evidenziaSeme(st) {
    var o = {};
    if (evid && st.fine) st.fine.sequenze[evid].percorso.forEach(function (n) { o[n.carta.id] = true; });
    return o;
  }
  function pannelloFine(st, extra) {
    var f = st.fine, p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, f.vinto ? 'Hai vinto!' : 'Partita persa'));
    p.appendChild(el('p', null, f.vinto
      ? 'Ogni seme ha una strada di almeno 5 carte.'
      : 'Per vincere serve una strada di almeno 5 carte in ogni seme.'));
    var righe = el('div', 'righe');
    S.SEMI.forEach(function (x) {
      var q = f.sequenze[x];
      var r = el('button', 'riga ' + x + (q.lung >= S.LUNGHEZZA_VINCENTE ? ' ok' : ' poco'));
      r.type = 'button';
      r.setAttribute('aria-pressed', evid === x ? 'true' : 'false');
      r.appendChild(el('span', 'sg', S.SIMBOLO[x]));
      var mezzo = el('span');
      mezzo.appendChild(el('span', 'nome', NOMI[x]));
      mezzo.appendChild(el('span', 'val', q.percorso.length ? q.percorso.map(function (n) { return S.etichetta(n.carta.valore); }).join(' › ') : 'nessuna carta'));
      r.appendChild(mezzo);
      r.appendChild(el('span', 'n', String(q.lung)));
      r.addEventListener('click', function () { evid = evid === x ? null : x; render(); });
      righe.appendChild(r);
    });
    p.appendChild(righe);
    if (f.vinto) p.appendChild(el('div', 'punteggio', 'Punteggio: ' + f.punteggio));
    p.appendChild(el('p', null, 'Tocca un seme per vedere la sua strada sulla griglia.'));
    if (extra) p.appendChild(extra);
    return p;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Prendi una pila di carte dal mercato e posala su una griglia di nove caselle. Per vincere ti serve, per ogni seme, una strada di almeno 5 carte con i numeri che salgono, in caselle vicine.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(true); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita(nuova) {
    if (nuova || !g) {
      g = S.nuova(semeIniziale());
      sel = { pila: null, casella: null }; evid = null; msgOk = false;
      msg = '';
    }
    abbandona = false; schermo = 'partita'; render();
  }
  function haGiocato() { return !!g && g.ultimo && g.ultimo.azione !== 'inizio'; }
  function chiediNuova() {
    if (!haGiocato() || g.fine) { vaiPartita(true); return; }
    abbandona = true; render();
  }
  function riassunto(u, giroPrima, giroDopo) {
    var t = 'Pila ' + lista(u.pila) + ' posata ' + nomeCasella(u.casella) + '. ';
    t += u.cadute.length ? (u.cadute.length === 1 ? 'Cade negli scarti: ' : 'Cadono negli scarti: ') + lista(u.cadute) + '. ' : 'Non cade niente. ';
    if (giroDopo > giroPrima) t += 'Si rimescolano gli scarti: giro ' + giroDopo + ' di ' + S.GIRI + '.';
    return t.replace(/\s+$/, '');
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', chiediNuova)]));
    if (abbandona) {
      var p = el('div', 'pannello fine');
      p.appendChild(el('h2', null, 'Lasciare questa partita?'));
      p.appendChild(el('p', null, 'Non si può tornare indietro.'));
      var due = el('div', 'dueBottoni');
      due.appendChild(bottone('Sì, nuova', 'grande', function () { vaiPartita(true); }));
      due.appendChild(bottone('No, continuo', 'grande primo', function () { abbandona = false; render(); }));
      p.appendChild(due);
      app.appendChild(p);
    }
    app.appendChild(barra(g));
    var fine = !!g.fine, scelte = { pile: {}, caselle: {} };
    if (sel.pila != null) scelte.pile[sel.pila] = 'scelta';
    if (sel.casella != null) scelte.caselle[sel.casella] = 'scelta';
    app.appendChild(tavolo({
      stato: g, scelte: scelte, evidenzia: evidenziaSeme(g), cade: cadeScelta(g, sel),
      clicPila: fine ? null : function (i) { sel.pila = sel.pila === i ? null : i; msg = ''; msgOk = false; render(); },
      clicCasella: fine ? null : function (i) { sel.casella = sel.casella === i ? null : i; msg = ''; msgOk = false; render(); }
    }));
    if (fine) { app.appendChild(pannelloFine(g, bottone('Nuova partita', 'grande primo', function () { vaiPartita(true); }))); return; }
    if (!msg && (sel.pila == null || sel.casella == null)) { msg = 'Tocca una pila del mercato e una casella della griglia.'; msgOk = false; }
    app.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    app.appendChild(rigaPosa(posaDi(g, sel, posa), false));
  }
  // il tasto «Posa qui»: la pila presa va sulla casella scelta
  function posa() {
    var prima = g.giro;
    var n = S.apply(g, { t: 'gioca', pila: sel.pila, casella: sel.casella });
    if (n.rifiuto) { msg = n.rifiuto + '.'; msgOk = false; render(); return; }   // la scelta resta
    g = n; sel = { pila: null, casella: null }; msgOk = true; msg = riassunto(g.ultimo, prima, g.giro);
    if (g.fine) { msg = ''; }
    render();
    if (g.fine) window.scrollTo(0, 0);
  }

  // ---------- demo (giocabile: ogni passo con una posa la fa il giocatore, coi tocchi veri della partita) ----------
  function selVuota() { return { pila: null, casella: null }; }
  function vaiDemo() { schermo = 'demo'; evid = null; demo = { i: 0, st: D.nuova(), sel: selVuota(), fatto: false, msg: '', ok: false, errori: 0 }; render(); }
  function demoAvanti() { demo.i++; demo.sel = selVuota(); demo.fatto = false; demo.msg = ''; demo.ok = false; demo.errori = 0; render(); }
  // la prossima cosa che manca da toccare: { k:'pila'|'casella'|'posa' }
  function prossimo(m, s) {
    if (s.pila !== m.pila) return { k: 'pila' };
    if (s.casella !== m.casella) return { k: 'casella' };
    return { k: 'posa' };
  }
  function prossimaCosa(m, s) {
    var p = prossimo(m, s);
    if (p.k === 'pila') return 'tocca ' + nomePila(demo.st, m.pila).toLowerCase();
    if (p.k === 'casella') return 'tocca la casella ' + nomeCasella(m.casella);
    return 'tocca il tasto Posa qui';
  }
  // sbaglio: nel turno guidato il gioco dice cosa toccare; nel turno «trova» non lo dice mai subito, ma aiuta a ragionare (aiuti, uno più chiaro dell'altro)
  function demoSbagliato(m, costoso) {
    var passo = D.passi[demo.i];
    if (passo.trova) {
      demo.errori = (demo.errori || 0) + 1;
      demo.msg = costoso ? passo.costoso : passo.aiuti[Math.min(demo.errori, passo.aiuti.length) - 1];
      demo.sel = selVuota();
    } else demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.';
    demo.ok = false; render();
  }
  // la posa allunga una strada ma ne spezza un'altra? (per il turno «trova»: dice la cosa giusta a chi ha scelto una posa che fa cadere una carta che serve)
  function allungaMaSpezza(st, p, c) {
    var prima = S.sequenze(st.griglia), dopo = S.sequenze(S.apply(st, { t: 'gioca', pila: p, casella: c }).griglia), piu = false, meno = false;
    S.SEMI.forEach(function (x) { if (dopo[x].lung > prima[x].lung) piu = true; if (dopo[x].lung < prima[x].lung) meno = true; });
    return piu && meno;
  }
  function demoPosa(passo) {
    var m = passo.mossa, s = demo.sel;
    if (s.pila !== m.pila || s.casella !== m.casella) { demoSbagliato(m, passo.trova && allungaMaSpezza(demo.st, s.pila, s.casella)); return; }
    var prima = demo.st.giro;
    var n = S.apply(demo.st, { t: 'gioca', pila: m.pila, casella: m.casella });
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto + '.'; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo, prima, n.giro);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = selVuota(); demo.fatto = false; demo.errori = 0; }
    render();
  }
  function demoTocca(passo, lato, i) {
    var m = passo.mossa, s = demo.sel;
    if (!passo.trova && i !== m[lato]) { demoSbagliato(m); return; }    // nel turno guidato solo la pila e la casella giuste; nel turno «trova» si prova liberamente
    s[lato] = s[lato] === i ? null : i; demo.msg = ''; demo.ok = false; render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa, trova = !!passo.trova;
    app.appendChild(intestazione([bottone('Salta', 'mini', function () { vaiPartita(false); })]));
    if (m && !demo.sel) demo.sel = selVuota();
    var sel = demo.sel, scelte = { pile: {}, caselle: {} }, attivo = !!m && !demo.fatto, posaSugg = false;
    if (attivo) {
      if (sel.pila != null) scelte.pile[sel.pila] = 'scelta';
      if (sel.casella != null) scelte.caselle[sel.casella] = 'scelta';
      // turno guidato: si indica UNA cosa alla volta (la pila, la casella, il tasto); turno «trova»: niente indicato
      if (!trova) {
        var p = prossimo(m, sel);
        if (p.k === 'pila') scelte.pile[m.pila] = 'suggerita';
        else if (p.k === 'casella') scelte.caselle[m.casella] = 'suggerita';
        else posaSugg = true;
      }
    }
    var info = el('div', 'demoInfo');
    info.appendChild(el('span', null, 'Tutorial: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(info);
    app.appendChild(barra(demo.st));
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte, evidenzia: evidenziaSeme(demo.st), cade: attivo ? cadeScelta(demo.st, sel) : null,
      clicPila: attivo ? function (i) { demoTocca(passo, 'pila', i); } : null,
      clicCasella: attivo ? function (i) { demoTocca(passo, 'casella', i); } : null
    }));
    app.appendChild(el('div', 'msg' + (demo.ok ? ' ok' : ''), demo.msg));
    app.appendChild(rigaPosa(attivo ? posaDi(demo.st, sel, function () { demoPosa(passo); }) : null, posaSugg));
    var box = el('div', 'passo');
    box.setAttribute('data-passo', String(demo.i));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) {
      /* i tocchi veri della partita: niente Conferma */
    } else if (ultimo && (!m || demo.fatto)) az.appendChild(bottone('Continua', 'conferma', continuaPartita));
    else az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    if (az.firstChild) app.appendChild(az);
  }
  // finito il tutorial la partita CONTINUA: è la stessa, nello stato in cui il tutorial l'ha lasciata
  function continuaPartita() { g = demo.st; sel = selVuota(); msg = ''; msgOk = false; evid = null; abbandona = false; schermo = 'partita'; render(); }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  // I semi (♥ ♦ ♣ ♠) si disegnano come lettere, non come emoji colorate: dopo ogni simbolo il selettore di testo (U+FE0E), nei testi di ogni schermata, tutorial compreso.
  var SEME_NUDO = /([\u2660\u2663\u2665\u2666])(?!\uFE0E)/g;
  function semiDiTesto(radice) {
    var w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT, null), n, da = [];
    while ((n = w.nextNode())) if (SEME_NUDO.test(n.nodeValue)) da.push(n);
    SEME_NUDO.lastIndex = 0;
    da.forEach(function (t) { t.nodeValue = t.nodeValue.replace(SEME_NUDO, '$1\uFE0E'); });
  }
  new MutationObserver(function () { semiDiTesto(document.body); }).observe(document.body, { childList: true, subtree: true, characterData: true });

  crediti();
  if (leggiVisto()) vaiPartita(true); else { schermo = 'domanda'; render(); }
}());
