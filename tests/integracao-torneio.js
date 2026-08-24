// tests/integracao-torneio.js
//
// Roda a ferramenta novo-torneio-V6.html DE VERDADE, ponta a ponta, num DOM
// simulado: extrai o <script> principal da página, gera as rodadas, preenche
// os placares e exporta o JSON — exatamente o caminho de um dia de competição.
//
// É o teste que responde "posso usar isso num dia oficial?".
// Chamado por tests/run.js; também roda sozinho com:  node tests/integracao-torneio.js

var fs = require("fs");
var path = require("path");
var RAIZ = path.join(__dirname, "..");

// --------------------------------------------------------------- DOM falso
function criarDOM() {
  var elementos = {};

  function novoEl(tag) {
    var el = {
      tagName: tag || "div",
      id: "",
      value: "",
      textContent: "",
      _html: "",
      children: [],
      style: {},
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      appendChild: function (f) { this.children.push(f); return f; },
      remove: function () {},
      addEventListener: function () {},
      querySelectorAll: function () { return []; },
      querySelector: function () { return null; }
    };
    Object.defineProperty(el, "innerHTML", {
      get: function () { return el._html; },
      set: function (v) {
        el._html = String(v);
        // Registra os inputs que aparecem no HTML, para getElementById achá-los,
        // montando a mesma estrutura <tr><td><td class=placar><td> que o código
        // percorre via input.parentElement.parentElement.
        var re = /id="(r\d+_p(\d+))"/g, m;
        while ((m = re.exec(el._html))) {
          if (elementos[m[1]]) continue;
          var idx = Number(m[2]);
          var trId = m[1].replace(/_p\d+$/, "") + "_tr" + Math.floor(idx / 2);

          var tr = elementos[trId];
          if (!tr) {
            tr = novoEl("tr");
            tr.children = [novoEl("td"), novoEl("td"), novoEl("td")];
            elementos[trId] = tr;
          }

          var inp = novoEl("input");
          inp.id = m[1];
          inp.parentElement = { parentElement: tr };   // <td class="placar-input"> -> <tr>
          elementos[m[1]] = inp;
        }
      }
    });
    return el;
  }

  var doc = {
    getElementById: function (id) {
      if (!elementos[id]) {
        // Inputs de placar que não existem devem devolver null, como no
        // navegador — é assim que o código pula a linha do Bye, que não
        // tem campos de placar. Fabricar um elemento aqui mascararia isso.
        if (/^r\d+_(p\d+|j[12]_\d+)$/.test(id)) return null;
        var el = novoEl();
        el.id = id;
        elementos[id] = el;
      }
      return elementos[id];
    },
    createElement: function (tag) { return novoEl(tag); },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    body: { classList: { add: function () {}, remove: function () {} } },
    addEventListener: function () {},
    documentElement: { outerHTML: "" }
  };

  return { doc: doc, elementos: elementos };
}

// ------------------------------------------------- carrega o codigo da pagina
function carregarFerramenta(nomes, numRodadas, liga) {
  var html = fs.readFileSync(path.join(RAIZ, "novo-torneio-V6.html"), "utf8");

  // O bloco relevante e o ultimo <script> sem src (logica do torneio).
  var blocos = [];
  var re = /<script>([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(html))) blocos.push(m[1]);
  var codigo = blocos[blocos.length - 1];

  var dom = criarDOM();
  var sandbox = {
    document: dom.doc,
    alert: function (msg) { sandbox.__alertas.push(msg); },
    prompt: function () { return "1"; },
    // warn silenciado: o aviso de "repetição inevitável" é comportamento
    // esperado em cenários curtos (ex.: 5 jogadores em 4 rodadas) e poluiria
    // a saída da suíte. A seção 2 já prova, por busca exaustiva, que nenhuma
    // repetição EVITÁVEL acontece.
    console: { log: console.log, error: console.error, warn: function () {} },
    Blob: function () {},
    URL: { createObjectURL: function () { return ""; } },
    Math: Math,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    isNaN: isNaN,
    parseInt: parseInt,
    parseFloat: parseFloat,
    Date: Date,
    Set: Set,
    JSON: JSON,
    __alertas: []
  };

  sandbox.MTR = require(path.join(RAIZ, "mtr.js"));
  sandbox.Pareamento = require(path.join(RAIZ, "pareamento.js"));

  var vm = require("vm");
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox);

  // Estado inicial equivalente ao que iniciarTorneio() monta
  vm.runInContext(
    "ligaAtual = " + liga + ";" +
    "totalRodadas = " + numRodadas + ";" +
    "rodadaAtual = 0;" +
    "resultadosPorRodada = {};" +
    "confrontosAnteriores = new Set();" +
    "jogadores = " + JSON.stringify(nomes) +
    "  .map(function(n){ return { nome:n, pontos:0, saldo:0, historico:[] }; });",
    sandbox
  );

  return { sandbox: sandbox, dom: dom, vm: vm };
}

