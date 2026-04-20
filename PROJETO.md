# PROJETO.md — Liga Magic Supermarket
> Documento de contexto para uso com Claude (claude.ai ou extensão VS Code).
> Cole este arquivo no início de qualquer conversa antes de editar o código.

---

## 1. O que é este projeto

Site/sistema web estático para gerenciar e exibir informações da **Liga Magic Supermarket**, uma liga de Magic: The Gathering entre amigos. O sistema funciona como um ecossistema completo de liga: ranking, histórico de partidas, gráficos de evolução, sistema de pontuação por temporada, torneio com pareamento suíço e preservação histórica das temporadas encerradas.

**URL pública:** GitHub Pages (repositório: `pablodupret/LigaSupermarket`)  
**Stack:** HTML + CSS + JavaScript puro + JSON (sem framework, sem backend)  
**Ambiente de dev:** VS Code + Live Server (`127.0.0.1:5500`)

---

## 2. Estrutura de arquivos

```
/
├── index.html              → Página da liga ativa (Liga 3 atualmente)
├── liga1.html              → Página histórica da Liga 1 (encerrada)
├── liga2.html              → Página histórica da Liga 2 (encerrada)
├── historico.html          → Página de listagem de temporadas anteriores
├── bookLiga1.html          → eBook da 1ª Liga (PDF embutido)
├── novo-torneio-V6.html    → Ferramenta de geração de dias de competição
│
├── main.js                 → Lógica da liga ATIVA (evolui livremente)
├── main-liga1.js           → Snapshot congelado da Liga 1 (NÃO EDITAR)
├── main-liga2.js           → Snapshot congelado da Liga 2 (NÃO EDITAR)
├── appendix_c.js           → Lógica de ranking por dia (torneio suíço)
├── carta-do-dia.js         → Integração com API Scryfall
│
├── style2.css              → CSS principal (tema escuro/dourado)
│
├── jogadores.json          → Lista oficial de jogadores
├── jogos.json              → Todos os resultados de todas as ligas
├── ligas.json              → Definição das temporadas
│
└── img/                    → Avatares dos jogadores e imagens de fundo
    ├── avatar_[nome].jpg   → Ex: avatar_pablo.jpg, avatar_magno.jpg
    ├── avatar_padrao.jpg   → Fallback quando avatar não existe
    ├── fundo.jpg           → Fundo da liga ativa
    ├── fundo-liga1.jpg     → Fundo específico da Liga 1
    ├── fundo-liga2.jpg     → Fundo específico da Liga 2
    └── [ícones de mana]
```

---

## 3. Estrutura dos dados JSON

### `jogadores.json`
Array simples de strings com os nomes oficiais dos jogadores:
```json
["Pablo", "Magno", "Nagib", "Joca", "Stenio", ...]
```
**Regra crítica:** Os nomes aqui precisam bater EXATAMENTE com os nomes em `jogos.json`. Qualquer divergência quebra ranking, avatar e histórico silenciosamente.

### `jogos.json`
Array de objetos, um por partida:
```json
{ "liga": 3, "dia": 1, "rodada": 1, "jogador1": "Pablo", "resultado": "2 x 0", "jogador2": "Magno" }
```
- `liga`: número da temporada (1, 2, 3...)
- `dia`: número do dia de competição dentro da liga
- `rodada`: número da rodada dentro do dia
- `resultado`: sempre no formato `"N x N"` com espaços (importante para o split)
- `jogador2` pode ser `"Bye"` em casos de número ímpar de jogadores

### `ligas.json`
```json
[
  { "id": 1, "nome": "Liga Supermarket - Temporada 1", "ano": 2025 },
  { "id": 2, "nome": "Liga Supermarket - Temporada 2", "ano": 2026 },
  { "id": 3, "nome": "Liga Supermarket - Temporada 3", "ano": 2026 }
]
```

---

## 4. Regras de negócio — IMPORTANTE

