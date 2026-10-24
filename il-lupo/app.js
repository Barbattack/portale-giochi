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

  var schermo;       // 'domanda' | 'inizio' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { mie:[id], sue:[id], chiedi (la domanda «Ti fermi?» è aperta) }
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
    e.setAttribute('aria-label', di === 'lupo' ? il(c.valore).replace(/^./, function (x) { return x.toUpperCase(); }) + ' del Lupo, ' + col : di === 'tu' ? 'Il tuo ' + c.valore + ', ' + col
      : di === 'mazzo' ? 'La scoperta: ' + c.valore + ' ' + col : c.valore + ' ' + col);
    e.setAttribute('data-id', c.id);
    e.appendChild(el('span', 'v', String(c.valore)));
    return e;
  }
  // «l'» davanti a 1 e 8 (l'1, l'8), «il» davanti agli altri (carte da 1 a 10); con «tuo» l'articolo non cambia
  function il(n) { return n === 1 || n === 8 ? 'l\u2019' + n : 'il ' + n; }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte:{id:classe}, cliccaMia(c), cliccaSua(c), unica:{testo, nome, attiva, suggerita, click} | null, fermati(), fermatiSuggerita, mosse:false (nasconde tasto e Fermati), forma (la mossa che la scelta forma), domanda:{punti, si, no} | null } */
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
      dom.appendChild(bottone('Sì', 'si', o.domanda.si));
      dom.appendChild(bottone('No', 'no', o.domanda.no));
      box.appendChild(dom);
    } else if (o.mosse !== false) {
      // un tasto solo, che dice cosa succede con la scelta fatta (spento, col motivo, se la scelta non vale), e Fermati sempre
      var mosse = el('div', 'mosse');
      if (o.unica) {
        var u = bottone(o.unica.testo, 'unica' + (o.unica.attiva ? '' : ' spenta') + (o.unica.suggerita ? ' suggerita' : ''), o.unica.attiva ? o.unica.click : null);
        if (!o.unica.attiva) { u.disabled = true; u.setAttribute('data-motivo', '1'); }
        else u.setAttribute('data-vignetta', o.unica.nome);
        mosse.appendChild(u);
      }
      var f = bottone('Fermati', 'ferma' + (o.fermatiSuggerita ? ' suggerita' : ''), o.fermati || null);
      if (!o.fermati) f.tabIndex = -1;
      mosse.appendChild(f);
      box.appendChild(mosse);
    }
    box.appendChild(striscia(o.forma));
    return box;
  }
  // La striscia delle mosse: il cartoncino delle regole, sempre uguale. NON guarda le carte: si accende solo la casellina della mossa che la scelta sta formando.
  var REGOLE = [
    ['perfetta', 'una tua uguale a una sua, peschi tu'], ['somma', 'più tue fanno una sua, peschi tu'],
    ['divisa', 'più sue fanno una tua, il Lupo pesca 1'], ['sopra', 'una tua più alta, il Lupo pesca la differenza']
  ];
  function striscia(forma) {
    var st = el('div', 'striscia');
    REGOLE.forEach(function (r) {
      var c = el('div', 'regola' + (forma === r[0] ? ' forma' : ''));
      c.setAttribute('data-az', r[0]);
      c.appendChild(el('b', null, L.NOME_AZIONE[r[0]]));
      c.appendChild(el('span', null, r[1]));
      st.appendChild(c);
    });
    return st;
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
  function azzera() { sel = { mie: [], sue: [], chiedi: false }; }
  function manoNuova() {
    msgOk = false;
    msg = g.ultimo && g.ultimo.rimescolato ? 'Mazzo rimescolato.' : '';
    avvisoSenzaMosse();
  }
  function avvisoSenzaMosse() { if (g.senzaMosse && !g.fine) { msg = 'Non hai nessuna mossa possibile: devi fermarti.'; msgOk = false; } }

  // ---------- la scelta: carte tue e carte del Lupo, in qualsiasi ordine; la mossa la deduce il gioco (Lupo.leggiScelta) ----------
  function lettura(stato, s) { return L.leggiScelta(stato.tu, stato.lupo, s.mie, s.sue); }
  function classiCarte(s) {
    var scelte = {};
    s.mie.concat(s.sue).forEach(function (id) { scelte[id] = 'scelta'; });
    return scelte;
  }
  // toccare una carta (tua o del Lupo) la sceglie, toccarla di nuovo la toglie; la domanda «Ti fermi?» cade
  function alternaCarta(s, lista, id) {
    var i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
    s.chiedi = false;
  }
  // cosa dice il tasto: la mossa e chi pesca (la carta scoperta in cima al mazzo è la prossima a uscire), oppure perché la scelta non vale
  function etichetta(stato, r) {
    var cima = stato.mazzo[0], carta = cima ? il(cima.valore) : 'una carta';
    if (r.azione === 'perfetta') return 'Perfetta: peschi ' + carta;
    if (r.azione === 'somma') return 'Somma: peschi ' + carta;
    if (r.azione === 'divisa') return 'Divisa: il Lupo pesca ' + carta;
    return 'Sopra: il Lupo pesca ' + conTesto(r.quante, 'carta', 'carte');
  }
  // il tasto unico: assente finché non c'è almeno una carta per parte; poi acceso (la mossa) o spento (il perché)
  function unicaDi(stato, s, click) {
    if (s.chiedi || !s.mie.length || !s.sue.length) return null;
    var r = lettura(stato, s);
    if (r.azione) return { testo: etichetta(stato, r), nome: L.NOME_AZIONE[r.azione], attiva: true, click: click };
    return { testo: r.perche, attiva: false };
  }
  function guida(stato, s) {
    if (stato.senzaMosse) return 'Non hai nessuna mossa possibile: devi fermarti.';
    if (!s.mie.length || !s.sue.length) return 'Tocca le carte che vuoi usare, tue e del Lupo.';
    return '';
  }

  // ---------- partita ----------
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiInizio)]));
    app.appendChild(punteggio(g));
    var fine = !!g.fine;
    if (!fine && !msg) { msg = guida(g, sel); msgOk = false; }
    app.appendChild(tavolo({
      stato: g, scelte: classiCarte(sel), mosse: !fine,
      cliccaMia: fine ? null : function (c) { alternaCarta(sel, sel.mie, c.id); msg = ''; msgOk = false; render(); },
      cliccaSua: fine ? null : function (c) { alternaCarta(sel, sel.sue, c.id); msg = ''; msgOk = false; render(); },
      unica: fine ? null : unicaDi(g, sel, giocaScelta),
      forma: fine ? null : lettura(g, sel).azione,
      fermati: function () { sel.chiedi = true; msg = ''; render(); },
      domanda: !fine && sel.chiedi ? { punti: L.somma(g.lupo), si: fermati, no: function () { sel.chiedi = false; msg = ''; render(); } } : null
    }));
    if (fine) { finale(); return; }
  }
  function giocaScelta() {
    var r = lettura(g, sel);
    if (!r.azione) return;
    eseguiPartita({ t: 'gioca', azione: r.azione, mie: sel.mie.slice(), sue: sel.sue.slice() });
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
  function selVuota() { return { mie: [], sue: [], chiedi: false }; }
  function valoreDi(id) {
    var tutte = demo.st.tu.concat(demo.st.lupo), k;
    for (k = 0; k < tutte.length; k++) if (tutte[k].id === id) return tutte[k].valore;
    return id;
  }
  function azioneDi(m) { return m.t === 'fermati' ? 'fermati' : m.azione; }
  // la prossima cosa che manca da toccare: { k:'mia'|'sua'|'unica'|'fermati'|'si', id }
  function prossimo(m, sel) {
    var k, id;
    for (k = 0; k < (m.mie || []).length; k++) { id = m.mie[k]; if (sel.mie.indexOf(id) < 0) return { k: 'mia', id: id }; }
    for (k = 0; k < (m.sue || []).length; k++) { id = m.sue[k]; if (sel.sue.indexOf(id) < 0) return { k: 'sua', id: id }; }
    if (m.t === 'fermati') return sel.chiedi ? { k: 'si' } : { k: 'fermati' };
    return { k: 'unica' };
  }
  function prossimaCosa(m, sel) {
    var p = prossimo(m, sel);
    if (p.k === 'mia') return 'tocca il tuo ' + valoreDi(p.id);
    if (p.k === 'sua') return 'tocca ' + il(valoreDi(p.id)) + ' del Lupo';
    if (p.k === 'fermati') return 'tocca Fermati';
    if (p.k === 'si') return 'tocca Sì';
    return 'tocca il tasto della mossa, qui sotto';
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
  function demoUnica(passo) {
    var r = lettura(demo.st, demo.sel);
    if (!r.azione) return;
    demoGioca(passo, { t: 'gioca', azione: r.azione, mie: demo.sel.mie.slice(), sue: demo.sel.sue.slice() });
  }
  // una carta: nel turno guidato solo quelle della mossa; nel turno «trova» si guarda e si prova liberamente
  function demoCarta(passo, id, lato) {
    var m = passo.mossa, sel = demo.sel;
    if (!passo.trova && (m[lato] || []).indexOf(id) < 0) { demoSbagliato(m); return; }
    alternaCarta(sel, sel[lato], id);
    demo.msg = ''; demo.ok = false; render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    var fine = !!demo.st.fine;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiInizio)]));
    if (m && !demo.sel) demo.sel = selVuota();
    var sel = demo.sel, aiuto = {}, unica = null, forma = null, fermatiSugg = false, trova = !!passo.trova;
    var attivo = !!m && !demo.fatto && !fine;
    if (attivo) {
      aiuto = classiCarte(sel);
      forma = lettura(demo.st, sel).azione;
      unica = unicaDi(demo.st, sel, function () { demoUnica(passo); });
      // turno «trova»: niente indicato, la mossa la cerca il giocatore (si accende solo ciò che ha già toccato).
      // guidato: si indica UNA cosa alla volta, nell'ordine: le tue carte, quelle del Lupo, il tasto che compare. «Sì» non si indica mai:
      // la vignetta starebbe sopra la domanda «Ti fermi? Il Lupo segna N punti» e ne coprirebbe metà.
      if (!trova) {
        var p = prossimo(m, sel);
        if (p.k === 'mia' || p.k === 'sua') aiuto[p.id] = 'suggerita';
        else if (p.k === 'unica' && unica && unica.attiva) unica.suggerita = true;
        else if (p.k === 'fermati') fermatiSugg = true;
      }
    }
    msg = demo.msg; msgOk = demo.ok;
    app.appendChild(punteggio(demo.st));
    app.appendChild(el('div', 'etichetta contapassi', 'Tutorial: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto, unica: unica, forma: forma, fermatiSuggerita: fermatiSugg,
      fermati: attivo ? function () {
        demo.msg = ''; demo.ok = false;
        if (!trova && azioneDi(m) !== 'fermati') { demoSbagliato(m); return; }
        sel.chiedi = true; render();
      } : null,
      cliccaMia: attivo ? function (c) { demoCarta(passo, c.id, 'mie'); } : null,
      cliccaSua: attivo ? function (c) { demoCarta(passo, c.id, 'sue'); } : null,
      domanda: attivo && sel.chiedi ? { punti: L.somma(demo.st.lupo),
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
