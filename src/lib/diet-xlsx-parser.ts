import * as XLSX from "xlsx";

export type Supplement = { nome: string; dose: string; horario: string };
export type MealItem = { alimento: string; quantidade: string; medida: string };
export type Meal = { nome: string; itens: MealItem[] };

export type DietPlan = {
  suplementos: Supplement[];
  refeicoes: Meal[];
  observacoes: string;
};

const SHEET_NAME = "IMPRESSÃO";

function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findSheet(wb: XLSX.WorkBook): string {
  const target = norm(SHEET_NAME);
  const match = wb.SheetNames.find((n) => norm(n) === target);
  if (!match) {
    throw new Error(
      `Aba "${SHEET_NAME}" não encontrada. Abas disponíveis: ${wb.SheetNames.join(", ")}`,
    );
  }
  return match;
}

/** Pull rows as a 2D string matrix sized to max column. */
function readMatrix(ws: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: true,
    defval: "",
  });
  const width = rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  return rows.map((r) => {
    const row = new Array<string>(width).fill("");
    for (let i = 0; i < width; i++) row[i] = txt(r?.[i]);
    return row;
  });
}

function isAlimentoHeader(v: string): boolean {
  return norm(v) === "alimento";
}
function isQtdHeader(v: string): boolean {
  const n = norm(v);
  return n === "qtd" || n === "qtd." || n === "quantidade" || n === "qtde" || n === "qtde.";
}
function isMedidaHeader(v: string): boolean {
  const n = norm(v);
  return n === "medida" || n === "unidade" || n === "unid" || n === "un";
}

function cleanQty(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (/^0+([.,]0+)?$/.test(t)) return "";
  return t;
}
function cleanMedida(v: string): string {
  const t = v.trim();
  if (!t || /^0+$/.test(t)) return "";
  return t;
}
function isBlankName(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  if (/^0+([.,]0+)?$/.test(t)) return true;
  if (/^-+$/.test(t)) return true;
  // time placeholders like "00:00", "00:00:00", "0:00"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t) && /^[0:]+$/.test(t)) return true;
  // any cell composed only of zeros, separators and whitespace
  if (/^[0\s:.\-,/]+$/.test(t)) return true;
  return false;
}

function looksLikeTitle(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  if (isBlankName(t)) return false;
  // require at least one letter
  return /[A-Za-zÀ-ÿ]/.test(t);
}

function findSupplements(M: string[][]): Supplement[] {
  // Locate header row: contains "Nome", "Dose", "Horário"
  for (let r = 0; r < M.length; r++) {
    const row = M[r];
    let nomeCol = -1, doseCol = -1, horaCol = -1;
    for (let c = 0; c < row.length; c++) {
      const n = norm(row[c]);
      if (n === "nome") nomeCol = c;
      else if (n === "dose") doseCol = c;
      else if (n.startsWith("horario") || n.startsWith("horário") || n === "horario de uso" || n === "horário de uso")
        horaCol = c;
    }
    if (nomeCol >= 0 && doseCol >= 0 && horaCol >= 0) {
      const out: Supplement[] = [];
      for (let i = r + 1; i < M.length; i++) {
        const nome = M[i][nomeCol] ?? "";
        const dose = M[i][doseCol] ?? "";
        const hora = M[i][horaCol] ?? "";
        if (isBlankName(nome) && !dose.trim() && !hora.trim()) break;
        if (isBlankName(nome)) continue;
        out.push({ nome: nome.trim(), dose: dose.trim(), horario: hora.trim() });
      }
      return out;
    }
  }
  return [];
}

/** Find the meal title cell above an "Alimento" header cell (scan upward, skip blanks). */
function findMealTitleAbove(M: string[][], headerRow: number, alimentoCol: number): string {
  for (let r = headerRow - 1; r >= 0 && r >= headerRow - 6; r--) {
    const candidates = [
      M[r][alimentoCol],
      M[r][Math.max(0, alimentoCol - 1)],
      M[r][alimentoCol + 1] ?? "",
    ].map((s) => (s ?? "").trim());
    const found = candidates.find(
      (c) =>
        c &&
        !isBlankName(c) &&
        !isAlimentoHeader(c) &&
        !isQtdHeader(c) &&
        !isMedidaHeader(c),
    );
    if (found) return found;
  }
  return "Refeição";
}

