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
var sandboxAtual = null;   // para o stub registrar downloads

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
      _filhos: [],          // inputs/selects que este bloco contém
      _listeners: {},
      style: { cssText: "" },
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      appendChild: function (f) { this.children.push(f); f._parent = el; return f; },
      remove: function () { if (el.id) delete elementos[el.id]; el._removido = true; },
      // O <a> do download recebe .click(); guardamos o que seria baixado.
      click: function () { sandboxAtual && sandboxAtual.__downloads.push(el.download || ""); },
      // Listeners de verdade: é assim que o teste exercita o autosave pelo
      // mesmo caminho do navegador, em vez de chamar capturarRascunho() na mão.
      addEventListener: function (tipo, fn) {
        (el._listeners[tipo] || (el._listeners[tipo] = [])).push(fn);
      },
      // Propaga pela árvore, como o DOM faz. Sem isto um listener DELEGADO no
      // container nunca seria exercitado pelos testes — foi exatamente essa
      // lacuna que deixou uma falha de autosave passar para o Safari.
      dispararEvento: function (tipo) {
        var cadeia = [];
        for (var n = el; n; n = n._parent) cadeia.push(n);
        var evento = { type: tipo, target: el };

        // fase de captura: da raiz até o alvo
        cadeia.slice().reverse().forEach(function (n) {
          (n._listeners[tipo] || []).forEach(function (fn) { fn(evento); });
        });
      },
      querySelectorAll: function (sel) {
        var alvo = String(sel).split(",")[0].trim();
        return el._filhos.filter(function (f) {
          return alvo === "input, select" || f.tagName === alvo ||
                 (alvo === ".emp-wrap" && false);
        });
      },
      querySelector: function () { return null; }
    };

    // Registrar pelo id, como o DOM faz ao inserir o nó: sem isto
    // getElementById("rodada_1") não acha o bloco criado por createElement e
    // ligarAutosave não encontraria os campos.
    var _id = "";
    Object.defineProperty(el, "id", {
      get: function () { return _id; },
      set: function (v) { _id = String(v); if (_id) elementos[_id] = el; }
    });

    Object.defineProperty(el, "innerHTML", {
      get: function () { return el._html; },
      set: function (v) {
        el._html = String(v);
        // Registra os inputs que aparecem no HTML, para getElementById achá-los,
        // montando a mesma estrutura <tr><td><td class=placar><td> que o código
        // percorre via input.parentElement.parentElement.
        // Captura a tag inteira, para honrar também o atributo `value` — o
        // código de produção passou a renderizar os placares direto no HTML,
        // e ignorar isso aqui mascararia se o atributo funciona.
        var re = /<input[^>]*id="(r\d+_p(\d+)(_r)?)"[^>]*>/g, m;
        while ((m = re.exec(el._html))) {
          if (elementos[m[1]]) continue;
          var idx = Number(m[2]);
          var trId = m[1].replace(/_p\d+(_r)?$/, "") + "_tr" + Math.floor(idx / 2) + (m[3] || "");

          var tr = elementos[trId];
          if (!tr) {
            tr = novoEl("tr");
            tr.children = [novoEl("td"), novoEl("td"), novoEl("td")];
            elementos[trId] = tr;
          }

          var inp = novoEl("input");
          inp.id = m[1];
          var mv = /value="([^"]*)"/.exec(m[0]);
          inp.value = mv ? mv[1] : "";
          inp.parentElement = { parentElement: tr };   // <td class="placar-input"> -> <tr>
          inp._parent = el;                            // para a propagação de eventos
          elementos[m[1]] = inp;
          el._filhos.push(inp);
        }

        // Elementos do bloco "Próximo passo" (ids fixos, não numerados).
        var rp = /id="(pp-[a-z-]+)"/g, mp;
        while ((mp = rp.exec(el._html))) {
          if (elementos[mp[1]]) continue;
          var ep = novoEl(mp[1].indexOf("copiar") >= 0 ? "button" : "pre");
          ep.id = mp[1];
          ep._parent = el;
          // conteúdo textual do elemento, para os testes conferirem o comando
          var mt = new RegExp('id="' + mp[1] + '"[^>]*>([^<]*)<').exec(el._html);
          ep.textContent = mt ? mt[1] : "";
          elementos[mp[1]] = ep;
          el._filhos.push(ep);
        }

        // Campos de empate de game e os <select> das rodadas manuais.
        [/id="(r\d+_e\d+(_r)?)"/g].forEach(function (rx) {
          var mm;
          while ((mm = rx.exec(el._html))) {
            if (elementos[mm[1]]) continue;
            var e = novoEl("input");
            e.id = mm[1];
            e._parent = el;
            elementos[mm[1]] = e;
            el._filhos.push(e);
          }
        });
      }
    });
    return el;
  }

  var doc = {
    getElementById: function (id) {
      if (!elementos[id]) {
        // Só o container fixo da página é fabricado sob demanda. Todo o resto
        // devolve null como no navegador: fabricar um bloco de rodada
        // inexistente mascarava o autosave nunca encontrar os campos, e um
        // input de placar ausente é justamente como o código detecta a linha
        // do Bye.
        if (id !== "torneio-area") return null;
        var el = novoEl();
        el.id = id;
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
    // Registra o que foi perguntado, para os testes conferirem a mensagem e o
    // valor sugerido no campo.
    prompt: function (mensagem, valorPadrao) {
      sandbox.__prompts.push({ mensagem: mensagem, padrao: valorPadrao });
      return sandbox.__respostaPrompt !== undefined ? sandbox.__respostaPrompt : "1";
    },
    __prompts: [],
    __respostaPrompt: undefined,
    // fetch controlável: por padrão falha, como numa página aberta via file://
    fetch: function () { return Promise.reject(new Error("fetch indisponivel")); },
    // Área de transferência simulada: os testes leem o que foi copiado e podem
    // forçar falha ou ausência total da API.
    navigator: {
      clipboard: {
        writeText: function (t) {
          if (sandbox.__clipboardFalha) return Promise.reject(new Error("negado"));
          sandbox.__copiados.push(t);
          return Promise.resolve();
        }
      }
    },
    __copiados: [],
    __clipboardFalha: false,
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
    Promise: Promise,
    __alertas: [],
    // localStorage simulado, para exercitar o autosave/recuperação
    localStorage: (function () {
      var dados = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(dados, k) ? dados[k] : null; },
        setItem: function (k, v) { dados[k] = String(v); },
        removeItem: function (k) { delete dados[k]; },
        __dump: function () { return dados; }
      };
    })(),
    confirm: function () { return sandbox.__respostaConfirm; },
    __respostaConfirm: true,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };

  sandbox.MTR = require(path.join(RAIZ, "mtr.js"));
  sandbox.Pareamento = require(path.join(RAIZ, "pareamento.js"));

  sandbox.__downloads = [];
  sandboxAtual = sandbox;

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

