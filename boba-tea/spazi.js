/*
 * THE FIRST BOBA TEA SHOP IN LONDON — IL TAVOLO CHE MOSTRA LO SPAZIO: prototipo di Chiara (23/10/2026, notte).
 * Script di SOLO PROTOTIPO. Legge il DOM che app.js produce e ci aggiunge quello che il disegno vuole; non tocca il motore. Vale in partita
 * e nel tutorial. Si carica dopo engine.js e copione.js, prima di app.js. Erbottega lo porterà dentro app.js (vedi il documento del copione, §5).
 *
 *  1. LO SPAZIO SUI POSTI — SOLO NEL TUTORIAL. Su ogni posto di ogni coda (davanti al più alto, fra due clienti, dietro al più basso) c'è
 *     scritto quanti numeri ci starebbero: fra un 8 e un Asso otto, davanti a un Re uno solo. Nelle code chiuse è un numero piccolo fra due
 *     righe (.sp); nella coda aperta è sul tasto del posto (.slot.conta), grande, con accanto «da quale a quale». È il cuore del ragionamento
 *     (Damiano, 23/10). IN PARTITA NON C'È (Damiano, 24/10: «nella partita normale NON ci devono stare, altrimenti gioca da solo il gioco e
 *     non il giocatore che deve un minimo ragionare e fare 2 conti»): niente .sp fra le strisce, e il tasto del posto resta quello di app.js
 *     («+», e «qui» quando è scelto), con l'aria-label che dice solo dov'è (punto 2). Il tutorial si riconosce dal cartello del passo (.passo).
 *  2. I POSTI SI CHIAMANO «dietro», «davanti», «fra» (le parole della spina), non «sotto» e «sopra»: aria-label dei posti, messaggi. Ovunque.
 *  3. IL MALEDUCATO DICE I NUMERI: «Il 5♠ salta la fila: qui ci stanno solo i numeri da 8 a Re». ANCHE IN PARTITA: spiega l'errore
 *     (Damiano: «ti dice no e ti dice perché»), non suggerisce la mossa.
 *  4. RESTA e CACCIALO dicono quanto costano, sotto, piccolo: «la coda se ne va: 3» · «via lui e il prossimo: 2» — SOLO NEL TUTORIAL.
 *     In partita i due tasti sono nudi: quanto costa lo conta il giocatore.
 *  5. Il bancone (il coperchio della tazza) in cima alle code; «clienti» al posto di «carte» sotto i nomi delle code; «Scarti · N» come titolo
 *     degli scarti; il titolo del gioco su tre righe (THE FIRST / BOBA TEA / SHOP IN LONDON). Ovunque.
 */
