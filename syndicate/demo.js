/*
 * Syndicate — la demo: due scene preparate dagli esempi del libro (pp. 40-42), sempre uguali.
 * Scena 'preparazione': la partenza di p. 40 (colonne da 9, 7, 5, 3 e 1 candidati; le 15 carte rimaste
 *   fra cui scegliere i tre membri, 6♣ 5♦ 4♠ come nel libro).
 * Scena 'finale': il tavolo di p. 42 («the endgame of the earlier example») e le cinque mosse che portano alla vittoria.
 *   Il libro mostra i membri sovrapposti; il grado 1 ha solo 5♦ e 3♠: è l'unico modo in cui le cinque mosse
 *   tornano (la quarta porta il 3♣ nel grado 1 senza sacrificare, la quinta lo promuove da un grado con 3 membri).
 *   Le 15 carte che il tavolo non mostra sono «fuori»: il libro non dice quante fossero sacrificate.
 * Ogni passo ha una frase e, se serve, una mossa: `rifiuto:true` vuol dire che il motore deve rifiutarla
 * (la demo mostra il perché e non la fa), altrimenti la mossa si fa. Ogni rifiuto ha `motivo`: un pezzo del testo
 * che il motore deve dare (la prova controlla che arrivi da lì). Un passo con `scena` cambia il tavolo quando ci si arriva.
 * Nel browser si chiama `SyndicateDemo`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.SyndicateDemo = factory(root.Syndicate);
}(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';
  var TUTTI = S.mazzoCompleto().map(function (c) { return c.id; });
  function resto(usate) { return TUTTI.filter(function (id) { return usate.indexOf(id) < 0; }); }
  function L(t) { return t.trim().split(/\s+/); }

  // p. 40: le cinque colonne di candidati, dall'alto in basso
  var COLONNE = {
    5: L('F2 P3 C9 C4 C3 F8 F7 P9 Q10'),
    4: L('Q4 C8 F1 Q9 P7 Q6 F5'),
    3: L('C10 C6 F4 Q7 F9'),
    2: L('C1 C5 F3'),
    1: L('P8')
  };
  function preparazione() {
    var usate = [].concat(COLONNE[5], COLONNE[4], COLONNE[3], COLONNE[2], COLONNE[1]);
    var scelte = L('F6 Q5 P4');
    return S.costruisci({ seme: 'demo-1',
      gradi: { 5: { candidati: COLONNE[5] }, 4: { candidati: COLONNE[4] }, 3: { candidati: COLONNE[3] },
               2: { candidati: COLONNE[2] }, 1: { candidati: COLONNE[1] } },
      resto: resto(usate.filter(function (id) { return scelte.indexOf(id) < 0; })) });   // 12 diverse + le 3 scelte = 15
  }
  // p. 42
  function finale() {
    var g = {
      5: { membri: L('F2 Q10 F8'), candidati: L('C9 C4') },
      4: { membri: L('P4 P9 Q6'), candidati: L('Q4 F7 F5') },
      3: { membri: L('C3 Q9 Q7'), candidati: L('C6 F4 F1 P7') },
      2: { membri: L('C5 F3 F9'), candidati: L('C1') },
      1: { membri: L('Q5 P3'), candidati: L('P8') }
    };
    var usate = [];
    Object.keys(g).forEach(function (k) { usate = usate.concat(g[k].membri, g[k].candidati); });
    return S.costruisci({ seme: 'demo-2', gradi: g, escluse: resto(usate) });
  }
  function nuova() { return preparazione(); }
  function scena(nome) { return nome === 'finale' ? finale() : preparazione(); }

  function prom(carta, dove, sostituto, sacrifica) {
    return { t: 'promuovi', carta: carta, dove: dove, sostituto: sostituto, sacrifica: sacrifica || null };
  }

  var passi = [
    { testo: 'Syndicate è un rompicapo: dopo la preparazione la fortuna non c\'entra più. Le cinque colonne sono i gradi della mafia, dal 5, il più basso, a sinistra, fino all\'1. Le carte nelle colonne sono i candidati. Delle 15 carte rimaste ne scegli 3: diventano i membri del grado 5. Le altre 12 escono dal gioco.' },
    { testo: 'Scegli come nell\'esempio del libro: il 6 di fiori, il 5 di quadri e il 4 di picche.',
      mossa: { t: 'scegli', carte: ['F6', 'Q5', 'P4'] } },
    { testo: 'Ogni turno promuovi un membro e lo sostituisci, nella stessa mossa. Si promuove solo da un grado con esattamente 3 membri, e il sostituto è un candidato dello stesso grado. Prova questa mossa: promuovi il 6 di fiori al grado 4, fra i membri, con l\'8 di fiori come sostituto.',
      mossa: prom('F6', 'membri', 'F8'), rifiuto: true, motivo: 'ultima cifra' },
    { testo: 'Prova questa mossa: promuovi il 6 di fiori al grado 4, fra i membri, con il 9 di quadri come sostituto.',
      mossa: prom('F6', 'membri', 'Q9'), rifiuto: true, motivo: 'stesso grado' },
    { testo: 'Se promuovi il 6 di fiori restano il 5 di quadri e il 4 di picche. Il sostituto deve valere l\'ultima cifra della loro somma o del loro prodotto: 5 più 4 fa 9, 5 per 4 fa 20, quindi 0. L\'Asso vale 1 e il 10 vale 0. Nel grado 5 vanno bene il 9 di cuori, il 9 di picche e il 10 di quadri: scegli il 10. Il promosso sale al grado 4, qui come membro.',
      mossa: prom('F6', 'membri', 'Q10') },
    { scena: 'finale',
      testo: 'Salto in avanti: dopo molte mosse il tavolo è quello del finale del libro. Si vince promuovendo un membro dal grado 1, col suo sostituto, come ogni altra promozione. Prova questa mossa: promuovi il 5 di quadri dal grado 1, con l\'8 di picche come sostituto.',
      mossa: prom('Q5', null, 'P8'), rifiuto: true, motivo: 'esattamente 3 membri' },
    { testo: 'Prima mossa. Dal grado 4 promuovi il 4 di picche, fra i candidati del grado 3. Restano il 9 di picche e il 6 di quadri: 9 più 6 fa 15, ultima cifra 5. Il sostituto è il 5 di fiori.',
      mossa: prom('P4', 'candidati', 'F5') },
    { testo: 'Seconda mossa. Promuovi il 5 di fiori dal grado 4 fra i membri del grado 3, che ne ha già tre: ne avrebbe quattro, quindi ne sacrifichi uno, il 7 di quadri. Restano il 9 di picche e il 6 di quadri: 9 per 6 fa 54, ultima cifra 4. Il sostituto è il 4 di quadri.',
      mossa: prom('F5', 'membri', 'Q4', 'Q7') },
    { testo: 'Terza mossa. Dal grado 3 promuovi il 5 di fiori, fra i candidati del grado 2. Restano il 3 di cuori e il 9 di quadri: 3 per 9 fa 27, ultima cifra 7. Il sostituto è il 7 di picche.',
      mossa: prom('F5', 'candidati', 'P7') },
    { testo: 'Quarta mossa. Dal grado 2 promuovi il 3 di fiori fra i membri del grado 1, che ne ha solo due: nessun sacrificio. Restano il 5 di cuori e il 9 di fiori: 5 per 9 fa 45, ultima cifra 5. Il sostituto è il 5 di fiori, quello che hai appena promosso.',
      mossa: prom('F3', 'membri', 'F5') },
    { testo: 'Quinta mossa. Il grado 1 ha ora tre membri. Promuovi il 3 di fiori dal grado 1, col suo sostituto: restano il 5 di quadri e il 3 di picche, 5 più 3 fa 8. Il sostituto è l\'8 di picche.',
      mossa: prom('F3', null, 'P8') },
    { testo: 'Hai vinto: hai promosso un agente dal grado 1. Il punteggio sono le carte sacrificate, meno sono meglio: in queste cinque mosse ne hai sacrificata una sola. Perdi se non hai più nessuna mossa valida, oppure se ti arrendi.' }
  ];

  return { nuova: nuova, scena: scena, passi: passi };
}));