### Pontuação base
- Vitória: **3 pontos**
- Empate: **1 ponto**
- Derrota: **0 pontos**

### Pontos válidos (Liga 2 em diante)
- Cada jogador tem seu **pior dia descartado** no cálculo final
- Dias em que o jogador não jogou contam como **zero** no descarte
- Controlado pela função `usaRegraPontosValidos()` que retorna `true` para ligas 2 e 3
- A coluna "Pontos válidos" mostra pontos totais menos o pior dia

### Critérios de desempate do ranking geral (em ordem)
1. Pontos válidos (ou pontos totais na Liga 1)
2. Match Win % (MWP)
3. Game Win % (GWP)
4. OMWP (Opponents' Match Win Percentage)
5. Pontos totais
6. Ordem alfabética

### OMWP — regra oficial
- Floor de 33% (0.333): nenhum jogador pode ter MWP abaixo de 1/3 no cálculo do OMWP dos adversários
- Calculado sobre todos os oponentes únicos enfrentados na liga inteira
- **Atenção:** o OMWP do ranking geral da liga é diferente do OMWP calculado no `appendix_c.js` (que é por dia, para o torneio suíço)

### Separação conceitual importante
O projeto tem dois sistemas de ranking que NÃO devem ser confundidos:
- **Ranking geral da liga** (`main.js` / `compararRanking()`): classifica a temporada toda
- **Ranking do dia** (`appendix_c.js` / `gerarRankingDoDia()`): ranking de um único dia de competição, usando critérios do torneio suíço oficial

### Jogadores ocultos
Lista em `main.js` (`jogadoresOcultos`): jogadores que aparecem em `jogos.json` mas NÃO devem aparecer no ranking, gráfico ou selects. Usada para jogadores eventuais ou de outras ligas.

### Bye
- Quando há número ímpar de jogadores, o pior colocado recebe Bye
- Bye equivale a vitória automática 2x0 para fins de pontuação
- Bye não aparece como jogador no ranking
- A lógica de Bye existe tanto no `main.js` quanto no `appendix_c.js`

---

## 5. Arquitetura do main.js

### Funções principais e suas responsabilidades

| Função | O que faz |
|---|---|
| `initPagina()` | Entry point: chama carregarLigas() e carregarJogos() |
| `carregarLigas()` | Lê ligas.json, monta o select de ligas (se existir na página) |
| `carregarJogos()` | Lê jogos.json, filtra pela liga ativa, chama gerarRanking() e atualizarGraficoEvolucao() |
| `calcularRankingArray(jogos)` | Calcula stats de todos os jogadores e retorna array ordenado — SEM renderização |
| `gerarRanking(jogos, posAnteriorMap)` | Calcula stats E renderiza a tabela HTML — mistura lógica e apresentação |
| `compararRanking(a, b)` | Função de ordenação com todos os critérios de desempate |
| `usaRegraPontosValidos()` | Retorna true se a liga atual usa descarte do pior dia |
| `atualizarGraficoEvolucao(jogos)` | Gera o gráfico de evolução de posições com Chart.js |
| `renderizarPontosPorDia()` | Monta a tabela de pontos por dia |
| `filtrarJogos()` | Filtro de estatísticas por jogador |
| `jogadorEhVisivel(nome)` | Helper: retorna false para Bye e jogadores ocultos |

### Variáveis globais
- `ligaAtualId`: número da liga selecionada (inicia em 3)
- `ligas`: array carregado do ligas.json
- `graficoEvolucao`: instância do Chart.js (necessário para destruir antes de recriar)

### Dados hardcoded no JS (ponto de melhoria futuro)
```javascript
const infoPorLiga = {
  1: { 1: { data: "15/06/2025", draft: "Draft Final Fantasy" }, ... },
  2: { 1: { data: "15/11/2025", draft: "Pre Release Avatar" }, ... },
  3: { 1: { data: "30/03/2026", draft: "Chaos Draft Lorwyn/Turtles/Foundations" } }
}
```
Esses dados deveriam estar no `ligas.json` futuramente, para que o organizador atualize sem mexer no código.

---

## 6. CSS — style2.css

### Variáveis de tema
```css
:root {
  --cor-borda: #FFD700;           /* dourado */
  --cor-texto-principal: #f5f5dc; /* bege claro */
  --cor-fundo-tabela: #2c2c2c;
  --accent: #f5d27a;
  --text: #f5f5f5;
}
```

### Fundo via pseudo-elemento
O fundo usa `body::before` com `position: fixed` para resolver problemas de `background-attachment: fixed` no iOS/Safari. Cada liga tem sua própria imagem de fundo ativada por classe no `<body>`:
- `body.liga-atual` → `img/fundo.jpg`
- `body.liga-1` → `img/fundo-liga1.jpg`
- `body.liga-2` → `img/fundo-liga2.jpg`

### Classes de body por contexto
- `liga-atual` → index.html (liga ativa)
- `liga-1-historico` → liga1.html
- `liga-2-historico` → liga2.html
- `pagina-historico` → historico.html

---

## 7. Avaliação técnica geral (resultado da análise completa)

### Nota geral: B+
Projeto sólido e bem acima da média para uma stack sem framework. Funciona corretamente, tem identidade visual forte, e resolve problemas reais. Os pontos negativos são típicos de crescimento orgânico.

### Pontos positivos
- Lógica de negócio correta: OMWP com floor 33%, descarte do pior dia, streaks de vitória/derrota
- Tema visual bem executado com variáveis CSS organizadas
- Tratamento defensivo: try/catch nas fetches, fallback de avatar, verificação de elementos antes de agir
- Funcionalidades ricas: gráfico de evolução, torneio suíço, carta do dia (Scryfall), animação de contagem, "carrasco e pato"
- Separação conceitual correta entre ranking da liga e ranking do torneio suíço

### Pontos negativos e débitos técnicos

**Bug visual imediato:**
- `liga1.html` exibe "Segunda Liga Finalizada 🏆" no pódio — deveria ser "Primeira Liga Finalizada". É um copy-paste esquecido de `liga2.html`.

**Meta viewport comentado:**
- `index.html` e `liga1.html` têm `<meta name="viewport">` comentado com a nota "REsponsivo para celular apagado". Isso desabilita responsividade mobile completamente. Precisa ser investigado e restaurado.

**Lógica de ranking duplicada:**
- `calcularRankingArray()` e `gerarRanking()` fazem cálculos muito parecidos no mesmo arquivo. A segunda mistura cálculo com renderização HTML (padrão "Fat Function"). A separação ideal seria: `calcularRankingArray()` só retorna dados, `gerarRanking()` só renderiza o que recebe.

**HTML repetido em múltiplas páginas:**
- `index.html`, `liga1.html`, `liga2.html` têm praticamente o mesmo HTML (header, tabela, gráfico, filtro). Qualquer mudança de layout precisa ser replicada manualmente.

**Dados hardcoded no JS:**
- Datas e tipos de draft dos dias de competição estão em `infoPorLiga` dentro do `main.js`. Deveriam estar no JSON para o organizador atualizar sem abrir código.

**Pódio e histórico hardcoded no HTML:**
- Os resultados do pódio em `historico.html` e nas páginas de liga estão escritos diretamente no HTML, não lidos dos dados.

---

## 8. Decisões de arquitetura já tomadas

### Sobre os arquivos main-ligaN.js
**Decisão:** Manter arquivos separados por liga, mas com nomenclatura clara de que estão encerrados.

**Convenção adotada:**
- `main-liga1-encerrada.js` → snapshot congelado, NUNCA editar
- `main-liga2-encerrada.js` → snapshot congelado, NUNCA editar
- `main.js` → liga ativa, evolui livremente

**Motivo:** A separação foi intencional para preservação histórica — uma mudança na liga ativa não pode quebrar o histórico de ligas anteriores. A duplicação é um custo aceitável dado esse benefício. A melhoria é apenas renomear para comunicar a intenção claramente.

**Ação pendente no VS Code:**
1. Renomear `main-liga1.js` → `main-liga1-encerrada.js`
2. Renomear `main-liga2.js` → `main-liga2-encerrada.js`
3. Atualizar o `<script src="...">` em `liga1.html` e `liga2.html`

### Sobre a separação lógica/apresentação
**Decisão:** Não refatorar agora — o sistema funciona. Mas qualquer feature nova que precise dos dados do ranking deve usar `calcularRankingArray()` e não duplicar a lógica de `gerarRanking()`.

---

## 9. Lista de ações pendentes (por prioridade)

### Urgente (resolve em minutos)
- [ ] Corrigir texto "Segunda Liga Finalizada" no pódio de `liga1.html` → trocar para "Primeira Liga Finalizada"

### Importante
- [ ] Investigar e restaurar `<meta name="viewport">` em `index.html` e `liga1.html`
- [ ] Renomear `main-liga1.js` → `main-liga1-encerrada.js` e atualizar referência em `liga1.html`
- [ ] Renomear `main-liga2.js` → `main-liga2-encerrada.js` e atualizar referência em `liga2.html`

### Médio prazo
- [ ] Mover `infoPorLiga` (datas e tipos de draft) do `main.js` para `ligas.json`
- [ ] Separar cálculo e renderização em `gerarRanking()`: função só renderiza, `calcularRankingArray()` só calcula
- [ ] Adicionar validação defensiva no `split(" x ")` de `calcularRankingArray()` (igual ao `parseResultado()` do appendix_c.js)

### Futuro / qualidade de vida
- [ ] Extrair o HTML repetido (header, tabela, filtro) para um componente ou template compartilhado
- [ ] Quando a Liga 3 encerrar: renomear `main.js` → `main-liga3-encerrada.js`, criar novo `main.js` para Liga 4
- [ ] Considerar mover dados do pódio do HTML para o JSON

---

## 10. Convenções e padrões do projeto

### Nomes de avatar
`avatar_[nome_sem_acento_sem_espaço_minusculo].jpg`
Ex: `avatar_sergio.jpg`, `avatar_brunonovaes.jpg`

A normalização é feita no JS:
```javascript
const nomeImagem = `avatar_${entry.jogador.toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s/g, "")}`;
```