// ---------------------------------------------------------------------------
// API de controle fino, para os testes dirigirem rodadas manuais, reabertura e
// exportação. Tudo roda contra o código real da página.
// ---------------------------------------------------------------------------
function criarTorneio(nomes, numRodadas, liga) {
  var ctx = carregarFerramenta(nomes, numRodadas, liga || 4);
  var sandbox = ctx.sandbox, vm = ctx.vm, elementos = ctx.dom.elementos;

  function run(codigo) { return vm.runInContext(codigo, sandbox); }

  return {
    sandbox: sandbox,
    elementos: elementos,
    run: run,

    // Executa código no sandbox e devolve a Promise resultante, para os testes
    // esperarem por funções assíncronas (como a exportação, que consulta o
    // histórico antes de perguntar o dia).
    runAsync: function (codigo) { return Promise.resolve(run(codigo)); },

    alertas: function () { return sandbox.__alertas.slice(); },
    limparAlertas: function () { sandbox.__alertas.length = 0; },

    downloads: function () { return sandbox.__downloads.slice(); },
    copiados: function () { return sandbox.__copiados.slice(); },
    quebrarClipboard: function () { sandbox.__clipboardFalha = true; },
    removerClipboard: function () { sandbox.navigator = {}; },
    // Remove `navigator` por completo: acessá-lo passa a lançar ReferenceError,
    // que é o caso em que o try/catch de copiarTexto() importa.
    removerNavigator: function () { delete sandbox.navigator; },
    textoDoCampo: function (id) {
      return elementos[id] ? elementos[id].textContent : null;
    },
    clicar: function (id) {
      var el = elementos[id];
      if (el && el.onclick) el.onclick();
      return !!(el && el.onclick);
    },
    prompts: function () { return sandbox.__prompts.slice(); },
    limparPrompts: function () { sandbox.__prompts.length = 0; },
    responderPrompt: function (v) { sandbox.__respostaPrompt = v; },

    // Substitui o fetch do sandbox. `resposta` pode ser:
    //   { ok, status, json }  -> vira uma Response simulada
    //   Error                 -> o fetch rejeita
    definirFetch: function (resposta) {
      sandbox.fetch = function () {
        if (resposta instanceof Error) return Promise.reject(resposta);
        return Promise.resolve({
          ok: resposta.ok !== false,
          status: resposta.status || 200,
          json: function () {
            if (resposta.jsonInvalido) {
              return Promise.reject(new SyntaxError("Unexpected token"));
            }
            return Promise.resolve(resposta.json);
          }
        });
      };
    },

    gerarAuto: function () { run("gerarRodada();"); },

    // fn(j1, j2, slot) -> [p1, p2] ou [p1, p2, empates]
    preencherPlacares: function (rodada, fn) {
      var confrontos = run("resultadosPorRodada[" + rodada + "] || []");
      confrontos.forEach(function (par, idx) {
        if (par[1].nome === "Bye") return;
        var slot = par.slot !== undefined ? par.slot : idx;
        var i1 = elementos["r" + rodada + "_p" + (slot * 2)];
        var i2 = elementos["r" + rodada + "_p" + (slot * 2 + 1)];
        if (!i1 || !i2) return;
        var v = fn(par[0].nome, par[1].nome, slot) || [2, 0];
        i1.value = String(v[0]);
        i2.value = String(v[1]);
        if (v.length > 2) {
          var ie = elementos["r" + rodada + "_e" + slot];
          if (ie) ie.value = String(v[2]);
        }
      });
    },

    // A tela de correção indexa os campos pelo `slot` do confronto, não pela
    // posição no array — com BYE no slot 0 os dois divergem.
    preencherPlacaresReabertos: function (rodada, fn) {
      var confrontos = run("resultadosPorRodada[" + rodada + "] || []");
      confrontos.forEach(function (par, i) {
        if (par[1].nome === "Bye") return;
        var slot = par.slot !== undefined ? par.slot : i;
        var i1 = elementos["r" + rodada + "_p" + (slot * 2) + "_r"];
        var i2 = elementos["r" + rodada + "_p" + (slot * 2 + 1) + "_r"];
        if (!i1 || !i2) return;
        var v = fn(par[0].nome, par[1].nome, slot) || [2, 0];
        i1.value = String(v[0]);
        i2.value = String(v[1]);
      });
    },

    finalizar: function (rodada) { run("finalizarRodada(" + rodada + ");"); },
    finalizarReaberta: function (rodada) { run("finalizarCorrecao(" + rodada + ");"); },
    finalizarCorrecao: function (rodada) { run("finalizarCorrecao(" + rodada + ");"); },
    reabrir: function (rodada) { run("corrigirPlacares(" + rodada + ");"); },

    // Chama a FUNÇÃO REAL de exportação usada pela interface.
    exportar: function (dia) {
      return run("montarJogosExportados(resultadosPorRodada, ligaAtual, " + dia + ")");
    },

    // Fotografia do estado, para comparar antes/depois de uma operação inválida.
    estado: function () {
      return run(
        "JSON.stringify({" +
        "  jogadores: jogadores.map(function(j){return {nome:j.nome,pontos:j.pontos,saldo:j.saldo,historico:j.historico};})," +
        "  confrontos: Array.from(confrontosAnteriores).sort()," +
        "  resultados: Object.keys(resultadosPorRodada).map(Number).sort()," +
        "  ultimaFinalizada: ultimaRodadaFinalizada" +
        "})"
      );
    },

    confrontos: function () { return run("Array.from(confrontosAnteriores)"); },
    estadoRodadas: function () { return run("estadoRodadas"); },
    rascunhos: function () { return run("rascunhos"); },

    // Escreve num campo e dispara o EVENTO REAL, percorrendo o mesmo caminho
    // que o navegador usaria para acionar o autosave.
    digitar: function (id, valor, tipoEvento) {
      var el = elementos[id];
      if (!el) throw new Error("campo inexistente: " + id);
      el.value = String(valor);
      el.dispararEvento(tipoEvento || "change");
      return el;
    },
    campoExiste: function (id) { return !!elementos[id]; },
    valorDoCampo: function (id) { return elementos[id] ? elementos[id].value : null; },

    // Quantos blocos visíveis existem para uma rodada (para checar duplicidade).
    blocosDaRodada: function (rodada) {
      return ["rodada_" + rodada, "rodada_" + rodada + "_manual", "rodada_" + rodada + "_reaberta"]
        .filter(function (id) { return !!elementos[id] && !elementos[id]._removido; });
    },

    // Faz o localStorage falhar, como um Safari em aba privativa.
    quebrarStorage: function () {
      sandbox.localStorage.setItem = function () { throw new Error("QuotaExceededError"); };
    },

    // Injeta um estado bruto no storage, para simular um torneio salvo por uma
    // versão anterior da ferramenta.
    injetarEstadoBruto: function (obj) {
      sandbox.localStorage.setItem(
        "ligaSupermarket:torneioEmAndamento", JSON.stringify(obj)
      );
    },
    lerStorageBruto: function () {
      return sandbox.localStorage.getItem("ligaSupermarket:torneioEmAndamento");
    },

    // Injeta um histórico pronto, para montar cenários de desempate exatos.
    definirHistorico: function (porJogador) {
      run("jogadores.forEach(function(j){ j.historico = " +
          JSON.stringify(porJogador) + "[j.nome] || []; });");
    },

    // Executa a ordenação REAL usada para parear (não o MTR.compararMTR isolado).
    ordenar: function () {
      return run("ordenarJogadoresSuico(jogadores.filter(function(j){return !MTR.ehBye(j.nome);}))" +
                 "  .map(function(s){ return s.nome; })");
    },

    // Executa a geração de rodada real e devolve quem ficou com o BYE.
    byeDaRodada: function () {
      run("gerarRodada();");
      var r = run("rodadaAtual");
      var pares = run("resultadosPorRodada[" + r + "].map(function(p){return [p[0].nome,p[1].nome];})");
      var bye = pares.filter(function (p) { return p[1] === "Bye"; })[0];
      return bye ? bye[0] : null;
    },

    // --- persistência
    estadoSalvo: function () { return run("lerEstadoSalvo()"); },
    apagarEstadoSalvo: function () { run("apagarEstadoSalvo();"); },

    // Simula recarregar a página: zera as variáveis e restaura do storage,
    // exatamente como retomarTorneioSalvo() faz no navegador.
    recarregarDoStorage: function () {
      run(
        "jogadores = []; resultadosPorRodada = {}; confrontosAnteriores = new Set();" +
        "rodadaAtual = 0; ultimaRodadaFinalizada = 0; ligaAtual = null; diaAtual = null;" +
        "estadoRodadas = {}; rascunhos = {};" +
        "var __e = lerEstadoSalvo(); if (__e) aplicarEstado(__e);"
      );
    },

    // Reload COMPLETO: apaga o DOM como o navegador faria e passa pelo
    // caminho real de retomada, com renderização. É o que expõe problemas de
    // botões/blocos que só aparecem no fluxo normal.
    recarregarComRender: function () {
      Object.keys(elementos).forEach(function (id) {
        if (id !== "torneio-area") delete elementos[id];
      });
      var area = elementos["torneio-area"];
      if (area) { area.innerHTML = ""; area.children.length = 0; area._filhos.length = 0; }

      run(
        "jogadores = []; resultadosPorRodada = {}; confrontosAnteriores = new Set();" +
        "rodadaAtual = 0; ultimaRodadaFinalizada = 0; ligaAtual = null; diaAtual = null;" +
        "estadoRodadas = {}; rascunhos = {};" +
        "var __e = lerEstadoSalvo(); if (__e) retomarTorneioSalvo(__e);"
      );
    },
    jogadores: function () { return run("jogadores"); },
    rodadaAtual: function () { return run("rodadaAtual"); },
    ranking: function () {
      return run("MTR.classificar(historicoParaJogos(jogadores))");
    }
  };
}

