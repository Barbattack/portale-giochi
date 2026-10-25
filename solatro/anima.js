/*
 * SOLATRO — LE ANIMAZIONI (Chiara, secondo giro, 25/10/2026). Script di SOLO PROTOTIPO: tavolo.js lo chiama prima e dopo una giocata
 * o uno scarto; non tocca il motore. Vanilla: Web Animations API per i pezzi che volano, CSS (solatro.css) per le carte che entrano.
 *
 * LA GIOCATA, dal tocco alla mano di nuovo pronta (~0,8 s; la cassa si aggiorna a 0,8 s; tutto sparisce a 1,0 s):
 *   0–420 ms   le carte giocate salgono e svaniscono (translateY −46 px, scala 1,06 a metà; curva --curva, cubic-bezier(.2,.8,.2,1))
 *   120–740 ms il lampo della combinazione («FULL · +60») compare al centro della mano (scala .6→1, poi fermo, poi via)
 *   460–800 ms il «+60» vola dal lampo alla cassa (cubic-bezier(.4,0,1,1): accelera verso la cassa)
 *   800 ms     la cassa si aggiorna: il numero batte (scala 1,12, 300 ms) e la barra si riempie (transizione di 300 ms in solatro.css)
 *   320 ms +   le carte nuove entrano in mano una dopo l'altra (240 ms l'una, 50 ms di scarto: con 5 carte l'ultima finisce a 760 ms)
 * LO SCARTO: le carte scartate scendono e svaniscono (220 ms), le nuove entrano da 120 ms (con 5 carte l'ultima finisce a 560 ms).
 * UN TOCCO salta tutto: le animazioni finiscono subito, la cassa si aggiorna, il tocco non passa al tavolo.
 * Con prefers-reduced-motion: reduce non si anima niente: lo stato nuovo appare subito.
 */
(function () {
  'use strict';
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

  // DOPO la giocata (il tavolo è già ridisegnato con la cassa VECCHIA e le carte nuove in .entra): info = { nome, punti, aggiornaCassa }
  function giocata(app, t, info) {
    prenotata = false;
    if (ridotto || !t || !t.carte.length) { info.aggiornaCassa(); annulla(); return; }
    finisci();
    var s = layer(), anims = [], timer = [];
    document.body.classList.add('anima');
    cloni(t, s);
    t.carte.forEach(function (c) {
      anims.push(c.clone.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-18px) scale(1.06)', opacity: 1, offset: .45 }, { transform: 'translateY(-46px) scale(1.02)', opacity: 0 }
      ], { duration: 420, easing: CURVA, fill: 'forwards' }));
    });
    var c = centro(t);
    var lampo = document.createElement('div'); lampo.className = 'lampo';
    var b = document.createElement('b'); b.textContent = info.nome; var sp = document.createElement('span'); sp.textContent = '+' + info.punti;
    lampo.appendChild(b); lampo.appendChild(sp); lampo.style.left = c.x + 'px'; lampo.style.top = c.y + 'px'; s.appendChild(lampo);
    anims.push(lampo.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.04)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .85 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }
    ], { duration: 620, delay: 120, easing: CURVA, fill: 'forwards' }));
    var cassa = app.querySelector('.cassa .totale'), cr = cassa ? cassa.getBoundingClientRect() : { left: 80, top: 80, width: 0, height: 0 };
    var volo = document.createElement('div'); volo.className = 'punti-volo'; volo.textContent = '+' + info.punti;
    volo.style.left = c.x + 'px'; volo.style.top = c.y + 'px'; s.appendChild(volo);
    var dx = cr.left + cr.width / 2 - c.x, dy = cr.top + cr.height / 2 - c.y;
    anims.push(volo.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .15 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.55)', opacity: 1 }
    ], { duration: 340, delay: 460, easing: USCITA, fill: 'forwards' }));
    var aggiornata = false;
    function aggiorna() { if (aggiornata) return; aggiornata = true; info.aggiornaCassa(); var ca = app.querySelector('.cassa'); if (ca) { ca.classList.add('colpo'); setTimeout(function () { ca.classList.remove('colpo'); }, 320); } }
    timer.push(setTimeout(aggiorna, 800));
    timer.push(setTimeout(finisci, 1000));
    inCorso = { animazioni: anims, timer: timer, fine: aggiorna };
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
      anims.push(c.clone.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40px)', opacity: 0 }], { duration: 220, easing: USCITA, fill: 'forwards' }));
    });
    inCorso = { animazioni: anims, timer: [setTimeout(finisci, 260)], fine: function () {} };
  }

  window.Anima = { prima: prima, giocata: giocata, scarto: scarto, finisci: finisci, poi: poi, prenota: prenota, annulla: annulla, attiva: function () { return !!inCorso || prenotata; }, ridotto: ridotto };
}());
