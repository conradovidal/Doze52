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
- **"Triatlo"** (focado): Nadar, Pedalar, Correr e Treino de força, com um plano semanal por fase.
- O "Triatlo" existe só na tela, durante o guia: não é gravado nem sincronizado, e não pode ser editado. Um hábito criado com ele selecionado vai para o primeiro contexto real, e a tela acompanha.
- Os dois contextos contam a mesma história do ano de exemplo, que é também a base de conteúdo: **uma pessoa que se prepara para um Ironman em 2026**.

### A história nos Eventos (exemplo v10)

A história ganhou corpo demais para ficar no Pessoal: vira um **terceiro contexto, "Triatlo"**, só do ano de exemplo (o guia continua oferecendo Pessoal e Profissional; o Triatlo some junto com o exemplo e não vira a escolha do guia). Quatro categorias: **Provas** (inscrição, sprint, Ironman), **Treino** (recuperações, volta gradual, construção, polimento), **Saúde** (avaliação física, consulta com ortopedista, fisioterapia e a alta) e **Viagens** (viagem da prova). O ano abre com o Pessoal selecionado; o Triatlo fica a um clique. O teto de 2 eventos por dia vale por contexto. As datas de 2026 são contrato: cada cena aparece exatamente assim na tela. Elas derivam de duas âncoras de domingo, o sprint (12/04) e o Ironman (08/11). Só os pontos de virada viram evento: o ano de exemplo nunca passa de 2 eventos no mesmo dia. As bases (antes do sprint, e do fim da recuperação até a fisioterapia) não são eventos: a vitrine as deduz das provas.

| Evento | Categoria | Datas |
| --- | --- | --- |
| Inscrição no Ironman | Provas | 20/01 |
| Avaliação física | Saúde | 27/01 |
| Triatlo sprint | Provas | 12/04 |
| Recuperação | Treino | 13/04 a 26/04 |
| Consulta com ortopedista | Saúde | 19/05 |
| Fisioterapia | Saúde | 25/05 a 14/06 |
| Alta da fisioterapia | Saúde | 14/06 |
| Volta gradual à corrida | Treino | 15/06 a 28/06 |
| Construção | Treino | 29/06 a 18/10 |
| Polimento para o Ironman | Treino | 19/10 a 07/11 |
| Viagem da prova | Viagens (Triatlo) | 06/11 a 09/11 |
| Ironman | Provas | 08/11 |
| Recuperação | Treino | 09/11 a 29/11 |

Outros ajustes do ano de exemplo:

- Saem "Ironman 70.3", "Polimento para o 70.3", "Ironman Florianópolis" e "Carnaval em Paraty". Entre 14 e 18/02 não há evento Pessoal ou Família (a "Volta às aulas" foi para 23/02); o Carnaval é só o feriado "Terça-feira de Carnaval", do pacote de Feriados.
- Para respeitar o teto de 2 por dia: "Férias das crianças" passou a 20–24/07, "Feira de design" para 01/09 e "Feira do Livro" para 01–11/10.
- "Casamento da Ana e do Lucas" passou para sábado 12/09; "Férias em família — Maceió" virou "Férias em Maceió"; entram "Lançamento da campanha para PMEs" (17 a 21/08, Projetos) e "Revisão do ano" (20/12).
- 2025 não tem nada de triatlo: a história começa com a inscrição.

### Como a vitrine de Hábitos lê as fases

As marcações são lidas dos eventos (pelo título, nas categorias Provas, Treino e Saúde), com esta precedência, dia a dia:

1. **Dia de prova**: Nadar, Pedalar e Correr, mesmo dentro de uma viagem. Na véspera, Dormir cedo.
2. **Bloco de Carnaval** (sábado antes da terça até a Quarta de Cinzas; 14 a 18/02): pedalar, correr, nadar e força, e dormir cedo nas 5 noites. Vem do feriado do pacote ou da Páscoa menos 47 dias. Sem o pacote de Feriados no exemplo, vale a data da Páscoa.
3. **Recuperação**: 7 dias sem nada do triatlo; depois só Nadar na terça e Correr na quinta.
4. **Polimento**: menos volume e sem força; dormir cedo sempre.
5. **Fisioterapia**: nenhuma corrida (nem em Gramado), força seg/qua/sex. **Volta gradual**: Correr só na terça e no sábado.
6. **Semana do lançamento** (17 a 21/08): só Correr na terça e na quinta, e Dormir cedo só na segunda e na quarta.
7. **Casamento** (12/09): sábado em branco; domingo só pedala.
8. **Viagem** (categoria Viagens, férias e Ano Novo; "carnaval" e "fim de semana" no título deixaram de contar): ida e volta em branco, corrida leve em dias alternados.
9. **Padrão por fase**: base do sprint, da primeira segunda depois da inscrição até a prova (força só na segunda de uma semana a cada três, para o grid mostrar a força sumindo), base do Ironman, depois da primeira recuperação (força seg/sex), Construção (força só na sexta), depois da recuperação final (correr ter/sáb, força seg/qui, nadar na quarta). Uma sessão perdida a cada poucas semanas, só nas bases e na construção, nunca duas em sequência.

Contexto Hábitos: Ler nos dias seg/ter/qui/dom (na Construção, só domingo; em viagens, na Feira do Livro, no polimento do Ironman e depois da recuperação final, quase todo dia). Dormir cedo segue a regra de noite de semana, exceto noites com amigos, festa, show ou aniversário; na Construção, toda noite.

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
