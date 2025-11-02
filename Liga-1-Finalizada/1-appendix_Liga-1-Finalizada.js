// appendix_c.js

// Função auxiliar para parsear resultados em formato "2 x 1"

function parseResultado(resultado) {
  const m = String(resultado).replace(/\s+/g, "").match(/^(\d+)[xX](\d+)$/);
  if (!m) return [NaN, NaN];
  return [Number(m[1]), Number(m[2])];
}
  
  // Filtra os jogos de um determinado dia
  function filtrarJogosDoDia(jogos, dia) {
    return jogos.filter(j => Number(j.dia) === Number(dia));
  }
  
  // Calcula os Match Points de cada jogador naquele dia
  
  function calcularMatchPointsPorDia(dia, jogos) {
    const jogosDia = filtrarJogosDoDia(jogos, dia);
    const pontos = {}; // { jogador: pontos }
    const add = (j) => { if (j && j !== "Bye" && !pontos[j]) pontos[j] = 0; };
  
    jogosDia.forEach(jogo => {
      const j1 = (jogo.jogador1 || "").trim();
      const j2 = (jogo.jogador2 || "").trim();
  
      // Bye = vitória automática 2–0 → +3 pts
      if (j1 === "Bye" || j2 === "Bye") {
        const vencedor = j1 === "Bye" ? j2 : j1;
        add(vencedor);
        if (vencedor) pontos[vencedor] += 3;
        return;
      }
  
      const m = String(jogo.resultado).replace(/\s+/g, "").match(/^(\d+)[xX](\d+)$/);
      if (!m) return;
      const g1 = +m[1], g2 = +m[2];
  
      add(j1); add(j2);
      if (g1 > g2) pontos[j1] += 3;
      else if (g1 < g2) pontos[j2] += 3;
      else { pontos[j1] += 1; pontos[j2] += 1; } // se você usa empates
    });
  
    return pontos;
  }
  
  
  
  // Calcula Game Points de cada jogador no dia
  
  function calcularGamePoints(jogosDia) {
    const pontos = {};
  
    const add = (j) => {
      if (!j || j === "Bye") return;
      if (!pontos[j]) pontos[j] = { pontos: 0, total: 0 };
    };
  
    jogosDia.forEach(jogo => {
      const j1 = (jogo.jogador1 || "").trim();
      const j2 = (jogo.jogador2 || "").trim();
  
      // Bye: soma 2–0 em games para o jogador real; não cria nada para "Bye"
      if (j1 === "Bye" || j2 === "Bye") {
        const vencedor = j1 === "Bye" ? j2 : j1;
        add(vencedor);
        if (vencedor && vencedor !== "Bye") {
          pontos[vencedor].pontos += 2 * 3;
          pontos[vencedor].total  += 2 * 3;
        }
        return;
      }
  
      const [g1, g2] = parseResultado(jogo.resultado);
      if (isNaN(g1) || isNaN(g2)) return;
  
      add(j1); add(j2);
      pontos[j1].pontos += g1 * 3;
      pontos[j2].pontos += g2 * 3;
      const total = (g1 + g2) * 3;
      pontos[j1].total += total;
      pontos[j2].total += total;
    });
  
    return pontos;
  }
  
  
  // Calcula MWP (Match Win Percentage)
  function calcularMWP(jogadores, jogosDia) {
    const matchPoints = calcularMatchPointsPorDia(jogosDia[0].dia, jogosDia);
    const partidas = {};
  
    jogosDia.forEach(jogo => {
      const j1 = (jogo.jogador1 || "").trim();
      const j2 = (jogo.jogador2 || "").trim();
  
      // Bye: conta 1 partida apenas para o jogador real
      if (j1 === "Bye" || j2 === "Bye") {
        const real = j1 === "Bye" ? j2 : j1;
        if (real && real !== "Bye") {
          partidas[real] = (partidas[real] || 0) + 1;
        }
        return;
      }
  
      [j1, j2].forEach(j => {
        if (j && j !== "Bye") partidas[j] = (partidas[j] || 0) + 1;
      });
    });
  
    const mwp = {};
    jogadores.forEach(j => {
      if (j === "Bye") return; // não calcula MWP para "Bye"
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
      const j1 = (jogo.jogador1 || "").trim();
      const j2 = (jogo.jogador2 || "").trim();
  
      // não registra adversário "Bye" e não cria linha para "Bye"
      if (j1 && j1 !== "Bye" && j2 && j2 !== "Bye") {
        if (!adversarios[j1]) adversarios[j1] = [];
        if (!adversarios[j2]) adversarios[j2] = [];
        adversarios[j1].push(j2);
        adversarios[j2].push(j1);
      } else if (j1 === "Bye" && j2 && j2 !== "Bye") {
        if (!adversarios[j2]) adversarios[j2] = [];
        // Bye não entra como adversário — simplesmente ignoramos
      } else if (j2 === "Bye" && j1 && j1 !== "Bye") {
        if (!adversarios[j1]) adversarios[j1] = [];
        // idem
      }
    });
  
    const omwp = {};
    jogadores.forEach(j => {
      if (j === "Bye") return; // não calcula OMWP para "Bye"
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
      const a = (j.jogador1 || "").trim();
      const b = (j.jogador2 || "").trim();
      if (a && a !== "Bye") jogadoresSet.add(a);
      if (b && b !== "Bye") jogadoresSet.add(b);
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
    })).sort((a, b) =>
      (b.matchPoints - a.matchPoints) ||
      (b.omwp - a.omwp)
    );
  
    return ranking;
  }
  
  
  // Export (caso use em ambiente modular)
  // export { gerarRankingDoDia }
  