#!/usr/bin/env node
// importar-resultados.js
//
// Acrescenta ao jogos.json os registros de um arquivo exportado pela ferramenta
// de torneio, com validação completa e escrita atômica.
//
//   node importar-resultados.js resultados_24-08-2026.json
//   node importar-resultados.js resultados_24-08-2026.json --dry-run
//
// Substitui o procedimento manual de abrir o arquivo, remover os colchetes,
// acertar a vírgula e colar no fim do jogos.json — onde um deslize corrompe
// 700+ registros.
//
// REGRA CENTRAL: ou tudo é válido e o arquivo é gravado, ou nada é tocado.

var fs = require("fs");
var path = require("path");

var MTR = require(path.join(__dirname, "mtr.js"));

// O main.js lê os jogos com resultado.split(" x "), então o formato precisa dos
// espaços. O MTR.parsePlacar é mais tolerante (aceita "2x0"), mas um registro
// nesse formato faria o ranking do site virar NaN em silêncio.
var FORMATO_RESULTADO = /^\d+ x \d+$/;

var RESULTADO_BYE = "2 x 0";

// ---------------------------------------------------------------- utilidades

function ehInteiroPositivo(v) {
  return typeof v === "number" && isFinite(v) && Math.floor(v) === v && v >= 1;
}

function nomeValido(v) {
  return typeof v === "string" && v.trim() !== "";
}

// Identidade canônica de uma partida: A x B e B x A são a MESMA partida.
// O resultado fica de fora de propósito — dois registros do mesmo confronto com
// placares diferentes são um conflito, não dois jogos.
function chavePartida(j) {
  var par = [String(j.jogador1).trim(), String(j.jogador2).trim()].sort();
  return [j.liga, j.dia, j.rodada, par[0], par[1]].join("|");
}

function serializarJogo(o) {
  return '  { "liga": ' + o.liga +
         ', "dia": ' + o.dia +
         ', "rodada": ' + o.rodada +
         ', "jogador1": ' + JSON.stringify(o.jogador1) +
         ', "resultado": ' + JSON.stringify(o.resultado) +
         ', "jogador2": ' + JSON.stringify(o.jogador2) +
         (o.gamesEmpatados ? ', "gamesEmpatados": ' + o.gamesEmpatados : "") +
         " }";
}

function serializarJogos(jogos) {
  return "[\n" + jogos.map(serializarJogo).join(",\n") + "\n]\n";
}

// Acrescenta os novos registros ao TEXTO existente, em vez de reserializar o
// arquivo inteiro.
//
// Isso importa: 39 registros do jogos.json têm as chaves em outra ordem
// (`jogador2` antes de `resultado`). Reserializar tudo os normalizaria e
// produziria dezenas de linhas de diff a cada importação — ruído justamente no
// passo em que o diff precisa ser revisado. Assim, o diff é só o que entrou.
function acrescentarAoTexto(textoAtual, novos, tinhaRegistros) {
  var fim = textoAtual.lastIndexOf("]");
  if (fim === -1) throw new Error("o arquivo não termina com ]");

  var corpo = textoAtual.slice(0, fim).replace(/\s*$/, "");
  var linhas = novos.map(serializarJogo).join(",\n");

  return corpo + (tinhaRegistros ? ",\n" : "\n") + linhas + "\n]\n";
}