(function () {
  'use strict';
  var B = self.Boba, C = self.BobaCopione, app = document.getElementById('app');
  if (!B || !C || !app) return;
  var VAL = { A: 1, J: 11, Q: 12, K: 13, F: 11, D: 12, R: 13 };
  var NOME = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var FDR = /[?&]sigle=FDR/.test(location.search);
  var SIG = FDR ? { 1: 'A', 11: 'F', 12: 'D', 13: 'R' } : { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  function val(t) { t = t.trim(); return VAL[t] || +t; }
  function nomeN(v) { return NOME[v] || String(v); }
  function sig(v) { return SIG[v] || String(v); }
  function q(sel, radice) { return [].slice.call((radice || app).querySelectorAll(sel)); }
  function strisce(lista) { return q('.cs:not(.fantasma)', lista); }           // dall'alto (il più alto, davanti) al basso (il più basso, in fondo)
  function valori(lista) { return strisce(lista).map(function (c) { return val(c.querySelector('.v').textContent); }); }
  // posto p in una coda di n clienti: 0 = dietro al più basso, n = davanti al più alto, k = fra il k-esimo e il (k+1)-esimo dal fondo
  function limiti(vals, p) { var n = vals.length; return [p > 0 ? vals[n - p] : 1, p < n ? vals[n - 1 - p] : 13]; }
  function spazio(l) { return Math.max(0, l[1] - l[0] + 1); }
  function siglaCarta(cs) { return cs.querySelector('.v').textContent.trim().replace(/^[FDR]$/, function (m) { return FDR ? m : { F: 'J', D: 'Q', R: 'K' }[m]; }) + cs.querySelector('.s').textContent.trim(); }
  function nomePosto(lista, p, lungo) {   // «Dietro A♠» / «Davanti R♠» / «Fra A♠ e R♠», oppure la forma lunga coi nomi
    var s = strisce(lista), n = s.length, sotto = p > 0 ? s[n - p] : null, sopra = p < n ? s[n - 1 - p] : null;
    var nome = function (cs) { return lungo ? cs.getAttribute('aria-label') : siglaCarta(cs); };
    var a = function (cs) { var n = nome(cs); return lungo ? (/^A/.test(n) ? 'all\'' + n : 'a ' + n) : n; };
    if (!sotto) return (lungo ? 'dietro ' : 'Dietro ') + a(sopra);
    if (!sopra) return (lungo ? 'davanti ' : 'Davanti ') + a(sotto);
    return (lungo ? 'fra ' : 'Fra ') + nome(sotto) + ' e ' + nome(sopra);
  }
  function etichettaSpazio(l) { var n = spazio(l); return { n: n, r: l[0] === l[1] ? sig(l[0]) : sig(l[0]) + '–' + sig(l[1]) }; }

  // aiuti = true nel tutorial (i numeri dello spazio, punto 1); false in partita (solo le parole dei posti, punto 2)
  function sistemaCoda(coda, aiuti) {
    var lista = coda.querySelector('.lista'); if (!lista) return;
    var vals = valori(lista), n = vals.length;
    var slots = q('.slot', lista);
    if (slots.length) {                                         // coda aperta (o il posto fissato del maleducato): i tasti dei posti
      slots.forEach(function (sl, i) {
        var p = sl.classList.contains('fisso') ? null : n - i;
        if (sl.classList.contains('fisso')) {                 // il posto del maleducato: la sua etichetta la dà lo spazio della coda senza il fantasma
          var m = /^Posto (sopra|sotto|fra) (.+)$/.exec(sl.getAttribute('aria-label') || '');
          if (m) sl.setAttribute('aria-label', 'Il posto scelto, ' + { sopra: 'davanti a ', sotto: 'dietro a ', fra: 'fra ' }[m[1]] + m[2]);
          return;
        }
        if (sl.getAttribute('data-pos')) return;
        sl.setAttribute('data-pos', String(p));
        if (!aiuti) { sl.setAttribute('aria-label', nomePosto(lista, p, false) + ', ' + nomePosto(lista, p, true)); return; }   // in partita: «+» / «qui» di app.js
        var l = limiti(vals, p), e = etichettaSpazio(l);
        sl.classList.add('conta');
        sl.textContent = '';
        var b1 = document.createElement('span'); b1.className = 'n'; b1.textContent = String(e.n);
        var b2 = document.createElement('span'); b2.className = 'r'; b2.textContent = e.r;
        sl.appendChild(b1); sl.appendChild(b2);
        sl.setAttribute('aria-label', nomePosto(lista, p, false) + ', ' + nomePosto(lista, p, true) + ': ' + e.n + (e.n === 1 ? ' numero' : ' numeri'));
      });
      return;
    }
    if (!aiuti || lista.querySelector('.sp')) return;         // coda chiusa, nel tutorial: i numeri dello spazio fra le strisce
    var s = strisce(lista);
    function sp(p) {
      var l = limiti(vals, p), e = etichettaSpazio(l);
      var d = document.createElement('div'); d.className = 'sp'; d.setAttribute('data-pos', String(p)); d.textContent = String(e.n);
      d.setAttribute('aria-label', nomePosto(lista, p, true) + ': ' + e.n + (e.n === 1 ? ' numero' : ' numeri'));
      return d;
    }
    s.forEach(function (cs, i) { lista.insertBefore(sp(n - i), cs); });
    lista.appendChild(sp(0));
  }

  function sistema() {
    // il titolo su tre righe
    var h1 = app.querySelector('h1');
    if (h1 && !h1.querySelector('span')) {
      var t = h1.textContent.trim(), m = /^(The First) (Boba Tea) (Shop in London)$/.exec(t);
      if (m) { h1.textContent = ''; ['r1', 'r2', 'r3'].forEach(function (c, i) { var s = document.createElement('span'); s.className = c; s.textContent = m[i + 1]; h1.appendChild(s); }); }
    }
    var aiuti = !!app.querySelector('.passo');   // il tutorial ha il cartello del passo; la partita (anche quella che continua dopo il tutorial) no
    var code = app.querySelector('.code');
    if (code) {
      // il bancone è uno span, non un div: così .coda:nth-of-type conta solo le code
      if (!code.querySelector('.bancone')) { var b = document.createElement('span'); b.className = 'bancone'; b.setAttribute('aria-hidden', 'true'); code.insertBefore(b, code.firstChild); }
      q('.coda', code).forEach(function (c) { sistemaCoda(c, aiuti); });
      q('.testa small', code).forEach(function (s) { var v = s.textContent.replace(/\b1 carta\b/, '1 cliente').replace(/(\d+) carte\b/, '$1 clienti'); if (v !== s.textContent) s.textContent = v; });
    }
    var h3 = app.querySelector('.scarti h3');
    if (h3) { var mm = /^Scarti \((\d+)\)/.exec(h3.textContent); if (mm) h3.textContent = +mm[1] ? 'Scarti · ' + mm[1] : 'Scarti'; }
    // Resta e Caccialo dicono quanto costano: solo nel tutorial
    var resta = app.querySelector('.azioni .resta'), caccia = app.querySelector('.azioni .caccia');
    if (aiuti && resta && !resta.querySelector('small')) {
      var cd = app.querySelector('.coda:has(.slot.fisso)'), n = cd ? strisce(cd.querySelector('.lista')).length : 0;
      var num = app.querySelector('.pila .num'), mazzo = num ? +num.textContent : 1;
      var s1 = document.createElement('small'); s1.textContent = C.aiuti.costoResta.replace('{n}', n); resta.appendChild(s1);
      var s2 = document.createElement('small'); s2.textContent = mazzo ? C.aiuti.costoCaccia.replace('{m}', 2) : C.aiuti.costoCacciaUno; caccia.appendChild(s2);
    }
    // i messaggi: il maleducato coi numeri; dietro/davanti; clienti
    var msg = app.querySelector('.msg');
    if (msg && msg.textContent) {
      var v = msg.textContent, o = v;
      var fisso = app.querySelector('.coda:has(.slot.fisso)');
      if (fisso && /Peschi (\S+): non sta\./.test(v)) {
        var lista = fisso.querySelector('.lista'), vals = valori(lista), sl = lista.querySelector('.slot.fisso');
        // il posto fissato: quante strisce stanno sopra di lui nella lista
        var sopra = 0, x = sl.previousElementSibling; while (x) { if (x.classList.contains('cs')) sopra++; x = x.previousElementSibling; }
        var p = vals.length - sopra, l = limiti(vals, p);
        var carta = RegExp.$1, art = /^[DQ]/.test(carta) ? 'La ' : (/^A/.test(carta) ? 'L\'' : 'Il ');
        var frase = (l[0] === l[1] ? C.aiuti.nonStaUno : C.aiuti.nonSta).replace('{carta}', art + carta).replace('{a}', nomeN(l[0])).replace('{b}', nomeN(l[1]));
        v = v.replace(/Peschi (\S+): non sta\.( Scegli: Resta o Caccialo\.)?/, frase);
      }
      if (!FDR) v = v.replace(/\b([FDR])(?=[♠♥♦♣])/g, function (m) { return { F: 'J', D: 'Q', R: 'K' }[m]; });   // le sigle come le mostra vignette.js (J/Q/K)
      v = v.replace(/il posto sotto /g, 'il posto dietro a ').replace(/il posto sopra /g, 'il posto davanti a ').replace(/(\d+) carta della coda/, '$1 cliente della coda').replace(/(\d+) carte della coda/, '$1 clienti della coda');
      if (v !== o) msg.textContent = v;
    }
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
