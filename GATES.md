# Gates: continuidade do onboarding
OWNS: app/** components/** lib/** supabase/** tests/** scripts/** .env.example docs/** playwright.continuity.config.ts GATES.md
Scope: Controles visíveis, progresso por conta, sincronização incremental de hábitos, migração e jornadas mobile/desktop verificadas em DEV.

- [x] G1: Tipos e lint das mudanças aprovados.
  CHECK: npx tsc --noEmit && npx eslint app components lib tests
  EXPECT: ^$
  EVIDENCE: exit 0, sem avisos em 07/09/2026.
- [x] G2: Persistência, conflitos, migração e jornadas passam testes direcionados.
  CHECK: npx playwright test --config=playwright.unit.config.ts
  EXPECT: passed
  EVIDENCE: 133 passed.
- [x] G3: Controles e jornada entre navegadores independentes passam no navegador.
  CHECK: npx playwright test --config=playwright.continuity.config.ts
  EXPECT: passed
  EVIDENCE: 17 locais aprovados e 3 cenários autenticados corretamente marcados como dependentes das contas descartáveis de QA ausentes neste worktree. Evidência autenticada completa permanece no Preview anterior.
- [x] G4: Contrato DEV aplicado e isolamento, limites e idempotência comprovados com transações de teste.
  EVIDENCE: tests/continuity/database.sql => CONTINUITY_DATABASE_PASSED; contrato 2, duas migrations presentes e duas tabelas com RLS forçada.
- [ ] G5: Homologação integral e identidade Git do candidato.
  EVIDENCE: Preview dpl_FpqcU81J34aSbEGH1MdjJ3oUqUMD READY, 244 arquivos conferidos no manifesto; 4 cenários de cabeçalho, 7 correções de onboarding e 6 jornadas mobile/desktop aprovados no Preview. A jornada autenticada foi demonstrada no Preview anterior, mas não foi repetida nesta revisão por ausência das duas contas descartáveis no worktree. Ainda faltam envio/clique real de confirmação de e-mail e consolidação do SHA candidato. Não pronto para promover.
- [x] G6: Anual e Hábitos compartilham a geometria da grade, mostram janeiro inicialmente e posicionam o card no mesmo ponto.
  CHECK: npx playwright test --config=playwright.continuity.config.ts onboarding-refinements.spec.ts -g "geometria" && echo G6_GEOMETRY_PASSED
  EXPECT: G6_GEOMETRY_PASSED
  EVIDENCE: 3 tamanhos aprovados localmente e no Preview; grade e card têm geometria idêntica entre Anual e Hábitos, com janeiro no topo.
- [x] G7: Todos os alvos do guia usam fundo tonal sem contornos, halos ou atenuação dos controles vizinhos.
  CHECK: npx playwright test --config=playwright.continuity.config.ts onboarding-refinements.spec.ts -g "destaque tonal" && echo G7_TONAL_HIGHLIGHT_PASSED
  EXPECT: G7_TONAL_HIGHLIGHT_PASSED
  EVIDENCE: temas claro e escuro aprovados localmente e no Preview; sem outline, box-shadow ou opacidade reduzida nos vizinhos.
- [x] G8: A troca de ano, o retorno para hoje e os recortes de mês e trimestre funcionam sem criar eventos pelos rótulos.
  CHECK: npx playwright test --config=playwright.continuity.config.ts onboarding-refinements.spec.ts -g "ano e recortes" && echo G8_YEAR_CROP_PASSED
  EXPECT: G8_YEAR_CROP_PASSED
  EVIDENCE: navegação anterior/seguinte, preservação ao continuar, retorno por teclado e recortes progressivos aprovados; arraste entre rótulos não abriu formulário nem criou evento.
- [x] G9: A etapa final exige três categorias e mantém sugestões promovidas sincronizadas entre as duas áreas.
  CHECK: npx playwright test --config=playwright.continuity.config.ts onboarding-refinements.spec.ts -g "três categorias" && echo G9_CATEGORIES_PASSED
  EXPECT: G9_CATEGORIES_PASSED
  EVIDENCE: requisito de três, substituição atômica da terceira, devolução por teclado e persistência após recarga aprovados localmente e no Preview.
- [x] G10: As correções integradas preservam tipos, lint, unidades e jornadas existentes.
  CHECK: npx tsc --noEmit && npx eslint app components lib tests && npx playwright test --config=playwright.unit.config.ts && npx playwright test --config=playwright.continuity.config.ts && echo G10_REGRESSION_PASSED
  EXPECT: G10_REGRESSION_PASSED
  EVIDENCE: tipos e lint sem avisos; 133 unidades e 17 jornadas aprovadas. Três cenários autenticados foram ignorados somente porque os arquivos locais de credenciais de QA não existem.
