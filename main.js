// Calcula ranking simples (pontos totais) e devolve array ordenado

let ligaAtualId = 3;   // liga que começa selecionada (temporada atual)
let ligas = [];        // será preenchido a partir de ligas.json
let graficoEvolucao = null; // instância do Chart.js para poder atualizar/destroi

function usaRegraPontosValidos() {
  return [2, 3].includes(ligaAtualId);
}

const jogadoresOcultos = [
  "Everton Lucas",
  "Raphael Rocha",
  "Rafael Lobo",
  "Rodrigo Copello",
  "Matheus Berthoux",
  "Gabriel",
  "João Amaral",
  "Eduardo Baracho",
  "Maria Baracho",
  "Victor Cabral",
  "Rafael Rocha",
  "Vitor Mayer",
  "Mikael Molo",
  "João Paulo Perez",
  "Bernard Telles",
  "Leandro Floresta",
  "Luis Neto",
  "Breno Fragoso"
];

// ✅ Helpers para ocultar jogadores (ranking, gráfico, selects, etc.)
const jogadoresOcultosSet = new Set(jogadoresOcultos.map(n => n.trim()));

function jogadorEstaOculto(nome) {
  return jogadoresOcultosSet.has(nome);
}

function jogadorEhVisivel(nome) {
  return nome && nome.toLowerCase() !== "bye" && !jogadorEstaOculto(nome);
}
//---------


