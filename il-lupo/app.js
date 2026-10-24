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

  var MOSSE = ['perfetta', 'somma', 'divisa', 'sopra', 'fermati'];   // la legenda del tutorial (nella partita compaiono solo le mosse possibili)
  var schermo;       // 'domanda' | 'inizio' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { mie:[id], sue:[id], mossa (Sopra/Divisa in attesa delle carte del Lupo), chiedi (la domanda «Ti fermi?» è aperta) }
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
  // di: 'lupo' | 'tu' | 'mazzo' — dice di chi è la carta (serve a chi legge e alla vignetta del tutorial: «Il tuo 7», «Il 7 del Lupo»)
  function faccia(c, tag, cls, di) {
    var e = el(tag || 'div', 'carta ' + c.seme + (cls ? ' ' + cls : ''));
    var col = L.NOME_SEME[c.seme];
    e.setAttribute('aria-label', di === 'lupo' ? 'Il ' + c.valore + ' del Lupo, ' + col : di === 'tu' ? 'Il tuo ' + c.valore + ', ' + col
      : di === 'mazzo' ? 'La scoperta: ' + c.valore + ' ' + col : c.valore + ' ' + col);
    e.setAttribute('data-id', c.id);
    e.appendChild(el('span', 'v', String(c.valore)));
    return e;
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte:{id:classe}, cliccaMia(c), cliccaSua(c), pulsanti:[{azione, on, suggerita, click}], domanda:{punti, si, no, siSuggerita} | null } */
  function tavolo(o) {
    var box = el('div');
    box.appendChild(el('div', 'etichetta', 'Mano del Lupo (' + o.stato.lupo.length + ')'));
    var t = el('div', 'tavolo');
    var lupo = el('div', 'lupo');
    if (!o.stato.lupo.length) lupo.appendChild(el('span', 'vuoto', 'Nessuna carta'));
    o.stato.lupo.forEach(function (c) {
      var b = faccia(c, o.cliccaSua ? 'button' : 'div', o.scelte[c.id] || '', 'lupo');
      if (o.cliccaSua) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaSua(c); }); }
      lupo.appendChild(b);
    });
    t.appendChild(lupo);
    var mz = el('div', 'mazzo');
    if (o.stato.mazzo.length) mz.appendChild(faccia(o.stato.mazzo[0], null, null, 'mazzo'));
    else mz.appendChild(el('div', 'carta vuoto'));
    mz.appendChild(el('div', null, conTesto(o.stato.mazzo.length, 'carta', 'carte') + ' nel mazzo'));
    t.appendChild(mz);
    box.appendChild(t);
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(el('div', 'etichetta', 'Le tue carte'));
    var mano = el('div', 'mano');
    o.stato.tu.forEach(function (c) {
      var b = faccia(c, o.cliccaMia ? 'button' : 'div', o.scelte[c.id] || '', 'tu');
      if (o.cliccaMia) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaMia(c); }); }
      mano.appendChild(b);
    });
    box.appendChild(mano);
    if (o.domanda) {   // «Ti fermi?»: l'unica mossa con una domanda
      var dom = el('div', 'mosse domanda');
      dom.appendChild(el('div', 'quesito', 'Ti fermi? Il Lupo segna ' + conTesto(o.domanda.punti, 'punto', 'punti')));
      dom.appendChild(bottone('Sì', 'si' + (o.domanda.siSuggerita ? ' suggerita' : ''), o.domanda.si));
      dom.appendChild(bottone('No', 'no', o.domanda.no));
      box.appendChild(dom);
      return box;
    }
    var mosse = el('div', 'mosse');
    (o.pulsanti || []).forEach(function (p) {
      var b = bottone(L.NOME_AZIONE[p.azione], (p.azione === 'fermati' ? 'ferma ' : '') + (p.on ? 'on ' : '') + (p.suggerita ? 'suggerita' : ''), p.click ? function () { p.click(p.azione); } : null);
      if (!p.click) b.tabIndex = -1;
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
  function azzera() { sel = { mie: [], sue: [], mossa: null, chiedi: false }; }
  function manoNuova() {
    msgOk = false;
    msg = g.ultimo && g.ultimo.rimescolato ? 'Mazzo rimescolato.' : '';
    avvisoSenzaMosse();
  }
  function avvisoSenzaMosse() { if (g.senzaMosse && !g.fine) { msg = 'Non hai nessuna mossa possibile: devi fermarti.'; msgOk = false; } }

  // ---------- le mosse con le carte scelte (tutto il conto sta in Lupo.mossePossibili) ----------
  function opzioniDi(stato, s) { return L.mossePossibili(stato.tu, stato.lupo, s.mie); }
  // le carte del Lupo da toccare, se Sopra o Divisa aspettano la scelta
  function bersagliDi(stato, s) {
    if (!s.mossa) return [];
    var o = opzioniDi(stato, s).filter(function (x) { return x.azione === s.mossa && !x.diretta; })[0];
    return o ? o.bersagli : [];
  }
  function pulsantiDi(stato, s, click) {
    var r = opzioniDi(stato, s).map(function (o) { return { azione: o.azione, on: s.mossa === o.azione, click: click }; });
    r.push({ azione: 'fermati', click: click });
    return r;
  }
  function classiCarte(stato, s) {
    var scelte = {};
    bersagliDi(stato, s).forEach(function (id) { scelte[id] = 'bersaglio'; });
    s.mie.concat(s.sue).forEach(function (id) { scelte[id] = 'scelta'; });
    return scelte;
  }
  // toccando una tua carta la scelta cambia: la mossa a metà e la domanda «Ti fermi?» cadono
  function cambiaScelta(s, id) {
    var i = s.mie.indexOf(id);
    if (i >= 0) s.mie.splice(i, 1); else s.mie.push(id);
    s.sue = []; s.mossa = null; s.chiedi = false;
  }
  function guida(stato, s) {
    if (stato.senzaMosse) return 'Non hai nessuna mossa possibile: devi fermarti.';
    if (s.mossa === 'sopra') return 'Sopra: tocca la carta del Lupo da togliere.';
    if (s.mossa === 'divisa') return 'Divisa: tocca le carte del Lupo che insieme fanno ' + stato.tu.filter(function (c) { return c.id === s.mie[0]; })[0].valore + '.';
    if (!s.mie.length) return 'Tocca una o più carte tue.';
    if (!opzioniDi(stato, s).length) return 'Con queste carte non c’è nessuna mossa.';
    return '';
  }

  // ---------- partita ----------
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiInizio)]));
    app.appendChild(punteggio(g));
    var fine = !!g.fine;
    if (!fine && !msg) { msg = guida(g, sel); msgOk = false; }
    var bers = fine ? [] : bersagliDi(g, sel);
    app.appendChild(tavolo({
      stato: g, scelte: classiCarte(g, sel),
      cliccaMia: fine ? null : function (c) { cambiaScelta(sel, c.id); msg = ''; msgOk = false; render(); },
      cliccaSua: bers.length ? function (c) { toccaSua(c.id); } : null,
      pulsanti: fine ? [] : pulsantiDi(g, sel, tocca),
      domanda: !fine && sel.chiedi ? { punti: L.somma(g.lupo), si: fermati, no: function () { sel.chiedi = false; msg = ''; render(); } } : null
    }));
    if (fine) { finale(); return; }
  }
  // un tocco su una mossa: se è fatta così com'è parte subito, se serve una scelta si accendono le carte del Lupo
  function tocca(azione) {
    msg = ''; msgOk = false;
    if (azione === 'fermati') { sel.chiedi = true; sel.mossa = null; sel.sue = []; render(); return; }
    var o = opzioniDi(g, sel).filter(function (x) { return x.azione === azione; })[0];
    if (!o) { render(); return; }
    if (o.diretta) { gioca(azione, sel.mie, o.sue); return; }
    sel.mossa = azione; sel.sue = []; render();
  }
  function toccaSua(id) {
    var i = sel.sue.indexOf(id);
    if (i >= 0) sel.sue.splice(i, 1); else sel.sue.push(id);
    msg = ''; msgOk = false;
    if (L.sceltaCompleta(sel.mossa, g.tu, g.lupo, sel.mie, sel.sue)) { gioca(sel.mossa, sel.mie, sel.sue); return; }
    if (sel.mossa === 'divisa') {
      var tot = g.lupo.filter(function (c) { return sel.sue.indexOf(c.id) >= 0; }).reduce(function (t, c) { return t + c.valore; }, 0);
      var mia = g.tu.filter(function (c) { return c.id === sel.mie[0]; })[0].valore;
      if (tot > mia) msg = 'Le carte che hai toccato fanno ' + tot + ', più del tuo ' + mia + ': toccane una di nuovo per lasciarla.';
    }
    render();
  }
  function riassunto(u) {
    var dove = function (cs) { return cs.map(function (c) { return c.valore; }).join(' + '); };
    var t = L.NOME_AZIONE[u.azione] + ': ' + dove(u.mie) + ' contro ' + dove(u.sue) + '. ';
    if (u.chi) t += (u.chi === 'tu' ? 'Peschi ' : 'Il Lupo pesca ') + conTesto(u.quante, 'carta', 'carte') + '.';
    if (u.rimescolato) t += ' Mazzo finito: scarti rimescolati.';
    return t;
  }
  function eseguiPartita(mossa) {
    var n = L.apply(g, mossa);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; azzera(); render(); return; }
    g = n; azzera(); msgOk = true;
    msg = g.ultimo.azione === 'fermati' ? 'Ti sei fermato.' : riassunto(g.ultimo);
    if (g.senzaMosse) { msg += ' Non hai nessuna mossa possibile: devi fermarti.'; }
    render();
  }
  function gioca(azione, mie, sue) { eseguiPartita({ t: 'gioca', azione: azione, mie: mie.slice(), sue: sue.slice() }); }
  function fermati() { eseguiPartita({ t: 'fermati' }); }
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

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore, coi tocchi veri della partita) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false, errori: 0 }; render(); }
  function selVuota() { return { mie: [], sue: [], mossa: null, chiedi: false }; }
  function valoreDi(id) {
    var tutte = demo.st.tu.concat(demo.st.lupo), k;
    for (k = 0; k < tutte.length; k++) if (tutte[k].id === id) return tutte[k].valore;
    return id;
  }
  function azioneDi(m) { return m.t === 'fermati' ? 'fermati' : m.azione; }
  // la prossima cosa che manca da toccare: { k:'mia'|'sua'|'mossa'|'si'|'fatto', id|az }
  function prossimo(m, sel) {
    var k, id, az = azioneDi(m);
    for (k = 0; k < (m.mie || []).length; k++) { id = m.mie[k]; if (sel.mie.indexOf(id) < 0) return { k: 'mia', id: id }; }
    if (az === 'fermati') return sel.chiedi ? { k: 'si' } : { k: 'mossa', az: az };
    if (sel.mossa !== az) return { k: 'mossa', az: az };
    for (k = 0; k < (m.sue || []).length; k++) { id = m.sue[k]; if (sel.sue.indexOf(id) < 0) return { k: 'sua', id: id }; }
    return { k: 'fatto' };
  }
  function prossimaCosa(m, sel) {
    var p = prossimo(m, sel);
    if (p.k === 'mia') return 'tocca il tuo ' + valoreDi(p.id);
    if (p.k === 'sua') return 'tocca il ' + valoreDi(p.id) + ' del Lupo';
    if (p.k === 'mossa') return 'tocca ' + L.NOME_AZIONE[p.az];
    if (p.k === 'si') return 'tocca Sì';
    return 'tocca la carta giusta';
  }
  // sbaglio: nel turno guidato il gioco dice cosa toccare; nel turno «trova» non lo dice mai subito, ma aiuta a ragionare (aiuti, uno più chiaro dell'altro)
  function demoSbagliato(m) {
    var passo = D.passi[demo.i];
    if (passo.trova) { demo.errori = (demo.errori || 0) + 1; demo.msg = passo.aiuti[Math.min(demo.errori, passo.aiuti.length) - 1]; demo.sel = selVuota(); }
    else demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.';
    demo.ok = false; render();
  }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; demo.errori = 0; render(); }
  // la mossa fatta dal giocatore è quella del copione? (stessa azione, stesse carte tue, stessi valori del Lupo: il seme non conta)
  function equivalente(a, m) {
    if (a.t !== m.t) return false;
    if (a.t === 'fermati') return true;
    var chiave = function (ids) { return ids.slice().sort().join(); }, val = function (ids) { return ids.map(valoreDi).sort(function (x, y) { return x - y; }).join(); };
    return a.azione === m.azione && chiave(a.mie) === chiave(m.mie) && val(a.sue) === val(m.sue);
  }
  function demoGioca(passo, mossa) {
    var m = passo.mossa;
    if (!equivalente(mossa, m)) { demoSbagliato(m); return; }
    var n = L.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true;
    demo.msg = m.t === 'fermati' ? spiegaFine(n.fine) : riassunto(n.ultimo);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; demo.errori = 0; }
    render();
  }
  function demoMossa(passo, x) {
    var m = passo.mossa, sel = demo.sel;
    if (x !== azioneDi(m) && !passo.trova) { demoSbagliato(m); return; }
    demo.msg = ''; demo.ok = false;
    if (x === 'fermati') { sel.chiedi = true; sel.mossa = null; sel.sue = []; render(); return; }
    var o = opzioniDi(demo.st, sel).filter(function (y) { return y.azione === x; })[0];
    if (!o) { demoSbagliato(m); return; }
    if (o.diretta) { demoGioca(passo, { t: 'gioca', azione: x, mie: sel.mie.slice(), sue: o.sue }); return; }
    sel.mossa = x; sel.sue = []; render();
  }
  function demoSua(passo, id) {
    var m = passo.mossa, sel = demo.sel;
    if (!passo.trova && (m.sue || []).indexOf(id) < 0) { demoSbagliato(m); return; }
    var i = sel.sue.indexOf(id);
    if (i >= 0) sel.sue.splice(i, 1); else sel.sue.push(id);
    demo.msg = ''; demo.ok = false;
    if (L.sceltaCompleta(sel.mossa, demo.st.tu, demo.st.lupo, sel.mie, sel.sue)) { demoGioca(passo, { t: 'gioca', azione: sel.mossa, mie: sel.mie.slice(), sue: sel.sue.slice() }); return; }
    render();
  }
  function demoCarta(passo, id) {
    var m = passo.mossa, sel = demo.sel;
    if ((m.mie || []).indexOf(id) < 0 && !passo.trova) { demoSbagliato(m); return; }   // nel turno «trova» si guarda e si prova liberamente
    cambiaScelta(sel, id);
    demo.msg = ''; demo.ok = false; render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    var fine = !!demo.st.fine;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiInizio)]));
    if (m && !demo.sel) demo.sel = selVuota();
    var sel = demo.sel, aiuto = {}, aiutoMossa = null, trova = !!passo.trova;
    var attivo = !!m && !demo.fatto && !fine;
    if (attivo) {
      aiuto = classiCarte(demo.st, sel);
      // turno «trova»: niente carte né tasto indicati, la mossa la cerca il giocatore (si accende solo ciò che ha già toccato).
      // guidato: si indica UNA cosa alla volta, nell'ordine del testo (le tue carte, la mossa, le carte del Lupo se serve sceglierle, Sì)
      var p = prossimo(m, sel);
      if (!trova) {
        if (p.k === 'mia' || p.k === 'sua') aiuto[p.id] = 'suggerita';
        else if (p.k === 'mossa') aiutoMossa = p.az;
      }
      // «Sì» non si indica mai: la vignetta starebbe sopra la domanda «Ti fermi? Il Lupo segna N punti» e ne coprirebbe metà
    }
    msg = demo.msg; msgOk = demo.ok;
    app.appendChild(punteggio(demo.st));
    app.appendChild(el('div', 'etichetta contapassi', 'Tutorial: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    var pulsanti = attivo ? pulsantiDi(demo.st, sel, function (x) { demoMossa(passo, x); }).map(function (b) { b.suggerita = b.azione === aiutoMossa; return b; })
      : MOSSE.map(function (x) { return { azione: x }; });   // passo da leggere: la fila di tutte le mosse, solo da guardare
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto, pulsanti: pulsanti,
      cliccaMia: attivo ? function (c) { demoCarta(passo, c.id); } : null,
      cliccaSua: attivo && bersagliDi(demo.st, sel).length ? function (c) { demoSua(passo, c.id); } : null,
      domanda: attivo && sel.chiedi ? { punti: L.somma(demo.st.lupo), siSuggerita: false,
        si: function () { demoGioca(passo, { t: 'fermati' }); }, no: function () { sel.chiedi = false; demo.msg = ''; render(); } } : null
    }));
    var box = el('div', 'passo');
    box.setAttribute('data-passo', String(demo.i));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) {
      /* i tocchi veri della partita: niente Conferma */
    } else if (m && !demo.fatto) {
      /* mano finita prima del tempo: non succede con la mano preparata */
    } else if (ultimo && (!m || demo.fatto)) {
      az.appendChild(bottone('Continua', 'conferma', continuaPartita));
    } else {
      az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    }
    if (az.firstChild) app.appendChild(az);
  }
  // finito il tutorial la partita CONTINUA: è la stessa, nello stato in cui il tutorial l'ha lasciata (la mano è chiusa, si passa alla prossima)
  function continuaPartita() { g = demo.st; azzera(); msg = ''; msgOk = false; schermo = 'partita'; render(); }
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
