// appendix_c.js — Ranking de um dia de competição (torneio suíço)
//
// Toda a matemática vive em mtr.js, que implementa o MTR Appendix C.
// Este arquivo só recorta os jogos do dia e formata o resultado.
//
// IMPORTANTE: as páginas das ligas encerradas (liga1/2/3.html) NÃO usam este
// arquivo — elas carregam appendix_c-encerradas.js, um snapshot congelado, para
// que os números já publicados não mudem. Este arquivo serve a liga ativa.
//
// Correções em relação ao snapshot:
//   - desempate completo: MP -> OMW% -> GW% -> OGW% (antes parava no OMW%)
//   - OGW% passou a existir (4º critério oficial, antes ausente)
//   - adversários repetidos contam uma vez por partida (antes o Bye entrava na média)
//   - dia sem jogos e placar "0 x 0" não geram mais exceção nem NaN

function parseResultado(resultado) {
  var p = MTR.parsePlacar(resultado);
  return p ? p : [NaN, NaN];
}

function filtrarJogosDoDia(jogos, dia) {
  return (jogos || []).filter(function (j) { return Number(j.dia) === Number(dia); });
}

// Match points de cada jogador no dia. Bye vale 3.
function calcularMatchPointsPorDia(dia, jogos) {
  var registros = MTR.construirRegistros(filtrarJogosDoDia(jogos, dia));
  var out = {};
  Object.keys(registros).forEach(function (nome) {
    out[nome] = registros[nome].matchPoints;
  });
  return out;
}

// Game points de cada jogador no dia, no formato { pontos, total }.
function calcularGamePoints(jogosDia) {
  var registros = MTR.construirRegistros(jogosDia);
  var out = {};
  Object.keys(registros).forEach(function (nome) {
    out[nome] = {
      pontos: registros[nome].gamePoints,
      total: registros[nome].games * 3
    };
  });
  return out;
}

function calcularMWP(jogadores, jogosDia) {
  var registros = MTR.construirRegistros(jogosDia);
  var mwp = {};
  (jogadores || []).forEach(function (j) {
    if (MTR.ehBye(j)) return;
    mwp[j] = MTR.matchWinPct(registros[j]);
  });
  return mwp;
}

function calcularOMWP(jogadores, jogosDia) {
  var registros = MTR.construirRegistros(jogosDia);
  var omwp = {};
  (jogadores || []).forEach(function (j) {
    if (MTR.ehBye(j)) return;
    omwp[j] = registros[j] ? MTR.opponentsMatchWinPct(registros[j], registros) : 0;
  });
  return omwp;
}

function calcularOGWP(jogadores, jogosDia) {
  var registros = MTR.construirRegistros(jogosDia);
  var ogwp = {};
  (jogadores || []).forEach(function (j) {
    if (MTR.ehBye(j)) return;
    ogwp[j] = registros[j] ? MTR.opponentsGameWinPct(registros[j], registros) : 0;
  });
  return ogwp;
}

// Ranking do dia, já na ordem oficial de desempate.
function gerarRankingDoDia(dia, jogos) {
  var jogosDia = filtrarJogosDoDia(jogos, dia);
  if (!jogosDia.length) return [];
  return MTR.classificar(jogosDia);
}