// Carrega ligas a partir de ligas.json e preenche o seletor
async function carregarLigas() {
  try {
    const resp = await fetch('ligas.json');
    const data = await resp.json();
    ligas = data;

    const select = document.getElementById('select-liga');
    if (!select) return;

    // Limpa opções atuais
    select.innerHTML = '';

    // Cria uma option por liga
    ligas.forEach(liga => {
      const option = document.createElement('option');
      option.value = liga.id;
      option.textContent = `${liga.nome} (${liga.ano})`;
      if (liga.id === ligaAtualId) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    // Quando o usuário trocar a liga no select
    // Quando o usuário trocar a liga no select
  select.addEventListener('change', (e) => {
  ligaAtualId = Number(e.target.value);

  // Recarrega tudo que depende da liga selecionada
  carregarJogos();
  limparFiltroJogador();

  // Atualiza a classe do body para trocar o fundo
  document.body.classList.remove("liga-1", "liga-2", "liga-3", "liga-atual");
  document.body.classList.add(ligaAtualId === 3 ? "liga-atual" : `liga-${ligaAtualId}`);
});


  } catch (erro) {
    console.error('Erro ao carregar ligas:', erro);
  }
}

// Opcional: limpar filtro e estatísticas ao trocar de liga
function limparFiltroJogador() {
  const input = document.getElementById('filtro-jogador');
  const estatisticasDiv = document.getElementById('estatisticas');
  const jogosDiv = document.getElementById('jogos-filtrados');

  if (input) input.value = '';
  if (estatisticasDiv) estatisticasDiv.innerHTML = '';
  if (jogosDiv) jogosDiv.innerHTML = '';
}

// Função de inicialização da página
async function initPagina() {
  await carregarLigas();  // monta o combo de ligas
  await carregarJogos();  // monta ranking + histórico já filtrados pela ligaAtualId

  document.body.classList.remove("liga-1", "liga-2", "liga-3", "liga-atual");
  document.body.classList.add(ligaAtualId === 3 ? "liga-atual" : `liga-${ligaAtualId}`);
  
}



function calcularRankingArray(jogos) {
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

  // transforma em array e ordena por pontos desc, depois nome asc (desempate estável)
  const arr = Object.entries(pontuacoes).map(([jogador, pontos]) => ({ jogador, pontos }));
  arr.sort((a, b) => b.pontos - a.pontos || a.jogador.localeCompare(b.jogador));
  return arr;
}


// Preenche o select de jogadores com todos os nomes da liga atual
function preencherSelectJogadores(jogos) {
  const select = document.getElementById('filtro-jogador');
  if (!select) return;

  const jogadoresSet = new Set();

  jogos.forEach(jogo => {
    jogadoresSet.add(jogo.jogador1);
    jogadoresSet.add(jogo.jogador2);
  });

  const jogadores = Array.from(jogadoresSet)
  .filter(nome => jogadorEhVisivel(nome)) // ✅ remove ocultos e BYE
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));


  // limpa opções atuais
  select.innerHTML = '<option value="">Selecione um jogador</option>';

  // adiciona uma option pra cada jogador
  jogadores.forEach(nome => {
    const opt = document.createElement('option');
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}




  // Grafico de evolucao por rodadas
// Gráfico de evolução por rodadas
function atualizarGraficoEvolucao(jogos) {
  const canvas = document.getElementById('grafico-evolucao');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (!jogos || jogos.length === 0) {
    if (graficoEvolucao) {
      graficoEvolucao.destroy();
      graficoEvolucao = null;
    }
    return;
  }

  // ---------- NOVO: ranking por dia respeitando "pontos válidos" na Liga 2 ----------
  function calcularRankingParaGrafico(jogosAteDia) {
    const pontosTotais = {};
    const pontosPorDia = {};

    jogosAteDia.forEach(jogo => {
      const [g1, g2] = jogo.resultado.split(" x ").map(Number);
      const j1 = jogo.jogador1;
      const j2 = jogo.jogador2;
      const dia = jogo.dia;

      if (!pontosTotais[j1]) pontosTotais[j1] = 0;
      if (!pontosTotais[j2]) pontosTotais[j2] = 0;

      if (!pontosPorDia[j1]) pontosPorDia[j1] = {};
      if (!pontosPorDia[j2]) pontosPorDia[j2] = {};

      // vitória / derrota / empate
      if (g1 > g2) {
        pontosTotais[j1] += 3;
        pontosPorDia[j1][dia] = (pontosPorDia[j1][dia] || 0) + 3;
        pontosPorDia[j2][dia] = (pontosPorDia[j2][dia] || 0) + 0;
      } else if (g1 < g2) {
        pontosTotais[j2] += 3;
        pontosPorDia[j2][dia] = (pontosPorDia[j2][dia] || 0) + 3;
        pontosPorDia[j1][dia] = (pontosPorDia[j1][dia] || 0) + 0;
      } else {
        pontosTotais[j1] += 1;
        pontosTotais[j2] += 1;
        pontosPorDia[j1][dia] = (pontosPorDia[j1][dia] || 0) + 1;
        pontosPorDia[j2][dia] = (pontosPorDia[j2][dia] || 0) + 1;
      }
    });

      // Descobre todos os "dias" existentes até aqui
      const diasSet = new Set();
      Object.values(pontosPorDia).forEach(mapa => {
        Object.keys(mapa).forEach(diaStr => {
          diasSet.add(Number(diaStr));
        });
      });
      const diasOrdenados = Array.from(diasSet).sort((a, b) => a - b);
    


      const arr = Object.keys(pontosTotais).map(jogador => {
        const total = pontosTotais[jogador] || 0;
        let pontosValidos = total;
  
        if (usaRegraPontosValidos() && diasOrdenados.length > 1) {
          const mapaDias = pontosPorDia[jogador] || {};
  
          // monta vetor com TODOS os dias até aqui,
          // usando 0 para dias em que o jogador não jogou
          const valoresDias = diasOrdenados.map(dia => mapaDias[dia] || 0);
  
          if (valoresDias.length > 1) {
            const piorDia = Math.min(...valoresDias);
            const totalDias = valoresDias.reduce((acc, v) => acc + v, 0);
            pontosValidos = totalDias - piorDia;
          }
        }
  
        return {
          jogador,
          pontos: total,
          pontosValidos
        };
      });
  



    arr.sort((a, b) => {
      // Na Liga 2, ordena pelos pontos válidos
      if (usaRegraPontosValidos()) {
        if (b.pontosValidos !== a.pontosValidos) {
          return b.pontosValidos - a.pontosValidos;
        }
      }
      // fallback: pontos totais e nome
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      return a.jogador.localeCompare(b.jogador, 'pt-BR');
    });

    return arr.filter(e => jogadorEhVisivel(e.jogador));

  }
  // -------------------------------------------------------------------

  // Descobre o maior "dia" existente
  const maxDia = Math.max(...jogos.map(j => j.dia));

  // Lista de jogadores que aparecem em algum jogo
  const jogadoresSet = new Set();
  jogos.forEach(j => {
    jogadoresSet.add(j.jogador1);
    jogadoresSet.add(j.jogador2);
  });

  // Ordena jogadores pela POSIÇÃO no ranking final (respeitando pontos válidos)
    const rankingFinal = calcularRankingParaGrafico(jogos);
    const jogadores = rankingFinal.map(e => e.jogador);

    // Inicializa estrutura de evolução por jogador
    const evolucao = {};
    jogadores.forEach(j => {
      evolucao[j] = [];
    });


  // Para cada dia, calcula ranking até aquele dia
  for (let dia = 1; dia <= maxDia; dia++) {
    const jogosAteDia = jogos.filter(j => j.dia <= dia);

    // 👇 agora usa a função nova que respeita "pontos válidos" na Liga 2
    const rankingDia = calcularRankingParaGrafico(jogosAteDia);

    const posMap = new Map(
      rankingDia.map((e, idx) => [e.jogador, idx + 1]) // 1-based
    );

    jogadores.forEach(jogador => {
      const pos = posMap.get(jogador);
      evolucao[jogador].push(pos || null);
    });
  }

  // Labels do eixo X: R1, R2, R3...
  const labels = [];
  for (let dia = 1; dia <= maxDia; dia++) {
    labels.push(`R${dia}`);
  }

  // Paleta de cores para as linhas
  const cores = [
    'rgba(255, 159, 64, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(0, 200, 140, 1)',
    'rgba(200, 200, 200, 1)'
  ];

  const datasets = jogadores.map((jogador, idx) => ({
    label: jogador,
    data: evolucao[jogador],
    borderColor: cores[idx % cores.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    tension: 0.25,
    spanGaps: true,
    pointRadius: 3,
    pointHoverRadius: 5
  }));

  // Se já existe um gráfico, destrói antes de criar outro
  if (graficoEvolucao) {
    graficoEvolucao.destroy();
  }

  graficoEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          right: 10
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f5f5dc',
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const pos = context.parsed.y;
              if (!pos) {
                return `${context.dataset.label}: sem posição`;
              }
              return `${context.dataset.label}: ${pos}º lugar`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#f5f5dc'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        },
        y: {
          reverse: true, // 1º lugar em cima
          ticks: {
            color: '#f5f5dc',
            precision: 0,
            stepSize: 1
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        }
      }
    }
  });
}









