/*
 * La baita — la parte che parla col browser. Legge lo stato del motore (engine.js)
 * e lo mostra; non contiene regole. Cambia lo stato solo con Baita.apply.
 * Gli zombie coperti (stato.zombie) NON vengono mai scritti nella pagina finché non sono scoperti.
 * In partita niente suggerimenti: nessuna pila o zombie evidenziati. Si sceglie e si conferma.
 */
(function () {
  'use strict';
  var B = self.Baita, D = self.BaitaDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'dead-center-visto';

  // Titolo e crediti stanno in un punto solo: qui.
  var TITOLO = 'Dead Center';
  var CREDITI = {
    autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    basato: 'Gridcannon di Tom Francis'
  };
  var FASI = {
    scopri: 'Passo 1 di 3: scopri uno zombie',
    gioca: 'Passo 2 di 3: gioca la carta su una pila',
    abbatti: 'Passo 3 di 3: abbatti uno zombie, se puoi'
  };
  var DESCRIZIONE_LIVELLO = {
    normale: ['Normale', '2 jolly'],
    difficile: ['Difficile', '1 jolly: la scelta dell’autore'],
    difficilissimo: ['Difficilissimo', 'nessun jolly']
  };

  var schermo;       // 'domanda' | 'livello' | 'partita' | 'demo'
  var g;             // stato del motore (la partita in corso)
  var livello;       // il livello della partita in corso
  var sel;           // la cosa scelta: una pila (numero), uno zombie (posto) o 'nessuno'; null se niente
  var msg = '', msgOk = false;
  var demo;          // { i, st, sel, fatto, msg, ok }
  var abbandona;     // true quando si chiede conferma per la nuova partita
  var nPartite = 0;

  document.title = TITOLO;

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
  function parametro(nome) {
    var m = new RegExp('[?&]' + nome + '=([^&]+)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function semeIniziale() {
    var s = parametro('seme');
    if (s) return s + (nPartite ? '-' + (nPartite + 1) : '');
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
  }
  function crediti() {
    var f = document.getElementById('crediti');
    f.textContent = TITOLO + ' di ' + CREDITI.autore + ', dalla collezione ';
    var a = el('a', null, CREDITI.collezione); a.href = CREDITI.link; a.rel = 'noopener';
    f.appendChild(a);
    f.appendChild(document.createTextNode(', basato su ' + CREDITI.basato + '.'));
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function conArticolo(c) {
    if (B.eJolly(c)) return 'il Jolly';
    var n = B.nomeCarta(c);
    if (c.valore === 12) return 'la ' + n;
    if (c.valore === 1 || c.valore === 8) return 'l’' + n;
    return 'il ' + n;
  }

  // ---------- carte e baita ----------
  function faccia(c, tag, cls) {
    var e = el(tag, 'carta ' + c.seme + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', B.nomeCarta(c));
    e.appendChild(el('span', 'v', B.etichetta(c)));
    e.appendChild(el('span', 's', B.SIMBOLO[c.seme]));
    return e;
  }
  /* o: { stato, scelte:{dove:classe}, clic(dove) | null } */
  function baita(o) {
    var st = o.stato, box = el('div', 'baita'), r, k;
    function voce(dove) {
      var pronto = o.scelte[dove] || '', b, tag = o.clic ? 'button' : 'div';
      if (typeof dove === 'number') {
        var pila = st.baita[dove];
        b = faccia(B.cima(pila), tag, 'pila ' + (st.pilaGiocata === dove ? 'appena ' : '') + pronto);
        b.setAttribute('aria-label', 'Pila in ' + B.nomeCella(dove) + ', in cima ' + B.nomeCarta(B.cima(pila)));
      } else if (!st.zombie[dove]) {
        b = el(tag, 'vuoto ' + pronto, '×');
        b.setAttribute('aria-label', 'Zombie abbattuto ' + B.nomePosto(dove));
      } else if (st.coperto[dove]) {
        b = el(tag, 'dorso ' + pronto);
        b.setAttribute('aria-label', 'Zombie coperto ' + B.nomePosto(dove));
      } else {
        b = faccia(st.zombie[dove], tag, 'zombie ' + pronto);
        b.setAttribute('aria-label', 'Zombie ' + B.nomeCarta(st.zombie[dove]) + ' ' + B.nomePosto(dove));
      }
      if (o.clic) { b.type = 'button'; b.addEventListener('click', function () { o.clic(dove); }); }
      return b;
    }
    function angolo() { return el('div', 'angolo'); }
    box.appendChild(angolo());
    for (k = 0; k < 3; k++) box.appendChild(voce('T' + k));
    box.appendChild(angolo());
    for (r = 0; r < 3; r++) {
      box.appendChild(voce('L' + r));
      for (k = 0; k < 3; k++) box.appendChild(voce(r * 3 + k));
      box.appendChild(voce('R' + r));
    }
    box.appendChild(angolo());
    for (k = 0; k < 3; k++) box.appendChild(voce('B' + k));
    box.appendChild(angolo());
    return box;
  }

  // ---------- tavolo (partita e demo) ----------
  /* o: { stato, scelte, clic } */
  function tavolo(o) {
    var st = o.stato, box = el('div');
    box.appendChild(el('div', 'fase', FASI[st.fase] || ''));
    box.appendChild(baita(o));
    var sotto = el('div', 'sotto');
    var mz = el('div', 'mazzo');
    mz.appendChild(st.mazzo.length ? el('div', 'dorso') : el('div', 'vuoto'));
    mz.appendChild(el('div', null, st.mazzo.length ? conTesto(st.mazzo.length, 'carta', 'carte') : 'mazzo finito'));
    sotto.appendChild(mz);
    var mano = el('div', 'mazzo');
    mano.appendChild(st.mano ? faccia(st.mano, 'div') : el('div', 'vuoto'));
    mano.appendChild(el('div', null, 'In mano'));
    sotto.appendChild(mano);
    sotto.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(sotto);
    return box;
  }

  // il tasto «Non abbattere nessuno» sta nella riga di Conferma, solo nel passo 3
  function tastoPassa(st, p) {
    if (st.fase !== 'abbatti') return null;
    var b = bottone('Non abbattere nessuno', 'passa' + (p.on ? ' on' : '') + (p.suggerita ? ' suggerita' : ''), p.clic);
    if (!p.clic) b.tabIndex = -1;
    return b;
  }

  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, TITOLO));
    var dx = el('div', 'dx');
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }
  function punteggio(st, destra) {
    var p = el('div', 'punti');
    var a = el('span'); a.appendChild(document.createTextNode('Abbattuti ')); a.appendChild(el('b', null, B.morti(st) + '/12'));
    p.appendChild(a);
    p.appendChild(el('span', null, destra));
    return p;
  }

  // ---------- domanda e livello ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Sei chiuso in una baita, circondato da dodici zombie. Abbattili tutti prima che finisca il mazzo.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiLivello(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }
  function vaiLivello() {
    var l = parametro('livello');                     // ?livello=difficile salta la scelta (per le prove)
    if (l && B.LIVELLI[l]) { vaiPartita(l); return; }
    abbandona = false; schermo = 'livello'; render();
  }
  function schermoLivello() {
    app.appendChild(intestazione(g && !g.fine ? [bottone('Torna alla partita', 'mini', function () { schermo = 'partita'; render(); })] : []));
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Come vuoi giocare?'));
    p.appendChild(el('p', null, 'Meno jolly ci sono, più è difficile. Lo scegli a ogni partita.'));
    ['normale', 'difficile', 'difficilissimo'].forEach(function (l) {
      var b = bottone('', 'grande' + (l === 'normale' ? ' primo' : ''), function () { vaiPartita(l); });
      b.appendChild(document.createTextNode(DESCRIZIONE_LIVELLO[l][0]));
      b.appendChild(el('small', null, DESCRIZIONE_LIVELLO[l][1]));
      p.appendChild(b);
    });
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita(l) {
    if (l) {
      livello = l; g = B.nuova(semeIniziale(), { livello: l }); nPartite++;
      sel = null; msgOk = false; msg = 'Scegli, poi conferma.';
    }
    abbandona = false; schermo = 'partita'; render();
  }
  function haGiocato() { return !!g && g.ultimo && g.ultimo.azione !== 'inizio'; }
  function chiediNuova() {
    if (!haGiocato() || g.fine) { vaiLivello(); return; }
    abbandona = true; render();
  }
  function riassunto(u, st) {
    var t = '';
    if (u.azione === 'scopri') t = 'Era ' + conArticolo(u.zombie) + '.';
    else if (u.azione === 'gioca') t = 'Hai giocato ' + conArticolo(u.carta) + ' in ' + B.nomeCella(u.cella) + '.' + (u.senzaZombie ? ' Il centro non ha zombie vicini.' : '');
    else if (u.azione === 'abbatti') t = 'Hai abbattuto ' + conArticolo(u.zombie) + ' (appoggio ' + B.sigla(u.appoggio[0]) + ' e ' + B.sigla(u.appoggio[1]) + ').';
    else if (u.azione === 'passa') t = 'Nessuno zombie abbattuto.';
    if (st.mano) t += ' Hai pescato ' + conArticolo(st.mano) + '.';
    return t;
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', chiediNuova)]));
    if (abbandona) {
      var p = el('div', 'pannello fine');
      p.appendChild(el('h2', null, 'Lasciare questa partita?'));
      p.appendChild(el('p', null, 'Non si può tornare indietro.'));
      var due = el('div', 'dueBottoni');
      due.appendChild(bottone('Sì, nuova', 'grande', function () { vaiLivello(); }));
      due.appendChild(bottone('No, continuo', 'grande primo', function () { abbandona = false; render(); }));
      p.appendChild(due);
      app.appendChild(p);
    }
    app.appendChild(punteggio(g, B.LIVELLI[livello].nome + ', ' + conTesto(g.jolly, 'jolly', 'jolly')));
    var fine = !!g.fine, scelte = {};
    if (sel !== null && sel !== 'nessuno') scelte[sel] = 'scelta';
    function scegli(x) { sel = sel === x ? null : x; msg = ''; msgOk = false; render(); }
    app.appendChild(tavolo({
      stato: g, scelte: scelte, clic: fine ? null : scegli
    }));
    if (fine) { finale(); return; }
    var az = el('div', 'azioni');
    var tp = tastoPassa(g, { on: sel === 'nessuno', clic: function () { scegli('nessuno'); } });
    if (tp) az.appendChild(tp);
    var conf = bottone('Conferma', 'conferma', conferma);
    conf.disabled = sel === null;
    az.appendChild(conf);
    app.appendChild(az);
  }
  function conferma() {
    var m = sel === 'nessuno' ? { t: 'passa' } : { t: g.fase, dove: sel };
    var n = B.apply(g, m);
    if (n.rifiuto) { msg = n.rifiuto + '.'; msgOk = false; render(); return; }   // la scelta resta
    g = n; sel = null; msgOk = true; msg = riassunto(g.ultimo, g);
    render();
  }
  function finale() {
    var p = el('div', 'pannello fine'), f = g.fine, k = B.morti(g);
    if (f.vinto) {
      p.appendChild(el('h2', null, 'Hai vinto!'));
      p.appendChild(el('p', null, 'Tutti e dodici gli zombie sono caduti. Punteggio: ' + conTesto(f.punti, 'carta rimasta', 'carte rimaste') + ' nel mazzo.'));
    } else {
      p.appendChild(el('h2', null, 'Partita persa'));
      p.appendChild(el('p', null, (f.motivo === 'mazzo'
        ? 'Il mazzo è finito.'
        : 'Hai pescato ' + conArticolo(g.mano) + ' e non va su nessuna pila.') +
        ' Hai abbattuto ' + k + ' zombie su 12.'));
    }
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiLivello));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: null, fatto: false, msg: '', ok: false }; render(); }
  function bersaglio(m) { return m.t === 'passa' ? 'nessuno' : m.dove; }
  function descriviDove(m) {
    if (m.t === 'passa') return '“Non abbattere nessuno”';
    if (m.t === 'gioca') return 'la pila in ' + B.nomeCella(m.dove);
    var z = demo.st.zombie[m.dove];
    return 'lo zombie ' + (z && !demo.st.coperto[m.dove] ? B.sigla(z) + ' ' : '') + B.nomePosto(m.dove);
  }
  function frase(m) { return 'Tocca ' + descriviDove(m) + ', poi Conferma'; }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa(m, s) { return s !== bersaglio(m) ? 'tocca ' + descriviDove(m) : 'tocca Conferma'; }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m, demo.sel) + '.'; demo.ok = false; render(); }
  function demoAvanti() { demo.i++; demo.sel = null; demo.fatto = false; demo.msg = ''; demo.ok = false; render(); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (prossimaCosa(m, demo.sel) !== 'tocca Conferma') { demoSbagliato(m); return; }
    var n = B.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può: ' + n.rifiuto + '.'; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo, n);
    if (demo.i < D.passi.length - 1) { demo.i++; demo.sel = null; demo.fatto = false; }
    render();
  }
  function uscitaDemo() { msg = ''; msgOk = false; if (g) { schermo = 'partita'; render(); } else vaiLivello(); }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', uscitaDemo)]));
    var aiuto = {}, pronto = false, attivo = !!m && !demo.fatto;
    if (attivo) {
      if (m.t !== 'passa') aiuto[m.dove] = 'suggerita';
      if (demo.sel !== null && demo.sel !== 'nessuno') aiuto[demo.sel] = demo.sel === m.dove ? 'scelta' : '';
      pronto = prossimaCosa(m, demo.sel) === 'tocca Conferma';
    } else if (m && demo.fatto && m.t !== 'passa') {   // rifiuto fatto: l'elemento resta segnato in rosso
      aiuto[m.dove] = 'no';
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Prova: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    p.appendChild(el('span', null, 'Abbattuti ' + B.morti(demo.st)));
    app.appendChild(p);
    app.appendChild(tavolo({
      stato: demo.st, scelte: aiuto,
      clic: attivo ? function (dove) {
        if (m.t === 'passa' || dove !== m.dove) { demoSbagliato(m); return; }
        demo.sel = demo.sel === dove ? null : dove; demo.msg = ''; demo.ok = false; render();
      } : null
    }));
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m) + '.'));
    box.appendChild(document.createTextNode(passo.testo));
    app.appendChild(box);
    var az = el('div', 'azioni');
    var tp = tastoPassa(demo.st, {
      on: demo.sel === 'nessuno', suggerita: attivo && m.t === 'passa',
      clic: attivo ? function () {
        if (m.t !== 'passa') { demoSbagliato(m); return; }
        demo.sel = demo.sel === 'nessuno' ? null : 'nessuno'; demo.msg = ''; demo.ok = false; render();
      } : null
    });
    if (tp) az.appendChild(tp);
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', uscitaDemo));
    else az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    app.appendChild(az);
  }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'livello') schermoLivello();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  crediti();
  if (leggiVisto()) vaiLivello(); else { schermo = 'domanda'; render(); }
}());
