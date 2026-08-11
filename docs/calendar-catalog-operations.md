# Catálogo dinâmico de calendários

O catálogo publicado vive no Supabase e é servido por `GET /api/calendar-packs`.
Os pacotes compilados em `lib/calendar-packs` continuam sendo o fallback quando não
há release válido, Supabase está indisponível ou a resposta remota é rejeitada.

## Configuração

1. Aplique `supabase/migrations/20260811184227_dynamic_calendar_catalog.sql`.
2. Defina `CALENDAR_PACK_REFRESH_SECRET` no ambiente do Next.js.
3. No Vault do Supabase, crie:
   - `calendar_pack_refresh_url`: URL completa de
     `https://<dominio>/api/internal/calendar-packs/refresh`;
   - `calendar_pack_refresh_secret`: o mesmo valor de
     `CALENDAR_PACK_REFRESH_SECRET`.
4. Confirme no Supabase Cron os jobs `doze52-calendar-packs-midnight` e
   `doze52-calendar-packs-closing`.
5. Cadastre os operadores em `public.product_admins`. O painel fica em
   `/admin/calendar-packs`.

Antes de tirar uma fonte de `pending` ou `shadow`, confirme no ambiente de produção
que o Route Handler consegue validar a cadeia TLS e extrair eventos da URL oficial.
Falhas de certificado, HTML sem contrato reconhecido ou endpoint vazio devem continuar
visíveis como falha/quarentena; nunca desative a validação TLS para contorná-las.

Os jobs verificam o horário local a cada hora. Eles disparam exatamente às 00:00 e
04:00 em `America/Sao_Paulo`, mesmo se a relação com UTC mudar no futuro.

## Rollout

Brasileirão, Copa do Brasil, Libertadores e Sul-Americana começam em `shadow`.
O fallback já agrega as quatro competições; as fontes em sombra apenas geram candidatos
e diferenças, sem substituir o release publicado. Os endpoints técnicos da CBF e os
documentos oficiais por fase da CONMEBOL ficam no código de ingestão, enquanto
`official_url` permanece como a página pública de proveniência.
Uma fonte em sombra gera candidatos, diferenças e quarentenas sem publicar. Depois de
14 dias sem regressões contratuais, altere a fonte para `active` pelo banco e acompanhe
ao menos dois ciclos antes de ativar a próxima, nesta ordem:

1. CBF: Brasileirão e Copa do Brasil;
2. CONMEBOL: Libertadores e Sul-Americana;
3. Fórmula 1 e FIFA;
4. feriados governamentais.

`paused` interrompe uma fonte sem apagar histórico. Nunca use páginas de clubes,
portais esportivos ou agregadores como substitutos autoritativos.

## Quarentena e recuperação

Uma carga é bloqueada se vier vazia ou inválida, retirar mais de dois jogos e mais de
5% do calendário, reutilizar um ID ou trocar participantes de um jogo não-placeholder.
O release publicado não muda nessas situações. O painel mostra a diferença e permite
voltar o ponteiro do catálogo a qualquer release anterior, registrando justificativa e
operador.

## Mudança material

O hash e a versão ignoram `lastVerified`. Versões sobem somente quando mudam eventos,
resultados, datas, horários, locais, fases ou participantes. IDs existentes são
preservados; IDs novos derivam deterministicamente de autoridade, competição,
temporada e ID oficial.
