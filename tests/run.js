// tests/run.js — Suíte de validação da Liga Magic Supermarket
//
// Roda com:  node tests/run.js
// Sem dependências externas (o projeto não tem npm nem build).
//
// Cobre:
//   1. Conformidade com o MTR Appendix C (usando os exemplos numéricos do documento)
//   2. Pareamento suíço (sem repetição evitável, 1 bye por jogador, rodada bem formada)
//   3. Regressão dos dados já publicados (campeões das Ligas 1, 2 e 3 não mudam)

var path = require("path");
var fs = require("fs");

var RAIZ = path.join(__dirname, "..");
var MTR = require(path.join(RAIZ, "mtr.js"));
var Pareamento = require(path.join(RAIZ, "pareamento.js"));

// ---------------------------------------------------------------- infra
var passou = 0, falhou = 0, grupoAtual = "";
var falhas = [];

// Testes que dependem de código assíncrono (a exportação consulta o histórico
// antes de perguntar o dia). Rodam em sequência no fim, antes do resumo.
var assincronos = [];
function testeAsync(fn) { assincronos.push(fn); }

function grupo(nome) {
  grupoAtual = nome;
  console.log("\n" + nome);
  console.log("-".repeat(nome.length));
}

function ok(cond, descricao, detalhe) {
  if (cond) {
    passou++;
    console.log("  ✓ " + descricao);
  } else {
    falhou++;
    falhas.push(grupoAtual + " > " + descricao + (detalhe ? "  [" + detalhe + "]" : ""));
    console.log("  ✗ " + descricao + (detalhe ? "\n      " + detalhe : ""));
  }
}

function perto(a, b, tol) {
  return Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);
}

// Gerador determinístico, para os testes serem reprodutíveis.
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ============================================================== 1. MTR
grupo("1. MTR Appendix C — exemplos literais do documento");

// -- Match points
(function () {
  var r = MTR.novoRegistro();
  for (var i = 0; i < 6; i++) MTR.aplicarPartida(r, 2, 0, "op" + i);
  for (var j = 0; j < 2; j++) MTR.aplicarPartida(r, 0, 2, "op" + (10 + j));
  ok(r.matchPoints === 18, "registro 6-2-0 vale 18 match points", "obtido: " + r.matchPoints);
})();

(function () {
  var r = MTR.novoRegistro();
  for (var i = 0; i < 4; i++) MTR.aplicarPartida(r, 2, 0, "a" + i);
  for (var j = 0; j < 2; j++) MTR.aplicarPartida(r, 0, 2, "b" + j);
  for (var k = 0; k < 2; k++) MTR.aplicarPartida(r, 1, 1, "c" + k);
  ok(r.matchPoints === 14, "registro 4-2-2 vale 14 match points", "obtido: " + r.matchPoints);
})();

// -- Game points (exemplos do documento)
(function () {
  var r = MTR.novoRegistro();
  MTR.aplicarPartida(r, 2, 0, "x");
  ok(r.gamePoints === 6 && r.games === 2, "vitoria 2-0-0 => 6 game points em 2 games",
     "gp=" + r.gamePoints + " games=" + r.games);

  var r2 = MTR.novoRegistro();
  MTR.aplicarPartida(r2, 2, 1, "x");
  ok(r2.gamePoints === 6 && r2.games === 3, "vitoria 2-1-0 => 6 game points em 3 games",
     "gp=" + r2.gamePoints + " games=" + r2.games);

  var r3 = MTR.novoRegistro();
  MTR.aplicarPartida(r3, 2, 0, "x", 1); // 2-0-1: um game empatado
  ok(r3.gamePoints === 7 && r3.games === 3, "vitoria 2-0-1 => 7 game points em 3 games",
     "gp=" + r3.gamePoints + " games=" + r3.games);
})();

// -- Match-win percentage (tabela do MTR)
(function () {
  // 5-2-1 em 8 rodadas => 16 MP => 16/24 = 0.667
  var r = MTR.novoRegistro();
  r.matchPoints = 16; r.partidas = 8;
  ok(perto(MTR.matchWinPct(r), 0.667), "MW% de 5-2-1 em 8 rodadas = 0.667",
     "obtido: " + MTR.matchWinPct(r).toFixed(3));

  // 1-3-0 e desiste => 3/12 = 0.25 => usa o piso 0.33
  var r2 = MTR.novoRegistro();
  r2.matchPoints = 3; r2.partidas = 4;
  ok(perto(MTR.matchWinPct(r2), 0.33), "MW% de 1-3-0 (0.25) sobe para o piso 0.33",
     "obtido: " + MTR.matchWinPct(r2).toFixed(3));

  // 3-2-0 com bye, 5 rodadas => 9/15 = 0.60
  var r3 = MTR.novoRegistro();
  r3.matchPoints = 9; r3.partidas = 5;
  ok(perto(MTR.matchWinPct(r3), 0.60), "MW% de 3-2-0 com bye em 5 rodadas = 0.60",
     "obtido: " + MTR.matchWinPct(r3).toFixed(3));
})();

// -- Game-win percentage (tabela do MTR)
(function () {
  var r = MTR.novoRegistro();
  r.gamePoints = 21; r.games = 10;
  ok(perto(MTR.gameWinPct(r), 0.70), "GW% de 21 game points em 10 games = 0.70",
     "obtido: " + MTR.gameWinPct(r).toFixed(3));

  var r2 = MTR.novoRegistro();
  r2.gamePoints = 9; r2.games = 11;
  ok(perto(MTR.gameWinPct(r2), 0.33), "GW% de 9/33 (0.27) sobe para o piso 0.33",
     "obtido: " + MTR.gameWinPct(r2).toFixed(3));
})();

// -- Byes
(function () {
  var r = MTR.novoRegistro();
  MTR.aplicarBye(r);
  ok(r.matchPoints === 3, "bye vale 3 match points", "obtido: " + r.matchPoints);
  ok(r.gamePoints === 6, "bye vale 6 game points", "obtido: " + r.gamePoints);
  ok(r.games === 2, "bye conta 2 games jogados", "obtido: " + r.games);
  ok(r.partidas === 1, "bye conta 1 rodada jogada", "obtido: " + r.partidas);
  ok(r.adversarios.length === 0, "bye NAO entra como adversario",
     "adversarios: " + JSON.stringify(r.adversarios));
})();

// -- OMW%: os dois exemplos de 8 rodadas do documento
(function () {
  // Exemplo 1: adversarios 4-4-0, 7-1-0, 1-3-1, 3-3-1, 6-2-0, 5-2-1, 4-3-1, 6-1-1.
  // Atencao: dois deles abandonaram, entao jogaram menos rodadas e o denominador
  // muda — o proprio MTR mostra as fracoes 12/24, 21/24, 4/15, 10/21, 18/24,
  // 16/24, 13/24, 19/24. O terceiro da 0.27 e sobe para o piso 0.33. Media = 0.62.
  var recs = {};
  //             [match points, rodadas jogadas]
  var advs1 = [[12, 8], [21, 8], [4, 5], [10, 7], [18, 8], [16, 8], [13, 8], [19, 8]];
  var eu = MTR.novoRegistro();
  advs1.forEach(function (d, i) {
    var nome = "adv" + i;
    recs[nome] = MTR.novoRegistro();
    recs[nome].matchPoints = d[0];
    recs[nome].partidas = d[1];
    eu.adversarios.push(nome);
  });
  ok(perto(MTR.opponentsMatchWinPct(eu, recs), 0.62, 0.006),
     "OMW% do exemplo 1 do MTR = 0.62",
     "obtido: " + MTR.opponentsMatchWinPct(eu, recs).toFixed(3));

  // Exemplo 2: mesmo torneio, mas a 1a rodada do jogador foi um BYE.
  // O bye e ignorado => media sobre 7 adversarios => 0.63
  var recs2 = {};
  var eu2 = MTR.novoRegistro();
  [[21, 8], [4, 5], [10, 7], [18, 8], [16, 8], [13, 8], [19, 8]].forEach(function (d, i) {
    var nome = "b" + i;
    recs2[nome] = MTR.novoRegistro();
    recs2[nome].matchPoints = d[0];
    recs2[nome].partidas = d[1];
    eu2.adversarios.push(nome);
  });
  MTR.aplicarBye(eu2); // nao deve acrescentar adversario
  ok(eu2.adversarios.length === 7, "apos o bye, seguem 7 adversarios na media",
     "obtido: " + eu2.adversarios.length);
  ok(perto(MTR.opponentsMatchWinPct(eu2, recs2), 0.63, 0.006),
     "OMW% do exemplo 2 do MTR (com bye) = 0.63",
     "obtido: " + MTR.opponentsMatchWinPct(eu2, recs2).toFixed(3));
})();

// -- Adversario repetido conta duas vezes
(function () {
  var jogos = [
    { jogador1: "A", resultado: "2 x 0", jogador2: "B" },
    { jogador1: "A", resultado: "2 x 0", jogador2: "B" },
    { jogador1: "A", resultado: "0 x 2", jogador2: "C" }
  ];
  var regs = MTR.construirRegistros(jogos);
  ok(regs["A"].adversarios.length === 3,
     "enfrentar o mesmo adversario 2x conta 2x na media",
     "obtido: " + regs["A"].adversarios.length);
})();

// -- Ordem oficial de desempate
(function () {
  var a = { jogador: "A", matchPoints: 9, omwp: 0.60, gameWinPerc: 0.70, ogwp: 0.50 };
  var b = { jogador: "B", matchPoints: 9, omwp: 0.60, gameWinPerc: 0.80, ogwp: 0.40 };
  ok(MTR.compararMTR(a, b) > 0, "com MP e OMW% iguais, o GW% maior desempata");

  var c = { jogador: "C", matchPoints: 9, omwp: 0.60, gameWinPerc: 0.70, ogwp: 0.55 };
  ok(MTR.compararMTR(a, c) > 0, "com MP, OMW% e GW% iguais, o OGW% maior desempata");
})();

// -- Casos degenerados que hoje quebram
(function () {
  ok(MTR.classificar([]).length === 0, "lista de jogos vazia nao quebra");

  var so00 = MTR.classificar([{ jogador1: "A", resultado: "0 x 0", jogador2: "B" }]);
  var temNaN = so00.some(function (l) {
    return isNaN(l.gameWinPerc) || isNaN(l.matchWinPerc) || isNaN(l.omwp) || isNaN(l.ogwp);
  });
  ok(!temNaN, "placar 0 x 0 como unica partida nao gera NaN",
     JSON.stringify(so00.map(function (l) { return l.jogador + ":" + l.gameWinPerc; })));
  ok(so00.length === 2 && so00[0].matchPoints === 1,
     "placar 0 x 0 e empate: 1 match point para cada");
})();

// ======================================================== 2. Pareamento
grupo("2. Pareamento suíço");

// Busca exaustiva independente, usada como referência para os testes.
function existeSemRepetir(lista, jaJogaram) {
  if (lista.length === 0) return true;
  var a = lista[0], resto = lista.slice(1);
  for (var i = 0; i < resto.length; i++) {
    if (jaJogaram(a, resto[i])) continue;
    if (existeSemRepetir(resto.slice(0, i).concat(resto.slice(i + 1)), jaJogaram)) return true;
  }
  return false;
}

// -- Caso mínimo que o algoritmo antigo errava
(function () {
  var jogados = { "A|D": 1, "C|D": 1 };
  var jaJogaram = function (a, b) { return !!jogados[Pareamento.chave(a, b)]; };
  var r = Pareamento.gerarRodada(["A", "B", "C", "D"], jaJogaram, function () { return false; });
  var repetiu = r.pares.some(function (p) { return jaJogaram(p[0], p[1]); });
  ok(!repetiu, "caso minimo (ja jogaram A-D e C-D) nao repete confronto",
     "gerou: " + r.pares.map(function (p) { return p[0] + "x" + p[1]; }).join(", "));
})();

