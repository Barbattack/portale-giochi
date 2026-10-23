/*
 * Loot the Loop — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Tempio.apply.
 *
 * Il mazzo si vede come un anello srotolato a partire dalla cima: "Sei qui", "Poi", e il resto
 * del tempio in una griglia. Le carte scoperte mostrano il valore, le coperte il dorso.
 */
(function () {
  'use strict';
  var T = self.Tempio, D = self.TempioDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'loot-the-loop-visto';

  // Titolo e crediti stanno in un punto solo: qui.
  var TITOLO = 'Loot the Loop';
  var CREDITI = {
    autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    ispirato: 'Palm Island e Maiden\'s Quest'
  };

  var NOME_AZIONE = { guardati: 'Guardati intorno', esplora: 'Esplora', segna: 'Segna una strada',
    torna: 'Torna su una strada', arrenditi: 'Mi arrendo' };
  var AZIONI = ['guardati', 'esplora', 'segna', 'torna'];

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { azione, pos, nota }
  var msg = '', msgOk = false;
  var demo;          // { i, st, sel, fatto, msg, ok }
  var nPartite = 0, chiediNuova = false;

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
    if (m) return decodeURIComponent(m[1]) + (nPartite ? '-' + (nPartite + 1) : '');
    return Math.random().toString(36).slice(2, 8);
  }
  function crediti() {
    document.title = TITOLO;
    var f = document.getElementById('crediti');
    f.textContent = TITOLO + ' di ' + CREDITI.autore + ', dalla collezione ';
    var a = el('a', null, CREDITI.collezione); a.href = CREDITI.link; a.rel = 'noopener';
    f.appendChild(a);
    f.appendChild(document.createTextNode('. Ispirato a ' + CREDITI.ispirato + '.'));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- le carte ----------
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta ' + (c.su ? 'su ' + (c.seme === 'H' || c.seme === 'D' ? 'rosso' : c.seme === 'J' ? 'jolly' : 'nero') : 'dorso') + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', c.su ? T.nome(c) : 'carta coperta');
    if (c.su) {
      e.appendChild(el('span', 'v', T.lettera(c)));
      if (c.seme !== 'J') e.appendChild(el('span', 's', T.SIMBOLO[c.seme]));
    }
    return e;
  }
  function vuota(cls) { return el('div', 'carta vuoto' + (cls ? ' ' + cls : '')); }

  // ---------- il tavolo (partita e demo) ----------
  /* o: { st, azione, pos, nota, aiuto:{id:classe}, aiutoAzione, anteprima (pos, solo demo),
          onCima(pos), onNota(id), onAzione(a) } — senza i gestori le carte non si toccano */
  function tavolo(o) {
    var st = o.st, M = st.mazzo.length, box = el('div');
    // dove atterra Esplora con la carta scelta (se la scelta si può fare)
    var pos = o.anteprima != null ? o.anteprima : (o.azione === 'esplora' ? o.pos : null);
    var arrivo = null, via = 0;
    if (pos != null) { arrivo = T.destinazione(st, pos); if (arrivo !== null) via = Math.min(st.mazzo[pos].valore, M); }
    function classe(k, c) {
      var x = '';
      if (arrivo !== null) { if (k === arrivo) x += ' arrivo'; else if (k < via) x += ' via'; }
      if (o.aiuto && o.aiuto[c.id]) x += ' ' + o.aiuto[c.id];
      return x;
    }

    // la cima: dove sei, cosa viene subito dopo, gli appunti
    var cima = el('div', 'cima');
    [0, 1].forEach(function (k) {
      var b = el('div', 'blocco');
      b.appendChild(el('div', 'etichetta', k === 0 ? '▼ Sei qui' : 'Poi'));
      var c = st.mazzo[k];
      if (!c) { b.appendChild(vuota('cimac')); }
      else {
        var scelta = o.azione === 'esplora' && o.pos === k ? ' scelta' : '';
        var f = faccia(c, o.onCima ? 'button' : 'div', 'cimac' + scelta + classe(k, c));
        if (o.onCima) { f.type = 'button'; f.addEventListener('click', function () { o.onCima(k); }); }
        b.appendChild(f);
      }
      cima.appendChild(b);
    });
    var ap = el('div', 'blocco appunti');
    ap.appendChild(el('div', 'etichetta', 'Appunti ' + st.appunti.length + '/' + T.MAX_APPUNTI));
    var righe = el('div', 'slots');
    for (var k = 0; k < T.MAX_APPUNTI; k++) {
      var n = st.appunti[k];
      if (!n) { righe.appendChild(vuota('nota')); continue; }
      var sc = o.azione === 'torna' && o.nota === n.id ? ' scelta' : '';
      var b = faccia(n, o.onNota ? 'button' : 'div', 'nota' + sc + (o.aiuto && o.aiuto[n.id] ? ' ' + o.aiuto[n.id] : ''));
      if (o.onNota) { b.type = 'button'; (function (id) { b.addEventListener('click', function () { o.onNota(id); }); }(n.id)); }
      righe.appendChild(b);
    }
    ap.appendChild(righe);
    cima.appendChild(ap);
    box.appendChild(cima);

    // il tempio: il resto del mazzo, in fila, e poi si ricomincia dalla cima
    box.appendChild(el('div', 'etichetta', 'Il tempio: ' + conTesto(M, 'carta', 'carte') + ', ad anello'));
    var anello = el('div', 'anello');
    var griglia = el('div', 'griglia');
    for (var i = 2; i < M; i++) {
      var cella = el('div', 'cella');
      cella.appendChild(faccia(st.mazzo[i], 'div', classe(i, st.mazzo[i]).trim()));
      if (i <= 10) cella.appendChild(el('span', 'ix', String(i)));
      griglia.appendChild(cella);
    }
    if (M <= 2) griglia.appendChild(el('span', 'vuoto-t', 'Nient\'altro: dopo si ricomincia'));
    anello.appendChild(griglia);
    anello.appendChild(el('div', 'chiude', '↻ dopo l\'ultima carta si riparte dalla cima'));
    box.appendChild(anello);
    box.appendChild(el('div', 'nota-ix', 'Il numero sotto la carta è quante carte contare per arrivarci.'));

    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    if (o.onAzione) {
      var az = el('div', 'mosse');
      AZIONI.forEach(function (a) {
        var cls = (o.azione === a ? 'on' : '') + (o.aiutoAzione === a ? ' suggerita' : '');
        az.appendChild(bottone(NOME_AZIONE[a], cls, function () { o.onAzione(a); }));
      });
      box.appendChild(az);
    }
    return box;
  }

  function stato(st) {
    var p = el('div', 'stato');
    var a = el('span', 'pila'); a.appendChild(el('b', null, String(st.punti.length))); a.appendChild(document.createTextNode(' nei punti'));
    var assi = el('span', 'assi');
    assi.setAttribute('aria-label', 'Assi presi: ' + T.assiNeiPunti(st) + ' su 4');
    T.SEMI.forEach(function (s) {
      var preso = st.punti.some(function (c) { return T.eAsso(c) && c.seme === s; });
      assi.appendChild(el('i', (preso ? 'preso ' : '') + (s === 'H' || s === 'D' ? 'rosso' : 'nero'), T.SIMBOLO[s]));
    });
    p.appendChild(a); p.appendChild(assi);
    return p;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, TITOLO));
    var dx = el('div', 'dx');
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Il mazzo è un tempio a forma di anello. Cerca i quattro Assi, evita le trappole ed esci dal Jolly.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); nuovaPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function azzera() { sel = { azione: null, pos: null, nota: null }; }
  function nuovaPartita() {
    g = T.nuova(semeIniziale()); nPartite++;
    azzera(); msg = 'Il tempio è tutto coperto: comincia guardandoti intorno.'; msgOk = false; chiediNuova = false;
    schermo = 'partita'; render();
  }
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false }; render(); }
  function uscitaDemo() { if (g && !g.fine) { schermo = 'partita'; render(); } else nuovaPartita(); }

  function racconta(u) {
    if (u.t === 'guardati') return 'Scopri ' + u.scoperte.map(function (id) { return T.nome(T.daId(id)); }).join(' e ') + '.';
    if (u.t === 'segna') return 'Segni ' + T.nome(u.carta) + ': passa negli appunti.';
    if (u.t === 'torna') return 'Rimetti ' + T.nome(u.carta) + ' in cima, scoperta.';
    if (u.t === 'arrenditi') return 'Ti sei arreso.';
    var t = 'Esplora ' + u.n + ': ';
    if (u.effetto === 'coperta') return t + 'arrivi su una carta coperta. Non succede niente.';
    if (u.effetto === 'presa') return t + 'arrivi ' + T.su(u.arrivo) + ' e la prendi: va nei punti.';
    if (u.effetto === 'trappola') return t + 'arrivi ' + T.su(u.arrivo) + ': è una trappola.';
    if (u.effetto === 'uscita') return t + 'arrivi sul Jolly con i quattro Assi.';
    return t + 'arrivi sul Jolly, ma non hai tutti e quattro gli Assi. Non succede niente.';
  }
  function spiegaFine(f) {
    var t = {
      uscita: 'Sei uscito dal tempio con tutti e quattro gli Assi!',
      trappola: 'Sei caduto in una trappola.',
      bloccato: 'Non hai più nessuna mossa: sei bloccato.',
      arresa: 'Ti sei arreso.'
    }[f.motivo];
    return t + ' Carte nei punti: ' + f.punti + '.';
  }
  function mossaScelta() {
    var a = sel.azione;
    if (a === 'esplora') return { t: 'esplora', pos: sel.pos };
    if (a === 'torna') return { t: 'torna', id: sel.nota };
    return { t: a };
  }
  function conferma() {
    var n = T.apply(g, mossaScelta());
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la scelta resta
    g = n; azzera(); msgOk = true; msg = racconta(g.ultimo);
    render();
  }
  function schermoPartita() {
    var nuova = chiediNuova ? 'Davvero?' : 'Nuova partita';
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone(nuova, 'mini' + (chiediNuova ? ' attento' : ''), function () {
      if (g.fine || !g.turno || chiediNuova) nuovaPartita(); else { chiediNuova = true; render(); }
    })]));
    app.appendChild(stato(g));
    var fine = !!g.fine;
    app.appendChild(tavolo({
      st: g, azione: sel.azione, pos: sel.pos, nota: sel.nota,
      onCima: fine ? null : function (k) { sel.azione = 'esplora'; sel.pos = k; msg = ''; render(); },
      onNota: fine ? null : function (id) { sel.azione = 'torna'; sel.nota = id; msg = ''; render(); },
      onAzione: fine ? null : function (a) { sel.azione = a; msg = ''; render(); }
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = !sel.azione;
    az.appendChild(conf);
    var arr = bottone('Mi arrendo', 'arrendo' + (sel.azione === 'arrenditi' ? ' on' : ''), function () {
      sel.azione = 'arrenditi'; msg = ''; render();
    });
    az.appendChild(arr);
    app.appendChild(az);
  }
  function finale() {
    var p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, g.fine.esito === 'vinto' ? 'Hai vinto!' : 'Hai perso.'));
    p.appendChild(el('p', null, spiegaFine(g.fine)));
    p.appendChild(bottone('Nuova partita', 'grande primo', nuovaPartita));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function cartaAtt(m) { return m.t === 'esplora' ? demo.st.mazzo[m.pos] : null; }
  function appuntoAtt(m) { return m.t === 'torna' ? demo.st.appunti.filter(function (c) { return c.id === m.id; })[0] : null; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, s) {
    if (m.t === 'esplora' && s.pos !== m.pos) return 'tocca il ' + T.nomeBreve(cartaAtt(m)) + ' (' + (m.pos === 0 ? 'Sei qui' : 'Poi') + ')';
    if (m.t === 'torna' && s.nota !== m.id) return 'tocca l\'appunto ' + T.nomeBreve(appuntoAtt(m));
    if (s.azione !== m.t) return 'tocca ' + NOME_AZIONE[m.t];
    return 'tocca Conferma';
  }
  function frase(m) {
    var t = 'Tocca ' + NOME_AZIONE[m.t];
    if (m.t === 'esplora') t += ', poi il ' + T.nomeBreve(cartaAtt(m)) + ' (' + (m.pos === 0 ? 'Sei qui' : 'Poi') + ')';
    if (m.t === 'torna') t += ', poi l\'appunto ' + T.nomeBreve(appuntoAtt(m));
    return t + ', poi Conferma';
  }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa, s = demo.sel;
    if (prossimaCosa(m, s) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = T.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = racconta(n.ultimo);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; }
    render();
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', uscitaDemo)]));
    if (m && !demo.sel) demo.sel = { azione: null, pos: null, nota: null };
    var s = demo.sel, aiuto = {}, aiutoAzione = null, pronto = false;
    var attivo = m && !demo.fatto;
    if (attivo) {
      if (m.t === 'esplora' && s.pos !== m.pos) aiuto[cartaAtt(m).id] = 'suggerita';
      if (m.t === 'torna' && s.nota !== m.id) aiuto[m.id] = 'suggerita';
      aiutoAzione = m.t === 'arrenditi' ? null : m.t;
      pronto = prossimaCosa(m, s) === 'tocca Conferma';
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'stato');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(p);
    var mostra = m && demo.fatto ? m : null;           // dopo un rifiuto la scelta resta in vista
    app.appendChild(tavolo({
      st: demo.st,
      azione: attivo ? s.azione : (mostra ? m.t : null),
      pos: attivo ? s.pos : (mostra ? m.pos : null),
      nota: attivo ? s.nota : (mostra ? m.id : null),
      aiuto: aiuto, aiutoAzione: aiutoAzione, anteprima: passo.anteprima,
      onCima: attivo ? function (k) {
        if (m.t !== 'esplora' || m.pos !== k) { demoSbagliato(m); return; }
        s.azione = 'esplora'; s.pos = k; demo.msg = ''; demo.ok = false; render();
      } : null,
      onNota: attivo ? function (id) {
        if (m.t !== 'torna' || m.id !== id) { demoSbagliato(m); return; }
        s.azione = 'torna'; s.nota = id; demo.msg = ''; demo.ok = false; render();
      } : null,
      onAzione: attivo ? function (a) {
        if (a !== m.t) { demoSbagliato(m); return; }
        s.azione = a; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', uscitaDemo));
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
  schermo = leggiVisto() ? null : 'domanda';
  if (schermo) render(); else nuovaPartita();
}());