// Informações de data e tipo de draft por LIGA e por DIA
const infoPorLiga = {
  1: { // Liga 1
    1:  { data: "15/06/2025", draft: "Draft Final Fantasy" },
    2:  { data: "29/06/2025", draft: "Draft Aetherdrift" },
    3:  { data: "12/07/2025", draft: "Draft Chaos Final Fantasy / Karlov" },
    4:  { data: "26/07/2025", draft: "Pre-release Edge of Ethernities"},
    5:  { data: "09/08/2025", draft: "Draft Edge of Ethernities"},
    6:  { data: "23/08/2025", draft: "Foundations"},
    7:  { data: "06/09/2025", draft: "Duskmourn"},
    8:  { data: "20/09/2025", draft: "Draft Aetherdrift"},
    9:  { data: "28/09/2025", draft: "Pré-release Homem Aranha"},
    10: { data: "04/10/2025", draft: "Draft Homem Aranha"},
    11: { data: "18/10/2025", draft: "Draft Duskmourn"},
    12: { data: "01/11/2025", draft: "Chaos Draft Foundations / Aetherdrift"},
  },

  2: { // Liga 2
    1: { data: "15/11/2025", draft: "Pre Release Avatar" },
    2: { data: "06/12/2025", draft: "Draft Avatar" },
    3: { data: "18/01/2026", draft: "Pré Release Lorwyn" },
    4: { data: "31/01/2026", draft: "Draft Avatar" },
    5: { data: "14/02/2026", draft: "Draft Avatar" },
    6: { data: "01/03/2026", draft: "Pré Release Tartarugas Ninja" },
    7: { data: "14/03/2026", draft: "Draft Tartarugas Ninja" },
  },

  3: { //liga 3
    1: { data: "data do primeiro dia", draft: "nome do draft" }
  }



};