// -- Torneios aleatórios: nunca repetir quando existe solução
(function () {
  var configs = [[4, 3], [6, 4], [8, 4], [8, 5], [10, 5], [12, 5], [14, 4], [16, 4], [20, 5]];
  var totalRodadas = 0, repeticoesEvitaveis = 0, byesDuplicados = 0, rodadasMalFormadas = 0;

  configs.forEach(function (cfg) {
    var N = cfg[0], R = cfg[1];
    for (var seed = 1; seed <= 300; seed++) {
      var rnd = rng(seed * 7919 + N * 31 + R);
      var nomes = [];
      for (var i = 0; i < N; i++) nomes.push("P" + i);

      var jogados = {}, byes = {}, mp = {};
      nomes.forEach(function (n) { mp[n] = 0; });
      var jaJogaram = function (a, b) { return !!jogados[Pareamento.chave(a, b)]; };
      var jaTeveBye = function (n) { return !!byes[n]; };

      for (var r = 1; r <= R; r++) {
        var ordenados = nomes.slice().sort(function (a, b) {
          return (mp[b] - mp[a]) || (rnd() - 0.5);
        });

        var possivel = (ordenados.length % 2 === 0)
          ? existeSemRepetir(ordenados, jaJogaram)
          : true;

        var res = Pareamento.gerarRodada(ordenados, jaJogaram, jaTeveBye);
        totalRodadas++;

        if (possivel && res.repeticoesForcadas.length > 0) repeticoesEvitaveis++;

        if (res.bye) {
          if (byes[res.bye]) byesDuplicados++;
          byes[res.bye] = true;
        }

        // rodada bem formada: todo mundo aparece exatamente uma vez
        var vistos = {}, mal = false;
        res.pares.forEach(function (p) {
          if (p[0] === p[1]) mal = true;
          [p[0], p[1]].forEach(function (n) { if (vistos[n]) mal = true; vistos[n] = true; });
        });
        if (res.bye) { if (vistos[res.bye]) mal = true; vistos[res.bye] = true; }
        if (Object.keys(vistos).length !== N) mal = true;
        if (mal) rodadasMalFormadas++;

        res.pares.forEach(function (p) {
          jogados[Pareamento.chave(p[0], p[1])] = 1;
          var x = rnd();
          if (x < 0.45) mp[p[0]] += 3; else if (x < 0.9) mp[p[1]] += 3;
          else { mp[p[0]] += 1; mp[p[1]] += 1; }
        });
        if (res.bye) mp[res.bye] += 3;
      }
    }
  });

  ok(repeticoesEvitaveis === 0,
     "nenhuma repeticao evitavel em " + totalRodadas + " rodadas simuladas",
     "evitaveis: " + repeticoesEvitaveis);
  ok(byesDuplicados === 0,
     "nenhum jogador recebeu dois byes no mesmo torneio",
     "duplicados: " + byesDuplicados);
  ok(rodadasMalFormadas === 0,
     "toda rodada tem cada jogador exatamente uma vez",
     "mal formadas: " + rodadasMalFormadas);
})();

// -- Bye vai para o pior colocado ainda sem bye
(function () {
  var r = Pareamento.gerarRodada(["A", "B", "C"], function () { return false; },
                                 function (n) { return n === "C"; });
  ok(r.bye === "B", "com o ultimo ja tendo folgado, o bye vai para o proximo de baixo",
     "bye: " + r.bye);
})();

// -- Round robin completo: a repetição passa a ser inevitável e é reportada
(function () {
  var jogados = {};
  ["A|B", "C|D", "A|C", "B|D", "A|D", "B|C"].forEach(function (k) { jogados[k] = 1; });
  var jaJogaram = function (a, b) { return !!jogados[Pareamento.chave(a, b)]; };
  var r = Pareamento.gerarRodada(["A", "B", "C", "D"], jaJogaram, function () { return false; });
  ok(r.repeticoesForcadas.length === 2,
     "com todos ja tendo se enfrentado, a repeticao e reportada e nao silenciada",
     "reportadas: " + r.repeticoesForcadas.length);
  ok(r.pares.length === 2, "ainda assim a rodada e gerada com todos os jogos");
})();

// ================================================== 3. Regressão de dados
grupo("3. Regressão dos dados publicados");

(function () {
  var arq = path.join(RAIZ, "jogos.json");
  if (!fs.existsSync(arq)) {
    ok(false, "jogos.json encontrado");
    return;
  }
  var todos = JSON.parse(fs.readFileSync(arq, "utf8"));
  ok(Array.isArray(todos) && todos.length > 0, "jogos.json e um JSON valido e nao vazio");

  // Placares fora do formato quebram o ranking silenciosamente.
  var invalidos = todos.filter(function (j) {
    return !MTR.ehBye(j.jogador1) && !MTR.ehBye(j.jogador2) && !MTR.parsePlacar(j.resultado);
  });
  ok(invalidos.length === 0, "todos os placares estao no formato \"N x N\"",
     invalidos.length ? JSON.stringify(invalidos[0]) : "");

  // Campeões conhecidos de cada liga encerrada (match points, criterio da temporada).
  var esperado = { 1: ["Magno", "Nagib"], 2: ["Magno", "Stenio"], 3: ["Magno", "Flavio"] };
  Object.keys(esperado).forEach(function (liga) {
    var jogos = todos.filter(function (j) { return (j.liga || 1) === Number(liga); });
    var tabela = MTR.classificar(jogos).filter(function (l) { return !MTR.ehBye(l.jogador); });
    // O ranking da temporada usa pontos totais; aqui basta conferir o topo por match points.
    var porPontos = tabela.slice().sort(function (a, b) { return b.matchPoints - a.matchPoints; });
    ok(porPontos[0].jogador === esperado[liga][0],
       "Liga " + liga + ": campeao continua " + esperado[liga][0],
       "obtido: " + porPontos[0].jogador);
  });

  // O "Bye" nunca pode aparecer como jogador na classificacao.
  var comBye = MTR.classificar(todos).some(function (l) { return MTR.ehBye(l.jogador); });
  ok(!comBye, "\"Bye\" nao aparece como jogador na classificacao");
})();

// ============================ 4. Integração da ferramenta de torneio
grupo("4. Ferramenta de torneio ponta a ponta");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));

  var cenarios = [
    { n: 4, r: 3 }, { n: 5, r: 4 }, { n: 6, r: 4 }, { n: 7, r: 4 },
    { n: 8, r: 5 }, { n: 9, r: 4 }, { n: 10, r: 5 }, { n: 12, r: 5 }
  ];

  var totalProblemas = [];
  var totalJogos = 0;
  var comBye = 0;

  cenarios.forEach(function (c) {
    for (var seed = 1; seed <= 5; seed++) {
      var nomes = [];
      for (var i = 0; i < c.n; i++) nomes.push("J" + i);

      var res = integracao.validar(nomes, c.r, seed * 104729);
      totalJogos += res.exportados.length;
      if (res.temBye) comBye++;

      res.problemas.forEach(function (p) {
        totalProblemas.push(c.n + "j/" + c.r + "r seed" + seed + ": " + p);
      });

      // Torneio com número ímpar tem de gerar Bye em toda rodada.
      if (res.precisavaBye && !res.temBye) {
        totalProblemas.push(c.n + "j/" + c.r + "r: numero impar sem Bye exportado");
      }
    }
  });

  ok(totalProblemas.length === 0,
     "40 torneios completos (" + totalJogos + " jogos) sem inconsistencia",
     totalProblemas.slice(0, 5).join(" | "));
  ok(comBye > 0, "torneios com numero impar exportaram as linhas de Bye",
     "com bye: " + comBye);
})();

// -- Pareamento manual com linha vazia (o placar ia para o jogo errado)
(function () {
  // Reproduz o cenario do bug: 3 linhas na tela, a do meio vazia.
  // confrontos[] fica com 2 itens, mas as linhas usadas sao a 0 e a 2.
  var linhas = [
    { j1: "A", j2: "B", p: [2, 0] },
    { j1: "",  j2: "",  p: [null, null] },
    { j1: "C", j2: "D", p: [1, 2] }
  ];

  var confrontos = [];
  linhas.forEach(function (l, i) {
    if (!l.j1 || !l.j2) return;
    var par = [{ nome: l.j1 }, { nome: l.j2 }];
    par.slot = i;                       // <- a correcao
    confrontos.push(par);
  });

  var lidos = confrontos.map(function (par) {
    var slot = (par.slot !== undefined) ? par.slot : confrontos.indexOf(par);
    return { jogo: par[0].nome + "x" + par[1].nome, placar: linhas[slot].p };
  });

  ok(lidos[0].placar[0] === 2 && lidos[0].placar[1] === 0,
     "linha vazia no meio: A x B recebe o proprio placar (2 x 0)",
     JSON.stringify(lidos[0]));
  ok(lidos[1].placar[0] === 1 && lidos[1].placar[1] === 2,
     "linha vazia no meio: C x D recebe o proprio placar (1 x 2)",
     JSON.stringify(lidos[1]));
})();

// ================================ 5. Piso de 33% no critério oficial
grupo("5. Piso de 33% no GW% (critério oficial)");

(function () {
  // MP e OMW% iguais; GW% bruto 25% vs 30% -> ambos valem 33% e o desempate
  // tem de seguir para o OGW%.
  var a = { jogador: "A", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.25, ogwp: 0.60 };
  var b = { jogador: "B", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.30, ogwp: 0.40 };
  ok(MTR.compararMTR(a, b) < 0,
     "GW% 25% vs 30% empatam no piso e o OGW% decide",
     "compararMTR devolveu " + MTR.compararMTR(a, b));

  // Acima do piso, o valor real vale.
  var c = { jogador: "C", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.70, ogwp: 0.10 };
  var d = { jogador: "D", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.50, ogwp: 0.90 };
  ok(MTR.compararMTR(c, d) < 0,
     "GW% acima do piso desempata pelo valor real",
     "compararMTR devolveu " + MTR.compararMTR(c, d));

  // O piso não pode "vazar" para cima: 40% x 33% continua distinguindo.
  var e = { jogador: "E", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.40, ogwp: 0.10 };
  var f = { jogador: "F", matchPoints: 9, omwp: 0.50, gameWinPerc: 0.20, ogwp: 0.90 };
  ok(MTR.compararMTR(e, f) < 0, "GW% 40% vence GW% 20% (que sobe para 33%)");

  // OMW%/OGW% seguem usando os percentuais dos adversários COM piso.
  var fraco = MTR.novoRegistro();
  fraco.matchPoints = 0; fraco.partidas = 4; fraco.gamePoints = 0; fraco.games = 8;
  var eu = MTR.novoRegistro();
  eu.adversarios.push("fraco");
  var regs = { fraco: fraco };
  ok(perto(MTR.opponentsMatchWinPct(eu, regs), 0.33),
     "adversario com 0% entra no OMW% como 33%",
     "obtido: " + MTR.opponentsMatchWinPct(eu, regs).toFixed(3));
  ok(perto(MTR.opponentsGameWinPct(eu, regs), 0.33),
     "adversario com 0% entra no OGW% como 33%",
     "obtido: " + MTR.opponentsGameWinPct(eu, regs).toFixed(3));

  // classificar() expõe os dois valores: cru para exibir, com piso para o critério
  var linhas = MTR.classificar([
    { jogador1: "X", resultado: "0 x 2", jogador2: "Y" }
  ]);
  var x = linhas.filter(function (l) { return l.jogador === "X"; })[0];
  ok(x.gameWinPerc === 0 && perto(x.gameWinPercPiso, 0.33),
     "classificar devolve GW% cru (0%) e com piso (33%)",
     "cru=" + x.gameWinPerc + " piso=" + x.gameWinPercPiso);
})();

// ==================================== 6. Game draws (gamesEmpatados)
grupo("6. Game empatado (campo gamesEmpatados)");

(function () {
  var linhas = MTR.classificar([
    { jogador1: "A", resultado: "2 x 0", jogador2: "B", gamesEmpatados: 1 }
  ]);
  var a = linhas.filter(function (l) { return l.jogador === "A"; })[0];
  var b = linhas.filter(function (l) { return l.jogador === "B"; })[0];

  // 2-0-1: A tem 2*3 + 1 = 7 game points em 3 games -> 7/9
  ok(perto(a.gameWinPerc, 7 / 9), "match 2-0-1: GW% do vencedor = 7/9",
     "obtido: " + a.gameWinPerc.toFixed(3));
  // B tem 0*3 + 1 = 1 game point em 3 games -> 1/9, abaixo do piso
  ok(perto(b.gameWinPerc, 1 / 9), "match 2-0-1: GW% cru do perdedor = 1/9",
     "obtido: " + b.gameWinPerc.toFixed(3));
  ok(a.matchPoints === 3 && b.matchPoints === 0, "match 2-0-1 continua sendo vitoria");

  // Retrocompatibilidade: sem o campo, nada muda
  var sem = MTR.classificar([{ jogador1: "A", resultado: "2 x 0", jogador2: "B" }]);
  var aSem = sem.filter(function (l) { return l.jogador === "A"; })[0];
  ok(aSem.gameWinPerc === 1, "sem o campo, 2 x 0 continua valendo GW% 100%",
     "obtido: " + aSem.gameWinPerc);
})();

