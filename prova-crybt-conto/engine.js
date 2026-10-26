// CRYBT — prova del conto. Motore: solo il calcolo delle combinazioni del cribbage e il controllo delle dichiarazioni.
// Carta = { r: 1..13 (1 = Asso, 11 J, 12 Q, 13 K), s: 0..3 (picche, cuori, quadri, fiori) }.
// Una combinazione = { tipo: 'quindici'|'coppia'|'scala'|'colore', idx: [indici nella mano, ordinati], punti }.
(function (radice) {
  'use strict';
  var TIPI = ['quindici', 'coppia', 'scala', 'colore'];
  var NOMI = { quindici: 'Quindici', coppia: 'Coppia', scala: 'Scala', colore: 'Colore' };
  var PAROLE = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici',
    'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti', 'ventuno', 'ventidue', 'ventitré',
    'ventiquattro', 'venticinque', 'ventisei', 'ventisette', 'ventotto', 'ventinove'];

  function valore(c) { return Math.min(c.r, 10); }
  function parola(n) { return PAROLE[n] !== undefined ? PAROLE[n] : String(n); }

  function mazzo() { var m = []; for (var s = 0; s < 4; s++) for (var r = 1; r <= 13; r++) m.push({ r: r, s: s }); return m; }

  function casuale(seme) { // mulberry32: stesso seme, stessa mano
    var a = seme >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Mano da 5 carte (le prime quattro + l'eroe, ultima) e mostro scoperto. La mano è mostrata in ordine di valore.
  function dai(seme) {
    var m = mazzo(), rnd = casuale(seme);
    for (var i = m.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = m[i]; m[i] = m[j]; m[j] = t; }
    var eroe = m[4], mano = m.slice(0, 5);
    mano.sort(function (a, b) { return a.r - b.r || a.s - b.s; });
    var mostro = m[5];
    return { mano: mano, eroeIdx: mano.indexOf(eroe), mostro: mostro, forza: valore(mostro) + 1 };
  }

  function sottoinsiemi(n) { var out = []; for (var k = 1; k < (1 << n); k++) { var v = []; for (var i = 0; i < n; i++) if (k & (1 << i)) v.push(i); out.push(v); } return out; }
  function chiave(tipo, idx) { return tipo + ':' + idx.join(','); }

  // Controlla se le carte scelte (idx) sono davvero una combinazione del tipo dichiarato. Non dice mai cosa manca: solo perché no.
  function riconosci(mano, tipo, idx) {
    var c = idx.map(function (i) { return mano[i]; }), n = c.length, i;
    if (!n) return { ok: false, perche: 'Tocca prima le carte.' };
    if (tipo === 'quindici') {
      var somma = 0; for (i = 0; i < n; i++) somma += valore(c[i]);
      return somma === 15 ? { ok: true, punti: 2 } : { ok: false, perche: 'Queste carte non fanno quindici.' };
    }
    if (tipo === 'coppia') {
      if (n !== 2) return { ok: false, perche: 'Una coppia è fatta di due carte.' };
      return c[0].r === c[1].r ? { ok: true, punti: 2 } : { ok: false, perche: 'Non sono due carte uguali.' };
    }
    if (tipo === 'scala') {
      if (n < 3) return { ok: false, perche: 'Una scala ha almeno tre carte.' };
      var r = c.map(function (x) { return x.r; }).sort(function (a, b) { return a - b; });
      for (i = 1; i < n; i++) if (r[i] !== r[i - 1] + 1) return { ok: false, perche: 'Queste carte non fanno una scala.' };
      var presenti = {}; mano.forEach(function (x) { presenti[x.r] = true; });
      if (presenti[r[0] - 1] || presenti[r[n - 1] + 1]) return { ok: false, perche: 'La scala si dichiara per intero.' };
      return { ok: true, punti: n };
    }
    if (tipo === 'colore') {
      if (n < 4) return { ok: false, perche: 'Il colore vuole almeno quattro carte.' };
      for (i = 1; i < n; i++) if (c[i].s !== c[0].s) return { ok: false, perche: 'Non sono tutte dello stesso seme.' };
      var tutte = mano.filter(function (x) { return x.s === c[0].s; }).length;
      if (tutte !== n) return { ok: false, perche: 'Il colore si dichiara per intero.' };
      return { ok: true, punti: n };
    }
    return { ok: false, perche: 'Scegli che combinazione è.' };
  }

  // Tutte le combinazioni che la mano contiene (ogni combinazione una volta sola).
  function combinazioni(mano) {
    var out = [];
    sottoinsiemi(mano.length).forEach(function (idx) {
      TIPI.forEach(function (tipo) { var v = riconosci(mano, tipo, idx); if (v.ok) out.push({ tipo: tipo, idx: idx, punti: v.punti }); });
    });
    return out;
  }
  function totale(lista) { return lista.reduce(function (s, x) { return s + x.punti; }, 0); }

  // Dichiarazione: controlla e, se va, dice la formula col totale che sale.
  function dichiara(mano, tipo, idx, dichiarate) {
    idx = idx.slice().sort(function (a, b) { return a - b; });
    var v = riconosci(mano, tipo, idx);
    if (!v.ok) return { ok: false, perche: v.perche };
    if (dichiarate.some(function (d) { return chiave(d.tipo, d.idx) === chiave(tipo, idx); })) return { ok: false, perche: 'Questa l’hai già dichiarata.' };
    var comb = { tipo: tipo, idx: idx, punti: v.punti };
    var nuovo = totale(dichiarate) + v.punti;
    return { ok: true, comb: comb, totale: nuovo, formula: NOMI[tipo] + ' ' + parola(nuovo) };
  }

  // Le combinazioni sfuggite: nell'ordine in cui le leggerebbe un giocatore (quindici, coppie, scale, colore).
  function sfuggite(mano, dichiarate) {
    var fatte = {}; dichiarate.forEach(function (d) { fatte[chiave(d.tipo, d.idx)] = true; });
    return combinazioni(mano).filter(function (c) { return !fatte[chiave(c.tipo, c.idx)]; })
      .sort(function (a, b) { return TIPI.indexOf(a.tipo) - TIPI.indexOf(b.tipo) || a.idx.length - b.idx.length || a.idx.join().localeCompare(b.idx.join()); });
  }

  // Esito. I punti sfuggiti sono persi (non entrano nel tuo totale); il mostro prende +1 di forza per ogni combinazione sfuggita, non i suoi punti.
  function esito(forza, dichiarate, mancate) {
    var tuoi = totale(dichiarate), persi = totale(mancate), bersaglio = forza + mancate.length;
    return { tuoi: tuoi, persi: persi, sfuggite: mancate.length, bersaglio: bersaglio, vinto: tuoi >= bersaglio, danni: Math.max(0, bersaglio - tuoi) };
  }

  var API = { TIPI: TIPI, NOMI: NOMI, valore: valore, parola: parola, mazzo: mazzo, dai: dai, riconosci: riconosci, combinazioni: combinazioni,
    totale: totale, dichiara: dichiara, sfuggite: sfuggite, esito: esito, chiave: chiave };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else radice.Conto = API;
})(typeof window !== 'undefined' ? window : this);
