/*
 * Area 52 — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Area.apply.
 */
(function () {
  'use strict';
  var A = self.Area, D = self.AreaDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'area-52-visto';
  var TITOLO = 'Area 52';      // titolo provvisorio: il titolo italiano verrà dopo, si cambia qui e in index.html

  // I crediti stanno in un punto solo: qui.
  var CREDITI = {
    gioco: 'Area 52', autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    fonti: 'Meccaniche da Button Men, tema da Onslaught di Thorin Tatge.'
  };
  var NOME_MOSSA = { doppio: 'Attacco doppio', singolo: 'Attacco singolo', sacrificio: 'Sacrificio' };
  var QUANTI = { doppio: 2, singolo: 1, sacrificio: 1 };
  var ORDINE_MOSSE = ['doppio', 'singolo', 'sacrificio'];

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var tipo;          // null | 'doppio' | 'singolo' | 'sacrificio' (scelto, non ancora confermato)
  var sel;           // [id] difensori scelti, non ancora confermati
  var aperto;        // null | 'scarti'
  var msg, msgOk;
  var demo;          // { i, st, tipo, sel, fatto, msg, ok }

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
    var p = el('p');
    var a = el('a', null, CREDITI.gioco); a.href = CREDITI.link; a.rel = 'noopener';
    p.appendChild(a);
    p.appendChild(document.createTextNode(' di ' + CREDITI.autore + ', dalla collezione ' + CREDITI.collezione + '.'));
    f.appendChild(p);
    f.appendChild(el('p', null, CREDITI.fonti));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  function semeCls(c) { return A.eRossa(c) ? 'R' : 'N'; }
  function nomi(carte) { return carte.map(A.nomeCarta); }
  function meno(n) { return (n < 0 ? '−' : '') + Math.abs(n); }

  // ---------- carte ----------
  var SIGLA = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta ' + semeCls(c) + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', A.nomeCarta(c));
    e.appendChild(el('span', 'v', SIGLA[c.valore] || String(c.valore)));
    e.appendChild(el('span', 's', A.SIMBOLO[c.seme]));
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
    A.SEMI.forEach(function (se) {
      var rosso = se === 'C' || se === 'Q';
      gr.appendChild(el('span', 'seme' + (rosso ? ' R' : ''), A.SIMBOLO[se]));
      for (var v = 1; v <= 13; v++) {
        gr.appendChild(el('span', 'c' + (presenti[se + v] ? ' si' : '') + (rosso ? ' R' : ''), SIGLA[v] || String(v)));
      }
    });
    box.appendChild(gr);
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte:{id:classe}, tipo, mosse:bool (mostra i tre tasti), suggerisciTipo, clicca(c), cliccaTipo(t), apriScarti, aperto } */
  function tavolo(o) {
    var s = o.stato, box = el('div');
    var ond = el('div', 'ondata');
    if (s.ondata === 1) ond.appendChild(el('b', null, 'Prima ondata'));
    else {
      ond.appendChild(el('b', null, 'Seconda ondata. '));
      ond.appendChild(document.createTextNode('Dopo un attacco doppio scarti anche i difensori usati dello stesso colore dell\'alieno.'));
    }
    box.appendChild(ond);

    var pl = el('div', 'pile');
    pl.appendChild(pila('Mazzo alieni', s.alieni.length, 'coperto'));
    pl.appendChild(pila('Mazzo difensori', s.mazzoDif.length));
    pl.appendChild(pila('Scarti', s.scarti.length, o.apriScarti ? 'tocca per guardare' : '', o.apriScarti, o.aperto === 'scarti'));
    box.appendChild(pl);
    if (o.aperto === 'scarti') box.appendChild(griglia(A.carteNegliScarti(s), 'Carte negli scarti, in ordine di seme e valore'));

    box.appendChild(el('div', 'etichetta', 'Alieni in arrivo, in ordine'));
    var ar = el('div', 'arrivo');
    var POSTO = ['adesso', 'poi', 'dopo'];
    for (var k = 0; k < A.IN_ARRIVO; k++) {
      var posto = el('div', 'posto' + (k === 0 ? ' ora' : ''));
      var c = s.inArrivo[k];
      posto.appendChild(c ? faccia(c, 'div', '') : el('div', 'vuoto'));
      posto.appendChild(el('small', null, POSTO[k]));
      ar.appendChild(posto);
    }
    box.appendChild(ar);

    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));

    box.appendChild(el('div', 'etichetta', 'I tuoi difensori (' + s.difensori.length + ' su ' + A.TAVOLO + ')'));
    var di = el('div', 'difensori');
    for (k = 0; k < A.TAVOLO; k++) {
      var d = s.difensori[k];
      if (!d) { di.appendChild(el('div', 'vuoto')); continue; }
      var b = faccia(d, o.clicca ? 'button' : 'div', o.scelte[d.id] || '');
      if (o.clicca) { b.type = 'button'; b.addEventListener('click', (function (x) { return function () { o.clicca(x); }; }(d))); }
      di.appendChild(b);
    }
    box.appendChild(di);

    if (o.mosse) {
      var mo = el('div', 'mosse');
      ORDINE_MOSSE.forEach(function (t) {
        var cls = (o.tipo === t ? 'scelta' : '') + (o.suggerisciTipo === t ? ' suggerita' : '');
        var bt = bottone(NOME_MOSSA[t], cls, o.cliccaTipo ? function () { o.cliccaTipo(t); } : null);
        bt.disabled = !o.cliccaTipo;
        mo.appendChild(bt);
      });
      box.appendChild(mo);
    }
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
  function riassunto(u) {
    var a = A.nomeCarta(u.alieno), t;
    if (u.t === 'doppio') {
      t = 'Attacco doppio: ' + nomi(u.usati).join(' più ') + ' fanno ' + u.alieno.valore + '. ' + a + ' va negli scarti.';
      if (u.persi.length) t += ' Seconda ondata: perdi anche ' + elenco(nomi(u.persi)) + '.';
    } else if (u.t === 'singolo') {
      t = 'Attacco singolo: ' + A.nomeCarta(u.usati[0]) + ' va negli scarti e ' + a + ' prende il suo posto.';
    } else {
      t = 'Sacrificio: scarti ' + A.nomeCarta(u.usati[0]) + '. ' + a + ' va in fondo al mazzo degli alieni.';
    }
    if (u.pescate) t += ' Peschi ' + conTesto(u.pescate, 'difensore', 'difensori') + '.';
    if (u.ondata2) t += ' Il mazzo degli alieni è finito: gli scarti rimescolati sono la seconda ondata.';
    return t;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Hai sei difensori contro una fila di alieni. Per ogni alieno scegli: attacco doppio, attacco singolo o sacrificio.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita() {
    g = A.nuova(semeIniziale());
    tipo = null; sel = []; aperto = null; schermo = 'partita'; msgOk = false;
    msg = 'Scegli la mossa, poi i difensori, poi Conferma.';
    render();
  }
  function scegliTipo(t) {
    tipo = tipo === t ? null : t;
    if (tipo) sel = sel.slice(-QUANTI[tipo]);
    msg = ''; msgOk = false; render();
  }
  function scegliDifensore(c) {
    if (!tipo) { msg = 'Prima scegli la mossa.'; msgOk = false; render(); return; }
    var i = sel.indexOf(c.id);
    if (i >= 0) sel.splice(i, 1);
    else { sel.push(c.id); if (sel.length > QUANTI[tipo]) sel.shift(); }   // oltre il numero previsto, l'ultima scelta sostituisce la più vecchia
    msg = ''; msgOk = false; render();
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiPartita)]));
    var fine = !!g.fine, scelte = {};
    sel.forEach(function (id) { scelte[id] = 'scelta'; });
    app.appendChild(tavolo({
      stato: g, scelte: scelte, aperto: aperto, tipo: tipo, mosse: !fine,
      clicca: fine ? null : scegliDifensore,
      cliccaTipo: fine ? null : scegliTipo,
      apriScarti: function () { aperto = aperto === 'scarti' ? null : 'scarti'; render(); }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !tipo;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var n = A.apply(g, { t: tipo, carte: sel.slice() });
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la scelta resta, si può cambiare
    g = n; tipo = null; sel = []; msgOk = true;
    msg = riassunto(g.ultimo);
    render();
  }
  function finale() {
    var f = g.fine, p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, f.esito === 'vittoria' ? 'Hai vinto!' : 'Hai perso.'));
    p.appendChild(el('p', 'punteggio', 'Punteggio: ' + meno(f.punti)));
    if (f.esito === 'vittoria') {
      p.appendChild(el('p', 'dettaglio', 'Hai sconfitto tutta la seconda ondata. ' + conTesto(f.nelMazzo, 'carta', 'carte') + ' nel mazzo dei difensori più ' + conTesto(f.sulTavolo, 'difensore', 'difensori') + ' sul tavolo.'));
    } else {
      var t = 'Sei rimasto senza difensori. Alieni rimasti, scoperti compresi: ' + f.rimasti + '.';
      if (f.penalita) t += ' E ' + meno(-f.penalita) + ' perché eri ancora nella prima ondata.';
      p.appendChild(el('p', 'dettaglio', t));
    }
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiPartita));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), tipo: null, sel: [], fatto: false, msg: '', ok: false }; render(); }
  function vaiPasso(i) {
    demo.i = i; demo.tipo = null; demo.sel = []; demo.fatto = false;
    if (D.passi[i].scena) demo.st = D.scena(D.passi[i].scena);
  }
  function nomeId(id) { return A.nomeCarta(A.daId(id)); }
  // le cose da toccare, nell'ordine: la mossa, i difensori, Conferma
  function daToccare(m) { return [NOME_MOSSA[m.t]].concat(m.carte.map(nomeId)).concat(['Conferma']); }
  function frase(m) { var v = daToccare(m); return 'Tocca ' + v.slice(0, -1).join(', poi ') + ', poi ' + v[v.length - 1] + '.'; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m) {
    if (demo.tipo !== m.t) return 'tocca ' + NOME_MOSSA[m.t];
    for (var k = 0; k < m.carte.length; k++) if (demo.sel.indexOf(m.carte[k]) < 0) return 'tocca ' + nomeId(m.carte[k]);
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m) + '.'; demo.ok = false; render(); }
  function demoAvanti() { vaiPasso(demo.i + 1); demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = A.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può. ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo);
    vaiPasso(demo.i + 1);
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiPartita)]));
    var scelte = {}, pronto = false, attivo = !!m && !demo.fatto, sugg = null;
    if (attivo) {
      var dopo = prossimaCosa(m);
      pronto = dopo === 'tocca Conferma';
      if (demo.tipo !== m.t) sugg = m.t;
      m.carte.forEach(function (id) { if (demo.tipo === m.t && demo.sel.indexOf(id) < 0) scelte[id] = 'suggerita'; });
      demo.sel.forEach(function (id) { scelte[id] = 'scelta'; });
    } else if (m && demo.fatto) {   // rifiuto fatto: le carte restano segnate in rosso
      m.carte.forEach(function (id) { scelte[id] = 'no'; });
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(p);
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m)));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte, aperto: null, tipo: demo.tipo, suggerisciTipo: sugg, mosse: true,
      clicca: attivo ? function (c) {
        if (demo.tipo !== m.t || m.carte.indexOf(c.id) < 0) { demoSbagliato(m); return; }
        var i = demo.sel.indexOf(c.id);
        if (i >= 0) demo.sel.splice(i, 1); else demo.sel.push(c.id);
        demo.msg = ''; demo.ok = false; render();
      } : null,
      cliccaTipo: attivo ? function (t) {
        if (t !== m.t) { demoSbagliato(m); return; }
        demo.tipo = demo.tipo === t ? null : t;
        demo.msg = ''; demo.ok = false; render();
      } : null
    }));
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