// ======================== 7. Fluxo manual, reabertura e exportação
grupo("7. Reabertura, persistência e exportação");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;









  // -- reabertura: so a ultima rodada
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.gerarAuto();
    t.preencherPlacares(2, function () { return [2, 0]; });
    t.finalizar(2);

    t.limparAlertas();
    t.reabrir(1);
    ok(/rodada atual/.test(t.alertas().join(" ")),
       "corrigir uma rodada antiga e recusado", t.alertas().join(" | "));

    t.limparAlertas();
    t.reabrir(2);
    ok(t.alertas().length === 1 && /Corrija os placares/i.test(t.alertas()[0]),
       "corrigir a rodada atual funciona", t.alertas().join(" | "));

    // corrige o placar e confere que a exportacao reflete
    t.preencherPlacaresReabertos(2, function () { return [0, 2]; });
    t.limparAlertas();
    t.finalizarReaberta(2);
    var exp = t.exportar(1).filter(function (o) { return o.rodada === 2; });
    ok(exp.length > 0 && exp.every(function (o) { return o.resultado === "0 x 2"; }),
       "exportacao reflete o placar corrigido apos reabrir",
       JSON.stringify(exp));
  })();

  // -- persistencia: recarregar a pagina no meio do torneio
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.gerarAuto();
    t.preencherPlacares(2, function () { return [2, 1]; });
    t.finalizar(2);

    var salvo = t.estadoSalvo();
    ok(!!salvo, "o torneio e salvo automaticamente");
    ok(salvo && salvo.ultimaRodadaFinalizada === 2,
       "o estado salvo registra a ultima rodada finalizada",
       salvo ? String(salvo.ultimaRodadaFinalizada) : "-");

    var antes = t.estado();
    t.recarregarDoStorage();
    ok(t.estado() === antes,
       "recarregar do storage reconstroi exatamente o mesmo estado");

    // As referencias tem de voltar religadas: mexer no jogador pelo array
    // `jogadores` precisa refletir no confronto guardado em resultadosPorRodada.
    var mesmaRef = t.run(
      "(function(){ var alvo = resultadosPorRodada[1][0][0];" +
      " var doArray = jogadores.filter(function(j){return j.nome===alvo.nome;})[0];" +
      " return alvo === doArray; })()"
    );
    ok(mesmaRef === true,
       "apos restaurar, os confrontos apontam para os MESMOS objetos de jogadores",
       "obtido: " + mesmaRef);

    // e o torneio continua de onde parou
    t.gerarAuto();
    ok(t.rodadaAtual() === 3, "e possivel continuar o torneio apos restaurar",
       "rodada atual: " + t.rodadaAtual());

    t.apagarEstadoSalvo();
    ok(!t.estadoSalvo(), "apagar o torneio salvo limpa o storage");
  })();

  // -- game draw ponta a ponta pela ferramenta
  (function () {
    var t = criar(["A", "B"], 1, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0, 1]; });   // 2-0-1
    t.finalizar(1);
    ok(t.alertas().length === 0, "match 2-0-1 finaliza sem alerta", t.alertas().join(" | "));

    var exp = t.exportar(3);
    ok(exp.length === 1 && exp[0].gamesEmpatados === 1,
       "gamesEmpatados sai no JSON exportado", JSON.stringify(exp));
    ok(exp[0].resultado === "2 x 0",
       "o campo resultado continua no formato \"N x N\"", exp[0].resultado);

    // O pareamento automatico e sorteado: o vencedor e o jogador1 do confronto.
    var vencedor = t.run("resultadosPorRodada[1][0][0].nome");
    var rk = t.ranking();
    var v = rk.filter(function (l) { return l.jogador === vencedor; })[0];
    ok(Math.abs(v.gameWinPerc - 7 / 9) < 0.005,
       "GW% do 2-0-1 chega correto no ranking da ferramenta (7/9)",
       vencedor + " obteve " + v.gameWinPerc.toFixed(3));
  })();
})();

// ============ 8. Comparador único: a ordenação REAL do pareamento
grupo("8. Comparador único (ordenarJogadoresSuico)");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  // Cenário que SÓ é decidido corretamente com o piso do GW%.
  //
  //   A perde 0x2 para C e 0x2 para D   -> GW% bruto  0/4  =  0%
  //   B perde 1x2 para E e 0x2 para F   -> GW% bruto  1/5  = 20%
  //   C, D, E e F vencem uma partida cada -> MW% 100% para todos
  //
  //   match points: A = B = 0                      (empata)
  //   OMW%:         A = B = 100%                   (empata)
  //   GW% bruto:    A =  0%  <  B = 20%            -> sem piso, B na frente
  //   GW% oficial:  A = B = 33% (piso)             -> empata, vai para o OGW%
  //   OGW%:         A = (100+100)/2 = 100%
  //                 B = (66.7+100)/2 = 83.3%       -> A na frente
  //
  // Ou seja: sem o piso a ordem sai B, A; com o piso sai A, B.
  var CENARIO = {
    A: [{ contra: "C", placar: "0x2", rodada: 1 }, { contra: "D", placar: "0x2", rodada: 2 }],
    B: [{ contra: "E", placar: "1x2", rodada: 1 }, { contra: "F", placar: "0x2", rodada: 2 }],
    C: [{ contra: "A", placar: "2x0", rodada: 1 }],
    D: [{ contra: "A", placar: "2x0", rodada: 2 }],
    E: [{ contra: "B", placar: "2x1", rodada: 1 }],
    F: [{ contra: "B", placar: "2x0", rodada: 2 }]
  };
  var ELENCO = ["A", "B", "C", "D", "E", "F"];

  (function () {
    var t = criar(ELENCO, 3, 4);
    t.definirHistorico(CENARIO);

    var linhas = t.ranking();
    var a = linhas.filter(function (l) { return l.jogador === "A"; })[0];
    var b = linhas.filter(function (l) { return l.jogador === "B"; })[0];

    ok(a.gameWinPerc < 0.33 && b.gameWinPerc < 0.33,
       "cenario: os dois GW% ficam abaixo do piso",
       "A=" + a.gameWinPerc.toFixed(3) + " B=" + b.gameWinPerc.toFixed(3));
    ok(b.gameWinPerc > a.gameWinPerc,
       "cenario e discriminante: sem o piso, B passaria na frente de A",
       "A=" + a.gameWinPerc.toFixed(3) + " B=" + b.gameWinPerc.toFixed(3));
    ok(a.matchPoints === b.matchPoints && perto(a.omwp, b.omwp),
       "cenario: MP e OMW% realmente empatados",
       "MP " + a.matchPoints + "/" + b.matchPoints +
       " OMW " + a.omwp.toFixed(3) + "/" + b.omwp.toFixed(3));
    ok(a.ogwp > b.ogwp, "cenario: o OGW% de A e maior, entao A deve vencer o desempate",
       "A=" + a.ogwp.toFixed(3) + " B=" + b.ogwp.toFixed(3));
    ok(MTR.estaoEmpatadosNosCriterios(a, b) === false,
       "estaoEmpatadosNosCriterios: nao ha empate total (o OGW% separa)");
  })();

  // O teste que faltava: a ordenação REAL usada para parear.
  (function () {
    var t = criar(ELENCO, 3, 4);
    t.definirHistorico(CENARIO);

    var ordem = t.ordenar();
    var posA = ordem.indexOf("A");
    var posB = ordem.indexOf("B");

    ok(posA < posB,
       "ordenarJogadoresSuico respeita o piso do GW% (A antes de B)",
       "ordem: " + ordem.join(", "));
  })();

  // Empate total nos quatro critérios continua sendo desempatado por sorteio.
  (function () {
    var t = criar(["A", "B"], 2, 4);
    t.definirHistorico({
      A: [{ contra: "Z", placar: "0x2", rodada: 1 }],
      B: [{ contra: "Y", placar: "0x2", rodada: 1 }]
    });
    var linhas = t.ranking();
    ok(MTR.estaoEmpatadosNosCriterios(linhas[0], linhas[1]),
       "dois jogadores identicos empatam nos quatro criterios");
    ok(MTR.compararCriterios(linhas[0], linhas[1]) === 0,
       "compararCriterios devolve 0 no empate total (deixa o sorteio decidir)");
  })();

  // A ordenação alimenta escolherBye: o líder nunca deve folgar.
  // (A rodada 1 é sempre sorteada; a ordenação só vale da 2ª em diante, por
  //  isso o torneio precisa estar além da primeira rodada.)
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 3, 4);
    t.run("rodadaAtual = 1; estadoRodadas[1] = 'finalizada'; ultimaRodadaFinalizada = 1;");
    t.definirHistorico({
      A: [{ contra: "B", placar: "2x0", rodada: 1 }, { contra: "C", placar: "2x0", rodada: 2 }],
      B: [{ contra: "A", placar: "0x2", rodada: 1 }, { contra: "D", placar: "0x2", rodada: 2 }],
      C: [{ contra: "D", placar: "2x0", rodada: 1 }, { contra: "A", placar: "0x2", rodada: 2 }],
      D: [{ contra: "C", placar: "0x2", rodada: 1 }, { contra: "B", placar: "2x0", rodada: 2 }],
      E: [{ contra: "F", placar: "0x2", rodada: 1 }, { contra: "G", placar: "0x2", rodada: 2 }]
    });

    var bye = t.byeDaRodada();
    ok(bye !== null, "com 5 jogadores a rodada gerada tem BYE", "bye: " + bye);
    ok(bye !== "A", "o BYE nao vai para o lider isolado", "bye: " + bye);
  })();

  // Nenhuma reconstrução manual dos critérios pode sobrar fora do mtr.js
  (function () {
    var html = fs.readFileSync(path.join(RAIZ, "novo-torneio-V6.html"), "utf8");
    var suspeitos = html.match(/(matchPoints\s*-|\.omwp\s*-|gameWinPerc\s*-|\.ogwp\s*-)/g) || [];
    ok(suspeitos.length === 0,
       "nao existe comparador de criterios reconstruido no HTML",
       suspeitos.join(", "));
  })();
})();

// ================ 9. Transação completa e recuperação em andamento
grupo("9. Transação completa e rodada em andamento");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  // -- BYE valido + ultimo placar vazio => NADA aplicado
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 2, 4);
    t.gerarAuto();   // 5 jogadores: BYE no slot 0 e 2 jogos

    // Preenche so o primeiro jogo; o segundo fica sem placar.
    var slots = t.run("resultadosPorRodada[1].filter(function(p){return p[1].nome!=='Bye';})" +
                      ".map(function(p){return p.slot;})");
    t.digitar("r1_p" + (slots[0] * 2), 2, "input");
    t.digitar("r1_p" + (slots[0] * 2 + 1), 0, "input");

    var antes = t.estado();
    t.finalizar(1);

    ok(/Preencha todos os placares/.test(t.alertas().join(" ")),
       "placar faltando bloqueia a finalizacao", t.alertas().join(" | "));
    ok(t.estado() === antes,
       "BYE, pontos e historico NAO foram aplicados (transacao)");

    // Agora completa e finaliza: tudo aplicado UMA vez
    t.limparAlertas();
    t.digitar("r1_p" + (slots[1] * 2), 1, "input");
    t.digitar("r1_p" + (slots[1] * 2 + 1), 2, "input");
    t.finalizar(1);
    ok(t.alertas().length === 0, "apos completar, finaliza sem alerta",
       t.alertas().join(" | "));

    var nomeBye = t.run("resultadosPorRodada[1].filter(function(p){return p[1].nome==='Bye';})[0][0].nome");
    var jogs = t.jogadores();
    var e = jogs.filter(function (j) { return j.nome === nomeBye; })[0];
    ok(e.historico.length === 1 && e.pontos === 3,
       "o BYE foi aplicado exatamente uma vez",
       nomeBye + ": historico=" + e.historico.length + " pontos=" + e.pontos);
    var totalHist = jogs.reduce(function (n, j) { return n + j.historico.length; }, 0);
    ok(totalHist === 5,
       "cada jogador tem exatamente uma partida na rodada (2 jogos + 1 bye)",
       "total: " + totalHist);
  })();

  // -- corrigir placares: guarda de dominio
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.gerarAuto();
    t.preencherPlacares(2, function () { return [2, 0]; });
    t.finalizar(2);
    t.gerarAuto();               // R3 gerada, nao finalizada

    var antes = t.estado();
    t.limparAlertas();
    t.reabrir(2);                // chamada direta, como se fosse pelo console
    ok(/rodada atual/.test(t.alertas().join(" ")),
       "com R3 gerada, corrigir R2 e recusado mesmo chamando a funcao direto",
       t.alertas().join(" | "));
    ok(t.estado() === antes, "a recusa nao altera estado");
  })();

  // -- rodada automatica gerada e nao finalizada sobrevive ao reload
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.gerarAuto();                                   // R2 gerada
    t.preencherPlacares(2, function () { return [2, 1]; });  // digitado, nao finalizado
    t.run("capturarRascunho(2);");                   // o `change` faria isso

    ok(t.estadoRodadas()[2] === "gerada",
       "R2 fica marcada como 'gerada'", JSON.stringify(t.estadoRodadas()));

    t.recarregarDoStorage();
    ok(t.estadoRodadas()[2] === "gerada", "o estado 'gerada' sobrevive ao reload");
    ok(t.run("rodadaAtualEstaFinalizada()") === false,
       "com R2 em andamento, a proxima rodada NAO pode ser oferecida");

    var rascunho = t.rascunhos()[2];
    ok(rascunho && Object.keys(rascunho.placares || {}).length > 0,
       "os placares digitados em R2 foram preservados",
       JSON.stringify(rascunho));
  })();


  // -- rodada em correcao sobrevive ao reload
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.reabrir(1);
    ok(t.estadoRodadas()[1] === "corrigindo",
       "reabrir marca a rodada como 'corrigindo'", JSON.stringify(t.estadoRodadas()));

    t.recarregarDoStorage();
    ok(t.estadoRodadas()[1] === "corrigindo", "o estado 'corrigindo' sobrevive ao reload");
    ok(t.run("rodadaAtualEstaFinalizada()") === false,
       "rodada em correcao nao libera a proxima");
  })();

  // -- so uma rodada finalizada libera a proxima
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    t.gerarAuto();
    ok(t.run("rodadaAtualEstaFinalizada()") === false, "rodada recem-gerada nao libera");
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    ok(t.run("rodadaAtualEstaFinalizada()") === true, "rodada finalizada libera a proxima");
  })();
})();

