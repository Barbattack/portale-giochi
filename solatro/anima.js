/*
 * SOLATRO — LE ANIMAZIONI (Chiara, secondo giro, 25/10/2026). Script di SOLO PROTOTIPO: tavolo.js lo chiama prima e dopo una giocata
 * o uno scarto; non tocca il motore. Vanilla: Web Animations API per i pezzi che volano, CSS (solatro.css) per le carte che entrano.
 *
 * TUTTE LE DURATE passano da VELOCITA (qui sotto): 1 = i tempi scritti qui; 0,5 = tutto due volte più veloce; 2 = due volte più lento.
 * Il numero va anche nella variabile CSS --vel (solatro.css: le carte che entrano, la barra, il colpo del numero).
 * Primo giro (26/10 notte): tutto in ~1 s, Damiano: «troooooppa veloci, nemmeno si vedono quasi». Rallentato in modo deciso (×2,2).
 *
 * LA GIOCATA, le fasi IN FILA (26/10, terzo passaggio; a VELOCITA = 1 la mano è pronta a 3,7 s con 5 carte nuove, 3,1 s con una;
 * la cassa si aggiorna a 1,8 s e la barra finisce di salire a 2,4 s; tutto sparisce a 3,8 s):
 *   0–500 ms      le carte giocate escono dalla mano e si mettono in posa in una fila sotto il banco (scala .8); la mano si smorza (.mano.in-posa)
 *   500–800 ms    il lampo «FULL · +60» compare sopra la fila (scala .6→1), poi resta FERMO fino a 2400 ms (1,6 s per leggerlo), poi va via entro 2800
 *   1300–1800 ms  il «+60» vola dal lampo alla cassa, volo corto (cubic-bezier(.4,0,1,1))
 *   1800 ms       la cassa si aggiorna: il numero batte (600 ms) e la barra sale (transizione di 600 ms, fino a 2400)
 *   2400–2800 ms  le carte in posa salgono e svaniscono; la mano si riaccende
 *   2700 ms +     le carte nuove entrano una alla volta (380 ms l'una, 160 ms di scarto: con 5 carte l'ultima finisce a 3720 ms)
 * LO SCARTO: le carte scartate scendono e svaniscono (450 ms), le nuove entrano da 250 ms, una alla volta (con 2 carte l'ultima finisce a 790 ms, con 5 a 1270).
 * UN TOCCO salta tutto: le animazioni finiscono subito, la cassa si aggiorna, il tocco non passa al tavolo.
 * Con prefers-reduced-motion: reduce non si anima niente: lo stato nuovo appare subito.
 */
