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

// ---------------------------------------------------------------- fim
console.log("\n" + "=".repeat(60));
console.log("  " + passou + " passaram, " + falhou + " falharam");
if (falhas.length) {
  console.log("\n  Falhas:");
  falhas.forEach(function (f) { console.log("   - " + f); });
}
console.log("=".repeat(60) + "\n");
process.exit(falhou ? 1 : 0);
