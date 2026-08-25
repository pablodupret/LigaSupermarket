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
├── importar-resultados.js  → Importa um dia exportado para dentro do jogos.json
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
- [ ] Trocar os dois `resultado.split(" x ")` do `main.js` por `MTR.parsePlacar()`. Hoje a
      divergência de parsing é compensada por validação estrita no importador; o certo é
      eliminá-la na origem
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

```
1. node tests/run.js                          ← 307 passaram, 0 falharam
2. Realizar o torneio (rodadas sempre automáticas)
3. Finalizar a última rodada
4. Exportar Resultados (JSON)                 ← o botão só aparece agora
5. node importar-resultados.js <arquivo>          ← só valida
   node importar-resultados.js <arquivo> --apply ← grava
6. Atualizar infoPorLiga no main.js com a data e o nome do evento
7. Revisar o diff
8. Commit e push
```

**Detalhes de cada passo**

1. A suíte precisa passar inteira antes de um dia oficial.
2. Abrir `novo-torneio-V6.html`, preencher o campo **"liga"** com o número da liga ativa e
   gerar as rodadas. Não existe pareamento manual (ver seção 19).
4. O botão **"📤 Exportar Resultados (JSON)"** só existe quando a última rodada está
   finalizada — não há como exportar um torneio pela metade.

   Ao clicar, a ferramenta consulta o `jogos.json` e **sugere o próximo dia da liga**, já
   preenchido no campo:
   ```
   Liga 4
   Último dia publicado: Dia 2
   Próximo dia sugerido: Dia 3

   Informe o número do dia:  [ 3 ]
   ```
   O valor continua editável — o importador é a segunda barreira e recusa dia fora de
   sequência. Se a consulta falhar (página aberta via `file://`, rede, JSON inválido), o
   campo vem **vazio** e a ferramenta avisa: nunca chuta um número.
5. **O importador é seguro por padrão:** sem `--apply` ele apenas valida, e nenhum arquivo
   nem backup é criado. A gravação exige a flag explícita.
   ```
   node importar-resultados.js resultados_25-08-2026.json            # só valida
   node importar-resultados.js resultados_25-08-2026.json --apply    # grava
   ```
   As linhas de **Bye já vêm no export** — nada a acrescentar à mão.
6. `infoPorLiga[liga][dia] = { data: "DD/MM/AAAA", draft: "..." }` no `main.js`. O importador
   lembra disso ao final, mas **não** tenta adivinhar data nem nome do evento.
7. O diff deve ser puramente aditivo: as linhas novas, mais a vírgula na última linha antiga.
8. Jogador novo: acrescentar em `jogadores.json` com o nome **exatamente** igual ao do
   `jogos.json`. Se for jogador eventual que não deve pontuar, acrescentar em
   `jogadoresOcultos` no `main.js`.

### O que o importador recusa

- arquivo inexistente, JSON inválido, que não seja array, ou vazio
- **jogador que não esteja em `jogadores.json`**, com o nome exato — grafia, acento,
  capitalização e espaços contam. Jogador novo se cadastra primeiro; só depois os jogos dele
  entram no histórico. `"Bye"` é exceção e não precisa de cadastro
- **liga que não esteja em `ligas.json`** — para uma futura Liga 5, cadastre a temporada antes
- **cadastro ilegível**: se `jogadores.json` ou `ligas.json` estiver ausente, corrompido ou
  não for um array, a importação é cancelada. O importador é *fail closed* — nunca importa
  sem conseguir validar os cadastros
- campo obrigatório faltando, ou `liga`/`dia`/`rodada` que não sejam inteiros ≥ 1
- `resultado` fora do formato **`"N x N"` com espaços** (ver abaixo)
- `gamesEmpatados` que não seja inteiro ≥ 0
- mais de uma liga ou mais de um dia no mesmo arquivo
- **liga + dia já publicado** no `jogos.json`
- **dia fora de sequência**: exige `maiorDiaDaLiga + 1`, e Dia 1 para uma liga nova
- **mesma partida repetida** — a identidade é `liga + dia + rodada + par canônico`, então
  `A × B` e `B × A` são a mesma partida, e placares divergentes são conflito, não dois jogos
