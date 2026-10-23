/*
 * Foursquare — la parte che parla col browser. Legge lo stato del motore (engine.js)
 * e lo mostra; non contiene regole. Cambia lo stato solo con Foursquare.apply.
 * Nessun suggerimento in partita: i posti tratteggiati dicono solo dove, per forma, può stare
 * una pila nuova (accanto a una pila, dentro il quadrato 4x4); se la posa si può fare lo dice il motore.
 */
(function () {
  'use strict';
  var C = self.Foursquare, D = self.FoursquareDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'foursquare-visto';

  // Il titolo sta in un punto solo: il <title> di index.html. Qui lo si legge.
  var TITOLO = document.title;
  var CREDITI = { autore: 'Wil Su', collezione: 'Isaludo', link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
                  ispirato: 'ispirato a Poker Squares, Reversi e Lights Out' };

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore (la partita in corso)
  var sel;           // { x, y } oppure null
  var msg, msgOk;
  var demo;          // { i, st, sel, fatto, msg, ok }
  var abbandona;     // true quando si chiede conferma per la nuova partita

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
    f.appendChild(document.createTextNode(', ' + CREDITI.ispirato + '.'));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function lettera(x) { return x >= 0 && x < 5 ? 'ABCDE'.charAt(x) : ''; }
  function nomeCasella(x, y) { return lettera(x) + y; }       // solo per la demo: A1, D3...

  // ---------- carte e griglia ----------
  function faccia(c, tag, cls) {
    var e = el(tag, 'carta ' + c.seme + (cls ? ' ' + cls : ''));
    e.appendChild(el('span', 'v', C.etichetta(c.valore)));
    e.appendChild(el('span', 's', C.SIMBOLO[c.seme]));
    return e;
  }
  /* o: { stato, scelte:{"x,y":classe}, clic(x,y) | null, sigle: true nella demo } */
  function griglia(o) {
    var st = o.stato, r = C.riquadro(st);
    var ex = r.larghezza < C.LATO ? 1 : 0, ey = r.altezza < C.LATO ? 1 : 0;   // posti dove può crescere
    var x0 = r.x0 - ex, x1 = r.x1 + ex, y0 = r.y0 - ey, y1 = r.y1 + ey;
    var colonne = x1 - x0 + 1;
    var box = el('div', 'griglia');
    // caselle sempre della stessa misura (al massimo 72 px): la griglia cresce senza che le carte cambino
    box.style.gridTemplateColumns = (o.sigle ? '1.2em ' : '') + 'repeat(' + colonne + ', minmax(0, 72px))';
    var posti = {}, ult = st.ultimo && st.ultimo.azione === 'posa' ? st.ultimo : null, girate = {}, x, y;
    C.postiVisibili(st).forEach(function (p) { posti[C.chiave(p.x, p.y)] = true; });
    if (ult) ult.girate.forEach(function (q) { girate[C.chiave(q.x, q.y)] = true; });
    if (o.sigle) {
      box.appendChild(el('div', 'sigla'));
      for (x = x0; x <= x1; x++) box.appendChild(el('div', 'sigla', lettera(x)));
    }
    for (y = y0; y <= y1; y++) {
      if (o.sigle) box.appendChild(el('div', 'sigla', y >= 1 ? String(y) : ''));
      for (x = x0; x <= x1; x++) box.appendChild(casella(x, y));
    }
    function casella(cx, cy) {
      var k = C.chiave(cx, cy), pila = st.griglia[k], pronto = o.scelte[k] || '', b;
      var tag = o.clic ? 'button' : 'div';
      if (pila) {
        var h = pila.carte.length, extra = 'pila p' + h + (ult && ult.x === cx && ult.y === cy ? ' ultima' : '') + (girate[k] ? ' girata' : '');
        if (pila.su) {
          b = faccia(C.cima(pila), tag, extra + ' ' + pronto);
          b.setAttribute('aria-label', (o.sigle ? nomeCasella(cx, cy) + ': ' : '') + C.nomeCarta(C.cima(pila)) + ', pila di ' + h);
        } else {
          b = el(tag, 'dorso ' + extra + ' ' + pronto);
          b.setAttribute('aria-label', (o.sigle ? nomeCasella(cx, cy) + ': ' : '') + 'carta coperta, pila di ' + h);
        }
        if (h > 1) b.appendChild(el('span', 'alt', String(h)));
      } else {
        b = el(tag, 'vuoto ' + (posti[k] ? 'posto' : 'nulla') + ' ' + pronto);
        b.setAttribute('aria-label', (posti[k] ? 'Posto libero' : 'Casella vuota') + (o.sigle ? ' ' + nomeCasella(cx, cy) : ''));
      }
      if (o.clic) { b.type = 'button'; b.addEventListener('click', function () { o.clic(cx, cy); }); }
      return b;
    }
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte, clic, sigle } */
  function tavolo(o) {
    var box = el('div');
    box.appendChild(griglia(o));
    var sotto = el('div', 'sotto');
    var mz = el('div', 'mazzo');
    if (o.stato.mazzo.length) { var c = faccia(o.stato.mazzo[0], 'div'); c.setAttribute('aria-label', 'Carta da posare: ' + C.nomeCarta(o.stato.mazzo[0])); mz.appendChild(c); }
    else mz.appendChild(el('div', 'vuoto'));
    mz.appendChild(el('div', null, o.stato.mazzo.length ? conTesto(o.stato.mazzo.length, 'carta', 'carte') : 'mazzo finito'));
    sotto.appendChild(mz);
    sotto.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(sotto);
    return box;
  }

  function conteggi(st, centro) {
    var p = el('div', 'punti');
    var a = el('span'); a.appendChild(document.createTextNode('Coperte ')); a.appendChild(el('b', null, String(C.coperte(st))));
    a.appendChild(document.createTextNode(' (al massimo ' + C.MAX_COPERTE + ')'));
    p.appendChild(a);
    var b = el('span'); b.appendChild(document.createTextNode('Aperte ')); b.appendChild(el('b', null, C.scoperte(st) + '/16'));
    p.appendChild(b);
    return p;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, TITOLO));
    var dx = el('div'); dx.style.display = 'flex'; dx.style.gap = '6px';
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Apri ristoranti, una carta alla volta, in una griglia che cresce fino a 4×4. Ma ogni volta che ne apri uno, altri si chiudono: non lasciarne chiusi più di 4.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(true); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita(nuova) {
    if (nuova || !g) {
      g = C.nuova(semeIniziale());
      sel = null; msgOk = false; msg = 'Scegli dove posare la carta, poi conferma.';
    }
    abbandona = false; schermo = 'partita'; render();
  }
  function haGiocato() { return !!g && g.ultimo && g.ultimo.azione !== 'inizio'; }
  function chiediNuova() {
    if (!haGiocato() || g.fine) { vaiPartita(true); return; }
    abbandona = true; render();
  }
  function riassunto(u) {
    var t = 'Posato ' + C.sigla(u.carta) + (u.nuova ? ' in una pila nuova' : ' sopra una pila') + '. ';
    var chiuse = u.girate.filter(function (q) { return q.ora === 'coperta'; }).length, aperte = u.girate.length - chiuse;
    if (!u.girate.length) t += 'Nessuna carta girata.';
    else {
      var p = [];
      if (chiuse) p.push(conTesto(chiuse, 'chiusa', 'chiuse'));
      if (aperte) p.push(conTesto(aperte, 'aperta', 'aperte'));
      t += 'Girate: ' + p.join(', ') + '.';
    }
    return t;
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
    app.appendChild(conteggi(g));
    var fine = !!g.fine, scelte = {};
    if (sel) scelte[C.chiave(sel.x, sel.y)] = 'scelta';
    app.appendChild(tavolo({
      stato: g, scelte: scelte,
      clic: fine ? null : function (x, y) {
        sel = sel && sel.x === x && sel.y === y ? null : { x: x, y: y };
        msg = ''; msgOk = false; render();
      }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !sel;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var n = C.apply(g, { t: 'posa', x: sel.x, y: sel.y });
    if (n.rifiuto) { msg = n.rifiuto + '.'; msgOk = false; render(); return; }   // la scelta resta
    g = n; sel = null; msgOk = true; msg = riassunto(g.ultimo);
    render();
  }
  var MOTIVI = {
    mazzo: 'Il mazzo è finito e la griglia non è tutta aperta.',
    'nessuna posa': 'Con la carta che hai pescato non c’è nessuna posa possibile.'
  };
  function finale() {
    var p = el('div', 'pannello fine'), f = g.fine;
    p.appendChild(el('h2', null, f.vinto ? 'Hai vinto!' : 'Partita persa'));
    p.appendChild(el('p', null, f.vinto
      ? 'Sedici ristoranti aperti. Carte rimaste nel mazzo: ' + f.rimaste + '.'
      : (MOTIVI[f.motivo] || '') + ' Ristoranti aperti: ' + C.scoperte(g) + ' su 16.'));
    p.appendChild(bottone('Nuova partita', 'grande primo', function () { vaiPartita(true); }));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false }; render(); }
  function frase(m) { return 'Tocca ' + nomeCasella(m.x, m.y) + ', poi Conferma'; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, s) {
    if (!s || s.x !== m.x || s.y !== m.y) return 'tocca ' + nomeCasella(m.x, m.y);
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m, demo.sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = C.apply(demo.st, { t: 'posa', x: m.x, y: m.y });
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto + '.'; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; }
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', function () { vaiPartita(false); })]));
    var aiuto = {}, pronto = false, attivo = !!m && !demo.fatto;
    if (attivo) {
      aiuto[C.chiave(m.x, m.y)] = 'suggerita';
      if (demo.sel) aiuto[C.chiave(demo.sel.x, demo.sel.y)] = demo.sel.x === m.x && demo.sel.y === m.y ? 'scelta' : '';
      pronto = prossimaCosa(m, demo.sel) === 'tocca Conferma';
    } else if (m && demo.fatto) {   // rifiuto fatto: la casella resta segnata in rosso
      aiuto[C.chiave(m.x, m.y)] = 'no';
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Prova: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    p.appendChild(el('span', 'tot', 'Coperte ' + C.coperte(demo.st)));
    app.appendChild(p);
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto, sigle: true,
      clic: attivo ? function (x, y) {
        if (x !== m.x || y !== m.y) { demoSbagliato(m); return; }
        demo.sel = demo.sel ? null : { x: x, y: y }; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', function () { vaiPartita(false); }));
    else az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
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
