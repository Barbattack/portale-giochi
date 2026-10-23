/*
 * LA COPERTINA — prototipo di Chiara (23/10/2026), pezzo comune a tutti i giochi, come le vignette.
 * Damiano: «quando le persone atterrano sulla pagina [...] ci sia la copertina di quel gioco [...] con una carta grande girata sul dorso
 * che si muove un pochino [...] il titolo del gioco grosso, e poi due pulsanti, gioca oppure tutorial».
 *
 * Script di SOLO PROTOTIPO: si carica PRIMA di app.js (deve azzerare la memoria «visto» prima che app.js la legga). Trasforma la schermata «Sai già giocare?» che app.js produce:
 *  - il titolo diventa grande e centrato (body.copertina, stile in comune.css; la misura la dà il tema del gioco);
 *  - sotto il titolo una carta grande sul dorso del gioco (--dorso), che fluttua piano (4 s, ±8 px, qualche grado);
 *  - i due tasti diventano «Gioca» (una partita a caso) e «Tutorial» (la partita guidata); la riga di spiegazione resta, piccola;
 *  - la copertina si vede SEMPRE: la memoria «visto» di app.js, che la saltava dalla seconda volta, viene azzerata a ogni apertura.
 * Erbottega lo porterà dentro app.js: la domanda «Sai già giocare?» non c'è più, al suo posto c'è la copertina.
 */
(function () {
  'use strict';
  // la copertina si vede sempre: via la memoria «visto» (chiave <gioco>-visto) prima che app.js la legga
  try { Object.keys(localStorage).forEach(function (k) { if (/-visto$/.test(k)) localStorage.removeItem(k); }); } catch (e) { /* senza localStorage va bene lo stesso */ }
  var app = document.getElementById('app');
  if (!app) return;
  var TESTI = { 'Sì, so giocare': 'Gioca', 'No, fammi vedere': 'Tutorial' };
  function sistema() {
    var h2 = app.querySelector('.pannello h2');
    var e = !!h2 && h2.textContent.trim() === 'Sai già giocare?';
    document.body.classList.toggle('copertina', e);
    if (!e) return;
    var pannello = h2.parentNode;
    if (pannello.querySelector('.copertina-carta')) return;
    var carta = document.createElement('div'); carta.className = 'copertina-carta';
    var dorso = document.createElement('div'); dorso.className = 'dorso dorso-grande'; dorso.setAttribute('aria-hidden', 'true');
    carta.appendChild(dorso);
    pannello.insertBefore(carta, h2);
    [].slice.call(pannello.querySelectorAll('button.grande')).forEach(function (b) { var t = TESTI[b.textContent.trim()]; if (t) b.textContent = t; });
    // la riga di spiegazione: se il prototipo del gioco ne dà una sua (window.CopertinaRiga), prende il posto di quella di app.js
    var riga = pannello.querySelector('p');
    if (riga && window.CopertinaRiga) riga.textContent = window.CopertinaRiga;
  }
  var attesa = null;
  new MutationObserver(function () { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sistema(); }); }).observe(app, { childList: true, subtree: true });
  sistema();
}());
