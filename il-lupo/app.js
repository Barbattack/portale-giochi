/*
 * Il Lupo — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Lupo.apply.
 */
(function () {
  'use strict';
  var L = self.Lupo, D = self.LupoDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'il-lupo-visto';

  // I crediti stanno in un punto solo: qui. La grafia del nome non è verificata.
  var CREDITI = {
    gioco: 'Lobo', autore: 'James Ernest',
    link: 'https://boardgamegeek.com/boardgame/368675/lobo'
  };

  var MOSSE = ['perfetta', 'somma', 'divisa', 'sopra', 'fermati'];
  var schermo;       // 'domanda' | 'inizio' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { mie:[id], sue:[id], mossa }
  var msg, msgOk;
  var demo;          // { i, st }

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
    f.textContent = 'Ispirato a ';
    var a = el('a', null, CREDITI.gioco); a.href = CREDITI.link; a.rel = 'noopener';
    f.appendChild(a);
    f.appendChild(document.createTextNode(' di ' + CREDITI.autore + '.'));
  }

  // ---------- carte ----------
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta ' + c.seme + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', c.valore + ' ' + L.NOME_SEME[c.seme]);
    e.appendChild(el('span', 'v', String(c.valore)));
    return e;
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte:{id:classe}, cliccaMia(c), cliccaSua(c), mossa, cliccaMossa(m), suggerimentoMossa (solo demo) } */
  function tavolo(o) {
    var box = el('div');
    box.appendChild(el('div', 'etichetta', 'Mano del Lupo (' + o.stato.lupo.length + ')'));
    var t = el('div', 'tavolo');
    var lupo = el('div', 'lupo');
    if (!o.stato.lupo.length) lupo.appendChild(el('span', 'vuoto', 'Nessuna carta'));
    o.stato.lupo.forEach(function (c) {
      var b = faccia(c, o.cliccaSua ? 'button' : 'div', o.scelte[c.id] || '');
      if (o.cliccaSua) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaSua(c); }); }
      lupo.appendChild(b);
    });
    t.appendChild(lupo);
    var mz = el('div', 'mazzo');
    if (o.stato.mazzo.length) mz.appendChild(faccia(o.stato.mazzo[0]));
    else mz.appendChild(el('div', 'carta vuoto'));
    mz.appendChild(el('div', null, conTesto(o.stato.mazzo.length, 'carta', 'carte') + ' nel mazzo'));
    t.appendChild(mz);
    box.appendChild(t);
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(el('div', 'etichetta', 'Le tue carte'));
    var mano = el('div', 'mano');
    o.stato.tu.forEach(function (c) {
      var b = faccia(c, o.cliccaMia ? 'button' : 'div', o.scelte[c.id] || '');
      if (o.cliccaMia) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaMia(c); }); }
      mano.appendChild(b);
    });
    box.appendChild(mano);
    var mosse = el('div', 'mosse');
    MOSSE.forEach(function (m) {
      var b = bottone(L.NOME_AZIONE[m], (o.mossa === m ? 'on' : '') + (o.suggerimentoMossa === m ? ' suggerita' : ''), o.cliccaMossa ? function () { o.cliccaMossa(m); } : null);
      if (!o.cliccaMossa) b.tabIndex = -1;
      mosse.appendChild(b);
    });
    box.appendChild(mosse);
    return box;
  }

  function punteggio(st) {
    var p = el('div', 'punti');
    var a = el('span'); a.appendChild(document.createTextNode('Tu ')); a.appendChild(el('b', null, String(st.punti.tu)));
    var b = el('span'); b.appendChild(document.createTextNode('Lupo ')); b.appendChild(el('b', null, String(st.punti.lupo)));
    p.appendChild(a);
    p.appendChild(el('span', 'tot', 'Mano ' + st.mano + ' · si arriva a ' + L.TRAGUARDO));
    p.appendChild(b);
    return p;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, 'Il Lupo'));
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
    p.appendChild(el('p', null, 'Tu e il Lupo avete quattro carte scoperte. Con le tue devi togliere tutte le sue, e fermarti in tempo.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiInizio(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- inizio: livello ----------
  function schermoInizio() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo)]));
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Nuova partita'));
    p.appendChild(el('p', null, 'Scegli il livello. Si gioca a mani, fino a ' + L.TRAGUARDO + ' punti.'));
    p.appendChild(bottone('Facile: carte da 1 a 8', 'grande primo', function () { inizia('facile'); }));
    p.appendChild(bottone('Normale: carte da 1 a 9', 'grande', function () { inizia('normale'); }));
    p.appendChild(bottone('Difficile: carte da 1 a 10', 'grande', function () { inizia('difficile'); }));
    app.appendChild(p);
  }
  function vaiInizio() { schermo = 'inizio'; render(); }
  function inizia(livello) {
    g = L.nuova(semeIniziale(), { livello: livello });
    azzera(); schermo = 'partita'; manoNuova(); render();
  }
  function azzera() { sel = { mie: [], sue: [], mossa: null }; }
  function manoNuova() {
    msgOk = false;
    msg = g.ultimo && g.ultimo.rimescolato ? 'Mazzo rimescolato. ' : '';
    msg += 'Scegli le carte, una mossa, e conferma.';
    avvisoSenzaMosse();
  }
  function avvisoSenzaMosse() { if (g.senzaMosse && !g.fine) { msg = 'Non hai nessuna mossa possibile: devi fermarti.'; msgOk = false; } }

  // ---------- partita ----------
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiInizio)]));
    app.appendChild(punteggio(g));
    var fine = !!g.fine, scelte = {};
    sel.mie.concat(sel.sue).forEach(function (id) { scelte[id] = 'scelta'; });
    app.appendChild(tavolo({
      stato: g, scelte: scelte, mossa: sel.mossa,
      cliccaMia: fine ? null : function (c) { alterna(sel.mie, c.id); },
      cliccaSua: fine ? null : function (c) { alterna(sel.sue, c.id); },
      cliccaMossa: fine ? null : function (m) { sel.mossa = sel.mossa === m ? null : m; msg = ''; render(); }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !sel.mossa;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function alterna(lista, id) {
    var i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
    msg = ''; msgOk = false; render();
  }
  function riassunto(u) {
    var dove = function (cs) { return cs.map(function (c) { return c.valore; }).join(' + '); };
    var t = L.NOME_AZIONE[u.azione] + ': ' + dove(u.mie) + ' contro ' + dove(u.sue) + '. ';
    if (u.chi) t += (u.chi === 'tu' ? 'Peschi ' : 'Il Lupo pesca ') + conTesto(u.quante, 'carta', 'carte') + '.';
    if (u.rimescolato) t += ' Mazzo finito: scarti rimescolati.';
    return t;
  }
  function conferma() {
    var n = L.apply(g, sel.mossa === 'fermati' ? { t: 'fermati' }
      : { t: 'gioca', azione: sel.mossa, mie: sel.mie, sue: sel.sue });
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la selezione resta
    g = n; azzera(); msgOk = true;
    msg = g.ultimo.azione === 'fermati' ? 'Ti sei fermato.' : riassunto(g.ultimo);
    if (g.senzaMosse) { msg += ' Non hai nessuna mossa possibile: devi fermarti.'; }
    render();
  }
  function spiegaFine(f) {
    if (f.motivo === 'lupo-vuoto') return 'Il Lupo è senza carte: segni ' + conTesto(f.punti, 'punto', 'punti') + '.';
    if (f.motivo === 'fermata') return 'Ti sei fermato: il Lupo segna ' + conTesto(f.punti, 'punto', 'punti') + '.';
    return 'Sei senza carte: il Lupo segna ' + conTesto(f.punti, 'punto', 'punti') + '.';
  }
  function finale() {
    var p = el('div', 'pannello fine');
    if (g.vincitore) p.appendChild(el('h2', null, g.vincitore === 'tu' ? 'Hai vinto la partita!' : 'Ha vinto il Lupo.'));
    else p.appendChild(el('h2', null, 'Mano finita'));
    p.appendChild(el('p', null, spiegaFine(g.fine)));
    p.appendChild(el('p', null, 'Tu ' + g.punti.tu + ' – Lupo ' + g.punti.lupo));
    if (g.vincitore) p.appendChild(bottone('Nuova partita', 'grande primo', vaiInizio));
    else p.appendChild(bottone('Mano successiva', 'grande primo', function () {
      g = L.apply(g, { t: 'prossima' }); azzera(); manoNuova(); render();
    }));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false }; render(); }
  function valoreDi(id) {
    var tutte = demo.st.tu.concat(demo.st.lupo), k;
    for (k = 0; k < tutte.length; k++) if (tutte[k].id === id) return tutte[k].valore;
    return id;
  }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  // i pezzi che il passo chiede di toccare, nell'ordine: le tue, quelle del Lupo, la mossa
  function daFare(m) {
    var mie = (m.mie || []).map(valoreDi), sue = (m.sue || []).map(function (id) { return 'il ' + valoreDi(id); });
    var t = '';
    if (mie.length === 1) t = 'il tuo ' + mie[0];
    else if (mie.length) t = 'i tuoi ' + elenco(mie);
    if (sue.length) t += (t ? (sue.length > 1 ? ', poi ' : ' e ') : '') + elenco(sue) + ' del Lupo';
    return { carte: t, mossa: L.NOME_AZIONE[m.t === 'fermati' ? 'fermati' : m.azione] };
  }
  function frase(m) {
    var d = daFare(m);
    return 'Tocca ' + (d.carte ? d.carte + ', poi ' : '') + d.mossa + ', poi Conferma';
  }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, sel) {
    var k, id;
    for (k = 0; k < (m.mie || []).length; k++) { id = m.mie[k]; if (sel.mie.indexOf(id) < 0) return 'tocca il tuo ' + valoreDi(id); }
    for (k = 0; k < (m.sue || []).length; k++) { id = m.sue[k]; if (sel.sue.indexOf(id) < 0) return 'tocca il ' + valoreDi(id) + ' del Lupo'; }
    var nome = L.NOME_AZIONE[m.t === 'fermati' ? 'fermati' : m.azione];
    if (sel.mossa !== (m.t === 'fermati' ? 'fermati' : m.azione)) return 'tocca ' + nome;
    return 'tocca Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa, sel = demo.sel;
    if (prossimaCosa(m, sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = L.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true;
    demo.msg = m.t === 'fermati' ? spiegaFine(n.fine) : riassunto(n.ultimo);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; }
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    var fine = !!demo.st.fine;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiInizio)]));
    if (m && !demo.sel) demo.sel = { mie: [], sue: [], mossa: null };
    var sel = demo.sel, scelte = {}, aiuto = {}, aiutoMossa = null, pronto = false;
    if (m && !demo.fatto) {
      (m.mie || []).concat(m.sue || []).forEach(function (id) { aiuto[id] = 'suggerita'; });
      sel.mie.concat(sel.sue).forEach(function (id) { aiuto[id] = 'scelta'; });
      aiutoMossa = m.t === 'fermati' ? 'fermati' : m.azione;
      pronto = prossimaCosa(m, sel) === 'tocca Conferma';
    } else if (m && demo.fatto) {   // rifiuto fatto: le carte restano segnate in rosso
      (m.mie || []).concat(m.sue || []).forEach(function (id) { aiuto[id] = 'no'; });
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(p);
    var attivo = m && !demo.fatto && !fine;
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto, mossa: attivo ? sel.mossa : (m && demo.fatto && !fine ? (m.t === 'fermati' ? 'fermati' : m.azione) : null),
      suggerimentoMossa: attivo ? aiutoMossa : null, mossaPronta: pronto,
      cliccaMia: attivo ? function (c) { demoCarta(m, sel.mie, c.id, (m.mie || [])); } : null,
      cliccaSua: attivo ? function (c) { demoCarta(m, sel.sue, c.id, (m.sue || [])); } : null,
      cliccaMossa: attivo ? function (x) {
        var giusta = m.t === 'fermati' ? 'fermati' : m.azione;
        if (x !== giusta) { demoSbagliato(m); return; }
        sel.mossa = sel.mossa === x ? null : x; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    var box = el('div', 'passo');
    if (m && !demo.fatto) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) {
      az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    } else if (m && !demo.fatto) {
      /* mano finita prima del tempo: non succede con la mano preparata */
    } else if (ultimo && (!m || demo.fatto)) {
      az.appendChild(bottone('Gioca', 'conferma', vaiInizio));
    } else {
      az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    }
    app.appendChild(az);
  }
  function demoCarta(m, lista, id, giuste) {
    if (giuste.indexOf(id) < 0) { demoSbagliato(m); return; }
    var i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
    demo.msg = ''; demo.ok = false; render();
  }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'inizio') schermoInizio();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  crediti();
  schermo = leggiVisto() ? 'inizio' : 'domanda';
  render();
}());
