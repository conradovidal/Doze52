# Continuidade do onboarding — entrega DEV

Implementação em `codex/onboarding-account-continuity`, no worktree `/tmp/doze52-onboarding-continuity`, baseada em `origin/dev` `bf50832cf48d52fc07f56a538bd4c7b4a7bfce81`. A referência remota foi conferida novamente em 07/09/2026 e continua nessa versão. Alterações ainda não commitadas; não houve push, merge ou mudança em produção.

Preview das correções do onboarding desktop: https://doze52-9hfoicio3-conrados-projects-843a6c32.vercel.app
Deployment: `dpl_FpqcU81J34aSbEGH1MdjJ3oUqUMD`, READY. O acesso pode exigir autenticação Vercel. O link temporário de homologação não está versionado.

## Entrega

1. Cabeçalho e categorias ficam expandidos durante o guia, preservando a preferência anterior. Alvos ocultos são ignorados, e as instruções acompanham o cabeçalho e o redimensionamento.
2. Hábitos, marcações e progresso têm registros autenticados, revisões e operações idempotentes. Leituras incrementais usam cursor do servidor, paginação e o mesmo bloqueio por conta usado nas gravações. As preferências visuais permanecem locais.
3. A primeira marcação no mobile oferece cadastro ou continuação anônima. Abrir o formulário não conclui o cadastro. No desktop, o convite ao Anual é opcional; a introdução permanece acessível no menu Ajuda. A barra superior de continuidade e sugestões foi removida; o status de sincronização fica na área da conta. Contas sem histórico confiável recebem convite, sem inferir conclusão pelos dados existentes.
4. Importação anônima preserva IDs e vincula o rascunho uma única vez. Dados da chave antiga exigem confirmação. A seleção de hábitos ativos respeita o limite; os demais ficam arquivados com as marcações, preservando o original local.
5. O guia desktop posiciona o card pela mesma área de grade em Anual e Hábitos, inicia em janeiro e usa somente fundo tonal nos alvos. A troca de ano preserva a escolha até a ação explícita de voltar para hoje; meses e trimestres recortam a visualização sem criar eventos. A conclusão exige três categorias e permite substituir ou devolver apenas sugestões promovidas.

A conclusão remota do Anual não pode ser revertida. O conflito mantém a versão remota e a intenção local para reaplicação explícita; exclusões têm tombstone. Desmarcação persiste `completed=false`. Ao sair, a apresentação dos hábitos troca para o rascunho anônimo e a fila fica na chave exclusiva da conta anterior.

Também foram corrigidos problemas encontrados na jornada autenticada: importação de um calendário vazio como segundo contexto, tentativa de sincronizar categorias de demonstração e reutilização de IDs fixos do guia em contas diferentes.

Os dois modos compartilham os espaçamentos do cabeçalho expandido e recolhido. Os tokens aprovados (fundo escuro `#171717`, cartão `#262626`) foram preservados em `app/theme-tokens.css`, importado pelo layout. O Preview anterior entregava CSS com a paleta antiga, apesar de o código-fonte conter a neutra.

## Banco e configuração

Somente o Supabase DEV `jbdukjmbtffcgklsxjml` recebeu alterações:

- `20260907195441_account_continuity.sql` — registros, operações, isolamento por usuário, validação, limites e conclusão monotônica.
- `20260907201502_continuity_incremental_pull.sql` — cursor incremental, paginação e contrato v2.

Verificação remota final: contrato **2**, as **2 migrations presentes** e **2 tabelas com RLS habilitada e forçada**. A tabela de operações é interna e não concede leitura/escrita ao cliente. Os clientes modificam os registros exclusivamente pela operação validada.

`NEXT_PUBLIC_FEATURE_ACCOUNT_CONTINUITY=false` permanece como padrão. No Preview foi habilitada junto a Hábitos, usando a configuração pública do Supabase DEV e sem habilitar teste de cobrança. O cliente autenticado exige o contrato v2 antes de disponibilizar os dados da nova continuidade.