// ================= 10. Autosave: correção, BYE e bloqueio de rodada
grupo("10. Autosave em correção, BYE no slot 0 e bloqueios");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  function torneioComRodadaFinalizada(nomes, totalRodadas) {
    var t = criar(nomes, totalRodadas || 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    return t;
  }

  // -- 1) autosave durante "Corrigir Placares", com EVENTO REAL
  (function () {
    var t = torneioComRodadaFinalizada(["A", "B", "C", "D"]);
    t.reabrir(1);

    ok(t.estadoRodadas()[1] === "corrigindo", "entrou em correcao");

    // A tela de correcao usa campos com sufixo _r
    ok(t.campoExiste("r1_p0_r"), "os campos de correcao existem com sufixo _r");

    // Os campos ja vem com o placar que estava valendo
    ok(t.valorDoCampo("r1_p0_r") === "2" && t.valorDoCampo("r1_p1_r") === "0",
       "a correcao abre com o placar atual preenchido",
       t.valorDoCampo("r1_p0_r") + " x " + t.valorDoCampo("r1_p1_r"));

    // Altera 2x0 para 1x2 disparando o evento real
    t.digitar("r1_p0_r", 1, "change");
    t.digitar("r1_p1_r", 2, "change");

    var rasc = t.rascunhos()[1];
    ok(rasc && rasc.placares && rasc.placares["0"] &&
       rasc.placares["0"][0] === "1" && rasc.placares["0"][1] === "2",
       "o placar corrigido entra no rascunho (autosave le os campos _r)",
       JSON.stringify(rasc));

    // Recarrega
    t.recarregarDoStorage();
    ok(t.estadoRodadas()[1] === "corrigindo", "apos o reload continua em correcao");

    var depois = t.rascunhos()[1];
    ok(depois && depois.placares["0"][0] === "1" && depois.placares["0"][1] === "2",
       "o valor digitado sobreviveu ao reload", JSON.stringify(depois));

    ok(t.run("rodadaAtualEstaFinalizada()") === false,
       "durante a correcao a proxima rodada nao pode ser gerada");
  })();

  // -- 2) BYE no primeiro slot nao pode interromper a captura dos demais
  (function () {
    var t = criar(["A", "B", "C", "D", "E", "F", "G"], 3, 4);
    t.gerarAuto();

    var pares = t.run("resultadosPorRodada[1].map(function(p){return [p[0].nome,p[1].nome,p.slot];})");
    ok(pares[0][1] === "Bye" && pares[0][2] === 0,
       "com 7 jogadores o BYE fica no slot 0 (cenario do bug)",
       JSON.stringify(pares));

    // Preenche os tres jogos normais usando o EVENTO REAL
    var normais = pares.filter(function (p) { return p[1] !== "Bye"; });
    normais.forEach(function (p, k) {
      var slot = p[2];
      t.digitar("r1_p" + (slot * 2), 2, "change");
      t.digitar("r1_p" + (slot * 2 + 1), k, "change");
    });

    var rasc = t.rascunhos()[1];
    var salvos = rasc ? Object.keys(rasc.placares || {}).length : 0;
    ok(salvos === 3,
       "os 3 placares foram salvos mesmo com o BYE no slot 0",
       "salvos: " + salvos + " -> " + JSON.stringify(rasc && rasc.placares));

    t.recarregarDoStorage();
    var depois = t.rascunhos()[1];
    ok(depois && Object.keys(depois.placares).length === 3,
       "os 3 placares reapareceram apos o reload",
       JSON.stringify(depois && depois.placares));

    var byeIntacto = t.run(
      "resultadosPorRodada[1].filter(function(p){return p[1].nome==='Bye';}).length"
    );
    ok(byeIntacto === 1, "o BYE continua intacto apos o reload", "byes: " + byeIntacto);
    ok(t.run("rodadaAtualEstaFinalizada()") === false,
       "a proxima rodada nao esta liberada");
  })();

  // -- 3) chamada direta de gerarRodada/gerarRodadaManual durante a correcao
  (function () {
    var t = torneioComRodadaFinalizada(["A", "B", "C", "D"]);
    t.reabrir(1);
    t.limparAlertas();

    var antes = t.estado();
    t.gerarAuto();
    ok(/correção|correcao/i.test(t.alertas().join(" ")),
       "gerarRodada() e recusada durante a correcao", t.alertas().join(" | "));
    ok(t.estado() === antes, "gerarRodada() recusada nao altera estado");

    ok(t.rodadaAtual() === 1, "rodadaAtual nao avancou", "rodadaAtual=" + t.rodadaAtual());
  })();

  // -- 4) uma unica representacao visual da rodada
  (function () {
    var t = torneioComRodadaFinalizada(["A", "B", "C", "D"]);
    ok(t.blocosDaRodada(1).length === 1, "rodada finalizada tem 1 bloco",
       t.blocosDaRodada(1).join(", "));

    t.reabrir(1);
    ok(t.blocosDaRodada(1).length === 1,
       "durante a correcao continua havendo 1 bloco (a tabela antiga saiu)",
       t.blocosDaRodada(1).join(", "));

    t.digitar("r1_p0_r", 1, "change");
    t.digitar("r1_p1_r", 2, "change");
    t.preencherPlacaresReabertos(1, function (a, b, i) { return i === 0 ? [1, 2] : [2, 0]; });
    t.finalizarCorrecao(1);

    ok(t.blocosDaRodada(1).length === 1,
       "apos salvar a correcao resta 1 bloco",
       t.blocosDaRodada(1).join(", "));
    ok(t.estadoRodadas()[1] === "finalizada", "a rodada volta a 'finalizada'");

    var exp = t.exportar(1).filter(function (o) { return o.rodada === 1; });
    var corrigido = exp.filter(function (o) { return o.resultado === "1 x 2"; });
    ok(corrigido.length === 1, "o placar corrigido consta na exportacao",
       JSON.stringify(exp));
  })();

  // -- 5) falha do localStorage nao quebra o torneio e avisa uma vez
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.quebrarStorage();
    t.limparAlertas();

    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);

    ok(t.estadoRodadas()[1] === "finalizada",
       "o torneio continua funcionando com o storage quebrado",
       JSON.stringify(t.estadoRodadas()));

    var avisos = t.alertas().filter(function (m) { return /recuperação automática/i.test(m); });
    ok(avisos.length === 1,
       "o organizador e avisado UMA vez que nao ha recuperacao automatica",
       "avisos: " + avisos.length + " | " + t.alertas().join(" | "));

    var exp = t.exportar(1);
    ok(exp.length === 2, "a exportacao segue funcionando sem storage",
       JSON.stringify(exp));
  })();
})();

// ================ 11. Cenário do teste real no Safari (7 jogadores)
grupo("11. Cenário do Safari: 7 jogadores, R1 em andamento");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;
  var ELENCO = ["Caio", "Alex", "Gabriel", "Flavio", "Eduardo", "Pablo", "Bruno Novaes"];

  // -- placares salvos usando SOMENTE o evento `input`
  (function () {
    var t = criar(ELENCO, 4, 4);
    t.gerarAuto();

    var pares = t.run("resultadosPorRodada[1].map(function(p){return [p[0].nome,p[1].nome,p.slot];})");
    var comBye = pares.filter(function (p) { return p[1] === "Bye"; });
    var normais = pares.filter(function (p) { return p[1] !== "Bye"; });

    ok(comBye.length === 1 && normais.length === 3,
       "R1 gerada: 1 BYE e 3 jogos", JSON.stringify(pares));

    // Digita os 3 placares disparando APENAS `input` (nunca `change`)
    normais.forEach(function (p, k) {
      var slot = p[2];
      t.digitar("r1_p" + (slot * 2), [2, 0, 1][k], "input");
      t.digitar("r1_p" + (slot * 2 + 1), [0, 2, 1][k], "input");
    });

    // O storage tem de conter os 3 IMEDIATAMENTE — sem esperar timer nenhum
    var bruto = t.run("localStorage.getItem('ligaSupermarket:torneioEmAndamento')");
    ok(!!bruto, "o estado foi gravado no localStorage");

    var salvo = JSON.parse(bruto || "{}");
    var placares = (salvo.rascunhos && salvo.rascunhos["1"] && salvo.rascunhos["1"].placares) || {};
    ok(Object.keys(placares).length === 3,
       "os 3 placares estao no localStorage so com evento `input`",
       JSON.stringify(placares));

    // Reload
    t.recarregarDoStorage();
    var depois = t.rascunhos()[1];
    var pd = (depois && depois.placares) || {};
    ok(Object.keys(pd).length === 3,
       "os 3 placares foram restaurados apos o reload", JSON.stringify(pd));

    var valores = Object.keys(pd).sort().map(function (k) { return pd[k][0] + "x" + pd[k][1]; });
    ok(valores.join(",") === "2x0,0x2,1x1",
       "os valores restaurados sao exatamente os digitados", valores.join(","));
  })();

  // -- rodada nao finalizada NAO altera a classificacao, e o BYE nao pontua
  (function () {
    var t = criar(ELENCO, 4, 4);
    t.gerarAuto();

    var jogs = t.jogadores();
    var comPontos = jogs.filter(function (j) { return j.pontos !== 0; });
    ok(comPontos.length === 0,
       "gerar a rodada NAO da pontos a ninguem, nem ao BYE",
       JSON.stringify(comPontos.map(function (j) { return j.nome + "=" + j.pontos; })));

    var comHistorico = jogs.filter(function (j) { return (j.historico || []).length > 0; });
    ok(comHistorico.length === 0,
       "nenhum historico e gravado na geracao da rodada",
       JSON.stringify(comHistorico.map(function (j) { return j.nome; })));

    ok(t.ranking().length === 0,
       "sem rodada finalizada nao existe classificacao",
       JSON.stringify(t.ranking()));

    // Depois de finalizar, o BYE entra
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);

    var byeJogador = t.run(
      "resultadosPorRodada[1].filter(function(p){return p[1].nome==='Bye';})[0][0].nome"
    );
    var b = t.jogadores().filter(function (j) { return j.nome === byeJogador; })[0];
    ok(b.pontos === 3 && b.historico.length === 1,
       "apos finalizar, o BYE vale 3 pontos e uma entrada de historico",
       byeJogador + ": pontos=" + b.pontos + " historico=" + b.historico.length);
    ok(t.ranking().length > 0, "com R1 finalizada a classificacao existe");
  })();

  // -- reload antes de finalizar nao pode duplicar o BYE
  (function () {
    var t = criar(ELENCO, 4, 4);
    t.gerarAuto();
    t.recarregarDoStorage();
    t.recarregarDoStorage();          // duas vezes, para caçar acúmulo

    var jogs = t.jogadores();
    var byes = jogs.reduce(function (n, j) {
      return n + (j.historico || []).filter(function (h) { return h.contra === "Bye"; }).length;
    }, 0);
    ok(byes === 0, "reload de rodada nao finalizada nao aplica BYE", "byes: " + byes);

    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);

    var byesDepois = t.jogadores().reduce(function (n, j) {
      return n + (j.historico || []).filter(function (h) { return h.contra === "Bye"; }).length;
    }, 0);
    ok(byesDepois === 1, "apos finalizar existe exatamente UM BYE",
       "byes: " + byesDepois);

    t.finalizar(1);                   // segunda chamada nao pode duplicar
    var byesRefinalizar = t.jogadores().reduce(function (n, j) {
      return n + (j.historico || []).filter(function (h) { return h.contra === "Bye"; }).length;
    }, 0);
    ok(byesRefinalizar === 1, "finalizar de novo nao duplica o BYE",
       "byes: " + byesRefinalizar);
  })();

  // -- campeao so na ultima rodada finalizada
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);

    function rodada(n) {
      t.gerarAuto();
      t.preencherPlacares(n, function () { return [2, 0]; });
      t.finalizar(n);
    }

    rodada(1);
    ok(!/Campeão|Campeao/.test(t.run("document.getElementById('appendix-c') ? '' : ''") || "") &&
       t.run("(function(){var a=document.getElementById('torneio-area');return (a&&a.innerHTML)||'';})()")
         .indexOf("Campeão") === -1,
       "sem campeao com 1 de 3 rodadas");

    rodada(2);
    ok(t.run("(function(){var a=document.getElementById('torneio-area');return (a&&a.innerHTML)||'';})()")
         .indexOf("Campeão") === -1,
       "sem campeao com 2 de 3 rodadas");

    rodada(3);
    ok(t.run("(function(){var a=document.getElementById('torneio-area');return (a&&a.innerHTML)||'';})()")
         .indexOf("Campeão") !== -1,
       "campeao aparece com a ultima rodada finalizada");
  })();

  // -- classificacao recuperada considera somente rodadas finalizadas
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);

    var apos1 = t.ranking().map(function (l) { return l.jogador + ":" + l.matchPoints; }).join(",");

    t.gerarAuto();                                     // R2 gerada
    t.preencherPlacares(2, function () { return [2, 0]; });   // placares digitados
    t.run("capturarRascunho(2);");

    ok(t.ranking().map(function (l) { return l.jogador + ":" + l.matchPoints; }).join(",") === apos1,
       "placares digitados em R2 nao entram na classificacao antes de finalizar",
       t.ranking().map(function (l) { return l.jogador + ":" + l.matchPoints; }).join(","));

    t.recarregarDoStorage();
    ok(t.ranking().map(function (l) { return l.jogador + ":" + l.matchPoints; }).join(",") === apos1,
       "apos o reload a classificacao segue sendo a de R1",
       t.ranking().map(function (l) { return l.jogador + ":" + l.matchPoints; }).join(","));
  })();

  // -- "Corrigir Placares" so existe depois de finalizar
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarAuto();
    ok(!t.campoExiste("btn-reabrir-1"),
       "o botao Corrigir Placares nao existe com a rodada em andamento");

    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    ok(t.campoExiste("btn-reabrir-1"),
       "o botao Corrigir Placares aparece apos a finalizacao");
  })();

  // -- o botao tem de SOBREVIVER ao reload (falha do teste real no Safari)
  (function () {
    var t = criar(ELENCO, 4, 4);   // 7 jogadores, como no teste real

    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    ok(t.campoExiste("btn-reabrir-1"), "R1 finalizada: Corrigir Placares existe");

    // Reload — era aqui que o botao sumia
    t.recarregarComRender();
    ok(t.campoExiste("btn-reabrir-1"),
       "apos o reload, Corrigir Placares da R1 continua existindo");

    // Gerar R2 tira o botao da R1
    t.gerarAuto();
    ok(!t.campoExiste("btn-reabrir-1"),
       "ao gerar R2, o botao da R1 desaparece");
    ok(!t.campoExiste("btn-reabrir-2"),
       "R2 em andamento ainda nao tem botao de correcao");

    // Finalizar R2 traz o botao so para a R2
    t.preencherPlacares(2, function () { return [2, 0]; });
    t.finalizar(2);
    ok(t.campoExiste("btn-reabrir-2"), "R2 finalizada: o botao aparece na R2");
    ok(!t.campoExiste("btn-reabrir-1"), "e continua ausente na R1");

    // E sobrevive ao reload tambem na R2
    t.recarregarComRender();
    ok(t.campoExiste("btn-reabrir-2") && !t.campoExiste("btn-reabrir-1"),
       "apos novo reload, o botao segue apenas na R2");
  })();
})();

