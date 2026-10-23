/*
 * Card Capture (titolo provvisorio) — il motore delle regole.
 * Di Lucas Gentry; variante a due fasi di Ayaskant Panigrahi; poteri dei semi da
 * un'espansione di synbeelabs (crediti: vedi app.js, un punto solo).
 *
 * Non tocca il DOM, non usa il tempo, non usa Math.random: dato un seme e una lista
 * di mosse la partita è sempre la stessa. Gira in node e nel browser (nel browser si
 * chiama `CardCapture`). Regole: owner inbox/card-capture-regole-2026-10-22.md.
 *
 * Carte: { id, seme, valore } — semi C cuori, Q quadri, F fiori, P picche; valori 2-10,
 * 11 Fante, 12 Donna, 13 Re, 14 Asso. Jolly: { id:'X1'|'X2', seme:'X', valore:0, jolly:true }.
 * id = seme + valore ("F11" = Fante di fiori).
 * Mazzi (mazzo tuo, mazzo nemico, supporto): la prima carta [0] è la cima, il fondo è in coda.
 * Fila nemica: array di 4, indice 0 = posizione 1 (la più lontana dal mazzo nemico).
 *
 * Il turno ha quattro fasi. Nemica e pesca vanno da sole dentro `apply`; il giocatore
 * muove solo nei punti in cui c'è da scegliere. `passo` dice quale mossa si aspetta:
 *   'scarto'      { t:'scarta', carte:[id...] }      (lista vuota = niente da scartare)
 *   'cuoriPrima'  { t:'scartaUna', carta:id }        (cuori difficile, prima della fase nemica)
 *   'cuoriDopo'   { t:'scartaUna', carta:id }        (cuori facile, dopo la pesca a 5)
 *   'cattura'     { t:'cattura', azione:'A', mie:[id], bersaglio:id, parziale?:bool, alNemico?:id }
 *                 { t:'cattura', azione:'B', carta:id, posizione?:1|2 }
 *                 { t:'cattura', azione:'C', mie:[id,id], bersaglio:id }
 *   'passaggio'   { t:'seconda' }                    (due fasi: prima fase vinta)
 *   'fine'        niente (fine !== null)
 *
 * apply(stato, mossa) restituisce SEMPRE un nuovo stato. Se la mossa è rifiutata lo stato
 * è identico tranne `rifiuto` (il perché, corto, in italiano). Se è accettata `rifiuto` è
 * null e `cronaca` racconta cosa è successo (frasi corte, anche delle fasi automatiche).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardCapture = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMI = ['C', 'Q', 'F', 'P'];
  var NERI = ['F', 'P'], ROSSI = ['C', 'Q'];
  var NOME_SEME = { C: 'cuori', Q: 'quadri', F: 'fiori', P: 'picche' };
  var SIMBOLO = { C: '♥', Q: '♦', F: '♣', P: '♠' };
  var NOME_VALORE = { 11: 'F', 12: 'D', 13: 'R', 14: 'A' };
  var POTERI = {
    C: { facile: 'in fase di pesca arrivi a 5 carte, poi ne scarti una', difficile: 'prima della fase nemica scarti una carta' },
    Q: { facile: 'con la B puoi dare al nemico la posizione 1 o la 2', difficile: 'non puoi usare la B' },
    F: { facile: 'puoi guardare i tuoi scarti nella fase di scarto', difficile: 'non puoi usare il jolly' },
    P: { facile: 'una delle carte spese vale +1', difficile: 'una delle carte spese vale −1' }
  };
  var LIVELLI = ['spento', 'facile', 'difficile'];

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
  function jolly(n) { return { id: 'X' + n, seme: 'X', valore: 0, jolly: true }; }
  function daId(id) { return id[0] === 'X' ? jolly(+id.slice(1)) : carta(id[0], +id.slice(1)); }
  function isFigura(c) { return !c.jolly && c.valore >= 11; }      // Fante, Donna, Re e Asso
  function isNera(c) { return NERI.indexOf(c.seme) >= 0; }
  function etichetta(c) {
    if (c.jolly) return 'Jolly';
    return (NOME_VALORE[c.valore] || c.valore) + SIMBOLO[c.seme];
  }
  function elenco(cs) { return cs.map(etichetta).join(', '); }
  function numeri(da, a, semi) {
    var m = [];
    semi.forEach(function (se) { for (var v = da; v <= a; v++) m.push(carta(se, v)); });
    return m;
  }
  function trovaId(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i] && lista[i].id === id) return i;
    return -1;
  }
  function senza(lista, ids) { return lista.filter(function (c) { return ids.indexOf(c.id) < 0; }); }
  function quante(n, uno, molti) { return n + ' ' + (n === 1 ? uno : molti); }
  function num(x) { return String(x).replace('.', ','); }

  function opzioniNormali(o) {
    o = o || {};
    var p = {};
    SEMI.forEach(function (se) {
      var v = o.poteri && o.poteri[se];
      p[se] = LIVELLI.indexOf(v) >= 0 ? v : 'spento';
    });
    return { dueFasi: !!o.dueFasi, poteri: p };
  }

  function copia(s) {
    var n = {};
    Object.keys(s).forEach(function (k) { n[k] = s[k]; });
    ['fila', 'mazzoNemico', 'pilaNemica', 'supporto', 'fuori', 'riserva', 'mano', 'mazzo', 'scarti', 'cronaca']
      .forEach(function (k) { n[k] = s[k].slice(); });
    return n;
  }

  // ---------- partenza ----------
  function nuova(seme, opzioni) {
    var o = opzioniNormali(opzioni);
    var s = {
      seme: String(seme), rng: xmur3(String(seme)), opzioni: o,
      fase: o.dueFasi ? 'prima' : 'unica', turno: 0, passo: null,
      fila: [null, null, null, null], mazzoNemico: [], pilaNemica: [], supporto: [], fuori: [], riserva: [],
      mano: [], mazzo: [], scarti: [], attivo: null, prossimo: null,
      fine: null, rifiuto: null, cronaca: []
    };
    if (o.dueFasi) {
      s.mazzo = mescola(numeri(2, 4, NERI).concat([jolly(1)]), s);
      s.mazzoNemico = mescola(numeri(5, 14, NERI), s);
      s.riserva = numeri(5, 14, ROSSI).concat(numeri(2, 4, ROSSI), [jolly(2)]);
    } else {
      s.mazzo = mescola(numeri(2, 4, SEMI).concat([jolly(1), jolly(2)]), s);
      s.mazzoNemico = mescola(numeri(5, 14, SEMI), s);
    }
    stesura(s);
    iniziaTurno(s);
    return s;
  }

  // La prima stesura: quattro carte in fila (la prima in posizione 1); figure e Assi tornano
  // in fondo al mazzo nemico e i loro posti restano vuoti fino alla fase nemica.
  function stesura(s) {
    s.fila = [null, null, null, null];
    for (var i = 0; i < 4 && s.mazzoNemico.length; i++) s.fila[i] = s.mazzoNemico.shift();
    for (i = 0; i < 4; i++) {
      if (s.fila[i] && isFigura(s.fila[i])) { s.mazzoNemico.push(s.fila[i]); s.fila[i] = null; }
    }
  }

  // ---------- il turno ----------
  function iniziaTurno(s) {
    s.turno++;
    s.attivo = s.prossimo; s.prossimo = null;
    if (s.attivo) s.cronaca.push('Potere del turno: ' + NOME_SEME[s.attivo.seme] + ' ' + s.attivo.livello + ', ' + POTERI[s.attivo.seme][s.attivo.livello] + '.');
    if (s.attivo && s.attivo.seme === 'C' && s.attivo.livello === 'difficile' && s.mano.length) {
      s.passo = 'cuoriPrima';
      return;
    }
    faseNemica(s);
    s.passo = 'scarto';
  }

  // Le carte scorrono verso la posizione 1 a riempire i buchi, poi entrano le nuove (la
  // prima pescata nel posto più basso libero). A mazzo nemico finito la fase si salta.
  function faseNemica(s) {
    if (!s.mazzoNemico.length) { s.cronaca.push('Fase nemica saltata: il mazzo nemico è finito.'); return; }
    var f = s.fila.filter(Boolean), entrate = [];
    while (f.length < 4 && s.mazzoNemico.length) { var c = s.mazzoNemico.shift(); f.push(c); entrate.push(c); }
    while (f.length < 4) f.push(null);
    s.fila = f;
    s.cronaca.push(entrate.length ? 'Fase nemica: entra ' + elenco(entrate) + '.' : 'Fase nemica: la fila è piena.');
  }

  function pesca(s, fino) {
    var prese = [];
    while (s.mano.length < fino) {
      if (!s.mazzo.length) {
        if (!s.scarti.length) break;
        s.mazzo = mescola(s.scarti, s); s.scarti = [];
        s.cronaca.push('Mazzo finito: i tuoi scarti sono stati rimescolati.');
      }
      var c = s.mazzo.shift(); s.mano.push(c); prese.push(c);
    }
    return prese;
  }

  function fasePesca(s) {
    var facile = s.attivo && s.attivo.seme === 'C' && s.attivo.livello === 'facile';
    var prese = pesca(s, facile ? 5 : 4);
    s.cronaca.push(prese.length ? 'Peschi ' + quante(prese.length, 'carta', 'carte') + '.' : 'Non hai carte da pescare.');
    if (facile && s.mano.length === 5) { s.passo = 'cuoriDopo'; return; }
    inizioCattura(s);
  }

  function inizioCattura(s) {
    s.passo = 'cattura';
    if (!azioniPossibili(s)) perdi(s, 'bloccato');
  }

  function perdi(s, motivo) {
    s.passo = 'fine';
    s.fine = { esito: 'sconfitta', motivo: motivo, parziale: s.opzioni.dueFasi && s.fase === 'seconda' };
    s.cronaca.push(motivo === 'bloccato' ? 'Non hai nessuna azione possibile: hai perso.' : 'Una figura è finita al nemico: hai perso.');
  }

  function finisciCattura(s) {
    if (s.pilaNemica.some(isFigura)) { perdi(s, 'figura'); return; }
    if (!s.mazzoNemico.length && !s.fila.some(Boolean)) {
      if (s.opzioni.dueFasi && s.fase === 'prima') {
        s.passo = 'passaggio'; s.prossimo = null; s.attivo = null;
        s.cronaca.push('Prima fase vinta!');
      } else {
        s.passo = 'fine';
        s.fine = { esito: 'vittoria', motivo: 'tutto-catturato', parziale: false };
        s.cronaca.push('Hai catturato tutto: hai vinto!');
      }
      return;
    }
    iniziaTurno(s);
  }

  // ---------- il passaggio fra le fasi ----------
  function secondaFase(s) {
    var mie = s.mano.concat(s.mazzo, s.scarti);            // «il tuo mazzo» = tutte le tue carte
    var figure = mie.filter(isFigura);
    var resto = mie.filter(function (c) { return !isFigura(c); });
    var rossi5 = s.riserva.filter(function (c) { return !c.jolly && c.valore >= 5; });
    var rossi2 = s.riserva.filter(function (c) { return !c.jolly && c.valore < 5; });
    var secondoJolly = s.riserva.filter(function (c) { return c.jolly; });
    var sup = [];
    s.pilaNemica.forEach(function (c) { if (c.jolly) s.fuori.push(c); else sup.push(c); });   // il jolly come supporto si salta
    s.supporto = mescola(sup, s);
    s.pilaNemica = [];
    s.mazzoNemico = mescola(figure.concat(rossi5), s);
    s.mazzo = mescola(resto.concat(rossi2, secondoJolly), s);
    s.mano = []; s.scarti = []; s.riserva = [];
    s.fase = 'seconda';
    s.cronaca.push('Seconda fase: ' + quante(figure.length, 'figura nera torna', 'figure nere tornano') + ' al nemico, il supporto ha ' + quante(s.supporto.length, 'carta', 'carte') + '.');
    stesura(s);
    iniziaTurno(s);
  }

  // ---------- poteri ----------
  function potere(s, seme, livello) {
    return !!(s.attivo && s.attivo.seme === seme && s.attivo.livello === livello);
  }
  function puoiGuardareScarti(s) { return potere(s, 'F', 'facile') && s.passo === 'scarto' && !s.fine; }

  // ---------- la cattura A: i conti ----------
  function modPicche(s) { return potere(s, 'P', 'facile') ? 1 : (potere(s, 'P', 'difficile') ? -1 : 0); }
  function serveSupporto(s, bersaglio) {
    return s.opzioni.dueFasi && s.fase === 'seconda' && isFigura(bersaglio) && isNera(bersaglio) && s.supporto.length > 0;
  }
  function valoreSupporto(sup, bersaglio) { return sup.seme === bersaglio.seme ? sup.valore : sup.valore / 2; }
  // carta (non jolly) della mano, dello stesso seme, che il jolly copia: di default la più alta
  function copiabile(s, seme) {
    var best = null;
    s.mano.forEach(function (c) { if (!c.jolly && c.seme === seme && (!best || c.valore > best.valore)) best = c; });
    return best;
  }
  // totale delle carte spese `mie` contro un bersaglio; { errore } oppure { totale, copie }
  function conta(s, mie, bersaglio, copieScelte) {
    var totale = 0, copie = {};
    for (var i = 0; i < mie.length; i++) {
      var c = mie[i];
      if (!c.jolly) {
        if (c.seme !== bersaglio.seme) return { errore: etichetta(c) + ' non è di ' + NOME_SEME[bersaglio.seme] + ', come ' + etichetta(bersaglio) + '.' };
        totale += c.valore;
      }
    }
    for (i = 0; i < mie.length; i++) {
      if (!mie[i].jolly) continue;
      var scelta = copieScelte && copieScelte[mie[i].id], da;
      if (scelta) {
        var k = trovaId(s.mano, scelta); da = k >= 0 ? s.mano[k] : null;
        if (!da || da.jolly || da.seme !== bersaglio.seme) return { errore: 'Il jolly deve copiare una carta di ' + NOME_SEME[bersaglio.seme] + ' della tua mano.' };
      } else {
        da = copiabile(s, bersaglio.seme);
        if (!da) return { errore: 'Il jolly non ha nessuna carta di ' + NOME_SEME[bersaglio.seme] + ' da copiare.' };
      }
      copie[mie[i].id] = da.id; totale += da.valore;
    }
    if (mie.length) totale += modPicche(s);
    return { totale: totale, copie: copie };
  }
  // il massimo che la mano può spendere contro un bersaglio (per sapere se c'è un'azione)
  function massimo(s, bersaglio) {
    var mie = s.mano.filter(function (c) { return c.jolly ? !potere(s, 'F', 'difficile') : c.seme === bersaglio.seme; });
    if (!mie.length) return -Infinity;
    var r = conta(s, mie, bersaglio);
    if (r.errore) {                       // jolly senza carta da copiare: si lasciano fuori
      mie = mie.filter(function (c) { return !c.jolly; });
      if (!mie.length) return -Infinity;
      r = conta(s, mie, bersaglio);
    }
    return r.totale;
  }

  function puoB(s) {
    if (potere(s, 'Q', 'difficile') || !s.mano.length) return false;
    return !!(s.fila[0] || (potere(s, 'Q', 'facile') && s.fila[1]));
  }
  function puoC(s) { return s.mano.length >= 2 && s.fila.some(Boolean); }
  function puoA(s) {
    return s.fila.some(function (b) {
      if (!b) return false;
      return massimo(s, b) >= b.valore;     // anche con supporto basta la cattura parziale (solo la figura)
    });
  }
  function azioniPossibili(s) { return puoB(s) || puoC(s) || puoA(s); }

  // ---------- apply ----------
  function rifiuta(stato, perche) {
    var n = copia(stato); n.rifiuto = perche; return n;
  }
  function nomePasso(p) {
    return { scarto: 'la fase di scarto', cuoriPrima: 'lo scarto dei cuori', cuoriDopo: 'lo scarto dei cuori',
      cattura: 'la fase di cattura', passaggio: 'il passaggio alla seconda fase', fine: 'la fine' }[p] || p;
  }
  function listaCarte(s, ids) {                     // carte della mano dagli id, senza doppioni; null se qualcosa non va
    if (!Array.isArray(ids)) return null;
    var r = [];
    for (var i = 0; i < ids.length; i++) {
      var k = trovaId(s.mano, ids[i]);
      if (k < 0 || r.indexOf(s.mano[k]) >= 0) return null;
      r.push(s.mano[k]);
    }
    return r;
  }

  function apply(stato, mossa) {
    if (stato.fine) return rifiuta(stato, 'La partita è finita.');
    if (!mossa || !mossa.t) return rifiuta(stato, 'Mossa non riconosciuta.');
    var s = copia(stato);
    s.rifiuto = null; s.cronaca = [];
    var r;
    if (mossa.t === 'scarta') {
      if (s.passo !== 'scarto') return rifiuta(stato, 'Ora non si scarta: siamo in ' + nomePasso(s.passo) + '.');
      var cs = listaCarte(s, mossa.carte || []);
      if (!cs) return rifiuta(stato, 'Puoi scartare solo carte della tua mano.');
      s.mano = senza(s.mano, cs.map(function (c) { return c.id; }));
      s.scarti = s.scarti.concat(cs);
      s.cronaca.push(cs.length ? 'Scarti ' + elenco(cs) + '.' : 'Niente da scartare.');
      fasePesca(s);
      return s;
    }
    if (mossa.t === 'scartaUna') {
      if (s.passo !== 'cuoriPrima' && s.passo !== 'cuoriDopo') return rifiuta(stato, 'Ora non si scarta: siamo in ' + nomePasso(s.passo) + '.');
      var k = trovaId(s.mano, mossa.carta);
      if (k < 0) return rifiuta(stato, 'Scegli una carta della tua mano.');
      var c = s.mano[k];
      s.mano.splice(k, 1); s.scarti.push(c);
      s.cronaca.push('Scarti ' + etichetta(c) + ' (potere dei cuori).');
      if (s.passo === 'cuoriPrima') { faseNemica(s); s.passo = 'scarto'; } else inizioCattura(s);
      return s;
    }
    if (mossa.t === 'seconda') {
      if (s.passo !== 'passaggio') return rifiuta(stato, 'Non c\'è nessuna seconda fase da cominciare.');
      secondaFase(s);
      return s;
    }
    if (mossa.t === 'cattura') {
      if (s.passo !== 'cattura') return rifiuta(stato, 'Ora non si cattura: siamo in ' + nomePasso(s.passo) + '.');
      r = cattura(s, mossa);
      if (r) return rifiuta(stato, r);
      finisciCattura(s);
      return s;
    }
    return rifiuta(stato, 'Mossa non riconosciuta.');
  }

  // Esegue la cattura su `s` (già copia). Ritorna una stringa di rifiuto, oppure null se fatta.
  function cattura(s, m) {
    if (m.azione === 'A') return azioneA(s, m);
    if (m.azione === 'B') return azioneB(s, m);
    if (m.azione === 'C') return azioneC(s, m);
    return 'Scegli A, B o C.';
  }

  function azioneA(s, m) {
    var mie = listaCarte(s, m.mie || []);
    if (!mie) return 'Puoi spendere solo carte della tua mano.';
    if (!mie.length) return 'Scegli le carte da spendere.';
    var ib = trovaId(s.fila, m.bersaglio);
    if (ib < 0) return 'Scegli una carta della fila nemica.';
    var b = s.fila[ib];
    if (potere(s, 'F', 'difficile') && mie.some(function (c) { return c.jolly; })) return 'Con i fiori difficili il jolly non si può usare.';
    var cnt = conta(s, mie, b, m.copie);
    if (cnt.errore) return cnt.errore;
    var T = cnt.totale, sup = null, doppia = false;
    if (serveSupporto(s, b)) {
      sup = s.supporto[0];
      if (!m.parziale) {
        doppia = true;
        var serve = b.valore + valoreSupporto(sup, b);
        if (T < serve) return 'Con il supporto ' + etichetta(sup) + ' servono almeno ' + num(serve) + ': le tue carte fanno ' + T + '.';
      }
    }
    if (!doppia && T < b.valore) return 'Le tue carte fanno ' + T + ': per ' + etichetta(b) + ' ne servono almeno ' + b.valore + '.';
    var ids = mie.map(function (c) { return c.id; });
    var dettaglioJolly = Object.keys(cnt.copie).map(function (j) {
      return 'il jolly fa da ' + etichetta(daId(cnt.copie[j]));
    });
    var nome = etichetta(b);
    if (doppia) {
      var coinvolte = mie.concat([b, sup]);
      var ik = trovaId(coinvolte, m.alNemico);
      if (ik < 0) return 'Scegli quale carta va al nemico, tra quelle della cattura.';
      var al = coinvolte[ik];
      s.mano = senza(s.mano, ids);
      s.fila[ib] = null; s.supporto.shift();
      s.pilaNemica.push(al);
      s.scarti = s.scarti.concat(coinvolte.filter(function (c) { return c !== al; }));
      s.cronaca.push('Cattura doppia: ' + nome + ' e il supporto ' + etichetta(sup) + ' con ' + elenco(mie) +
        (dettaglioJolly.length ? ' (' + dettaglioJolly.join(', ') + ')' : '') + '. Al nemico va ' + etichetta(al) + '.');
    } else if (sup) {
      s.mano = senza(s.mano, ids);
      s.fila[ib] = null; s.mazzoNemico.push(b);
      s.scarti = s.scarti.concat(mie);
      s.cronaca.push('Cattura parziale: ' + nome + ' torna in fondo al mazzo nemico, il supporto ' + etichetta(sup) + ' resta. Spese: ' + elenco(mie) + '.');
      return null;                         // la figura non è catturata: nessun potere
    } else {
      s.mano = senza(s.mano, ids);
      s.fila[ib] = null;
      s.scarti = s.scarti.concat(mie, [b]);
      s.cronaca.push('Catturi ' + nome + ' con ' + elenco(mie) + (dettaglioJolly.length ? ' (' + dettaglioJolly.join(', ') + ')' : '') + '.');
    }
    if (isFigura(b) && s.opzioni.poteri[b.seme] !== 'spento') {
      s.prossimo = { seme: b.seme, livello: s.opzioni.poteri[b.seme] };
      s.cronaca.push('Scatta il potere ' + s.opzioni.poteri[b.seme] + ' dei ' + NOME_SEME[b.seme] + ' per il turno dopo.');
    }
    return null;
  }

  function azioneB(s, m) {
    if (potere(s, 'Q', 'difficile')) return 'Con i quadri difficili non puoi usare la B.';
    var pos = m.posizione || 1;
    if (pos !== 1 && !(pos === 2 && potere(s, 'Q', 'facile'))) return 'La B vale solo per la posizione 1.';
    var n = s.fila[pos - 1];
    if (!n) return pos === 1 ? 'Nessuna carta in posizione 1: il nemico non può catturare.' : 'La posizione ' + pos + ' è vuota.';
    var k = trovaId(s.mano, m.carta);
    if (k < 0) return 'Scegli una carta della tua mano da dare al nemico.';
    var mia = s.mano[k];
    s.mano.splice(k, 1);
    s.fila[pos - 1] = null;
    s.pilaNemica.push(n, mia);
    s.cronaca.push('Ti fai catturare: ' + etichetta(n) + ' (posizione ' + pos + ') e ' + etichetta(mia) + ' vanno nella pila nemica.');
    return null;
  }

  function azioneC(s, m) {
    var mie = listaCarte(s, m.mie || []);
    if (!mie || mie.length !== 2) return 'Il sacrificio vuole esattamente due carte della tua mano.';
    var ib = trovaId(s.fila, m.bersaglio);
    if (ib < 0) return 'Scegli una carta della fila nemica da mandare in fondo al mazzo.';
    var b = s.fila[ib];
    s.mano = senza(s.mano, mie.map(function (c) { return c.id; }));
    s.pilaNemica = s.pilaNemica.concat(mie);
    s.fila[ib] = null; s.mazzoNemico.push(b);
    s.cronaca.push('Sacrificio: ' + elenco(mie) + ' vanno nella pila nemica, ' + etichetta(b) + ' torna in fondo al mazzo nemico.');
    return null;
  }

  // ---------- elenco delle mosse legali (per i controlli e per i giocatori automatici; l'app non lo usa) ----------
  function sottoinsiemi(lista, minimo) {
    var r = [], n = lista.length;
    for (var mask = 1; mask < (1 << n); mask++) {
      var q = [];
      for (var i = 0; i < n; i++) if (mask & (1 << i)) q.push(lista[i]);
      if (q.length >= minimo) r.push(q);
    }
    return r;
  }
  function mosseLegali(s) {
    var out = [], cand = [];
    var ids = function (cs) { return cs.map(function (c) { return c.id; }); };
    if (s.fine) return out;
    if (s.passo === 'scarto') {
      cand.push({ t: 'scarta', carte: [] });
      sottoinsiemi(s.mano, 1).forEach(function (q) { cand.push({ t: 'scarta', carte: ids(q) }); });
    } else if (s.passo === 'cuoriPrima' || s.passo === 'cuoriDopo') {
      s.mano.forEach(function (c) { cand.push({ t: 'scartaUna', carta: c.id }); });
    } else if (s.passo === 'passaggio') {
      cand.push({ t: 'seconda' });
    } else if (s.passo === 'cattura') {
      var righe = s.fila.filter(Boolean);
      [1, 2].forEach(function (p) { s.mano.forEach(function (c) { cand.push({ t: 'cattura', azione: 'B', carta: c.id, posizione: p }); }); });
      sottoinsiemi(s.mano, 2).filter(function (q) { return q.length === 2; }).forEach(function (q) {
        righe.forEach(function (b) { cand.push({ t: 'cattura', azione: 'C', mie: ids(q), bersaglio: b.id }); });
      });
      sottoinsiemi(s.mano, 1).forEach(function (q) {
        righe.forEach(function (b) {
          var base = { t: 'cattura', azione: 'A', mie: ids(q), bersaglio: b.id };
          cand.push(base);
          cand.push(Object.assign({}, base, { parziale: true }));
          if (serveSupporto(s, b) && s.supporto.length) {
            q.concat([b, s.supporto[0]]).forEach(function (x) { cand.push(Object.assign({}, base, { alNemico: x.id })); });
          }
        });
      });
    }
    cand.forEach(function (m) { if (!apply(s, m).rifiuto) out.push(m); });
    return out;
  }

  // ---------- costruire uno stato a mano (prove e demo) ----------
  function lista(x) {
    if (!x) return [];
    if (typeof x === 'string') x = x.trim() ? x.trim().split(/\s+/) : [];
    return x.map(daId);
  }
  function costruisci(p) {
    p = p || {};
    var s = nuova('costruito', p.opzioni);
    s.turno = p.turno || 1;
    s.fase = p.fase || s.fase;
    s.mano = lista(p.mano); s.mazzo = lista(p.mazzo); s.scarti = lista(p.scarti);
    s.mazzoNemico = lista(p.mazzoNemico); s.pilaNemica = lista(p.pilaNemica);
    s.supporto = lista(p.supporto); s.riserva = lista(p.riserva); s.fuori = lista(p.fuori);
    var f = p.fila || [];
    if (typeof f === 'string') f = f.trim().split(/\s+/).map(function (x) { return x === '-' ? null : x; });
    s.fila = [0, 1, 2, 3].map(function (i) { return f[i] ? daId(f[i]) : null; });
    s.attivo = p.attivo || null; s.prossimo = p.prossimo || null;
    s.passo = p.passo || 'cattura';
    s.fine = null; s.rifiuto = null; s.cronaca = [];
    return s;
  }
  function tutteLeCarte(s) {
    var r = [];
    ['mano', 'mazzo', 'scarti', 'mazzoNemico', 'pilaNemica', 'supporto', 'riserva', 'fuori'].forEach(function (k) {
      s[k].forEach(function (c) { r.push(c.id); });
    });
    s.fila.forEach(function (c) { if (c) r.push(c.id); });
    return r.sort();
  }

  return {
    nuova: nuova, apply: apply, costruisci: costruisci, mosseLegali: mosseLegali,
    azioniPossibili: azioniPossibili, puoiGuardareScarti: puoiGuardareScarti, serveSupporto: serveSupporto,
    tutteLeCarte: tutteLeCarte, interno: { stesura: stesura, faseNemica: faseNemica, iniziaTurno: iniziaTurno }, daId: daId, etichetta: etichetta, isFigura: isFigura, isNera: isNera,
    SEMI: SEMI, NOME_SEME: NOME_SEME, SIMBOLO: SIMBOLO, POTERI: POTERI, LIVELLI: LIVELLI, NOME_VALORE: NOME_VALORE
  };
}));
