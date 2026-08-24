import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import type { CalendarSnapshot } from "../../lib/sync";
import { createUserDataBackupArchive } from "../../lib/user-data-backup";

const PROFILE_ID = "44444444-4444-4444-8444-444444444441";
const CATEGORY_ID = "55555555-5555-4555-8555-555555555552";

const backupCsvFiles = (snapshot: CalendarSnapshot) => {
  const files = unzipSync(createUserDataBackupArchive(snapshot, "2026-08-24"));
  return {
    profiles: strFromU8(files["doze52-profiles-2026-08-24.csv"]),
    categories: strFromU8(files["doze52-categories-2026-08-24.csv"]),
    events: strFromU8(files["doze52-events-2026-08-24.csv"]),
  };
};

test("neutraliza prefixos de fórmula em todos os CSVs do backup", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [
      {
        id: PROFILE_ID,
        name: "=HYPERLINK(\"https://example.invalid\")",
        color: "#64748B",
        icon: "briefcase",
        position: 0,
      },
    ],
    categories: [
      {
        id: CATEGORY_ID,
        profileId: PROFILE_ID,
        name: "+SUM(1,1)",
        color: "#7C3AED",
        visible: true,
      },
    ],
    events: ["@SUM(1,1)", "-1+1", "\t=1+1", "\r=1+1", "\n=1+1"].map(
      (title, index) => ({
        id: "77777777-7777-4777-8777-777777777777",
        title,
        categoryId: CATEGORY_ID,
        color: "#7C3AED",
        startDate: "2026-09-10",
        endDate: "2026-09-10",
        createdAt: "2026-08-03T12:00:00.000Z",
        dayOrder: index,
      })
    ),
  };

  const csv = backupCsvFiles(snapshot);

  expect(csv.profiles).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
  expect(csv.categories).toContain('"\'+SUM(1,1)"');
  expect(csv.events).toContain('"\'@SUM(1,1)"');
  expect(csv.events).toContain('"\'-1+1"');
  expect(csv.events).toContain('"\'\t=1+1"');
  expect(csv.events).toContain('"\'\r=1+1"');
  expect(csv.events).toContain('"\'\n=1+1"');
});

test("preserva texto comum, aspas e valores estruturais legítimos", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [
      {
        id: PROFILE_ID,
        name: "Planejamento = resultado",
        color: "#64748B",
        icon: "briefcase",
        position: 0,
      },
    ],
    categories: [
      {
        id: CATEGORY_ID,
        profileId: PROFILE_ID,
        name: 'Projetos "Premium"',
        color: "#7C3AED",
        visible: true,
      },
    ],
    events: [],
  };

  const csv = backupCsvFiles(snapshot);

  expect(csv.profiles).toContain('"Planejamento = resultado"');
  expect(csv.categories).toContain('"Projetos ""Premium"""');
  expect(csv.profiles).toContain('"0"');
  expect(csv.categories).toContain('"true"');
});
