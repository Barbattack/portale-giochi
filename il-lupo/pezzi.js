/*
 * I PEZZETTI — prototipo di Chiara (23/10/2026 sera), pezzo comune a tutti i giochi, come le vignette e la copertina.
 * Damiano: «non può andare TUTTO il testo assieme MA deve un pezzetto alla volta facendo vedere passo passo le cose [...] e ogni passo deve
 * esserci un tasto OK [...] in modo che la persona capisca bene e vada avanti di sua spontanea volontà».
 *
 * Un passo del tutorial si racconta un pezzetto alla volta: ogni pezzetto dice una cosa sola, ACCENDE sul tavolo la cosa di cui parla
 * (carte, una colonna, un tasto, un numero) e si chiude con un tasto. Il pezzetto dopo arriva solo quando il giocatore lo tocca.
 * Il cartello del pezzetto sta fisso in basso, vicino al pollice; il tavolo resta visibile sopra, e la cosa accesa viene portata in vista.
 *
 * Nel copione ogni passo può avere `pezzi: [{ riga, frasi?, righe?, testo?, accendi: [chiavi] }]`:
 *   riga     l'indice della riga della `bozza` (le righe sono separate da \n) da cui prendere il testo
 *   frasi    (facoltativo) quali frasi di quella riga, per indice: così un capoverso lungo si spezza senza riscriverlo
 *   righe    (facoltativo) più righe insieme
 *   testo    (facoltativo) un testo suo, solo per le due o tre parole di raccordo che servono a far reggere un pezzetto da solo
 *   accendi  le cose da accendere: chiavi che il gioco traduce in elementi (risolvi), per esempio 'carta:C3', 'affiliati:Soldato', 'regno:4'
 * Senza `pezzi`, ogni riga della bozza è un pezzetto, e si accende `accendi` del passo.
 *
 * Uso: var pezzi = Pezzi({ app, risolvi: function (chiave) { return [elementi]; }, alFine: function (info) {...} });
 *      in ogni ridisegno: var attivi = pezzi.mostra(info, nuovoPasso);   // true finché i pezzetti del passo non sono finiti
 */
(function () {
  'use strict';
  window.Pezzi = function (opts) {
    var app = opts.app, idx = 0, finiti = false, cartello = null, ultimoAcceso = -1, infoCorrente = null;
    var FINE = /(?<=[.?!…»]\**)\s+(?=\**[A-ZÀ-Ü«0-9])/;
    function frasi(s) { return s.split(FINE); }
    function righeDi(info) { return info.bozza.split('\n'); }
    function lista(info) {
      if (info.pezzi) return info.pezzi;
      return righeDi(info).map(function (_, i) { return { riga: i, accendi: info.accendi || [] }; });
    }
    function testoDi(info, pz) {
      var righe = righeDi(info);
      if (pz.testo) return pz.testo;
      if (pz.righe) return pz.righe.map(function (i) { return righe[i] || ''; }).join('\n');
      var r = righe[pz.riga] || '';
      if (pz.frasi) { var f = frasi(r); return pz.frasi.map(function (i) { return f[i] || ''; }).join(' '); }
      return r;
    }
    function paragrafo(testo) {
      var frag = document.createDocumentFragment();
      testo.split('\n').forEach(function (r) {
        if (!r.trim()) return;
        var p = document.createElement('p');
        r.split(/\*\*/).forEach(function (pezzo, i) { if (i % 2) { var b = document.createElement('b'); b.textContent = pezzo; p.appendChild(b); } else p.appendChild(document.createTextNode(pezzo)); });
        frag.appendChild(p);
      });
      return frag;
    }
    function spegni() { [].slice.call(document.querySelectorAll('.acceso')).forEach(function (e) { e.classList.remove('acceso'); }); }
    function accendi(chiavi) {
      spegni();
      var primi = null;
      (chiavi || []).forEach(function (k) {
        (opts.risolvi(k) || []).forEach(function (e) { e.classList.add('acceso'); if (!primi) primi = e; });
      });
      return primi;
    }
    function chiudi() { if (cartello && cartello.parentNode) cartello.parentNode.removeChild(cartello); cartello = null; spegni(); }
    function ultimoTesto(info) { var l = lista(info); return testoDi(info, l[l.length - 1]); }
    function mostra(info, nuovo) {
      if (nuovo || info !== infoCorrente) { idx = 0; finiti = false; ultimoAcceso = -1; infoCorrente = info; }
      if (finiti) { return false; }
      var l = lista(info), pz = l[idx], ultimo = idx === l.length - 1;
      if (!cartello) {
        cartello = document.createElement('div'); cartello.className = 'pezzo'; cartello.setAttribute('role', 'dialog');
        document.body.appendChild(cartello);
      }
      cartello.textContent = '';
      var dentro = document.createElement('div'); dentro.className = 'dentro';
      var kicker = document.createElement('div'); kicker.className = 'kicker';
      var k1 = document.createElement('span'); k1.textContent = info.titolo || (info.tipo === 'gioca' ? 'Il tuo turno' : '');
      var k2 = document.createElement('span'); k2.textContent = l.length > 1 ? (idx + 1) + ' / ' + l.length : '';
      kicker.appendChild(k1); kicker.appendChild(k2); dentro.appendChild(kicker);
      dentro.appendChild(paragrafo(testoDi(info, pz)));
      var az = document.createElement('div'); az.className = 'azioni-pezzo';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ok';
      b.textContent = ultimo ? (info.tipo === 'leggi' ? (opts.etichettaFine ? opts.etichettaFine(info) : 'Avanti') : 'Ok') : 'Ok';
      b.addEventListener('click', function () {
        idx++;
        if (idx >= l.length) { finiti = true; chiudi(); if (opts.alFine) opts.alFine(info); }
        else mostra(info, false);
      });
      az.appendChild(b); dentro.appendChild(az); cartello.appendChild(dentro);
      var primo = accendi(pz.accendi);
      if (primo && ultimoAcceso !== idx) {
        ultimoAcceso = idx;
        var r = primo.getBoundingClientRect(), libero = window.innerHeight - cartello.offsetHeight;
        if (r.top < 70 || r.bottom > libero - 10) primo.scrollIntoView({ block: 'center' });
      }
      return true;
    }
    return { mostra: mostra, chiudi: chiudi, ultimoTesto: ultimoTesto, attivi: function () { return !finiti && !!cartello; } };
  };
}());