- **invariantes da rodada**: jogador duas vezes na mesma rodada; mais de um Bye; Bye fora de
  `jogador2`; Bye com resultado diferente de `2 x 0`; Bye com `gamesEmpatados`; rodadas que
  não vão de 1 a N sem lacunas

A escrita é **atômica** (arquivo temporário, validação, `rename`) e um backup
`jogos.backup-AAAAMMDD-HHMMSS.json` é criado antes de substituir — ignorado pelo Git, que é a
proteção real. Os registros existentes são preservados **byte a byte**: o importador acrescenta
ao texto em vez de reserializar o arquivo, porque 39 registros antigos têm as chaves em outra
ordem e seriam normalizados, poluindo o diff.

> Um `--allow-gap` pode ser criado no futuro para importar dias históricos fora de sequência.
> Hoje não existe, de propósito.

O exportador escreve os textos com `JSON.stringify`, então um nome com aspas ou barra
invertida não quebra o JSON gerado.

### As duas barreiras contra o dia errado

```
1. Exportador consulta o histórico e sugere o Dia correto
2. Usuário confirma (ou corrige)
3. JSON é exportado
4. Importador valida a continuidade de novo
5. --apply publica
```

A sugestão vem de `calcularProximoDia(jogos, liga)`, função pura e testável sem rede;
`consultarProximoDia()` só faz o `fetch` (com `cache: "no-store"`) e valida a resposta.
A filtragem usa `Number(jogo.liga || 1)`, a mesma convenção do site: registros históricos sem
o campo `liga` pertencem à Liga 1.

### Por que o `resultado` exige espaços

O `main.js` lê os jogos com `resultado.split(" x ")`. Um registro como `"2x0"` passaria no
`MTR.parsePlacar` (que é tolerante), mas faria o split devolver `NaN` e o ranking do site
quebrar **em silêncio**. Por isso o importador valida `/^\d+ x \d+$/`, mais estrito que o
parser do MTR.

**"Corrigir Placares"** só funciona na rodada atual, e apenas enquanto nenhuma rodada
posterior tiver sido gerada. Ela corrige **resultados**, nunca refaz um pareamento.

**Não existe regeração da mesma rodada, e isso é deliberado.** Se um pareamento parecer
errado, a contingência correta é: **não finalizar a rodada**, interromper o uso da ferramenta
e conferir o pareamento externamente antes de seguir. Finalizar uma rodada com pareamento
inválido é o que não tem volta — depois de finalizada, só os placares são corrigíveis.

Se a ferramenta exibir o aviso amarelo **"Não existe pareamento sem repetição nesta rodada"**,
não é bug: os jogadores já se enfrentaram o suficiente para esgotar as combinações. O sistema
mostra quais confrontos se repetem, para você saber o que está acontecendo.

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
3. **Finalização totalmente transacional:**
   *ler todos os placares → validar todos → aplicar a rodada inteira de uma vez*.
   Nenhuma mutação acontece antes de a rodada estar inteira válida — um placar faltando na
   última linha não deixa BYE, pontos nem histórico gravados pela metade.
4. **Reabertura com guarda de domínio:** exige `rodada === ultimaRodadaFinalizada` **e**
   `rodada === rodadaAtual`. Antes a regra valia só na interface (o botão sumia), mas a função
   aceitaria a chamada direta.
5. **Recuperação de rodada em andamento.** Passou a existir `estadoRodadas[n]`
   (`gerada` / `finalizada` / `corrigindo`) e um rascunho por rodada com o que já
   foi digitado, salvo nos eventos `change`. Na volta, cada rodada é redesenhada conforme o
   seu estado e **a próxima só é oferecida se a atual estiver finalizada**. Antes uma rodada
   manual apenas gerada **desaparecia** na recarga — ela só entra em `resultadosPorRodada` na
   finalização, e `rodadaAtual` já tinha sido incrementado.
6. **"Reabrir Rodada" virou "Corrigir Placares"** (`corrigirPlacares` / `finalizarCorrecao`),
   descrevendo o que a função de fato faz.
7. **`gamesEmpatados` nos contadores brutos do `main.js`.** Esses campos não têm nenhum
   leitor hoje — os percentuais vêm todos do `mtr.js` —, então a correção é para consistência,
   não muda resultado algum.

---

## 17. Fechamento da camada operacional (24/08/2026)

Últimos ajustes de autosave e UX antes do teste de mesa.

