// ========================
// Dados dos jogos – Dia 1
// ========================
const jogosDia1 = [
    { rodada: 1, jogador1: "Eduardo", resultado: "1 x 2", jogador2: "Magno" },
    { rodada: 1, jogador1: "Igor", resultado: "0 x 2", jogador2: "Joca" },
    { rodada: 1, jogador1: "Marcelo", resultado: "2 x 1", jogador2: "Stenio" },
    { rodada: 1, jogador1: "Alex", resultado: "2 x 0", jogador2: "Pablo" },
    { rodada: 1, jogador1: "Nagib", resultado: "2 x 0", jogador2: "Subzero" },
    { rodada: 1, jogador1: "Sérgio", resultado: "2 x 0", jogador2: "Bye" },
  
    { rodada: 2, jogador1: "Magno", resultado: "2 x 1", jogador2: "Nagib" },
    { rodada: 2, jogador1: "Joca", resultado: "0 x 2", jogador2: "Sérgio" },
    { rodada: 2, jogador1: "Eduardo", resultado: "2 x 0", jogador2: "Subzero" },
    { rodada: 2, jogador1: "Igor", resultado: "1 x 1", jogador2: "Pablo" },
    { rodada: 2, jogador1: "Alex", resultado: "1 x 2", jogador2: "Marcelo" },
    { rodada: 2, jogador1: "Stenio", resultado: "2 x 0", jogador2: "Bye" },
  
    { rodada: 3, jogador1: "Magno", resultado: "2 x 0", jogador2: "Stenio" },
    { rodada: 3, jogador1: "Joca", resultado: "2 x 0", jogador2: "Pablo" },
    { rodada: 3, jogador1: "Marcelo", resultado: "2 x 0", jogador2: "Sérgio" },
    { rodada: 3, jogador1: "Alex", resultado: "2 x 0", jogador2: "Eduardo" },
    { rodada: 3, jogador1: "Igor", resultado: "0 x 2", jogador2: "Nagib" },
    { rodada: 3, jogador1: "Subzero", resultado: "2 x 0", jogador2: "Bye" },
  
    { rodada: 4, jogador1: "Magno", resultado: "2 x 0", jogador2: "Marcelo" },
    { rodada: 4, jogador1: "Nagib", resultado: "2 x 0", jogador2: "Sérgio" },
    { rodada: 4, jogador1: "Alex", resultado: "2 x 1", jogador2: "Joca" },
    { rodada: 4, jogador1: "Eduardo", resultado: "1 x 2", jogador2: "Stenio" },
    { rodada: 4, jogador1: "Igor", resultado: "0 x 2", jogador2: "Subzero" },
    { rodada: 4, jogador1: "Pablo", resultado: "2 x 0", jogador2: "Bye" }
  ]
  
  // ========================
  // Dados dos jogos – Dia 2
  // ========================
  const jogosDia2 = [
    { rodada: 1, jogador1: "Magno", resultado: "2 x 0", jogador2: "Qiu" },
    { rodada: 1, jogador1: "Nagib", resultado: "2 x 1", jogador2: "Vinicios" },
    { rodada: 1, jogador1: "Pablo", resultado: "0 x 2", jogador2: "Eduardo" },
    { rodada: 1, jogador1: "Stenio", resultado: "2 x 0", jogador2: "Bye" },
  
    { rodada: 2, jogador1: "Magno", resultado: "2 x 0", jogador2: "Stenio" },
    { rodada: 2, jogador1: "Eduardo", resultado: "2 x 1", jogador2: "Nagib" },
    { rodada: 2, jogador1: "Pablo", resultado: "1 x 1", jogador2: "Vinicios" },
    { rodada: 2, jogador1: "Qiu", resultado: "2 x 0", jogador2: "Bye" },
  
    { rodada: 3, jogador1: "Magno", resultado: "2 x 0", jogador2: "Eduardo" },
    { rodada: 3, jogador1: "Qiu", resultado: "2 x 0", jogador2: "Vinicios" },
    { rodada: 3, jogador1: "Nagib", resultado: "1 x 1", jogador2: "Stenio" },
    { rodada: 3, jogador1: "Pablo", resultado: "2 x 0", jogador2: "Bye" }
  ]
  
  // =============================
  // Geração dinâmica das rodadas
  // =============================
  function gerarTabelaPorRodada(jogos, containerId) {
    const container = document.getElementById(containerId)
    container.innerHTML = ""
  
    const rodadas = [...new Set(jogos.map(j => j.rodada))]
  
    rodadas.forEach(rodada => {
      const rodadaJogos = jogos.filter(j => j.rodada === rodada)
  
      let html = `<h3>Rodada ${rodada}</h3>`
      html += `<table>
        <thead>
          <tr>
            <th>Jogador 1</th>
            <th>Resultado</th>
            <th>Jogador 2</th>
          </tr>
        </thead>
        <tbody>`
  
      rodadaJogos.forEach(jogo => {
        html += `<tr>
          <td>${jogo.jogador1}</td>
          <td>${jogo.resultado}</td>
          <td>${jogo.jogador2}</td>
        </tr>`
      })
  
      html += `</tbody></table>`
      container.innerHTML += html
    })
  }
  
  // =====================
  // Estatísticas e Filtros
  // =====================
  function calcularEstatisticas(nome, jogos) {
    let vitorias = 0, derrotas = 0, empates = 0, total = 0
  
    jogos.forEach(jogo => {
      const [gols1, gols2] = jogo.resultado.split(" x ").map(Number)
  
      if (jogo.jogador1 === nome || jogo.jogador2 === nome) {
        total++
        if ((jogo.jogador1 === nome && gols1 > gols2) || (jogo.jogador2 === nome && gols2 > gols1)) {
          vitorias++
        } else if (gols1 === gols2) {
          empates++
        } else {
          derrotas++
        }
      }
    })
  
    return { vitorias, derrotas, empates, total }
  }
  
  function filtrarJogosPorJogador(nome) {
    const todosJogos = [...jogosDia1, ...jogosDia2]
    const jogosFiltrados = todosJogos.filter(jogo =>
      jogo.jogador1 === nome || jogo.jogador2 === nome
    )
  
    //gerarTabelaPorRodada(jogosFiltrados, "tabelas-rodadas-dia1")
    //document.getElementById("tabelas-rodadas-dia2").innerHTML = ""
  
    //NOVO CAMPO PARA ELEMENTOS FILTRADOS
    document.getElementById("tabelas-rodadas-dia1").style.display = "none"
    document.getElementById("tabelas-rodadas-dia2").style.display = "none"

    // Criar visual dos jogos filtrados
    const container = document.getElementById("jogos-filtrados")
    container.innerHTML = `<h2>Jogos de ${nome}</h2>`
    gerarListaSimples(jogosFiltrados, "jogos-filtrados")
    


    const stats = calcularEstatisticas(nome, todosJogos)
    const statBox = document.getElementById("estatisticas")
    statBox.innerHTML = `
      <h3>Estatísticas de ${nome}</h3>
      <p>Partidas: ${stats.total}</p>
      <p>Vitórias: ${stats.vitorias}</p>
      <p>Derrotas: ${stats.derrotas}</p>
      <p>Empates: ${stats.empates}</p>
      <button onclick="resetarTabela()">Mostrar Todos</button>
    `
  }
  
  function filtrarJogos() {
    const nome = document.getElementById("filtro-jogador").value.trim()
    if (nome) filtrarJogosPorJogador(nome)
  }
  
  function resetarTabela() {
    gerarTabelaPorRodada(jogosDia1, "tabelas-rodadas-dia1")
    gerarTabelaPorRodada(jogosDia2, "tabelas-rodadas-dia2")
    document.getElementById("estatisticas").innerHTML = ""
    document.getElementById("jogos-filtrados").innerHTML = ""
    document.getElementById("tabelas-rodadas-dia1").style.display = "block"
    document.getElementById("tabelas-rodadas-dia2").style.display = "block"

  }
  
  // ==================
  // Inicialização
  // ==================
  window.addEventListener("DOMContentLoaded", () => {
    gerarTabelaPorRodada(jogosDia1, "tabelas-rodadas-dia1")
    gerarTabelaPorRodada(jogosDia2, "tabelas-rodadas-dia2")
  })


  //------------
  // Lista Simples para aparecer nos jogos filtrados sem as rodadas
  //-----------

  function gerarListaSimples(jogos, containerId) {
    const container = document.getElementById(containerId)
    container.innerHTML = ""
  
    let html = `<table>
      <thead>
        <tr>
          <th>Jogador 1</th>
          <th>Resultado</th>
          <th>Jogador 2</th>
        </tr>
      </thead>
      <tbody>`
  
    jogos.forEach(jogo => {
      html += `<tr>
        <td>${jogo.jogador1}</td>
        <td>${jogo.resultado}</td>
        <td>${jogo.jogador2}</td>
      </tr>`
    })
  
    html += `</tbody></table>`
    container.innerHTML = html
  }
  
  