# Lançamento de Hábitos e nova navegação

Status: candidato a lançamento  
Origem: PR #76 e continuação `codex/habit-stack-height`  
Data do registro: 28 de agosto de 2026

## O que esta entrega representa

Esta entrega introduz Hábitos como uma segunda superfície do Doze 52 e reorganiza a navegação para que Calendário, Hábitos e Perfil tenham papéis claros. Ela também transforma o onboarding em uma demonstração guiada do valor combinado das duas superfícies: eventos explicam o que aconteceu; hábitos ajudam a perceber padrões ao longo do mesmo ano.

O lançamento é controlado por `NEXT_PUBLIC_FEATURE_HABITS_PROTOTYPE`. O código passa a aceitar a ativação explícita também em produção, mas a flag de produção não é alterada por este PR.

## Mudanças visíveis

### Navegação e estrutura

- A rail lateral desktop foi substituída por um cabeçalho em três zonas: marca à esquerda, Calendário/Hábitos no centro real da viewport e Perfil à direita.
- A navegação mobile permanece na barra inferior e preserva a superfície ativa.
- Calendário e Hábitos compartilham largura, divisor e ritmo vertical dos controles.
- O painel de Perfil abre ancorado ao botão no canto superior direito e devolve o foco ao fechar.
- A grade anual usa toda a largura interna da moldura, sem reservas laterais permanentes para a barra de rolagem.
- O seletor de ano e o zoom ficam em ilhas externas; a moldura termina em Q4/DEZ e mantém janeiro acessível por rolagem interna.

### Calendários e categorias

- O modal “Adicionar categoria” separa ícone, conteúdo, ação e seta para evitar sobreposição.
- O primeiro passo não repete o contexto; a confirmação acontece na galeria de calendários.
- Feriados começam em São Paulo e futebol começa em Grêmio quando não existe escolha instalada ou feita na sessão.
- Calendários prontos usam uma cor neutra para funcionar como informação de apoio, preservando cores mais expressivas para conteúdo autoral.
- O onboarding mantém a edição aberta entre Editar, adicionar calendário pronto e importar feriados; a edição fecha apenas depois da importação.

### Hábitos

- Hábitos ganha uma visão anual desktop baseada na mesma estrutura temporal do calendário.
- Até quatro hábitos podem ser exibidos; Free mantém um hábito e Pro permite quatro.
- Os chips funcionam como filtros de visibilidade e preservam a ordem das séries.
- Um hábito permite marcação direta; com múltiplos hábitos, a célula abre um seletor ancorado que permite várias marcações sem fechar.
- Marcadores circulares são empilhados verticalmente, compactam lacunas e reservam altura conforme a quantidade de hábitos visíveis.
- A sessão demonstrativa contém Exercício, Ler 20 minutos, Dormir antes das 23h e Dia sem fumar; os três primeiros começam visíveis.
- A demonstração é determinística, não consome limites e não altera os hábitos reais.
- O fluxo termina em Hábitos, convidando a reconstruir os 14 dias mais recentes sem exigir quantidade mínima de registros.

### Onboarding narrativo

- O guia desktop tem oito passos percebidos: contexto, data, período, edição, calendário pronto, visão anual, navegação temporal e Hábitos.
- Balões são ancorados à ação ensinada e os destaques usam um único contorno portaled, evitando cortes por `overflow`.
- A troca para Hábitos depende do clique da pessoa; não ocorre automaticamente.
- O passo de navegação permite explorar meses e trimestres, mas retorna ao ano inteiro ao continuar.
- A demonstração de calendário passa a contar uma história multianual:
  - 2024 e anos anteriores ficam vazios;
  - 2025 mostra um ano vivido e a origem do produto;
  - 2026 preserva a narrativa atual;
  - 2027 mostra somente compromissos já antecipados, aniversários e feriados;
  - 2028 em diante mantém apenas recorrências estruturais.

## Registro de decisões

