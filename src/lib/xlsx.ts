import { zipStore } from "@/lib/zip";

export type Cell = string | { amount: number };

export type ClaimItem = {
  reference: string;
  description: string;
  amount: number;
};

export type ClaimForm = {
  staffName: string;
  monthYear: string;
  items: ClaimItem[];
};

export type Sheet = {
  name: string;
  rows?: Cell[][];
  amountColumn?: number;
  claim?: ClaimForm;
};

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sheetName(input: string, used: Set<string>): string {
  const cleaned = input.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim() || "User";
  const base = cleaned.slice(0, 31);
  let name = base;
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    const tail = ` (${suffix})`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function isAmount(value: Cell): value is { amount: number } {
  return typeof value === "object" && value !== null && "amount" in value;
}

function xmlNumber(value: number): string {
  const rounded = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  return rounded.toFixed(2);
}

function textCell(ref: string, value: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function amountCell(ref: string, value: number): string {
  return `<c r="${ref}" s="1"><v>${xmlNumber(value)}</v></c>`;
}

const CLAIM_ITEM_ROWS = 20;

function claimWorksheetXml(claim: ClaimForm): string {
  const itemCount = Math.max(CLAIM_ITEM_ROWS, claim.items.length);
  const firstItemRow = 6;
  const lastItemRow = firstItemRow + itemCount - 1;
  const totalRow = lastItemRow + 1;
  const rows = new Map<number, { attrs: string; cells: string[] }>();
  const merges = ["A1:J1", "A3:B3", "C3:D3", "E3:G3", "I3:J3", "B5:C5", "D5:I5"];

  function ensure(row: number, attrs: string) {
    const current = rows.get(row);
    if (current) {
      return current;
    }
    const created = { attrs, cells: [] as string[] };
    rows.set(row, created);
    return created;
  }

  function text(row: number, column: number, value: string, style: number, attrs = "") {
    const record = ensure(row, attrs);
    record.cells[column] = `<c r="${columnName(column)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }

  function blank(row: number, column: number, style: number, attrs = "") {
    const record = ensure(row, attrs);
    record.cells[column] = `<c r="${columnName(column)}${row}" s="${style}"/>`;
  }

  function amount(row: number, column: number, value: number | undefined, style: number, attrs = "") {
    const record = ensure(row, attrs);
    const ref = `${columnName(column)}${row}`;
    record.cells[column] =
      value === undefined ? `<c r="${ref}" s="${style}"/>` : `<c r="${ref}" s="${style}"><v>${xmlNumber(value)}</v></c>`;
  }

  text(1, 0, "Expense Claim Form", 15, ' ht="50" customHeight="1"');
  for (let column = 1; column <= 9; column += 1) {
    blank(1, column, 16);
  }
  ensure(2, ' ht="40" customHeight="1"');
  text(3, 0, "Staff Name:", 10, ' ht="40" customHeight="1"');
  blank(3, 1, 9);
  text(3, 2, claim.staffName, 14);
  blank(3, 3, 14);
  text(3, 4, "Month/Year:", 18);
  blank(3, 5, 18);
  blank(3, 6, 18);
  blank(3, 7, 19);
  text(3, 8, claim.monthYear, 14);
  blank(3, 9, 14);
  ensure(4, ' ht="40" customHeight="1" thickBot="1"');

  const headerAttrs = ' ht="40" customHeight="1" thickBot="1"';
  text(5, 0, "Item", 24, headerAttrs);
  text(5, 1, "Reference No", 25);
  blank(5, 2, 25);
  text(5, 3, "Description", 25);
  for (let column = 4; column <= 8; column += 1) {
    blank(5, column, 25);
  }
  text(5, 9, "Amount", 26);

  for (let index = 0; index < itemCount; index += 1) {
    const row = firstItemRow + index;
    const item = claim.items[index];
    const first = row === firstItemRow;
    const last = row === lastItemRow;
    const itemStyle = first ? 27 : last ? 31 : 29;
    const textStyle = first ? 20 : last ? 32 : 37;
    const descriptionStyle = first ? 34 : last ? 36 : 35;
    const amountStyle = first ? 28 : last ? 33 : 30;
    const attrs = ` s="17" customFormat="1" ht="40" customHeight="1"${first ? ' thickTop="1"' : ""}${last ? ' thickBot="1"' : ""}`;
    merges.push(`B${row}:C${row}`, `D${row}:I${row}`);
    text(row, 0, String(index + 1), itemStyle, attrs);
    text(row, 1, item?.reference ?? "", textStyle);
    blank(row, 2, textStyle);
    text(row, 3, item?.description ?? "", descriptionStyle);
    for (let column = 4; column <= 8; column += 1) {
      blank(row, column, descriptionStyle);
    }
    amount(row, 9, item ? item.amount : undefined, amountStyle);
  }

  const sum = claim.items.reduce((total, item) => total + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  text(totalRow, 8, "Total:", 22, ' s="17" customFormat="1" ht="40" customHeight="1" thickBot="1"');
  ensure(totalRow, "").cells[9] =
    `<c r="J${totalRow}" s="23"><f>SUM(J${firstItemRow}:J${lastItemRow})</f><v>${xmlNumber(sum)}</v></c>`;
  ensure(totalRow + 1, ' ht="40" customHeight="1"');

  const body = [...rows.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([row, record]) => `<row r="${row}"${record.attrs}>${record.cells.filter(Boolean).join("")}</row>`)
    .join("");
  const mergeXml = merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J${totalRow + 1}"/><sheetFormatPr defaultRowHeight="40"/><cols><col min="1" max="1" width="7.08984375" customWidth="1"/><col min="2" max="2" width="6.7265625" customWidth="1"/><col min="3" max="3" width="9.54296875" customWidth="1"/><col min="4" max="5" width="14" customWidth="1"/><col min="6" max="6" width="4.453125" customWidth="1"/><col min="7" max="7" width="14" hidden="1" customWidth="1"/><col min="8" max="8" width="3.6328125" customWidth="1"/><col min="9" max="9" width="14" customWidth="1"/><col min="10" max="10" width="14" style="17" customWidth="1"/></cols><sheetData>${body}</sheetData><mergeCells count="${merges.length}">${mergeXml}</mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

function worksheetXml(rows: Cell[][], amountColumn?: number): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (columnIndex === amountColumn && isAmount(value)) {
            return amountCell(ref, value.amount);
          }
          return textCell(ref, typeof value === "string" ? value : "");
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const total =
    amountColumn === undefined || rows.length < 2
      ? ""
      : (() => {
          const column = columnName(amountColumn);
          const first = 2;
          const last = rows.length;
          const totalRow = last + 1;
          const sum = rows.slice(1).reduce((totalAmount, row) => {
            const value = row[amountColumn];
            return totalAmount + (isAmount(value) ? value.amount : 0);
          }, 0);
          const label =
            amountColumn > 0 ? textCell(`${columnName(amountColumn - 1)}${totalRow}`, "Total") : "";
          return `<row r="${totalRow}">${label}<c r="${column}${totalRow}" s="1"><f>SUM(${column}${first}:${column}${last})</f><v>${xmlNumber(sum)}</v></c></row>`;
        })();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}${total}</sheetData></worksheet>`;
}

export function buildWorkbook(sheets: Sheet[]): Buffer {
  const used = new Set<string>();
  const named = sheets.map((sheet, index) => ({
    file: `xl/worksheets/sheet${index + 1}.xml`,
    name: sheetName(sheet.name, used),
    xml: sheet.claim ? claimWorksheetXml(sheet.claim) : worksheetXml(sheet.rows ?? [], sheet.amountColumn),
  }));
  const sheetTags = named
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const sheetRels = named
    .map(
      (sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>${index === named.length - 1 ? `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` : ""}`
    )
    .join("");
  const overrides = named
    .map(
      (sheet) =>
        `<Override PartName="/${sheet.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");

  return zipStore([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}</Relationships>`
      ),
    },
    {
      name: "xl/styles.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="9"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="9"/><name val="PMingLiU"/></font><font><b/><sz val="20"/><name val="Calibri"/></font><font><sz val="18"/><name val="Calibri"/></font><font><b/><sz val="20"/><name val="Calibri"/></font><font><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="15"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border><border><left/><right/><top/><bottom style="thin"/><diagonal/></border><border><left style="thin"/><right style="thin"/><top/><bottom style="thin"/><diagonal/></border><border><left style="medium"/><right style="medium"/><top/><bottom style="medium"/><diagonal/></border><border><left style="medium"/><right style="thin"/><top style="medium"/><bottom style="double"/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="medium"/><bottom style="double"/><diagonal/></border><border><left style="thin"/><right style="medium"/><top style="medium"/><bottom style="double"/><diagonal/></border><border><left style="medium"/><right style="thin"/><top/><bottom style="thin"/><diagonal/></border><border><left style="thin"/><right style="medium"/><top/><bottom style="thin"/><diagonal/></border><border><left style="medium"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border><border><left style="thin"/><right style="medium"/><top style="thin"/><bottom style="thin"/><diagonal/></border><border><left style="medium"/><right style="thin"/><top style="thin"/><bottom style="medium"/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="medium"/><diagonal/></border><border><left style="thin"/><right style="medium"/><top style="thin"/><bottom style="medium"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment vertical="center"/></xf></cellStyleXfs><cellXfs count="38"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="2" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"/><xf numFmtId="0" fontId="7" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="2" fontId="8" fillId="0" borderId="4" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="5" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="6" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="8" fillId="0" borderId="7" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="8" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="2" fontId="7" fillId="0" borderId="9" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="10" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="2" fontId="7" fillId="0" borderId="11" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="12" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="13" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="2" fontId="7" fillId="0" borderId="14" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="13" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>`
      ),
    },
    ...named.map((sheet) => ({ name: sheet.file, data: Buffer.from(sheet.xml) })),
  ]);
}