// ---------------------------------------------------------------------------
// Harness da TELA DE SELEÇÃO de jogadores.
//
// É deliberadamente separado do harness do torneio: aquele é afinado no detalhe
// para confrontos, slots e persistência, e não vale arriscá-lo para cobrir uma
// tela de formulário. Aqui basta um DOM pequeno com checkboxes de verdade.
//
// A seleção vive num <script> ANTERIOR ao do torneio, então carregarFerramenta()
// (que pega o último bloco) não a alcança.
// ---------------------------------------------------------------------------

function blocosDeScript() {
  var html = fs.readFileSync(path.join(RAIZ, "novo-torneio-V6.html"), "utf8");
  var blocos = [], re = /<script>([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(html))) blocos.push(m[1]);
  return blocos;
}

function coletarCheckboxes(el, saida) {
  (el.children || []).forEach(function (f) {
    if (f.type === "checkbox") saida.push(f);
    coletarCheckboxes(f, saida);
  });
  return saida;
}

function criarDOMSelecao() {
  var elementos = {};

  function novoEl(tag) {
    var el = {
      tagName: tag || "div",
      type: "",
      value: "",
      checked: false,
      disabled: false,
      textContent: "",
      innerText: "",
      dataset: {},
      children: [],
      _html: "",
      _listeners: {},
      style: { cssText: "" },
      classList: {
        add: function () {}, remove: function () {}, contains: function () { return false; }
      },
      appendChild: function (f) { el.children.push(f); f._parent = el; return f; },
      remove: function () { if (el.id) delete elementos[el.id]; el._removido = true; },
      addEventListener: function (t, fn) {
        (el._listeners[t] || (el._listeners[t] = [])).push(fn);
      },
      // Propaga pela árvore, como o navegador — é assim que o teste prova que o
      // listener do checkbox continua ligado depois de acrescentar um jogador.
      dispararEvento: function (t) {
        var ev = { type: t, target: el };
        for (var n = el; n; n = n._parent) {
          (n._listeners[t] || []).forEach(function (fn) { fn(ev); });
        }
      },
      querySelectorAll: function () { return []; },
      querySelector: function () { return null; }
    };

    var _id = "";
    Object.defineProperty(el, "id", {
      get: function () { return _id; },
      set: function (v) { _id = String(v); if (_id) elementos[_id] = el; }
    });

    Object.defineProperty(el, "innerHTML", {
      get: function () { return el._html; },
      set: function (v) {
        el._html = String(v);
        el.children = [];             // innerHTML= SUBSTITUI o conteúdo
        var re = /<input[^>]*>/g, m;
        while ((m = re.exec(el._html))) {
          if (!/type="checkbox"/.test(m[0])) continue;
          var cb = novoEl("input");
          cb.type = "checkbox";
          var mval = /value="([^"]*)"/.exec(m[0]);
          cb.value = mval ? mval[1] : "";
          var mid = /id="([^"]*)"/.exec(m[0]);
          if (mid) cb.id = mid[1];
          cb._parent = el;
          el.children.push(cb);
        }
      }
    });

    return el;
  }

  // Elementos fixos da página
  ["lista-jogadores", "qtd-selecionados", "aviso-impar", "confirmacao-jogadores",
   "lista-confirmacao", "novo-jogador", "btn-iniciar", "btn-incluir-jogadores"]
    .forEach(function (id) { novoEl("div").id = id; });

  var doc = {
    getElementById: function (id) { return elementos[id] || null; },
    createElement: function (tag) { return novoEl(tag); },
    querySelector: function () { return null; },
    // Só os dois seletores que a tela realmente usa.
    querySelectorAll: function (sel) {
      var s = String(sel);
      if (s.indexOf("#lista-jogadores") !== 0) return [];
      var lista = elementos["lista-jogadores"];
      if (!lista) return [];
      var todos = coletarCheckboxes(lista, []);
      return /:checked/.test(s)
        ? todos.filter(function (c) { return c.checked; })
        : todos;
    },
    body: { classList: { add: function () {}, remove: function () {} } },
    addEventListener: function () {},
    documentElement: { outerHTML: "" }
  };

  return { doc: doc, elementos: elementos };
}

