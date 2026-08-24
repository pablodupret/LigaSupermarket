// mtr.js — Núcleo de cálculo do MTR Appendix C (Tiebreaker Explanation)
//
// Fonte única da verdade para match points, game points e os quatro critérios
// oficiais de desempate. Usado pelo site (main.js, appendix_c.js), pela
// ferramenta de torneio (novo-torneio-V6.html) e pela suíte de testes.
//
// Regras implementadas, conforme o Appendix C:
//   - Vitória = 3 match points, empate = 1, derrota = 0
//   - Game ganho = 3 game points, game empatado = 1, game perdido = 0
//   - Bye = vitória 2x0 => 3 match points e 6 game points
//   - MW% = match points / (3 * rodadas jogadas), com piso de 0.33
//   - GW% = game points  / (3 * games jogados),  com piso de 0.33
//   - OMW% = média do MW% de cada adversário enfrentado, IGNORANDO byes
//   - OGW% = média do GW% de cada adversário enfrentado, IGNORANDO byes
//   - Cada adversário conta uma vez POR PARTIDA (enfrentou duas vezes, conta duas)
//
// Ordem oficial de desempate: MP -> OMW% -> GW% -> OGW%

(function (raiz) {
  "use strict";

  var PISO = 0.33;
  var NOME_BYE = "bye";

  function ehBye(nome) {
    return !nome || String(nome).trim().toLowerCase() === NOME_BYE;
  }

  // Aceita "2 x 1", "2x1", "2X1". Devolve null se não for um placar válido.
  function parsePlacar(resultado) {
    var m = String(resultado == null ? "" : resultado)
      .replace(/\(bye\)/gi, "")
      .replace(/\s+/g, "")
      .match(/^(\d+)[xX](\d+)$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2])];
  }

  function novoRegistro() {
    return {
      matchPoints: 0,
      vitorias: 0,
      derrotas: 0,
      empates: 0,
      partidas: 0,      // rodadas jogadas (bye incluso)
      gamePoints: 0,
      games: 0,         // games jogados (bye conta 2)
      adversarios: []   // só adversários reais; byes ficam de fora
    };
  }

  // Aplica uma partida ao registro de um jogador.
  // gamesPro/gamesContra são games VENCIDOS por cada lado.
  // gamesEmpatados cobre o caso raro de game empatado (vale 1 game point).
  function aplicarPartida(reg, gamesPro, gamesContra, adversario, gamesEmpatados) {
    var empatados = gamesEmpatados || 0;

    reg.partidas += 1;
    reg.gamePoints += gamesPro * 3 + empatados * 1;
    reg.games += gamesPro + gamesContra + empatados;

    if (gamesPro > gamesContra) {
      reg.vitorias += 1;
      reg.matchPoints += 3;
    } else if (gamesPro < gamesContra) {
      reg.derrotas += 1;
    } else {
      reg.empates += 1;
      reg.matchPoints += 1;
    }

    // "A player's byes are ignored when computing their opponents'
    //  match-win and opponents' game-win percentages."
    if (!ehBye(adversario)) reg.adversarios.push(adversario);
  }

  // Bye: considerado vitória 2-0 => 3 match points, 6 game points, sem adversário.
  function aplicarBye(reg) {
    reg.partidas += 1;
    reg.vitorias += 1;
    reg.matchPoints += 3;
    reg.gamePoints += 6;
    reg.games += 2;
  }

  // Valores COM o piso de 0.33. É a definição do MTR e é o que deve entrar na
  // média dos oponentes — o piso existe justamente para "limit the effect low
  // performances have when calculating opponents' match-win percentage".
  function matchWinPct(reg) {
    return Math.max(PISO, matchWinPctRaw(reg));
  }

  function gameWinPct(reg) {
    return Math.max(PISO, gameWinPctRaw(reg));
  }

  // Valores SEM piso — o desempenho real do jogador. Use estes para exibir e
  // para desempatar o próprio jogador: com o piso, todo mundo abaixo de 33%
  // empataria em 33% e o critério perderia poder de desempate.
  function matchWinPctRaw(reg) {
    if (!reg || reg.partidas <= 0) return 0;
    return reg.matchPoints / (reg.partidas * 3);
  }

  function gameWinPctRaw(reg) {
    if (!reg || reg.games <= 0) return 0;
    return reg.gamePoints / (reg.games * 3);
  }

  // Média do MW% dos adversários. Cada adversário já vem repetido na lista
  // tantas vezes quantas foi enfrentado, e byes nunca entraram nela.
  function opponentsMatchWinPct(reg, registros) {
    return mediaDosAdversarios(reg, registros, matchWinPct);
  }

  function opponentsGameWinPct(reg, registros) {
    return mediaDosAdversarios(reg, registros, gameWinPct);
  }

  function mediaDosAdversarios(reg, registros, fn) {
    if (!reg || !reg.adversarios.length) return 0;
    var soma = 0;
    for (var i = 0; i < reg.adversarios.length; i++) {
      var adv = registros[reg.adversarios[i]];
      soma += adv ? Math.max(PISO, fn(adv)) : PISO;
    }
    return soma / reg.adversarios.length;
  }

  // Monta os registros de todos os jogadores a partir de uma lista de jogos
  // no formato do jogos.json: { jogador1, resultado, jogador2 }.
  // Jogadores "Bye" nunca viram registro próprio.
  function construirRegistros(jogos) {
    var registros = {};

    function reg(nome) {
      if (!registros[nome]) registros[nome] = novoRegistro();
      return registros[nome];
    }

    (jogos || []).forEach(function (jogo) {
      var j1 = String(jogo.jogador1 || "").trim();
      var j2 = String(jogo.jogador2 || "").trim();

      if (ehBye(j1) && ehBye(j2)) return;

      if (ehBye(j1) || ehBye(j2)) {
        var real = ehBye(j1) ? j2 : j1;
        if (real) aplicarBye(reg(real));
        return;
      }

      var placar = parsePlacar(jogo.resultado);
      if (!placar) return;

      // Campo opcional: games que terminaram empatados (valem 1 game point
      // cada, não 3). Ausente = 0, então todo o histórico anterior segue
      // válido sem alteração.
      var empatados = Number(jogo.gamesEmpatados) || 0;

      aplicarPartida(reg(j1), placar[0], placar[1], j2, empatados);
      aplicarPartida(reg(j2), placar[1], placar[0], j1, empatados);
    });

    return registros;
  }

  // Devolve a lista de jogadores já com os quatro critérios calculados,
  // ordenada pela ordem oficial de desempate.
  function classificar(jogos) {
    var registros = construirRegistros(jogos);

    var linhas = Object.keys(registros).map(function (nome) {
      var r = registros[nome];
      return {
        jogador: nome,
        matchPoints: r.matchPoints,
        vitorias: r.vitorias,
        derrotas: r.derrotas,
        empates: r.empates,
        partidas: r.partidas,
        // exibição/desempate do próprio jogador: sem piso
        matchWinPerc: matchWinPctRaw(r),
        gameWinPerc: gameWinPctRaw(r),
        // valores com piso, como o MTR define — compararMTR usa o GW% assim
        matchWinPercPiso: matchWinPct(r),
        gameWinPercPiso: gameWinPct(r),
        omwp: opponentsMatchWinPct(r, registros),
        ogwp: opponentsGameWinPct(r, registros)
      };
    });

    linhas.sort(compararMTR);
    return linhas;
  }

  // Ordem oficial: match points -> OMW% -> GW% -> OGW%.
  // Devolve 0 quando os QUATRO critérios empatam — nesse caso quem chama decide
  // o que fazer (sortear, manter a ordem prévia, avisar que houve empate).
  //
  // O piso de 0.33 do GW% é aplicado AQUI DENTRO, e não por quem monta o objeto:
  // assim a regra vale para todos os chamadores, inclusive os que montam a linha
  // à mão. Dois jogadores com GW% bruto de 25% e 30% valem 33% para fins oficiais
  // e empatam neste critério — o desempate segue para o OGW%.
  //
  // MW% não entra: não é critério de desempate no MTR, só alimenta o OMW%.
  // OMW% e OGW% já vêm com o piso aplicado por adversário.
  //
  // ESTA É A ÚNICA IMPLEMENTAÇÃO DESTA ORDEM. Não reconstruir os critérios em
  // outro arquivo — foi assim que o piso do GW% ficou faltando no pareamento.
  function compararCriterios(a, b) {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.omwp !== a.omwp) return b.omwp - a.omwp;

    var gwA = Math.max(PISO, a.gameWinPerc || 0);
    var gwB = Math.max(PISO, b.gameWinPerc || 0);
    if (gwB !== gwA) return gwB - gwA;

    if (b.ogwp !== a.ogwp) return b.ogwp - a.ogwp;
    return 0;
  }

  function estaoEmpatadosNosCriterios(a, b) {
    return compararCriterios(a, b) === 0;
  }

  // Para apresentação: mesma ordem, mas com o nome como último desempate, para
  // a tabela exibida não mudar de ordem a cada renderização.
  function compararMTR(a, b) {
    return compararCriterios(a, b) ||
           String(a.jogador).localeCompare(String(b.jogador), "pt-BR");
  }

  var API = {
    PISO: PISO,
    ehBye: ehBye,
    parsePlacar: parsePlacar,
    novoRegistro: novoRegistro,
    aplicarPartida: aplicarPartida,
    aplicarBye: aplicarBye,
    matchWinPct: matchWinPct,
    gameWinPct: gameWinPct,
    matchWinPctRaw: matchWinPctRaw,
    gameWinPctRaw: gameWinPctRaw,
    opponentsMatchWinPct: opponentsMatchWinPct,
    opponentsGameWinPct: opponentsGameWinPct,
    construirRegistros: construirRegistros,
    classificar: classificar,
    compararCriterios: compararCriterios,
    estaoEmpatadosNosCriterios: estaoEmpatadosNosCriterios,
    compararMTR: compararMTR
  };

  raiz.MTR = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