### Formato de resultado
Sempre `"N x N"` com espaços. O split em `main.js` usa `" x "` com espaços. O `appendix_c.js` usa regex mais tolerante. Manter consistência no `jogos.json`.

### Bye
Registrado como `"Bye"` (com maiúscula). O código verifica `j === "Bye"` e `j.toLowerCase() !== "bye"` em diferentes lugares — manter sempre com maiúscula no JSON.

### Liga ativa
Controlada pela variável `ligaAtualId = 3` no topo do `main.js`. Quando iniciar Liga 4, atualizar para `4`.

---

## 11. Contexto da liga (para referência)

- **Liga 1** (2025): campeão Magno, vice Nagib. 12 dias de competição.
- **Liga 2** (2026): campeão Magno, vice Stenio, 3º Sérgio. 7 dias. Primeira liga com descarte do pior dia.
- **Liga 3** (2026): em andamento. 1 dia registrado até o momento (Chaos Draft Lorwyn/Turtles/Foundations, 30/03/2026).

Jogadores regulares: Pablo, Magno, Nagib, Joca, Stenio, Marcelo, Qiu, Alex, Eduardo, Subzero, Vini, Igor, Sérgio, Will, Gabriel, Jun, Pedro, Rates, Caio, Marcos, Nick, Flavio, Bruno Novaes.

---

*Documento gerado a partir da análise completa do código e das conversas de contexto do projeto. Atualizar sempre que decisões importantes forem tomadas.*