// -------------------------------------------------------- roda um torneio
function rodarTorneio(nomes, numRodadas, seed) {
  var ctx = carregarFerramenta(nomes, numRodadas, 4);
  var sandbox = ctx.sandbox, vm = ctx.vm, elementos = ctx.dom.elementos;

  var s = seed >>> 0;
  function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }

  for (var r = 1; r <= numRodadas; r++) {
    vm.runInContext("gerarRodada();", sandbox);

    var confrontos = vm.runInContext("resultadosPorRodada[" + r + "]", sandbox);

    // Preenche os placares nos inputs, como o organizador faria na tela.
    confrontos.forEach(function (par) {
      if (par[1].nome === "Bye") return;
      var slot = par.slot;
      var i1 = elementos["r" + r + "_p" + (slot * 2)];
      var i2 = elementos["r" + r + "_p" + (slot * 2 + 1)];
      if (!i1 || !i2) throw new Error("inputs nao encontrados para o slot " + slot + " da rodada " + r);
      var x = rnd();
      if (x < 0.45) { i1.value = "2"; i2.value = "0"; }
      else if (x < 0.9) { i1.value = "1"; i2.value = "2"; }
      else { i1.value = "1"; i2.value = "1"; }
    });

    vm.runInContext("finalizarRodada(" + r + ");", sandbox);
  }

  return { sandbox: sandbox, vm: vm };
}

