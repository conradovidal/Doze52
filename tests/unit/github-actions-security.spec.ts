import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/qa-preview.yml"),
  "utf8"
);

test("fixa todas as GitHub Actions por SHA imutável", () => {
  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*(\S+)/gm)].map(
    ([, reference]) => reference
  );

  expect(actionReferences).not.toHaveLength(0);
  for (const reference of actionReferences) {
    expect(reference).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  }
  expect(workflow).toContain("persist-credentials: false");
});

test("mantém secrets fora do ambiente global e limita cada uso ao passo necessário", () => {
  const jobEnvironment = workflow.slice(
    workflow.indexOf("    env:"),
    workflow.indexOf("    steps:")
  );

  expect(jobEnvironment).not.toContain("secrets.");
  expect(workflow.match(/\$\{\{ secrets\.QA_E2E_PASSWORD \}\}/g)).toHaveLength(3);
  expect(
    workflow.match(/\$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/g)
  ).toHaveLength(1);
  expect(workflow).toContain("permissions:\n  contents: read");
});
