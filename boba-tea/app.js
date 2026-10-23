/*
 * The First Boba Tea Shop in London — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Boba.apply.
 */
(function () {
  'use strict';
  var B = self.Boba, D = self.BobaDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'boba-tea-visto';
  var TITOLO = 'The First Boba Tea Shop in London';   // titolo provvisorio: il titolo italiano verrà dopo, si cambia qui e in index.html

  // I crediti stanno in un punto solo: qui.
  var CREDITI = {
    gioco: 'The First Boba Tea Shop in London', autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    variante: 'variante di Queue 4 di Andrew Bowling'
  };

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var ui;            // { coda, pos } scelta non ancora confermata
  var aperto;        // null | 'mazzo'
  var msg, msgOk;
  var demo;          // { i, st, ui, msg, ok }

  var SIGLA = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };

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
    f.appendChild(document.createTextNode(' di ' + CREDITI.autore + ', dalla collezione ' + CREDITI.collezione + ': ' + CREDITI.variante + '.'));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }

  // ---------- carte ----------
  function faccia(c, tag, cls) {            // carta intera (mazzo in mano)
    var e = el(tag || 'div', 'carta ' + (B.eRossa(c) ? 'R' : 'N') + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', B.nomeCarta(c));
    e.appendChild(el('span', 'v', SIGLA[c.valore] || String(c.valore)));
    e.appendChild(el('span', 's', B.SIMBOLO[c.seme]));
    return e;
  }
  function striscia(c, cls) {               // carta in coda: una striscia, valore e seme
    var e = el('div', 'cs ' + (B.eRossa(c) ? 'R' : 'N') + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', B.nomeCarta(c));
    e.appendChild(el('span', 'v', SIGLA[c.valore] || String(c.valore)));
    e.appendChild(el('span', 's', B.SIMBOLO[c.seme]));
    return e;
  }

  // ---------- descrizione di un posto, a parole ----------
  function posto(s, coda, pos) {
    var c = s.code[coda];
    if (pos >= c.length) return 'sopra ' + B.nomeCarta(c[c.length - 1]);
    if (pos === 0) return 'sotto ' + B.nomeCarta(c[0]);
    return 'fra ' + B.nomeCarta(c[pos - 1]) + ' e ' + B.nomeCarta(c[pos]);
  }

  // ---------- code ----------
  /* o: { stato, ui, bloccato, suggerita:{coda,pos}|null, scegliCoda(i), scegliPos(i,p) } */
  function colonna(i, o) {
    var s = o.stato, cards = s.code[i];
    var col = el('div', 'coda' + (o.ui.coda === i ? ' on' : ''));
    var tgt = o.suggerita && o.suggerita.coda === i;
    var testa = bottone('Coda ' + (i + 1), 'testa' + (tgt && o.ui.coda !== i ? ' suggerita' : ''), o.scegliCoda ? function () { o.scegliCoda(i); } : null);
    if (!o.scegliCoda) testa.disabled = true;
    testa.appendChild(el('small', null, conTesto(cards.length, 'carta', 'carte')));
    col.appendChild(testa);
    var lista = el('div', 'lista');
    var aperta = !o.bloccato && o.ui.coda === i;           // la coda scelta si apre con i posti fra le carte
    var fisso = o.bloccato && s.posto && s.posto.coda === i;
    function slot(p) {
      if (fisso) {
        if (p !== s.posto.pos) return;
        var m = el('div', 'slot scelto fisso');
        if (s.mano) m.appendChild(striscia(s.mano, 'fantasma'));
        lista.appendChild(m);
        return;
      }
      if (!aperta) return;
      var scelto = o.ui.pos === p;
      var sug = tgt && o.suggerita.pos === p && !scelto;
      var b = el('button', 'slot' + (scelto ? ' scelto' : '') + (sug ? ' suggerita' : ''), scelto ? 'qui' : '+');
      b.type = 'button';
      b.setAttribute('aria-label', 'Posto ' + posto(s, i, p));
      b.addEventListener('click', function () { o.scegliPos(i, p); });
      lista.appendChild(b);
    }
    for (var p = cards.length; p >= 0; p--) {
      slot(p);
      if (p > 0) lista.appendChild(striscia(cards[p - 1]));
    }
    col.appendChild(lista);
    return col;
  }

  // ---------- mazzo e scarti ----------
  function pila(nome, n, sotto, clic, acceso, suggerita) {
    var b = el(clic ? 'button' : 'div', 'pila' + (acceso ? ' on' : '') + (suggerita ? ' suggerita' : ''));
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
    B.SEMI.forEach(function (se) {
      var rosso = se === 'C' || se === 'Q';
      gr.appendChild(el('span', 'seme' + (rosso ? ' R' : ''), B.SIMBOLO[se]));
      for (var v = 1; v <= 13; v++) {
        gr.appendChild(el('span', 'c' + (presenti[se + v] ? ' si' : '') + (rosso ? ' R' : ''), SIGLA[v] || String(v)));
      }
    });
    box.appendChild(gr);
    return box;
  }
  function scartiTreFile(s) {
    var box = el('div', 'scarti');
    box.appendChild(el('h3', null, 'Scarti (' + s.scarti.length + '), su tre file secondo quante volte è uscito il valore'));
    B.fileScarti(s).forEach(function (fila, k) {
      var r = el('div', 'fila' + (k === 2 ? ' pericolo' : ''));
      r.appendChild(el('span', 'volte', (k + 1) + '×'));
      var ch = el('div', 'chips');
      fila.forEach(function (c) {
        var x = el('span', 'chip ' + (B.eRossa(c) ? 'R' : 'N'), (SIGLA[c.valore] || String(c.valore)) + B.SIMBOLO[c.seme]);
        x.setAttribute('aria-label', B.nomeCarta(c));
        ch.appendChild(x);
      });
      r.appendChild(ch);
      box.appendChild(r);
    });
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, ui, suggerita, scegliCoda, scegliPos, conferma, resta, caccia, apriMazzo, aperto, ctrl:'tutti'|'nessuno', sugg:{conferma,resta,caccia,mazzo} } */
  function tavolo(o) {
    var s = o.stato, box = el('div'), sg = o.sugg || {};
    var pl = el('div', 'pile');
    pl.appendChild(pila('Mazzo', s.mazzo.length, o.apriMazzo ? 'per guardare' : '', o.apriMazzo, o.aperto === 'mazzo', sg.mazzo));
    var mano = el('div', 'inmano');
    mano.appendChild(el('span', 'etichetta', 'In mano'));
    if (s.mano) mano.appendChild(faccia(s.mano)); else mano.appendChild(el('span', 'carta vuota'));
    pl.appendChild(mano);
    pl.appendChild(pila('Scarti', s.scarti.length, '', null, false));
    box.appendChild(pl);
    if (o.aperto === 'mazzo') box.appendChild(griglia(B.carteNelMazzo(s), 'Carte rimaste nel mazzo, in ordine di valore (non è l\'ordine in cui usciranno)'));
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));

    var az = el('div', 'azioni');
    if (!s.fine) {
      if (s.mano) {
        az.appendChild(bottone('Resta', 'resta' + (sg.resta ? ' suggerita' : ''), o.resta));
        az.appendChild(bottone('Caccialo', 'caccia' + (sg.caccia ? ' suggerita' : ''), o.caccia));
      } else {
        var c = bottone('Conferma e pesca', 'conferma' + (sg.conferma ? ' suggerita' : ''), o.conferma);
        c.disabled = o.ui.coda == null || o.ui.pos == null;
        az.appendChild(c);
      }
      box.appendChild(az);
    }
    var code = el('div', 'code');
    for (var i = 0; i < B.NUM_CODE; i++) {
      code.appendChild(colonna(i, {
        stato: s, ui: o.ui, bloccato: !!s.mano, suggerita: o.suggerita,
        scegliCoda: s.fine || s.mano ? null : o.scegliCoda, scegliPos: o.scegliPos
      }));
    }
    box.appendChild(code);
    box.appendChild(scartiTreFile(s));
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
  function racconta(u) {
    var t = '';
    var nc = 'nella coda ' + (u.coda + 1);
    if (u.azione === 'resta') {
      t = 'Resta: ' + conTesto(u.scartate.length, 'carta', 'carte') + ' della coda ' + (u.coda + 1) + ' negli scarti (' + elenco(u.scartate.map(B.sigla)) + '). ' + B.sigla(u.pescata) + ' comincia una coda nuova.';
    } else {
      if (u.azione === 'caccia') {
        t = 'Cacciato: scarti ' + elenco(u.scartate.map(B.sigla)) + '. ';
        if (u.scartate.length === 1) t += 'Il mazzo era vuoto: si scarta solo la carta in mano. ';
        if (u.pescata) t += 'Peschi ' + B.sigla(u.pescata) + ': ' + (u.entrata ? 'entra ' + nc + '.' : 'non sta.');
      } else {
        t = 'Peschi ' + B.sigla(u.pescata) + ': ' + (u.entrata ? 'entra ' + nc + '.' : 'non sta.');
      }
    }
    return t.trim();
  }
  function spiegaFine(f) {
    var n = conTesto(f.punti, 'carta', 'carte');
    if (f.esito === 'vittoria') return 'Il mazzo è finito e non hai scartato quattro carte dello stesso valore. Punteggio: ' + n + ' in coda (più sono, meglio è).';
    return 'Hai scartato la quarta carta di valore ' + (B.NOME_VALORE[f.valore] || f.valore) + '. Avevi ' + n + ' in coda.';
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Quattro code di clienti. A ogni turno scegli dove entrerà il prossimo, poi peschi: se non sta, o resta o lo cacci.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita() {
    g = B.nuova(semeIniziale());
    ui = { coda: null, pos: null }; aperto = null; schermo = 'partita'; msgOk = false;
    msg = 'Scegli una coda e il posto del prossimo cliente, poi Conferma e pesca.';
    render();
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiPartita)]));
    app.appendChild(tavolo({
      stato: g, ui: ui, aperto: aperto,
      scegliCoda: function (i) { if (ui.coda === i) { ui = { coda: null, pos: null }; } else ui = { coda: i, pos: null }; msg = ''; msgOk = false; render(); },
      scegliPos: function (i, p) { ui = { coda: i, pos: p }; msg = ''; msgOk = false; render(); },
      conferma: function () { fai({ t: 'pesca', coda: ui.coda, pos: ui.pos }); },
      resta: function () { fai({ t: 'resta' }); },
      caccia: function () { fai({ t: 'caccia' }); },
      apriMazzo: function () {
        if (g.mano) { msg = 'Il mazzo si guarda prima di pescare.'; msgOk = false; render(); return; }
        aperto = aperto === 'mazzo' ? null : 'mazzo'; render();
      }
    }));
    if (g.fine) finale();
  }
  function fai(mossa) {
    var n = B.apply(g, mossa);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }
    g = n; ui = { coda: null, pos: null }; aperto = null; msgOk = true;
    msg = racconta(g.ultimo) + (g.mano ? ' Scegli: Resta o Caccialo.' : '');
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
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), ui: { coda: null, pos: null }, msg: '', ok: false, aperto: null }; render(); }
  // la prossima cosa che manca da toccare
  function prossimaCosa(m, u) {
    if (m.t === 'pesca') {
      if (u.coda !== m.coda) return 'tocca la coda ' + (m.coda + 1);
      if (u.pos !== m.pos) return 'tocca il posto ' + posto(demo.st, m.coda, m.pos);
      return 'tocca Conferma e pesca';
    }
    if (m.t === 'resta') return 'tocca Resta';
    if (m.t === 'caccia') return 'tocca Caccialo';
    return 'tocca il Mazzo';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.ui) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.ui = { coda: null, pos: null }; demo.msg = ''; demo.ok = false; demo.aperto = null; render(); }
  function demoMossa(m) {
    var n = B.apply(demo.st, m);
    if (n.rifiuto) { demo.msg = 'Non si può. ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = racconta(n.ultimo);
    demo.i++; demo.ui = { coda: null, pos: null }; demo.aperto = null;
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiPartita)]));
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(p);
    var attivo = !!m, sugg = {}, suggerita = null;
    if (attivo) {
      var cosa = prossimaCosa(m, demo.ui);
      if (m.t === 'pesca') {
        suggerita = { coda: m.coda, pos: m.pos };
        sugg.conferma = cosa === 'tocca Conferma e pesca';
      }
      if (m.t === 'resta') sugg.resta = true;
      if (m.t === 'caccia') sugg.caccia = true;
      if (m.t === 'guarda') sugg.mazzo = demo.aperto !== 'mazzo';
    }
    msg = demo.msg; msgOk = demo.ok;
    var giaGuardato = m && m.t === 'guarda' && demo.aperto === 'mazzo';
    app.appendChild(tavolo({
      stato: demo.st, ui: demo.ui, aperto: demo.aperto, suggerita: suggerita, sugg: sugg,
      scegliCoda: attivo && m.t === 'pesca' ? function (i) {
        if (i !== m.coda) { demoSbagliato(m); return; }
        demo.ui = { coda: i, pos: null }; demo.msg = ''; demo.ok = false; render();
      } : function () { if (attivo) demoSbagliato(m); },
      scegliPos: function (i, pp) {
        if (!attivo || m.t !== 'pesca' || i !== m.coda || pp !== m.pos) { if (attivo) demoSbagliato(m); return; }
        demo.ui = { coda: i, pos: pp }; demo.msg = ''; demo.ok = false; render();
      },
      conferma: function () {
        if (!attivo || prossimaCosa(m, demo.ui) !== 'tocca Conferma e pesca') { if (attivo) demoSbagliato(m); return; }
        demoMossa(m);
      },
      resta: function () { if (attivo && m.t === 'resta') demoMossa(m); else if (attivo) demoSbagliato(m); },
      caccia: function () { if (attivo && m.t === 'caccia') demoMossa(m); else if (attivo) demoSbagliato(m); },
      apriMazzo: function () {
        if (attivo && m.t === 'guarda') { demo.aperto = 'mazzo'; demo.msg = 'Ecco le carte rimaste, per valore: non dicono l\'ordine in cui usciranno.'; demo.ok = true; render(); return; }
        if (attivo) demoSbagliato(m);
      }
    }));
    var box = el('div', 'passo');
    if (attivo && !giaGuardato) box.appendChild(el('b', 'istruzione', 'Ora ' + prossimaCosa(m, demo.ui) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (giaGuardato) az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    else if (!attivo && ultimo) az.appendChild(bottone('Gioca', 'conferma', vaiPartita));
    else if (!attivo) az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
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
