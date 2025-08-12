// appendix_c.js

// Função auxiliar para parsear resultados em formato "2 x 1"
function parseResultado(resultado) {
    const [g1, g2] = resultado.split('x').map(s => parseInt(s.trim()));
    return [g1, g2];
  }
  
  // Filtra os jogos de um determinado dia
  function filtrarJogosDoDia(jogos, dia) {
    return jogos.filter(j => j.dia === dia && j.jogador2 !== "Bye");
  }
  
  // Calcula os Match Points de cada jogador naquele dia
  function calcularMatchPointsPorDia(dia, jogos) {
    const jogosDia = filtrarJogosDoDia(jogos, dia);
    const pontos = {};
  
    jogosDia.forEach(jogo => {
      const [g1, g2] = parseResultado(jogo.resultado);
      const j1 = jogo.jogador1;
      const j2 = jogo.jogador2;
  
      if (!pontos[j1]) pontos[j1] = 0;
      if (!pontos[j2]) pontos[j2] = 0;
  
      if (g1 > g2) pontos[j1] += 3;
      else if (g1 < g2) pontos[j2] += 3;
      else {
        pontos[j1] += 1;
        pontos[j2] += 1;
      }
    });
  
    return pontos;
  }
  
  // Calcula Game Points de cada jogador no dia
  function calcularGamePoints(jogosDia) {
    const pontos = {};
  
    jogosDia.forEach(jogo => {
      const [g1, g2] = parseResultado(jogo.resultado);
      const j1 = jogo.jogador1;
      const j2 = jogo.jogador2;
  
      if (!pontos[j1]) pontos[j1] = { pontos: 0, total: 0 };
      if (!pontos[j2]) pontos[j2] = { pontos: 0, total: 0 };
  
      pontos[j1].pontos += g1 * 3;
      pontos[j2].pontos += g2 * 3;
  
      pontos[j1].total += (g1 + g2) * 3;
      pontos[j2].total += (g1 + g2) * 3;
    });
  
    return pontos;
  }
  
  // Calcula MWP (Match Win Percentage)
  function calcularMWP(jogadores, jogosDia) {
    const matchPoints = calcularMatchPointsPorDia(jogosDia[0].dia, jogosDia);
    const partidas = {};
  
    jogosDia.forEach(jogo => {
      [jogo.jogador1, jogo.jogador2].forEach(j => {
        if (!partidas[j]) partidas[j] = 0;
        partidas[j]++;
      });
    });
  
    const mwp = {};
    jogadores.forEach(j => {
      const pontos = matchPoints[j] || 0;
      const jogos = partidas[j] || 0;
      const perc = jogos > 0 ? Math.max(0.33, pontos / (jogos * 3)) : 0;
      mwp[j] = perc;
    });
  
    return mwp;
  }
  
  // Calcula OMWP (Opponent Match Win Percentage)
  function calcularOMWP(jogadores, jogosDia) {
    const mwp = calcularMWP(jogadores, jogosDia);
    const adversarios = {};
  
    jogosDia.forEach(jogo => {
      [
        [jogo.jogador1, jogo.jogador2],
        [jogo.jogador2, jogo.jogador1]
      ].forEach(([j, adv]) => {
        if (!adversarios[j]) adversarios[j] = [];
        adversarios[j].push(adv);
      });
    });
  
    const omwp = {};
    jogadores.forEach(j => {
      const advs = adversarios[j] || [];
      const soma = advs.reduce((acc, a) => acc + Math.max(0.33, mwp[a] || 0), 0);
      omwp[j] = advs.length > 0 ? soma / advs.length : 0;
    });
  
    return omwp;
  }
  
  // Gera o ranking do dia com todos os critérios
  function gerarRankingDoDia(dia, jogos) {
    const jogosDia = filtrarJogosDoDia(jogos, dia);
    const jogadoresSet = new Set();
    jogosDia.forEach(j => {
      jogadoresSet.add(j.jogador1);
      jogadoresSet.add(j.jogador2);
    });
    const jogadores = Array.from(jogadoresSet);
  
    const matchPoints = calcularMatchPointsPorDia(dia, jogos);
    const gamePoints = calcularGamePoints(jogosDia);
    const mwp = calcularMWP(jogadores, jogosDia);
    const omwp = calcularOMWP(jogadores, jogosDia);
  
    const ranking = jogadores.map(j => ({
      jogador: j,
      matchPoints: matchPoints[j] || 0,
      gameWinPerc: gamePoints[j] ? Math.max(0.33, gamePoints[j].pontos / gamePoints[j].total) : 0,
      matchWinPerc: mwp[j],
      omwp: omwp[j]
    })).sort((a, b) => b.matchPoints - a.matchPoints || b.omwp - a.omwp);
  
    return ranking;
  }
  
  // Export (caso use em ambiente modular)
  // export { gerarRankingDoDia }
  