// Mostra uma tabela com os pontos de cada dia para cada jogador
function renderizarPontosPorDia(pontosPorDiaPorJogador) {
  const section = document.getElementById('pontos-por-dia-section');
  const container = document.getElementById('pontos-por-dia');

  if (!section || !container) return;

  // 👉 Só mostra a partir da Liga 2; na Liga 1 a seção fica escondida
  if (!usaRegraPontosValidos()) {
    section.style.display = 'none';
    return;
  } else {
    section.style.display = 'block';
  }

  // Coleta todos os dias existentes
  const diasSet = new Set();
  Object.values(pontosPorDiaPorJogador).forEach(mapa => {
    Object.keys(mapa).forEach(diaStr => {
      diasSet.add(Number(diaStr));
    });
  });

  const dias = Array.from(diasSet).sort((a, b) => a - b);

  if (dias.length === 0) {
    container.innerHTML = '<p>Nenhum dia de jogo registrado ainda.</p>';
    return;
  }

  let html = `
    <table class="tabela-estilizada pontos-dia-tabela">
      <thead>
        <tr>
          <th>Jogador</th>
  `;

  dias.forEach(dia => {
    html += `<th>Dia ${dia}</th>`;
  });

  html += `
          <th>Ponto descartado</th>
        </tr>
      </thead>
      <tbody>
  `;

  const jogadores = Object.keys(pontosPorDiaPorJogador)
  .filter(nome => jogadorEhVisivel(nome)) // ✅ remove BYE + ocultos
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));


  jogadores.forEach(jogador => {
    const mapa = pontosPorDiaPorJogador[jogador] || {};
    const pontosDias = dias.map(dia => mapa[dia] || 0);

    // Encontrar APENAS UM pior dia (primeira ocorrência do menor valor)
    let indicePior = -1;
    if (pontosDias.length > 1) {
      let minVal = pontosDias[0];
      indicePior = 0;
      for (let i = 1; i < pontosDias.length; i++) {
        if (pontosDias[i] < minVal) {
          minVal = pontosDias[i];
          indicePior = i;
        }
      }
    }

    html += `<tr><td>${jogador}</td>`;

    pontosDias.forEach((pontos, idx) => {
      const classe = (idx === indicePior && pontosDias.length > 1)
        ? ' class="pior-dia"'
        : '';
      html += `<td${classe}>${pontos}</td>`;
    });

    const valorDescartado =
      indicePior >= 0 ? pontosDias[indicePior] : '-';

    html += `<td>${valorDescartado}</td></tr>`;
  });

  html += '</tbody></table>';

  container.innerHTML = html;
}




