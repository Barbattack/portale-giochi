/*
 * Solatro — il motore delle regole.
 * Gioco di TechDweeb (https://techdweeb.itch.io/solatro), ispirato a Balatro, senza alcun legame ufficiale.
 * Regole chiuse con Damiano: owner inbox/solatro-regole-2026-10-25.md (vale il regolamento scritto).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista di mosse
 * la partita è sempre la stessa. Gira in node e nel browser (nel browser si chiama `Solatro`).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri, F fiori, P picche; valore 1-13 (1 Asso, 11 Fante,
 * 12 Donna, 13 Re). id = seme + valore ("C12"). I due jolly: { id:'J1'|'J2', jolly:true }.
 *
 * Mosse (le fa sempre il giocatore):
 *   { t:'gioca',   carte:[id], jolly:bool }   // il jolly da parte conta come una delle (al massimo) 5 carte
 *   { t:'scarta',  carte:[id] }
 *   { t:'usa',     bonus:'carta-extra'|'scarto-extra'|'punti-in-tasca'|'giocata-extra'|'doppio' }
 *   { t:'chiudi' }                            // chiude il round: serve solo a chi dopo l'ultima giocata ha ancora Punti in tasca o Giocata extra, o a mano finita
 *                                             // (negli altri casi l'ultima giocata chiude il round da sola: ultimo.chiusura)
 *   { t:'compra',  bonus }                    // nel negozio
 *   { t:'prossimo' }                          // dal negozio al round dopo
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è identico
 * al precedente tranne `rifiuto` (il perché, corto, in italiano, mai cosa conviene). Se è accettata
 * `rifiuto` è null e `ultimo` dice cosa è successo.
 *
 * Stato: { seme, rng, round, fase:'round'|'negozio'|'fine', mazzo, mano, scarti (anche le carte giocate:
 *   tornano nel mazzo a fine round), jolly (il jolly da parte o null), manoMax, giocate, scartiRimasti,
 *   punti (totale del round, compresi i punti in tasca), traguardo, doppio (armato), bonus:{id:true},
 *   negozio:{punti}|null, esito (com'è finito l'ultimo round), fine:null|{round,superati,grado},
 *   rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Solatro = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MANO = 8, GIOCATE = 3, SCARTI = 3, MAX_CARTE = 5, PASSO_TRAGUARDO = 25;
  var SEMI = ['C', 'Q', 'F', 'P'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO_SEME = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var ETICHETTA_VALORE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  // la tabella dei punti (regolamento p. 2, «Hand Scores»); l'ordine è dal più basso al più alto
  var COMBINAZIONI = [
    { id: 'carta-alta', nome: 'Carta alta', punti: 5 },
    { id: 'coppia', nome: 'Coppia', punti: 10 },
    { id: 'doppia-coppia', nome: 'Doppia coppia', punti: 20 },
    { id: 'tris', nome: 'Tris', punti: 30 },
    { id: 'scala', nome: 'Scala', punti: 40 },
    { id: 'colore', nome: 'Colore', punti: 50 },
    { id: 'full', nome: 'Full', punti: 60 },
    { id: 'poker', nome: 'Poker', punti: 100 },
    { id: 'scala-colore', nome: 'Scala colore', punti: 125 },
    { id: 'scala-reale', nome: 'Scala reale', punti: 150 }
  ];
  var COMBO = {}; COMBINAZIONI.forEach(function (c) { COMBO[c.id] = c; });

  // il negozio (regolamento p. 3, «Bonus Shop»).
  var BONUS = [
    { id: 'carta-extra', nome: 'Carta extra', costo: 10, effetto: '+1 carta in mano fino a fine round' },
    { id: 'scarto-extra', nome: 'Scarto extra', costo: 25, effetto: '+1 scarto nel round' },
    { id: 'punti-in-tasca', nome: 'Punti in tasca', costo: 50, effetto: '+25 punti al totale del round' },
    { id: 'giocata-extra', nome: 'Giocata extra', costo: 75, effetto: '+1 giocata nel round' },
    { id: 'doppio', nome: 'Doppio punteggio', costo: 100, effetto: 'la prossima giocata vale doppio' },
    { id: 'scudo', nome: 'Scudo', costo: 150, effetto: 'se manchi il traguardo, passi lo stesso' }
  ];
  var BONUS_PER_ID = {}; BONUS.forEach(function (b) { BONUS_PER_ID[b.id] = b; });

  // i gradi, per round superati (regolamento p. 3, «Metagame»).
  var GRADI = [
    { da: 10, nome: 'Ultra Mega Uber Giga-Dweeb' }, { da: 7, nome: 'Dweeb ufficiale' },
    { da: 5, nome: 'Piccolo Dweeb' }, { da: 3, nome: 'Cibo per gatti' }
  ];
  function gradoPer(superati) {
    for (var i = 0; i < GRADI.length; i++) if (superati >= GRADI[i].da) return GRADI[i].nome;
    return null;
  }

  // ---------- generatore pseudo-casuale con seme (lo stato si porta dietro `rng`) ----------
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function prossimoCaso(s) {            // mulberry32, il contatore sta in s.rng
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function mescola(arr, s) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(prossimoCaso(s) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- carte ----------
  function carta(seme, valore) { return { id: seme + valore, seme: seme, valore: valore }; }
  function jolly(n) { return { id: 'J' + n, jolly: true }; }
  function daId(id) { return id[0] === 'J' ? jolly(+id.slice(1)) : carta(id[0], +id.slice(1)); }
  function mazzoCompleto() {
    var m = [];
    SEMI.forEach(function (s) { for (var v = 1; v <= 13; v++) m.push(carta(s, v)); });
    m.push(jolly(1), jolly(2));
    return m;
  }
  function nomeValore(v) { return NOME_VALORE[v] || String(v); }
  function etichettaValore(v) { return ETICHETTA_VALORE[v] || String(v); }
  function nomeCarta(c) { return c.jolly ? 'Jolly' : nomeValore(c.valore) + ' di ' + NOME_SEME[c.seme]; }
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['mazzo', 'mano', 'scarti'].forEach(function (k) { n[k] = s[k].slice(); });
    n.bonus = {}; Object.keys(s.bonus).forEach(function (k) { n.bonus[k] = s.bonus[k]; });
    if (s.negozio) n.negozio = { punti: s.negozio.punti };
    return n;
  }

  // ---------- riconoscimento della combinazione ----------
  // carte: da 1 a 5 carte vere (senza jolly). Restituisce { id, nome, punti, fanno:[id] }: la combinazione più alta
  // fra quelle formate dalle carte; `fanno` sono le carte che la formano (le altre non danno punti).
  function riconosci(carte) {
    var n = carte.length;
    var per = {}, i;
    carte.forEach(function (c) { (per[c.valore] = per[c.valore] || []).push(c); });
    var gruppi = Object.keys(per).map(function (v) { return per[v]; }).sort(function (a, b) {
      return b.length - a.length || altoValore(b[0].valore) - altoValore(a[0].valore);
    });
    var tutte = carte.map(function (c) { return c.id; });
    function esito(id, fanno) { return { id: id, nome: COMBO[id].nome, punti: COMBO[id].punti, fanno: fanno }; }
    function ids(cs) { return cs.map(function (c) { return c.id; }); }
    if (n === 5) {
      var colore = carte.every(function (c) { return c.seme === carte[0].seme; });
      var v = carte.map(function (c) { return c.valore; }).sort(function (a, b) { return a - b; });
      var distinte = gruppi.length === 5;
      var scala = false, reale = false;
      if (distinte) {
        scala = v[4] - v[0] === 4 || (v[0] === 1 && v[1] === 2 && v[2] === 3 && v[3] === 4 && v[4] === 5);   // Asso basso
        if (v[0] === 1 && v[1] === 10 && v[2] === 11 && v[3] === 12 && v[4] === 13) { scala = true; reale = true; }   // Asso alto
      }
      if (scala && colore && reale) return esito('scala-reale', tutte);
      if (scala && colore) return esito('scala-colore', tutte);
      if (gruppi[0].length === 4) return esito('poker', ids(gruppi[0]));
      if (gruppi[0].length === 3 && gruppi[1].length === 2) return esito('full', tutte);
      if (colore) return esito('colore', tutte);
      if (scala) return esito('scala', tutte);
    }
    if (gruppi[0].length >= 4) return esito('poker', ids(gruppi[0]));
    if (gruppi[0].length === 3) return esito('tris', ids(gruppi[0]));
    if (gruppi[0].length === 2 && gruppi[1] && gruppi[1].length === 2) return esito('doppia-coppia', ids(gruppi[0]).concat(ids(gruppi[1])));
    if (gruppi[0].length === 2) return esito('coppia', ids(gruppi[0]));
    var alta = carte.slice().sort(function (a, b) { return altoValore(b.valore) - altoValore(a.valore); })[0];
    return esito('carta-alta', [alta.id]);
  }
  function altoValore(v) { return v === 1 ? 14 : v; }

  /*
   * valuta(carte, conJolly) — pura. carte: carte vere scelte (senza jolly). Con `conJolly` si aggiunge il jolly da parte:
   * prova ogni carta che non è già fra le scelte e tiene quella che dà la combinazione più alta.
   * Restituisce { id, nome, punti, fanno, jolly: null | { ranghi:[valori], semi:[semi], scelta:carta } }.
   * `jolly.ranghi`/`semi` sono i valori e i semi che danno la stessa combinazione più alta (per dirlo a parole).
   */
  function valuta(carte, conJolly) {
    if (!conJolly) { var r = riconosci(carte); r.jolly = null; return r; }
    var presenti = {}; carte.forEach(function (c) { presenti[c.id] = true; });
    var migliore = null, pari = [];
    for (var v = 13; v >= 1; v--) {
      for (var k = 0; k < SEMI.length; k++) {
        var cand = carta(SEMI[k], v);
        if (presenti[cand.id]) continue;
        var ris = carte.length ? riconosci(carte.concat([cand])) : { id: 'carta-alta', nome: 'Carta alta', punti: 5, fanno: [cand.id] };
        if (!migliore || ris.punti > migliore.punti) { migliore = ris; pari = [cand]; }
        else if (ris.punti === migliore.punti) pari.push(cand);
      }
    }
    var ranghi = [], semi = [];
    pari.forEach(function (c) { if (ranghi.indexOf(c.valore) < 0) ranghi.push(c.valore); if (semi.indexOf(c.seme) < 0) semi.push(c.seme); });
    ranghi.sort(function (a, b) { return a - b; });
    var out = { id: migliore.id, nome: migliore.nome, punti: migliore.punti, fanno: migliore.fanno, jolly: { ranghi: ranghi, semi: semi, scelta: pari[0] } };
    out.fanno = out.fanno.concat(['J']);   // il jolly fa sempre parte di ciò che è stato giocato
    return out;
  }
  // il jolly, a parole: «Re», «7 di cuori», «carta di picche», «A o 9»
  function dicoJolly(j) {
    if (!j) return '';
    if (j.ranghi.length === 1 && j.semi.length === 1) return nomeValore(j.ranghi[0]) + ' di ' + NOME_SEME[j.semi[0]];
    if (j.ranghi.length === 1) return nomeValore(j.ranghi[0]);
    if (j.ranghi.length === 2) return nomeValore(j.ranghi[0]) + ' o ' + nomeValore(j.ranghi[1]);
    if (j.semi.length === 1) return 'una carta di ' + NOME_SEME[j.semi[0]];
    if (j.ranghi.length < 12) return j.ranghi.slice(0, -1).map(nomeValore).join(', ') + ' o ' + nomeValore(j.ranghi[j.ranghi.length - 1]);
    return 'qualsiasi carta';
  }

  /*
   * leggiGiocata(stato, ids, conJolly) — pura. Cosa succede se si giocano queste carte (e il jolly da parte).
   *   valida:    { ok:true, nome, punti (base), finali (col doppio, se armato), doppio, jolly, fanno, perche:null }
   *   non valida:{ ok:false, perche, ... }    // il perché, corto; mai cosa conviene
   *   niente da dire (nessuna carta scelta): { ok:false, vuota:true, perche:'Scegli almeno una carta da giocare' }
   */
  function leggiGiocata(stato, ids, conJolly) {
    function no(t, vuota) { return { ok: false, vuota: !!vuota, perche: t }; }
    ids = ids || [];
    var carte = [], visti = {}, i;
    for (i = 0; i < ids.length; i++) {
      var c = stato.mano.filter(function (x) { return x.id === ids[i]; })[0];
      if (!c || visti[c.id]) return no('Carta non trovata');
      visti[c.id] = true; carte.push(c);
    }
    if (conJolly && !stato.jolly) return no('Non hai nessun jolly da parte');
    var totale = carte.length + (conJolly ? 1 : 0);
    if (!totale) return no('Scegli almeno una carta da giocare', true);
    if (totale > MAX_CARTE) return no('Al massimo ' + MAX_CARTE + ' carte per giocata' + (conJolly ? ', jolly compreso' : ''));
    var v = valuta(carte, !!conJolly);
    var finali = v.punti * (stato.doppio ? 2 : 1);
    return { ok: true, perche: null, id: v.id, nome: v.nome, punti: v.punti, finali: finali, doppio: !!stato.doppio, jolly: v.jolly, fanno: v.fanno };
  }

  // ---------- pesca ----------
  // Ripesca fino al limite della mano. Un jolly pescato va da parte (e si pesca un'altra carta); se ce n'era già uno
  // da parte si perdono tutti e due (vanno negli scarti). Se il mazzo finisce la mano resta corta: non si rimescola a metà round.
  function ripesca(s, eventi) {
    while (s.mano.length < s.manoMax && s.mazzo.length) {
      var c = s.mazzo.shift();
      if (!c.jolly) { s.mano.push(c); continue; }
      if (s.jolly) {
        s.scarti.push(c, s.jolly); s.jolly = null;
        eventi.push('jolly-persi');
      } else {
        s.jolly = c; eventi.push('jolly-da-parte');
      }
    }
  }

  // ---------- il round ----------
  function iniziaRound(s, testa) {
    var tutte = s.mano.concat(s.mazzo, s.scarti);          // mano, scarti e carte giocate tornano nel mazzo (il jolly da parte resta da parte)
    var ids = {}; (testa || []).forEach(function (c) { ids[c.id] = true; });
    s.mazzo = (testa || []).concat(mescola(tutte.filter(function (c) { return !ids[c.id]; }), s));
    s.mano = []; s.scarti = [];
    s.manoMax = MANO; s.giocate = GIOCATE; s.scartiRimasti = SCARTI; s.punti = 0;
    s.traguardo = PASSO_TRAGUARDO * s.round;
    s.fase = 'round'; s.negozio = null;
    var ev = []; ripesca(s, ev);
    s.ultimo = { azione: 'round', eventi: ev };
  }

  /*
   * opzioni: { inTesta:[id] }  // solo prove: queste carte stanno in cima al mazzo del primo round, in ordine
   */
  function nuova(seme, opzioni) {
    opzioni = opzioni || {};
    var s = {
      seme: String(seme), rng: xmur3(String(seme)) | 0, round: 1, fase: 'round',
      mazzo: [], mano: [], scarti: [], jolly: null, manoMax: MANO, giocate: GIOCATE, scartiRimasti: SCARTI,
      punti: 0, traguardo: PASSO_TRAGUARDO, doppio: false, bonus: {}, negozio: null, esito: null, fine: null,
      rifiuto: null, ultimo: null
    };
    s.scarti = mazzoCompleto();
    iniziaRound(s, (opzioni.inTesta || []).map(daId));
    return s;
  }

  // la mano non si può più ripescare e non c'è più niente da giocare
  function bloccato(s) { return s.mano.length === 0 && s.mazzo.length === 0; }

  function chiudiRound(s) {
    var u = { azione: 'chiudi', round: s.round, totale: s.punti, traguardo: s.traguardo, esito: null, extra: 0 };
    if (s.punti >= s.traguardo) { u.esito = 'superato'; u.extra = s.punti - s.traguardo; }
    else if (s.bonus.scudo) { u.esito = 'scudo'; delete s.bonus.scudo; }
    else u.esito = 'perso';
    s.esito = { round: s.round, totale: s.punti, traguardo: s.traguardo, esito: u.esito, extra: u.extra };
    if (u.esito === 'perso') {
      var superati = s.round - 1;                         // il round in cui perdi non è «superato»
      s.fase = 'fine'; s.fine = { round: s.round, superati: superati, grado: gradoPer(superati) };
    } else {
      s.fase = 'negozio'; s.negozio = { punti: u.extra };
    }
    s.ultimo = u;
  }

  function apply(stato, mossa) {
    var s = copia(stato);
    s.rifiuto = null;
    function no(msg) { var r = copia(stato); r.rifiuto = msg; return r; }
    if (!mossa || !mossa.t) return no('Mossa non valida');

    if (s.fase === 'fine') return no('La partita è finita');

    if (mossa.t === 'compra') {
      if (s.fase !== 'negozio') return no('Il negozio è aperto solo tra un round e l’altro');
      var b = BONUS_PER_ID[mossa.bonus];
      if (!b) return no('Bonus non trovato');
      if (s.bonus[b.id]) return no('Hai già questo bonus');
      if (s.negozio.punti < b.costo) return no(b.nome + ' costa ' + b.costo + ' punti, ne hai ' + s.negozio.punti);
      s.negozio.punti -= b.costo; s.bonus[b.id] = true;
      s.ultimo = { azione: 'compra', bonus: b.id };
      return s;
    }
    if (mossa.t === 'prossimo') {
      if (s.fase !== 'negozio') return no('Il round non è finito');
      s.round += 1;
      iniziaRound(s);
      return s;
    }
    if (s.fase !== 'round') return no('Il round è finito');

    if (mossa.t === 'chiudi') {
      if (s.giocate > 0 && !bloccato(s)) return no('Hai ancora ' + s.giocate + (s.giocate === 1 ? ' giocata' : ' giocate') + ' in questo round');
      chiudiRound(s);
      return s;
    }

    if (mossa.t === 'usa') {
      var bo = BONUS_PER_ID[mossa.bonus];
      if (!bo) return no('Bonus non trovato');
      if (!s.bonus[bo.id]) return no('Non hai questo bonus');
      if (bo.id === 'scudo') return no('Lo Scudo scatta da solo, quando manchi un traguardo');
      if (bo.id === 'doppio' && s.doppio) return no('Il doppio punteggio è già attivo');
      delete s.bonus[bo.id];
      if (bo.id === 'carta-extra') s.manoMax += 1;
      else if (bo.id === 'scarto-extra') s.scartiRimasti += 1;
      else if (bo.id === 'punti-in-tasca') s.punti += 25;
      else if (bo.id === 'giocata-extra') s.giocate += 1;
      else if (bo.id === 'doppio') s.doppio = true;
      s.ultimo = { azione: 'usa', bonus: bo.id };
      return s;
    }

    function togliDallaMano(carte) {
      var idc = carte.map(function (c) { return c.id; });
      s.mano = s.mano.filter(function (c) { return idc.indexOf(c.id) < 0; });
    }
    function trova(ids) {
      var out = [], visti = {};
      for (var i = 0; i < (ids || []).length; i++) {
        var c = s.mano.filter(function (x) { return x.id === ids[i]; })[0];
        if (!c || visti[c.id]) return null;
        visti[c.id] = true; out.push(c);
      }
      return out;
    }

    if (mossa.t === 'gioca') {
      if (s.giocate <= 0) return no('Non hai più giocate in questo round');
      var lett = leggiGiocata(s, mossa.carte, !!mossa.jolly);
      if (!lett.ok) return no(lett.perche);
      var giocate = trova(mossa.carte);
      togliDallaMano(giocate);
      s.scarti = s.scarti.concat(giocate);
      var usoJolly = !!mossa.jolly;
      if (usoJolly) { s.scarti.push(s.jolly); s.jolly = null; }       // quando si usa, il jolly si scarta
      s.punti += lett.finali; s.giocate -= 1; s.doppio = false;
      var ev = []; ripesca(s, ev);
      s.ultimo = { azione: 'gioca', carte: giocate, usoJolly: usoJolly, jolly: lett.jolly, combinazione: lett.id, nome: lett.nome,
        base: lett.punti, punti: lett.finali, doppio: lett.doppio, fanno: lett.fanno, eventi: ev };
      // dopo l'ultima giocata il round si chiude da solo e si sommano i punti; resta aperto solo per chi ha
      // Punti in tasca o Giocata extra, i soli due bonus che dopo l'ultima giocata cambiano ancora qualcosa
      if (s.giocate === 0 && !s.bonus['punti-in-tasca'] && !s.bonus['giocata-extra']) {
        var giocata = s.ultimo; chiudiRound(s); giocata.chiusura = s.ultimo; s.ultimo = giocata;
      }
      return s;
    }

    if (mossa.t === 'scarta') {
      if (s.scartiRimasti <= 0) return no('Non hai più scarti in questo round');
      var ids = mossa.carte || [];
      if (!ids.length) return no('Scegli da 1 a ' + MAX_CARTE + ' carte da scartare');
      if (ids.length > MAX_CARTE) return no('Al massimo ' + MAX_CARTE + ' carte per scarto');
      var tolte = trova(ids);
      if (!tolte) return no('Carta non trovata');
      togliDallaMano(tolte);
      s.scarti = s.scarti.concat(tolte);
      s.scartiRimasti -= 1;
      var ev2 = []; ripesca(s, ev2);
      s.ultimo = { azione: 'scarta', carte: tolte, eventi: ev2 };
      return s;
    }
    return no('Mossa non valida');
  }

  return {
    nuova: nuova, apply: apply, valuta: valuta, riconosci: riconosci, leggiGiocata: leggiGiocata, dicoJolly: dicoJolly,
    carta: carta, jolly: jolly, daId: daId, mazzoCompleto: mazzoCompleto, bloccato: bloccato, gradoPer: gradoPer,
    nomeCarta: nomeCarta, nomeValore: nomeValore, etichettaValore: etichettaValore,
    COMBINAZIONI: COMBINAZIONI, BONUS: BONUS, BONUS_PER_ID: BONUS_PER_ID, GRADI: GRADI,
    MANO: MANO, GIOCATE: GIOCATE, SCARTI: SCARTI, MAX_CARTE: MAX_CARTE, PASSO_TRAGUARDO: PASSO_TRAGUARDO,
    SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO_SEME: SIMBOLO_SEME
  };
}));
