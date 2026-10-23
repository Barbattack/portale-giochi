/*
 * Il cortile — la parte che parla col browser. Legge lo stato del motore (engine.js)
 * e lo mostra; non contiene regole. Cambia lo stato solo con Cortile.apply.
 * La disposizione dei compagni (stato.cortile) NON viene mai scritta nella pagina
 * finché il compagno non è scoperto.
 */
(function () {
  'use strict';
  var C = self.Cortile, D = self.CortileDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'cortile-visto';

  // Il titolo sta in un punto solo: il <title> di index.html. Qui lo si legge.
  var TITOLO = document.title;
  var CREDITI = { autore: 'Wil Su', collezione: 'Isaludo', link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection' };

  var MOSSE = ['ipotesi', 'scopri', 'ritira'];
  var ETICHETTA_MOSSA = { ipotesi: 'Metti un’ipotesi', scopri: 'Scopri un compagno', ritira: 'Ritira un’ipotesi' };
  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore (la partita in corso)
  var sel;           // { mossa, dove }
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
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- carte e cortile ----------
  function faccia(c, tag, cls) {
    var e = el(tag, 'carta ' + c.seme + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', C.nomeCarta(c));
    e.appendChild(el('span', 'v', C.etichetta(c.valore)));
    e.appendChild(el('span', 's', C.SIMBOLO[c.seme]));
    return e;
  }
  /* o: { stato, scelte:{dove:classe}, clic(dove) | null } */
  function cortile(o) {
    var st = o.stato, box = el('div', 'cortile'), r, k;
    function voce(dove) {
      var pronto = o.scelte[dove] || '', b;
      if (typeof dove === 'string') {
        var ip = st.posti[dove];
        if (ip) b = faccia(ip, o.clic ? 'button' : 'div', 'posto ' + pronto);
        else { b = el(o.clic ? 'button' : 'div', 'posto vuoto ' + pronto, '×'); b.setAttribute('aria-label', 'Posto vuoto ' + C.nomePosto(dove)); }
        if (ip) b.setAttribute('aria-label', 'Ipotesi ' + C.nomeCarta(ip) + ' ' + C.nomePosto(dove));
      } else if (st.scoperti[dove]) {
        b = faccia(st.cortile[dove], o.clic ? 'button' : 'div', 'compagno ' + pronto);
      } else {
        b = el(o.clic ? 'button' : 'div', 'dorso ' + pronto);
        b.setAttribute('aria-label', 'Compagno coperto, ' + C.nomeCella(dove));
      }
      if (o.clic) { b.type = 'button'; b.addEventListener('click', function () { o.clic(dove); }); }
      return b;
    }
    function angolo() { return el('div', 'angolo'); }
    box.appendChild(angolo());
    for (k = 0; k < 4; k++) box.appendChild(voce('T' + k));
    box.appendChild(angolo());
    for (r = 0; r < 3; r++) {
      box.appendChild(voce('L' + r));
      for (k = 0; k < 4; k++) box.appendChild(voce(r * 4 + k));
      box.appendChild(voce('R' + r));
    }
    box.appendChild(angolo());
    for (k = 0; k < 4; k++) box.appendChild(voce('B' + k));
    box.appendChild(angolo());
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte, clic, mossa, cliccaMossa(m), suggerimentoMossa (solo demo) } */
  function tavolo(o) {
    var box = el('div');
    box.appendChild(cortile(o));
    var sotto = el('div', 'sotto');
    var mz = el('div', 'mazzo');
    if (o.stato.mazzo.length) mz.appendChild(faccia(o.stato.mazzo[0], 'div'));
    else mz.appendChild(el('div', 'vuoto'));
    mz.appendChild(el('div', null, o.stato.mazzo.length ? conTesto(o.stato.mazzo.length, 'carta', 'carte') : 'mazzo finito'));
    sotto.appendChild(mz);
    sotto.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(sotto);
    var mosse = el('div', 'mosse');
    MOSSE.forEach(function (m) {
      var b = bottone(ETICHETTA_MOSSA[m], (o.mossa === m ? 'on' : '') + (o.suggerimentoMossa === m ? ' suggerita' : ''), o.cliccaMossa ? function () { o.cliccaMossa(m); } : null);
      if (!o.cliccaMossa) b.tabIndex = -1;
      mosse.appendChild(b);
    });
    box.appendChild(mosse);
    return box;
  }

  function punteggio(st) {
    var p = el('div', 'punti');
    var a = el('span'); a.appendChild(document.createTextNode('Punti ')); a.appendChild(el('b', null, String(st.punti.length)));
    p.appendChild(a);
    p.appendChild(el('span', 'tot', 'per vincere ne servono ' + C.TRAGUARDO));
    var b = el('span'); b.appendChild(document.createTextNode('Scoperti ')); b.appendChild(el('b', null, C.scoperti(st) + '/12'));
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
    p.appendChild(el('p', null, 'Dodici compagni di giochi si nascondono, coperti, in un cortile. Con le tue ipotesi devi indovinare i loro semi.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(true); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita(nuova) {
    if (nuova || !g) {
      g = C.nuova(semeIniziale());
      azzera(); msgOk = false; msg = 'Scegli cosa fare, poi dove, e conferma.';
    }
    abbandona = false; schermo = 'partita'; render();
  }
  function azzera() { sel = { mossa: null, dove: null }; }
  function haGiocato() { return !!g && g.ultimo && g.ultimo.azione !== 'inizio'; }
  function chiediNuova() {
    if (!haGiocato() || g.fine) { vaiPartita(true); return; }
    abbandona = true; render();
  }
  function nomeDove(dove) { return typeof dove === 'string' ? C.nomePosto(dove) : C.nomeCella(dove); }
  function riassunto(u, st) {
    var t = '';
    if (u.azione === 'ipotesi') t = 'Ipotesi: ' + C.sigla(u.carta) + ' ' + C.nomePosto(u.dove) + '.';
    else if (u.azione === 'scopri') {
      t = 'Era ' + (u.compagno.valore === 12 ? 'la ' : 'il ') + C.nomeCarta(u.compagno) + '. ';
      t += u.prese.length ? 'Nei punti: ' + u.prese.map(function (p) { return C.sigla(p.carta); }).join(', ') + ' (' + conTesto(u.prese.length, 'carta', 'carte') + ').' : 'Nessuna ipotesi da prendere.';
    } else if (u.azione === 'ritira') t = 'Ritirata: ' + C.sigla(u.ipotesi) + ' e ' + C.sigla(u.carta) + ' vanno negli scarti.';
    if (u.azione !== 'scopri' && !st.mazzo.length) t += ' Il mazzo è finito: ora puoi solo scoprire.';
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
    app.appendChild(punteggio(g));
    var fine = !!g.fine, scelte = {};
    if (sel.dove !== null) scelte[sel.dove] = 'scelta';
    app.appendChild(tavolo({
      stato: g, scelte: scelte, mossa: sel.mossa,
      clic: fine ? null : function (dove) { sel.dove = sel.dove === dove ? null : dove; msg = ''; msgOk = false; render(); },
      cliccaMossa: fine ? null : function (m) { sel.mossa = sel.mossa === m ? null : m; msg = ''; msgOk = false; render(); }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !sel.mossa || sel.dove === null;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var n = C.apply(g, { t: sel.mossa, dove: sel.dove });
    if (n.rifiuto) { msg = n.rifiuto + '.'; msgOk = false; render(); return; }   // la scelta resta
    g = n; azzera(); msgOk = true; msg = riassunto(g.ultimo, g);
    render();
  }
  function finale() {
    var p = el('div', 'pannello fine'), f = g.fine;
    p.appendChild(el('h2', null, f.vinto ? 'Hai vinto!' : 'Partita persa'));
    p.appendChild(el('p', null, 'Hai ' + conTesto(f.punti, 'punto', 'punti') + (f.vinto ? ': ne servivano ' + C.TRAGUARDO + '.' : ', ne servivano ' + C.TRAGUARDO + '.')));
    p.appendChild(bottone('Nuova partita', 'grande primo', function () { vaiPartita(true); }));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false }; render(); }
  function descriviDove(m) {
    if (m.t === 'scopri') return 'la carta coperta in ' + C.nomeCella(m.dove);
    if (m.t === 'ritira') return 'l’ipotesi ' + C.sigla(demo.st.posti[m.dove]) + ' ' + C.nomePosto(m.dove);
    return 'il posto ' + C.nomePosto(m.dove);
  }
  function frase(m) { return 'Tocca ' + C.NOME_AZIONE[m.t] + ', poi ' + descriviDove(m) + ', poi Conferma'; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, s) {
    if (s.mossa !== m.t) return 'tocca ' + C.NOME_AZIONE[m.t];
    if (s.dove !== m.dove) return 'tocca ' + descriviDove(m);
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m, demo.sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = C.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto + '.'; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo, n);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; }
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', function () { vaiPartita(false); })]));
    if (m && !demo.sel) demo.sel = { mossa: null, dove: null };
    var s = demo.sel, aiuto = {}, pronto = false;
    var attivo = !!m && !demo.fatto;
    if (attivo) {
      aiuto[m.dove] = 'suggerita';
      if (s.dove !== null) aiuto[s.dove] = s.dove === m.dove ? 'scelta' : '';
      pronto = prossimaCosa(m, s) === 'tocca Conferma';
    } else if (m && demo.fatto) {   // rifiuto fatto: la carta resta segnata in rosso
      aiuto[m.dove] = 'no';
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Prova: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    p.appendChild(el('span', 'tot', 'Punti ' + demo.st.punti.length));
    app.appendChild(p);
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto,
      mossa: attivo ? s.mossa : (m && demo.fatto ? m.t : null),
      suggerimentoMossa: attivo ? m.t : null,
      clic: attivo ? function (dove) {
        if (dove !== m.dove) { demoSbagliato(m); return; }
        s.dove = s.dove === dove ? null : dove; demo.msg = ''; demo.ok = false; render();
      } : null,
      cliccaMossa: attivo ? function (x) {
        if (x !== m.t) { demoSbagliato(m); return; }
        s.mossa = s.mossa === x ? null : x; demo.msg = ''; demo.ok = false; render();
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