async function carregarJogos() {
  const resposta = await fetch('jogos.json');
  const todosJogos = await resposta.json();
  const jogos = todosJogos.filter(jogo => (jogo.liga || 1) === ligaAtualId);

  // 👇 novo: preenche o select com os jogadores desta liga
  preencherSelectJogadores(jogos);

  const porDia = new Map();
  jogos.forEach(jogo => {
    if (!porDia.has(jogo.dia)) porDia.set(jogo.dia, []);
    porDia.get(jogo.dia).push(jogo);
  });

  const container = document.getElementById('rodadas-container');
  container.innerHTML = '';

  const info = infoPorLiga[ligaAtualId] || {};


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

    // Ranking do dia usando appendix_c.js
const rankingDoDia = gerarRankingDoDia(dia, jogos);

let htmlRanking = `<h3>🏆 Ranking do Dia ${dia}</h3>
<table class="tabela-estilizada">
  <thead>
    <tr>
      <th>Jogador</th>
      <th>Match Points</th>
      <th>Match Win %</th>
      <th>Game Win %</th>
      <th>OMWP</th>
    </tr>
  </thead>
  <tbody>`;

rankingDoDia.forEach(j => {
  htmlRanking += `
    <tr>
      <td>${j.jogador}</td>
      <td>${j.matchPoints}</td>
      <td>${(j.matchWinPerc * 100).toFixed(1)}%</td>
      <td>${(j.gameWinPerc * 100).toFixed(1)}%</td>
      <td>${(j.omwp * 100).toFixed(1)}%</td>
    </tr>`;
});

htmlRanking += `</tbody></table>`;
divDia.innerHTML += htmlRanking;




    container.appendChild(divDia);
  }

    // Descobre o último "dia" registrado
    const ultimoDia = Math.max(...jogos.map(j => j.dia));

    // Jogos até o PENÚLTIMO dia (para comparar posição)
    const jogosAtePenultimo = jogos.filter(j => j.dia < ultimoDia);
  
    // Calcula ranking anterior e cria um mapa jogador -> posição anterior (1-based)
    const rankingAnterior = calcularRankingArray(jogosAtePenultimo);
    const posAnteriorMap = new Map(rankingAnterior.map((e, i) => [e.jogador, i + 1]));
  
    // Gera o ranking atual com informações de mudança de posição
    gerarRanking(jogos, posAnteriorMap);
    atualizarGraficoEvolucao(jogos);   // 👈 NOVO
  }
  
  function gerarRanking(jogos, posAnteriorMap = null) {
    // guarda pontos + estatísticas por jogador
    const statsPorJogador = {};
    const currentWinStreak = {}; // streak atual de vitórias
    const currentLoseStreak = {}; // novo streak de derrotas
    const pontosPorDiaPorJogador = {}; // pontos acumulados por dia para cada jogador


  
    function ensureJogador(nome) {
      if (!statsPorJogador[nome]) {
        statsPorJogador[nome] = {
          pontos: 0,
          vitorias: 0,
          derrotas: 0,
          empates: 0,
          matchesJogos: 0,
          gamesVencidos: 0,
          gamesPerdidos: 0,
          gamesJogos: 0,
          oponentes: new Set()
        };
      }
      if (currentWinStreak[nome] == null) {
        currentWinStreak[nome] = 0;
      }
      if (currentLoseStreak[nome] == null) {   // 👈 NOVO
        currentLoseStreak[nome] = 0; 
      }

      if (!pontosPorDiaPorJogador[nome]) {
        pontosPorDiaPorJogador[nome] = {};
      }
    }

    // NOVO: soma pontos de um jogador em um determinado dia
    function adicionarPontosNoDia(nome, dia, pontos) {
      const mapa = pontosPorDiaPorJogador[nome];
      mapa[dia] = (mapa[dia] || 0) + pontos;
    }



  
    
  
    // 1) percorre todos os jogos da liga e acumula stats + streak atual
    jogos.forEach(jogo => {
      const [g1, g2] = jogo.resultado.split(" x ").map(Number);
      const j1 = jogo.jogador1;
      const j2 = jogo.jogador2;
      const dia = jogo.dia;   // 👈 NOVO
  
      ensureJogador(j1);
      ensureJogador(j2);
  
      const s1 = statsPorJogador[j1];
      const s2 = statsPorJogador[j2];
  
      // matches jogados
      s1.matchesJogos++;
      s2.matchesJogos++;
  
      // games (para Game Win %)
      s1.gamesVencidos += g1;
      s1.gamesPerdidos += g2;
      s1.gamesJogos += g1 + g2;
  
      s2.gamesVencidos += g2;
      s2.gamesPerdidos += g1;
      s2.gamesJogos += g1 + g2;
  
      // oponentes (para OMWP)
      s1.oponentes.add(j2);
      s2.oponentes.add(j1);
  
      // pontos, V–D–E e streak
      if (g1 > g2) {
        // pontos e V/D/E
        s1.pontos += 3;
        s1.vitorias++;
        s2.derrotas++;

      // NOVO: pontos por dia
      adicionarPontosNoDia(j1, dia, 3);
      adicionarPontosNoDia(j2, dia, 0);
  
        // streak de vitórias
        currentWinStreak[j1] = (currentWinStreak[j1] || 0) + 1;
        currentWinStreak[j2] = 0;
  
        // streak de derrotas
        currentLoseStreak[j1] = 0;
        currentLoseStreak[j2] = (currentLoseStreak[j2] || 0) + 1;
  
      } else if (g1 < g2) {
        // pontos e V/D/E
        s2.pontos += 3;
        s2.vitorias++;
        s1.derrotas++;

      // NOVO: pontos por dia
      adicionarPontosNoDia(j2, dia, 3);
      adicionarPontosNoDia(j1, dia, 0);


  
        // streak de vitórias
        currentWinStreak[j2] = (currentWinStreak[j2] || 0) + 1;
        currentWinStreak[j1] = 0;
  
        // streak de derrotas
        currentLoseStreak[j2] = 0;
        currentLoseStreak[j1] = (currentLoseStreak[j1] || 0) + 1;
  
      } else {
        // pontos e V/D/E
        s1.pontos += 1;
        s2.pontos += 1;
        s1.empates++;
        s2.empates++;

      // NOVO: empate conta 1 ponto em cada dia
      adicionarPontosNoDia(j1, dia, 1);
      adicionarPontosNoDia(j2, dia, 1);
  
        // empate quebra qualquer streak
        currentWinStreak[j1] = 0;
        currentWinStreak[j2] = 0;
        currentLoseStreak[j1] = 0;
        currentLoseStreak[j2] = 0;
      }
    });
  
    const jogadores = Object.keys(statsPorJogador);
  
    // 2) Match Win % e Game Win %
    jogadores.forEach(nome => {
      const s = statsPorJogador[nome];
      const mJ = s.matchesJogos;
      const gJ = s.gamesJogos;
  
      s.matchWinPerc = mJ > 0 ? (s.vitorias + 0.5 * s.empates) / mJ : 0;
      s.gameWinPerc  = gJ > 0 ? s.gamesVencidos / gJ : 0;
    });

    // 3) Calcula lista de dias da liga para usar no cálculo de pontos válidos
    
    const diasLigaSet = new Set();
        Object.values(pontosPorDiaPorJogador).forEach(mapa => {
          Object.keys(mapa).forEach(diaStr => {
            diasLigaSet.add(Number(diaStr));
          });
        });
        const diasLiga = Array.from(diasLigaSet).sort((a, b) => a - b);
    




  
    // 3) OMWP (média do Match Win % dos oponentes, com floor 33%)
    jogadores.forEach(nome => {
      const s = statsPorJogador[nome];
      const oponentes = Array.from(s.oponentes);
  
      if (oponentes.length === 0) {
        s.omwp = 0;
        return;
      }
  
      let soma = 0;
      oponentes.forEach(opp => {
        let mw = statsPorJogador[opp]?.matchWinPerc || 0;
        if (mw < 1 / 3) mw = 1 / 3;
        soma += mw;
      });
  
      s.omwp = soma / oponentes.length;
    });
  
    // 4) monta ranking com stats e streak
    const ranking = Object.entries(statsPorJogador)
      .map(([jogador, s]) => {
        const pontosDiasMap = pontosPorDiaPorJogador[jogador] || {};
  
        // por padrão, pontos válidos = total
        let pontosValidos = s.pontos;
  
        // Na Liga 2, pontos válidos consideram TODOS os dias da liga,
        // usando 0 para dias em que o jogador não jogou
        if (usaRegraPontosValidos() && diasLiga.length > 1) {
          const pontosDias = diasLiga.map(dia => pontosDiasMap[dia] || 0);
  
          if (pontosDias.length > 1) {
              const piorDia = Math.min(...pontosDias);
              const totalDias = pontosDias.reduce((acc, v) => acc + v, 0);
              pontosValidos = totalDias - piorDia;
            }
          }
  
          return {
            jogador,
            pontos: s.pontos,            // total
            pontosValidos,               // já com pior dia descartado na Liga 2
            vitorias: s.vitorias,
            derrotas: s.derrotas,
            empates: s.empates,
            matchWinPerc: s.matchWinPerc || 0,
            gameWinPerc: s.gameWinPerc || 0,
            omwp: s.omwp || 0,
            streakVitorias: currentWinStreak[jogador] || 0,
            streakDerrotas: currentLoseStreak[jogador] || 0
    };
  })
  

    .filter(entry => jogadorEhVisivel(entry.jogador)) // ✅ remove BYE + ocultos


    .sort((a, b) => {
      const usaPontosValidos = usaRegraPontosValidos(); // a partir Liga 2 usa essa regra

      if (usaPontosValidos) {
        if (b.pontosValidos !== a.pontosValidos) {
          return b.pontosValidos - a.pontosValidos;
        }
      } else {
        if (b.pontos !== a.pontos) {
          return b.pontos - a.pontos;
        }
      }

      // se empatar na regra principal, usa os mesmos critérios antigos:
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.matchWinPerc !== a.matchWinPerc) return b.matchWinPerc - a.matchWinPerc;
      if (b.gameWinPerc !== a.gameWinPerc) return b.gameWinPerc - a.gameWinPerc;
      if (b.omwp !== a.omwp) return b.omwp - a.omwp;
      return a.jogador.localeCompare(b.jogador, 'pt-BR');
    });

    
    renderizarPontosPorDia(pontosPorDiaPorJogador);




  
    const corpo = document.getElementById('tabela-ranking');
    corpo.innerHTML = '';
  
    ranking.forEach((entry, i) => {
      const tr = document.createElement('tr');
  
      // avatar
      const nomeImagem = `avatar_${entry.jogador.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s/g, "")}`;
  
      const imgHTML =
        `<img src="img/${nomeImagem}.jpg" ` +
        `onerror="this.onerror=null;this.src='img/avatar_padrao.jpg';" ` +
        `alt="${entry.jogador}" class="avatar">`;
  
      // variação de posição
      let indicadorHTML = `<span class="delta neutro" title="sem variação">•</span>`;
      if (posAnteriorMap && posAnteriorMap.has(entry.jogador)) {
        const posAnterior = posAnteriorMap.get(entry.jogador);
        const posAtual = i + 1;
        const delta = posAnterior - posAtual;
        const abs = Math.abs(delta);
  
        if (delta > 0) {
          indicadorHTML = `
            <span class="delta up" title="+${abs} posição(ões)">
              ▲
              <span class="delta-num">${abs}</span>
            </span>`;
        } else if (delta < 0) {
          indicadorHTML = `
            <span class="delta down" title="-${abs} posição(ões)">
              ▼
              <span class="delta-num">${abs}</span>
            </span>`;
        } else {
          indicadorHTML = `
            <span class="delta same" title="sem variação">
              —
              <span class="delta-num">0</span>
            </span>`;
        }
      }
  
      
    // ícones extra: líder + streaks de vitória + streaks de derrota
    let iconsHTML = '';

    // líder da liga
    if (i === 0) {
      iconsHTML += `
        <span class="icon-badge icon-leader"
              data-tooltip="Líder da Liga">
          👑
        </span>`;
    }

    // 3+ vitórias seguidas → raio
    if (entry.streakVitorias >= 3) {
      iconsHTML += `
        <span class="icon-badge icon-streak"
              data-tooltip="${entry.streakVitorias} vitórias seguidas">
          ⚡
        </span>`;
    }

    // 6+ vitórias seguidas → foguete
    if (entry.streakVitorias >= 6) {
      iconsHTML += `
        <span class="icon-badge icon-rocket"
              data-tooltip="${entry.streakVitorias} vitórias seguidas (Sequência INCRÍVEL!)">
          🚀
        </span>`;
    }

    // 10+ vitórias seguidas → explosão lendária
    if (entry.streakVitorias >= 10) {
      iconsHTML += `
        <span class="icon-badge icon-explosion"
              data-tooltip="${entry.streakVitorias} vitórias seguidas (Sequência LENDÁRIA!)">
          💥
        </span>`;
    }

    // 3+ derrotas seguidas → pato
    if (entry.streakDerrotas >= 3) {
      iconsHTML += `
        <span class="icon-badge icon-duck"
              data-tooltip="${entry.streakDerrotas} derrotas seguidas (Modo pato 🦆)">
          🦆
        </span>`;
    }

    // 6+ derrotas seguidas → cocô
    if (entry.streakDerrotas >= 6) {
      iconsHTML += `
        <span class="icon-badge icon-poop"
              data-tooltip="${entry.streakDerrotas} derrotas seguidas (Situação CRÍTICA 💩)">
          💩
        </span>`;
    }

  
      // campanha V–D–E
      const tooltipCamp =
        `${entry.vitorias} vitórias, ${entry.derrotas} derrotas, ${entry.empates} empates`;
  
      const campanha = `
        <span class="campanha-wrapper" title="${tooltipCamp}">
          <span class="camp-v">${entry.vitorias}</span>–
          <span class="camp-d">${entry.derrotas}</span>–
          <span class="camp-e">${entry.empates}</span>
        </span>
      `;
  
      // MW–GW–OM
      const mw = (entry.matchWinPerc * 100).toFixed(1);
      const gw = (entry.gameWinPerc * 100).toFixed(1);
      const om = (entry.omwp * 100).toFixed(1);
  
      const tooltipTB =
        `Match Win %: ${mw}% | Game Win %: ${gw}% | OMWP: ${om}%`;
  
      const tiebreaks = `
        <span class="tb-wrapper" title="${tooltipTB}">
          <span class="tb-mw">${mw}</span>–
          <span class="tb-gw">${gw}</span>–
          <span class="tb-om">${om}</span>
        </span>
      `;
  
      tr.innerHTML = `
      <td><span class="posicao">${i + 1}º</span> ${indicadorHTML}</td>
      <td class="td-nome">${imgHTML}<span>${entry.jogador}</span>${iconsHTML}</td>
      <td class="pontos-validos">${entry.pontosValidos}</td>
      <td>${entry.pontos}</td>
      <td class="campanha-cell">${campanha}</td>
      <td class="tb-cell">${tiebreaks}</td>
    `;
    
  
      corpo.appendChild(tr);
    });
  }
  
  
  


initPagina();




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
  const nome = document.getElementById("filtro-jogador").value;
  if (!nome) return;
  fetch("jogos.json")
    .then(res => res.json())
    .then(jogos => {
      const jogosDaLiga = jogos.filter(jogo => (jogo.liga || 1) === ligaAtualId);
      filtrarJogosPorJogador(nome, jogosDaLiga);
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


