# Catálogo dinâmico de calendários

O catálogo publicado vive no Supabase e é servido por `GET /api/calendar-packs`.
Os pacotes compilados em `lib/calendar-packs` continuam sendo o fallback quando não
há release válido, Supabase está indisponível ou a resposta remota é rejeitada.

## Configuração

1. Aplique as migrations do catálogo em ordem, incluindo a configuração forward-only
   do feed GE.
2. Defina `CALENDAR_PACK_REFRESH_SECRET` no ambiente do Next.js.
3. No Vault do Supabase, crie:
   - `calendar_pack_refresh_url`: URL completa de
     `https://<dominio>/api/internal/calendar-packs/refresh`;
   - `calendar_pack_refresh_secret`: o mesmo valor de
     `CALENDAR_PACK_REFRESH_SECRET`.
4. Confirme no Supabase Cron os jobs `doze52-calendar-packs-midnight` e
   `doze52-calendar-packs-closing`.
5. Cadastre os operadores em `public.product_feedback_admins`. O painel fica em
   `/admin/calendar-packs`.

Antes de tirar uma fonte de `pending` ou `shadow`, confirme no ambiente de produção
que o Route Handler consegue validar a cadeia TLS e extrair eventos da URL oficial.
Falhas de certificado, HTML sem contrato reconhecido ou endpoint vazio devem continuar
visíveis como falha/quarentena; nunca desative a validação TLS para contorná-las.

Os jobs verificam o horário local a cada hora. Eles disparam exatamente às 00:00 e
04:00 em `America/Sao_Paulo`, mesmo se a relação com UTC mudar no futuro.

## Ambiente DEV

O refresh agendado também precisa rodar no DEV (`jbdukjmbtffcgklsxjml`), senão o catálogo
fica parado na release `bootstrap`. O DEV não herda nada da produção; configure assim:

1. **Migrations:** o DEV precisa ter todas as migrations do catálogo, em especial
   `harden_calendar_source_refresh` (cria `claim_calendar_pack_refresh` e a tabela de
   lease). Sem ela, o refresh falha logo no início, sem criar run, com `errorType:
   'UnknownError'` nos logs.
2. **Domínio fixo:** o alias `doze52-git-dev-*.vercel.app` pode ficar preso a um deploy
   antigo. Use o domínio `dev.doze52.com.br`, atribuído à branch `dev` em Settings,
   Domains (CNAME `dev` para o valor que a Vercel indicar).
3. **Segredo:** crie `CALENDAR_PACK_REFRESH_SECRET` na Vercel com escopo Preview e
   branch `dev`, com um valor próprio do DEV (`openssl rand -hex 32`). Depois faça
   redeploy da `dev`.
4. **Deployment Protection:** o preview exige login da Vercel e bloquearia o cron. Gere
   um segredo em Settings, Deployment Protection, Protection Bypass for Automation, e
   passe-o como parâmetro da URL do Vault.
5. **Vault do DEV:**
   - `calendar_pack_refresh_url`:
     `https://dev.doze52.com.br/api/internal/calendar-packs/refresh?x-vercel-protection-bypass=<bypass>`;
   - `calendar_pack_refresh_secret`: o mesmo valor do passo 3, sem espaços nem quebra de
     linha. Use `vault.create_secret` na primeira vez e `vault.update_secret` depois.
6. **Operador:** cadastre o usuário em `public.product_feedback_admins` do DEV.
7. **Fontes:** o DEV nasce com as fontes de futebol em `shadow`, que nunca publicam. Para
   espelhar a produção, ponha em `active` as de `cbf-*` e `conmebol-*`.

Para validar sem esperar 00:00 ou 04:00, rode no SQL Editor do DEV o mesmo `net.http_post`
do job e leia `net._http_response`. O pg_net desiste depois de 5s e grava `status_code`
nulo com "Timeout"; isso é esperado, pois o refresh leva dezenas de segundos. Confirme
pelo run novo com gatilho `scheduled_midnight` em `calendar_pack_update_runs`. Um `403
"Origem inválida"` indica que o segredo do Vault difere do da Vercel.

