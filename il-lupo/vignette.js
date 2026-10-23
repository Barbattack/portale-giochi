/*
 * LE VIGNETTE DELLA DEMO — prototipo di Chiara (23/10/2026). È uno script di SOLO PROTOTIPO: legge il DOM che app.js produce
 * e ci appoggia sopra una vignetta; non tocca il motore né la demo. Erbottega lo porterà dentro app.js come crede.
 *
 * Cosa fa:
 *  1. A ogni ridisegno di #app cerca il PRIMO elemento con la classe .suggerita (quello che la demo chiede di toccare adesso)
 *     e gli mette accanto una vignetta: «TOCCA» in piccolo, e sotto il nome della cosa (preso dall'aria-label o dal testo del tasto).
 *     Attorno all'elemento disegna un anello (.mira). La vignetta sta sopra l'elemento; se non c'è posto, sotto.
 *  2. Quando il passo cambia, porta l'elemento da toccare in vista (scrollIntoView, al centro), una volta sola per passo.
 *  3. Le sigle delle figure: F/D/R diventano J/Q/K, salvo ?sigle=FDR nell'indirizzo. È una PROPOSTA: decide Damiano.
 */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;
  var strato = document.createElement('div'); strato.className = 'strato-vignette'; document.body.appendChild(strato);
  var ultimoBersaglio = null, ultimaChiave = '';
  var SIGLE = /[?&]sigle=FDR/.test(location.search) ? null : { F: 'J', D: 'Q', R: 'K' };

  function testoPulito(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  // il nome della cosa da toccare: la prima parte dell'aria-label (fino alla virgola), oppure il testo del tasto senza le righe piccole
  function nome(el) {
    var al = el.getAttribute('aria-label');
    if (al) { var n = al.split(',')[0]; return n; }
    var copia = el.cloneNode(true);
    [].slice.call(copia.querySelectorAll('small')).forEach(function (s) { s.parentNode.removeChild(s); });
    return testoPulito(copia.textContent);
  }
  function sigla(t) {
    if (!SIGLE) return t;
    return t.replace(/^([FDR])(?=[♠♥♦♣]|$)/, function (m, c) { return SIGLE[c]; });
  }
  function sigle() {
    if (!SIGLE) return;
    var sel = '.carta .v, .carta:not(:has(.v)), .cs .v, .chip, .griglia .c, .potere > span:first-child, .piano b';
    [].slice.call(app.querySelectorAll(sel)).forEach(function (e) {
      if (e.children.length) return;
      var t = e.textContent, n = sigla(t);
      if (n !== t) e.textContent = n;
    });
    // «Donna di quadri» nei testi dei tasti resta: è il nome parlato della carta, non la sigla
  }
  function pulisci() { strato.textContent = ''; }
  function disegna() {
    pulisci();
    if (document.body.classList.contains('spiega') || document.body.classList.contains('pezzi')) { ultimoBersaglio = null; return; }   // prima i pezzetti, poi la vignetta
    // nel turno «trova» (body.trova) la vignetta non indica le carte: la mossa la trova il giocatore; indica solo i tasti.
    // Un gioco può allargare l'elenco di ciò che non si indica (window.VignetteTrovaEscludi, per esempio '.carta, .testa, .slot' in Boba Tea).
    var b = app.querySelector(document.body.classList.contains('trova') ? '.suggerita:not(' + (window.VignetteTrovaEscludi || '.carta') + ')' : '.suggerita');
    if (!b) { ultimoBersaglio = null; return; }
    var r = b.getBoundingClientRect(), sx = window.pageXOffset, sy = window.pageYOffset;
    var chiave = nome(b) + '|' + Math.round(r.top + sy);
    if (b !== ultimoBersaglio && chiave !== ultimaChiave) {
      ultimoBersaglio = b; ultimaChiave = chiave;
      if (r.top < 90 || r.bottom > window.innerHeight - 20) { b.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'auto' : 'auto' }); r = b.getBoundingClientRect(); sx = window.pageXOffset; sy = window.pageYOffset; }
    }
    var mira = document.createElement('div'); mira.className = 'mira';
    mira.style.left = (r.left + sx - 5) + 'px'; mira.style.top = (r.top + sy - 5) + 'px';
    mira.style.width = (r.width + 10) + 'px'; mira.style.height = (r.height + 10) + 'px';
    strato.appendChild(mira);
    var v = document.createElement('div'); v.className = 'vignetta';
    var t1 = document.createElement('span'); t1.className = 'tocca'; t1.textContent = 'Tocca';
    var t2 = document.createElement('span'); t2.className = 'cosa'; t2.textContent = sigla(nome(b));
    v.appendChild(t1); v.appendChild(t2);
    strato.appendChild(v);
    var vw = v.offsetWidth, vh = v.offsetHeight, cx = r.left + r.width / 2;
    var left = Math.max(8, Math.min(window.innerWidth - vw - 8, cx - vw / 2));
    var sopra = r.top - vh - 14 > 4;
    v.className += sopra ? ' sopra' : ' sotto';
    v.style.left = (left + sx) + 'px';
    v.style.top = (sopra ? r.top - vh - 12 : r.bottom + 12) + sy + 'px';
    v.style.setProperty('--punta', Math.max(14, Math.min(vw - 14, cx - left)) + 'px');
  }
  var attesa = null;
  function programma() { if (attesa) return; attesa = requestAnimationFrame(function () { attesa = null; sigle(); disegna(); }); }
  new MutationObserver(programma).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', programma);
  window.addEventListener('scroll', programma, { passive: true });   // la riga dei tasti è appiccicata al fondo: la vignetta la segue
  programma();
}());