(function () {
  'use strict';
  var VELOCITA = 1;   // IL MOLTIPLICATORE: un numero solo per tutte le durate (anche quelle in CSS, via --vel)
  function T(ms) { return Math.round(ms * VELOCITA); }
  try { document.documentElement.style.setProperty('--vel', String(VELOCITA)); } catch (e) { /* senza stile va bene lo stesso */ }
  var ridotto = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var CURVA = 'cubic-bezier(.2,.8,.2,1)', USCITA = 'cubic-bezier(.4,0,1,1)';
  var strato = null, inCorso = null, dopo = [], prenotata = false;   // prenotata: il tavolo sta per animare (fra la mossa e il ridisegno)   // dopo: chi aspetta la fine (il tutorial, per mostrare il pezzetto a tavolo fermo)
  function layer() { if (!strato) { strato = document.createElement('div'); strato.className = 'strato-anima'; strato.setAttribute('aria-hidden', 'true'); document.body.appendChild(strato); } return strato; }
  function pulisci() { if (strato) strato.textContent = ''; }
  function finisci() {
    if (!inCorso) return;
    var c = inCorso; inCorso = null;
    c.animazioni.forEach(function (a) { try { a.finish(); } catch (e) { /* già finita */ } });
    c.timer.forEach(clearTimeout);
    pulisci(); document.body.classList.remove('anima');
    var mano = document.querySelector('.mano'); if (mano) mano.classList.add('subito');
    c.fine();
    var d = dopo; dopo = []; d.forEach(function (f) { f(); });
  }
  function poi(f) { if (inCorso || prenotata) dopo.push(f); else f(); }
  function prenota() { prenotata = !ridotto; }
  function annulla() { prenotata = false; var d = dopo; dopo = []; d.forEach(function (f) { f(); }); }
  // un tocco qualsiasi, mentre si anima, salta tutto e non arriva al tavolo
  document.addEventListener('click', function (e) { if (inCorso) { e.stopPropagation(); e.preventDefault(); finisci(); } }, true);

  // PRIMA della mossa: dove stanno le carte scelte e la mano (il tavolo si ridisegna da capo dopo)
  function prima(app, ids) {
    var carte = ids.map(function (id) { var el = app.querySelector('.carta[data-id="' + id + '"]'); return el ? { el: el.cloneNode(true), r: el.getBoundingClientRect() } : null; }).filter(Boolean);
    var mano = app.querySelector('.mano');
    return { carte: carte, manoR: mano ? mano.getBoundingClientRect() : null };
  }
  function cloni(t, s) {
    t.carte.forEach(function (c) {
      var e = c.el; e.classList.remove('scelta', 'senza', 'suggerita', 'acceso', 'entra'); e.classList.add('volo'); e.removeAttribute('aria-pressed');
      e.style.cssText = 'position:fixed;left:' + c.r.left + 'px;top:' + c.r.top + 'px;width:' + c.r.width + 'px;height:' + c.r.height + 'px;margin:0;';
      s.appendChild(e); c.clone = e;
    });
  }
  function centro(t) {
    var cx = t.manoR ? t.manoR.left + t.manoR.width / 2 : window.innerWidth / 2;
    var cy = t.manoR ? Math.max(120, Math.min(t.manoR.top + t.manoR.height / 2, window.innerHeight - 150)) : window.innerHeight / 2;
    return { x: cx, y: cy };
  }

  // DOPO la giocata (il tavolo è già ridisegnato con la cassa VECCHIA e le carte nuove in .entra, invisibili fino al loro turno): info = { nome, punti, aggiornaCassa }
  // Le fasi in fila, una cosa sola che si muove per volta (26/10, dopo la prova di Damiano: «si vede bene solo la pesca»):
  //   1. le carte giocate escono dalla mano e si mettono in posa in una fila sotto il banco (in alto, lontano dal pollice); la mano si smorza
  //   2. sopra la fila, grande, «COLORE · +50»: resta fermo 1,6 s
  //   3. il «+50» vola nella cassa (volo corto: la fila sta subito sotto il banco), il numero batte, la barra sale
  //   4. le carte in posa e il lampo se ne vanno, la mano si riaccende
  //   5. le carte nuove entrano una alla volta (CSS, .mano.dopo-giocata)
  function giocata(app, t, info) {
    prenotata = false;
    if (ridotto || !t || !t.carte.length) { info.aggiornaCassa(); annulla(); return; }
    finisci();
    var s = layer(), anims = [], timer = [];
    document.body.classList.add('anima');
    cloni(t, s);
    var mano = app.querySelector('.mano'); if (mano) mano.classList.add('in-posa');
    // la fila in posa: sotto il banco, centrata; carte all'80 %
    var banco = app.querySelector('.banco'), bb = banco ? banco.getBoundingClientRect().bottom : 200;
    if (bb < 60) bb = 60;   // banco fuori dallo schermo (pagina scorsa): la fila sta comunque in alto, in vista
    var SCALA = .8, n = t.carte.length, w0 = t.carte[0].r.width, h0 = t.carte[0].r.height, w = w0 * SCALA, gap = 6;
    var larg = n * w + (n - 1) * gap, x0 = (window.innerWidth - larg) / 2, yFila = bb + 108;
    t.carte.forEach(function (c, i) {
      var tx = x0 + i * (w + gap) - c.r.left, ty = yFila - c.r.top;
      c.posa = 'translate(' + tx + 'px,' + ty + 'px) scale(' + SCALA + ')'; c.via = 'translate(' + tx + 'px,' + (ty - 40) + 'px) scale(' + SCALA + ')';
      c.clone.style.transformOrigin = '0 0';
      anims.push(c.clone.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: c.posa }], { duration: T(500), easing: CURVA, fill: 'forwards' }));
    });
    // 2. il lampo, sopra la fila
    var cx = window.innerWidth / 2, cy = bb + 52;
    var lampo = document.createElement('div'); lampo.className = 'lampo';
    var b = document.createElement('b'); b.textContent = info.nome; var sp = document.createElement('span'); sp.textContent = '+' + info.punti;
    lampo.appendChild(b); lampo.appendChild(sp); lampo.style.left = cx + 'px'; lampo.style.top = cy + 'px'; s.appendChild(lampo);
    anims.push(lampo.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0, easing: CURVA }, { transform: 'translate(-50%,-50%) scale(1.04)', opacity: 1, offset: .13, easing: 'linear' },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .83, easing: CURVA }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }
    ], { duration: T(2300), delay: T(500), easing: 'linear', fill: 'forwards' }));   // la curva sta su ogni intervallo: fermo davvero fino all'83 %
    // 3. il volo dei punti e la cassa
    var cassa = app.querySelector('.cassa .totale'), cr = cassa ? cassa.getBoundingClientRect() : { left: 80, top: 80, width: 0, height: 0 };
    var volo = document.createElement('div'); volo.className = 'punti-volo'; volo.textContent = '+' + info.punti;
    volo.style.left = cx + 'px'; volo.style.top = cy + 'px'; s.appendChild(volo);
    var dx = cr.left + cr.width / 2 - cx, dy = cr.top + cr.height / 2 - cy;
    anims.push(volo.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0, easing: 'linear' }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .15, easing: USCITA },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.55)', opacity: 1 }
    ], { duration: T(500), delay: T(1300), easing: 'linear', fill: 'forwards' }));
    var aggiornata = false;
    function aggiorna() { if (aggiornata) return; aggiornata = true; info.aggiornaCassa(); var ca = app.querySelector('.cassa'); if (ca) { ca.classList.add('colpo'); setTimeout(function () { ca.classList.remove('colpo'); }, T(600)); } }
    timer.push(setTimeout(aggiorna, T(1800)));
    // 4. le carte in posa se ne vanno, la mano si riaccende
    timer.push(setTimeout(function () {
      t.carte.forEach(function (c) {
        // trasformazioni assolute: una seconda animazione «in aggiunta» sostituiva la prima e le carte saltavano indietro nella mano (foto del 26/10)
        anims.push(c.clone.animate([{ transform: c.posa, opacity: 1 }, { transform: c.via, opacity: 0 }], { duration: T(400), easing: USCITA, fill: 'forwards' }));
      });
      if (mano) mano.classList.remove('in-posa');
    }, T(2400)));
    timer.push(setTimeout(finisci, T(3800)));
    inCorso = { animazioni: anims, timer: timer, fine: function () { aggiorna(); if (mano) mano.classList.remove('in-posa'); } };
  }

  // DOPO lo scarto: le carte scartate scendono e svaniscono
  function scarto(app, t) {
    prenotata = false;
    if (ridotto || !t || !t.carte.length) { annulla(); return; }
    finisci();
    var s = layer(), anims = [];
    document.body.classList.add('anima');
    cloni(t, s);
    t.carte.forEach(function (c) {
      anims.push(c.clone.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40px)', opacity: 0 }], { duration: T(450), easing: USCITA, fill: 'forwards' }));
    });
    inCorso = { animazioni: anims, timer: [setTimeout(finisci, T(500))], fine: function () {} };
  }

  window.Anima = { VELOCITA: VELOCITA, prima: prima, giocata: giocata, scarto: scarto, finisci: finisci, poi: poi, prenota: prenota, annulla: annulla, attiva: function () { return !!inCorso || prenotata; }, ridotto: ridotto };
}());
