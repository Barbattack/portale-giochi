/*
 * The Emissary (titolo provvisorio) — il motore delle regole.
 * Di Wil Su, dalla collezione Isaludo (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista di mosse la
 * partita è sempre la stessa. Gira in node e nel browser (nel browser si chiama `Emissary`).
 * Regole: owner inbox/isaludo-regole-2026-10-22.md, sezione 10, e il libro (pp. 47-52).
 *
 * Carte: { id, seme, valore }. Semi C cuori, Q quadri, F fiori, P picche. Valori 1-13 (Asso 1, Fante 11,
 * Donna 12, Re 13). id = seme + valore ("Q12" = Donna di quadri). L'Asso vale 1, è la più bassa.
 * Il mazzo da 52: 8 segnaposto (i 9 e i 10, mai in gioco), 8 sovrani (Re e Donne, sui regni e poi
 * alleati), 4 Fanti (i consiglieri, fuori da ogni mazzo) e 32 carte dall'Asso all'8: il mazzo.
 *
 * Fasi: 'scegli' (le 8 carte in mano, si sceglie il regno) · 'tra' (nel regno, prima del dibattito:
 * qui e solo qui si usano consiglieri e alleati) · 'risposta' (la carta del sovrano è uscita, si risponde)
 * · 'scarta' (a metà del potere dei quadri: vanno scartate due carte) · 'fine'.
 *
 * Mosse:
 *   { t:'regno',   n:1..8 }                         visita il regno n (fase 'scegli')
 *   { t:'apri' }                                     scopre la prima carta del mazzo: il sovrano parla (fase 'tra')
 *   { t:'gioca',   carta:id }                        risponde (fase 'risposta')
 *   { t:'fante',   seme, con?:1..8 }                 un consigliere (fase 'tra'); `con` serve ai picche: il regno da scambiare
 *   { t:'alleato', id, con?:1..8 }                   il potere di un alleato (fase 'tra'), una volta in tutta la partita
 *   { t:'scarta',  carte:[id, id] }                  le due carte dei quadri (fase 'scarta')
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato è identico
 * tranne `rifiuto` (il perché, corto, in italiano). Se è accettata `rifiuto` è null e `ultimo` dice cosa è
 * successo; se la mossa ha chiuso il regno, `ultimo.chiuso` ne dà l'esito.
 *
 * Stato: { seme, rng, fase, regni:[{sovrano:carta|null, visitato}] (otto, da sinistra), corrente:null|0..7,
 *          mano, mazzo ([0] è la cima), scarti ([ultima] è la cima), vittorie, parla:carta|null,
 *          fantiUsati:[semi], alleati:[{carta, usato, regno}], daScartare, fine:null|{...}, rifiuto, ultimo }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Emissary = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMI = ['C', 'Q', 'F', 'P'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var SIGLA_VALORE = { 1: 'A', 11: 'F', 12: 'D', 13: 'R' };
  var NOME_VALORE = { 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' };
  var REGNI = 8, MANO = 8;

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
  function daId(id) { return carta(id[0], +id.slice(1)); }
  function mazzoCompleto() {
    var m = [];
    SEMI.forEach(function (se) { for (var v = 1; v <= 13; v++) m.push(carta(se, v)); });
    return m;
  }
  function eMazzo(c) { return c.valore <= 8; }
  function eSovrano(c) { return c.valore >= 12; }
  function eFante(c) { return c.valore === 11; }
  function nomeCarta(c) { return (NOME_VALORE[c.valore] || String(c.valore)) + ' di ' + NOME_SEME[c.seme]; }
  function sigla(c) { return (SIGLA_VALORE[c.valore] || String(c.valore)) + SIMBOLO[c.seme]; }
  function eRossa(c) { return c.seme === 'C' || c.seme === 'Q'; }
  function ordina(carte) {
    return carte.slice().sort(function (a, b) { return SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme) || a.valore - b.valore; });
  }
  function ultimaDi(l) { return l.length ? l[l.length - 1] : null; }
  var LISTE = ['mano', 'mazzo', 'scarti', 'vittorie', 'fantiUsati'];
  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    LISTE.forEach(function (k) { n[k] = s[k].slice(); });
    n.regni = s.regni.map(function (r) { return { sovrano: r.sovrano, visitato: r.visitato }; });
    n.alleati = s.alleati.map(function (a) { return { carta: a.carta, usato: a.usato, regno: a.regno }; });
    return n;
  }
  function base(seme) {
    return { seme: String(seme), rng: xmur3(String(seme)), fase: 'scegli', regni: [], corrente: null,
             mano: [], mazzo: [], scarti: [], vittorie: [], parla: null, fantiUsati: [], alleati: [],
             daScartare: 0, fine: null, rifiuto: null, ultimo: null };
  }

  // ---------- pescare, rimescolare ----------
  // Si pesca dalla cima del mazzo; se finisce si rimescolano gli scarti (libro p. 51) e si continua.
  // Se anche gli scarti sono vuoti si pesca di meno.
  function pesca(s, n) {
    var fatte = 0, rim = false;
    while (fatte < n) {
      if (!s.mazzo.length) {
        if (!s.scarti.length) break;
        s.mazzo = mescola(s.scarti, s); s.scarti = []; rim = true;
      }
      s.mano.push(s.mazzo.shift()); fatte++;
    }
    return { pescate: fatte, rimescolato: rim };
  }
  function nonVisitati(s) {
    var l = [];
    s.regni.forEach(function (r, i) { if (!r.visitato) l.push(i + 1); });
    return l;
  }
  function punteggioDi(s) {
    var inutilizzati = s.alleati.filter(function (a) { return !a.usato; }).length;
    return { regniVinti: s.alleati.length, alleatiNonUsati: inutilizzati, punti: s.alleati.length + inutilizzati };
  }

  // ---------- partita ----------
  function nuova(seme) {
    var s = base(seme);
    var tutte = mazzoCompleto();
    var sovrani = mescola(tutte.filter(eSovrano), s);
    s.regni = sovrani.map(function (c) { return { sovrano: c, visitato: false }; });
    s.mazzo = mescola(tutte.filter(eMazzo), s);
    pesca(s, MANO);
    return s;
  }
  // Una scena preparata (per la demo e le prove), da liste di id.
  //   regni: otto id (o null: regno già vinto, il suo sovrano è fra gli alleati); visitato: quelli con sovrano ma già visitati (di norma `corrente`)
  //   alleati: [{id, usato, regno}]; fase; corrente (1..8); mano, mazzo, scarti, vittorie: liste di id; fantiUsati: [semi]
  function costruisci(d) {
    var s = base(d.seme || 'scena');
    var L = function (l) { return (l || []).map(daId); };
    s.regni = d.regni.map(function (id, i) {
      return { sovrano: id ? daId(id) : null, visitato: !id || (d.corrente === i + 1) };
    });
    s.fase = d.fase || 'tra';
    s.corrente = d.corrente ? d.corrente - 1 : null;
    s.mano = L(d.mano); s.mazzo = L(d.mazzo); s.scarti = L(d.scarti); s.vittorie = L(d.vittorie);
    s.fantiUsati = (d.fantiUsati || []).slice();
    s.alleati = (d.alleati || []).map(function (a) { return { carta: daId(a.id), usato: !!a.usato, regno: a.regno }; });
    s.daScartare = d.daScartare || 0;
    if (s.fase === 'risposta') s.parla = ultimaDi(s.scarti);
    return s;
  }

  // Chiude il regno (la mano è vuota, o mazzo e scarti sono finiti insieme). Il regno è vinto se le vittorie
  // sono esattamente il suo numero; altrimenti si perde. Muta `s` (già una copia) e scrive `s.ultimo.chiuso`.
  function chiudiRegno(s, forzata) {
    var i = s.corrente, n = i + 1, vinti = s.vittorie.length, ok = vinti === n, sov = s.regni[i].sovrano;
    var chiuso = { n: n, richiesti: n, vinti: vinti, ok: ok, sovrano: sov, forzata: !!forzata, rimescolato: false };
    s.ultimo.chiuso = chiuso;
    s.parla = null; s.daScartare = 0;
    if (!ok) {
      var p = punteggioDi(s);
      s.fase = 'fine';
      s.fine = { esito: 'sconfitta', punti: p.punti, regniVinti: p.regniVinti, alleatiNonUsati: p.alleatiNonUsati,
                 regno: n, richiesti: n, vinti: vinti, forzata: !!forzata };
      return;
    }
    s.alleati.push({ carta: sov, usato: false, regno: i });
    s.regni[i].sovrano = null;
    if (s.alleati.length === REGNI) {
      var q = punteggioDi(s);
      s.fase = 'fine';
      s.fine = { esito: 'vittoria', punti: q.punti, regniVinti: q.regniVinti, alleatiNonUsati: q.alleatiNonUsati };
      return;
    }
    // Si rimescola tutto: scarti, vittorie e mazzo (E2). Le carte rimaste in mano (solo a chiusura forzata)
    // tornano nel mazzo con le altre. I Fanti tornano disponibili, si pescano 8 carte.
    s.mazzo = mescola(s.mazzo.concat(s.scarti, s.vittorie, s.mano), s);
    s.scarti = []; s.vittorie = []; s.mano = [];
    pesca(s, MANO);
    s.fantiUsati = []; s.corrente = null; s.fase = 'scegli';
    chiuso.rimescolato = true;
  }

  // Il potere di un seme (di un Fante o di un alleato). Muta `s` e scrive `s.ultimo`.
  function eseguiPotere(s, seme, con, fonte, id) {
    var i = s.corrente, briscola = s.regni[i].sovrano.seme, u;
    u = { t: fonte, seme: seme, id: id || null, scartate: [], pescate: 0, rimescolato: false, scambio: null, nulla: false };
    s.ultimo = u;
    if (seme === 'C') {                          // diplomazia: via tutte le briscole che hai in mano
      u.scartate = s.mano.filter(function (c) { return c.seme === briscola; });
      s.mano = s.mano.filter(function (c) { return c.seme !== briscola; });
      u.scartate.forEach(function (c) { s.scarti.push(c); });
    } else if (seme === 'F') {                   // esercito: una carta per ogni fiori in mano, contati ora (E1)
      var fiori = s.mano.filter(function (c) { return c.seme === 'F'; }).length;
      var r = pesca(s, fiori);
      u.pescate = r.pescate; u.rimescolato = r.rimescolato; u.fiori = fiori;
    } else if (seme === 'P') {                   // politica: scambia il sovrano con quello di un regno non visitato
      if (!nonVisitati(s).length) u.nulla = true;   // ultimo regno: non fa niente
      else {
        var a = s.regni[i], b = s.regni[con - 1], t = a.sovrano;
        a.sovrano = b.sovrano; b.sovrano = t;
        u.scambio = { da: i + 1, con: con, nuovo: a.sovrano, altro: b.sovrano };
      }
    } else {                                     // commercio: due carte, poi se ne scartano due
      var r2 = pesca(s, 2);
      u.pescate = r2.pescate; u.rimescolato = r2.rimescolato;
      s.fase = 'scarta'; s.daScartare = Math.min(2, s.mano.length);
    }
  }

  function vincePerDibattito(parla, giocata, briscola) {
    if (giocata.seme === parla.seme) return giocata.valore > parla.valore;
    return parla.seme !== briscola && giocata.seme === briscola;
  }

  // La mossa vera e propria. Restituisce un nuovo stato (rifiutata: lo stesso, con `rifiuto`).
  function apply(stato, mossa) {
    function no(testo) { var n = copia(stato); n.rifiuto = testo; return n; }
    if (stato.fine) return no('La partita è finita.');
    if (!mossa || typeof mossa.t !== 'string') return no('Mossa non valida.');
    var f = stato.fase, s, k;
    var TXT_POTERI = 'I consiglieri e gli alleati si usano prima che esca la carta del sovrano, mai dopo.';

    if (mossa.t === 'regno') {
      if (f !== 'scegli') return no('Il regno si sceglie a inizio giro, non adesso.');
      if (!(mossa.n >= 1 && mossa.n <= REGNI) || mossa.n !== Math.floor(mossa.n)) return no('Quel regno non esiste.');
      if (stato.regni[mossa.n - 1].visitato) return no('Quel regno l\'hai già visitato: ogni regno una volta sola.');
      s = copia(stato); s.rifiuto = null;
      s.corrente = mossa.n - 1; s.regni[s.corrente].visitato = true; s.fase = 'tra'; s.fantiUsati = [];
      s.ultimo = { t: 'regno', n: mossa.n, sovrano: s.regni[s.corrente].sovrano };
      return s;
    }

    if (mossa.t === 'apri') {
      if (f === 'scegli') return no('Prima scegli il regno da visitare.');
      if (f === 'risposta') return no('La carta del sovrano è già uscita: devi rispondere.');
      if (f === 'scarta') return no('Prima scarta le carte dei quadri.');
      s = copia(stato); s.rifiuto = null;
      var rim = false;
      if (!s.mazzo.length && s.scarti.length) { s.mazzo = mescola(s.scarti, s); s.scarti = []; rim = true; }
      if (!s.mazzo.length) {                    // scelta di Alfred: mazzo e scarti vuoti insieme, il regno si chiude qui
        s.ultimo = { t: 'apri', carta: null, rimescolato: false };
        chiudiRegno(s, true);
        return s;
      }
      var c = s.mazzo.shift();
      s.scarti.push(c); s.parla = c; s.fase = 'risposta';
      s.ultimo = { t: 'apri', carta: c, rimescolato: rim };
      return s;
    }

    if (mossa.t === 'gioca') {
      if (f === 'scegli') return no('Prima scegli il regno da visitare.');
      if (f === 'tra') return no('Prima apri il dibattito: il sovrano deve parlare.');
      if (f === 'scarta') return no('Prima scarta le carte dei quadri.');
      var giocata = stato.mano.filter(function (x) { return x.id === mossa.carta; })[0];
      if (!giocata) return no('Quella carta non è nella tua mano.');
      var p = stato.parla;
      if (giocata.seme !== p.seme && stato.mano.some(function (x) { return x.seme === p.seme; })) {
        return no('Devi rispondere nel seme: hai ancora una carta di ' + NOME_SEME[p.seme] + '.');
      }
      s = copia(stato); s.rifiuto = null;
      var briscola = s.regni[s.corrente].sovrano.seme;
      var vinto = vincePerDibattito(p, giocata, briscola);
      s.mano = s.mano.filter(function (x) { return x.id !== giocata.id; });
      if (vinto) s.vittorie.push(giocata); else s.scarti.push(giocata);
      s.parla = null; s.fase = 'tra';
      s.ultimo = { t: 'gioca', parla: p, giocata: giocata, vinto: vinto, nelSeme: giocata.seme === p.seme, briscola: briscola };
      if (!s.mano.length) chiudiRegno(s, false);
      return s;
    }

    if (mossa.t === 'fante' || mossa.t === 'alleato') {
      if (f === 'scegli') return no('Prima scegli il regno da visitare.');
      if (f === 'risposta') return no(TXT_POTERI);
      if (f === 'scarta') return no('Prima finisci il potere: scarta le due carte.');
      var seme, idAll = null;
      if (mossa.t === 'fante') {
        seme = mossa.seme;
        if (SEMI.indexOf(seme) < 0) return no('Quel consigliere non esiste.');
        if (stato.fantiUsati.indexOf(seme) >= 0) return no('Questo Fante l\'hai già usato in questo regno.');
      } else {
        var al = stato.alleati.filter(function (a) { return a.carta.id === mossa.id; })[0];
        if (!al) return no('Quella carta non è un tuo alleato.');
        if (al.usato) return no('Questo alleato l\'hai già usato: il suo potere vale una volta sola.');
        seme = al.carta.seme; idAll = al.carta.id;
      }
      var liberi = nonVisitati(stato);
      if (seme === 'P' && liberi.length) {
        if (mossa.con == null) return no('Scegli con quale regno scambiare il sovrano.');
        if (liberi.indexOf(mossa.con) < 0) return no('Si scambia con un regno non ancora visitato.');
      }
      s = copia(stato); s.rifiuto = null;
      if (mossa.t === 'fante') s.fantiUsati.push(seme);
      else s.alleati.forEach(function (a) { if (a.carta.id === idAll) a.usato = true; });
      eseguiPotere(s, seme, mossa.con, mossa.t, idAll);
      if (s.fase === 'tra' && !s.mano.length) chiudiRegno(s, false);   // diplomazia: mano vuota, il regno è finito
      return s;
    }

    if (mossa.t === 'scarta') {
      if (f !== 'scarta') return no('Non devi scartare niente adesso.');
      var ids = mossa.carte || [];
      if (ids.length !== stato.daScartare) return no('Devi scartare ' + (stato.daScartare === 1 ? 'una carta' : 'due carte') + '.');
      if (ids.length === 2 && ids[0] === ids[1]) return no('Hai scelto due volte la stessa carta.');
      for (k = 0; k < ids.length; k++) {
        if (!stato.mano.some(function (x) { return x.id === ids[k]; })) return no('Quella carta non è nella tua mano.');
      }
      s = copia(stato); s.rifiuto = null;
      var via = s.mano.filter(function (x) { return ids.indexOf(x.id) >= 0; });
      s.mano = s.mano.filter(function (x) { return ids.indexOf(x.id) < 0; });
      via.forEach(function (x) { s.scarti.push(x); });
      s.fase = 'tra'; s.daScartare = 0;
      s.ultimo = { t: 'scarta', carte: via };
      if (!s.mano.length) chiudiRegno(s, false);
      return s;
    }
    return no('Mossa non valida.');
  }

  // tutte le mosse possibili ora (per i giocatori automatici delle prove: l'app non le mostra mai)
  function mosseLegali(s) {
    var out = [], f = s.fase;
    if (s.fine) return out;
    if (f === 'scegli') { nonVisitati(s).forEach(function (n) { out.push({ t: 'regno', n: n }); }); return out; }
    if (f === 'risposta') {
      var segue = s.mano.filter(function (c) { return c.seme === s.parla.seme; });
      (segue.length ? segue : s.mano).forEach(function (c) { out.push({ t: 'gioca', carta: c.id }); });
      return out;
    }
    if (f === 'scarta') {
      var m = s.mano, q = s.daScartare;
      if (q === 1) m.forEach(function (c) { out.push({ t: 'scarta', carte: [c.id] }); });
      else for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) out.push({ t: 'scarta', carte: [m[i].id, m[j].id] });
      return out;
    }
    out.push({ t: 'apri' });
    var liberi = nonVisitati(s);
    function poteri(seme, mk) {
      if (seme === 'P' && liberi.length) liberi.forEach(function (n) { var x = mk(); x.con = n; out.push(x); });
      else out.push(mk());
    }
    SEMI.forEach(function (se) {
      if (s.fantiUsati.indexOf(se) < 0) poteri(se, function () { return { t: 'fante', seme: se }; });
    });
    s.alleati.forEach(function (a) {
      if (!a.usato) poteri(a.carta.seme, function () { return { t: 'alleato', id: a.carta.id }; });
    });
    return out;
  }

  function briscola(s) { return s.corrente == null ? null : s.regni[s.corrente].sovrano.seme; }
  function carteNegliScarti(s) { return ordina(s.scarti); }
  // Tutte le 52: mano, mazzo, scarti, vittorie, sovrani sui regni, alleati, più i 4 Fanti e gli 8 segnaposto (sempre fuori gioco).
  function tutteLeCarte(s) {
    var t = s.mano.concat(s.mazzo, s.scarti, s.vittorie);
    s.regni.forEach(function (r) { if (r.sovrano) t.push(r.sovrano); });
    s.alleati.forEach(function (a) { t.push(a.carta); });
    var fissi = mazzoCompleto().filter(function (c) { return eFante(c) || c.valore === 9 || c.valore === 10; });
    return t.concat(fissi).map(function (c) { return c.id; }).sort();
  }

  return {
    SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO, REGNI: REGNI, MANO: MANO,
    nuova: nuova, costruisci: costruisci, apply: apply, mosseLegali: mosseLegali, briscola: briscola,
    punteggio: punteggioDi, nonVisitati: nonVisitati, carteNegliScarti: carteNegliScarti,
    tutteLeCarte: tutteLeCarte, mazzoCompleto: mazzoCompleto, daId: daId, nomeCarta: nomeCarta, sigla: sigla,
    ordina: ordina, eRossa: eRossa, eMazzo: eMazzo
  };
}));