O envio ao Preview contém os arquivos necessários à compilação. Documentação e migrations não são executadas pelo build. O manifesto `preview-source.json` registra os hashes de 244 arquivos de execução/configuração e confirma correspondência com o worktree. Digest: `d021c33db41821b011ff4d3d2faeaa74604b3b18cbf6e3c2741eaaf9d6e8579f`.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Tipos e lint | Aprovados, sem avisos |
| Suíte unitária | 133 aprovados |
| Navegador local | 17 aprovados; 3 cenários autenticados dependentes das contas de QA ausentes foram ignorados explicitamente |
| Preview anterior (72e1uyk5w) | 9 aprovados; evidência autenticada anterior à correção visual |
| Correções no Preview atual | 4 cenários de cabeçalho, 7 cenários específicos do onboarding e 6 jornadas mobile/desktop aprovados |
| Geometria | Grade e card idênticos entre Anual e Hábitos em 1280×720, 1366×768 e 1440×900; janeiro visível no início |
| Destaques | Fundo tonal aprovado nos temas claro e escuro, sem contorno, halo ou atenuação dos controles vizinhos |
| Ano e recortes | Ano preservado ao continuar, retorno para hoje por teclado e recortes progressivos sem criação por rótulos |
| Categorias finais | Três categorias obrigatórias, sugestão removida ao promover, terceira substituída atomicamente e devolução por teclado |
| Desktop | Guia concluído em 1280×720, 1366×768 e 1440×900, incluindo redimensionamento para 1280×700 |
| Mobile | 320, 393 e 430 px; cadastro após primeira marcação, abandono do formulário e continuação sem conta; sem overflow horizontal |
| Dois navegadores independentes | IDs e marcação recuperados após login; convite opcional; dispensa persistida; retomada por ajuda; conclusão do Anual reconhecida no mobile |
| Offline e conflito | Desmarcação offline, alteração concorrente no desktop, reconexão, conflito preservado e reaplicação confirmada |
| Importação antiga | Confirmação explícita, seleção do ativo, marcação preservada, recarga sem duplicação e cópia antiga mantida |
| Troca de conta | Conta anterior retirada da interface; outra conta sem hábitos/progresso herdados |
| Banco DEV | Idempotência, revisão, limite Free, marcação/desmarcação, conclusão monotônica, exclusão, restauração explícita, cursor incremental e rejeição de acesso cruzado aprovados em transação com rollback |

Os testes autenticados usam contas temporárias confirmadas no DEV. Nesta revisão, as duas credenciais descartáveis não estavam presentes no worktree; por isso, os três casos de login foram ignorados explicitamente e a evidência autenticada continua sendo a do Preview anterior. Isso não representa teste de entrega de e-mail. Nenhum nome de hábito ou conteúdo pessoal é enviado pelos novos eventos de métricas: convite, autenticação, sincronização, início/conclusão e falha.

### Reproduzir

1. Usar apenas DEV e duas contas descartáveis. A suíte bloqueia domínios de produção e requisições Supabase fora do projeto DEV.
2. Disponibilizar credenciais locais não versionadas em `.vercel/continuity-qa.json` e `.vercel/continuity-qa-other.json`, no formato `{ "email": "...", "password": "..." }`.
3. A primeira conta deve começar sem hábitos/progresso/calendário de testes; a segunda deve estar vazia. A suíte cria dados e os cenários são sequenciais.
4. Executar `npx playwright test --config=playwright.unit.config.ts` e `npx playwright test --config=playwright.continuity.config.ts`. Para Preview, definir `CONTINUITY_BASE_URL` e, se protegido, `CONTINUITY_ACCESS_URL` com o acesso temporário. Os contextos mobile e desktop têm armazenamentos independentes.
5. Executar `tests/continuity/database.sql` exclusivamente no DEV; o script desfaz os dados criados na transação.
6. Remover somente as contas descartáveis criadas para esse ensaio após a validação.

## Pendências para promover

- Validar envio, clique real de confirmação de e-mail e retorno ao navegador original. Foi solicitado um endereço de teste ao usuário; os cenários atuais usam contas já confirmadas.
- Repetir no Preview atual os três cenários autenticados quando as duas contas descartáveis de QA estiverem novamente disponíveis.
- Consolidar as alterações em um SHA candidato e vincular a configuração/Preview à revisão Git da promoção. O Preview atual foi enviado por arquivos e está identificado pelo manifesto, não por um commit novo.

O critério integral “pronto para promover” ainda não está encerrado. Não promover `main` a partir deste relatório sem concluir essas pendências.

## Rollback

Desabilitar `NEXT_PUBLIC_FEATURE_ACCOUNT_CONTINUITY` no ambiente DEV/Preview e recompilar. Preservar ambas as tabelas, migrations, rascunhos, cópias anteriores, filas por conta e marcadores de importação. Não apagar tabelas nem reverter migrations destrutivamente. A funcionalidade antiga continua sob sua configuração anterior; reabilitar a continuidade exige contrato v2 e permite retomar as filas preservadas.
