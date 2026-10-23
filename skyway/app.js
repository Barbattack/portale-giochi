/*
 * Skyway — la parte che parla col browser. Legge lo stato del motore (engine.js)
 * e lo mostra; non contiene regole. Cambia lo stato solo con Skyway.apply.
 * Nessun suggerimento in partita: si sceglie una pila e una casella e si conferma; fino alla
 * conferma si può cambiare idea, dopo no. Gli aiuti visivi (bordo che pulsa) ci sono solo nella demo.
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
  var POSIZIONE_PILA = ['a sinistra', 'al centro', 'a destra'];

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore (la partita in corso)
  var sel;           // { pila, casella } (ognuno può essere null)
  var msg, msgOk;
  var demo;          // { i, st, sel, fatto, msg, ok }
  var abbandona;     // true quando si chiede conferma per la nuova partita
  var evid;          // il seme della sequenza da evidenziare a fine partita, o null

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
  function descrizionePila(st, p) { return lista(st.mercato[p]) + ' (' + POSIZIONE_PILA[p] + ')'; }

  // ---------- carte, ventaglio, griglia ----------
  /* Una pila di carte a ventaglio: dal fondo (a sinistra) alla cima (a destra). */
  function ventaglio(carte, tag, cls, etichetta, evidenzia) {
    var e = el(tag, 'ventaglio ' + (carte.length ? 'pieno ' : '') + (cls || ''));
    carte.forEach(function (c, i) {
      var k = el('span', 'carta ' + c.seme + ' i' + i + (i === carte.length - 1 ? ' cima' : '') + (evidenzia && evidenzia[c.id] ? ' evid' : ''));
      k.appendChild(el('span', 'v', S.etichetta(c.valore)));
      k.appendChild(el('span', 's', S.SIMBOLO[c.seme]));
      e.appendChild(k);
    });
    e.setAttribute('aria-label', etichetta + ': ' + (carte.length ? 'dal fondo alla cima ' + carte.map(S.nomeCarta).join(', ') : 'vuota'));
    return e;
  }
  /* o: { stato, scelte:{pile:{i:classe}, caselle:{i:classe}}, clicPila(i) | null, clicCasella(i) | null, evidenzia:{id:true} } */
  function tavolo(o) {
    var st = o.stato, box = el('div'), i, b;
    box.appendChild(el('div', 'etichetta', st.fine ? 'Mercato: la partita è finita' : 'Mercato: scegli una pila'));
    var mer = el('div', 'zona');
    for (i = 0; i < 3; i++) {
      (function (k) {
        var carte = st.mercato[k] || [];
        b = ventaglio(carte, o.clicPila && carte.length ? 'button' : 'div', (carte.length ? '' : 'vuotoMercato ') + ((o.scelte.pile && o.scelte.pile[k]) || ''), 'Pila ' + (k + 1) + ' del mercato');
        if (o.clicPila && carte.length) { b.type = 'button'; b.addEventListener('click', function () { o.clicPila(k); }); }
        mer.appendChild(b);
      }(i));
    }
    box.appendChild(mer);
    box.appendChild(el('div', 'etichetta', 'Griglia: ogni casella tiene tre carte'));
    var gr = el('div', 'zona griglia');
    var ult = st.ultimo && st.ultimo.azione === 'gioca' ? st.ultimo.casella : -1;
    for (i = 0; i < 9; i++) {
      (function (k) {
        var cl = ((o.scelte.caselle && o.scelte.caselle[k]) || '') + (k === ult && !(o.scelte.caselle && o.scelte.caselle[k]) ? ' ultima' : '');
        var c = ventaglio(st.griglia[k], o.clicCasella ? 'button' : 'div', cl, 'Casella ' + nomeCasella(k), o.evidenzia);
        if (o.clicCasella) { c.type = 'button'; c.addEventListener('click', function () { o.clicCasella(k); }); }
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
      var m = el('div', 'mucchio');
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
      ? 'Ogni seme ha una sequenza di almeno 5 carte.'
      : 'Per vincere serve una sequenza di almeno 5 carte in ogni seme.'));
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
    p.appendChild(el('p', null, 'Tocca un seme per vedere la sua sequenza sulla griglia.'));
    if (extra) p.appendChild(extra);
    return p;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Scegli una pila di carte dal mercato e posala in una griglia 3×3. Per ogni seme devi costruire una sequenza crescente di almeno 5 carte, passando fra caselle vicine.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(true); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita(nuova) {
    if (nuova || !g) {
      g = S.nuova(semeIniziale());
      sel = { pila: null, casella: null }; evid = null; msgOk = false;
      msg = 'Scegli una pila e una casella, poi conferma.';
    }
    abbandona = false; schermo = 'partita'; render();
  }
  function haGiocato() { return !!g && g.ultimo && g.ultimo.azione !== 'inizio'; }
  function chiediNuova() {
    if (!haGiocato() || g.fine) { vaiPartita(true); return; }
    abbandona = true; render();
  }
  function riassunto(u, giroPrima, giroDopo) {
    var t = 'Presa la pila ' + lista(u.pila) + ' ' + nomeCasella(u.casella) + '. ';
    t += u.cadute.length ? 'Cadono negli scarti: ' + lista(u.cadute) + '. ' : 'Non cade niente. ';
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
      stato: g, scelte: scelte, evidenzia: evidenziaSeme(g),
      clicPila: fine ? null : function (i) { sel.pila = sel.pila === i ? null : i; msg = ''; msgOk = false; render(); },
      clicCasella: fine ? null : function (i) { sel.casella = sel.casella === i ? null : i; msg = ''; msgOk = false; render(); }
    }));
    if (fine) { app.appendChild(pannelloFine(g, bottone('Nuova partita', 'grande primo', function () { vaiPartita(true); }))); return; }
    app.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    var az = el('div', 'azioni fissa');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = sel.pila == null || sel.casella == null;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var prima = g.giro;
    var n = S.apply(g, { t: 'gioca', pila: sel.pila, casella: sel.casella });
    if (n.rifiuto) { msg = n.rifiuto + '.'; msgOk = false; render(); return; }   // la scelta resta
    g = n; sel = { pila: null, casella: null }; msgOk = true; msg = riassunto(g.ultimo, prima, g.giro);
    if (g.fine) { msg = ''; }
    render();
    if (g.fine) window.scrollTo(0, 0);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; evid = null; demo = { i: 0, st: D.nuova(), sel: { pila: null, casella: null }, fatto: false, msg: '', ok: false }; render(); }
  function entra(i) {
    demo.i = i; demo.sel = { pila: null, casella: null }; demo.fatto = false;
    if (D.passi[i].scena) demo.st = D.scena(D.passi[i].scena);
  }
  function frase(m) {
    return 'Tocca la pila ' + descrizionePila(demo.st, m.pila) + ', poi la casella ' + nomeCasella(m.casella) + ', poi Conferma';
  }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, s) {
    if (s.pila !== m.pila) return 'tocca la pila ' + descrizionePila(demo.st, m.pila);
    if (s.casella !== m.casella) return 'tocca la casella ' + nomeCasella(m.casella);
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m, demo.sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var prima = demo.st.giro;
    var n = S.apply(demo.st, { t: 'gioca', pila: m.pila, casella: m.casella });
    if (n.rifiuto) { demo.fatto = true; demo.msg = 'Non si può: ' + n.rifiuto + '.'; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo, prima, n.giro);
    var msgFatto = demo.msg;
    if (demo.i < D.passi.length - 1) entra(demo.i + 1); else demo.fatto = true;
    demo.msg = msgFatto; demo.ok = true;
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', function () { vaiPartita(false); })]));
    var scelte = { pile: {}, caselle: {} }, pronto = false, attivo = !!m && !demo.fatto;
    if (attivo) {
      scelte.pile[m.pila] = 'suggerita'; scelte.caselle[m.casella] = 'suggerita';
      if (demo.sel.pila != null) scelte.pile[demo.sel.pila] = demo.sel.pila === m.pila ? 'scelta' : '';
      if (demo.sel.casella != null) scelte.caselle[demo.sel.casella] = demo.sel.casella === m.casella ? 'scelta' : '';
      pronto = prossimaCosa(m, demo.sel) === 'tocca Conferma';
    }
    var info = el('div', 'demoInfo');
    info.appendChild(el('span', null, 'Prova: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(info);
    app.appendChild(barra(demo.st));
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte, evidenzia: evidenziaSeme(demo.st),
      clicPila: attivo ? function (i) {
        if (i !== m.pila) { demoSbagliato(m); return; }
        demo.sel.pila = demo.sel.pila === i ? null : i; demo.msg = ''; demo.ok = false; render();
      } : null,
      clicCasella: attivo ? function (i) {
        if (i !== m.casella) { demoSbagliato(m); return; }
        demo.sel.casella = demo.sel.casella === i ? null : i; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    app.appendChild(el('div', 'msg' + (demo.ok ? ' ok' : ''), demo.msg));
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    if (demo.st.fine) app.appendChild(pannelloFine(demo.st, null));
    var az = el('div', 'azioni');
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', function () { vaiPartita(false); }));
    else az.appendChild(bottone('Avanti', 'conferma', function () { entra(demo.i + 1); demo.msg = ''; demo.ok = false; render(); }));
    app.appendChild(az);
  }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  crediti();
  if (leggiVisto()) vaiPartita(true); else { schermo = 'domanda'; render(); }
}());
