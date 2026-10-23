/*
 * Syndicate — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Syndicate.apply.
 */
(function () {
  'use strict';
  var A = self.Syndicate, D = self.SyndicateDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'syndicate-visto';
  var TITOLO = 'Syndicate';    // titolo provvisorio: il titolo italiano verrà dopo, si cambia solo qui

  // I crediti stanno in un punto solo: qui. `gioco` è il nome dell'autore, non il titolo provvisorio.
  var CREDITI = {
    gioco: 'Syndicate', autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    fonti: 'Nato da un tentativo alla Splendor.'
  };

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // { carta, dove, sost, sacr }: la promozione scelta, non ancora confermata
  var scelta;        // [id]: i tre membri scelti alla preparazione, non ancora confermati
  var arrendi;       // true: si sta chiedendo «sei sicuro?»
  var msg, msgOk;
  var demo;          // { i, st, sel, scelta, fatto, msg, ok }

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
    document.title = TITOLO;
    var d = document.querySelector('meta[name=description]');
    if (d) d.setAttribute('content', TITOLO + ': un rompicapo di carte da giocare da soli. Di ' + CREDITI.autore + ', dalla collezione ' + CREDITI.collezione + '.');
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function nomeId(id) { return A.nomeCarta(A.daId(id)); }
  function articolato(c) { return (c.valore === 1 || c.valore === 8 ? 'L\'' : 'Il ') + (c.valore === 1 ? 'Asso di ' + { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' }[c.seme] : A.nomeCarta(c)); }
  var NOME_DOVE = { membri: 'Fra i membri', candidati: 'Fra i candidati' };

  // ---------- la promozione scelta ----------
  function vuotaSel() { return { carta: null, dove: null, sost: null, sacr: null }; }
  function gradoDi(s, id) {
    var r = null;
    A.GRADI.forEach(function (x) { if (s.gradi[x].membri.some(function (c) { return c.id === id; })) r = x; });
    return r;
  }
  function servePersona(s, q) {     // il grado sopra arriverebbe a 4 membri?
    var gr = q.carta ? gradoDi(s, q.carta) : null;
    return !!gr && gr > 1 && q.dove === 'membri' && s.gradi[gr - 1].membri.length >= A.MEMBRI;
  }
  function quattro(s, q) {
    var gr = gradoDi(s, q.carta);
    return s.gradi[gr - 1].membri.concat(s.gradi[gr].membri.filter(function (c) { return c.id === q.carta; }));
  }
  function mossaDa(s, q) {
    var gr = gradoDi(s, q.carta);
    return { t: 'promuovi', carta: q.carta, dove: gr > 1 ? q.dove : null, sostituto: q.sost, sacrifica: q.sacr };
  }
  // il tocco cambia la scelta; toccare di nuovo la stessa cosa la toglie
  function tocca(q, tipo, id) {
    if (tipo === 'membro') {
      if (q.carta === id) { q.carta = q.dove = q.sost = q.sacr = null; return; }
      q.carta = id; q.sacr = null;
    } else if (tipo === 'cand') q.sost = q.sost === id ? null : id;
    else if (tipo === 'dest') { q.dove = q.dove === id ? null : id; q.sacr = null; }
    else if (tipo === 'sacr') q.sacr = q.sacr === id ? null : id;
  }

  // ---------- carte e tavolo ----------
  function cartaEl(c, clic, marks, sugg) {
    var e = el(clic ? 'button' : 'div', 'carta ' + (A.eRossa(c) ? 'R' : 'N') + (marks && marks[c.id] ? ' ' + marks[c.id] : '') + (sugg && sugg[c.id] ? ' suggerita' : ''), A.sigla(c));
    e.setAttribute('aria-label', A.nomeCarta(c));
    if (clic) { e.type = 'button'; e.addEventListener('click', function () { clic(c); }); }
    return e;
  }
  /* o: { stato, marks:{id:classe}, sugg:{id:true}, cliccaMembro(c), cliccaCand(c) } */
  function tavolo(o) {
    var s = o.stato, box = el('div', 'gradi');
    A.GRADI.forEach(function (gr) {
      var col = el('div', 'grado');
      col.appendChild(el('div', 'gtit', 'Grado ' + gr));
      var zm = el('div', 'zona membri');
      zm.appendChild(el('small', null, 'Membri'));
      for (var k = 0; k < A.MEMBRI; k++) {
        var m = s.gradi[gr].membri[k];
        zm.appendChild(m ? cartaEl(m, o.cliccaMembro, o.marks, o.sugg) : el('div', 'vuoto'));
      }
      col.appendChild(zm);
      var zc = el('div', 'zona cand');
      zc.appendChild(el('small', null, 'Candidati'));
      s.gradi[gr].candidati.forEach(function (c) { zc.appendChild(cartaEl(c, o.cliccaCand, o.marks, o.sugg)); });
      col.appendChild(zc);
      box.appendChild(col);
    });
    return box;
  }
  // le 15 carte fra cui scegliere i tre membri
  function restoEl(o) {
    var box = el('div');
    box.appendChild(el('div', 'etichetta', 'Le ' + o.stato.resto.length + ' carte rimaste: scegline 3, diventano i membri del grado 5. Le altre escono dal gioco.'));
    var gr = el('div', 'resto');
    o.stato.resto.forEach(function (c) { gr.appendChild(cartaEl(c, o.cliccaResto, o.marks, o.sugg)); });
    box.appendChild(gr);
    return box;
  }
  // il piano della promozione: cosa hai scelto finora, dove va, il sostituto, e chi sacrificare
  /* o: { stato, sel, cliccaDest(d), cliccaSacr(id), sugg:{ 'dest:membri':true, id:true }, marcaSacr } */
  function pianoEl(o) {
    var s = o.stato, q = o.sel, box = el('div');
    var gr = q.carta ? gradoDi(s, q.carta) : null;
    var p = el('div', 'piano');
    function riga(nome, val) {
      var r = el('div', val ? '' : 'manca');
      r.appendChild(el('span', null, nome));
      r.appendChild(el('b', null, val || 'da scegliere'));
      p.appendChild(r);
    }
    riga('Promuovi', q.carta ? A.sigla(A.daId(q.carta)) + (gr ? ' (grado ' + gr + ')' : '') : '');
    if (gr !== 1) riga('Dove va', q.dove && gr ? NOME_DOVE[q.dove].toLowerCase() + ', grado ' + (gr - 1) : '');
    riga('Sostituto', q.sost ? A.sigla(A.daId(q.sost)) : '');
    if (servePersona(s, q)) riga('Sacrifichi', q.sacr ? A.sigla(A.daId(q.sacr)) : '');
    box.appendChild(p);

    if (gr && gr > 1) {
      box.appendChild(el('div', 'etichetta', 'Dove va il promosso, nel grado ' + (gr - 1)));
      var due = el('div', 'due');
      ['membri', 'candidati'].forEach(function (d) {
        var b = bottone(NOME_DOVE[d], (q.dove === d ? 'scelta' : '') + (o.sugg && o.sugg['dest:' + d] ? ' suggerita' : ''), function () { o.cliccaDest(d); });
        due.appendChild(b);
      });
      box.appendChild(due);
    }
    if (servePersona(s, q)) {
      box.appendChild(el('div', 'etichetta', 'Il grado ' + (gr - 1) + ' avrebbe 4 membri: tocca chi sacrificare'));
      var qu = el('div', 'quattro');
      var marks = {};
      if (q.sacr) marks[q.sacr] = 'sacr';
      quattro(s, q).forEach(function (c) { qu.appendChild(cartaEl(c, function () { o.cliccaSacr(c.id); }, marks, o.sugg)); });
      box.appendChild(qu);
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
  function marchi(q, cls) {
    var m = {};
    if (q.sost) m[q.sost] = cls || 'sost';
    if (q.sacr) m[q.sacr] = cls || 'sacr';
    if (q.carta) m[q.carta] = cls || 'scelta';
    return m;
  }

  // ---------- racconto di una mossa ----------
  function riassunto(u) {
    if (u.t === 'scegli') return 'I tre membri del grado 5 sono ' + u.membri.map(function (c) { return articolato(c).toLowerCase(); }).join(', ') + '. Le altre carte escono dal gioco.';
    var t = u.carta ? articolato(u.carta) : '';
    if (u.da === 1) return t + ' sale dal grado 1 e ' + articolato(u.sostituto).toLowerCase() + ' prende il suo posto.';
    t += ' sale al grado ' + (u.da - 1) + (u.dove === 'membri' ? ' fra i membri' : ' fra i candidati') + ' e ' + articolato(u.sostituto).toLowerCase() + ' prende il suo posto.';
    if (u.sacrificata) t += ' Sacrificato: ' + articolato(u.sacrificata).toLowerCase() + '.';
    return t;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Cinque gradi di una banda, tre membri per grado. Promuovi un agente alla volta, fino al grado più alto.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita() {
    g = A.nuova(semeIniziale());
    sel = vuotaSel(); scelta = []; arrendi = false; schermo = 'partita'; msgOk = false;
    msg = 'Scegli 3 delle carte rimaste, poi Conferma.';
    render(true);
  }
  function aggiorna() { msg = ''; msgOk = false; render(); }
  function toccaResto(c) {
    var i = scelta.indexOf(c.id);
    if (i >= 0) scelta.splice(i, 1);
    else { scelta.push(c.id); if (scelta.length > A.MEMBRI) scelta.shift(); }   // oltre tre, l'ultima scelta sostituisce la più vecchia
    aggiorna();
  }
  function toccaMembro(c) { tocca(sel, 'membro', c.id); aggiorna(); }
  function toccaCand(c) {
    if (!sel.carta) { msg = 'Prima tocca il membro da promuovere.'; msgOk = false; render(); return; }
    tocca(sel, 'cand', c.id); aggiorna();
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiPartita)]));
    var fine = !!g.fine, scelta5 = g.fase === 'scelta';
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Carte sacrificate: ' + g.sacrificate.length));
    app.appendChild(p);
    var marks = {};
    if (scelta5) scelta.forEach(function (id) { marks[id] = 'scelta'; });
    else marks = marchi(sel);
    app.appendChild(tavolo({
      stato: g, marks: fine || scelta5 ? {} : marks,
      cliccaMembro: fine || scelta5 ? null : toccaMembro,
      cliccaCand: fine || scelta5 ? null : toccaCand
    }));
    if (fine) { finale(); return; }
    if (scelta5) {
      app.appendChild(restoEl({ stato: g, marks: marks, cliccaResto: toccaResto }));
      app.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
      var az = el('div', 'azioni'), conf = bottone('Conferma', 'conferma', conferma);
      conf.disabled = !scelta.length;
      az.appendChild(conf); app.appendChild(az);
      return;
    }
    app.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    app.appendChild(pianoEl({
      stato: g, sel: sel,
      cliccaDest: function (d) { tocca(sel, 'dest', d); aggiorna(); },
      cliccaSacr: function (id) { tocca(sel, 'sacr', id); aggiorna(); }
    }));
    var az2 = el('div', 'azioni'), c2 = bottone('Conferma', 'conferma', conferma);
    c2.disabled = !sel.carta;
    az2.appendChild(c2); app.appendChild(az2);
    if (arrendi) {
      var pa = el('div', 'pannello');
      pa.appendChild(el('p', null, 'Ti arrendi? Perdi la partita.'));
      var a2 = el('div', 'azioni');
      a2.appendChild(bottone('Sì, mi arrendo', '', function () { g = A.apply(g, { t: 'arrenditi' }); arrendi = false; msg = ''; render(); }));
      a2.appendChild(bottone('No, continuo', 'conferma', function () { arrendi = false; render(); }));
      pa.appendChild(a2);
      app.appendChild(pa);
    } else app.appendChild(bottone('Mi arrendo', 'quieto', function () { arrendi = true; render(); }));
  }
  function conferma() {
    var m = g.fase === 'scelta' ? { t: 'scegli', carte: scelta.slice() } : mossaDa(g, sel);
    var n = A.apply(g, m);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la scelta resta, si può cambiare
    g = n; sel = vuotaSel(); scelta = []; msgOk = true;
    msg = riassunto(g.ultimo);
    render();
  }
  function finale() {
    var f = g.fine, p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, f.esito === 'vittoria' ? 'Hai vinto!' : 'Hai perso.'));
    if (f.esito === 'vittoria') {
      p.appendChild(el('p', 'punteggio', 'Punteggio: ' + f.punti));
      p.appendChild(el('p', 'dettaglio', 'Hai promosso un agente dal grado 1. Il punteggio sono le carte sacrificate: ' + f.punti + '. Meno sono, meglio è.'));
    } else {
      p.appendChild(el('p', 'dettaglio', (f.motivo === 'resa' ? 'Ti sei arreso.' : 'Non hai più nessuna mossa valida.') + ' Carte sacrificate: ' + f.punti + '.'));
    }
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiPartita));
    app.appendChild(p);
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; demo = { i: 0, st: D.nuova(), sel: vuotaSel(), scelta: [], fatto: false, msg: '', ok: false }; render(true); }
  function vaiPasso(i) {
    demo.i = i; demo.sel = vuotaSel(); demo.scelta = []; demo.fatto = false;
    if (D.passi[i].scena) demo.st = D.scena(D.passi[i].scena);
  }
  // le cose da toccare, nell'ordine: [tipo, id]; Conferma viene sempre dopo
  function daToccare(m) {
    if (m.t === 'scegli') return m.carte.map(function (id) { return ['resto', id]; });
    var v = [['membro', m.carta]];
    if (m.dove) v.push(['dest', m.dove]);
    v.push(['cand', m.sostituto]);
    if (m.sacrifica) v.push(['sacr', m.sacrifica]);
    return v;
  }
  function nomeTocco(t) { return t[0] === 'dest' ? NOME_DOVE[t[1]] : nomeId(t[1]); }
  function fatto(t) {
    if (t[0] === 'resto') return demo.scelta.indexOf(t[1]) >= 0;
    if (t[0] === 'membro') return demo.sel.carta === t[1];
    if (t[0] === 'dest') return demo.sel.dove === t[1];
    if (t[0] === 'cand') return demo.sel.sost === t[1];
    return demo.sel.sacr === t[1];
  }
  function mancanti(m) { return daToccare(m).filter(function (t) { return !fatto(t); }); }
  function frase(m) {
    var v = daToccare(m).map(nomeTocco).concat(['Conferma']);
    return 'Tocca ' + v.slice(0, -1).join(', poi ') + ', poi ' + v[v.length - 1] + '.';
  }
  function prossimaCosa(m) { var v = mancanti(m); return v.length ? 'tocca ' + nomeTocco(v[0]) : 'tocca Conferma'; }
  function demoSbagliato(m) { demo.msg = 'Non ancora: ' + prossimaCosa(m) + '.'; demo.ok = false; render(); }
  // un tocco della demo: va bene solo se è il prossimo da toccare (per i tre membri, uno qualunque dei tre)
  function demoTocco(m, tipo, id) {
    var v = mancanti(m);
    if (m.t === 'scegli') {
      var i = demo.scelta.indexOf(id);
      if (i >= 0) demo.scelta.splice(i, 1);
      else if (v.some(function (t) { return t[1] === id; })) demo.scelta.push(id);
      else { demoSbagliato(m); return; }
    } else {
      if (!v.length || v[0][0] !== tipo || v[0][1] !== id) { demoSbagliato(m); return; }
      tocca(demo.sel, tipo, id);
    }
    demo.msg = ''; demo.ok = false; render();
  }
  function demoAvanti() { vaiPasso(demo.i + 1); demo.msg = ''; demo.ok = false; render(true); }
  function demoConferma(passo) {
    var m = passo.mossa;
    if (mancanti(m).length) { demoSbagliato(m); return; }
    var n = A.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può. ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = riassunto(n.ultimo);
    vaiPasso(demo.i + 1);
    render(true);
  }
  function schermoDemo() {
    var passo = D.passi[demo.i], ultimo = demo.i === D.passi.length - 1, m = passo.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiPartita)]));
    var attivo = !!m && !demo.fatto, sugg = {}, marks = {}, pronto = false;
    if (attivo) {
      var v = mancanti(m);
      pronto = !v.length;
      if (v.length) {
        if (m.t === 'scegli') v.forEach(function (t) { sugg[t[1]] = true; });
        else sugg[v[0][0] === 'dest' ? 'dest:' + v[0][1] : v[0][1]] = true;
      }
      if (m.t === 'scegli') demo.scelta.forEach(function (id) { marks[id] = 'scelta'; });
      else marks = marchi(demo.sel);
    } else if (m && demo.fatto) {   // rifiuto fatto: le carte scelte restano segnate in rosso
      if (m.t === 'scegli') m.carte.forEach(function (id) { marks[id] = 'no'; });
      else marks = marchi({ carta: m.carta, sost: m.sostituto, sacr: m.sacrifica }, 'no');
    }
    msg = demo.msg; msgOk = demo.ok;
    var p = el('div', 'punti');
    p.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    p.appendChild(el('span', null, 'Carte sacrificate: ' + demo.st.sacrificate.length));
    app.appendChild(p);
    if (attivo) { var istr = el('div', 'istr'); istr.appendChild(el('b', 'istruzione', frase(m))); app.appendChild(istr); }
    app.appendChild(el('div', 'passo', passo.testo));
    var scegliPasso = demo.st.fase === 'scelta';
    app.appendChild(tavolo({
      stato: demo.st, marks: scegliPasso ? {} : marks, sugg: scegliPasso ? {} : sugg,
      cliccaMembro: attivo && !scegliPasso ? function (c) { demoTocco(m, 'membro', c.id); } : null,
      cliccaCand: attivo && !scegliPasso ? function (c) { demoTocco(m, 'cand', c.id); } : null
    }));
    if (scegliPasso) {
      app.appendChild(restoEl({ stato: demo.st, marks: marks, sugg: sugg,
        cliccaResto: attivo ? function (c) { demoTocco(m, 'resto', c.id); } : null }));
    }
    app.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));
    var q = demo.sel;
    // il piano si vede quando c'è un membro scelto (o il passo è una promozione già tentata)
    if (!scegliPasso && m && m.t === 'promuovi' && (q.carta || demo.fatto)) {
      var qq = demo.fatto ? { carta: m.carta, dove: m.dove, sost: m.sostituto, sacr: m.sacrifica } : q;
      app.appendChild(pianoEl({
        stato: demo.st, sel: qq, sugg: sugg,
        cliccaDest: attivo ? function (d) { demoTocco(m, 'dest', d); } : function () {},
        cliccaSacr: attivo ? function (id) { demoTocco(m, 'sacr', id); } : function () {}
      }));
    }
    var az = el('div', 'azioni');
    if (attivo) az.appendChild(bottone('Conferma', 'conferma' + (pronto ? ' suggerita' : ''), function () { demoConferma(passo); }));
    else if (ultimo) az.appendChild(bottone('Gioca', 'conferma', vaiPartita));
    else az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
    app.appendChild(az);
  }

  function render(inCima) {
    var y = window.pageYOffset;
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (schermo === 'demo') schermoDemo();
    else schermoPartita();
    window.scrollTo(0, inCima ? 0 : y);
  }

  crediti();
  if (leggiVisto()) vaiPartita(); else { schermo = 'domanda'; render(true); }
}());
