/*
 * The Emissary — la parte che parla col browser. Legge lo stato del motore
 * (engine.js) e lo mostra; non contiene regole. Cambia lo stato solo con Emissary.apply.
 * Come al tavolo: nessun suggerimento in partita (l'app non dice mai quale carta si può o conviene giocare);
 * si sceglie, si conferma, e se la mossa non vale il motore dice il perché e non tocca niente.
 */
(function () {
  'use strict';
  var E = self.Emissary, D = self.EmissaryDemo;
  var app = document.getElementById('app');
  var CHIAVE = 'emissary-visto';
  var TITOLO = 'The Emissary';      // titolo provvisorio: il titolo italiano verrà dopo, si cambia qui e in index.html

  // I crediti stanno in un punto solo: qui.
  var CREDITI = {
    gioco: 'The Emissary', autore: 'Wil Su', collezione: 'Isaludo',
    link: 'https://boardgamegeek.com/filepage/301674/isaludo-collection',
    fonti: 'Ispirato a Gongor Whist (Decktet) e a Oneonta Whist.'
  };
  var SIGLA = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var POTERE = { C: 'scarta le briscole', F: 'pesca per ogni fiori', P: 'scambia il sovrano', Q: 'pesca 2, scarta 2' };
  var ORDINE_FANTI = ['C', 'F', 'P', 'Q'];

  var schermo;       // 'domanda' | 'partita' | 'demo'
  var g;             // stato del motore
  var sel;           // null | {k:'regno', n} | {k:'carta', ids} | {k:'potere', pot:{fonte,seme,id}, con}  (scelto, non ancora confermato)
  var aperto;        // null | 'scarti'
  var msg, msgOk;
  var demo;          // { i, st, sel, fatto, msg, ok }

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
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function elenco(v) { return v.length < 2 ? v.join('') : v.slice(0, -1).join(', ') + ' e ' + v[v.length - 1]; }
  function nomi(carte) { return carte.map(E.nomeCarta); }
  function nomeFante(seme) { return 'Fante di ' + E.NOME_SEME[seme]; }
  function nomeId(id) { return E.nomeCarta(E.daId(id)); }
  function stato() { return schermo === 'demo' ? demo.st : g; }
  function alleato(c) { return c.valore === 13 ? 'alleato' : 'alleata'; }
  function tuo(c) { return c.valore === 13 ? 'tuo alleato' : 'tua alleata'; }
  function eRosso(seme) { return seme === 'C' || seme === 'Q'; }

  // ---------- le cose che si toccano: ogni cosa ha una chiave ----------
  //  k4 = il regno 4 (da visitare) · t7 = il regno 7 (da scambiare coi picche) · cQ8 = la carta Q8 della mano
  //  jC = il Fante di cuori · aP13 = l'alleato P13
  function chiaviSel() {
    if (!sel) return [];
    if (sel.k === 'regno') return ['k' + sel.n];
    if (sel.k === 'carta') return sel.ids.map(function (id) { return 'c' + id; });
    var v = [sel.pot.fonte === 'fante' ? 'j' + sel.pot.seme : 'a' + sel.pot.id];
    if (sel.con) v.push('t' + sel.con);
    return v;
  }
  function chiaviMossa(m) {
    if (m.t === 'regno') return ['k' + m.n];
    if (m.t === 'gioca') return ['c' + m.carta];
    if (m.t === 'scarta') return m.carte.map(function (id) { return 'c' + id; });
    if (m.t === 'apri') return [];
    var v = [m.t === 'fante' ? 'j' + m.seme : 'a' + m.id];
    if (m.con) v.push('t' + m.con);
    return v;
  }
  function nomeChiave(k) {
    var c = k[0], v = k.slice(1);
    if (c === 'k' || c === 't') return 'il regno ' + v;
    if (c === 'j') return 'il ' + nomeFante(v);
    return nomeId(v);
  }
  // la mossa che la scelta fatta fin qui vorrebbe compiere (o null se manca qualcosa)
  function mossaCorrente() {
    var st = stato();
    if (sel && sel.k === 'potere') {
      var p = sel.pot, m = p.fonte === 'fante' ? { t: 'fante', seme: p.seme } : { t: 'alleato', id: p.id };
      if (sel.con) m.con = sel.con;
      return m;
    }
    if (st.fase === 'scegli') return sel && sel.k === 'regno' ? { t: 'regno', n: sel.n } : null;
    if (st.fase === 'tra') return { t: 'apri' };
    if (st.fase === 'risposta') return sel && sel.k === 'carta' ? { t: 'gioca', carta: sel.ids[0] } : null;
    if (st.fase === 'scarta') return sel && sel.k === 'carta' && sel.ids.length === st.daScartare ? { t: 'scarta', carte: sel.ids.slice() } : null;
    return null;
  }
  function chiaveMossa(m) {
    var c = m.carte ? m.carte.slice().sort() : null;
    return JSON.stringify([m.t, m.n || 0, m.carta || '', c, m.seme || '', m.id || '', m.con || 0]);
  }

  // ---------- carte e pile ----------
  function faccia(c, tag, cls) {
    var e = el(tag || 'div', 'carta ' + (E.eRossa(c) ? 'R' : 'N') + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-label', E.nomeCarta(c));
    e.appendChild(el('span', 'v', SIGLA[c.valore] || String(c.valore)));
    e.appendChild(el('span', 's', E.SIMBOLO[c.seme]));
    return e;
  }
  function pila(nome, n, sotto, clic, acceso) {
    var b = el(clic ? 'button' : 'div', 'pila' + (acceso ? ' on' : ''));
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
    var gr = el('div', 'griglia'), presenti = {};
    carte.forEach(function (c) { presenti[c.id] = true; });
    E.SEMI.forEach(function (se) {
      gr.appendChild(el('span', 'seme' + (eRosso(se) ? ' R' : ''), E.SIMBOLO[se]));
      for (var v = 1; v <= 8; v++) gr.appendChild(el('span', 'c' + (presenti[se + v] ? ' si' : '') + (eRosso(se) ? ' R' : ''), SIGLA[v] || String(v)));
    });
    box.appendChild(gr);
    return box;
  }

  // ---------- il tavolo (partita e demo) ----------
  /* o: { stato, tocca(chiave)|null, sugg:{chiave:true} (solo nella demo), apriScarti, aperto } */
  function tavolo(o) {
    var s = o.stato, box = el('div'), fine = !!s.fine, k, cl;
    var scelte = {};
    chiaviSel().forEach(function (x) { scelte[x] = true; });
    var sugg = o.sugg || {};

    // gli otto regni
    box.appendChild(el('div', 'etichetta', 'I regni: il numero è quante vittorie servono'));
    var rg = el('div', 'regni');
    s.regni.forEach(function (r, i) {
      var n = i + 1, vinto = r.visitato && !r.sovrano, corr = s.corrente === i;
      var chiave = (s.fase === 'scegli' ? 'k' : 't') + n;
      var b = el('button', 'regno' + (corr ? ' corrente' : '') + (vinto ? ' vinto' : '') + (scelte[chiave] ? ' scelta' : '') + (sugg[chiave] ? ' suggerita' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'n', String(n)));
      var c = r.sovrano;
      if (!c && vinto) s.alleati.forEach(function (a) { if (a.regno === i) c = a.carta; });
      b.appendChild(c ? faccia(c, 'span', '') : el('span', 'vuoto'));
      b.appendChild(el('span', 'nota', vinto ? '✓' : (corr ? 'qui' : '')));
      b.setAttribute('aria-label', 'Regno ' + n + (c ? ', ' + E.nomeCarta(c) : '') + (vinto ? ', vinto' : '') + (corr ? ', regno attuale' : ''));
      if (o.tocca && !fine) b.addEventListener('click', function () { o.tocca(chiave); });
      else b.disabled = true;
      rg.appendChild(b);
    });
    box.appendChild(rg);

    // i conti: quanti dibattiti ho vinto, quanti me ne servono
    var ct = el('div', 'conti');
    if (s.corrente == null) {
      var big = el('div', 'grande-numero', String(s.alleati.length)); big.appendChild(el('small', null, ' / 8'));
      ct.appendChild(big);
      ct.appendChild(el('div', 'titolo', 'Regni vinti'));
      ct.appendChild(el('div', 'sotto', fine ? 'La partita è finita.' : 'Scegli il regno da visitare.'));
    } else {
      var n = s.corrente + 1, v = s.vittorie.length, br = E.briscola(s);
      var big2 = el('div', 'grande-numero' + (v === n ? ' esatto' : (v > n ? ' troppo' : '')), String(v));
      big2.appendChild(el('small', null, ' / ' + n));
      ct.appendChild(big2);
      var tit = el('div', 'titolo', 'Regno ' + n + ' · briscola ' + E.SIMBOLO[br] + ' ' + E.NOME_SEME[br]);
      ct.appendChild(tit);
      var dif = n - v;
      var testo = dif > 0 ? 'Te ne mancano ' + dif : (dif === 0 ? 'Ne hai esattamente ' + n : 'Ne hai ' + (-dif) + ' di troppo');
      ct.appendChild(el('div', 'sotto', testo + ' · in mano ' + conTesto(s.mano.length, 'carta', 'carte')));
      var pal = el('div', 'pallini');
      for (k = 0; k < Math.max(n, v); k++) pal.appendChild(el('i', k < v ? (k < n ? 'p' : 'extra') : ''));
      ct.appendChild(pal);
    }
    box.appendChild(ct);

    // la carta del sovrano e le pile
    var tv = el('div', 'tavolo');
    var sv = el('div', 'sovrano');
    sv.appendChild(s.parla ? faccia(s.parla, 'div', '') : el('div', 'vuoto'));
    sv.appendChild(el('small', null, s.parla ? 'il sovrano dice' : 'nessuna carta'));
    tv.appendChild(sv);
    tv.appendChild(pila('Mazzo', s.mazzo.length));
    tv.appendChild(pila('Scarti', s.scarti.length, 'tocca per guardare', o.apriScarti, o.aperto === 'scarti'));
    tv.appendChild(pila('Vittorie', s.vittorie.length, 'di questo regno'));
    box.appendChild(tv);
    if (o.aperto === 'scarti') box.appendChild(griglia(E.carteNegliScarti(s), 'Carte negli scarti, in ordine di seme e valore'));

    box.appendChild(el('div', 'msg' + (msgOk ? ' ok' : ''), msg));

    // la mano
    box.appendChild(el('div', 'etichetta', 'La tua mano (' + s.mano.length + ')'));
    var ma = el('div', 'mano');
    if (!s.mano.length) ma.appendChild(el('div', 'vuota', fine ? 'Mano vuota' : 'Mano vuota: nuove carte al prossimo regno'));
    E.ordina(s.mano).forEach(function (c) {
      var ch = 'c' + c.id;
      var b = faccia(c, o.tocca && !fine ? 'button' : 'div', (scelte[ch] ? 'scelta' : '') + (sugg[ch] ? ' suggerita' : ''));
      if (o.tocca && !fine) { b.type = 'button'; b.addEventListener('click', function () { o.tocca(ch); }); }
      ma.appendChild(b);
    });
    box.appendChild(ma);
    return box;
  }
  // i tasti di conferma e i poteri (stanno sotto la mano)
  function comandi(o) {
    var s = o.stato, box = el('div'), fine = !!s.fine;
    var sugg = o.sugg || {}, scelte = {};
    chiaviSel().forEach(function (x) { scelte[x] = true; });
    if (!fine) {
      var m = mossaCorrente(), az = el('div', 'azioni'), b;
      if (m && m.t === 'apri') b = bottone('Apri il dibattito', 'conferma' + (o.pronto ? ' suggerita' : ''), o.conferma);
      else {
        b = bottone('Conferma', 'conferma' + (o.pronto ? ' suggerita' : ''), o.conferma);
        if (m) b.appendChild(el('small', null, descrizione(m)));
        else b.disabled = true;
      }
      az.appendChild(b);
      box.appendChild(az);
    }
    box.appendChild(el('div', 'etichetta', 'Consiglieri: una volta per regno'));
    var po = el('div', 'poteri');
    ORDINE_FANTI.forEach(function (se) {
      var ch = 'j' + se, usato = s.fantiUsati.indexOf(se) >= 0;
      var b2 = el('button', 'potere' + (eRosso(se) ? ' rosso' : '') + (scelte[ch] ? ' scelta' : '') + (usato ? ' usato' : '') + (sugg[ch] ? ' suggerita' : ''));
      b2.type = 'button';
      b2.appendChild(el('span', null, 'Fante ' + E.SIMBOLO[se]));
      b2.appendChild(el('small', null, usato ? 'già usato' : POTERE[se]));
      b2.setAttribute('aria-label', nomeFante(se) + (usato ? ', già usato' : ''));
      if (o.tocca && !fine) b2.addEventListener('click', function () { o.tocca(ch); });
      else b2.disabled = true;
      po.appendChild(b2);
    });
    box.appendChild(po);
    box.appendChild(el('div', 'etichetta', 'Alleati: una volta sola in tutta la partita'));
    var al = el('div', 'poteri');
    if (!s.alleati.length) al.appendChild(el('div', 'nessuno', 'Nessun alleato ancora: si vince un regno con il numero esatto di dibattiti.'));
    s.alleati.forEach(function (a) {
      var ch = 'a' + a.carta.id;
      var b3 = el('button', 'potere' + (eRosso(a.carta.seme) ? ' rosso' : '') + (scelte[ch] ? ' scelta' : '') + (a.usato ? ' usato' : '') + (sugg[ch] ? ' suggerita' : ''));
      b3.type = 'button';
      b3.appendChild(el('span', null, (SIGLA[a.carta.valore]) + E.SIMBOLO[a.carta.seme]));
      b3.appendChild(el('small', null, a.usato ? 'già usato' : POTERE[a.carta.seme]));
      b3.setAttribute('aria-label', E.nomeCarta(a.carta) + ', ' + alleato(a.carta) + (a.usato ? ', già usato' : ''));
      if (o.tocca && !fine) b3.addEventListener('click', function () { o.tocca(ch); });
      else b3.disabled = true;
      al.appendChild(b3);
    });
    box.appendChild(al);
    return box;
  }
  function descrizione(m) {
    if (m.t === 'regno') return 'visita il regno ' + m.n;
    if (m.t === 'gioca') return 'gioca ' + nomeId(m.carta);
    if (m.t === 'scarta') return 'scarta ' + elenco(m.carte.map(nomeId));
    if (m.t === 'fante') return 'usa il ' + nomeFante(m.seme) + (m.con ? ', scambia col regno ' + m.con : '');
    return 'usa ' + nomeId(m.id) + (m.con ? ', scambia col regno ' + m.con : '');
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
  function racconto(u) {
    var t = '', c;
    if (u.t === 'regno') {
      t = 'Regno ' + u.n + ': ' + E.nomeCarta(u.sovrano) + ', la briscola è ' + E.NOME_SEME[u.sovrano.seme] + '. Servono ' + conTesto(u.n, 'vittoria', 'vittorie') + '.';
    } else if (u.t === 'apri') {
      if (!u.carta) t = 'Mazzo e scarti sono vuoti: il regno si chiude qui.';
      else t = 'Il sovrano dice ' + E.nomeCarta(u.carta) + '.' + (u.rimescolato ? ' Il mazzo era finito: hai rimescolato gli scarti.' : '');
    } else if (u.t === 'gioca') {
      t = 'Rispondi con ' + E.nomeCarta(u.giocata) + ' a ' + E.nomeCarta(u.parla) + ': ';
      if (u.vinto) t += 'vinci il dibattito' + (u.nelSeme ? ', carta più alta.' : ', hai risposto con una briscola.');
      else t += 'perdi il dibattito.';
    } else if (u.t === 'scarta') {
      t = 'Scarti ' + elenco(nomi(u.carte)) + '.';
    } else {
      var chi = u.t === 'fante' ? 'Il ' + nomeFante(u.seme) : E.nomeCarta(E.daId(u.id));
      if (u.seme === 'C') t = chi + ': ' + (u.scartate.length ? 'scarti ' + elenco(nomi(u.scartate)) + '.' : 'non hai briscole in mano.');
      else if (u.seme === 'F') t = chi + ': fiori in mano, ' + u.fiori + '. ' + (u.pescate ? 'Peschi ' + conTesto(u.pescate, 'carta', 'carte') + '.' : 'Non peschi niente.');
      else if (u.seme === 'P') t = u.nulla ? chi + ': è l\'ultimo regno, non fa niente.' : chi + ': il regno ' + u.scambio.da + ' ha ora ' + E.nomeCarta(u.scambio.nuovo) + ', briscola ' + E.NOME_SEME[u.scambio.nuovo.seme] + '.';
      else t = chi + ': peschi ' + conTesto(u.pescate, 'carta', 'carte') + ', ora scarta ' + (u.pescate < 2 ? 'quelle che devi' : 'due carte') + '.';
      if (u.rimescolato) t += ' Il mazzo era finito: hai rimescolato gli scarti.';
    }
    if (u.chiuso) {
      c = u.chiuso;
      t += ' ' + (c.forzata ? 'Mazzo e scarti finiti: ' : '') + (c.ok
        ? 'Regno ' + c.n + ' vinto: ' + E.nomeCarta(c.sovrano) + ' è ' + tuo(c.sovrano) + '. ' + (c.rimescolato ? 'Si rimescola tutto, i Fanti tornano, peschi 8 carte.' : '')
        : 'Regno ' + c.n + ' perso: servivano ' + conTesto(c.richiesti, 'vittoria', 'vittorie') + ' e ne hai ' + c.vinti + '.');
    }
    return t.trim();
  }

  // ---------- il tocco, uguale in partita e in demo ----------
  function tocca(ch) {
    var st = stato(), c = ch[0], v = ch.slice(1);
    if (schermo === 'demo' && !demoNelPercorso(ch)) { demoSbagliato(); return; }
    msg = ''; msgOk = false;
    if (schermo === 'demo') { demo.msg = ''; demo.ok = false; }
    if (c === 'k' || c === 't') {
      if (c === 'k') sel = sel && sel.k === 'regno' && sel.n === +v ? null : { k: 'regno', n: +v };
      else if (sel && sel.k === 'potere' && sel.pot.seme === 'P') sel.con = sel.con === +v ? null : +v;
      else msg = 'Per scambiare un sovrano scegli prima il Fante di picche o un alleato di picche.';
    } else if (c === 'c') {
      if (st.fase === 'risposta') sel = sel && sel.k === 'carta' && sel.ids[0] === v ? null : { k: 'carta', ids: [v] };
      else if (st.fase === 'scarta') {
        if (!sel || sel.k !== 'carta') sel = { k: 'carta', ids: [] };
        var i = sel.ids.indexOf(v);
        if (i >= 0) sel.ids.splice(i, 1); else { sel.ids.push(v); if (sel.ids.length > st.daScartare) sel.ids.shift(); }
        if (!sel.ids.length) sel = null;
      } else if (st.fase === 'scegli') msg = 'Prima scegli il regno da visitare.';
      else msg = 'Prima apri il dibattito, oppure usa un consigliere.';
    } else {
      var pot = c === 'j' ? { fonte: 'fante', seme: v } : { fonte: 'alleato', id: v, seme: E.daId(v).seme };
      var gia = sel && sel.k === 'potere' && sel.pot.fonte === pot.fonte && (pot.fonte === 'fante' ? sel.pot.seme === pot.seme : sel.pot.id === pot.id);
      sel = gia ? null : { k: 'potere', pot: pot, con: null };
    }
    render();
  }
  function conferma() {
    var m = mossaCorrente();
    if (!m) return;
    if (schermo === 'demo') { demoConferma(); return; }
    var n = E.apply(g, m);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }   // la scelta resta, si può cambiare
    g = n; sel = null; msgOk = true; msg = racconto(g.ultimo);
    render();
  }
  function schermoFine() {
    var f = g.fine, p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, f.esito === 'vittoria' ? 'Hai vinto: tutti e otto i regni!' : 'Hai perso.'));
    p.appendChild(el('p', 'punteggio', 'Punteggio: ' + f.punti));
    var t = 'Regni vinti: ' + f.regniVinti + '. Alleati non usati: ' + f.alleatiNonUsati + '.';
    if (f.esito === 'sconfitta') {
      t += ' Nel regno ' + f.regno + ' servivano ' + conTesto(f.richiesti, 'vittoria', 'vittorie') + ' e ne hai ottenute ' + f.vinti + '.';
      if (f.forzata) t += ' Mazzo e scarti erano finiti insieme.';
    }
    p.appendChild(el('p', 'dettaglio', t));
    p.appendChild(bottone('Nuova partita', 'grande primo', vaiPartita));
    return p;
  }

  // ---------- domanda ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, 'Visiti otto regni. In ognuno vinci esattamente il numero giusto di dibattiti, a carte, contro il sovrano.'));
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); vaiPartita(); }));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiDemo(); }));
    app.appendChild(p);
  }

  // ---------- partita ----------
  function vaiPartita() {
    g = E.nuova(semeIniziale());
    sel = null; aperto = null; schermo = 'partita'; msgOk = false;
    msg = 'Guarda la mano e scegli il regno da visitare, poi Conferma.';
    render();
  }
  function schermoPartita() {
    app.appendChild(intestazione([bottone('Come si gioca', 'mini', vaiDemo), bottone('Nuova partita', 'mini', vaiPartita)]));
    var o = { stato: g, tocca: g.fine ? null : tocca, aperto: aperto, conferma: conferma,
      apriScarti: function () { aperto = aperto === 'scarti' ? null : 'scarti'; render(); } };
    app.appendChild(tavolo(o));
    if (g.fine) app.appendChild(schermoFine());
    app.appendChild(comandi(o));
  }

  // ---------- demo (giocabile: ogni passo con una mossa la fa il giocatore) ----------
  function vaiDemo() { schermo = 'demo'; aperto = null; demo = { i: 0, st: D.nuova(), fatto: false, msg: '', ok: false }; sel = null; render(); }
  function vaiPasso(i) {
    demo.i = i; sel = null; demo.fatto = false;
    if (D.passi[i].scena) demo.st = D.scena(D.passi[i].scena);
  }
  function passo() { return D.passi[demo.i]; }
  function nomeConferma(m) { return m.t === 'apri' ? 'Apri il dibattito' : 'Conferma'; }
  // le cose da toccare, nell'ordine, e Conferma in fondo
  function daToccare(m) { return chiaviMossa(m).map(nomeChiave).concat([nomeConferma(m)]); }
  function frase(m) { var v = daToccare(m); return v.length === 1 ? 'Tocca ' + v[0] + '.' : 'Tocca ' + v.slice(0, -1).join(', poi ') + ', poi ' + v[v.length - 1] + '.'; }
  function demoNelPercorso(ch) {
    var p = passo();
    return !!p.mossa && !demo.fatto && chiaviMossa(p.mossa).indexOf(ch) >= 0;
  }
  // la prossima cosa che manca da toccare (per dire "Non ancora: ...")
  function prossimaCosa() {
    var p = passo(), m = p.mossa;
    if (!m) return 'tocca Avanti';
    var fatte = chiaviSel(), mancanti = chiaviMossa(m).filter(function (k) { return fatte.indexOf(k) < 0; });
    if (mancanti.length) return 'tocca ' + nomeChiave(mancanti[0]);
    return 'tocca ' + nomeConferma(m);
  }
  function demoSbagliato() { demo.msg = 'Non ancora: ' + prossimaCosa() + '.'; demo.ok = false; msg = demo.msg; msgOk = false; render(); }
  function demoAvanti() { vaiPasso(demo.i + 1); demo.msg = ''; demo.ok = false; render(); }
  function demoConferma() {
    var m = passo().mossa, mc = mossaCorrente();
    if (!m || !mc || chiaveMossa(mc) !== chiaveMossa(m)) { demoSbagliato(); return; }
    var n = E.apply(demo.st, m);
    demo.fatto = true;
    if (n.rifiuto) { demo.msg = 'Non si può. ' + n.rifiuto; demo.ok = false; render(); return; }
    demo.st = n; demo.ok = true; demo.msg = racconto(n.ultimo);
    vaiPasso(demo.i + 1);
    render();
  }
  function schermoDemo() {
    var p = passo(), ultimo = demo.i === D.passi.length - 1, m = p.mossa;
    app.appendChild(intestazione([bottone('Salta', 'mini', vaiPartita)]));
    var attivo = !!m && !demo.fatto, sugg = {}, pronto = false;
    if (attivo) {
      var fatte = chiaviSel();
      chiaviMossa(m).forEach(function (k) { if (fatte.indexOf(k) < 0) sugg[k] = true; });
      var mc = mossaCorrente();
      pronto = !!mc && chiaveMossa(mc) === chiaveMossa(m);
    }
    msg = demo.msg; msgOk = demo.ok;
    var pu = el('div', 'punti');
    pu.appendChild(el('span', null, 'Demo: passo ' + (demo.i + 1) + ' di ' + D.passi.length));
    app.appendChild(pu);
    var box = el('div', 'passo');
    if (attivo) box.appendChild(el('b', 'istruzione', frase(m)));
    box.appendChild(document.createTextNode(p.testo));
    app.appendChild(box);
    var o = { stato: demo.st, tocca: attivo ? tocca : null, sugg: sugg, aperto: null, pronto: pronto, conferma: conferma };
    if (!attivo) {   // fuori dai passi con una mossa la scelta non c'è: si mostra il tavolo e basta
      sel = null;
    }
    app.appendChild(tavolo(o));
    var cm = comandi(o);
    // nella demo, il tasto di conferma sta sempre là ma quando il passo non ha mosse lo sostituisce Avanti / Gioca
    var az = cm.querySelector('.azioni');
    if (!attivo) {
      if (az) az.parentNode.removeChild(az);
      az = el('div', 'azioni');
      if (ultimo) az.appendChild(bottone('Gioca', 'conferma', vaiPartita));
      else az.appendChild(bottone('Avanti', 'conferma', demoAvanti));
      cm.insertBefore(az, cm.firstChild);
    }
    app.appendChild(cm);
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