function criarSelecao(lista) {
  var blocos = blocosDeScript();
  var codigoTorneio = blocos[blocos.length - 1];
  var codigoSelecao = blocos.filter(function (b) {
    return /function carregarJogadores/.test(b);
  })[0];
  if (!codigoSelecao) throw new Error("bloco da selecao de jogadores nao encontrado");

  var dom = criarDOMSelecao();
  var elementos = dom.elementos;

  var sandbox = {
    document: dom.doc,
    alert: function (msg) { sandbox.__alertas.push(msg); },
    __alertas: [],
    fetch: function () {
      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve(lista.slice()); }
      });
    },
    console: { log: console.log, error: console.error, warn: function () {} },
    Math: Math, Number: Number, String: String, Array: Array, Object: Object,
    isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    Date: Date, Set: Set, JSON: JSON, Promise: Promise,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    confirm: function () { return true; },
    localStorage: {
      getItem: function () { return null; },
      setItem: function () {},
      removeItem: function () {}
    }
  };

  sandbox.MTR = require(path.join(RAIZ, "mtr.js"));
  sandbox.Pareamento = require(path.join(RAIZ, "pareamento.js"));

  var vm = require("vm");
  vm.createContext(sandbox);

  // Ordem inversa à do arquivo, de propósito: no navegador o bloco da seleção é
  // avaliado primeiro, mas só chama carregarJogadores() de forma ASSÍNCRONA —
  // quando o `await fetch` resolve, o bloco do torneio já foi avaliado e os
  // helpers de apresentação dele (avatar) já existem. Avaliar o torneio antes
  // aqui reproduz esse estado sem depender da ordem das microtasks.
  vm.runInContext(codigoTorneio, sandbox);
  vm.runInContext(codigoSelecao, sandbox);

  function run(codigo) { return vm.runInContext(codigo, sandbox); }

  function checkboxes() {
    return coletarCheckboxes(elementos["lista-jogadores"], []);
  }
  function acharCheckbox(nome) {
    var cb = checkboxes().filter(function (c) { return c.value === nome; })[0];
    if (!cb) throw new Error("checkbox inexistente: " + nome);
    return cb;
  }

  return {
    run: run,
    // Um macrotask drena todas as microtasks do await de carregarJogadores().
    pronto: function () { return new Promise(function (r) { setTimeout(r, 0); }); },

    nomes: function () { return checkboxes().map(function (c) { return c.value; }); },
    selecionados: function () {
      return checkboxes().filter(function (c) { return c.checked; })
        .map(function (c) { return c.value; });
    },
    contador: function () {
      var el = elementos["qtd-selecionados"];
      return el ? Number(el.textContent) : null;
    },

    // Marca/desmarca disparando o EVENTO REAL, como um clique faria.
    marcar: function (nome) {
      var cb = acharCheckbox(nome);
      cb.checked = true;
      cb.dispararEvento("change");
    },
    desmarcar: function (nome) {
      var cb = acharCheckbox(nome);
      cb.checked = false;
      cb.dispararEvento("change");
    },

    adicionar: function (nome) {
      elementos["novo-jogador"].value = nome;
      run("adicionarJogador();");
    },

    abrirConfirmacao: function () { run("abrirConfirmacaoJogadores();"); },
    confirmar: function () { run("confirmarJogadores();"); },
    confirmado: function () { return run("jogadoresConfirmados"); },
    confirmacaoVisivel: function () {
      return elementos["confirmacao-jogadores"].style.display !== "none";
    },
    textoConfirmacao: function () { return elementos["lista-confirmacao"].innerHTML; },
    iniciarHabilitado: function () { return !elementos["btn-iniciar"].disabled; },

    campoNovoJogador: function () { return elementos["novo-jogador"].value; },
    alertas: function () { return sandbox.__alertas.slice(); },
    elementos: elementos
  };
}

module.exports = {
  validar: validar,
  criarTorneio: criarTorneio,
  criarSelecao: criarSelecao
};

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
