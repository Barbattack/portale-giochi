/*
 * The Sandwich Guy — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Panino.apply.
 */
(function () {
  'use strict';
  var P = self.Panino, D = self.PaninoDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'sandwich-guy-visto';
  var TITOLO = 'The Sandwich Guy';      // titolo provvisorio: il titolo italiano verrà dopo, si cambia qui e in index.html

  // I crediti stanno in un punto solo: qui.
  var CREDITI = {
    gioco: 'The Sandwich Guy', autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection'
  };

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // [id] scelte, non ancora confermate
  var aperto;        // null | 'mazzo' | 'scarti'
  var msg, msgOk;
  var demo;          // { i, st, sel, fatto, msg, ok }

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
    return m ? decodeURIComponent(m[1]) : Math.random().toString(36).slice(2, 8);
  }
  function crediti() {
    var f = document.getElementById('crediti');
    f.textContent = '';
    var a = el('a', null, CREDITI.gioco); a.href = CREDITI.link; a.rel = 'noopener';
    f.appendChild(a);
    f.appendChild(document.createTextNode(' di ' + CREDITI.autore + ', dalla collezione ' + CREDITI.collezione + '.'));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  function semeCls(c) { return P.eRossa(c) ? 'R' : 'N'; }

  // ---------- carte ----------
  var SIGLA = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta ' + semeCls(c) + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', P.nomeCarta(c));
    e.appendChild(el('span', 'v', SIGLA[c.valore] || String(c.valore)));
    e.appendChild(el('span', 's', P.SIMBOLO[c.seme]));
    return e;
  }

  // ---------- pile e griglie ----------
  function pila(nome, n, sotto, clic, acceso) {
    var b = el(clic ? 'button' : 'div', 'pila' + (acceso ? ' on' : ''));
    if (clic) { b.type = 'button'; b.addEventListener('click', clic); }
    var d = el('span', 'dorso' + (n ? '' : ' vuota'));
    d.appendChild(el('span', 'num', String(n)));
    b.appendChild(d);
    var t = el('span', 'nome', nome);
    if (sotto) t.appendChild(el('small', null, sotto));
    b.appendChild(t);
    return b;
  }
  function griglia(carte, titolo) {
    var box = el('div', 'guarda');
    box.appendChild(el('h3', null, titolo));
    var gr = el('div', 'griglia');
    var presenti = {};
    carte.forEach(function (c) { presenti[c.id] = true; });
    P.SEMI.forEach(function (se) {
      var rosso = se === 'C' || se === 'Q';
      gr.appendChild(el('span', 'seme' + (rosso ? ' R' : ''), P.SIMBOLO[se]));
      for (var v = 1; v <= 13; v++) {
        gr.appendChild(el('span', 'c' + (presenti[se + v] ? ' si' : '') + (rosso ? ' R' : ''), SIGLA[v] || String(v)));
      }
    });
    box.appendChild(gr);
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte:{id:classe}, clicca(c), apriMazzo, apriScarti, aperto } */
  function tavolo(o) {
    var box = el('div');
    var pl = el('div', 'pile');
    pl.appendChild(pila('Mazzo', o.stato.mazzo.length, o.apriMazzo ? 'tocca per guardare' : '', o.apriMazzo, o.aperto === 'mazzo'));
    pl.appendChild(pila('Scarti', o.stato.scarti.length, o.apriScarti ? 'tocca per guardare' : '', o.apriScarti, o.aperto === 'scarti'));
    box.appendChild(pl);
    if (o.aperto === 'mazzo') box.appendChild(griglia(P.carteNelMazzo(o.stato), 'Carte rimaste nel mazzo, in ordine di seme e valore (non è l\'ordine in cui usciranno)'));
    if (o.aperto === 'scarti') box.appendChild(griglia(P.carteNegliScarti(o.stato), 'Carte negli scarti, in ordine di seme e valore'));
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(el('div', 'etichetta', 'La tua mano (' + o.stato.mano.length + ')'));
    var mano = el('div', 'mano');
    P.ordina(o.stato.mano).forEach(function (c) {
      var b = faccia(c, o.clicca ? 'button' : 'div', o.scelte[c.id] || '');
      if (o.clicca) { b.type = 'button'; b.addEventListener('click', function () { o.clicca(c); }); }
      mano.appendChild(b);
    });
    box.appendChild(mano);
    return box;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, TITOLO));
    var dx = el('div', 'dx');
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }

  // ---------- racconto di una mossa ----------
  var TIPO = { seme: 'stesso seme', colore: 'stesso colore, semi diversi', misto: 'colori misti' };
  function riassunto(u) {
    var t = 'Scarti ' + elenco(u.carte.map(P.sigla)) + ': ' + TIPO[u.tipo] + ', peschi ' + u.previste + '.';
    if (u.pescate < u.previste - u.ignorate) t += ' Nel mazzo ne restavano solo ' + u.pescate + '.';
    if (u.ignorate) t += ' La mano è piena: ne peschi ' + u.pescate + ', ' + (u.ignorate === 1 ? 'l\'ultima non si pesca e resta nel mazzo.' : 'le altre non si pescano e restano nel mazzo.');
    if (u.haVinto) t += ' Hai pescato l\'ultima carta: hai vinto! Ora fai panini senza pescare, finché puoi.';
    return t;
  }
  function spiegaFine(f) {
    var n = conTesto(f.punti, 'carta', 'carte');
    if (f.esito === 'vittoria') return 'Non puoi più fare panini. Hai vinto, con ' + n + ' in mano: meno sono, meglio è (la partita perfetta ne lascia 1).';
    return 'Non puoi fare nessun panino prima di finire il mazzo: hai perso, con ' + n + ' in mano.';
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Hai 8 carte. A ogni turno ne scarti tre che fanno un panino, ne peschi altre, e speri di finire il mazzo.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita() {
    g = P.nuova(semeIniziale());
    sel = []; aperto = null; schermo = 'partita'; msgOk = false;
    msg = g.fine ? '' : 'Scegli tre carte che fanno un panino, poi Conferma.';
    render();
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiPartita)]));
    var fine = !!g.fine, scelte = {};
    sel.forEach(function (id) { scelte[id] = 'scelta'; });
    if (g.vinto && !fine) { var v = el('div', 'punti'); v.appendChild(el('span', 'vinto', 'Mazzo finito: hai vinto. Ora fai panini senza pescare.')); app.appendChild(v); }
    app.appendChild(tavolo({
      stato: g, scelte: scelte, aperto: aperto,
      clicca: fine ? null : function (c) {
        var i = sel.indexOf(c.id);
        if (i >= 0) sel.splice(i, 1); else sel.push(c.id);
        msg = ''; msgOk = false; render();
      },
      apriMazzo: function () { aperto = aperto === 'mazzo' ? null : 'mazzo'; render(); },
      apriScarti: function () { aperto = aperto === 'scarti' ? null : 'scarti'; render(); }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !sel.length;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var n = P.apply(g, { t: 'scarta', carte: sel.slice() });
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la scelta resta, si può cambiare
    g = n; sel = []; msgOk = true;
    msg = riassunto(g.ultimo);
    render();
  }
  function finale() {
    var p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, g.fine.esito === 'vittoria' ? 'Hai vinto!' : 'Hai perso.'));
    p.appendChild(el('p', null, spiegaFine(g.fine)));
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiPartita));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: [], fatto: false, msg: '', ok: false }; render(); }
  function nomeId(id) { return P.nomeCarta(P.daId(id)); }
  function frase(m) { return 'Tocca ' + elenco(m.carte.map(nomeId)) + ', poi Conferma'; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, scelte) {
    for (var k = 0; k < m.carte.length; k++) if (scelte.indexOf(m.carte[k]) < 0) return 'tocca ' + nomeId(m.carte[k]);
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = []; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m, demo.sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = P.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può. ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo);
    demo.i++; demo.sel = []; demo.fatto = false;
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiPartita)]));
    var scelte = {}, pronto = false, attivo = !!m && !demo.fatto;
    if (attivo) {
      m.carte.forEach(function (id) { scelte[id] = 'suggerita'; });
      demo.sel.forEach(function (id) { scelte[id] = 'scelta'; });
      pronto = prossimaCosa(m, demo.sel) === 'tocca Conferma';
    } else if (m && demo.fatto) {   // rifiuto fatto: le carte restano segnate in rosso
      m.carte.forEach(function (id) { scelte[id] = 'no'; });
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(p);
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte, aperto: null,
      clicca: attivo ? function (c) {
        if (m.carte.indexOf(c.id) < 0) { demoSbagliato(m); return; }
        var i = demo.sel.indexOf(c.id);
        if (i >= 0) demo.sel.splice(i, 1); else demo.sel.push(c.id);
        demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', vaiPartita));
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
  if (leggiVisto()) vaiPartita(); else { schermo = 'domanda'; render(); }
}());