// ============ 12. Correção com BYE: rascunho visual e standings
grupo("12. Correção de placares com BYE (cenário do Safari)");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;
  var ELENCO7 = ["Caio", "Alex", "Gabriel", "Flavio", "Eduardo", "Pablo", "Bruno Novaes"];

  (function () {
    var t = criar(ELENCO7, 4, 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);

    // Slots reais dos jogos (o BYE ocupa o slot 0)
    var pares = t.run("resultadosPorRodada[1].map(function(p){return [p[0].nome,p[1].nome,p.slot];})");
    var normais = pares.filter(function (p) { return p[1] !== "Bye"; });
    var slotAlvo = normais[0][2];

    t.reabrir(1);

    ok(t.valorDoCampo("r1_p" + (slotAlvo * 2) + "_r") === "2",
       "a correcao abre com o placar atual nos campos _r",
       String(t.valorDoCampo("r1_p" + (slotAlvo * 2) + "_r")));

    // Altera 2x0 -> 1x2 usando SOMENTE o evento `input`
    t.digitar("r1_p" + (slotAlvo * 2) + "_r", 1, "input");
    t.digitar("r1_p" + (slotAlvo * 2 + 1) + "_r", 2, "input");

    // O localStorage tem de conter 1 e 2
    var salvo = JSON.parse(t.run("localStorage.getItem('ligaSupermarket:torneioEmAndamento')") || "{}");
    var pl = (salvo.rascunhos && salvo.rascunhos["1"] && salvo.rascunhos["1"].placares) || {};
    ok(pl[String(slotAlvo)] && pl[String(slotAlvo)][0] === "1" && pl[String(slotAlvo)][1] === "2",
       "o localStorage contem 1 e 2 apos o evento input",
       JSON.stringify(pl));

    // Reload COM renderizacao
    t.recarregarComRender();

    ok(t.estadoRodadas()[1] === "corrigindo", "volta em Corrigindo Placares");

    // O que o Safari mostrou vazio: os VALORES nos inputs _r
    ok(t.valorDoCampo("r1_p" + (slotAlvo * 2) + "_r") === "1" &&
       t.valorDoCampo("r1_p" + (slotAlvo * 2 + 1) + "_r") === "2",
       "os inputs _r exibem 1 e 2 depois do reload",
       t.valorDoCampo("r1_p" + (slotAlvo * 2) + "_r") + " x " +
       t.valorDoCampo("r1_p" + (slotAlvo * 2 + 1) + "_r"));

    // Os demais jogos tambem reaparecem
    var outros = normais.slice(1);
    var todosOk = outros.every(function (p) {
      return t.valorDoCampo("r1_p" + (p[2] * 2) + "_r") === "2" &&
             t.valorDoCampo("r1_p" + (p[2] * 2 + 1) + "_r") === "0";
    });
    ok(todosOk, "os outros placares tambem reaparecem nos campos _r",
       JSON.stringify(outros.map(function (p) {
         return t.valorDoCampo("r1_p" + (p[2] * 2) + "_r") + "x" +
                t.valorDoCampo("r1_p" + (p[2] * 2 + 1) + "_r");
       })));

    // Nenhuma classificacao durante a correcao
    var html = t.run("(function(){var a=document.getElementById('torneio-area');return (a&&a.innerHTML)||'';})()");
    ok(html.indexOf("Ranking Atual") === -1,
       "Ranking Atual nao aparece durante a correcao");
    ok(html.indexOf("Appendix C") === -1,
       "Appendix C nao aparece durante a correcao");

    // Salva a correcao com o que esta na tela — que e justamente o rascunho
    // restaurado (1 x 2 no jogo alterado, 2 x 0 nos demais).
    t.finalizarCorrecao(1);

    var html2 = t.run("(function(){var a=document.getElementById('torneio-area');return (a&&a.innerHTML)||'';})()");
    ok(html2.indexOf("Ranking Atual") !== -1,
       "apos salvar, Ranking Atual reaparece");
    ok(html2.indexOf("Appendix C") !== -1,
       "apos salvar, Appendix C reaparece");

    // O BYE segue contabilizado uma unica vez
    var byes = t.jogadores().reduce(function (n, j) {
      return n + (j.historico || []).filter(function (h) { return h.contra === "Bye"; }).length;
    }, 0);
    ok(byes === 1, "o BYE continua contabilizado uma unica vez", "byes: " + byes);

    // E o placar corrigido valeu
    var exp = t.exportar(1).filter(function (o) { return o.resultado === "1 x 2"; });
    ok(exp.length === 1, "o placar corrigido consta na exportacao",
       JSON.stringify(t.exportar(1)));
  })();
})();

// ==================== 13. Fluxo único: não existe geração manual
grupo("13. Fluxo único (geração manual removida)");

(function () {
  var htmlBruto = fs.readFileSync(path.join(RAIZ, "novo-torneio-V6.html"), "utf8");

  // Comentários fora: eles legitimamente citam o fluxo antigo para explicar
  // por que ele saiu. O que não pode sobrar é código.
  var html = htmlBruto
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Nenhum símbolo do fluxo manual pode ter sobrado no código ativo.
  var simbolos = [
    "gerarRodadaManual", "lerRodadaManual", "validarRodadaManual",
    "lerPlacaresManual", "aplicarRodadaManual", "redesenharRodadaManual",
    "btn-proxima-manual", "_j1_", "_j2_"
  ];
  var encontrados = simbolos.filter(function (s) { return html.indexOf(s) !== -1; });
  ok(encontrados.length === 0,
     "nenhum simbolo do fluxo manual restou no codigo",
     encontrados.join(", "));

  // Nenhum botão que ofereça geração manual.
  ok(!/Rodada[^"'`]*\(manual\)/i.test(html),
     "nenhum botao oferece geracao manual de rodada");

  // O estado "manual" deixou de existir.
  ok(html.indexOf('"manual"') === -1 && html.indexOf("'manual'") === -1,
     "o estado \"manual\" nao existe mais em estadoRodadas");

  // Nenhum <select> de montagem de confronto.
  ok(!/<select id="r\$\{/.test(html),
     "nao ha selects de montagem manual de confrontos");

  // O caminho automático continua inteiro.
  ["gerarRodada", "Pareamento.gerarRodada", "corrigirPlacares",
   "finalizarCorrecao", "montarJogosExportados", "capturarRascunho"]
    .forEach(function (s) {
      ok(html.indexOf(s) !== -1, "o fluxo automatico preserva " + s);
    });

  // E a função de gerar rodada manual realmente não existe no runtime.
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var t = integracao.criarTorneio(["A", "B", "C", "D"], 2, 4);
  var existe = t.run("typeof gerarRodadaManual");
  ok(existe === "undefined",
     "gerarRodadaManual nao existe no runtime", "typeof = " + existe);
})();

// ============ 14. Versão do estado salvo: recusar formatos antigos
grupo("14. Versão do estado persistido");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  // -- o estado gravado hoje carrega a versão atual
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarAuto();
    var salvo = JSON.parse(t.lerStorageBruto() || "{}");
    ok(Number(salvo.versao) === 2, "o estado e gravado com versao 2",
       "versao: " + salvo.versao);
  })();

  // -- estado versão 1, com uma rodada "manual": recusado, não restaurado
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 3, 4);

    // Formato antigo: versão 1, estadoRodadas com "manual" e rascunho com pares
    t.injetarEstadoBruto({
      versao: 1,
      salvoEm: new Date().toISOString(),
      ligaAtual: 4,
      diaAtual: 1,
      rodadaAtual: 2,
      totalRodadas: 3,
      ultimaRodadaFinalizada: 1,
      jogadores: [
        { nome: "A", pontos: 3, saldo: 2, historico: [{ contra: "B", placar: "2x0", rodada: 1 }] },
        { nome: "B", pontos: 0, saldo: -2, historico: [{ contra: "A", placar: "0x2", rodada: 1 }] }
      ],
      resultados: { 1: [{ j1: "A", j2: "B", slot: 0 }] },
      confrontosAnteriores: ["A|B", "B|A"],
      estadoRodadas: { 1: "finalizada", 2: "manual" },
      rascunhos: { 2: { numLinhas: 2, pares: { 0: ["A", "B"] }, placares: {} } }
    });

    t.limparAlertas();
    var lido = t.estadoSalvo();

    ok(lido === null, "estado de versao antiga NAO e devolvido para restauracao",
       JSON.stringify(lido && lido.versao));
    ok(/formato antigo/i.test(t.alertas().join(" ")),
       "o organizador e avisado de que havia um torneio incompativel",
       t.alertas().join(" | "));
    ok(!t.lerStorageBruto(),
       "o estado incompativel e descartado do storage",
       String(t.lerStorageBruto()).slice(0, 60));

    // E a recuperação não redesenha nada como rodada finalizada
    t.recarregarComRender();
    ok(t.rodadaAtual() === 0 && Object.keys(t.estadoRodadas()).length === 0,
       "nada foi restaurado a partir do estado antigo",
       "rodadaAtual=" + t.rodadaAtual() + " estados=" + JSON.stringify(t.estadoRodadas()));
    ok(t.blocosDaRodada(2).length === 0,
       "a rodada 'manual' do estado antigo nao virou bloco na tela",
       t.blocosDaRodada(2).join(", "));
  })();

  // -- estado de versão FUTURA também é recusado
  (function () {
    var t = criar(["A", "B"], 1, 4);
    t.injetarEstadoBruto({
      versao: 99, jogadores: [{ nome: "A", pontos: 0, saldo: 0, historico: [] }],
      resultados: {}, estadoRodadas: {}, rascunhos: {}, confrontosAnteriores: []
    });
    t.limparAlertas();
    ok(t.estadoSalvo() === null, "estado de versao futura tambem e recusado");
  })();
})();

