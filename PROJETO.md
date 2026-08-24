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
├── index.html              → Página da liga ativa (Liga 4 atualmente)
├── liga1.html              → Página histórica da Liga 1 (encerrada)
├── liga2.html              → Página histórica da Liga 2 (encerrada)
├── liga3.html              → Página histórica da Liga 3 (encerrada)
├── historico.html          → Página de listagem de temporadas anteriores
├── bookLiga1.html          → eBook da 1ª Liga (PDF embutido)
├── novo-torneio-V6.html    → Ferramenta de geração de dias de competição
│
├── mtr.js                  → Núcleo de cálculo do MTR Appendix C (fonte única)
├── pareamento.js           → Motor de pareamento suíço (faixas + backtracking)
│
├── main.js                 → Lógica da liga ATIVA (evolui livremente)
├── main-liga1.js           → Snapshot congelado da Liga 1 (NÃO EDITAR)
├── main-liga2.js           → Snapshot congelado da Liga 2 (NÃO EDITAR)
├── main-liga3.js           → Snapshot congelado da Liga 3 (NÃO EDITAR)
├── appendix_c.js           → Ranking do dia da liga ativa (delega ao mtr.js)
├── appendix_c-encerradas.js→ Snapshot congelado usado por liga1/2/3 (NÃO EDITAR)
├── carta-do-dia.js         → Integração com API Scryfall
│
├── tests/run.js            → Suíte de validação (node tests/run.js)
├── tests/integracao-torneio.js → Roda a ferramenta de torneio ponta a ponta
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
    ├── fundo.jpg           → Fundo da liga ativa (Liga 4, provisório)
    ├── fundo-liga1.jpg     → Fundo específico da Liga 1
    ├── fundo-liga2.jpg     → Fundo específico da Liga 2
    ├── fundo-liga3.jpg     → Fundo específico da Liga 3 (Marvel Super Heroes)
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
- `resultado`: sempre no formato `"N x N"` com espaços (importante para o split) — são os
  games **vencidos** por cada lado
- `jogador2` pode ser `"Bye"` em casos de número ímpar de jogadores
- `gamesEmpatados` (opcional): número de games que terminaram empatados na partida. Vale 1
  game point cada, contra 3 do game vencido. Ausente = 0, então todas as linhas antigas
  seguem válidas. Um match 2-0-1 fica
  `{ ..., "resultado": "2 x 0", ..., "gamesEmpatados": 1 }` — 7 game points em 3 games

