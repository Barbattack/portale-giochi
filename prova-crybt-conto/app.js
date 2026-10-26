// CRYBT — prova del conto: l'interfaccia. Il motore è in engine.js.
(function () {
  'use strict';
  var C = window.Conto, app = document.getElementById('app');
  var SEMI = ['♠', '♥', '♦', '♣'], ROSSI = [false, true, true, false];
  var NOMI_R = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var PASSO_MS = 1100;
  var st = {};

  // «Come si conta»: schermata di lettura sopra la mano, si chiude con un tocco ovunque. Testo provvisorio (da rivedere con Penna).
  var GUIDA = [
    ['Quanto valgono le carte', 'le figure (J, Q, K) valgono 10, l’Asso 1, le altre il loro numero. Serve solo per i quindici.'],
    ['Quindici — 2 punti', 'ogni gruppo di carte che sommate fanno 15. Ogni gruppo diverso conta a parte: con 7♥, 7♣ e 8♣, «7♥ + 8♣» e «7♣ + 8♣» sono due quindici.'],
    ['Coppia — 2 punti', 'due carte dello stesso valore. Tre uguali fanno tre coppie (6 punti), quattro uguali sei coppie (12).'],
    ['Scala — 1 punto per carta', 'tre o più valori di fila, di qualsiasi seme. L’Asso sta solo sotto il 2. Se nella scala c’è una carta doppia, le scale sono due: 6-7-7-8 sono due scale da tre, 6 punti.'],
    ['Colore — 1 punto per carta', 'quattro o cinque carte dello stesso seme.'],
    ['Esempio', '2♣ 6♥ 7♥ 7♣ 8♣. Quindici: 7♥+8♣, 7♣+8♣, 2+6+7♥, 2+6+7♣: quattro quindici, 8 punti. Coppia di 7: 2. Scale 6-7♥-8 e 6-7♣-8: 6. Totale 16.'],
    ['Come si dichiara', 'tocchi le carte di una combinazione, poi premi cos’è. Quello che dimentichi è perso, e il mostro prende +1 per ogni combinazione dimenticata.']
  ];
  var guida = el('div', 'guida'); guida.id = 'guida'; guida.hidden = true;
  var gi = el('div', 'guida-dentro'); gi.appendChild(el('h2', '', 'Come si conta'));
  GUIDA.forEach(function (g) { var p = el('p', ''); p.appendChild(el('b', '', g[0] + ': ')); p.appendChild(document.createTextNode(g[1])); gi.appendChild(p); });
  gi.appendChild(el('div', 'chiudi', 'Tocca per chiudere'));
  guida.appendChild(gi); guida.addEventListener('click', function () { guida.hidden = true; }); document.body.appendChild(guida);

  function seme0() { var h = parseInt((location.hash || '').replace('#', ''), 10); return isNaN(h) ? null : h; }
  function nuovaMano(seme) {
    if (seme == null) seme = Math.floor(Math.random() * 900000) + 100000;
    var d = C.dai(seme);
    st = { seme: seme, mano: d.mano, eroe: d.eroeIdx, mostro: d.mostro, forza: d.forza, sel: [], dich: [], msg: { t: 'Tocca le carte di una combinazione, poi scegli quale è.', k: 'neutro' },
      fase: 'conto', mancate: [], visti: 0, evid: [], timer: null };
    try { history.replaceState(null, '', '#' + seme); } catch (e) { /* file:// in alcuni browser */ }
    disegna();
  }

  function el(tag, cls, testo) { var e = document.createElement(tag); if (cls) e.className = cls; if (testo != null) e.textContent = testo; return e; }
  function carta(c, opz) {
    var b = el('button', 'carta' + (ROSSI[c.s] ? ' rosso' : '') + (opz.sel ? ' scelta' : '') + (opz.evid ? ' evid' : ''));
    b.type = 'button'; b.setAttribute('aria-label', NOMI_R[c.r] + ' di ' + ['picche', 'cuori', 'quadri', 'fiori'][c.s]);
    var a = el('span', 'ang'); a.appendChild(document.createTextNode(NOMI_R[c.r])); a.appendChild(el('i', '', SEMI[c.s])); b.appendChild(a);
    b.appendChild(el('span', 'grande', SEMI[c.s]));
    if (opz.fermo) b.disabled = true;
    return b;
  }

  function tocca(i) {
    if (st.fase !== 'conto') return;
    var p = st.sel.indexOf(i);
    if (p >= 0) st.sel.splice(p, 1); else st.sel.push(i);
    st.msg = { t: '', k: 'neutro' }; disegna();
  }
  function dichiara(tipo) {
    if (st.fase !== 'conto') return;
    var r = C.dichiara(st.mano, tipo, st.sel, st.dich);
    if (!r.ok) { st.msg = { t: r.perche, k: '' }; disegna(); return; }
    st.dich.push(r.comb); st.sel = []; st.msg = { t: r.formula + '.', k: 'ok' }; st.ultima = r.formula; disegna();
  }
  function hoContato() {
    if (st.fase !== 'conto') return;
    st.sel = []; st.mancate = C.sfuggite(st.mano, st.dich); st.visti = 0; st.evid = []; st.fase = 'rivela';
    st.msg = { t: st.mancate.length ? 'Vediamo cosa è sfuggito…' : 'Non è sfuggito niente.', k: 'neutro' };
    disegna();
    if (!st.mancate.length) { st.fase = 'fine'; disegna(); return; }
    st.timer = setInterval(function () {
      if (st.visti < st.mancate.length) { st.evid = st.mancate[st.visti].idx; st.visti++; st.msg = { t: etichetta(st.mancate[st.visti - 1]) + ': +1 al mostro.', k: '' }; disegna(); }
      else { clearInterval(st.timer); st.timer = null; st.fase = 'fine'; st.evid = []; st.msg = { t: '', k: 'neutro' }; disegna(); }
    }, PASSO_MS);
  }
  function etichetta(c) { return C.NOMI[c.tipo] + ' ' + C.parola(c.punti); }

  function disegna() {
    app.innerHTML = '';
    var h = el('h1', '', 'CRYBT'); h.appendChild(el('small', '', 'mano ' + st.seme));
    var cc = el('button', 'come', 'Come si conta'); cc.type = 'button'; cc.id = 'come-si-conta'; cc.addEventListener('click', function () { guida.hidden = false; }); h.appendChild(cc); app.appendChild(h);

    var m = el('div', 'mostro'); var cm = carta(st.mostro, { fermo: true }); m.appendChild(cm);
    var t = el('div', 'testo'); t.appendChild(document.createTextNode('Mostro: carta ' + C.valore(st.mostro) + ' + 1')); var fv = st.forza + (st.fase === 'conto' ? 0 : (st.fase === 'fine' ? st.mancate.length : st.visti)); t.appendChild(el('b', '', 'Forza ' + fv + (fv !== st.forza ? ' (era ' + st.forza + ')' : ''))); m.appendChild(t);
    app.appendChild(m);

    var ma = el('div', 'mano'), et = el('div', 'etichette');
    st.mano.forEach(function (c, i) {
      var b = carta(c, { sel: st.sel.indexOf(i) >= 0, evid: st.evid.indexOf(i) >= 0, fermo: st.fase !== 'conto' });
      b.setAttribute('data-i', i); b.addEventListener('click', function () { tocca(i); }); ma.appendChild(b);
      et.appendChild(el('span', 'eroe', i === st.eroe ? 'EROE' : ''));
    });
    app.appendChild(ma); app.appendChild(et);

    if (st.fase === 'conto') {
      var ti = el('div', 'tipi');
      C.TIPI.forEach(function (tp) { var b = el('button', '', C.NOMI[tp]); b.type = 'button'; b.setAttribute('data-tipo', tp); b.addEventListener('click', function () { dichiara(tp); }); ti.appendChild(b); });
      app.appendChild(ti);
    }
    app.appendChild(el('div', 'msg ' + st.msg.k, st.msg.t));

    var co = el('div', 'conto'), ri = el('div', 'riga'); ri.appendChild(el('span', '', 'IL TUO CONTO')); ri.appendChild(el('b', '', String(C.totale(st.dich)))); co.appendChild(ri);
    var fi = el('div', 'fiches'), run = 0;
    st.dich.forEach(function (d) { run += d.punti; fi.appendChild(el('span', 'fiche', C.NOMI[d.tipo] + ' ' + C.parola(run))); });
    var vistiLista = st.fase === 'conto' ? [] : st.mancate.slice(0, st.fase === 'fine' ? st.mancate.length : st.visti);
    if (vistiLista.length) fi.appendChild(el('span', 'prende', 'AL MOSTRO'));
    vistiLista.forEach(function (d) {
      var f = el(st.fase === 'fine' ? 'button' : 'span', 'fiche mostro-prende', etichetta(d) + ' · +1 al mostro');
      if (st.fase === 'fine') { f.type = 'button'; f.addEventListener('click', function () { st.evid = d.idx; disegna(); }); }
      fi.appendChild(f);
    });
    co.appendChild(fi); app.appendChild(co);

    if (st.fase === 'conto') {
      var g = el('button', 'grosso', 'Ho contato'); g.type = 'button'; g.id = 'ho-contato'; g.addEventListener('click', hoContato); app.appendChild(g);
    } else if (st.fase === 'fine') {
      var e = C.esito(st.forza, st.dich, st.mancate), box = el('div', 'esito ' + (e.vinto ? 'vinto' : 'perso'));
      box.appendChild(el('b', '', e.vinto ? 'Mostro sconfitto' : 'Subisci ' + e.danni + (e.danni === 1 ? ' danno' : ' danni')));
      box.appendChild(document.createTextNode('Hai dichiarato ' + e.tuoi + ' punti' + (e.sfuggite ? '; ' + (e.sfuggite === 1 ? 'è sfuggita una combinazione' : 'sono sfuggite ' + e.sfuggite + ' combinazioni') + ' (' + e.persi + ' punti persi): il mostro ora vale ' + e.bersaglio + '.' : '; la forza era ' + e.bersaglio + '.')));
      var tot = C.totale(C.combinazioni(st.mano));
      box.appendChild(el('small', '', 'La mano ne valeva ' + tot + '.'));
      app.appendChild(box);
      var cp = el('div', 'coppia-tasti');
      var n = el('button', 'grosso', 'Mano nuova'); n.type = 'button'; n.id = 'mano-nuova'; n.addEventListener('click', function () { nuovaMano(null); });
      var s = el('button', 'grosso sec', 'Stessa mano'); s.type = 'button'; s.id = 'stessa-mano'; s.addEventListener('click', function () { nuovaMano(st.seme); });
      cp.appendChild(n); cp.appendChild(s); app.appendChild(cp);
    } else {
      var n2 = el('button', 'grosso sec', 'Mano nuova'); n2.type = 'button'; n2.addEventListener('click', function () { if (st.timer) clearInterval(st.timer); nuovaMano(null); }); app.appendChild(n2);
    }
  }

  window.addEventListener('hashchange', function () { var s = seme0(); if (s != null && s !== st.seme) { if (st.timer) clearInterval(st.timer); nuovaMano(s); } });
  nuovaMano(seme0());
})();