A CBF devolve HTTP 429 se for consultada várias vezes em poucos minutos (vários refreshes
manuais seguidos). O release publicado é preservado e o próximo ciclo se recupera.

## Limites e concorrência

Cada execução precisa adquirir um lease transacional antes de criar o run. O lease
dura 330 segundos, é renovado antes de cada fonte e imediatamente antes da publicação.
Uma segunda chamada recebe `409` e `Retry-After`; se uma execução for abandonada, o
lease expira e o run anterior é encerrado como falha antes da retomada.

O transporte aceita somente HTTPS e hosts explicitamente autorizados, não segue
redirects e interrompe respostas que excedam o limite durante o streaming. Os limites
iniciais são:

- 300 requisições e 96 MiB por execução;
- 100 requisições e 32 MiB por fonte;
- 12 MiB por resposta da CBF;
- 4 MiB por resposta oficial ou do GE;
- 16 fases, 16 grupos por fase, 60 rodadas e 80 requisições de rodadas por fase;
- 2.000 eventos oficiais ou do feed por fonte.

O `summary` do run registra por fonte somente requisições, requisições recusadas,
bytes, duração acumulada, classes HTTP e códigos padronizados de falha. Corpo, URL,
headers e conteúdo recebido não entram nessas métricas. Ajuste limites apenas por
migration/revisão de código e depois de comparar essa telemetria com execuções reais.

## Rollout

Brasileirão, Copa do Brasil, Libertadores e Sul-Americana começam em `shadow`.
O fallback já agrega as quatro competições; as fontes em sombra apenas geram candidatos
e diferenças, sem substituir o release publicado. Os endpoints técnicos da CBF e os
documentos oficiais por fase da CONMEBOL ficam no código de ingestão, enquanto
`official_url` permanece como a página pública de proveniência. Para o futebol, o GE é
o feed operacional comum de datas e resultados: `feed_provider` e `feed_url` registram
essa dependência separadamente, sem transformar o agregador em autoridade.

Cada execução descobre a tabela pública do GE, percorre suas fases e rodadas e reconcilia
os IDs do fornecedor com os IDs oficiais. CBF e CONMEBOL continuam prevalecendo para
participantes, data, horário, fase e local. Somente placares marcados como encerrados são
aceitos; jogos em andamento são ignorados. Jogos encontrados apenas no GE ficam visíveis
como não reconciliados e não entram no catálogo.
Uma fonte em sombra gera candidatos, diferenças e quarentenas sem publicar. Depois de
14 dias sem regressões contratuais, altere a fonte para `active` pelo banco e acompanhe
ao menos dois ciclos antes de ativar a próxima, nesta ordem:

1. CBF: Brasileirão e Copa do Brasil;
2. CONMEBOL: Libertadores e Sul-Americana;
3. Fórmula 1 e FIFA;
4. feriados governamentais.

`paused` interrompe uma fonte sem apagar histórico. O GE pode ser trocado como feed
operacional sem alterar a autoridade, a proveniência pública ou os UUIDs canônicos.

## Quarentena e recuperação

Uma carga é bloqueada se vier vazia ou inválida, retirar mais de dois jogos e mais de
5% do calendário, reutilizar um ID, trocar participantes de um jogo não-placeholder ou
divergir do placar já publicado pela fonte oficial.
O release publicado não muda nessas situações. O painel mostra a diferença e permite
voltar o ponteiro do catálogo a qualquer release anterior, registrando justificativa e
operador.

## Mudança material

O hash e a versão ignoram `lastVerified`. Versões sobem somente quando mudam eventos,
resultados, datas, horários, locais, fases ou participantes. IDs existentes são
preservados; IDs novos derivam deterministicamente de autoridade, competição,
temporada e ID oficial.