function findMeals(M: string[][]): { meals: Meal[]; usedRows: Set<number> } {
  const meals: Meal[] = [];
  const usedRows = new Set<number>();
  type Header = { row: number; alimentoCol: number; qtdCol: number; medidaCol: number };
  const headers: Header[] = [];

  for (let r = 0; r < M.length; r++) {
    const row = M[r];
    for (let c = 0; c < row.length; c++) {
      if (!isAlimentoHeader(row[c])) continue;
      // Two columns to the right (skip blanks)
      let qtdCol = -1, medidaCol = -1;
      for (let k = c + 1; k < Math.min(row.length, c + 5); k++) {
        const cell = row[k];
        if (qtdCol === -1 && isQtdHeader(cell)) { qtdCol = k; continue; }
        if (qtdCol !== -1 && isMedidaHeader(cell)) { medidaCol = k; break; }
      }
      if (qtdCol === -1) qtdCol = c + 1;
      if (medidaCol === -1) medidaCol = c + 2;
      headers.push({ row: r, alimentoCol: c, qtdCol, medidaCol });
    }
  }

  // Sort by row then column so meal order matches visual flow (top-to-bottom, left-to-right)
  headers.sort((a, b) => a.row - b.row || a.alimentoCol - b.alimentoCol);

  // Determine stop row for each header: next blank row in its alimento column OR next header row
  for (let h = 0; h < headers.length; h++) {
    const head = headers[h];
    const nextHeaderRowInSameCol = headers
      .slice(h + 1)
      .find((x) => x.alimentoCol === head.alimentoCol)?.row ?? M.length;
    const items: MealItem[] = [];
    for (let r = head.row + 1; r < nextHeaderRowInSameCol; r++) {
      const rawName = (M[r][head.alimentoCol] ?? "").trim();
      if (isBlankName(rawName) || !/[A-Za-zÀ-ÿ]/.test(rawName)) {
        if (items.length > 0) break;
        else continue;
      }
      // If the name itself looks like a new section header (Alimento), stop
      if (isAlimentoHeader(rawName)) break;
      const nome = rawName;
      let qtd = cleanQty(M[r][head.qtdCol] ?? "");
      let medida = cleanMedida(M[r][head.medidaCol] ?? "");
      // "à vontade" handling: name contains "vontade" → ignore qty/medida noise
      if (/vontade/i.test(norm(nome))) {
        qtd = "";
        medida = "à vontade";
      }
      items.push({ alimento: nome, quantidade: qtd, medida });
      usedRows.add(r);
    }
    if (!items.length) continue; // skip empty meals
    const nome = findMealTitleAbove(M, head.row, head.alimentoCol);
    meals.push({ nome, itens: items });
  }
  return { meals, usedRows };
}

function findObservacoes(M: string[][]): string {
  for (let r = 0; r < M.length; r++) {
    for (let c = 0; c < M[r].length; c++) {
      const n = norm(M[r][c]);
      if (n === "observacoes" || n === "observações" || n === "obs" || n === "observacao" || n === "observação") {
        // Collect non-empty cells to the right and below until blank
        const parts: string[] = [];
        for (let k = c + 1; k < M[r].length; k++) {
          const v = M[r][k]?.trim();
          if (v) parts.push(v);
        }
        for (let rr = r + 1; rr < Math.min(M.length, r + 15); rr++) {
          const v = M[rr][c]?.trim();
          if (v) parts.push(v);
          else if (parts.length) break;
        }
        return parts.join(" ").trim();
      }
    }
  }
  return "";
}

export async function parseDietXlsx(file: File): Promise<DietPlan> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = findSheet(wb);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Aba IMPRESSÃO vazia.");
  const M = readMatrix(ws);
  const suplementos = findSupplements(M);
  const { meals } = findMeals(M);
  const observacoes = findObservacoes(M);
  return { suplementos, refeicoes: meals, observacoes };
}