// ============ 15. Exportação só com o torneio encerrado
grupo("15. Exportação travada até o fim do torneio");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  function jogarRodada(t, n) {
    t.gerarAuto();
    t.preencherPlacares(n, function () { return [2, 0]; });
    t.finalizar(n);
  }

  (function () {
    var t = criar(["A", "B", "C", "D"], 4, 4);

    ok(!t.campoExiste("btn-exportar"), "nao existe exportacao antes de iniciar");

    jogarRodada(t, 1);
    ok(!t.campoExiste("btn-exportar"), "nao existe exportacao apos R1 de 4");
    jogarRodada(t, 2);
    ok(!t.campoExiste("btn-exportar"), "nao existe exportacao apos R2 de 4");
    jogarRodada(t, 3);
    ok(!t.campoExiste("btn-exportar"), "nao existe exportacao apos R3 de 4");

    // Última rodada apenas GERADA: ainda não
    t.gerarAuto();
    ok(!t.campoExiste("btn-exportar"),
       "nao existe exportacao com a ultima rodada apenas gerada");

    t.preencherPlacares(4, function () { return [2, 0]; });
    t.finalizar(4);
    ok(t.campoExiste("btn-exportar"),
       "a exportacao aparece ao finalizar a ultima rodada");

    // Durante a correção some
    t.reabrir(4);
    ok(!t.campoExiste("btn-exportar"),
       "a exportacao some durante a correcao de placares");

    t.finalizarCorrecao(4);
    ok(t.campoExiste("btn-exportar"), "volta ao salvar a correcao");

    // E sobrevive ao reload de um torneio encerrado
    t.recarregarComRender();
    ok(t.campoExiste("btn-exportar"),
       "a exportacao continua disponivel apos reload do torneio encerrado");
  })();

  // -- guarda de dominio: chamada direta e recusada antes do fim
  (function () {
    var t = criar(["A", "B", "C", "D"], 3, 4);
    jogarRodada(t, 1);

    t.limparAlertas();
    t.run("exportarResultadosParaJSON();");
    ok(/ainda não terminou|ainda nao terminou/i.test(t.alertas().join(" ")),
       "exportarResultadosParaJSON() e recusada com o torneio em andamento",
       t.alertas().join(" | "));
  })();
})();

// ============ 16. Importador de resultados para o jogos.json
grupo("16. Importador (importar-resultados.js)");