function carimboDeTempo() {
  var d = new Date();
  var p = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" +
         p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// ---------------------------------------------------------------- validação

// Devolve { erros: [...], resumo: {...} }. Nunca escreve nada.
function validar(novos, existentes) {
  var erros = [];

  if (!Array.isArray(novos)) {
    return { erros: ["O arquivo não contém um array de jogos."] };
  }
  if (novos.length === 0) {
    return { erros: ["O arquivo está vazio — nenhum jogo para importar."] };
  }

  // --- estrutura de cada registro
  novos.forEach(function (j, i) {
    var onde = "registro " + (i + 1);

    if (!j || typeof j !== "object") {
      erros.push(onde + ": não é um objeto.");
      return;
    }

    ["liga", "dia", "rodada"].forEach(function (campo) {
      if (j[campo] === undefined) erros.push(onde + ': falta o campo "' + campo + '".');
      else if (!ehInteiroPositivo(j[campo])) {
        erros.push(onde + ': "' + campo + '" deve ser um inteiro ≥ 1 (veio ' +
                   JSON.stringify(j[campo]) + ").");
      }
    });

    // Presença ANTES de perguntar se é Bye: MTR.ehBye("") devolve true, então
    // um campo vazio passaria como folga.
    ["jogador1", "jogador2"].forEach(function (campo) {
      if (j[campo] === undefined) erros.push(onde + ': falta o campo "' + campo + '".');
      else if (!nomeValido(j[campo])) {
        erros.push(onde + ': "' + campo + '" está vazio.');
      }
    });

    if (j.resultado === undefined) {
      erros.push(onde + ': falta o campo "resultado".');
    } else if (!FORMATO_RESULTADO.test(String(j.resultado))) {
      erros.push(onde + ': resultado ' + JSON.stringify(j.resultado) +
                 ' fora do formato "N x N" (com espaços).');
    }

    if (j.gamesEmpatados !== undefined) {
      var e = j.gamesEmpatados;
      if (typeof e !== "number" || !isFinite(e) || Math.floor(e) !== e || e < 0) {
        erros.push(onde + ': "gamesEmpatados" deve ser um inteiro ≥ 0 (veio ' +
                   JSON.stringify(e) + ").");
      }
    }

    if (nomeValido(j.jogador1) && nomeValido(j.jogador2)) {
      if (MTR.ehBye(j.jogador1)) {
        erros.push(onde + ": o Bye deve ficar em jogador2, não em jogador1.");
      }
      if (String(j.jogador1).trim() === String(j.jogador2).trim()) {
        erros.push(onde + ": jogador1 e jogador2 são o mesmo jogador.");
      }
      if (MTR.ehBye(j.jogador2)) {
        if (String(j.resultado) !== RESULTADO_BYE) {
          erros.push(onde + ': partida com Bye deve ter resultado "' + RESULTADO_BYE +
                     '" (veio ' + JSON.stringify(j.resultado) + ").");
        }
        if (j.gamesEmpatados) {
          erros.push(onde + ": partida com Bye não pode ter gamesEmpatados.");
        }
      }
    }
  });

  if (erros.length) return { erros: erros };

  // --- o arquivo tem de ser de uma única liga e um único dia
  var ligas = Array.from(new Set(novos.map(function (j) { return j.liga; })));
  var dias = Array.from(new Set(novos.map(function (j) { return j.dia; })));

  if (ligas.length > 1) {
    erros.push("O arquivo mistura mais de uma liga: " + ligas.sort().join(", ") + ".");
  }
  if (dias.length > 1) {
    erros.push("O arquivo mistura mais de um dia: " + dias.sort().join(", ") + ".");
  }
  if (erros.length) return { erros: erros };

  var liga = ligas[0];
  var dia = dias[0];

  // --- duplicidade dentro do próprio arquivo (identidade canônica)
  var vistos = {};
  novos.forEach(function (j, i) {
    var k = chavePartida(j);
    if (vistos[k] !== undefined) {
      erros.push("registros " + (vistos[k] + 1) + " e " + (i + 1) +
                 ": mesma partida (" + j.jogador1 + " x " + j.jogador2 +
                 ", rodada " + j.rodada + ") aparece duas vezes.");
    } else {
      vistos[k] = i;
    }
  });

  // --- invariantes de cada rodada
  var porRodada = {};
  novos.forEach(function (j) {
    (porRodada[j.rodada] || (porRodada[j.rodada] = [])).push(j);
  });

  Object.keys(porRodada).map(Number).sort(function (a, b) { return a - b; })
    .forEach(function (r) {
      var jogos = porRodada[r];
      var usos = {};
      var byes = 0;

      jogos.forEach(function (j) {
        if (MTR.ehBye(j.jogador2)) byes++;
        [j.jogador1, j.jogador2].forEach(function (n) {
          if (MTR.ehBye(n)) return;   // "Bye" não é jogador
          n = String(n).trim();
          usos[n] = (usos[n] || 0) + 1;
        });
      });

      Object.keys(usos).forEach(function (n) {
        if (usos[n] > 1) {
          erros.push("rodada " + r + ": " + n + " aparece em " + usos[n] + " jogos.");
        }
      });

      if (byes > 1) {
        erros.push("rodada " + r + ": há " + byes + " Byes (o máximo é um).");
      }
    });

  // --- rodadas de 1 a N, sem lacunas
  var rodadas = Object.keys(porRodada).map(Number).sort(function (a, b) { return a - b; });
  var esperadas = rodadas.map(function (_, i) { return i + 1; });
  if (rodadas.join(",") !== esperadas.join(",")) {
    erros.push("As rodadas devem ir de 1 a " + rodadas.length +
               " sem lacunas (vieram: " + rodadas.join(", ") + ").");
  }

  if (erros.length) return { erros: erros };

  // --- já publicado?
  var jaExistem = existentes.filter(function (j) {
    return j.liga === liga && j.dia === dia;
  });
  if (jaExistem.length) {
    return {
      erros: ["Liga " + liga + " / Dia " + dia + " já existe em jogos.json (" +
              jaExistem.length + " registros)."]
    };
  }

  // --- continuidade: o dia importado tem de ser o próximo da liga
  var diasDaLiga = existentes
    .filter(function (j) { return j.liga === liga; })
    .map(function (j) { return j.dia; });
  var maiorDia = diasDaLiga.length ? Math.max.apply(null, diasDaLiga) : 0;
  var esperado = maiorDia + 1;

  if (dia !== esperado) {
    return {
      erros: ["O arquivo informa Liga " + liga + " / Dia " + dia + ".\n" +
              "   O próximo dia esperado é o Dia " + esperado + "."]
    };
  }

  return {
    erros: [],
    resumo: {
      liga: liga,
      dia: dia,
      rodadas: rodadas.length,
      registros: novos.length,
      byes: novos.filter(function (j) { return MTR.ehBye(j.jogador2); }).length,
      comEmpates: novos.filter(function (j) { return j.gamesEmpatados; }).length
    }
  };
}

// ---------------------------------------------------------------- importação

/**
 * @param {string}  arquivo  JSON exportado pela ferramenta
 * @param {string}  destino  caminho do jogos.json
 * @param {boolean} dryRun   valida e resume, sem gravar nada
 * @returns {{ok:boolean, erros:string[], resumo?:object, backup?:string, total?:number}}
 */
function importar(opcoes) {
  var arquivo = opcoes.arquivo;
  var destino = opcoes.destino || path.join(__dirname, "jogos.json");
  var dryRun = !!opcoes.dryRun;

  if (!fs.existsSync(arquivo)) {
    return { ok: false, erros: ["Arquivo não encontrado: " + arquivo] };
  }
  if (!fs.existsSync(destino)) {
    return { ok: false, erros: ["jogos.json não encontrado: " + destino] };
  }

  var novos;
  try {
    novos = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch (e) {
    return { ok: false, erros: ["O arquivo não é um JSON válido: " + e.message] };
  }

  var textoDestino = fs.readFileSync(destino, "utf8");
  var existentes;
  try {
    existentes = JSON.parse(textoDestino);
  } catch (e) {
    return { ok: false, erros: ["jogos.json não é um JSON válido: " + e.message] };
  }
  if (!Array.isArray(existentes)) {
    return { ok: false, erros: ["jogos.json não contém um array."] };
  }

  var v = validar(novos, existentes);
  if (v.erros.length) return { ok: false, erros: v.erros };

  if (dryRun) {
    return { ok: true, erros: [], resumo: v.resumo, dryRun: true,
             total: existentes.length + novos.length };
  }

  // --- escrita atômica: temporário no MESMO diretório, valida, e só então troca
  var conteudo = acrescentarAoTexto(textoDestino, novos, existentes.length > 0);
  var tmp = destino + ".tmp-" + process.pid;

  try {
    fs.writeFileSync(tmp, conteudo, "utf8");

    var relido = JSON.parse(fs.readFileSync(tmp, "utf8"));
    if (!Array.isArray(relido) || relido.length !== existentes.length + novos.length) {
      throw new Error("o arquivo gerado não bateu com o esperado");
    }

    var backup = destino.replace(/\.json$/, "") + ".backup-" + carimboDeTempo() + ".json";
    fs.copyFileSync(destino, backup);

    fs.renameSync(tmp, destino);

    return { ok: true, erros: [], resumo: v.resumo, backup: backup, total: relido.length };
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (x) {}
    return { ok: false, erros: ["Falha ao gravar: " + e.message] };
  }
}

// ---------------------------------------------------------------------- CLI

function imprimirSucesso(r) {
  var s = r.resumo;
  console.log("");
  console.log(r.dryRun ? "✅ Validação concluída (--dry-run)" : "✅ Importação concluída");
  console.log("   Liga: " + s.liga);
  console.log("   Dia: " + s.dia);
  console.log("   Rodadas: " + s.rodadas);
  console.log("   Registros importados: " + s.registros);
  console.log("   BYEs: " + s.byes);
  console.log("   Partidas com games empatados: " + s.comEmpates);

  if (r.dryRun) {
    console.log("");
    console.log("   Nenhum arquivo foi alterado (--dry-run).");
    console.log("   Para importar de verdade, rode o mesmo comando sem --dry-run.");
  } else {
    console.log("   jogos.json válido (" + r.total + " registros)");
    console.log("   Backup: " + path.basename(r.backup));
    console.log("");
    console.log("⚠️  Lembrete: atualizar infoPorLiga no main.js");
    console.log("   " + s.liga + ": { " + s.dia +
                ': { data: "DD/MM/AAAA", draft: "Nome do evento" } }');
  }
  console.log("");
}

function imprimirErro(erros) {
  console.error("");
  console.error("❌ Importação cancelada");
  erros.forEach(function (e) { console.error("   " + e); });
  console.error("   Nenhum arquivo foi alterado.");
  console.error("");
}

if (require.main === module) {
  var args = process.argv.slice(2);
  var dryRun = args.indexOf("--dry-run") !== -1;
  var arquivo = args.filter(function (a) { return a.indexOf("--") !== 0; })[0];

  if (!arquivo) {
    console.error("");
    console.error("Uso: node importar-resultados.js <arquivo-exportado.json> [--dry-run]");
    console.error("");
    process.exit(1);
  }

  var r = importar({ arquivo: arquivo, dryRun: dryRun });
  if (r.ok) { imprimirSucesso(r); process.exit(0); }
  imprimirErro(r.erros);
  process.exit(1);
}

module.exports = {
  importar: importar,
  validar: validar,
  serializarJogo: serializarJogo,
  serializarJogos: serializarJogos,
  acrescentarAoTexto: acrescentarAoTexto
};
