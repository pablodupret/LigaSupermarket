// pareamento.js — Motor de pareamento suíço
//
// Substitui o algoritmo guloso original, que repetia confrontos em silêncio
// quando travava (48% dos torneios de 6 jogadores em 4 rodadas).
//
// Regras:
//   - Pareia dentro de faixas de match points iguais; quem sobra desce
//     para a faixa seguinte (o "downfloat" do suíço oficial)
//   - Backtracking: só repete um confronto quando é matematicamente
//     inevitável, e nesse caso AVISA em vez de silenciar
//   - Bye vai para o pior colocado que ainda não recebeu bye no torneio
//     (o MTR permite um bye por jogador por torneio)

(function (raiz) {
  "use strict";

  function chave(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  // Embaralhamento Fisher-Yates (uniforme, ao contrário de sort(() => random-0.5)).
  function embaralhar(lista, rnd) {
    var r = rnd || Math.random;
    for (var i = lista.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = lista[i]; lista[i] = lista[j]; lista[j] = t;
    }
    return lista;
  }

  // Escolhe quem recebe o bye: pior colocado que ainda não teve bye.
  // `ordenados` vem do melhor para o pior.
  function escolherBye(ordenados, jaTeveBye) {
    for (var i = ordenados.length - 1; i >= 0; i--) {
      if (!jaTeveBye(ordenados[i])) return ordenados[i];
    }
    // Todos já tiveram bye: cai no pior colocado (só acontece se rodadas > jogadores).
    return ordenados[ordenados.length - 1];
  }

  // Teto de esforço: impede que a tela trave num caso patológico.
  // Nunca chega perto disso num dia de liga (testado até 24 jogadores).
  var MAX_PASSOS = 300000;

  // Backtracking sobre a lista já ordenada. Sempre pareia o primeiro jogador
  // restante com o adversário mais próximo dele na classificação que ainda não
  // enfrentou — é isso que mantém o pareamento dentro da faixa de pontuação.
  //
  // Como o primeiro elemento é sempre o próximo a parear, o estado da busca é
  // definido só pelo CONJUNTO restante: memorizamos os conjuntos já provados
  // impossíveis, o que corta a explosão combinatória.
  //
  // Devolve a lista de pares, ou null se não existir solução sem repetição.
  function resolverSemRepetir(lista, jaJogaram) {
    var impossiveis = Object.create(null);
    var passos = { n: 0 };

    function busca(restante) {
      if (restante.length === 0) return [];
      if (restante.length % 2 !== 0) return null;
      if (passos.n++ > MAX_PASSOS) return null;

      var estado = restante.join("");
      if (impossiveis[estado]) return null;

      var a = restante[0];
      var resto = restante.slice(1);

      for (var i = 0; i < resto.length; i++) {
        if (jaJogaram(a, resto[i])) continue;
        var solucao = busca(resto.slice(0, i).concat(resto.slice(i + 1)));
        if (solucao) return [[a, resto[i]]].concat(solucao);
      }

      impossiveis[estado] = true;
      return null;
    }

    return busca(lista.slice());
  }

  // Fallback usado só quando não existe pareamento sem repetição:
  // minimiza o número de confrontos repetidos.
  function resolverComMenosRepeticoes(lista, jaJogaram) {
    var melhor = null;
    var passos = 0;

    function busca(restante, atual, repeticoes) {
      if (melhor && repeticoes >= melhor.repeticoes) return; // poda
      if (passos++ > MAX_PASSOS) return;
      if (restante.length === 0) {
        melhor = { pares: atual.slice(), repeticoes: repeticoes };
        return;
      }
      var a = restante[0];
      var resto = restante.slice(1);
      for (var i = 0; i < resto.length; i++) {
        var custo = jaJogaram(a, resto[i]) ? 1 : 0;
        atual.push([a, resto[i]]);
        busca(resto.slice(0, i).concat(resto.slice(i + 1)), atual, repeticoes + custo);
        atual.pop();
      }
    }

    busca(lista.slice(), [], 0);

    // Se nem o fallback fechou (teto de esforço), pareia em sequência.
    if (!melhor) {
      var pares = [];
      for (var k = 0; k + 1 < lista.length; k += 2) pares.push([lista[k], lista[k + 1]]);
      melhor = { pares: pares, repeticoes: 0 };
    }
    return melhor;
  }

  /**
   * Gera os confrontos de uma rodada.
   *
   * @param {Array}    ordenados  nomes do melhor para o pior colocado
   * @param {Function} jaJogaram  (a, b) => bool
   * @param {Function} jaTeveBye  (nome) => bool
   * @returns {{pares: Array, bye: (string|null), repeticoesForcadas: Array}}
   */
  function gerarRodada(ordenados, jaJogaram, jaTeveBye) {
    var lista = (ordenados || []).slice();
    var bye = null;

    if (lista.length % 2 !== 0) {
      bye = escolherBye(lista, jaTeveBye || function () { return false; });
      lista = lista.filter(function (n) { return n !== bye; });
    }

    var pares = resolverSemRepetir(lista, jaJogaram);
    var repeticoesForcadas = [];

    if (!pares) {
      // Não existe pareamento sem repetição: usa o que repete menos e reporta.
      var fallback = resolverComMenosRepeticoes(lista, jaJogaram);
      pares = fallback.pares;
      pares.forEach(function (p) {
        if (jaJogaram(p[0], p[1])) repeticoesForcadas.push(p);
      });
    }

    return { pares: pares, bye: bye, repeticoesForcadas: repeticoesForcadas };
  }

  var API = {
    chave: chave,
    embaralhar: embaralhar,
    escolherBye: escolherBye,
    resolverSemRepetir: resolverSemRepetir,
    gerarRodada: gerarRodada
  };

  raiz.Pareamento = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