1. **Autosave durante "Corrigir Placares".** A tela de correção usa campos com sufixo `_r`,
   mas o autosave só procurava os IDs sem sufixo — nada digitado ali era salvo. Agora
   `sufixoCampos(rodada)` decide os IDs pelo estado da rodada.
2. **BYE no slot 0 matava o autosave da rodada inteira.** O laço parava no primeiro input
   ausente, e numa rodada automática de número ímpar o Bye ocupa o slot 0 e não tem campos.
   Resultado: com 7 jogadores, **nenhum** dos três placares era salvo. Agora
   `slotsDaRodada(rodada)` percorre os slots conhecidos e apenas ignora os de Bye.
3. **Bloqueio de nova rodada no domínio.** `podeGerarNovaRodada()` recusa enquanto a rodada
   atual estiver em `gerada` ou `corrigindo` — vale também para chamada direta pelo
   console. Entrar em correção remove os botões de próxima rodada na hora.
4. **Uma única representação da rodada.** A tabela de leitura sai ao entrar em correção e a de
   correção sai ao salvar, com a rodada redesenhada uma vez só. Os campos já abrem com o
   placar que está valendo, e há um aviso: *"Altera somente os resultados. Os confrontos
   permanecem os mesmos."*
5. **Falha de `localStorage` agora avisa na tela** (uma vez por sessão) em vez de só um
   `console.warn`. O torneio segue funcionando; o organizador é quem precisa saber que não há
   recuperação automática.
6. **Autosave em `input` com debounce de 250 ms** nos campos numéricos, além do `change` como
   rede de segurança. Fecha a janela de "digitei o placar e apertei ⌘R sem sair do campo".
   Selects continuam em `change`.

Os testes de autosave disparam **eventos reais** no harness (`addEventListener` /
`dispatchEvent` de verdade no DOM simulado), em vez de chamar `capturarRascunho()` na mão.

---

## 18. Correções vindas do teste real no Safari (24/08/2026)

O primeiro teste em navegador reprovou. Com 7 jogadores e a R1 em andamento, um ⌘R trouxe
os três placares vazios, e ainda apareceram "Ranking Atual" e "🏆 Campeão: Caio" no meio da
primeira rodada.

**Causa raiz do autosave — listeners por elemento.** Cada campo recebia o seu próprio
listener quando a rodada era desenhada. Qualquer re-render troca os elementos e leva os
listeners junto; bastava um caminho de renderização não religar para a rodada inteira ficar
sem autosave, em silêncio. Trocado por **delegação de evento no container**, instalada uma
única vez, em modo captura: funciona para qualquer campo, inclusive os criados depois.
Também saiu o debounce (gravação imediata, nada assíncrono) e entrou flush em `pagehide` e
`beforeunload`.

**Causa raiz dos outros três sintomas — o BYE era aplicado na GERAÇÃO da rodada.**
`gerarRodada` já somava 3 pontos e gravava histórico. Como a classificação sai do histórico,
o jogador do BYE aparecia pontuando com a rodada ainda em andamento — e, com ele sendo o
único com pontos, virava "campeão". Agora **gerar a rodada só define os confrontos**; pontos,
saldo e histórico entram todos na finalização, junto com os placares, com guarda contra
dupla aplicação.

Como consequência, a classificação passou a refletir **apenas rodadas finalizadas** sem
precisar de filtro: o histórico só recebe uma rodada quando ela é finalizada.

Outros ajustes: campeão só quando `rodadaAtual === totalRodadas` e a rodada está finalizada;
"Corrigir Placares" só aparece depois da finalização; colunas do Appendix C reordenadas para
a sequência de desempate (`# | Jogador | MP | OMW% | GW% | OGW% | MW%`, com MW% ao final por
ser informativo); e um indicador **"✅ Rascunho salvo às HH:MM:SS"** na tela.

**Segundo teste no Safari:** a recuperação funcionou em tudo, menos no botão "Corrigir
Placares", que sumia após o reload. `retomarTorneioSalvo()` não passa por
`botoesProximaRodada()`, que era o único lugar que criava o botão. A regra virou uma função
única, `atualizarBotaoCorrigir()`, aplicada nos dois fluxos: o botão existe quando a rodada
atual está finalizada **e** é a última finalizada (se uma rodada posterior tivesse sido
gerada, `rodadaAtual` já teria passado de `ultimaRodadaFinalizada`).