| Problema observado | Decisão | Base da decisão | Resultado esperado |
| --- | --- | --- | --- |
| A rail deslocava o calendário e competia com uma superfície já densa. | Navegação desktop no cabeçalho, centralizada pela viewport. | Protótipos e validação visual mostraram que os destinos são poucos e estruturais. | Mais área para o ano e leitura espacial consistente. |
| Calendário e Hábitos começavam em alturas diferentes. | Um contrato de 8 px até o divisor, 12 px até a primeira linha, 8 px entre linhas e 12 px antes da grade. | Comparação direta das duas superfícies em 768, 1024 e 1440 px. | Troca de superfície sem salto visual. |
| Destaques do onboarding eram fragmentados ou cortados. | Contorno único portaled, calculado pela posição real do alvo. | Elementos destacados vivem dentro de regiões com recorte e animação. | Orientação contextual com acabamento consistente. |
| A pessoa podia perder a sequência entre editar e adicionar calendário. | Manter a edição aberta até a importação dos feriados. | A nova categoria depende do modo de edição. | Menos reabertura de controles e fluxo contínuo. |
| Calendários prontos competiam visualmente com eventos autorais. | Cor neutra como padrão. | Calendários prontos são suporte; eventos pessoais carregam prioridade e significado. | Hierarquia visual mais clara. |
| A demonstração de hábitos parecia perfeita demais. | Padrões determinísticos, correlacionados com viagens, férias, leitura e noites sociais, com falhas reais. | O valor está em enxergar padrões, não em premiar uma rotina idealizada. | Exemplo crível e útil para interpretação. |
| Múltiplos hábitos comprimiam ou sobrepunham os dias. | Altura variável por filtros e bolinhas empilhadas com lacunas compactadas. | Hábitos precisam ser distintos dos eventos e continuar legíveis em escala anual. | Até quatro séries sem sobreposição. |
| Todos os anos demonstrativos pareciam iguais. | História própria em 2025, 2026 preservado e 2027 esparso. | Um calendário deve mostrar que o ano se constrói e que o futuro tem menos definição. | Narrativa temporal coerente e explorável. |
| O código bloqueava Hábitos em produção mesmo com a flag ativa. | Fazer a flag explícita ser a única condição de disponibilidade. | O PR passa a ser candidato real de lançamento, com ativação e rollback controláveis. | Preview, DEV e produção usam o mesmo artefato e diferem apenas pela flag. |

## Narrativa demonstrativa por ano

- **2025 — origem:** 123 ocorrências nos 12 meses. Inclui férias em Torres, Carnaval em Florianópolis, Buenos Aires, Serra Gaúcha, encontros pessoais e a progressão Pesquisa com pessoas usuárias → Protótipo do ano visível → Primeiro piloto do calendário anual → Planejamento da experiência mobile.
- **2026 — presente:** 137 ocorrências. Mantém integralmente os eventos e marcos usados na demonstração anterior.
- **2027 — horizonte:** 23 ocorrências. Combina somente aniversários, feriados, Planejamento estratégico 2027 e Viagem à Serra Gaúcha.
- **2028 em diante — estrutura:** 21 recorrências anuais de aniversários e feriados, sem eventos autorais inventados.

## Limites e compatibilidade

- Nenhuma API pública, tabela do Supabase ou formato remoto foi alterado.
- Hábitos continuam armazenados na sessão local do navegador; sincronização entre dispositivos e persistência em conta não fazem parte deste lançamento.
- A visibilidade dos hábitos também é local à sessão.
- Dados reais nunca são apagados para exibir a demonstração.
- A versão v8 do snapshot substitui versões demonstrativas v1–v7 apenas antes da criação autoral; sessões desbloqueadas não são sobrescritas.
- O mobile mantém sua navegação e interação próprias; a grade anual detalhada é desktop.
- A instrumentação existente registra conclusão do onboarding e dias de atividade para contas autenticadas. Ainda não existem métricas específicas para criação, filtro ou check-in de hábitos; nenhuma afirmação de adoção deve ser feita sem essa instrumentação.

## Gate de lançamento e rollback

1. Validar o Preview da branch com a flag ativa.
2. Mesclar o PR em `dev` somente após aceite explícito.
3. Validar DEV com a mesma matriz de onboarding, navegação e hábitos.
4. Configurar `NEXT_PUBLIC_FEATURE_HABITS_PROTOTYPE=true` em produção e gerar um novo deployment.
5. Executar smoke test de Calendário, Hábitos, Perfil, criação e onboarding.
6. Em caso de regressão, definir a flag como `false` e fazer um novo deployment; nenhuma migração de banco precisa ser revertida.

## Evidências exigidas antes da ativação

- Lint completo e build Next.js aprovados.
- Testes unitários de onboarding, hábitos, recorrência e limites aprovados.
- Playwright em 768, 1024 e 1440 px para navegação, ritmos verticais, grade, filtros e seleção diária.
- Regressão mobile em 320, 390 e 430 px.
- Temas claro e escuro, movimento reduzido e retorno de foco.
- 2024 vazio, 2025 com 123 ocorrências, 2026 com 137, 2027 com 23 e 2028 com 21.
- Preview da branch em estado `READY`; produção permanece fora do escopo deste PR até autorização explícita.
