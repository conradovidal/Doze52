# Importacao e exportacao de calendarios por Excel

## Escopo

A funcionalidade Pro oferece tres jornadas no menu da conta, em **Dados > Importar/exportar Excel**:

1. exportar os eventos atuais no formato canonico do Doze52;
2. importar uma planilha preenchida a partir do template;
3. importar uma planilha customizada, incluindo exportacoes do Jira, mapeando suas colunas.

Cada linha da fonte representa exatamente um evento. A importacao e aditiva: nao atualiza nem remove eventos. Nao ha integracao com a API do Jira, persistencia de IDs externos, presets ou alteracao no banco de dados nesta fase.

O backup tecnico existente em JSON/CSV continua separado. O Excel e um formato de intercambio de eventos e nao preserva estruturas vazias ou metadados internos.

O bloqueio de plano e aplicado somente no deployment de producao. Em desenvolvimento local e deployments de preview, o assistente fica liberado para validacao. A deteccao usa `NEXT_PUBLIC_VERCEL_ENV` quando disponivel e, fora da Vercel, recorre a `NODE_ENV` de forma conservadora.

## Modelo e atomicidade

Na terminologia da planilha, `contexto` corresponde ao modelo `CalendarProfile`. Uma `CategoryItem` pertence a um contexto, e um `CalendarEvent` pertence a uma categoria.

Leitura, mapeamento, resolucao e pre-visualizacao produzem apenas um plano em memoria. Nenhuma etapa anterior a confirmacao altera o calendario. Ao confirmar, a interface chama `replaceAllData` uma vez com um snapshot coerente contendo estruturas existentes, novas estruturas usadas e eventos validos. A sincronizacao existente persiste esse snapshot no Supabase.

## Formato canonico

O arquivo deve ser `.xlsx`, ter no maximo 5 MB e usar a aba `Eventos` no caminho por template. O template e a exportacao tambem incluem a aba `Instrucoes`.

| Coluna | Obrigatoria | Regra |
| --- | --- | --- |
| `contexto` | Sim | Perfil/contexto do Doze52. Pode ser criado, associado ou ignorado. |
| `categoria` | Sim | Categoria dentro do contexto resolvido. Pode ser criada, associada ou ignorada. |
| `evento` | Sim | Titulo do evento, epico, iniciativa ou outra grandeza escolhida. |
| `data_inicial` | Sim | Data do Excel ou `AAAA-MM-DD`. |
| `data_final` | Nao | Data do Excel ou `AAAA-MM-DD`; vazia assume a inicial. |
| `notas` | Nao | Texto com ate 2.000 caracteres. |

Eventos pontuais sao exportados repetindo a mesma data em `data_inicial` e `data_final`. As celulas de data geradas sao datas nativas do Excel formatadas como `yyyy-mm-dd`.

Exemplo:

| contexto | categoria | evento | data_inicial | data_final | notas |
| --- | --- | --- | --- | --- | --- |
| Produto | Time Azul | Epico 252 | 2026-10-01 | 2026-12-01 | JIRA-252 |
| Produto | Time Azul | Marco de release | 2026-12-04 |  |  |

## Planilha customizada

A primeira linha da aba selecionada e sempre interpretada como cabecalho. Se houver varias abas, o usuario escolhe qual importar. A interface mostra exemplos das primeiras linhas e sugere associacoes a partir de nomes comuns.

- `evento` e `data_inicial` exigem uma coluna;
- `contexto` e `categoria` aceitam coluna ou valor fixo;
- a sugestao de categoria fixa e `Geral`;
- `data_final` e `notas` sao opcionais;
- nenhuma associacao e salva como preset.

Sugestao inicial para Jira:

| Jira | Doze52 | Observacao |
| --- | --- | --- |
| Project | contexto | Projeto costuma ser o recorte mais estavel. Tambem pode ser um valor fixo. |
| Team, Squad ou campo customizado | categoria | A escolha depende da visualizacao desejada. |
| Summary ou Epic Name | evento | Cada linha vira um evento; pode representar epico ou iniciativa. |
| Start date | data_inicial | Obrigatoria no Doze52. |
| Due date | data_final | Se ausente, o evento fica pontual. |
| Description ou Issue key | notas | Rastreabilidade textual, sem ID externo persistido. |

A principal friccao e semantica: campos do Jira variam entre empresas. Por isso o produto sugere, mas deixa contexto, categoria e grandeza do evento sob controle do usuario.

## Resolucao de estruturas

Nomes sao comparados ignorando caixa, acentos e espacos laterais. Correspondencias unicas sao associadas automaticamente. Para cada valor desconhecido, a sugestao inicial e **Criar**, mas o usuario pode escolher **Associar a existente** ou **Ignorar**.

- categorias sao resolvidas somente dentro do contexto de destino;
- categorias de pacotes de calendario nao aparecem como destinos e nao aceitam eventos importados;
- contextos novos usam cor padrao e icone inferido pelas regras existentes;
- categorias novas usam sequencialmente a paleta atual;
- estruturas marcadas como ignoradas descartam suas linhas;
- correspondencias ambiguas bloqueiam a confirmacao ate serem resolvidas.

Limites por importacao:

- 10 novos contextos;
- 50 novas categorias;
- 1.000 eventos validos.

Quando um limite e ultrapassado, o erro informa os valores ou linhas responsaveis. Somente estruturas usadas por pelo menos um evento valido entram no snapshot final.

## Validacao, descarte e duplicatas

Erros de configuracao, ambiguidades e limites excedidos bloqueiam a confirmacao. Linhas com problemas de conteudo podem ser descartadas, mas o usuario precisa aceitar explicitamente o descarte na pre-visualizacao.

Problemas por linha incluem:

- contexto, categoria ou titulo vazio;
- data inicial ou final invalida;
- data final anterior a inicial;
- notas acima de 2.000 caracteres;
- estrutura sem resolucao;
- categoria gerenciada ou pertencente a outro contexto.

Uma duplicata combina contexto/categoria resolvidos, titulo normalizado, inicio e fim. A verificacao considera eventos existentes e linhas anteriores do mesmo arquivo. Duplicatas sao ignoradas e contabilizadas, sem bloquear a importacao.

O resultado final mostra contextos e categorias criados, eventos importados, linhas invalidas descartadas, duplicatas e estruturas ignoradas.

## Fora desta entrega

- agrupar varias issues em um epico ou iniciativa;
- atualizar ou remover eventos importados anteriormente;
- salvar presets de mapeamento;
- persistir chave ou ID do Jira;
- historico, relatorio ou rollback de importacoes;
- arquivos maiores, CSV e formatos locais de data;
- integracao OAuth/API com Jira ou outros conectores.
