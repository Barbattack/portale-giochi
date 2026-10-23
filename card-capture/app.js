/*
 * Card Capture (titolo provvisorio) — la parte che parla col browser. Legge lo stato del
 * motore (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con CardCapture.apply.
 * Niente suggerimenti e niente avvisi prima di una mossa che fa perdere: come al tavolo.
 */
(function () {
  'use strict';
  var L = self.CardCapture, D = self.CardCaptureDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'card-capture-visto';

  // Il titolo è provvisorio: sta in un punto solo, qui.
  var TITOLO = 'Prendile tutte';
  // I crediti stanno in un punto solo: qui.
  var CREDITI = {
    gioco: { nome: 'Card Capture', autore: 'Lucas Gentry', link: 'https://boardgamegeek.com/boardgame/264566/card-capture' },
    variante: { testo: 'Variante a due fasi di Ayaskant Panigrahi' },
    poteri: { nome: 'synbeelabs', link: 'http://synbeelabs.eklablog.com' }
  };

  var NOMI_SEMI = { C: 'Cuori', Q: 'Quadri', F: 'Fiori', P: 'Picche' };
  var AZIONI = [
    { k: 'A', nome: 'A', sotto: 'Catturare' },
    { k: 'B', nome: 'B', sotto: 'Farti catturare' },
    { k: 'C', nome: 'C', sotto: 'Sacrificio' }
  ];
  var LIVELLI = { spento: 'Spento', facile: 'Facile', difficile: 'Difficile' };

  var schermo;       // 'domanda' | 'inizio' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { mano:[id], fila:id|null, azione, parziale, alNemico }
  var opz;           // opzioni scelte prima della partita
  var msg, msgOk;
  var vediScarti = false;
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
  // opzioni di partenza; per le prove si possono dare nell'indirizzo: ?due=1&p=Cf,Qd,Ff,Pd
  function opzioniIniziali() {
    var o = { dueFasi: false, poteri: { C: 'spento', Q: 'spento', F: 'spento', P: 'spento' } };
    if (/[?&]due=1/.test(location.search)) o.dueFasi = true;
    var m = /[?&]p=([^&]+)/.exec(location.search);
    if (m) decodeURIComponent(m[1]).split(',').forEach(function (x) {
      if (x.length === 2 && o.poteri[x[0]]) o.poteri[x[0]] = x[1] === 'f' ? 'facile' : (x[1] === 'd' ? 'difficile' : 'spento');
    });
    return o;
  }
  function crediti() {
    var f = document.getElementById('crediti');
    f.textContent = '';
    var p1 = el('p');
    var a = el('a', null, CREDITI.gioco.nome); a.href = CREDITI.gioco.link; a.rel = 'noopener';
    p1.appendChild(a); p1.appendChild(document.createTextNode(' di ' + CREDITI.gioco.autore + '.'));
    var p2 = el('p', null, CREDITI.variante.testo + '.');
    var p3 = el('p', null, 'Poteri dei semi da un\'espansione di ');
    var b = el('a', null, CREDITI.poteri.nome); b.href = CREDITI.poteri.link; b.rel = 'noopener';
    p3.appendChild(b); p3.appendChild(document.createTextNode('.'));
    f.appendChild(p1); f.appendChild(p2); f.appendChild(p3);
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }

  // ---------- carte ----------
  function faccia(c, tag, cls) {
    var rosso = c.seme === 'C' || c.seme === 'Q';
    var e = el(tag || 'div', 'carta' + (c.jolly ? ' jolly' : (rosso ? ' rosso' : '')) + (cls ? ' ' + cls : ''));
    e.setAttribute('data-id', c.id);
    if (c.jolly) {
      e.setAttribute('aria-label', 'Jolly');
      e.appendChild(el('span', 's', '★')); e.appendChild(el('span', 'v', 'JOLLY'));
    } else {
      e.setAttribute('aria-label', (L.NOME_VALORE[c.valore] || c.valore) + ' di ' + L.NOME_SEME[c.seme]);
      e.appendChild(el('span', 'v', String(L.NOME_VALORE[c.valore] || c.valore)));
      e.appendChild(el('span', 's', L.SIMBOLO[c.seme]));
    }
    return e;
  }
  function dorso(testo) { var d = el('div', 'carta dorso'); d.appendChild(el('span', 'v', testo || '')); return d; }
  function vuota() { return el('div', 'carta vuota'); }
  function colonna(carta, nome) {
    var c = el('div', 'col');
    c.appendChild(carta);
    c.appendChild(el('div', 'nome', nome));
    return c;
  }

  // ---------- tavolo ----------
  /* o: { stato, scelte:{id:classe}, cliccaMano(c), cliccaFila(c) } */
  function tavolo(o) {
    var st = o.stato, box = el('div');
    box.appendChild(el('div', 'etichetta', 'Il nemico'));
    var fila = el('div', 'fila');
    fila.appendChild(colonna(st.mazzoNemico.length ? dorso(String(st.mazzoNemico.length)) : vuota(), 'mazzo'));
    [3, 2, 1, 0].forEach(function (i) {
      var c = st.fila[i], x;
      if (c) {
        x = faccia(c, o.cliccaFila ? 'button' : 'div', o.scelte[c.id] || '');
        if (o.cliccaFila) { x.type = 'button'; x.addEventListener('click', function () { o.cliccaFila(c); }); }
      } else x = vuota();
      fila.appendChild(colonna(x, 'pos. ' + (i + 1)));
    });
    fila.appendChild(colonna(st.pilaNemica.length ? dorso(String(st.pilaNemica.length)) : vuota(), 'pila'));
    box.appendChild(fila);
    if (st.opzioni.dueFasi && st.fase === 'seconda') {
      var sp = el('div', 'supporto');
      if (st.supporto.length) {
        sp.appendChild(faccia(st.supporto[0]));
        var t = el('span'); t.appendChild(document.createTextNode('Supporto scoperto: ')); t.appendChild(el('b', null, conTesto(st.supporto.length, 'carta', 'carte')));
        sp.appendChild(t);
      } else sp.appendChild(el('span', null, 'Supporto finito'));
      box.appendChild(sp);
    }
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(el('div', 'etichetta', 'Le tue carte'));
    var mano = el('div', 'mano');
    st.mano.forEach(function (c) {
      var b = faccia(c, o.cliccaMano ? 'button' : 'div', o.scelte[c.id] || '');
      if (o.cliccaMano) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaMano(c); }); }
      mano.appendChild(b);
    });
    box.appendChild(mano);
    var miei = el('div', 'miei');
    miei.appendChild(colonna(st.mazzo.length ? dorso(String(st.mazzo.length)) : vuota(), 'tuo mazzo'));
    miei.appendChild(colonna(st.scarti.length ? dorso(String(st.scarti.length)) : vuota(), 'tuoi scarti'));
    if (o.guardaScarti) miei.appendChild(bottone(vediScarti ? 'Chiudi gli scarti' : 'Guarda gli scarti', 'mini', o.guardaScarti));
    box.appendChild(miei);
    if (vediScarti && o.guardaScarti) {
      var sv = el('div', 'scarti-vista');
      if (!st.scarti.length) sv.appendChild(el('span', 'etichetta', 'Gli scarti sono vuoti.'));
      st.scarti.slice().sort(function (a, b) { return (a.seme + (100 + a.valore)) < (b.seme + (100 + b.valore)) ? -1 : 1; })
        .forEach(function (c) { sv.appendChild(faccia(c)); });
      box.appendChild(sv);
    }
    return box;
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
    p.appendChild(el('p', null, 'Il nemico schiera figure e Assi. Con le sue stesse carte numerate devi catturarli tutti, senza lasciarne nessuno nella sua pila.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiInizio(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- inizio: opzioni ----------
  function schermoInizio() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo)]));
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Nuova partita'));
    var due = el('div', 'opz');
    due.appendChild(el('div', 'nome', 'Due fasi'));
    var sg = el('div', 'seg due');
    sg.appendChild(bottone('No', opz.dueFasi ? '' : 'on', function () { opz.dueFasi = false; render(); }));
    sg.appendChild(bottone('Sì', opz.dueFasi ? 'on' : '', function () { opz.dueFasi = true; render(); }));
    due.appendChild(sg);
    due.appendChild(el('p', 'nota', opz.dueFasi
      ? 'Prima si gioca con le carte nere, poi con le rosse; le carte che il nemico ti ha preso tornano come supporto. Nella prima fase i poteri di cuori e quadri non possono scattare.'
      : 'Una sola partita, con tutte le carte.'));
    p.appendChild(due);
    p.appendChild(el('div', 'etichetta', 'Poteri dei semi: scattano quando catturi una figura o un Asso di quel seme, e valgono nel turno dopo.'));
    L.SEMI.forEach(function (se) {
      var r = el('div', 'opz');
      var nome = el('div', 'nome');
      nome.appendChild(el('span', null, NOMI_SEMI[se]));
      nome.appendChild(el('span', 'sy' + (se === 'C' || se === 'Q' ? ' rosso' : ''), L.SIMBOLO[se]));
      r.appendChild(nome);
      var s3 = el('div', 'seg tre');
      L.LIVELLI.forEach(function (lv) {
        s3.appendChild(bottone(LIVELLI[lv], opz.poteri[se] === lv ? 'on' : '', function () { opz.poteri[se] = lv; render(); }));
      });
      r.appendChild(s3);
      r.appendChild(el('p', 'spiega', opz.poteri[se] === 'spento' ? 'Nessun potere.' : L.POTERI[se][opz.poteri[se]][0].toUpperCase() + L.POTERI[se][opz.poteri[se]].slice(1) + '.'));
      p.appendChild(r);
    });
    p.appendChild(bottone('Gioca', 'grande primo', inizia));
    app.appendChild(p);
  }
  function vaiInizio() { schermo = 'inizio'; render(); }
  function inizia() {
    g = L.nuova(semeIniziale(), { dueFasi: opz.dueFasi, poteri: opz.poteri });
    azzera(); schermo = 'partita'; msgOk = false; msg = g.cronaca.join(' ') + ' ' + GUIDA[g.passo]; render();
  }
  function azzera() { sel = { mano: [], fila: null, azione: null, parziale: false, alNemico: null }; vediScarti = false; }

  // ---------- partita ----------
  var NOME_FASE = {
    scarto: 'Fase di scarto', cuoriPrima: 'Scarto dei cuori, prima della fase nemica', cuoriDopo: 'Scarto dei cuori, dopo la pesca',
    cattura: 'Fase di cattura', passaggio: 'Prima fase vinta', fine: 'Partita finita'
  };
  var GUIDA = {
    scarto: 'Tocca le carte da scartare e conferma. Se non vuoi scartare niente, conferma senza scegliere.',
    cuoriPrima: 'Scegli una carta da scartare e conferma.',
    cuoriDopo: 'Hai pescato fino a 5 carte: scegli una carta da scartare e conferma.',
    cattura: 'Tocca le tue carte e una carta del nemico, poi scegli A, B o C e conferma.'
  };
  function rigaPotere() {
    var any = L.SEMI.some(function (s) { return g.opzioni.poteri[s] !== 'spento'; });
    if (!any) return null;
    if (!g.attivo) return 'Potere in questo turno: nessuno.';
    var t = L.POTERI[g.attivo.seme][g.attivo.livello];
    return 'Potere in questo turno: ' + NOMI_SEMI[g.attivo.seme].toLowerCase() + ' ' + g.attivo.livello + ' ' + L.SIMBOLO[g.attivo.seme] + ', ' + t + '.';
  }
  function rigaFase() {
    var f = el('div', 'fase');
    var testa = 'Turno ' + g.turno + (g.opzioni.dueFasi ? ' · ' + (g.fase === 'prima' ? 'prima fase' : 'seconda fase') : '');
    f.appendChild(el('b', null, testa + ' · ' + (NOME_FASE[g.passo] || '')));
    var pot = g.fine ? null : rigaPotere();
    if (pot) f.appendChild(el('span', null, pot));
    return f;
  }
  function alterna(lista, id) {
    var i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
  }
  function cartaFila(id) { for (var i = 0; i < 4; i++) if (g.fila[i] && g.fila[i].id === id) return g.fila[i]; return null; }
  function cartaMano(id) { for (var i = 0; i < g.mano.length; i++) if (g.mano[i].id === id) return g.mano[i]; return null; }
  function coinvolte() {      // carte della cattura doppia: le tue spese, la figura e il supporto
    var b = sel.fila && cartaFila(sel.fila);
    if (sel.azione !== 'A' || !b || sel.parziale || !L.serveSupporto(g, b)) return null;
    var r = [];
    sel.mano.forEach(function (id) { var c = cartaMano(id); if (c) r.push(c); });
    r.push(b); r.push(g.supporto[0]);
    return r;
  }

  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiInizio)]));
    app.appendChild(rigaFase());
    var fine = !!g.fine, scelte = {};
    var inCattura = g.passo === 'cattura' && !fine;
    var puoMano = !fine && (g.passo === 'scarto' || g.passo === 'cuoriPrima' || g.passo === 'cuoriDopo' || g.passo === 'cattura');
    sel.mano.forEach(function (id) { scelte[id] = 'scelta'; });
    if (sel.fila) scelte[sel.fila] = 'scelta';
    app.appendChild(tavolo({
      stato: g, scelte: scelte,
      cliccaMano: puoMano ? function (c) { alterna(sel.mano, c.id); msg = ''; msgOk = false; render(); } : null,
      cliccaFila: inCattura ? function (c) { sel.fila = sel.fila === c.id ? null : c.id; sel.alNemico = null; msg = ''; msgOk = false; render(); } : null,
      guardaScarti: L.puoiGuardareScarti(g) ? function () { vediScarti = !vediScarti; render(); } : null
    }));
    if (g.passo === 'passaggio') { passaggio(); return; }
    if (fine) { finale(); return; }
    if (g.passo === 'scarto') {
      var az = el('div', 'azioni');
      az.appendChild(bottone(sel.mano.length ? 'Scarta ' + conTesto(sel.mano.length, 'carta', 'carte') : 'Niente da scartare', 'conferma', conferma));
      app.appendChild(az);
    } else if (g.passo === 'cuoriPrima' || g.passo === 'cuoriDopo') {
      var a2 = el('div', 'azioni');
      var c2 = bottone('Scarta questa carta', 'conferma', conferma);
      c2.disabled = sel.mano.length !== 1;
      a2.appendChild(c2);
      app.appendChild(a2);
    } else {
      var tre = el('div', 'azioni3');
      AZIONI.forEach(function (a) {
        var b = bottone(a.nome, sel.azione === a.k ? 'on' : '', function () { sel.azione = sel.azione === a.k ? null : a.k; sel.alNemico = null; msg = ''; render(); });
        b.appendChild(el('small', null, a.sotto));
        tre.appendChild(b);
      });
      app.appendChild(tre);
      var bers = sel.fila && cartaFila(sel.fila);
      if (sel.azione === 'A' && bers && L.serveSupporto(g, bers)) {
        var sc = el('div', 'scelte');
        sc.appendChild(bottone('Figura e supporto', sel.parziale ? '' : 'on', function () { sel.parziale = false; sel.alNemico = null; render(); }));
        sc.appendChild(bottone('Solo la figura', sel.parziale ? 'on' : '', function () { sel.parziale = true; sel.alNemico = null; render(); }));
        app.appendChild(sc);
        var co = coinvolte();
        if (co) {
          var ns = el('div', 'nemico-scelta');
          ns.appendChild(el('div', 'etichetta', 'Quale carta va nella pila nemica? Tocca.'));
          var cs = el('div', 'cs');
          co.forEach(function (c) {
            var x = faccia(c, 'button', sel.alNemico === c.id ? 'scelta' : '');
            x.type = 'button';
            x.addEventListener('click', function () { sel.alNemico = c.id; render(); });
            cs.appendChild(x);
          });
          ns.appendChild(cs);
          app.appendChild(ns);
        }
      }
      var az3 = el('div', 'azioni');
      var conf = bottone('Conferma', 'conferma', conferma);
      conf.disabled = !sel.azione;
      az3.appendChild(conf);
      app.appendChild(az3);
    }
  }

  function conferma() {
    var mossa;
    if (g.passo === 'scarto') mossa = { t: 'scarta', carte: sel.mano.slice() };
    else if (g.passo === 'cuoriPrima' || g.passo === 'cuoriDopo') mossa = { t: 'scartaUna', carta: sel.mano[0] };
    else if (sel.azione === 'A') mossa = { t: 'cattura', azione: 'A', mie: sel.mano.slice(), bersaglio: sel.fila, parziale: sel.parziale, alNemico: sel.alNemico };
    else if (sel.azione === 'B') {
      if (sel.mano.length !== 1) { msg = 'Per la B scegli una sola carta della tua mano.'; msgOk = false; render(); return; }
      var pos = 1;
      if (sel.fila) for (var i = 0; i < 4; i++) if (g.fila[i] && g.fila[i].id === sel.fila) pos = i + 1;
      mossa = { t: 'cattura', azione: 'B', carta: sel.mano[0], posizione: pos };
    } else mossa = { t: 'cattura', azione: 'C', mie: sel.mano.slice(), bersaglio: sel.fila };
    var n = L.apply(g, mossa);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }      // la selezione resta
    g = n; azzera();
    msgOk = true;
    msg = g.cronaca.join(' ') + (g.fine || g.passo === 'passaggio' ? '' : ' ' + GUIDA[g.passo]);
    render();
  }

  function passaggio() {
    var p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, 'Prima fase vinta!'));
    p.appendChild(el('p', null, 'Seconda fase: le figure e gli Assi neri che hai catturato tornano al nemico, insieme alle carte rosse. Le carte che il nemico ti aveva preso diventano il supporto, scoperto: per ogni figura nera dovrai catturare anche la prima carta del supporto. Il tuo mazzo si arricchisce dei 2, 3 e 4 rossi e del secondo jolly.'));
    p.appendChild(bottone('Seconda fase', 'grande primo', function () {
      g = L.apply(g, { t: 'seconda' }); azzera(); msgOk = true;
      msg = g.cronaca.join(' ') + ' ' + GUIDA[g.passo]; render();
    }));
    app.appendChild(p);
  }
  function finale() {
    var f = g.fine, p = el('div', 'pannello fine');
    if (f.esito === 'vittoria') {
      p.appendChild(el('h2', null, g.opzioni.dueFasi ? 'Vittoria piena!' : 'Hai vinto!'));
      p.appendChild(el('p', null, 'Hai catturato tutti i combattenti nemici' + (g.opzioni.dueFasi ? ', in tutte e due le fasi' : '') + ', senza lasciarne nessuno al nemico.'));
    } else {
      p.appendChild(el('h2', null, f.parziale ? 'Vittoria parziale' : 'Hai perso'));
      var perche = f.motivo === 'bloccato' ? 'Non avevi nessuna azione possibile.' : 'Una figura o un Asso è finito nella pila del nemico.';
      p.appendChild(el('p', null, (f.parziale ? 'Hai vinto la prima fase, ma hai perso la seconda. ' : '') + perche));
    }
    p.appendChild(el('p', null, 'Turni giocati: ' + g.turno + '.'));
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiInizio));
    app.appendChild(p);
  }

  // ---------- demo ----------
  /* La demo si gioca: ogni passo con una mossa aspetta che il giocatore la faccia con gli stessi
     tocchi della partita (carte, bersaglio, A/B/C, Conferma). Qui l'aiuto visivo c'è (classe
     'guida'); nella partita vera no. Un tocco fuori dalla mossa del passo non cambia il tavolo:
     compare solo una riga che rimette in strada. */
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: nuovaSelDemo(), msg: '', ok: false, rifiutato: false, fatto: false }; render(); }
  function nuovaSelDemo() { return { mano: [], fila: null, azione: null }; }
  function attesi(m) {
    return {
      mano: m.t === 'scarta' ? (m.carte || []) : (m.azione === 'B' ? [m.carta] : (m.mie || [])),
      fila: m.bersaglio || null,
      azione: m.azione || null
    };
  }
  function nomeCarta(id, delNemico) {
    var c = L.daId(id), t;
    if (c.jolly) t = 'il jolly';
    else t = ((c.valore === 8 || c.valore === 14) ? 'l\'' : 'il ') + L.etichetta(c);
    return t + (delNemico ? ' del nemico' : '');
  }
  function elencoE(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  // la prossima cosa da toccare, scritta: prima le tue carte, poi il bersaglio, poi A/B/C, poi il tasto
  function prossimoTocco(m, sel, etichettaConferma) {
    var at = attesi(m);
    var manca = at.mano.filter(function (id) { return sel.mano.indexOf(id) < 0; });
    if (manca.length) return nomeCarta(manca[0]) + (manca.length > 1 ? ' e ' + elencoE(manca.slice(1).map(function (id) { return nomeCarta(id); })) : '');
    if (at.fila && sel.fila !== at.fila) return nomeCarta(at.fila, true);
    if (at.azione && sel.azione !== at.azione) return at.azione;
    return '«' + etichettaConferma + '»';
  }
  function frasePasso(m) {
    var at = attesi(m), v = [], conf = m.t === 'scarta' ? (at.mano.length ? 'Scarta ' + conTesto(at.mano.length, 'carta', 'carte') : 'Niente da scartare') : 'Conferma';
    if (at.mano.length) v.push(elencoE(at.mano.map(function (id) { return nomeCarta(id); })));
    if (at.fila) v.push(nomeCarta(at.fila, true));
    if (at.azione) v.push(at.azione);
    v.push('«' + conf + '»');
    return 'Tocca ' + v.join(', poi ') + '.';
  }
  function demoCompleta(m, sel) {
    var at = attesi(m);
    return at.mano.every(function (id) { return sel.mano.indexOf(id) >= 0; }) &&
      (!at.fila || sel.fila === at.fila) && (!at.azione || sel.azione === at.azione);
  }
  function demoSbagliato(m, conf) {
    demo.msg = 'Non ancora: tocca ' + prossimoTocco(m, demo.sel, conf) + '.'; demo.ok = false; render();
  }

  function schermoDemo() {
    var passo = D.passi[demo.i], m = passo.mossa, ultimo = demo.i === D.passi.length - 1;
    var sel = demo.sel, bloccato = !m || demo.rifiutato || demo.fatto;
    var conf = m && m.t === 'scarta' ? (sel.mano.length ? 'Scarta ' + conTesto(sel.mano.length, 'carta', 'carte') : 'Niente da scartare') : 'Conferma';
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiInizio)]));
    msg = demo.msg; msgOk = demo.ok;
    var scelte = {}, at = m ? attesi(m) : null;
    if (m && !bloccato) {
      at.mano.forEach(function (id) { scelte[id] = sel.mano.indexOf(id) >= 0 ? 'scelta' : 'guida'; });
      if (at.fila) scelte[at.fila] = sel.fila === at.fila ? 'scelta' : 'guida';
    } else if (m && demo.rifiutato) {
      sel.mano.concat(sel.fila ? [sel.fila] : []).forEach(function (id) { scelte[id] = 'no'; });
    }
    var f = el('div', 'fase');
    f.appendChild(el('b', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(f);
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte,
      cliccaMano: m && !bloccato ? function (c) {
        if (at.mano.indexOf(c.id) < 0) { demoSbagliato(m, conf); return; }
        alterna(sel.mano, c.id); demo.msg = ''; demo.ok = false; render();
      } : null,
      cliccaFila: m && !bloccato ? function (c) {
        if (c.id !== at.fila) { demoSbagliato(m, conf); return; }
        sel.fila = sel.fila === c.id ? null : c.id; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    if (m && m.azione) {
      var tre = el('div', 'azioni3');
      AZIONI.forEach(function (a) {
        var cl = (sel.azione === a.k ? 'on' : '') + (!bloccato && at.azione === a.k && sel.azione !== a.k ? ' guida' : '');
        var b = bottone(a.nome, cl.trim(), bloccato ? null : function () {
          if (a.k !== at.azione) { demoSbagliato(m, conf); return; }
          sel.azione = sel.azione === a.k ? null : a.k; demo.msg = ''; demo.ok = false; render();
        });
        if (bloccato) b.disabled = true;
        b.appendChild(el('small', null, a.sotto)); tre.appendChild(b);
      });
      app.appendChild(tre);
    }
    var ps = el('div', 'passo');
    ps.appendChild(el('p', null, passo.testo));
    if (m && !bloccato) ps.appendChild(el('p', 'tocca', frasePasso(m)));
    if (m && demo.rifiutato) ps.appendChild(el('p', 'tocca', 'Il motore l\'ha rifiutata: è la lezione di questo passo. Avanti.'));
    app.appendChild(ps);
    var az = el('div', 'azioni');
    if (!m || demo.rifiutato || demo.fatto) {
      az.appendChild(bottone(ultimo ? 'Gioca' : 'Avanti', 'conferma', function () {
        if (ultimo) { vaiInizio(); return; }
        demo.i++; demo.sel = nuovaSelDemo(); demo.rifiutato = false; demo.fatto = false;
        if (!(m && demo.ok)) { demo.msg = ''; demo.ok = false; }
        render();
      }));
    } else {
      var cf = bottone(conf, 'conferma' + (demoCompleta(m, sel) ? ' guida' : ''), function () {
        if (!demoCompleta(m, sel)) { demoSbagliato(m, conf); return; }
        var prova = L.apply(demo.st, m);
        if (prova.rifiuto) {
          demo.rifiutato = true; demo.msg = 'Non si può: ' + prova.rifiuto; demo.ok = false;
        } else {
          demo.st = prova; demo.msg = prova.cronaca.join(' '); demo.ok = true; demo.sel = nuovaSelDemo();
          if (ultimo) demo.fatto = true; else demo.i++;
        }
        render();
      });
      az.appendChild(cf);
    }
    if (!m || demo.rifiutato || demo.fatto) { /* niente altro */ }
    app.appendChild(az);
  }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'inizio') schermoInizio();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  document.title = TITOLO;
  crediti();
  opz = opzioniIniziali();
  schermo = leggiVisto() ? 'inizio' : 'domanda';
  render();
}());