(function () {
  var os = require("os");
  var Importador = require(path.join(RAIZ, "importar-resultados.js"));

  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "liga-import-"));
  var destino = path.join(tmpDir, "jogos.json");
  var seq = 0;

  // Cadastros próprios: a suíte não depende do jogadores.json/ligas.json reais.
  var JOGADORES = ["A", "B", "C", "D", "Sérgio"];
  var LIGAS = [{ id: 4 }, { id: 9 }];

  function opts(extra) {
    var o = { destino: destino, jogadores: JOGADORES, ligas: LIGAS, apply: true };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  // Base pequena e controlada: Liga 4 com os Dias 1 e 2, como no projeto real.
  function baseInicial() {
    return [
      { liga: 4, dia: 1, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
      { liga: 4, dia: 2, rodada: 1, jogador1: "A", resultado: "2 x 1", jogador2: "C" }
    ];
  }

  function prepararDestino() {
    fs.writeFileSync(destino, Importador.serializarJogos(baseInicial()), "utf8");
    return fs.readFileSync(destino, "utf8");
  }

  function arquivoCom(conteudo) {
    var p = path.join(tmpDir, "entrada-" + (++seq) + ".json");
    fs.writeFileSync(p, typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo), "utf8");
    return p;
  }

  // Dia 3 válido: 2 rodadas, com BYE e um game empatado.
  function diaValido() {
    return [
      { liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
      { liga: 4, dia: 3, rodada: 1, jogador1: "C", resultado: "2 x 0", jogador2: "Bye" },
      { liga: 4, dia: 3, rodada: 2, jogador1: "A", resultado: "2 x 0", jogador2: "C", gamesEmpatados: 1 },
      { liga: 4, dia: 3, rodada: 2, jogador1: "B", resultado: "2 x 0", jogador2: "Bye" }
    ];
  }

  // Roda o importador e confirma que o destino NÃO mudou quando falha.
  function recusa(descricao, jogos, regex) {
    var antes = prepararDestino();
    var r = Importador.importar(opts({ arquivo: arquivoCom(jogos) }));
    var msg = r.erros.join(" | ");
    ok(!r.ok && (!regex || regex.test(msg)), descricao, msg.slice(0, 120));
    ok(fs.readFileSync(destino, "utf8") === antes,
       "  ↳ o jogos.json ficou intacto", "arquivo foi alterado!");
  }

  // ---- importação válida
  (function () {
    var antesDaImportacao = prepararDestino();
    var r = Importador.importar(opts({ arquivo: arquivoCom(diaValido()) }));

    ok(r.ok, "importacao valida e aceita", r.erros.join(" | "));
    ok(r.resumo && r.resumo.liga === 4 && r.resumo.dia === 3 && r.resumo.rodadas === 2,
       "o resumo traz liga, dia e rodadas", JSON.stringify(r.resumo));
    ok(r.resumo.registros === 4 && r.resumo.byes === 2 && r.resumo.comEmpates === 1,
       "o resumo conta registros, BYEs e games empatados", JSON.stringify(r.resumo));

    var final = JSON.parse(fs.readFileSync(destino, "utf8"));
    ok(final.length === 6, "os 2 registros antigos foram preservados e 4 acrescentados",
       "total: " + final.length);
    ok(final[0].dia === 1 && final[1].dia === 2,
       "os registros antigos seguem intactos e na ordem");

    // O importador acrescenta por TEXTO: as linhas antigas não podem ser
    // reescritas, senão o diff a revisar vira ruído. A ÚNICA exceção legítima é
    // a última linha de dados, que ganha a vírgula exigida pelo JSON.
    var linhasDepois = fs.readFileSync(destino, "utf8").split("\n");
    var linhasAntes = antesDaImportacao.split("\n");
    var ultimaDado = linhasAntes.length - 3;   // antes de "]" e da linha vazia final

    var alteradas = 0;
    for (var i = 0; i < ultimaDado; i++) {
      if (linhasAntes[i] !== linhasDepois[i]) alteradas++;
    }
    ok(alteradas === 0,
       "nenhuma linha antiga foi reescrita (diff puramente aditivo)",
       "alteradas: " + alteradas);
    ok(linhasDepois[ultimaDado] === linhasAntes[ultimaDado] + ",",
       "a ultima linha antiga so ganhou a virgula",
       JSON.stringify(linhasDepois[ultimaDado]).slice(0, 90));
    ok(final.filter(function (j) { return j.gamesEmpatados; }).length === 1,
       "gamesEmpatados sobreviveu a gravacao");

    // formatação: um objeto por linha
    var linhas = fs.readFileSync(destino, "utf8").trim().split("\n");
    ok(linhas.length === 8 && linhas[0] === "[" && linhas[linhas.length - 1] === "]",
       "o arquivo mantem um objeto por linha", "linhas: " + linhas.length);

    ok(!!r.backup && fs.existsSync(r.backup), "um backup foi criado", String(r.backup));
  })();

  // ---- arquivo inexistente e JSON malformado
  (function () {
    prepararDestino();
    var r = Importador.importar(opts({ arquivo: path.join(tmpDir, "nao-existe.json") }));
    ok(!r.ok && /não encontrado|nao encontrado/i.test(r.erros.join(" ")),
       "arquivo inexistente e recusado", r.erros.join(" | "));

    var antes = prepararDestino();
    var r2 = Importador.importar(opts({ arquivo: arquivoCom("{ isso nao e json") }));
    ok(!r2.ok && /JSON válido|JSON valido/i.test(r2.erros.join(" ")),
       "JSON invalido e recusado", r2.erros.join(" | "));
    ok(fs.readFileSync(destino, "utf8") === antes, "  ↳ o jogos.json ficou intacto");
  })();

  // ---- estrutura
  recusa("JSON que nao e array e recusado", { liga: 4 }, /array/i);
  recusa("arquivo vazio e recusado", [], /vazio/i);

  recusa("campo obrigatorio ausente e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", jogador2: "B" }], /resultado/i);

  recusa("liga/dia/rodada nao inteiros sao recusados",
    [{ liga: 4, dia: "3", rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /inteiro/i);

  // "2x0" passaria no MTR.parsePlacar, mas quebraria o split(" x ") do main.js
  recusa('resultado "2x0" (sem espacos) e recusado',
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2x0", jogador2: "B" }],
    /formato/i);

  recusa("gamesEmpatados negativo e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B",
       gamesEmpatados: -1 }], /gamesEmpatados/i);

  recusa("jogador vazio e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "", resultado: "2 x 0", jogador2: "B" }],
    /vazio/i);

  recusa("duas ligas no mesmo arquivo e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 5, dia: 3, rodada: 1, jogador1: "C", resultado: "2 x 0", jogador2: "D" }],
    /mais de uma liga/i);

  recusa("dois dias no mesmo arquivo e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 4, dia: 4, rodada: 1, jogador1: "C", resultado: "2 x 0", jogador2: "D" }],
    /mais de um dia/i);

  // ---- liga + dia já existente
  recusa("liga + dia ja existente e recusado",
    [{ liga: 4, dia: 2, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /já existe|ja existe/i);

  // ---- continuidade do dia
  recusa("dia a frente e recusado (caso real: Dia 5 com 1 e 2 publicados)",
    [{ liga: 4, dia: 5, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /próximo dia esperado é o Dia 3|proximo dia esperado/i);

  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([{ liga: 4, dia: 5, rodada: 1, jogador1: "A",
                             resultado: "2 x 0", jogador2: "B" }])
    }));
    ok(/Dia 3/.test(r.erros.join(" ")),
       "a mensagem aponta explicitamente o Dia 3 como esperado", r.erros.join(" | "));
  })();

  // liga nova precisa começar no Dia 1
  recusa("liga nova comecando fora do Dia 1 e recusada",
    [{ liga: 9, dia: 2, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /Dia 1/);

  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([{ liga: 9, dia: 1, rodada: 1, jogador1: "A",
                             resultado: "2 x 0", jogador2: "B" }])
    }));
    ok(r.ok, "liga nova comecando no Dia 1 e aceita", r.erros.join(" | "));
  })();

  // ---- duplicidade canônica
  recusa("mesma partida repetida e recusada",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /duas vezes/i);

  recusa("A x B e B x A na mesma rodada sao a MESMA partida",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 4, dia: 3, rodada: 1, jogador1: "B", resultado: "1 x 2", jogador2: "A" }],
    /duas vezes/i);

  // ---- invariantes da rodada
  recusa("jogador repetido na mesma rodada e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "C" }],
    /aparece em 2 jogos/i);

  recusa("dois BYEs na mesma rodada e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "Bye" },
     { liga: 4, dia: 3, rodada: 1, jogador1: "B", resultado: "2 x 0", jogador2: "Bye" }],
    /Byes/i);

  recusa("BYE em jogador1 e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "Bye", resultado: "2 x 0", jogador2: "A" }],
    /jogador2/i);

  recusa("BYE com resultado diferente de 2 x 0 e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 1", jogador2: "Bye" }],
    /Bye.*2 x 0/i);

  recusa("BYE com gamesEmpatados e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "Bye",
       gamesEmpatados: 1 }], /Bye.*gamesEmpatados/i);

  recusa("rodadas com lacuna (1, 2, 4) sao recusadas",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" },
     { liga: 4, dia: 3, rodada: 2, jogador1: "A", resultado: "2 x 0", jogador2: "C" },
     { liga: 4, dia: 3, rodada: 4, jogador1: "A", resultado: "2 x 0", jogador2: "D" }],
    /sem lacunas/i);

  recusa("rodadas que nao comecam em 1 sao recusadas",
    [{ liga: 4, dia: 3, rodada: 2, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /sem lacunas/i);

  // ---- dry-run
  (function () {
    var antes = prepararDestino();
    var r = Importador.importar(opts({ arquivo: arquivoCom(diaValido()), apply: false }));
    ok(r.ok && r.simulado, "sem --apply o script apenas valida", r.erros.join(" | "));
    ok(r.resumo.registros === 4, "a validacao traz o resumo completo", JSON.stringify(r.resumo));
    ok(fs.readFileSync(destino, "utf8") === antes,
       "sem --apply o jogos.json fica byte a byte igual");
    ok(!r.backup, "sem --apply nenhum backup e criado", String(r.backup));
  })();

  // ---- importar duas vezes: a segunda e recusada
  (function () {
    prepararDestino();
    var arq = arquivoCom(diaValido());
    var r1 = Importador.importar(opts({ arquivo: arq }));
    ok(r1.ok, "primeira importacao aceita");

    var depoisDaPrimeira = fs.readFileSync(destino, "utf8");
    var r2 = Importador.importar(opts({ arquivo: arq }));
    ok(!r2.ok && /já existe|ja existe/i.test(r2.erros.join(" ")),
       "a segunda importacao do mesmo arquivo e recusada", r2.erros.join(" | "));
    ok(fs.readFileSync(destino, "utf8") === depoisDaPrimeira,
       "a recusa nao altera o arquivo ja importado");
  })();

  // ---- seguro por padrão: sem --apply nada é gravado
  (function () {
    var antes = prepararDestino();
    var arq = arquivoCom(diaValido());

    function backups() {
      return fs.readdirSync(tmpDir).filter(function (f) {
        return /^jogos\.backup-/.test(f);
      }).length;
    }
    var backupsAntes = backups();

    // chamada SEM apply (o padrão do CLI)
    var r = Importador.importar({ arquivo: arq, destino: destino,
                                  jogadores: JOGADORES, ligas: LIGAS });
    ok(r.ok && r.simulado,
       "o padrao e apenas validar (apply ausente)", JSON.stringify(r.simulado));
    ok(fs.readFileSync(destino, "utf8") === antes,
       "sem apply o destino fica byte a byte igual");
    ok(backups() === backupsAntes,
       "sem apply nenhum backup NOVO e criado",
       backupsAntes + " -> " + backups());

    // agora com apply
    var r2 = Importador.importar(opts({ arquivo: arq }));
    ok(r2.ok && !r2.simulado, "com apply a gravacao acontece");
    ok(fs.readFileSync(destino, "utf8") !== antes, "com apply o destino muda");
  })();

  // ---- jogadores precisam estar em jogadores.json
  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([
        { liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }
      ])
    }));
    ok(r.ok, "jogadores cadastrados sao aceitos", r.erros.join(" | "));
  })();

  recusa("jogador desconhecido e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "Fulano" }],
    /não cadastrados|nao cadastrados/i);

  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([
        { liga: 4, dia: 3, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "Fulano" },
        { liga: 4, dia: 3, rodada: 2, jogador1: "A", resultado: "2 x 0", jogador2: "Beltrano" }
      ])
    }));
    var msg = r.erros.join(" ");
    ok(!r.ok && /Fulano/.test(msg) && /Beltrano/.test(msg),
       "a mensagem lista TODOS os jogadores desconhecidos", msg.slice(0, 120));
  })();

  // grafia/capitalização diferente é jogador diferente — é a regra crítica
  recusa("capitalizacao diferente e recusada (a x A)",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "a", resultado: "2 x 0", jogador2: "B" }],
    /não cadastrados|nao cadastrados/i);

  recusa("acento faltando e recusado (Sergio x Sérgio)",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "Sergio", resultado: "2 x 0", jogador2: "B" }],
    /Sergio/);

  recusa("espaco extra no nome e recusado",
    [{ liga: 4, dia: 3, rodada: 1, jogador1: "A ", resultado: "2 x 0", jogador2: "B" }],
    /não cadastrados|nao cadastrados/i);

  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([
        { liga: 4, dia: 3, rodada: 1, jogador1: "Sérgio", resultado: "2 x 0", jogador2: "Bye" }
      ])
    }));
    ok(r.ok, "\"Bye\" nao precisa estar cadastrado como jogador", r.erros.join(" | "));
  })();

  // ---- a liga precisa estar em ligas.json
  recusa("liga inexistente em ligas.json e recusada",
    [{ liga: 7, dia: 1, rodada: 1, jogador1: "A", resultado: "2 x 0", jogador2: "B" }],
    /não existe em ligas.json|nao existe em ligas.json/i);

  (function () {
    prepararDestino();
    var r = Importador.importar(opts({
      arquivo: arquivoCom([{ liga: 7, dia: 1, rodada: 1, jogador1: "A",
                             resultado: "2 x 0", jogador2: "B" }])
    }));
    ok(/cadastradas: 4, 9/.test(r.erros.join(" ")),
       "a mensagem informa quais ligas existem", r.erros.join(" | "));
  })();

  // ---- nome com caractere que precisa de escape sobrevive à gravação
  (function () {
    var nomeComAspas = 'Jo"ao \\ Silva';
    prepararDestino();
    var r = Importador.importar({
      arquivo: arquivoCom([
        { liga: 4, dia: 3, rodada: 1, jogador1: nomeComAspas, resultado: "2 x 0", jogador2: "B" }
      ]),
      destino: destino,
      jogadores: JOGADORES.concat([nomeComAspas]),
      ligas: LIGAS,
      apply: true
    });
    ok(r.ok, "nome com aspas e barra e aceito", r.erros.join(" | "));

    var texto = fs.readFileSync(destino, "utf8");
    var lido = JSON.parse(texto);   // lança se o escape estiver errado
    ok(Array.isArray(lido), "o jogos.json segue sendo JSON valido apos o escape");
    ok(lido[lido.length - 1].jogador1 === nomeComAspas,
       "o nome com escape volta identico da gravacao",
       JSON.stringify(lido[lido.length - 1].jogador1));
  })();

  // ---- cadastros ilegíveis: FAIL CLOSED, nunca "seguir sem validar"
  (function () {
    var jogadoresOk = path.join(tmpDir, "jogadores-ok.json");
    var ligasOk = path.join(tmpDir, "ligas-ok.json");
    fs.writeFileSync(jogadoresOk, JSON.stringify(JOGADORES), "utf8");
    fs.writeFileSync(ligasOk, JSON.stringify(LIGAS), "utf8");

    var ausente = path.join(tmpDir, "nao-existe-cadastro.json");
    var invalido = path.join(tmpDir, "cadastro-invalido.json");
    var naoArray = path.join(tmpDir, "cadastro-nao-array.json");
    fs.writeFileSync(invalido, "{ isso nao e json", "utf8");
    fs.writeFileSync(naoArray, JSON.stringify({ jogadores: ["A"] }), "utf8");

    // Roda pelo caminho REAL de leitura de cadastro (sem passar as listas prontas)
    function comCadastros(jogadoresPath, ligasPath) {
      var antes = prepararDestino();
      var r = Importador.importar({
        arquivo: arquivoCom(diaValido()),
        destino: destino,
        jogadoresPath: jogadoresPath,
        ligasPath: ligasPath,
        apply: true
      });
      return { r: r, intacto: fs.readFileSync(destino, "utf8") === antes };
    }

    // sanidade: com os dois cadastros válidos, importa normalmente
    var bom = comCadastros(jogadoresOk, ligasOk);
    ok(bom.r.ok, "cadastros lidos do disco funcionam", bom.r.erros.join(" | "));

    [
      ["jogadores.json inexistente", ausente, ligasOk, /Não foi possível ler jogadores\.json|Nao foi possivel ler jogadores/i],
      ["jogadores.json com JSON invalido", invalido, ligasOk, /jogadores\.json não é um JSON válido|nao e um JSON valido/i],
      ["jogadores.json que nao e array", naoArray, ligasOk, /jogadores\.json não contém um array|nao contem um array/i],
      ["ligas.json inexistente", jogadoresOk, ausente, /Não foi possível ler ligas\.json|Nao foi possivel ler ligas/i],
      ["ligas.json com JSON invalido", jogadoresOk, invalido, /ligas\.json não é um JSON válido|nao e um JSON valido/i],
      ["ligas.json que nao e array", jogadoresOk, naoArray, /ligas\.json não contém um array|nao contem um array/i]
    ].forEach(function (caso) {
      var res = comCadastros(caso[1], caso[2]);
      ok(!res.r.ok && caso[3].test(res.r.erros.join(" ")),
         caso[0] + " cancela a importacao", res.r.erros.join(" | ").slice(0, 110));
      ok(res.intacto, "  ↳ o jogos.json ficou intacto", "arquivo foi alterado!");
    });

    // O ponto central: cadastro quebrado NÃO pode deixar passar um jogador
    // desconhecido. Antes, lerJSON devolvia null e a validação era pulada.
    var antes = prepararDestino();
    var r = Importador.importar({
      arquivo: arquivoCom([
        { liga: 4, dia: 3, rodada: 1, jogador1: "Fulano", resultado: "2 x 0", jogador2: "B" }
      ]),
      destino: destino,
      jogadoresPath: invalido,
      ligasPath: ligasOk,
      apply: true
    });
    ok(!r.ok, "com o cadastro quebrado, um jogador desconhecido NAO passa",
       r.erros.join(" | "));
    ok(fs.readFileSync(destino, "utf8") === antes, "  ↳ o jogos.json ficou intacto");
  })();

  // limpeza
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
})();

