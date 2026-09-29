# Hábitos ilimitados no Pro e contextos de hábitos

## O que muda para a pessoa

- **Pro:** hábitos e contextos de hábitos ilimitados, como já eram contextos e categorias nos Eventos. A oferta do Pro passa a listar "Hábitos ilimitados".
- **Free:** continua com 1 hábito e 1 contexto. Tentar criar um 2º contexto abre o convite do Pro "Cada rotina no seu lugar".
- **Contexto "Hábitos":** todo mundo já tem esse contexto, com o nome e o ícone editáveis. Os hábitos criados antes desta versão moram nele.
- **Novos contextos (ex.: Saúde, Estudos):** eles agrupam hábitos como os contextos dos Eventos agrupam categorias. A tela mostra só os hábitos do contexto selecionado.
- **Organizar › Hábitos:** a aba tem a linha de contextos (arrastar, editar, "+") acima dos hábitos do contexto, igual à aba Eventos. No mobile, o modo de edição da tela de Hábitos mostra o mesmo.
- **Editor de hábito:** com mais de um contexto, ganha o campo "Contexto", que serve para mover o hábito sem perder as marcações.
- **Excluir contexto:** dá para mover os hábitos para outro contexto ou excluir tudo, com "Desfazer". O último contexto não pode ser excluído.
- **Ano de hábitos:** não há mais teto de 4 hábitos visíveis. Um dia com mais de 4 marcados mostra 3 bolinhas e "+N", e o mês nunca fica mais alto do que com 4. O seletor do dia quebra em linhas de até 6.

## Registro no dia (desktop igual ao mobile)

- **Foco é o padrão:** um hábito por vez, escolhido no chip (seleção única, como no mobile). O dia marcado vira um círculo na cor do hábito, ligado aos dias vizinhos também marcados — a sequência que só existia no mobile. Clicar no dia marca/desmarca, sem seletor.
- **"Todos"** (aparece com 2+ hábitos no contexto): mostra as bolinhas de todos os hábitos do contexto. Clicar no dia abre o seletor, agora **embaixo** do dia (em cima quando não cabe), para não tapar os próximos dias do mês. Clicar num hábito volta ao foco nele.
- A escolha foco/"Todos" fica salva no aparelho (`desktopHabitView`). Na vitrine do guia inicial, o comportamento antigo segue valendo.
- Os chips do desktop deixaram de ser filtros de visibilidade: em foco mostra um, em "Todos" mostra todos.

## Onboarding: vitrine em dois contextos

- **"Hábitos"** (genérico): Ler 20 minutos e Dormir cedo.
- **"Triatlo"** (focado): Nadar, Pedalar, Correr e Treino de força, com um plano semanal plausível.
  - A corrida é a modalidade mais frequente. No sábado, alterna entre pedal e o "brick" (pedal + corrida). Uma sessão se perde a cada poucas semanas.
  - Em viagem, só entra corrida leve em dias alternados.
  - Dormir cedo falha nas noites de evento do ano de exemplo.
- O "Triatlo" existe só na tela, durante o guia: não é gravado nem sincronizado, e não pode ser editado. Um hábito criado com ele selecionado vai para o primeiro contexto real, e a tela acompanha.
- É o primeiro passo de uma história única para o ano de exemplo, que é também a base de conteúdo: alguém que treina para um Ironman.

### Provas nos Eventos, ligadas ao treino (exemplo v10)

- A nova categoria **"Triatlo"** fica no contexto Pessoal do ano de exemplo. As provas caem sempre no domingo, e o polimento vem da data de cada prova.
  - Inscrição no Ironman: 20/jan.
  - Triatlo sprint: abril.
  - Polimento + Ironman 70.3: agosto.
  - Polimento + Ironman Florianópolis: fim de novembro.
- 2025 não tem provas: a história começa com a inscrição.
- A vitrine de Hábitos lê esses eventos:
  - Antes da inscrição, só manutenção (corrida e força).
  - No dia da prova, nadar, pedalar e correr.
  - Nos dois dias seguintes, recuperação.
  - No polimento, menos volume, sem força e dormindo cedo, menos na noite do "Show de fim de ano", que cai no meio dele.
- O grupo do exemplo subiu para v10. Quem ainda está com o exemplo antigo bloqueado recebe o novo automaticamente.

## Modelo e sincronização

- `HabitContext` em `lib/types.ts`; `Habit.contextId` é opcional, e sem ele o hábito fica no contexto padrão.
- O padrão tem id fixo (`DEFAULT_HABIT_CONTEXT_ID`). Ele fica virtual até ser editado ou ganhar um vizinho, e só então vira registro. Assim nenhuma conta existente gera escrita ao abrir o app.
- Um hábito cujo contexto sumiu (excluído em outro aparelho) cai no primeiro contexto e nunca fica fora da tela (`resolveHabitContextId`).
- Continuidade de conta: novo kind `habit_context` em `continuity_records`.

## Banco (migration `20260929142158_habit_contexts_unlimited_pro`)

- Hábitos ativos: 1 no Free e 250 no Pro. O 250 é um teto técnico contra abuso, na mesma linha dos 50 contextos e 250 categorias em `private.calendar_snapshot_limits`.
- Contextos de hábitos: só o teto técnico (50). O limite de 1 no Free vive no app, porque um contexto sem hábitos não entrega nada do Pro, e recusá-lo no servidor travaria a fila de sincronização do aparelho.
- `continuity_habit_limit()` continua devolvendo inteiro e `continuity_contract_version()` continua 2. Clientes já publicados seguem funcionando: ignoram `habit_context` e preservam o `contextId` ao editar.
- Valida `contextId` como UUID quando presente.

## Deploy

1. ✅ Aplicada no Supabase de DEV em 2026-09-29; `tests/continuity/database.sql` passou.
2. Aplicar a migration em produção **antes** do deploy do app. Sem ela, o servidor recusa `habit_context` (kind inválido) e continua limitando o Pro a 4 hábitos.
3. Publicar o app.
