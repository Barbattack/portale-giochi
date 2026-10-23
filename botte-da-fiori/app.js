/*
 * Botte da fiori — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Botte.apply.
 */
(function () {
  'use strict';
  var B = self.Botte, D = self.BotteDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'botte-da-fiori-visto';
  var SIMBOLO = { C: '♣', D: '♦', H: '♥', S: '♠' };
  var NOMI = ['uguali', 'somma', 'qualsiasi', 'linea', 'sugiu', 'scala'];
  var INTRO = 'Scegli una carta di fiori, poi una mossa.';

  var schermo;           // 'domanda' | 'inizio' | 'partita' | 'demo'
  var g;                 // stato del motore (partita)
  var mod;               // la mossa in preparazione: { carta, azione, scelte:[], linea, dir }
  var msg, msgOk;        // messaggio sotto la griglia
  var scarti;            // true se il pannello degli scarti è aperto
  var demo;              // { i, st }

  // ---------- piccoli aiuti ----------
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

  // ---------- carte ----------
  var NOME_LUNGO = { 1: 'asso', 11: 'fante', 12: 'donna', 13: 're' };
  var NOME_SEME = { C: 'fiori', D: 'quadri', H: 'cuori', S: 'picche' };
  function etichettaCarta(c) {
    if (c.seme === 'J') return 'jolly';
    return (NOME_LUNGO[c.valore] || c.valore) + ' di ' + NOME_SEME[c.seme];
  }
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta' + (c.seme === 'D' || c.seme === 'H' ? ' rosso' : '') + (c.seme === 'J' ? ' jolly' : '') + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', etichettaCarta(c));
    if (c.seme === 'J') { e.appendChild(el('span', 'v', 'JOLLY')); e.appendChild(el('span', 's', '★')); }
    else { e.appendChild(el('span', 'v', c.etichetta)); e.appendChild(el('span', 's', SIMBOLO[c.seme])); }
    return e;
  }

  // ---------- tavolo: griglia + mano + mosse (usato da partita e demo) ----------
  /*
   * o: { stato, scelte:{id:classe}, lineaAttiva, linea, cliccaGriglia(c), cliccaTesta(tipo,n),
   *      cartaSel, cliccaMano(c), azione, cliccaAzione(a), soloLettura }
   */
  function tavolo(o) {
    var box = el('div');
    var t = el('div', 'tavolo');
    t.appendChild(el('span', 'vuoto-angolo'));
    var k, r;
    for (k = 0; k < 3; k++) t.appendChild(testa('colonna', k, '▼', 'col'));
    for (r = 0; r < 3; r++) {
      t.appendChild(testa('riga', r, '▶', 'riga'));
      for (k = 0; k < 3; k++) {
        var c = o.stato.griglia[r * 3 + k];
        if (!c) { t.appendChild(el('div', 'carta vuota')); continue; }
        var cls = o.scelte && o.scelte[c.id] ? o.scelte[c.id] : '';
        if (o.lineaAttiva && o.linea && ((o.linea.tipo === 'riga' && o.linea.n === r) || (o.linea.tipo === 'colonna' && o.linea.n === k))) cls = 'scelta';
        var b = faccia(c, o.cliccaGriglia ? 'button' : 'div', cls);
        if (o.cliccaGriglia) { b.type = 'button'; (function (cc) { b.addEventListener('click', function () { o.cliccaGriglia(cc); }); }(c)); }
        t.appendChild(b);
      }
    }
    function testa(tipo, n, simbolo, cls2) {
      var attiva = !!(o.lineaAttiva && o.cliccaTesta);
      var sel = o.linea && o.linea.tipo === tipo && o.linea.n === n;
      var b = bottone(simbolo, 'testa ' + cls2 + (attiva ? ' on' : '') + (sel ? ' sel' : '') + (o.testaGuida && o.testaGuida.tipo === tipo && o.testaGuida.n === n ? ' guida' : ''), attiva ? function () { o.cliccaTesta(tipo, n); } : null);
      b.setAttribute('aria-label', (tipo === 'riga' ? 'Riga ' : 'Colonna ') + (n + 1));
      if (!attiva) b.tabIndex = -1;
      return b;
    }
    box.appendChild(t);
    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    box.appendChild(manoEMosse(o));
    return box;
  }

  function manoEMosse(o) {
    var box = el('div');
    var mano = el('div', 'mano fiori');
    o.stato.mano.forEach(function (c) {
      var cls = o.cartaSel === c.id ? 'scelta' : (o.cartaClasse && o.cartaClasse[c.id]) || '';
      var b = faccia(c, o.cliccaMano ? 'button' : 'div', cls);
      if (o.cliccaMano) { b.type = 'button'; b.addEventListener('click', function () { o.cliccaMano(c); }); }
      mano.appendChild(b);
    });
    box.appendChild(mano);
    var mosse = el('div', 'mosse');
    NOMI.forEach(function (a) {
      var b = bottone(B.NOME_AZIONE[a], (o.azione === a ? 'on' : '') + (o.azioneGuida === a ? ' guida' : ''), o.cliccaAzione ? function () { o.cliccaAzione(a); } : null);
      if (!o.cliccaAzione) b.tabIndex = -1;
      mosse.appendChild(b);
    });
    box.appendChild(mosse);
    return box;
  }

  function intestazione(extra) {
    var top = el('div', 'top');
    top.appendChild(el('h1', null, 'Botte da fiori'));
    var dx = el('div');
    dx.style.display = 'flex'; dx.style.gap = '6px';
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }

  // ---------- schermata: domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Con le 13 carte di fiori devi togliere tutte le altre carte da una griglia 3×3.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiInizio(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- schermata: inizio (difficoltà) ----------
  function schermoInizio() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo)]));
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Nuova partita'));
    p.appendChild(el('p', null, 'Quanti jolly nel mazzo della griglia?'));
    p.appendChild(bottone('Facile: 1 jolly', 'grande primo', function () { inizia('facile'); }));
    p.appendChild(bottone('Difficile: 2 jolly', 'grande', function () { inizia('difficile'); }));
    app.appendChild(p);
  }
  function vaiInizio() { schermo = 'inizio'; render(); }

  function inizia(difficolta) {
    g = B.nuova(semeIniziale(), { difficolta: difficolta });
    mod = nuovaMod(); msg = INTRO; msgOk = false; scarti = false;
    schermo = 'partita';
    render();
  }
  function nuovaMod() { return { carta: null, azione: null, scelte: [], linea: null, dir: null }; }

  // ---------- schermata: partita ----------
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiInizio)]));
    var info = el('div', 'info');
    var l = el('span'); l.appendChild(document.createTextNode('Turni rimasti: ')); l.appendChild(el('b', null, String(B.turniRimasti(g)))); info.appendChild(l);
    info.appendChild(el('small', null, 'Mazzo: ' + g.mazzoGriglia.length));
    info.appendChild(bottone(scarti ? 'Chiudi scarti' : 'Scarti (' + g.scarti.length + ')', 'mini', function () { scarti = !scarti; render(); }));
    app.appendChild(info);

    var scelte = {};
    mod.scelte.forEach(function (id) { scelte[id] = 'scelta'; });
    var soloGriglia = mod.azione === 'somma' || mod.azione === 'qualsiasi' || mod.azione === 'scala';
    var fine = !!g.fine;
    app.appendChild(tavolo({
      stato: g, scelte: scelte,
      lineaAttiva: mod.azione === 'linea' && !fine, linea: mod.linea,
      cliccaGriglia: soloGriglia && !fine ? cliccaGriglia : null,
      cliccaTesta: function (tipo, n) { mod.linea = { tipo: tipo, n: n }; msg = ''; render(); },
      cartaSel: mod.carta, cliccaMano: fine ? null : function (c) { mod.carta = c.id; msg = ''; render(); },
      azione: mod.azione, cliccaAzione: fine ? null : cliccaAzione
    }));

    if (fine) { finale(); }
    else {
      if (mod.azione === 'sugiu' && cartaInMano() && cartaInMano().valore === 7) {
        var d = el('div', 'dir');
        d.appendChild(bottone('Le più basse', mod.dir === 'basse' ? 'on' : '', function () { mod.dir = 'basse'; render(); }));
        d.appendChild(bottone('Le più alte', mod.dir === 'alte' ? 'on' : '', function () { mod.dir = 'alte'; render(); }));
        app.appendChild(d);
      }
      var az = el('div', 'azioni');
      var conf = bottone('Conferma', 'conferma', conferma);
      conf.disabled = !(mod.carta && mod.azione);
      az.appendChild(conf);
      app.appendChild(az);
    }
    if (scarti) app.appendChild(pannelloScarti());
  }

  function cartaInMano() {
    for (var i = 0; i < g.mano.length; i++) if (g.mano[i].id === mod.carta) return g.mano[i];
    return null;
  }
  function cliccaAzione(a) {
    if (mod.azione !== a) { mod.azione = a; mod.scelte = []; mod.linea = null; mod.dir = null; }
    msg = ''; render();
  }
  function cliccaGriglia(c) {
    var i = mod.scelte.indexOf(c.id);
    if (i >= 0) mod.scelte.splice(i, 1);
    else if (mod.azione === 'qualsiasi') mod.scelte = [c.id];
    else mod.scelte.push(c.id);
    msg = ''; render();
  }
  function conferma() {
    var n = B.apply(g, { t: 'gioca', carta: mod.carta, azione: mod.azione, scelte: mod.scelte, linea: mod.linea, dir: mod.dir });
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }  // la carta resta in mano, la mossa resta com'è
    var u = n.ultimo;
    msg = B.NOME_AZIONE[u.azione] + ': tolte ' + u.tolte.length + (u.tolte.length === 1 ? ' carta.' : ' carte.') + (u.jollyTolto ? ' Il jolly è uscito.' : '');
    msgOk = true;
    g = n; mod = nuovaMod();
    render();
  }
  function finale() {
    var p = el('div', 'pannello fine');
    if (g.fine === 'vinta') p.appendChild(el('h2', null, 'Hai vinto! La griglia è vuota.'));
    else {
      p.appendChild(el('h2', null, 'Hai perso.'));
      var n = B.dasEliminare(g);
      p.appendChild(el('p', null, 'Le carte di fiori sono finite e restano ' + n + (n === 1 ? ' carta' : ' carte') + ' da togliere.'));
    }
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiInizio));
    app.appendChild(p);
  }
  function pannelloScarti() {
    var p = el('div', 'scarti');
    if (!g.scarti.length) { p.appendChild(el('div', null, 'Nessuna carta scartata.')); return p; }
    var l = el('div', 'elenco');
    g.scarti.forEach(function (c) { l.appendChild(faccia(c)); });
    p.appendChild(l);
    return p;
  }

  // ---------- schermata: demo (giocabile) ----------
  /*
   * La demo si gioca sul tavolo vero, con gli stessi tocchi: carta, mossa, carte o riga, «Conferma».
   * Ogni tocco è confrontato con la mossa del passo: se non è quello giusto non succede niente
   * sul tavolo e compare una riga che rimette in strada. Il motore resta l'unico che decide
   * (Botte.apply); la demo lo chiama solo alla conferma, con la mossa che il giocatore ha composto.
   */
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), mod: nuovaMod(), msg: '', ok: false, rif: null }; render(); }

  function trovaDemo(id) {
    var tutte = demo.st.mano.concat(demo.st.griglia), k;
    for (k = 0; k < tutte.length; k++) if (tutte[k] && tutte[k].id === id) return tutte[k];
    return null;
  }
  function breve(id) {
    var c = trovaDemo(id);
    return c ? (c.seme === 'J' ? 'il jolly' : 'il ' + c.etichetta + SIMBOLO[c.seme]) : id;
  }
  // il prossimo tocco richiesto: { tipo:'carta'|'azione'|'scelta'|'linea'|'dir'|'conferma', id, testo }
  function prossimo(m, md) {
    if (md.carta !== m.carta) return { tipo: 'carta', id: m.carta, testo: 'tocca ' + breve(m.carta) };
    if (md.azione !== m.azione) return { tipo: 'azione', id: m.azione, testo: 'tocca «' + B.NOME_AZIONE[m.azione] + '»' };
    var mancanti = (m.scelte || []).filter(function (id) { return md.scelte.indexOf(id) < 0; });
    if (mancanti.length) return { tipo: 'scelta', id: mancanti, testo: 'tocca ' + mancanti.map(breve).join(' e ') };
    if (m.linea && !(md.linea && md.linea.tipo === m.linea.tipo && md.linea.n === m.linea.n))
      return { tipo: 'linea', id: m.linea, testo: 'tocca la freccia della ' + m.linea.tipo + ' ' + (m.linea.n + 1) };
    if (m.dir && md.dir !== m.dir) return { tipo: 'dir', id: m.dir, testo: 'tocca «' + (m.dir === 'alte' ? 'Le più alte' : 'Le più basse') + '»' };
    return { tipo: 'conferma', testo: 'tocca «Conferma»' };
  }
  // la frase d'istruzione del passo, per esempio: «Tocca il 10♣, poi Uguali, poi Conferma»
  function istruzione(m) {
    var parti = [breve(m.carta), B.NOME_AZIONE[m.azione]];
    (m.scelte || []).forEach(function (id) { parti.push(breve(id)); });
    if (m.linea) parti.push('la freccia della ' + m.linea.tipo + ' ' + (m.linea.n + 1));
    if (m.dir) parti.push(m.dir === 'alte' ? 'Le più alte' : 'Le più basse');
    parti.push('Conferma');
    return 'Tocca ' + parti.join(', poi ') + '.';
  }
  function sbagliato(m) {
    demo.msg = 'Non ancora: ' + prossimo(m, demo.mod).testo + '.'; demo.ok = false; render();
  }

  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1;
    var m = passo.mossa, md = demo.mod, chiuso = !!demo.rif;
    var pross = m && !chiuso ? prossimo(m, md) : null;
    app.appendChild(intestazione([bottone('Salta', 'mini', fineDemo)]));
    msg = demo.msg; msgOk = demo.ok;
    var info = el('div', 'info');
    info.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(info);

    var scelte = {}, cartaClasse = {}, k;
    md.scelte.forEach(function (id) { scelte[id] = 'scelta'; });
    if (m && !chiuso) {   // l'ordine è libero: si indica tutto ciò che manca, non solo la prossima cosa
      if (md.carta !== m.carta) cartaClasse[m.carta] = 'guida';
      (m.scelte || []).forEach(function (id) { if (md.scelte.indexOf(id) < 0) scelte[id] = 'guida'; });
    }
    if (chiuso) {
      cartaClasse[m.carta] = 'no';
      (m.scelte || []).forEach(function (id) { scelte[id] = 'no'; });
    }
    var attivo = !!m && !chiuso;
    app.appendChild(tavolo({
      stato: demo.st, scelte: scelte, cartaClasse: cartaClasse,
      lineaAttiva: !!(attivo && m.linea), linea: md.linea,
      testaGuida: attivo && m.linea && !md.linea ? m.linea : null,
      cartaSel: md.carta,
      azione: md.azione, azioneGuida: attivo && md.azione !== m.azione ? m.azione : null,
      // ordine libero: ogni tocco giusto si può fare in qualunque momento, e rifare per toglierlo
      cliccaMano: attivo ? function (c) {
        if (c.id !== m.carta) { sbagliato(m); return; }
        md.carta = md.carta === c.id ? null : c.id; demo.msg = ''; render();
      } : null,
      cliccaAzione: attivo ? function (a) {
        if (a !== m.azione) { sbagliato(m); return; }
        md.azione = md.azione === a ? null : a; demo.msg = ''; render();
      } : null,
      cliccaGriglia: attivo ? function (c) {
        var i = md.scelte.indexOf(c.id);
        if (i >= 0) { md.scelte.splice(i, 1); demo.msg = ''; render(); return; }
        if ((m.scelte || []).indexOf(c.id) >= 0) { md.scelte.push(c.id); demo.msg = ''; render(); return; }
        sbagliato(m);
      } : null,
      cliccaTesta: attivo ? function (tipo, n) {
        if (!(m.linea && m.linea.tipo === tipo && m.linea.n === n)) { sbagliato(m); return; }
        md.linea = md.linea ? null : { tipo: tipo, n: n }; demo.msg = ''; render();
      } : null
    }));

    if (m && !chiuso && m.dir) {
      var d = el('div', 'dir');
      [['basse', 'Le più basse'], ['alte', 'Le più alte']].forEach(function (x) {
        d.appendChild(bottone(x[1], (md.dir === x[0] ? 'on' : '') + (md.dir !== x[0] && m.dir === x[0] && !md.dir ? ' guida' : ''), function () {
          if (m.dir === x[0]) { md.dir = md.dir === x[0] ? null : x[0]; demo.msg = ''; render(); } else sbagliato(m);
        }));
      });
      app.appendChild(d);
    }

    var testoPasso = el('div', 'passo');
    testoPasso.appendChild(document.createTextNode(passo.testo));
    if (m) {
      var ist = el('b', 'istruzione', (passo.rifiuto ? 'Prova questa mossa. ' : '') + istruzione(m));
      testoPasso.appendChild(document.createElement('br'));
      testoPasso.appendChild(ist);
    }
    app.appendChild(testoPasso);

    var az = el('div', 'azioni');
    if (m && !chiuso) {
      az.appendChild(bottone('Conferma', 'conferma' + (pross && pross.tipo === 'conferma' ? ' guida' : ''), function () {
        if (prossimo(m, md).tipo !== 'conferma') { sbagliato(m); return; }
        var n = B.apply(demo.st, { t: 'gioca', carta: md.carta, azione: md.azione, scelte: md.scelte, linea: md.linea, dir: md.dir });
        if (n.rifiuto) { demo.rif = n.rifiuto; demo.msg = 'Non si può: ' + n.rifiuto; demo.ok = false; render(); return; }
        var u = n.ultimo;
        demo.msg = B.NOME_AZIONE[u.azione] + ': tolte ' + u.tolte.length + (u.tolte.length === 1 ? ' carta.' : ' carte.') + (u.jollyTolto ? ' Il jolly è uscito.' : '');
        demo.ok = true; demo.st = n; demo.mod = nuovaMod(); demo.i++; render();
      }));
    } else {
      az.appendChild(bottone(ultimo ? 'Gioca' : 'Avanti', 'conferma', function () {
        if (ultimo) { fineDemo(); return; }
        demo.mod = nuovaMod(); demo.rif = null; demo.msg = ''; demo.ok = false; demo.i++; render();
      }));
    }
    app.appendChild(az);
  }
  function fineDemo() { vaiInizio(); }

  // ---------- disegno ----------
  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'inizio') schermoInizio();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
  }

  schermo = leggiVisto() ? 'inizio' : 'domanda';
  render();
}());