// ============ 17. Exportador sugere o próximo Dia da liga
grupo("17. Sugestão automática do próximo Dia");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  // Torneio de 1 rodada já encerrado, pronto para exportar.
  function torneioEncerrado(liga) {
    var t = criar(["A", "B"], 1, liga || 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    return t;
  }

  // ---- a regra pura, sem rede
  (function () {
    var t = torneioEncerrado();
    function calc(jogos, liga) {
      return t.run("calcularProximoDia(" + JSON.stringify(jogos) + ", " + liga + ")");
    }

    var liga4 = [
      { liga: 4, dia: 1 }, { liga: 4, dia: 1 }, { liga: 4, dia: 2 }
    ];
    var r = calc(liga4, 4);
    ok(r.ultimoDia === 2 && r.proximoDia === 3,
       "Liga 4 com Dias 1 e 2 -> ultimo 2, proximo 3", JSON.stringify(r));

    var r2 = calc([{ liga: 4, dia: 1 }], 4);
    ok(r2.ultimoDia === 1 && r2.proximoDia === 2,
       "liga com apenas o Dia 1 sugere o Dia 2", JSON.stringify(r2));

    var r3 = calc([{ liga: 4, dia: 1 }], 5);
    ok(r3.ultimoDia === 0 && r3.proximoDia === 1,
       "liga sem jogos sugere o Dia 1", JSON.stringify(r3));

    // jogos de outras ligas não podem interferir
    var r4 = calc([
      { liga: 1, dia: 12 }, { liga: 2, dia: 7 }, { liga: 3, dia: 6 }, { liga: 4, dia: 2 }
    ], 4);
    ok(r4.ultimoDia === 2 && r4.proximoDia === 3,
       "jogos de outras ligas nao interferem", JSON.stringify(r4));

    // registros sem o campo `liga` são da Liga 1 (convenção do site)
    var semLiga = [{ dia: 3 }, { dia: 5 }, { liga: 4, dia: 1 }];
    var r5 = calc(semLiga, 1);
    ok(r5.ultimoDia === 5 && r5.proximoDia === 6,
       "registros sem campo liga contam como Liga 1", JSON.stringify(r5));
    var r6 = calc(semLiga, 4);
    ok(r6.ultimoDia === 1 && r6.proximoDia === 2,
       "e nao vazam para outra liga", JSON.stringify(r6));

    // dias fora de ordem no arquivo
    var r7 = calc([{ liga: 4, dia: 3 }, { liga: 4, dia: 1 }, { liga: 4, dia: 2 }], 4);
    ok(r7.ultimoDia === 3 && r7.proximoDia === 4,
       "dias fora de ordem ainda resultam no maior + 1", JSON.stringify(r7));

    // e o cenário real do projeto
    var reais = JSON.parse(fs.readFileSync(path.join(RAIZ, "jogos.json"), "utf8"));
    var r8 = t.run("calcularProximoDia(" + JSON.stringify(reais) + ", 4)");
    ok(r8.ultimoDia === 2 && r8.proximoDia === 3,
       "no jogos.json real, a Liga 4 sugere o Dia 3", JSON.stringify(r8));
  })();

  // ---- o valor sugerido chega ao prompt, e continua editável
  testeAsync(function () {
    var t = torneioEncerrado(4);
    t.definirFetch({ json: [{ liga: 4, dia: 1 }, { liga: 4, dia: 2 }] });
    t.limparPrompts();
    t.responderPrompt("3");

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      var p = t.prompts()[0];
      ok(!!p, "o prompt do dia foi aberto");
      ok(p && p.padrao === "3", "o campo vem preenchido com o proximo dia (3)",
         p ? JSON.stringify(p.padrao) : "-");
      ok(p && /Liga 4/.test(p.mensagem) && /Último dia publicado: Dia 2/.test(p.mensagem) &&
         /Próximo dia sugerido: Dia 3/.test(p.mensagem),
         "a mensagem mostra liga, ultimo dia e sugestao",
         p ? JSON.stringify(p.mensagem) : "-");

      // o usuário pode mudar: respondeu 7 e é isso que vale
      t.limparPrompts();
      t.responderPrompt("7");
      return t.runAsync("exportarResultadosParaJSON()").then(function () {
        ok(t.run("diaAtual") === 7,
           "o usuario pode alterar o valor sugerido", "diaAtual: " + t.run("diaAtual"));
      });
    });
  });

  // ---- liga sem jogos publicados
  testeAsync(function () {
    var t = torneioEncerrado(9);
    t.definirFetch({ json: [{ liga: 4, dia: 2 }] });
    t.limparPrompts();
    t.responderPrompt("1");

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      var p = t.prompts()[0];
      ok(p && p.padrao === "1", "liga sem jogos vem com o campo preenchido com 1",
         p ? JSON.stringify(p.padrao) : "-");
      ok(p && /Nenhum dia publicado ainda/.test(p.mensagem),
         "a mensagem informa que nao ha dia publicado",
         p ? JSON.stringify(p.mensagem) : "-");
    });
  });

  // ---- falhas de consulta: nunca sugerir um numero
  testeAsync(function () {
    var cenarios = [
      ["fetch rejeitado (ex.: pagina aberta via file://)", new Error("Failed to fetch")],
      ["resposta HTTP nao ok", { ok: false, status: 404 }],
      ["JSON invalido", { jsonInvalido: true }],
      ["resposta que nao e array", { json: { jogos: [] } }]
    ];

    return cenarios.reduce(function (cadeia, c) {
      return cadeia.then(function () {
        var t = torneioEncerrado(4);
        t.definirFetch(c[1]);
        t.limparPrompts();
        t.responderPrompt("3");

        return t.runAsync("exportarResultadosParaJSON()").then(function () {
          var p = t.prompts()[0];
          ok(p && p.padrao === "",
             c[0] + ": o campo vem VAZIO", p ? JSON.stringify(p.padrao) : "-");
          ok(p && /Não foi possível consultar o histórico/.test(p.mensagem),
             c[0] + ": avisa que nao deu para consultar",
             p ? JSON.stringify(p.mensagem).slice(0, 80) : "-");
          ok(p && !/sugerido/.test(p.mensagem),
             c[0] + ": nao sugere numero nenhum");
        });
      });
    }, Promise.resolve());
  });
})();

// ============ 18. Bloco "Próximo passo" depois da exportação
grupo("18. Lembrete operacional após exportar");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  function pronto(liga) {
    var t = criar(["A", "B"], 1, liga || 4);
    t.gerarAuto();
    t.preencherPlacares(1, function () { return [2, 0]; });
    t.finalizar(1);
    t.definirFetch({ json: [{ liga: 4, dia: 1 }, { liga: 4, dia: 2 }] });
    t.responderPrompt("3");
    return t;
  }

  // ---- a regra pura dos comandos
  (function () {
    var t = pronto();
    var c = t.run('comandosDeImportacao("resultados_25-08-2026.json")');
    ok(c.validar === "node importar-resultados.js resultados_25-08-2026.json",
       "o comando de validacao sai completo", c.validar);
    ok(c.validar.indexOf("--apply") === -1,
       "o comando de validacao NAO contem --apply", c.validar);
    ok(c.publicar === c.validar + " --apply",
       "o comando de publicacao e o mesmo + --apply", c.publicar);
  })();

  // ---- o bloco só existe DEPOIS de uma exportação
  testeAsync(function () {
    var t = pronto();
    ok(!t.campoExiste("proximo-passo"),
       "o bloco nao existe antes de exportar");

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      ok(t.campoExiste("proximo-passo"),
         "o bloco aparece depois da exportacao");

      // o nome tem de ser EXATAMENTE o do link.download
      var baixado = t.downloads()[0];
      ok(!!baixado && /^resultados_\d{2}-\d{2}-\d{4}\.json$/.test(baixado),
         "o arquivo foi baixado com o nome esperado", String(baixado));
      ok(t.textoDoCampo("pp-arquivo") === baixado,
         "o bloco mostra o nome EXATO do arquivo baixado",
         t.textoDoCampo("pp-arquivo") + " vs " + baixado);

      var cmdV = t.textoDoCampo("pp-cmd-validar");
      var cmdP = t.textoDoCampo("pp-cmd-publicar");
      ok(cmdV.indexOf(baixado) !== -1 && cmdV.indexOf("--apply") === -1,
         "o comando de validacao usa o arquivo e nao tem --apply", cmdV);
      ok(cmdP.indexOf(baixado) !== -1 && cmdP.indexOf("--apply") !== -1,
         "o comando de publicacao usa o arquivo e tem --apply", cmdP);
    });
  });

  // ---- os botões copiam os comandos certos
  testeAsync(function () {
    var t = pronto();
    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      var baixado = t.downloads()[0];

      ok(t.clicar("pp-copiar-validar"), "o botao de validacao tem acao");
      ok(t.copiados()[0] === "node importar-resultados.js " + baixado,
         "o botao copia o comando de VALIDACAO", String(t.copiados()[0]));
      ok(t.copiados()[0].indexOf("--apply") === -1,
         "o comando copiado para validar nao tem --apply");

      ok(t.clicar("pp-copiar-publicar"), "o botao de publicacao tem acao");
      ok(t.copiados()[1] === "node importar-resultados.js " + baixado + " --apply",
         "o botao copia o comando para PUBLICAR", String(t.copiados()[1]));
    });
  });

  // ---- clipboard indisponível ou com falha não atrapalha a exportação
  testeAsync(function () {
    var t = pronto();
    t.removerClipboard();

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      ok(t.downloads().length === 1,
         "sem clipboard, a exportacao acontece normalmente");
      ok(t.campoExiste("proximo-passo"),
         "sem clipboard, o bloco continua aparecendo");
      ok(t.textoDoCampo("pp-cmd-validar").indexOf("node importar-resultados.js") === 0,
         "sem clipboard, os comandos seguem visiveis para copia manual",
         t.textoDoCampo("pp-cmd-validar"));
      ok(t.clicar("pp-copiar-validar"),
         "clicar no botao sem clipboard nao lanca excecao");
    });
  });

  // `navigator` inexistente: acessá-lo lança, e mesmo assim nada pode quebrar.
  testeAsync(function () {
    var t = pronto();
    t.removerNavigator();

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      ok(t.downloads().length === 1,
         "sem navigator, a exportacao acontece normalmente");
      ok(t.campoExiste("proximo-passo"),
         "sem navigator, o bloco continua aparecendo");
      ok(t.clicar("pp-copiar-validar"),
         "clicar sem navigator nao lanca excecao");
    });
  });

  testeAsync(function () {
    var t = pronto();
    t.quebrarClipboard();

    return t.runAsync("exportarResultadosParaJSON()").then(function () {
      ok(t.downloads().length === 1,
         "com clipboard falhando, a exportacao acontece normalmente");
      ok(t.clicar("pp-copiar-publicar"),
         "clicar com clipboard falhando nao lanca excecao");
      ok(t.copiados().length === 0,
         "nada foi copiado, mas o fluxo seguiu", JSON.stringify(t.copiados()));
    });
  });
})();

// ============ 19. Tela de seleção de jogadores
//
// carregarJogadores() é assíncrona (faz fetch), então a seção inteira roda na
// fila assíncrona — inclusive o grupo(), para o cabeçalho sair na ordem certa e
// para uma falha aqui não ser rotulada como da seção 18.
testeAsync(function () {
  grupo("19. Seleção de jogadores (lista, contador e inclusão)");

  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var ELENCO = ["Pablo", "Alex", "Caio", "Bruno Novaes", "Sérgio"];
  var t = integracao.criarSelecao(ELENCO);

  return t.pronto().then(function () {
    // ---- carga inicial
    ok(t.nomes().length === ELENCO.length,
       "a lista carrega todos os jogadores do cadastro", t.nomes().join(", "));

    var ordenado = ELENCO.slice().sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    ok(t.nomes().join("|") === ordenado.join("|"),
       "os jogadores vem em ordem alfabetica", t.nomes().join("|"));

    ok(t.contador() === 0, "o contador comeca em 0", String(t.contador()));

    // ---- marcar atualiza o contador
    t.marcar("Alex");
    t.marcar("Caio");
    t.marcar("Pablo");
    ok(t.contador() === 3, "marcar 3 jogadores leva o contador a 3", String(t.contador()));
    ok(t.selecionados().sort().join(",") === "Alex,Caio,Pablo",
       "os 3 marcados sao os esperados", t.selecionados().join(","));

    // ---- O BUG: acrescentar um jogador reconstruia a lista inteira
    t.adicionar("Nick");
    ok(t.nomes().indexOf("Nick") !== -1,
       "o jogador novo entra na lista", t.nomes().join(", "));
    ok(t.selecionados().sort().join(",") === "Alex,Caio,Pablo",
       "os jogadores ja marcados CONTINUAM marcados apos adicionar outro",
       t.selecionados().join(","));
    ok(t.contador() === 3,
       "o contador continua 3 depois da adicao", String(t.contador()));
    ok(t.campoNovoJogador() === "",
       "o campo de novo jogador e limpo", t.campoNovoJogador());

    // ---- os listeners dos jogadores antigos sobreviveram
    t.desmarcar("Caio");
    ok(t.contador() === 2,
       "desmarcar um jogador ANTIGO ainda atualiza o contador (listener vivo)",
       String(t.contador()));

    // ---- e o jogador novo tambem recebeu listener
    t.marcar("Nick");
    ok(t.contador() === 3,
       "marcar o jogador recem-adicionado atualiza o contador", String(t.contador()));

    // ---- nome repetido
    t.adicionar("Nick");
    ok(/est[áa] na lista/i.test(t.alertas().join(" ")),
       "adicionar um nome repetido alerta", t.alertas().join(" | "));
    ok(t.nomes().filter(function (n) { return n === "Nick"; }).length === 1,
       "e nao duplica a linha", t.nomes().join(", "));

    // ---- nome vazio
    var antes = t.nomes().length;
    t.adicionar("");
    ok(t.nomes().length === antes, "adicionar com o campo vazio nao cria linha");
    t.adicionar("   ");
    ok(t.nomes().length === antes, "so espacos em branco tambem nao cria linha");

    // ---- confirmacao e sua invalidacao
    t.abrirConfirmacao();
    ok(t.confirmacaoVisivel(), "o bloco de confirmacao aparece");
    ok(t.textoConfirmacao().indexOf("Nick") !== -1,
       "a confirmacao lista o jogador acrescentado");

    t.confirmar();
    ok(t.confirmado() === true, "confirmar marca os jogadores como confirmados");
    ok(t.iniciarHabilitado(), "o botao Iniciar Torneio fica habilitado");

    t.marcar("Sérgio");
    ok(t.confirmado() === false, "mudar a selecao invalida a confirmacao");
    ok(!t.iniciarHabilitado(), "e o botao Iniciar Torneio volta a ficar desabilitado");
    ok(!t.confirmacaoVisivel(), "o bloco de confirmacao some ao mudar a selecao");
    ok(t.contador() === 4, "e o contador acompanha a nova selecao", String(t.contador()));
  });
});

// ---------------------------------------------------------------- fim
function imprimirResumo() {
console.log("\n" + "=".repeat(60));
console.log("  " + passou + " passaram, " + falhou + " falharam");
if (falhas.length) {
  console.log("\n  Falhas:");
  falhas.forEach(function (f) { console.log("   - " + f); });
}
console.log("=".repeat(60) + "\n");
process.exit(falhou ? 1 : 0);
}

// Roda a fila assíncrona em sequência e só então imprime o resumo.
assincronos
  .reduce(function (cadeia, fn) { return cadeia.then(fn); }, Promise.resolve())
  .catch(function (e) {
    falhou++;
    falhas.push("teste assincrono lancou: " + (e && e.stack ? e.stack.split("\n")[0] : e));
  })
  .then(imprimirResumo);