### `ligas.json`
```json
[
  { "id": 1, "nome": "Liga Supermarket - Temporada 1", "ano": 2025 },
  { "id": 2, "nome": "Liga Supermarket - Temporada 2", "ano": 2026 },
  { "id": 3, "nome": "Liga Supermarket - Temporada 3", "ano": 2026 },
  { "id": 4, "nome": "Liga Supermarket - Temporada 4", "ano": 2026 }
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
- Controlado pela função `usaRegraPontosValidos()` que retorna `true` para ligas 2, 3 e 4
- A coluna "Pontos válidos" mostra pontos totais menos o pior dia

### Critérios de desempate do ranking geral (em ordem)
1. Pontos válidos (ou pontos totais na Liga 1)
2. Match Win % (MWP)
3. Game Win % (GWP)
4. OMWP (Opponents' Match Win Percentage)
5. Pontos totais
6. Ordem alfabética

### Desempate oficial de um DIA de competição (MTR Appendix C)
Ordem obrigatória, implementada em `mtr.js` → `compararMTR()`:
**Match Points → OMW% → GW% → OGW%**

### Regras do Appendix C — todas em `mtr.js`
Desde a auditoria de 24/08/2026 existe **uma única implementação** desses cálculos.
Nunca reimplemente esta matemática em outro arquivo — `main.js`, `appendix_c.js` e
`novo-torneio-V6.html` todos chamam o `mtr.js`.

- Match points: vitória 3, empate 1, derrota 0
- Game points: game ganho 3, game empatado 1, game perdido 0
- **MW% = match points / (3 × rodadas)** — um empate vale **1/3** de vitória, não 1/2
- **GW% = game points / (3 × games)**
- **Piso de 0.33 — onde vale e onde não vale:**
  - **Vale** no cálculo dos oponentes (OMW%/OGW%) e no **critério oficial de desempate**:
    `compararMTR` aplica o piso ao GW% internamente, então dois jogadores com 25% e 30%
    empatam nesse critério e a decisão segue para o OGW%
  - **Não vale** no ranking da temporada, que usa o esquema próprio da liga (pontos válidos
    primeiro) e não a ordem do MTR. Ali entram `matchWinPctRaw`/`gameWinPctRaw`, porque com
    o piso todos abaixo de 33% empatariam e o critério perderia poder de desempate
  - `classificar()` devolve os dois: `gameWinPerc` (cru, para exibir) e `gameWinPercPiso`

### As três funções de comparação — use sempre uma delas
```
MTR.compararCriterios(a, b)          // MP -> OMW% -> GW%(piso) -> OGW%; 0 se empatar tudo
MTR.compararMTR(a, b)                // igual, + nome como último desempate (apresentação)
MTR.estaoEmpatadosNosCriterios(a, b) // true quando os quatro critérios empatam
```
**Nunca reconstruir essa ordem em outro arquivo.** Foi exatamente assim que o piso do GW%
ficou de fora do pareamento: `compararMTR` já tinha o piso, mas o `novo-torneio-V6.html`
mantinha um `sort` próprio com o valor bruto, alterando a ordem do pareamento e **quem
recebia o BYE** (`escolherBye` lê essa lista de trás para frente).
Quem pareia usa `compararCriterios` (devolve 0 no empate, preservando o sorteio prévio);
quem exibe usa `compararMTR`.
- **Bye = vitória 2×0**: 3 match points, 6 game points, 2 games, 1 rodada. O bye
  **nunca entra como adversário** no OMW%/OGW% (regra explícita do MTR)
- Adversário enfrentado duas vezes conta **duas vezes** na média (não deduplicar)

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
- `ligaAtualId`: número da liga selecionada (inicia em 4)
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
- `body.liga-3` → `img/fundo-liga3.jpg`

### Classes de body por contexto
- `liga-atual` → index.html (liga ativa)
- `liga-1-historico` → liga1.html
- `liga-2-historico` → liga2.html
- `liga-3-historico` → liga3.html
- `pagina-historico` → historico.html

**Atenção à ordem no CSS:** as regras `body.liga-N::before` e `body.liga-N-historico::before`
têm a mesma especificidade. As regras `-historico` precisam ficar **depois** no arquivo para
vencer, porque o `main-ligaN.js` adiciona a classe `liga-N` no body além da classe `-historico`
que já vem do HTML.

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
- [x] ~~Quando a Liga 3 encerrar: criar snapshot da Liga 3 e apontar o `main.js` para a Liga 4~~
      — feito em 23/08/2026 (ver seção 12)
- [ ] Considerar mover dados do pódio do HTML para o JSON
- [ ] Trocar `img/fundo.jpg` por um `img/fundo-liga4.jpg` com a arte da coleção da Liga 4
- [x] ~~Atualizar o set da Carta do Dia para a coleção da Liga 4~~ — feito em 23/08/2026
      (`set:hob`, The Hobbit)

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
Controlada pela variável `ligaAtualId = 4` no topo do `main.js`. Quando iniciar a Liga 5,
seguir o checklist de encerramento da seção 12.

---

## 11. Contexto da liga (para referência)

- **Liga 1** (2025): encerrada. Campeão Magno, vice Nagib, 3º Sérgio. 12 dias de competição.
- **Liga 2** (2026): encerrada. Campeão Magno, vice Stenio, 3º Sérgio. 7 dias. Primeira liga com descarte do pior dia.
- **Liga 3** (2026): encerrada. Campeão Magno, vice Flavio, 3º Eduardo. 6 dias, de 30/03/2026 (Chaos Draft Lorwyn/Turtles/Foundations) a 05/07/2026 (Draft Marvel Super Heroes).
- **Liga 4** (2026): **em andamento**. Nenhum dia registrado até o momento.

Jogadores regulares: Pablo, Magno, Nagib, Joca, Stenio, Marcelo, Qiu, Alex, Eduardo, Subzero, Vini, Igor, Sérgio, Will, Gabriel, Jun, Pedro, Rates, Caio, Marcos, Nick, Flavio, Bruno Novaes.

---

## 12. Checklist de encerramento de liga

Procedimento executado ao encerrar a Liga 3 e abrir a Liga 4 (23/08/2026). Repetir na Liga 5.
A ideia central: **o histórico nunca é recalculado a partir do código da liga ativa** — cada
temporada encerrada tem o seu par `ligaN.html` + `main-ligaN.js` congelado.

### Como o congelamento funciona (padrão adotado)

Os dados **não** são duplicados: `jogos.json` continua guardando todas as ligas, e cada página
histórica filtra pelo campo `liga`. O que congela é o **código e o HTML**:

- `ligaN.html` → `<body class="liga-N-historico">`, pódio hardcoded, `<script src="main-ligaN.js">`
- `main-ligaN.js` → cópia do `main.js` do dia do encerramento, com `ligaAtualId = N`

**Regra de ouro:** nunca editar linhas com `"liga": N` no `jogos.json` de uma liga encerrada,
nem editar `ligaN.html` / `main-ligaN.js`. É daí que vem a imutabilidade.

Descartadas duas alternativas mais pesadas: um `jogos-ligaN.json` separado (duplicaria dados) e
uma pasta autocontida por liga (é o que existe em `Liga-1-Finalizada/`, que hoje nem está
linkada no site).

### Passo a passo

**A. Congelar a liga que terminou (liga N)**
1. Copiar `main.js` → `main-ligaN.js`, trocar `ligaAtualId` para `N` e ajustar a manipulação de
   classe de body (o snapshot não precisa da lógica de `liga-atual`)
2. Copiar `index.html` → `ligaN.html`: `<body class="liga-N-historico">`, subtítulo
   `.subtitulo-liga-historica`, apontar o `<script>` para `main-ligaN.js`, remover as seções que
   só fazem sentido na liga ativa (Carta do Dia, botão "Gerar Novo Dia")
3. Manter no `ligaN.html` o bloco `<section class="podio-temporada">` com os 3 primeiros
4. Adicionar em `style2.css` a regra `body.liga-N-historico::before` — **depois** da regra
   `body.liga-N::before`, por causa da ordem/especificidade (ver seção 6)
5. Adicionar o card da temporada em `historico.html` (`.liga-card` com campeão, vice e 3º)

**B. Abrir a liga nova (liga N+1)**
6. `ligas.json`: acrescentar `{ "id": N+1, "nome": "...", "ano": ... }`
7. `main.js`: `ligaAtualId = N+1`; incluir `N+1` no array de `usaRegraPontosValidos()`; incluir
   `"liga-N"` na lista de `classList.remove(...)` e trocar o ternário para `ligaAtualId === N+1`;
   abrir a chave `N+1: { }` em `infoPorLiga`
8. `index.html`: atualizar `<h1>`, trocar o subtítulo para "temporada em andamento",
   **remover o bloco do pódio** (já preservado no `ligaN.html`) e corrigir a nota da seção
   "Pontos por Dia" para citar a liga certa
9. `style2.css`: apontar `body.liga-atual::before` para o fundo da nova liga
10. `carta-do-dia.js`: trocar o código do set no `set:xxx` da URL do Scryfall
11. Atualizar este documento: seções 2, 4, 5, 6, 10 e 11

### Como validar sem subir nada

Rodar o ranking de cada liga em Node com um stub de DOM e conferir se o top 3 calculado bate com
o pódio hardcoded no HTML. No encerramento da Liga 3 os quatro arquivos foram conferidos assim:

| Arquivo | Liga | Jogos | Top 3 calculado |
|---|---|---|---|
| `main-liga1.js` | 1 | 264 | Magno, Nagib, Sérgio |
| `main-liga2.js` | 2 | 209 | Magno, Stenio, Sérgio |
| `main-liga3.js` | 3 | 184 | Magno, Flavio, Eduardo |
| `main.js` | 4 | 0 | (sem jogos — página vazia, sem erro) |

Uma liga recém-aberta e ainda sem jogos **não quebra** a página: `Math.max(...)` de array vazio
devolve `-Infinity`, `calcularRankingArray([])` devolve `[]` e o gráfico tem guarda para lista
vazia. Ranking e gráfico simplesmente aparecem vazios até o Dia 1 ser lançado.

---

## 13. Como lançar um dia de competição

0. **Antes de um dia oficial, rodar `node tests/run.js`** — tem de dar 119 passaram, 0 falharam
1. Abrir `novo-torneio-V6.html` e preencher o campo **"liga"** com o número da liga ativa
2. Rodar o torneio suíço; ao final a ferramenta gera o JSON no formato de uma linha por jogo
3. Colar as linhas **no fim** do `jogos.json`, antes do `]`, sem tocar nas linhas das ligas encerradas
   (as linhas de Bye **já vêm no export** — não precisa mais acrescentar na mão)
4. Adicionar o dia em `infoPorLiga[liga ativa]` no `main.js`: `N: { data: "DD/MM/AAAA", draft: "..." }`
5. Jogador novo: acrescentar em `jogadores.json` com o nome **exatamente** igual ao do `jogos.json`.
   Se for jogador eventual que não deve pontuar no ranking, acrescentar em `jogadoresOcultos` no `main.js`

**"Corrigir Placares"** só funciona na rodada atual, e apenas enquanto nenhuma rodada
posterior tiver sido gerada. Ela corrige **resultados**, nunca refaz um pareamento — erro de
pareamento deve ser percebido antes de a rodada ser jogada, e o caminho ali é não finalizar
a rodada.

Se a ferramenta exibir o aviso amarelo **"Não existe pareamento sem repetição nesta rodada"**,
não é bug: os jogadores já se enfrentaram o suficiente para esgotar as combinações. O sistema
mostra quais confrontos se repetem para você decidir se aceita ou ajusta manualmente.

---

## 14. Auditoria do gerador de torneios (24/08/2026)

O sistema foi auditado contra o **MTR Appendix C**. Foram encontrados e corrigidos 16 problemas.
Os quatro mais graves:

1. **Pareamento repetia confrontos em silêncio.** O algoritmo guloso não tinha backtracking:
   em 48% dos torneios de 6 jogadores × 4 rodadas ele gerava uma repetição que era evitável
   (medido contra busca exaustiva). Substituído por `pareamento.js` — hoje 0%.
2. **O mesmo jogador podia receber vários byes.** Agora o bye vai para o pior colocado
   **que ainda não folgou**.
3. **Pareamento manual com linha vazia gravava o placar no jogo errado.** Os inputs eram
   lidos pelo índice do array de confrontos, não pela linha da tabela. Corrigido com `slot`.
4. **A exportação descartava as linhas de Bye**, que o `jogos.json` precisa para contar a
   rodada no MW% do jogador.

E os erros de cálculo: o Bye entrava como adversário no OMW% (o MTR manda ignorar), o empate
valia 1/2 de vitória no MW% em vez de 1/3, o desempate parava no OMW% (faltavam GW% e OGW%),
adversários repetidos eram deduplicados, e havia **quatro implementações divergentes** da
mesma matemática — hoje unificadas em `mtr.js`.

### O que a suíte de testes cobre

`node tests/run.js` (roda em menos de 1 segundo, sem dependências):

- **MTR Appendix C**: os exemplos numéricos do próprio documento viram asserção, inclusive
  os dois cálculos de OMW% de 8 rodadas (0.62 e 0.63) e o caso com bye
- **Pareamento**: ~11.700 rodadas sorteadas, conferindo contra busca exaustiva que nenhuma
  repetição evitável acontece, que ninguém recebe dois byes e que toda rodada é bem formada
- **Integração**: 40 torneios completos rodados de verdade na ferramenta (com DOM simulado),
  conferindo histórico espelhado, uma partida por rodada e o formato do JSON exportado
- **Regressão**: os campeões das Ligas 1, 2 e 3 recalculados a partir do `jogos.json`

### Ligas encerradas

Os números publicados das Ligas 1-3 **não mudaram**: `liga1/2/3.html` carregam
`appendix_c-encerradas.js` (snapshot congelado) e `main-liga1/2/3.js`, nenhum deles tocado
pela auditoria. As correções valem da Liga 4 em diante.

---

## 15. Segunda rodada de correções (24/08/2026)

Fechamento dos pontos que restaram da primeira auditoria.

1. **Piso de 33% no critério oficial.** `compararMTR` aplica o piso ao GW% internamente —
   assim a regra vale para todos os chamadores, inclusive quem monta a linha à mão.
2. **Rodada manual passou a registrar os confrontos.** Antes só o caminho automático
   alimentava `confrontosAnteriores`, então um confronto feito manualmente era invisível
   para o pareamento das rodadas seguintes e podia se repetir.
3. **Validação de completude na rodada manual.** Cada jogador tem de aparecer exatamente
   uma vez; número par sem BYE, ímpar com exatamente um. A mensagem de erro **nomeia** quem
   ficou de fora.
4. **BYE manual completo e finalização atômica.** O BYE respeita a regra de um por jogador
   por torneio. E o fluxo virou *ler → validar → aplicar*: antes o BYE gravava pontos e
   histórico **durante** a validação, então um erro numa linha posterior deixava o estado
   sujo e um novo clique em "Finalizar" duplicava o BYE.
5. **Reabertura restrita à última rodada finalizada.** Mudar uma rodada antiga alteraria a
   classificação que gerou os pareamentos das seguintes. O botão some das rodadas antigas.
6. **Game draws** via campo opcional `gamesEmpatados` (ver seção 3), com uma coluna extra
   na ferramenta que só aparece se o organizador marcar "Registrar empates de game".
7. **Exportação virou função pura** (`montarJogosExportados`), chamada tanto pela interface
   quanto pelos testes — antes o teste reimplementava a lógica e poderia passar com a função
   real quebrada.
8. **Recuperação do torneio.** O estado é salvo em `localStorage` a cada operação. Ao abrir
   a ferramenta com um torneio em andamento, ela oferece continuar; há botão para descartar.
   Os confrontos são salvos como nomes e **religados por referência** ao restaurar — salvar
   os objetos direto duplicaria cada jogador e os pontos parariam de acompanhar o histórico.

---

## 16. Terceira rodada de correções (24/08/2026)

Últimos ajustes antes de congelar a lógica.

1. **O piso do GW% não valia no pareamento.** `compararMTR` já aplicava o piso, mas o
   `ordenarJogadoresSuico` mantinha um `sort` próprio com o valor bruto. Como essa ordem
   alimenta `escolherBye`, o bug afetava também **quem recebia o BYE**. Criadas
   `compararCriterios` e `estaoEmpatadosNosCriterios`; não há mais comparador fora do `mtr.js`.
2. **Detecção de empate do campeão** passou a usar `estaoEmpatadosNosCriterios` em vez de
   comparar campo a campo (que não reconhecia 25% × 30% como empate no piso).
3. **Finalização manual totalmente transacional:** agora é
   *ler pares → validar → ler placares → validar → aplicar*. Antes o pareamento era aplicado
   antes da leitura dos placares, então um placar faltando na última linha já deixava BYE,
   pontos, histórico e `confrontosAnteriores` gravados.
4. **Reabertura com guarda de domínio:** exige `rodada === ultimaRodadaFinalizada` **e**
   `rodada === rodadaAtual`. Antes a regra valia só na interface (o botão sumia), mas a função
   aceitaria a chamada direta.
5. **Recuperação de rodada em andamento.** Passou a existir `estadoRodadas[n]`
   (`gerada` / `manual` / `finalizada` / `corrigindo`) e um rascunho por rodada com o que já
   foi digitado, salvo nos eventos `change`. Na volta, cada rodada é redesenhada conforme o
   seu estado e **a próxima só é oferecida se a atual estiver finalizada**. Antes uma rodada
   manual apenas gerada **desaparecia** na recarga — ela só entra em `resultadosPorRodada` na
   finalização, e `rodadaAtual` já tinha sido incrementado.
6. **"Reabrir Rodada" virou "Corrigir Placares"** (`corrigirPlacares` / `finalizarCorrecao`),
   descrevendo o que a função de fato faz.
7. **`gamesEmpatados` nos contadores brutos do `main.js`.** Esses campos não têm nenhum
   leitor hoje — os percentuais vêm todos do `mtr.js` —, então a correção é para consistência,
   não muda resultado algum.

### Sobre conformidade com a Wizards

A redação correta, que deve ser usada ao descrever a ferramenta:

> Motor de pareamento suíço baseado nas regras públicas do *Magic Tournament Rules*, com
> prevenção de rematches, BYE controlado e critérios oficiais do Appendix C. Validado contra
> os exemplos públicos do MTR e pela suíte de testes do projeto.

**Não afirmar** que o sistema reproduz o algoritmo do EventLink ou que é matematicamente
idêntico ao da Wizards: a implementação interna deles não é pública. O que temos é
conformidade com as regras publicadas no MTR, que é o que a suíte verifica.

---

*Documento gerado a partir da análise completa do código e das conversas de contexto do projeto. Atualizar sempre que decisões importantes forem tomadas.*