**Terceiro teste no Safari:** durante "Corrigir Placares", um ⌘R trouxe todos os campos
vazios e uma classificação com só o jogador do BYE. Duas correções:

- **Os placares agora são renderizados no atributo `value` do HTML**, em vez de preenchidos
  por uma busca no DOM depois de a tela ser desenhada. Não existe mais um caminho em que a
  tela aparece e os valores não. Verificado neutralizando `aplicarRascunho()` por completo:
  os 182 testes continuam passando.
- **`ligarAutosave()` não captura mais o rascunho ao renderizar.** Capturar logo após
  desenhar é destrutivo: se a reaplicação falhasse, os campos estariam vazios,
  `capturarRascunho()` APAGARIA as entradas correspondentes e `salvarEstado()` persistiria a
  perda. O rascunho só é reescrito quando o organizador digita.
- **Ranking e Appendix C ficam ocultos enquanto `estadoRodadas[rodadaAtual] === "corrigindo"`.**
  Durante a correção a rodada está desfeita pela metade — os jogos normais saem do histórico
  e o BYE, que não é editável, permanece —, então qualquer classificação ali é um estado
  intermediário. Voltam ao salvar a correção, já recalculadas.

### Lição para os testes

O DOM simulado **não propagava eventos**, então um listener delegado nunca seria exercitado —
foi essa lacuna que deixou a falha chegar ao Safari. O harness passou a implementar a cadeia
de propagação de verdade, e os testes de autosave usam **exclusivamente o evento `input`**,
verificando o conteúdo do `localStorage` logo em seguida.

A suíte nova reprova o commit anterior em **10 casos**, incluindo o "campeão no meio do
torneio" observado no Safari.

---

## 19. Fluxo único: geração manual removida (24/08/2026)

**As rodadas da Liga são sempre geradas automaticamente pelo motor suíço.** A antiga geração
manual foi removida para reduzir complexidade e eliminar caminhos alternativos de estado.
Correções posteriores limitam-se aos **placares** da rodada atual, antes da geração da
rodada seguinte.

A geração manual existia como contingência, de quando o pareamento automático ainda tinha
falhas. Depois do backtracking, do controle de BYE, da prevenção de rematches, da unificação
das regras no `mtr.js` e da suíte de testes, essa razão deixou de existir — e o caminho
manual era a origem de uma família inteira de estados e validações paralelas.

### O fluxo operacional, agora único

```
Gerar rodada (automática)
      ↓
Lançar resultados
      ↓
Finalizar rodada
      ↓
Corrigir Placares, se necessário
      ↓
Gerar próxima rodada   ← a anterior fica definitivamente fechada
```

### O que saiu

`gerarRodadaManual`, `lerRodadaManual`, `validarRodadaManual`, `lerPlacaresManual`,
`aplicarRodadaManual`, `redesenharRodadaManual`, os botões "Gerar 1ª/Próxima Rodada (manual)",
os `<select>` de montagem de confrontos, o estado `"manual"` de `estadoRodadas`, o campo
`pares` (e `numLinhas`) do rascunho, e os helpers que só ele usava: `jogadoresAtivos`,
`jaRecebeuBye` e `registrarConfronto`.

**`acharJogador` foi preservado** — apesar de nascer no fluxo manual, é usado por
`aplicarEstado()` para religar as referências dos confrontos na recuperação.

**"Corrigir Placares" continua**: atende a um problema operacional normal (erro de digitação)
e não altera os confrontos.

Um teste automatizado (seção 13 da suíte) verifica que nenhum símbolo, botão, estado ou
`<select>` do fluxo manual sobrou no código.

### Versão do estado salvo

O estado no `localStorage` carrega `versao` (hoje `VERSAO_ESTADO = 2`) e a leitura **recusa
qualquer versão diferente**, avisa o organizador e descarta o registro. Restaurar pela metade
é pior do que começar de novo: um torneio salvo na versão 1 podia ter
`estadoRodadas[n] === "manual"`, que hoje cairia no ramo padrão da renderização e apareceria
como rodada finalizada.

**Ao mudar o formato do estado, incremente `VERSAO_ESTADO`.** É o que impede um torneio antigo
de ser recuperado silenciosamente com semântica errada.

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
