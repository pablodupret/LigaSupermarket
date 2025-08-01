async function carregarJogos() {
  const resposta = await fetch('jogos.json');
  const jogos = await resposta.json();

  const porDia = new Map();
  jogos.forEach(jogo => {
    if (!porDia.has(jogo.dia)) porDia.set(jogo.dia, []);
    porDia.get(jogo.dia).push(jogo);
  });

  const container = document.getElementById('rodadas-container');
  container.innerHTML = '';

  const info = {
1: { data: "15/06/2025", draft: "Draft Final Fantasy" },
2: { data: "29/06/2025", draft: "Draft Aetherdrift" },
3: { data: "12/07/2025", draft: "Draft Chaos Final Fantasy / Karlov" }
};

  for (const [dia, jogosDia] of porDia.entries()) {
    const divDia = document.createElement('div');
    divDia.classList.add('dia-de-jogo');

    divDia.innerHTML += `
      <h2>Histórico de Jogos – Dia ${dia}</h2>
      <h4>Dia ${info[dia]?.data || "Data não definida"}</h4>
      <h4>${info[dia]?.draft || "Draft desconhecido"}</h4>
    `;

    const rodadas = [...new Set(jogosDia.map(j => j.rodada))].sort((a,b) => a-b);

    rodadas.forEach(rodada => {
      const jogosRodada = jogosDia.filter(j => j.rodada === rodada);
      let html = `<h3>Rodada ${rodada}</h3>
      <table class="tabela-estilizada">
        <thead>
          <tr>
            <th>Jogador 1</th>
            <th>Resultado</th>
            <th>Jogador 2</th>
          </tr>
        </thead>
        <tbody>`;
      jogosRodada.forEach(j => {
        html += `<tr>
          <td>${j.jogador1}</td>
          <td>${j.resultado}</td>
          <td>${j.jogador2}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
      divDia.innerHTML += html;
    });
    container.appendChild(divDia);
  }

  gerarRanking(jogos);
}

function gerarRanking(jogos) {
  const pontuacoes = {};

  jogos.forEach(jogo => {
    const [g1, g2] = jogo.resultado.split(" x ").map(Number);
    const j1 = jogo.jogador1;
    const j2 = jogo.jogador2;

    if (!pontuacoes[j1]) pontuacoes[j1] = 0;
    if (!pontuacoes[j2]) pontuacoes[j2] = 0;

    if (g1 > g2) pontuacoes[j1] += 3;
    else if (g1 < g2) pontuacoes[j2] += 3;
    else {
      pontuacoes[j1] += 1;
      pontuacoes[j2] += 1;
    }
  });

  const ranking = Object.entries(pontuacoes)
    .map(([jogador, pontos]) => ({ jogador, pontos }))
    .sort((a, b) => b.pontos - a.pontos);

  const corpo = document.getElementById('tabela-ranking');
  corpo.innerHTML = '';
  
  ranking.forEach((entry, i) => {
    const tr = document.createElement('tr');
  
    // Gera o nome do arquivo da imagem com base no padrão avatar_nome.jpg
    const nomeImagem = `avatar_${entry.jogador.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/\s/g, "")}`; // remove espaços
  
    const imgHTML = `<img src="img/${nomeImagem}.jpg" onerror="this.onerror=null;this.src='img/avatar_padrao.jpg';" alt="${entry.jogador}" class="avatar">`;

  
    tr.innerHTML = `
      <td>${i + 1}º</td>
      <td class="td-nome">${imgHTML}<span>${entry.jogador}</span></td>
      <td>${entry.pontos}</td>
    `;
    corpo.appendChild(tr);
  });
  
  
  
}

carregarJogos();

/*Filtro e estatisticas */

function calcularEstatisticas(nome, jogos) {
  let vitorias = 0, derrotas = 0, empates = 0, total = 0;

  jogos.forEach(jogo => {
    const [g1, g2] = jogo.resultado.split(" x ").map(Number);
    if (jogo.jogador1 === nome || jogo.jogador2 === nome) {
      total++;
      if ((jogo.jogador1 === nome && g1 > g2) || (jogo.jogador2 === nome && g2 > g1)) {
        vitorias++;
      } else if (g1 === g2) {
        empates++;
      } else {
        derrotas++;
      }
    }
  });

  return { vitorias, derrotas, empates, total };
}

function gerarListaSimples(jogos, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  let html = `<table>
    <thead>
      <tr>
        <th> Dia </th>
        <th>Jogador 1</th>
        <th>Resultado</th>
        <th>Jogador 2</th>
      </tr>
    </thead>
    <tbody>`;

  jogos.forEach(jogo => {
    html += `<tr>
      <td>${jogo.dia}</td>
      <td>${jogo.jogador1}</td>
      <td>${jogo.resultado}</td>
      <td>${jogo.jogador2}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function filtrarJogosPorJogador(nome, jogos) {
  const jogosFiltrados = jogos.filter(j =>
    j.jogador1 === nome || j.jogador2 === nome
  );

  const container = document.getElementById("jogos-filtrados");
  container.innerHTML = `<h3>Jogos de ${nome}</h3>`;
  gerarListaSimples(jogosFiltrados, "jogos-filtrados");

  const stats = calcularEstatisticas(nome, jogos);
  const statBox = document.getElementById("estatisticas");
  
  statBox.innerHTML = `
  <h3>Estatísticas de ${nome}</h3>
  <p>Partidas: <span id="contagem-total">0</span></p>
  <p>Vitórias: <span id="contagem-vitorias">0</span></p>
  <p>Derrotas: <span id="contagem-derrotas">0</span></p>
  <p>Empates: <span id="contagem-empates">0</span></p>
  <br>
  <button onclick="mostrarTodosOsJogos()"> Voltar Histórico Completo</button>
  `;

  const vs = calcularVsAdversarios(nome, jogos);

// Identificar carrasco e pato
let carrasco = null;
let pato = null;
let maisDerrotas = 0;
let maisVitorias = 0;

for (const [adversario, stats] of Object.entries(vs)) {
  if (stats.derrotas > maisDerrotas) {
    maisDerrotas = stats.derrotas;
    carrasco = adversario;
  }
  if (stats.vitorias > maisVitorias) {
    maisVitorias = stats.vitorias;
    pato = adversario;
  }
}

// Criar tabela
let html = "<h3>Desempenho contra adversários</h3><table><thead><tr><th>Adversário</th><th>Partidas</th><th>Vitórias</th><th>Derrotas</th><th>Empates</th></tr></thead><tbody>";

for (const [adversario, stats] of Object.entries(vs)) {
  let destaque = "";
  if (adversario === carrasco) destaque = ' <span title="Carrasco: jogador que mais venceu você">👑</span>';
  if (adversario === pato) destaque += ' <span title="Pato: jogador que você mais venceu">🦆</span>';

  html += `<tr>
    <td>${adversario}${destaque}</td>
    <td>${stats.total}</td>
    <td>${stats.vitorias}</td>
    <td>${stats.derrotas}</td>
    <td>${stats.empates}</td>
  </tr>`;
}
html += "</tbody></table>";

statBox.innerHTML += html;


  // 👇 Adicione isso para animar os números:
  setTimeout(() => {
    animarContagem("contagem-total", stats.total);
    animarContagem("contagem-vitorias", stats.vitorias);
    animarContagem("contagem-derrotas", stats.derrotas);
    animarContagem("contagem-empates", stats.empates);
  }, 100);


}

function mostrarTodosOsJogos() {
  document.getElementById("filtro-jogador").value = "";
  document.getElementById("estatisticas").innerHTML = "";
  document.getElementById("jogos-filtrados").innerHTML = "";
  carregarJogos();
}



function animarContagem(id, valorFinal) {
  const elemento = document.getElementById(id);
  if (!elemento) return;

  let valorAtual = 0;
  const incremento = Math.ceil(valorFinal / 40) || 1;

  const intervalo = setInterval(() => {
    valorAtual += incremento;
    if (valorAtual >= valorFinal) {
      valorAtual = valorFinal;
      clearInterval(intervalo);
    }
    elemento.innerText = valorAtual;
  }, 60);
}


function filtrarJogos() {
  const nome = document.getElementById("filtro-jogador").value.trim();
  if (!nome) return;
  fetch("jogos.json")
    .then(res => res.json())
    .then(jogos => {
      filtrarJogosPorJogador(nome, jogos);
    });
}

// Implementando estatistica avancada - Pato e Carrasco

function calcularVsAdversarios(nome, jogos) {
  const vs = {};

  jogos.forEach(jogo => {
    const [g1, g2] = jogo.resultado.split(" x ").map(Number);
    let adversario = null;
    let resultado = null;

    if (jogo.jogador1 === nome) {
      adversario = jogo.jogador2;
      if (g1 > g2) resultado = "vitorias";
      else if (g1 < g2) resultado = "derrotas";
      else resultado = "empates";
    } else if (jogo.jogador2 === nome) {
      adversario = jogo.jogador1;
      if (g2 > g1) resultado = "vitorias";
      else if (g2 < g1) resultado = "derrotas";
      else resultado = "empates";
    }

    if (!adversario) return;

    if (!vs[adversario]) vs[adversario] = { vitorias: 0, derrotas: 0, empates: 0, total: 0 };
    vs[adversario][resultado]++;
    vs[adversario].total++;
  });

  return vs;
}

