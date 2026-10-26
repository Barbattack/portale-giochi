/*
 * SOLATRO — IL TAVOLO: lo strato del prototipo che disegna lo stato del motore (Chiara, secondo giro, 25/10/2026).
 * Script di SOLO PROTOTIPO. Legge engine.js del gioco vero in sola lettura e non contiene regole: cambia lo stato solo con Solatro.apply.
 * Prende il posto di app.js dello scheletro: Erbottega porta in app.js questo markup e le classi, e solatro.css così com'è.
 * Rispetto al primo giro (2026-10-25-solatro): (1) nel negozio toccare un bonus lo SEGNA (un altro tocco lo toglie) e un tasto unico
 * in fondo dice cosa paghi e cosa perdi, compra tutto e chiude il negozio; (2) le animazioni di giocata e scarto (anima.js);
 * (3) i valori delle carte nel carattere a pixel (solo CSS).
 */
(function () {
  'use strict';
  var S = self.Solatro, C = self.SolatroCopione, T = self.SolatroTutorial || null, A = self.Anima || null;
  var app = document.getElementById('app');
  var CHIAVE = 'solatro-record', VISTO = 'solatro-visto';

  // I crediti stanno in un punto solo: qui.
  var CREDITI = { gioco: 'Solatro', autore: 'TechDweeb', itch: 'https://techdweeb.itch.io/solatro', youtube: 'https://www.youtube.com/@TechDweeb' };
  window.CopertinaRiga = 'Otto carte, combinazioni di poker, un traguardo che sale a ogni round. Un solitario di TechDweeb.';

  var schermo;         // 'domanda' | 'gioco' (dentro il gioco decide la fase del motore)
  var g, sel, msg, msgOk, bonusAperto, ricomincia, recordFine, tutorial;
  var cassaMostra = null;   // durante l'animazione della giocata la cassa mostra ancora i punti di prima
  var manoPrima = [], pesca = '';   // le carte in mano prima dell'ultima mossa (per far entrare le nuove) e il tipo di pescata

  function el(tag, cls, testo) { var e = document.createElement(tag); if (cls) e.className = cls; if (testo != null) e.textContent = testo; return e; }
  function bottone(testo, cls, fn, sotto, aria) {
    var b = el('button', cls, testo); b.type = 'button';
    if (sotto) { b.appendChild(el('small', null, sotto)); }
    if (aria) b.setAttribute('aria-label', aria);
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function conTesto(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function leggiRecord() { try { var v = parseInt(localStorage.getItem(CHIAVE), 10); return v > 0 ? v : 0; } catch (e) { return 0; } }
  function scriviRecord(n) { try { localStorage.setItem(CHIAVE, String(n)); } catch (e) { /* niente da fare */ } }
  function scriviVisto() { try { localStorage.setItem(VISTO, '1'); } catch (e) { /* idem */ } }
  function semeIniziale() { var m = /[?&]seme=([^&]+)/.exec(location.search); return m ? decodeURIComponent(m[1]) : Math.random().toString(36).slice(2, 8); }
  function crediti() {
    var f = document.getElementById('crediti'); f.textContent = '';
    var riga = el('p');
    riga.appendChild(document.createTextNode(CREDITI.gioco + ' di '));
    var a = el('a', null, CREDITI.autore); a.href = CREDITI.itch; a.rel = 'noopener'; riga.appendChild(a);
    riga.appendChild(document.createTextNode(' · '));
    var i = el('a', null, 'itch.io'); i.href = CREDITI.itch; i.rel = 'noopener'; riga.appendChild(i);
    riga.appendChild(document.createTextNode(' · '));
    var y = el('a', null, 'YouTube'); y.href = CREDITI.youtube; y.rel = 'noopener'; riga.appendChild(y);
    f.appendChild(riga);
    f.appendChild(el('p', null, 'Ispirato a Balatro, senza alcun legame ufficiale.'));
  }

  // ---------- la testa ----------
  var MARCHIO = '<svg class="marchio" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"/><text x="7" y="12" font-size="9" text-anchor="middle" fill="currentColor">♠</text><text x="19" y="12" font-size="9" text-anchor="middle" fill="currentColor">♥</text><text x="7" y="23" font-size="9" text-anchor="middle" fill="currentColor">♣</text><text x="19" y="23" font-size="9" text-anchor="middle" fill="currentColor">♦</text></svg>';
  function titolo() {
    var h = el('h1'); h.setAttribute('aria-label', 'Solatro');
    h.appendChild(el('span', null, 'SOL'));
    var a = el('span', 'a-carta', '♠'); a.setAttribute('aria-hidden', 'true'); h.appendChild(a);
    h.appendChild(el('span', null, 'TRO'));
    return h;
  }
  function intestazione(extra) {
    var top = el('div', 'top');
    if (!(schermo === 'domanda')) { var mk = el('span'); mk.innerHTML = MARCHIO; top.appendChild(mk.firstChild); }
    top.appendChild(titolo());
    var dx = el('div', 'dx');
    (extra || []).forEach(function (b) { dx.appendChild(b); });
    top.appendChild(dx);
    return top;
  }
  function tastiTesta() {
    var t = [bottone('Come si gioca', 'mini', apriRegole)];
    if (tutorial && T && T.attivo()) t.push(bottone('Salta', 'mini', function () { T.ferma(); tutorial = false; render(); }, null, 'Salta'));
    else t.push(bottone(ricomincia ? 'Tocca ancora: lasci la partita' : 'Nuova partita', 'mini' + (ricomincia ? ' attesa' : ''), function () {
      if (!ricomincia) { ricomincia = true; render(); return; }
      schermo = 'domanda'; render();
    }));
    return t;
  }

  // ---------- la domanda (copertina.js la veste da copertina) ----------
  function schermoDomanda() {
    app.appendChild(intestazione());
    var p = el('div', 'pannello');
    p.appendChild(el('h2', null, 'Sai già giocare?'));
    p.appendChild(el('p', null, window.CopertinaRiga));
    var r = leggiRecord();
    p.appendChild(bottone('Sì, so giocare', 'grande primo', function () { scriviVisto(); comincia(semeIniziale(), null); }, r ? 'il tuo record: round ' + r : null));
    p.appendChild(bottone('No, fammi vedere', 'grande', function () { scriviVisto(); vaiTutorial(); }));
    app.appendChild(p);
  }
  function comincia(seme, opzioni) {
    g = S.nuova(seme, opzioni);
    sel = { carte: [], jolly: false, bonus: [] }; bonusAperto = null; ricomincia = false; recordFine = null; tutorial = false;
    cassaMostra = null; manoPrima = []; pesca = '';
    schermo = 'gioco'; msg = messaggioRound(g.ultimo, g); msgOk = !!msg; render();
  }
  function vaiTutorial() {
    if (!T || !C) { comincia(semeIniziale(), null); return; }
    comincia(C.partita.seme, { inTesta: C.partita.inTesta });
    tutorial = true; msg = ''; T.inizia(); render();
  }

  // ---------- messaggi ----------
  function eventiJolly(ev) {
    var t = '';
    (ev || []).forEach(function (e) {
      if (e === 'jolly-da-parte') t += ' Hai pescato un jolly: va da parte.';
      else if (e === 'jolly-persi') t += ' Un secondo jolly: li hai persi tutti e due.';
    });
    return t.trim();
  }
  function messaggioRound(u, st) { return eventiJolly(u && u.eventi); }
  function riassuntoGiocata(u) {
    var t = u.nome + ': ' + conTesto(u.punti, 'punto', 'punti') + (u.usoJolly && u.doppio ? ', col jolly e col Doppio punteggio' : u.usoJolly ? ', col jolly' : u.doppio ? ', col Doppio punteggio' : '') + '.';
    return (t + ' ' + eventiJolly(u.eventi)).trim();
  }
  var EFFETTO_UI = {
    'carta-extra': { prima: 'una carta in più in mano per il resto del round: arriva alla prossima pescata.', dopo: function (st) { return 'Carta extra: dalla prossima pescata la mano sale a ' + st.manoMax + ' carte.'; } },
    'scarto-extra': { prima: 'uno scarto in più in questo round.', dopo: function (st) { return 'Scarto extra: scarti rimasti ' + st.scartiRimasti + '.'; } },
    'punti-in-tasca': { prima: '25 punti in più al totale di questo round.', dopo: function (st) { return 'Punti in tasca: sei a ' + st.punti + ' punti.'; } },
    'giocata-extra': { prima: 'una giocata in più in questo round.', dopo: function (st) { return 'Giocata extra: giocate rimaste ' + st.giocate + '.'; } },
    'doppio': { prima: 'raddoppia i punti della prossima giocata.', dopo: function () { return 'Doppio punteggio: la prossima giocata vale doppio.'; } },
    'scudo': { prima: 'scatta da solo: se manchi un traguardo passi lo stesso.', dopo: null }
  };

  // ---------- il tutorial: chiede il permesso prima di ogni gesto ----------
  function permesso(az) { if (!tutorial || !T || !T.attivo()) return true; return T.permesso(az, contesto()); }
  function fatto(az) { if (tutorial && T && T.attivo()) T.fatto(az, contesto()); }
  function contesto() { return { g: g, sel: sel, bonusAperto: bonusAperto, lettura: g && g.fase === 'round' ? lettura() : null, render: render }; }

  // ---------- il round ----------
  function lettura() { return S.leggiGiocata(g, sel.carte, sel.jolly); }
  function togliSelezione() { sel.carte = []; sel.jolly = false; }
  function tocca(id) {
    var ok = permesso({ tipo: 'carta', id: id }); if (ok !== true) return;
    msg = ''; msgOk = false; bonusAperto = null;
    var i = sel.carte.indexOf(id);
    if (i >= 0) { sel.carte.splice(i, 1); fatto({ tipo: 'carta', id: id }); render(); return; }
    var prova = S.leggiGiocata(g, sel.carte.concat([id]), sel.jolly);
    if (!prova.ok && !prova.vuota) { msg = prova.perche; render(); return; }       // il perché lo dice il motore
    sel.carte.push(id); fatto({ tipo: 'carta', id: id }); render();
  }
  function toccaJolly() {
    if (permesso({ tipo: 'jolly' }) !== true) return;
    msg = ''; msgOk = false; bonusAperto = null;
    if (sel.jolly) { sel.jolly = false; render(); return; }
    var prova = S.leggiGiocata(g, sel.carte, true);
    if (!prova.ok && !prova.vuota) { msg = prova.perche; render(); return; }
    sel.jolly = true; render();
  }
  function esegui(mossa) {
    var n = S.apply(g, mossa);
    if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return n; }
    g = n; return n;
  }
  // la cassa torna ai numeri veri (dopo l'animazione, o subito): ritocca il DOM senza ridisegnare
  function aggiornaCassa() {
    cassaMostra = null;
    var c = app.querySelector('.banco .cassa'); if (!c || g.fase !== 'round') return;
    var nuovo = cassa(g.punti, g.traguardo);
    // la barra si vede salire: il nodo nuovo parte dalla larghezza di prima e poi va a quella vera (transizione in solatro.css, 600 ms × --vel)
    var vecchia = c.querySelector('.metro i'), riempi = nuovo.querySelector('.metro i'), larghezza = riempi.style.width;
    riempi.style.width = vecchia ? vecchia.style.width : '0%';
    c.parentNode.replaceChild(nuovo, c);
    void nuovo.offsetWidth;
    riempi.style.width = larghezza;
  }
  function giocaScelta() {
    var ok = permesso({ tipo: 'gioca' });
    if (ok !== true) { if (typeof ok === 'string') { msg = ok; msgOk = false; render(); } return; }
    var prima = A ? A.prima(app, sel.carte) : null, puntiPrima = g.punti, mano0 = g.mano.map(function (c) { return c.id; });
    var n = esegui({ t: 'gioca', carte: sel.carte.slice(), jolly: sel.jolly });
    if (n.rifiuto) return;
    togliSelezione(); bonusAperto = null; msgOk = true; msg = riassuntoGiocata(g.ultimo);
    if (g.ultimo.chiusura && g.fase === 'fine') chiudiPartita();
    if (g.fase !== 'round') msg = '';
    var u = g.ultimo;
    if (g.fase === 'round' && A && !A.ridotto) { cassaMostra = { punti: puntiPrima }; manoPrima = mano0; pesca = 'dopo-giocata'; A.prenota(); }
    fatto({ tipo: 'gioca' }); render(); pesca = ''; manoPrima = [];
    if (A) { if (g.fase === 'round') A.giocata(app, prima, { nome: u.nome, punti: u.punti, aggiornaCassa: aggiornaCassa }); else A.annulla(); }
  }
  function scartaScelta() {
    var ok = permesso({ tipo: 'scarta' });
    if (ok !== true) { if (typeof ok === 'string') { msg = ok; msgOk = false; render(); } return; }
    var prima = A ? A.prima(app, sel.carte) : null, mano0 = g.mano.map(function (c) { return c.id; });
    var n = esegui({ t: 'scarta', carte: sel.carte.slice() });
    if (n.rifiuto) return;
    var k = g.ultimo.carte.length, entrate = g.mano.length - (mano0.length - k);
    togliSelezione(); bonusAperto = null; msgOk = true;
    msg = ('Scartate ' + k + ', pescate ' + entrate + '. ' + eventiJolly(g.ultimo.eventi)).trim();
    if (A && !A.ridotto) { manoPrima = mano0; pesca = 'dopo-scarto'; A.prenota(); }
    fatto({ tipo: 'scarta' }); render(); pesca = ''; manoPrima = [];
    if (A) A.scarto(app, prima);
  }
  function apriBonus(id) {
    if (permesso({ tipo: 'apri', bonus: id }) !== true) return;
    bonusAperto = bonusAperto === id ? null : id; msg = ''; fatto({ tipo: 'apri', bonus: id }); render();
  }
  function usaBonus(id) {
    if (permesso({ tipo: 'usa', bonus: id }) !== true) return;
    var n = esegui({ t: 'usa', bonus: id });
    if (n.rifiuto) return;
    bonusAperto = null; msgOk = true; msg = EFFETTO_UI[id].dopo(g); fatto({ tipo: 'usa', bonus: id }); render();
  }
  function chiudiRound() {
    if (permesso({ tipo: 'chiudi' }) !== true) return;
    var n = esegui({ t: 'chiudi' });
    if (n.rifiuto) return;
    togliSelezione(); bonusAperto = null; msg = ''; msgOk = false;
    if (g.fase === 'fine') chiudiPartita();
    fatto({ tipo: 'chiudi' }); render();
  }
  function chiudiPartita() {
    var vecchio = leggiRecord(), nuovo = g.fine.round > vecchio;
    if (nuovo) scriviRecord(g.fine.round);
    recordFine = { vecchio: vecchio, nuovo: nuovo };
  }

  // IL BANCO
  function moneteRound(round) {
    var m = el('div', 'monete'); m.setAttribute('aria-label', 'Round ' + round);
    m.appendChild(el('span', 'lab', 'Round'));
    m.appendChild(el('span', 'moneta', String(round)));
    var fila = el('span', 'fila'); fila.setAttribute('aria-hidden', 'true');
    for (var k = 1; k < round; k++) fila.appendChild(el('i'));
    m.appendChild(fila);
    return m;
  }
  function cassa(punti, traguardo, sotto) {
    var c = el('div', 'cassa' + (punti >= traguardo ? ' fatto' : ''));
    var num = el('div', 'totale'); num.appendChild(document.createTextNode(String(punti))); num.appendChild(el('small', null, '/ ' + traguardo)); c.appendChild(num);
    var metro = el('div', 'metro'), i = el('i'); i.style.width = Math.min(100, Math.round(100 * punti / traguardo)) + '%'; metro.appendChild(i); c.appendChild(metro);
    if (sotto !== false) c.appendChild(el('div', 'sotto', punti >= traguardo ? '+' + (punti - traguardo) + ' da spendere' : 'mancano ' + (traguardo - punti)));
    return c;
  }
  function gettoniConto(nome, n, chiave) {
    var d = el('div', chiave); d.setAttribute('aria-label', nome + ': ' + n);
    d.appendChild(el('span', 'lab', nome));
    var r = el('span', 'gettoni-c'); r.setAttribute('aria-hidden', 'true');
    var tot = Math.max(3, n);
    for (var k = 0; k < tot; k++) r.appendChild(el('i', (k < n ? '' : 'spento') + (k >= 3 ? ' extra' : '')));
    d.appendChild(r);
    return d;
  }
  function banco() {
    var b = el('div', 'banco');
    b.appendChild(moneteRound(g.round));
    b.appendChild(cassa(cassaMostra ? cassaMostra.punti : g.punti, g.traguardo));
    var c = el('div', 'conteggi');
    c.appendChild(gettoniConto('Giocate', g.giocate, 'giocate'));
    c.appendChild(gettoniConto('Scarti', g.scartiRimasti, 'scarti'));
    b.appendChild(c);
    return b;
  }
  function riserva() {
    var r = el('div', 'riserva');
    if (g.jolly) {
      var j = bottone('', 'chip jolly' + (sel.jolly ? ' scelto' : ''), toccaJolly, null, 'Jolly');
      j.appendChild(el('span', 'stella', '★')); j.appendChild(document.createTextNode('Jolly'));
      j.setAttribute('aria-pressed', sel.jolly ? 'true' : 'false'); j.setAttribute('data-jolly', '1');
      r.appendChild(j);
    } else r.appendChild(el('span', 'chip nessuno', 'nessun jolly'));
    S.BONUS.filter(function (b) { return g.bonus[b.id]; }).forEach(function (b) {
      var c = bottone(b.nome, 'chip gettone' + (bonusAperto === b.id ? ' aperto' : ''), function () { apriBonus(b.id); }, null, b.nome);
      c.setAttribute('data-bonus', b.id); r.appendChild(c);
    });
    if (g.doppio) r.appendChild(el('span', 'chip doppio', '×2 sulla prossima'));
    app.appendChild(r);
    if (bonusAperto && g.bonus[bonusAperto]) {
      var b = S.BONUS_PER_ID[bonusAperto], info = el('div', 'info');
      info.appendChild(el('p', null, b.nome + ': ' + EFFETTO_UI[b.id].prima));
      if (b.id !== 'scudo') info.appendChild(bottone('Usa', 'usa', function () { usaBonus(b.id); }, null, 'Usa'));
      else info.appendChild(bottone('Da solo', 'usa spenta', null, null, 'Scatta da solo'));
      app.appendChild(info);
    }
  }
  function faccia(c) {
    var rosso = c.seme === 'C' || c.seme === 'Q';
    var e = el('button', 'carta' + (rosso ? ' R' : '')); e.type = 'button';
    e.setAttribute('data-id', c.id); e.setAttribute('aria-label', S.nomeCarta(c));
    e.appendChild(el('span', 'v', S.etichettaValore(c.valore)));
    e.appendChild(el('span', 's', S.SIMBOLO_SEME[c.seme] + '︎'));
    return e;
  }
  // il messaggio: uno spazio fisso, il testo ci sta sopra (.dentro) e non sposta niente (solatro.css)
  function messaggio() {
    var m = el('div', 'msg' + (msgOk ? ' ok' : '') + (msg ? '' : ' vuoto'));
    m.appendChild(el('span', 'dentro', msg || ''));
    return m;
  }
  function testoChiusura() {
    var t = g.punti >= g.traguardo ? 'passi' : g.bonus.scudo ? 'lo Scudo ti fa passare' : 'la partita finisce';
    return g.punti + ' su ' + g.traguardo + ': ' + t;
  }
  function schermoRound() {
    app.appendChild(intestazione(tastiTesta()));
    app.appendChild(banco());
    riserva();
    app.appendChild(messaggio());
    var mano = el('div', 'mano' + (g.mano.length > 8 ? ' nove' : '') + (pesca ? ' ' + pesca : ''));
    var l = lettura(), k = 0;
    g.mano.forEach(function (c) {
      var b = faccia(c), scelta = sel.carte.indexOf(c.id) >= 0;
      if (scelta) { b.className += ' scelta' + (l.ok && l.fanno.indexOf(c.id) < 0 ? ' senza' : ''); b.setAttribute('aria-pressed', 'true'); }
      else b.setAttribute('aria-pressed', 'false');
      if (pesca && manoPrima.indexOf(c.id) < 0) { b.classList.add('entra'); b.style.setProperty('--i', k++); }   // la pescata: le carte nuove entrano
      b.addEventListener('click', function () { tocca(c.id); });
      mano.appendChild(b);
    });
    if (!g.mano.length) mano.appendChild(el('div', 'vuota', 'nessuna carta in mano'));
    app.appendChild(mano);

    var az = el('div', 'azioni');
    if (g.giocate <= 0 && !S.bloccato(g)) {
      az.appendChild(bottone('Chiudi il round', 'conferma chiudi', chiudiRound, testoChiusura(), 'Chiudi il round'));
    } else if (S.bloccato(g)) {
      az.appendChild(bottone('Chiudi il round', 'conferma chiudi', chiudiRound, 'non hai più carte: ' + testoChiusura(), 'Chiudi il round'));
    } else {
      var gioca;
      if (l.ok) gioca = bottone('Gioca: ' + l.nome + ', ' + conTesto(l.finali, 'punto', 'punti'), 'gioca conferma', giocaScelta,
        ((sel.jolly ? 'il jolly fa da ' + S.dicoJolly(l.jolly) : '') + (l.doppio ? (sel.jolly ? ' · ' : '') + 'doppio: ' + l.punti + ' × 2' : '')) || null, 'Gioca');
      else gioca = bottone(l.vuota ? 'Scegli le carte' : l.perche, 'gioca spenta', giocaScelta, null, 'Gioca');
      if (!l.ok) gioca.setAttribute('data-motivo', '1');
      az.appendChild(gioca);
      var n = sel.carte.length, puo = g.scartiRimasti > 0 && n > 0;
      az.appendChild(bottone('Scarta' + (n ? ' ' + n : ''), 'scarta' + (puo ? '' : ' spenta'), scartaScelta,
        g.scartiRimasti > 0 ? 'scarti rimasti: ' + g.scartiRimasti : 'nessuno scarto rimasto', 'Scarta'));
    }
    app.appendChild(az);
  }

  // ---------- il negozio: si segna, si ripensa, si paga con un tasto solo ----------
  function spesaSegnata() { return sel.bonus.reduce(function (t, id) { return t + S.BONUS_PER_ID[id].costo; }, 0); }
  function restano() { return g.negozio.punti - spesaSegnata(); }
  function segnaBonus(id) {
    if (permesso({ tipo: 'segna', bonus: id }) !== true) return;
    msg = ''; msgOk = false;
    var i = sel.bonus.indexOf(id);
    if (i >= 0) sel.bonus.splice(i, 1);
    else {
      if (g.bonus[id] || S.BONUS_PER_ID[id].costo > restano()) return;   // già tuo, o non ci arrivi (la tessera lo dice)
      sel.bonus.push(id);
    }
    fatto({ tipo: 'segna', bonus: id }); render();
  }
  function chiudiNegozio() {
    if (permesso({ tipo: 'negozio' }) !== true) return;
    for (var k = 0; k < sel.bonus.length; k++) {
      var n = S.apply(g, { t: 'compra', bonus: sel.bonus[k] });
      if (n.rifiuto) { msg = n.rifiuto; msgOk = false; render(); return; }
      g = n;
    }
    sel.bonus = [];
    var p = esegui({ t: 'prossimo' });
    if (p.rifiuto) return;
    togliSelezione(); bonusAperto = null; msg = messaggioRound(g.ultimo, g); msgOk = !!msg; fatto({ tipo: 'negozio' }); render();
  }
  function schermoNegozio() {
    app.appendChild(intestazione(tastiTesta()));
    var e = g.esito, box = el('div', 'negozio');
    var b = el('div', 'banco esito');
    b.appendChild(moneteRound(e.round));
    var c = cassa(e.totale, e.traguardo, false);
    c.insertBefore(el('div', 'titolo', e.esito === 'scudo' ? 'Lo Scudo ti ha fatto passare' : 'Round ' + e.round + ' superato'), c.firstChild);
    b.appendChild(c); box.appendChild(b);
    var r = restano();
    var spesa = el('div', 'spesa'); spesa.appendChild(el('span', 'totale', String(r))); spesa.appendChild(el('span', 'lab', 'da spendere'));
    box.appendChild(spesa);
    box.appendChild(messaggio());
    var art = el('div', 'articoli');
    S.BONUS.forEach(function (bo) {
      var tuo = !!g.bonus[bo.id], segnato = sel.bonus.indexOf(bo.id) >= 0, manca = bo.costo - r;
      var stato = tuo ? 'tuo' : segnato ? 'segnato' : manca > 0 ? 'no' : '';
      var t = el('button', 'articolo' + (stato ? ' ' + stato : '')); t.type = 'button'; t.setAttribute('data-bonus', bo.id);
      t.setAttribute('aria-label', bo.nome); t.setAttribute('aria-pressed', segnato ? 'true' : 'false');
      var testa = el('div', 'testa'); testa.appendChild(el('span', 'prezzo', String(bo.costo))); testa.appendChild(el('b', null, bo.nome)); t.appendChild(testa);
      t.appendChild(el('span', 'eff', bo.effetto));
      t.appendChild(el('span', 'stato', tuo ? 'tuo' : segnato ? 'segnato' : manca > 0 ? 'mancano ' + manca : ''));
      if (!tuo && (segnato || manca <= 0)) t.addEventListener('click', function () { segnaBonus(bo.id); });
      art.appendChild(t);
    });
    box.appendChild(art);
    var az = el('div', 'azioni'), k = sel.bonus.length, prossimo = 'Round ' + (g.round + 1);
    if (!k) az.appendChild(bottone(prossimo, 'conferma prossimo', chiudiNegozio, r > 0 ? 'perdi i ' + r + ' punti rimasti' : null, prossimo));
    else az.appendChild(bottone('Compra ' + (k === 1 ? S.BONUS_PER_ID[sel.bonus[0]].nome : k + ' bonus') + ', ' + conTesto(spesaSegnata(), 'punto', 'punti'), 'conferma prossimo', chiudiNegozio,
      (r > 0 ? 'ne perdi ' + r + ' · ' : '') + prossimo, 'Compra'));
    box.appendChild(az);
    app.appendChild(box);
  }

  // ---------- la fine ----------
  function schermoFine() {
    app.appendChild(intestazione());
    var f = g.fine, e = g.esito, p = el('div', 'pannello fine');
    p.appendChild(el('h2', null, 'Partita finita'));
    var mon = el('div', 'monete-fine'); mon.setAttribute('aria-label', f.superati + ' round superati');
    for (var k = 0; k < f.superati; k++) mon.appendChild(el('i'));
    mon.appendChild(el('i', 'persa'));
    p.appendChild(mon);
    p.appendChild(el('div', 'dettaglio', 'Round ' + e.round + ': ' + e.totale + ' su ' + e.traguardo + '. Round superati: ' + f.superati + '.'));
    p.appendChild(el('p', 'round', String(f.round)));
    p.appendChild(el('div', 'grado' + (f.grado ? '' : ' nessuno'), f.grado || 'ancora nessun grado'));
    var scala = el('ol', 'scala');
    S.GRADI.slice().reverse().forEach(function (gr, i, arr) {
      var li = el('li'); li.appendChild(el('span', null, gr.nome)); li.appendChild(el('span', 'da', gr.da + (i === arr.length - 1 ? '+' : '') + ' superati'));
      if (f.grado === gr.nome) li.className = 'raggiunto';
      else if (f.superati < gr.da && (i === 0 || f.superati >= arr[i - 1].da)) li.className = 'prossimo';
      scala.appendChild(li);
    });
    p.appendChild(scala);
    var rec = recordFine || { vecchio: leggiRecord(), nuovo: false };
    p.appendChild(el('div', 'record' + (rec.nuovo ? ' nuovo' : ''), rec.nuovo ? 'Nuovo record: round ' + f.round : 'Il tuo record: round ' + (rec.vecchio || f.round)));
    p.appendChild(bottone('Nuova partita', 'grande primo', function () { comincia(semeIniziale(), null); }));
    app.appendChild(p);
  }

  // ---------- le regolette ----------
  var ICONE = {
    scopo: '<svg viewBox="0 0 64 56"><g font-family="Barlow,sans-serif" font-weight="700" font-size="9" text-anchor="middle"><circle cx="12" cy="42" r="10" fill="#F2B233" stroke="#B57A10" stroke-width="2"/><text x="12" y="45" fill="#1A1206">25</text><circle cx="32" cy="30" r="10" fill="#F2B233" stroke="#B57A10" stroke-width="2"/><text x="32" y="33" fill="#1A1206">50</text><circle cx="52" cy="18" r="10" fill="#F2B233" stroke="#B57A10" stroke-width="2"/><text x="52" y="21" fill="#1A1206">75</text></g></svg>',
    giocata: '<svg viewBox="0 0 64 56"><g font-family="Pixelify Sans,monospace" font-weight="700" font-size="9"><rect x="2" y="12" width="13" height="30" rx="2" fill="#FBF7EC"/><text x="8.5" y="26" fill="#D1202F" text-anchor="middle">7</text><rect x="14" y="10" width="13" height="30" rx="2" fill="#FBF7EC"/><text x="20.5" y="24" fill="#141414" text-anchor="middle">7</text><rect x="26" y="8" width="13" height="30" rx="2" fill="#FBF7EC"/><text x="32.5" y="22" fill="#141414" text-anchor="middle">7</text><rect x="38" y="10" width="13" height="30" rx="2" fill="#FBF7EC"/><text x="44.5" y="24" fill="#D1202F" text-anchor="middle">Q</text><rect x="50" y="12" width="13" height="30" rx="2" fill="#FBF7EC"/><text x="56.5" y="26" fill="#141414" text-anchor="middle">Q</text><text x="32" y="53" fill="#F2B233" font-size="10" text-anchor="middle">FULL 60</text></g></svg>',
    scarto: '<svg viewBox="0 0 64 56"><rect x="6" y="6" width="16" height="22" rx="2" fill="#FBF7EC" opacity=".5"/><rect x="24" y="6" width="16" height="22" rx="2" fill="#FBF7EC" opacity=".5"/><polygon points="12,32 18,32 15,40 20,40 13,50 14,42 9,42" fill="#FF3D8A"/><rect x="38" y="30" width="16" height="22" rx="2" fill="#FBF7EC"/><rect x="44" y="26" width="16" height="22" rx="2" fill="#FBF7EC"/><polygon points="34,12 42,20 34,20" fill="#F2B233" transform="rotate(180 38 16)"/></svg>',
    punti: '<svg viewBox="0 0 64 56"><g font-family="Pixelify Sans,monospace" font-weight="700" font-size="7.5" fill="#F6F1E3"><text x="4" y="12">COPPIA</text><text x="60" y="12" text-anchor="end" fill="#F2B233">10</text><text x="4" y="24">TRIS</text><text x="60" y="24" text-anchor="end" fill="#F2B233">30</text><text x="4" y="36">FULL</text><text x="60" y="36" text-anchor="end" fill="#F2B233">60</text><text x="4" y="48">POKER</text><text x="60" y="48" text-anchor="end" fill="#F2B233">100</text></g></svg>',
    jolly: '<svg viewBox="0 0 64 56"><rect x="20" y="4" width="24" height="34" rx="3" fill="#FBF7EC"/><path d="M32 10l3.2 6.9 7.6.8-5.6 5.1 1.6 7.5-6.8-3.8-6.8 3.8 1.6-7.5-5.6-5.1 7.6-.8z" fill="#FF3D8A"/><rect x="8" y="42" width="48" height="8" rx="2" fill="#154238" stroke="#9EC2B1" stroke-dasharray="3 2"/></svg>',
    negozio: '<svg viewBox="0 0 64 56"><path d="M6 14h52l-4 10H10z" fill="#F2B233"/><rect x="10" y="24" width="44" height="26" fill="#154238" stroke="#F2B233" stroke-width="2"/><circle cx="22" cy="37" r="7" fill="#F2B233" stroke="#B57A10" stroke-width="2"/><circle cx="42" cy="37" r="7" fill="#FF3D8A" stroke="#B0205A" stroke-width="2"/></svg>'
  };
  function apriRegole() {
    chiudiRegole();
    var r = el('div', 'regole'); r.setAttribute('role', 'dialog'); r.setAttribute('aria-label', 'Come si gioca');
    var d = el('div', 'dentro');
    d.innerHTML = '<h2>Come si gioca</h2><ol>' + (C ? C.regole : []).map(function (q) { return '<li>' + ICONE[q[0]] + '<div><b>' + q[1] + '</b><span>' + q[2] + '</span></div></li>'; }).join('') + '</ol>';
    var az = el('div', 'azioni');
    az.appendChild(bottone('Torna al tavolo', 'chiudi', chiudiRegole));
    az.appendChild(bottone('Impara giocando', 'conferma', function () { chiudiRegole(); vaiTutorial(); }));
    d.appendChild(az); r.appendChild(d); document.body.appendChild(r);
    window.scrollTo(0, 0);
  }
  function chiudiRegole() { var r = document.querySelector('.regole'); if (r) r.parentNode.removeChild(r); }

  function render() {
    app.textContent = '';
    if (schermo === 'domanda') schermoDomanda();
    else if (g.fase === 'negozio') schermoNegozio();
    else if (g.fase === 'fine') schermoFine();
    else schermoRound();
    if (T) T.sistema(tutorial ? contesto() : null);
  }

  crediti();
  schermo = 'domanda';
  render();
  window.SolatroTavolo = { vaiTutorial: vaiTutorial, render: render };
}());
