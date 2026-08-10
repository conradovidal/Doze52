import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const SPREADSHEET_NAMESPACE =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  widths: number[];
};

export type XlsxCell = string | number | Date;

export type XlsxReadRow = {
  rowNumber: number;
  cells: Map<number, string>;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const decodeXml = (value: string) =>
  value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      const named: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      };
      return named[entity.toLowerCase()] ?? entity;
    }
  );

const getXmlAttribute = (attributes: string, name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeXml(
    attributes.match(new RegExp(`${escapedName}="([^"]*)"`, "i"))?.[1] ?? ""
  );
};

const getTextNodes = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)]
    .map((match) => decodeXml(match[1]))
    .join("");

const columnName = (index: number) => {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

const columnIndex = (reference: string) => {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  return [...letters].reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0
  );
};

const dateToExcelSerial = (value: Date) =>
  (Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) -
    Date.UTC(1899, 11, 30)) /
  86_400_000;

const worksheetXml = ({ rows, widths }: XlsxSheet) => {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, cellIndex) => {
          const reference = `${columnName(cellIndex + 1)}${rowIndex + 1}`;
          if (value instanceof Date) {
            return `<c r="${reference}" s="2"><v>${dateToExcelSerial(value)}</v></c>`;
          }
          if (typeof value === "number") {
            return `<c r="${reference}"><v>${value}</v></c>`;
          }
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const columns = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    )
    .join("");
  const lastCell = `${columnName(widths.length)}${Math.max(rows.length, 1)}`;

  return `${XML_HEADER}<worksheet xmlns="${SPREADSHEET_NAMESPACE}"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
};

export const createXlsx = (sheets: XlsxSheet[]) => {
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRelationships = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const sheetTags = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const workbook = `${XML_HEADER}<workbook xmlns="${SPREADSHEET_NAMESPACE}" xmlns:r="${RELATIONSHIPS_NAMESPACE}"><sheets>${sheetTags}</sheets></workbook>`;
  const sheetRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="${RELATIONSHIPS_NAMESPACE}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const workbookRelationships = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${sheets.length + 1}" Type="${RELATIONSHIPS_NAMESPACE}/styles" Target="styles.xml"/></Relationships>`;
  const styles = `${XML_HEADER}<styleSheet xmlns="${SPREADSHEET_NAMESPACE}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRelationships),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelationships),
    "xl/styles.xml": strToU8(styles),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet));
  });
  return zipSync(files, { level: 6 });
};

const normalizeZipPath = (target: string) => {
  const raw = target.startsWith("/")
    ? target.slice(1)
    : target.startsWith("xl/")
      ? target
      : `xl/${target}`;
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
};

const readWorksheetRows = (worksheet: string, sharedStrings: string[]) => {
  const rows: XlsxReadRow[] = [];
  for (const rowMatch of worksheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)) {
    const rowNumber = Number(getXmlAttribute(rowMatch[1], "r"));
    const cells = new Map<number, string>();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const reference = getXmlAttribute(cellMatch[1], "r");
      const type = getXmlAttribute(cellMatch[1], "t");
      const body = cellMatch[2];
      let value = "";
      if (type === "inlineStr") {
        value = getTextNodes(body);
      } else {
        const rawValue = decodeXml(body.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "");
        value = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : rawValue;
      }
      const index = columnIndex(reference);
      if (index > 0) cells.set(index, value);
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
};

export const listXlsxSheets = (file: ArrayBuffer) => {
  let archive: ReturnType<typeof unzipSync>;
  try {
    archive = unzipSync(new Uint8Array(file));
  } catch {
    throw new Error("O arquivo .xlsx esta corrompido ou fora do formato esperado.");
  }
  const workbookBytes = archive["xl/workbook.xml"];
  if (!workbookBytes) {
    throw new Error("O arquivo nao possui a estrutura de uma planilha Excel valida.");
  }
  const workbook = strFromU8(workbookBytes);
  return [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)]
    .map((match) => getXmlAttribute(match[1], "name"))
    .filter(Boolean);
};

export const readXlsxSheet = (file: ArrayBuffer, sheetName: string) => {
  let archive: ReturnType<typeof unzipSync>;
  try {
    archive = unzipSync(new Uint8Array(file));
  } catch {
    throw new Error("O arquivo .xlsx esta corrompido ou fora do formato esperado.");
  }
  const workbookBytes = archive["xl/workbook.xml"];
  const relationshipBytes = archive["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relationshipBytes) {
    throw new Error("O arquivo nao possui a estrutura de uma planilha Excel valida.");
  }
  const workbook = strFromU8(workbookBytes);
  const sheetTag = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)].find(
    (match) => getXmlAttribute(match[1], "name") === sheetName
  );
  if (!sheetTag) throw new Error(`A planilha precisa conter uma aba chamada "${sheetName}".`);
  const relationshipId = getXmlAttribute(sheetTag[1], "r:id");
  const relationships = strFromU8(relationshipBytes);
  const relationshipTag = [
    ...relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi),
  ].find((match) => getXmlAttribute(match[1], "Id") === relationshipId);
  const worksheetPath = relationshipTag
    ? normalizeZipPath(getXmlAttribute(relationshipTag[1], "Target"))
    : "";
  const worksheetBytes = archive[worksheetPath];
  if (!worksheetBytes) throw new Error(`Nao foi possivel localizar a aba ${sheetName}.`);
  const sharedStringsBytes = archive["xl/sharedStrings.xml"];
  const sharedStrings = sharedStringsBytes
    ? [...strFromU8(sharedStringsBytes).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map(
        (match) => getTextNodes(match[1])
      )
    : [];
  return readWorksheetRows(strFromU8(worksheetBytes), sharedStrings);
};
