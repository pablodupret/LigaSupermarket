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
grupo("7. Fluxo manual, reabertura e exportação");

(function () {
  var integracao = require(path.join(__dirname, "integracao-torneio.js"));
  var criar = integracao.criarTorneio;

  // -- manual completa
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], ["C", "D"]]);
    t.preencherPlacaresPorSlot(1, { 0: [2, 0], 1: [1, 2] });
    t.finalizar(1);
    ok(t.alertas().length === 0, "rodada manual completa finaliza sem alerta",
       t.alertas().join(" | "));
    var exp = t.exportar(1);
    ok(exp.length === 2, "manual completa exporta os 2 jogos", "exportou " + exp.length);
  })();

  // -- linha vazia: a tabela manual desenha exatamente ceil(n/2) linhas, entao
  //    deixar uma vazia significa necessariamente alguem de fora -> bloqueado.
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], null]);
    var antes = t.estado();
    t.finalizar(1);
    ok(/C, D|C,D/.test(t.alertas().join(" ")),
       "linha vazia deixando jogadores de fora e bloqueada",
       t.alertas().join(" | "));
    ok(t.estado() === antes, "linha vazia nao altera estado");
  })();

  // -- BYE na PRIMEIRA linha: caso real em que o slot desloca os placares.
  //    Sem o `slot`, A x B leria os campos da linha do BYE (que nao existem)
  //    e C x D receberia o placar de A x B.
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["E", "Bye"], ["A", "B"], ["C", "D"]]);
    t.preencherPlacaresPorSlot(1, { 1: [2, 0], 2: [1, 2] });
    t.finalizar(1);

    ok(t.alertas().length === 0, "BYE na primeira linha finaliza sem alerta",
       t.alertas().join(" | "));

    var exp = t.exportar(1);
    var ab = exp.filter(function (o) { return o.jogador1 === "A"; })[0];
    var cd = exp.filter(function (o) { return o.jogador1 === "C"; })[0];
    ok(ab && ab.resultado === "2 x 0", "A x B recebe o proprio placar",
       ab ? ab.resultado : "ausente");
    ok(cd && cd.resultado === "1 x 2", "C x D recebe o proprio placar",
       cd ? cd.resultado : "ausente");
    ok(exp.some(function (o) { return o.jogador1 === "E" && o.jogador2 === "Bye"; }),
       "o BYE da primeira linha vai para a exportacao");
  })();

  // -- manual incompleta: bloqueia e nomeia quem ficou de fora
  (function () {
    var t = criar(["A", "B", "C", "D", "E", "F", "G", "H"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], ["C", "D"]]);  // E, F, G e H esquecidos
    var antes = t.estado();
    t.finalizar(1);
    var msg = t.alertas().join(" ");
    ok(t.alertas().length > 0, "rodada incompleta e bloqueada");
    ok(/E/.test(msg) && /F/.test(msg) && /G/.test(msg) && /H/.test(msg),
       "a mensagem nomeia os jogadores sem jogo", msg.slice(0, 160));
    ok(t.estado() === antes, "rodada incompleta nao altera nenhum estado");
  })();

  // -- jogador duplicado e jogador contra si mesmo
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], ["A", "C"]]);
    var antes = t.estado();
    t.finalizar(1);
    ok(/aparece em 2 jogos/.test(t.alertas().join(" ")), "jogador duplicado e bloqueado",
       t.alertas().join(" | "));
    ok(t.estado() === antes, "duplicado nao altera estado");

    var t2 = criar(["A", "B", "C", "D"], 2, 4);
    t2.gerarManual();
    t2.preencherManual(1, [["A", "A"], ["C", "D"]]);
    t2.finalizar(1);
    ok(/ele mesmo/.test(t2.alertas().join(" ")), "jogador contra si mesmo e bloqueado",
       t2.alertas().join(" | "));
  })();

  // -- manual -> automatica: o confronto manual nao pode se repetir
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], ["C", "D"]]);
    t.preencherPlacaresPorSlot(1, { 0: [2, 0], 1: [2, 0] });
    t.finalizar(1);

    var confrontos = t.confrontos();
    ok(confrontos.indexOf("A|B") >= 0 && confrontos.indexOf("C|D") >= 0,
       "rodada manual registra os confrontos em confrontosAnteriores",
       confrontos.join(", "));

    t.gerarAuto();
    var r2 = t.run("resultadosPorRodada[2].map(function(p){return [p[0].nome,p[1].nome];})");
    var repetiu = r2.some(function (p) {
      var k = p.slice().sort().join("|");
      return k === "A|B" || k === "C|D";
    });
    ok(!repetiu, "a automatica seguinte nao repete o confronto da manual",
       JSON.stringify(r2));
  })();

  // -- BYE manual e BYE repetido
  (function () {
    var t = criar(["A", "B", "C"], 3, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], ["C", "Bye"]]);
    t.preencherPlacaresPorSlot(1, { 0: [2, 0] });
    t.finalizar(1);
    ok(t.alertas().length === 0, "BYE manual funciona", t.alertas().join(" | "));

    var exp = t.exportar(1);
    ok(exp.some(function (o) { return o.jogador2 === "Bye" && o.jogador1 === "C"; }),
       "BYE manual aparece na exportacao", JSON.stringify(exp));

    // segundo BYE para o mesmo jogador, havendo outros elegiveis
    t.gerarManual();
    t.preencherManual(2, [["A", "B"], ["C", "Bye"]]);
    var antes = t.estado();
    t.limparAlertas();
    t.finalizar(2);
    ok(/já recebeu Bye|ja recebeu Bye/.test(t.alertas().join(" ")),
       "segundo BYE para o mesmo jogador e bloqueado", t.alertas().join(" | "));
    ok(t.estado() === antes, "BYE repetido nao altera estado");

    // corrigindo, finaliza e NAO duplica o BYE do C
    t.limparAlertas();
    t.preencherManual(2, [["A", "C"], ["B", "Bye"]]);
    t.preencherPlacaresPorSlot(2, { 0: [2, 1] });
    t.finalizar(2);
    ok(t.alertas().length === 0, "apos corrigir, a rodada finaliza",
       t.alertas().join(" | "));

    var jogs = t.jogadores();
    var byesC = jogs.filter(function (j) { return j.nome === "C"; })[0]
      .historico.filter(function (h) { return h.contra === "Bye"; }).length;
    ok(byesC === 1, "corrigir e refinalizar nao duplica o BYE", "byes de C: " + byesC);
  })();

  // -- erro DEPOIS de uma linha de BYE nao pode deixar estado parcial
  (function () {
    var t = criar(["A", "B", "C"], 2, 4);
    t.gerarManual();
    // linha 0 valida com BYE, linha 1 invalida (jogador contra si mesmo)
    t.preencherManual(1, [["C", "Bye"], ["A", "A"]]);
    var antes = t.estado();
    t.finalizar(1);
    ok(t.alertas().length > 0, "erro na linha seguinte bloqueia a rodada");
    ok(t.estado() === antes,
       "BYE da linha anterior NAO foi aplicado (atomicidade)",
       "estado mudou");
  })();

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
    t.gerarManual();
    t.preencherManual(1, [["A", "B"]]);
    t.preencherPlacaresPorSlot(1, { 0: [2, 0, 1] });   // 2-0-1
    t.finalizar(1);
    ok(t.alertas().length === 0, "match 2-0-1 finaliza sem alerta", t.alertas().join(" | "));

    var exp = t.exportar(3);
    ok(exp.length === 1 && exp[0].gamesEmpatados === 1,
       "gamesEmpatados sai no JSON exportado", JSON.stringify(exp));
    ok(exp[0].resultado === "2 x 0",
       "o campo resultado continua no formato \"N x N\"", exp[0].resultado);

    var rk = t.ranking();
    var a = rk.filter(function (l) { return l.jogador === "A"; })[0];
    ok(Math.abs(a.gameWinPerc - 7 / 9) < 0.005,
       "GW% do 2-0-1 chega correto no ranking da ferramenta (7/9)",
       "obtido: " + a.gameWinPerc.toFixed(3));
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
  (function () {
    var t = criar(["A", "B", "C", "D", "E"], 3, 4);
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
    t.gerarManual();
    t.preencherManual(1, [["E", "Bye"], ["A", "B"], ["C", "D"]]);
    t.preencherPlacaresPorSlot(1, { 1: [2, 0] });   // slot 2 (C x D) fica vazio

    var antes = t.estado();
    t.finalizar(1);

    ok(/Falta o placar/.test(t.alertas().join(" ")),
       "placar faltando bloqueia a finalizacao", t.alertas().join(" | "));
    ok(t.estado() === antes,
       "BYE, pontos, historico e confrontos NAO foram aplicados (transacao)");
    ok(Object.keys(t.run("resultadosPorRodada")).length === 0,
       "resultadosPorRodada segue vazio apos a tentativa invalida");

    // Agora completa e finaliza: tudo aplicado UMA vez
    t.limparAlertas();
    t.preencherPlacaresPorSlot(1, { 1: [2, 0], 2: [1, 2] });
    t.finalizar(1);
    ok(t.alertas().length === 0, "apos completar, finaliza sem alerta",
       t.alertas().join(" | "));

    var jogs = t.jogadores();
    var e = jogs.filter(function (j) { return j.nome === "E"; })[0];
    ok(e.historico.length === 1 && e.pontos === 3,
       "o BYE foi aplicado exatamente uma vez",
       "historico=" + e.historico.length + " pontos=" + e.pontos);
    var a = jogs.filter(function (j) { return j.nome === "A"; })[0];
    ok(a.historico.length === 1 && a.pontos === 3,
       "o vencedor recebeu os pontos uma unica vez",
       "historico=" + a.historico.length + " pontos=" + a.pontos);
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

  // -- rodada manual em preenchimento sobrevive ao reload
  (function () {
    var t = criar(["A", "B", "C", "D"], 2, 4);
    t.gerarManual();
    t.preencherManual(1, [["A", "B"], null]);   // so um par escolhido
    t.run("capturarRascunho(1);");

    ok(t.estadoRodadas()[1] === "manual",
       "rodada manual gerada fica marcada como 'manual'",
       JSON.stringify(t.estadoRodadas()));

    t.recarregarDoStorage();
    var r = t.rascunhos()[1];
    ok(r && r.pares && r.pares["0"] && r.pares["0"][0] === "A" && r.pares["0"][1] === "B",
       "os pares ja escolhidos na manual foram restaurados", JSON.stringify(r));
    ok(t.run("rodadaAtualEstaFinalizada()") === false,
       "manual em preenchimento nao libera a proxima rodada");
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

// ---------------------------------------------------------------- fim
console.log("\n" + "=".repeat(60));
console.log("  " + passou + " passaram, " + falhou + " falharam");
if (falhas.length) {
  console.log("\n  Falhas:");
  falhas.forEach(function (f) { console.log("   - " + f); });
}
console.log("=".repeat(60) + "\n");
process.exit(falhou ? 1 : 0);
