import * as XLSX from "xlsx";

export type StructuredExercise = {
  name: string;
  weeks: string[]; // one entry per week column
  note: string;
};

export type StructuredBlock = {
  name: string; // ex: "Treino A"
  day: string | null; // ex: "Segunda"
  exercises: StructuredExercise[];
};

export type StructuredPlan = {
  weeks: string[]; // ex: ["Semana 1", ..., "Semana 8"]
  blocks: StructuredBlock[];
  abdomen: StructuredExercise[];
  cardio: StructuredExercise[];
  tips: string[];
};

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function isAllEmpty(arr: string[]): boolean {
  return arr.every((x) => x === "");
}

/**
 * Parse a workout XLSX following the ANTIFOFISTA SQUAD layout:
 * Row N: "Exercício" | "Semana 1" | "Semana 2" | ... | "Observação"
 * Following rows: section headers ("Treino A - Segunda", "ABDOMINAL",
 *   "Cardio", "Dicas e Considerações") and exercise rows.
 */
export async function parseTrainingXlsx(file: File): Promise<StructuredPlan> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  // Find header row (col A == "Exercício" / "Exercicio")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const first = cellText(rows[i]?.[0]).toLowerCase();
    if (first.startsWith("exerc")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("Cabeçalho 'Exercício' não encontrado.");
  const header = rows[headerIdx].map(cellText);

  // Week columns: contiguous columns whose header starts with "Semana"
  const weekCols: number[] = [];
  const weekLabels: string[] = [];
  for (let c = 1; c < header.length; c++) {
    if (/^semana\s*\d+/i.test(header[c])) {
      weekCols.push(c);
      weekLabels.push(header[c]);
    } else if (weekCols.length > 0) {
      break;
    }
  }
  if (!weekCols.length) throw new Error("Nenhuma coluna 'Semana N' encontrada.");

  // Note column: first non-week, non-empty header column after the weeks.
  // If none labeled, fall back to (last week col + 1).
  const afterWeeks = weekCols[weekCols.length - 1] + 1;
  let noteCol = -1;
  for (let c = afterWeeks; c < header.length; c++) {
    const h = header[c].toLowerCase();
    if (h && !h.startsWith("semana") && h !== "***") {
      noteCol = c;
      break;
    }
  }
  if (noteCol === -1) noteCol = afterWeeks;

  const plan: StructuredPlan = {
    weeks: weekLabels,
    blocks: [],
    abdomen: [],
    cardio: [],
    tips: [],
  };

  type Mode = "block" | "abdomen" | "cardio" | "tips";
  let mode: Mode = "block";
  let currentBlock: StructuredBlock | null = null;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = cellText(row[0]);
    const weekVals = weekCols.map((c) => cellText(row[c]));
    const note = cellText(row[noteCol]);

    if (!name && isAllEmpty(weekVals) && !note) continue;

    // Section / block header detection: name present, all week cells empty
    if (name && isAllEmpty(weekVals)) {
      const lower = name.toLowerCase();
      const treinoMatch = name.match(/^treino\s+([A-Za-z])(?:\s*[-–]\s*(.+))?$/i);
      if (treinoMatch) {
        const blk: StructuredBlock = {
          name: `Treino ${treinoMatch[1].toUpperCase()}`,
          day: treinoMatch[2] ? treinoMatch[2].trim() : null,
          exercises: [],
        };
        plan.blocks.push(blk);
        currentBlock = blk;
        mode = "block";
        continue;
      }
      if (lower.startsWith("abd")) {
        mode = "abdomen";
        currentBlock = null;
        continue;
      }
      if (lower.startsWith("cardio")) {
        mode = "cardio";
        currentBlock = null;
        continue;
      }
      if (lower.startsWith("dicas")) {
        mode = "tips";
        currentBlock = null;
        continue;
      }
      // Unknown header label — if in tips mode keep collecting; else ignore
      if (mode === "tips") {
        plan.tips.push(name);
      }
      continue;
    }

    if (mode === "tips") {
      if (name) plan.tips.push(name);
      continue;
    }

    // Exercise row
    const ex: StructuredExercise = { name, weeks: weekVals, note };
    if (mode === "block") {
      if (!currentBlock) {
        currentBlock = { name: "Treino", day: null, exercises: [] };
        plan.blocks.push(currentBlock);
      }
      currentBlock.exercises.push(ex);
    } else if (mode === "abdomen") {
      plan.abdomen.push(ex);
    } else if (mode === "cardio") {
      plan.cardio.push(ex);
    }
  }

  return plan;
}

/** Parse "3x5a9", "3x12 a 15", "4x(3x2)", "3x10(DSDN)", "3x20", "4xRM", "25-35 min" */
export function describeCell(value: string): {
  sets?: string;
  reps?: string;
  technique?: string;
  raw: string;
} {
  const raw = value.trim();
  if (!raw) return { raw };

  // Technique in parens: 3x10(DSDN)
  const parenMatch = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  let core = raw;
  let technique: string | undefined;
  if (parenMatch) {
    core = parenMatch[1].trim();
    technique = parenMatch[2].trim();
  }

  // NxRange: N x A (a B)?
  const m = core.match(/^(\d+)\s*x\s*(\d+)(?:\s*a\s*(\d+))?\s*$/i);
  if (m) {
    return {
      sets: m[1],
      reps: m[3] ? `${m[2]} a ${m[3]}` : m[2],
      technique,
      raw,
    };
  }
  // NxRM
  const rm = core.match(/^(\d+)\s*x\s*RM\s*$/i);
  if (rm) return { sets: rm[1], reps: "RM", technique, raw };

  return { raw, technique };
}