// ------------------------------------------------------------- validacoes
function validar(nomes, numRodadas, seed) {
  var res = rodarTorneio(nomes, numRodadas, seed);
  var vm = res.vm, sandbox = res.sandbox;

  var problemas = [];

  var alertas = sandbox.__alertas;
  if (alertas.length) problemas.push("alertas inesperados: " + alertas.join(" / "));

  var jogadores = vm.runInContext("jogadores", sandbox);
  var todasRodadas = vm.runInContext("resultadosPorRodada", sandbox);

  // 1) cada jogador joga uma vez por rodada
  Object.keys(todasRodadas).forEach(function (r) {
    var vistos = {};
    todasRodadas[r].forEach(function (par) {
      [par[0].nome, par[1].nome].forEach(function (n) {
        if (n === "Bye") return;
        if (vistos[n]) problemas.push("rodada " + r + ": " + n + " aparece 2x");
        vistos[n] = true;
      });
    });
    if (Object.keys(vistos).length !== nomes.length) {
      problemas.push("rodada " + r + ": " + Object.keys(vistos).length + " jogadores de " + nomes.length);
    }
  });

  // 2) no maximo um bye por jogador
  var byes = {};
  jogadores.forEach(function (j) {
    var n = (j.historico || []).filter(function (h) { return h.contra === "Bye"; }).length;
    if (n > 1) problemas.push(j.nome + " recebeu " + n + " byes");
    if (n) byes[j.nome] = n;
  });

  // 3) o historico tem exatamente uma entrada por rodada para cada jogador
  jogadores.forEach(function (j) {
    if (j.historico.length !== numRodadas) {
      problemas.push(j.nome + " tem " + j.historico.length + " partidas, esperado " + numRodadas);
    }
    var porRodada = {};
    j.historico.forEach(function (h) {
      if (porRodada[h.rodada]) problemas.push(j.nome + " tem 2 entradas na rodada " + h.rodada);
      porRodada[h.rodada] = true;
    });
  });

  // 4) os dois lados de cada partida registram o placar espelhado
  jogadores.forEach(function (j) {
    j.historico.forEach(function (h) {
      if (h.contra === "Bye") return;
      var adv = jogadores.filter(function (x) { return x.nome === h.contra; })[0];
      var espelho = adv.historico.filter(function (x) {
        return x.contra === j.nome && Number(x.rodada) === Number(h.rodada);
      })[0];
      if (!espelho) { problemas.push("sem espelho: " + j.nome + " x " + h.contra + " r" + h.rodada); return; }
      var a = sandbox.MTR.parsePlacar(h.placar), b = sandbox.MTR.parsePlacar(espelho.placar);
      if (!a || !b || a[0] !== b[1] || a[1] !== b[0]) {
        problemas.push("placar inconsistente: " + j.nome + " " + h.placar + " vs " + h.contra + " " + espelho.placar);
      }
    });
  });

  // 5) exportacao: formato do jogos.json, com as linhas de Bye
  var exportados = [];
  Object.keys(todasRodadas).forEach(function (r) {
    todasRodadas[r].forEach(function (par) {
      var j1 = par[0], j2 = par[1];
      if (j2.nome === "Bye") {
        exportados.push({ rodada: Number(r), jogador1: j1.nome, resultado: "2 x 0", jogador2: "Bye" });
        return;
      }
      var e = j1.historico.filter(function (h) {
        return h.contra === j2.nome && Number(h.rodada) === Number(r);
      })[0];
      if (!e) { problemas.push("export sem placar: " + j1.nome + " x " + j2.nome); return; }
      var p = sandbox.MTR.parsePlacar(e.placar);
      exportados.push({ rodada: Number(r), jogador1: j1.nome, resultado: p[0] + " x " + p[1], jogador2: j2.nome });
    });
  });

  var esperadoLinhas = Object.keys(todasRodadas).reduce(function (t, r) {
    return t + todasRodadas[r].length;
  }, 0);
  if (exportados.length !== esperadoLinhas) {
    problemas.push("export tem " + exportados.length + " linhas, esperado " + esperadoLinhas);
  }
  exportados.forEach(function (o) {
    if (!/^\d+ x \d+$/.test(o.resultado)) problemas.push("resultado fora do formato: " + o.resultado);
  });

  var temBye = exportados.some(function (o) { return o.jogador2 === "Bye"; });

  return {
    problemas: problemas,
    exportados: exportados,
    byes: byes,
    temBye: temBye,
    precisavaBye: nomes.length % 2 !== 0
  };
}

module.exports = { validar: validar };

// Execução direta
if (require.main === module) {
  var cenarios = [
    { nomes: ["Pablo", "Magno", "Nagib", "Joca", "Stenio", "Marcelo"], rodadas: 4 },
    { nomes: ["A", "B", "C", "D", "E", "F", "G"], rodadas: 4 },
    { nomes: ["A", "B", "C", "D", "E", "F", "G", "H"], rodadas: 5 }
  ];
  var falhou = false;
  cenarios.forEach(function (c) {
    var r = validar(c.nomes, c.rodadas, 12345);
    var status = r.problemas.length ? "FALHOU" : "OK";
    console.log(status + " — " + c.nomes.length + " jogadores, " + c.rodadas + " rodadas, " +
                r.exportados.length + " jogos exportados" + (r.temBye ? " (com Bye)" : ""));
    r.problemas.forEach(function (p) { console.log("    - " + p); });
    if (r.problemas.length) falhou = true;
  });
  process.exit(falhou ? 1 : 0);
}
