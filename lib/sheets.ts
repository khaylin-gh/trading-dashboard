const TAB_YEAR = 2026;

export type DashboardRow = {
  tab?: string;
  date?: Date;
  theme: string;
  symbol: string;
  rank: number | null;
  score: number | null;
  changePercent: number | null;
  riskScore: number | null;
  notes?: string;
};

export type ThemeSummary = {
  theme: string;
  ideas: number;
  avgScore: number;
  leaders: string[];
};

export type RiskSummary = {
  averageRisk: number;
  highRiskCount: number;
  lowRiskCount: number;
  topRiskSymbols: string[];
};

export type DashboardData = {
  asOfLabel: string;
  rows: DashboardRow[];
  themes: ThemeSummary[];
  watchlist: DashboardRow[];
  risk: RiskSummary;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }

      row.push(current.trim());
      current = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/%/g, "").replace(/\$/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTabDate(tab: string | undefined): Date | undefined {
  if (!tab) return undefined;
  const match = tab.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return undefined;

  const month = Number(match[1]);
  const day = Number(match[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  return new Date(Date.UTC(TAB_YEAR, month - 1, day));
}

function pickValue(record: Record<string, string>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    if (record[key]) return record[key];
  }

  return undefined;
}

export async function getDashboardData(): Promise<DashboardData> {
  const url = process.env.NEXT_PUBLIC_SHEET_CSV_URL;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SHEET_CSV_URL environment variable.");
  }

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch sheet data (${res.status})`);
  }

  const raw = await res.text();
  const [headers, ...lines] = parseCsv(raw);

  if (!headers) {
    return {
      asOfLabel: "No data",
      rows: [],
      themes: [],
      watchlist: [],
      risk: {
        averageRisk: 0,
        highRiskCount: 0,
        lowRiskCount: 0,
        topRiskSymbols: [],
      },
    };
  }

  const headerIndex = headers.map((header) => header.toLowerCase().trim());

  const rows: DashboardRow[] = lines
    .map((line) => {
      const record: Record<string, string> = {};

      headerIndex.forEach((header, index) => {
        record[header] = (line[index] ?? "").trim();
      });

      const tab = pickValue(record, ["tab", "sheet", "sheet_tab", "date_tab", "session"]);
      const date = parseTabDate(tab);

      return {
        tab,
        date,
        theme: pickValue(record, ["theme", "sector", "basket"]) ?? "Uncategorized",
        symbol: pickValue(record, ["symbol", "ticker", "name"]) ?? "N/A",
        rank: parseNumber(pickValue(record, ["rank", "watchlist_rank", "priority"])),
        score: parseNumber(pickValue(record, ["score", "setup_score", "conviction"])),
        changePercent: parseNumber(pickValue(record, ["change", "chg", "change%", "change_percent"])),
        riskScore: parseNumber(pickValue(record, ["risk", "risk_score", "riskscore"])),
        notes: pickValue(record, ["notes", "thesis", "comment"]),
      };
    })
    .filter((row) => row.symbol !== "N/A");

  const latestTimestamp = rows.reduce((latest, row) => {
    if (!row.date) return latest;
    const current = row.date.getTime();
    return current > latest ? current : latest;
  }, 0);

  const scopedRows = latestTimestamp
    ? rows.filter((row) => row.date?.getTime() === latestTimestamp)
    : rows;

  const asOfLabel = latestTimestamp
    ? new Date(latestTimestamp).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "No date tab available";

  const themeMap = new Map<string, DashboardRow[]>();

  for (const row of scopedRows) {
    const bucket = themeMap.get(row.theme) ?? [];
    bucket.push(row);
    themeMap.set(row.theme, bucket);
  }

  const themes = Array.from(themeMap.entries())
    .map(([theme, themeRows]) => {
      const scoredRows = themeRows.filter((row) => row.score !== null);
      const avgScore = scoredRows.length
        ? scoredRows.reduce((sum, row) => sum + (row.score ?? 0), 0) / scoredRows.length
        : 0;

      const leaders = [...themeRows]
        .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
        .slice(0, 2)
        .map((row) => row.symbol);

      return {
        theme,
        ideas: themeRows.length,
        avgScore,
        leaders,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  const watchlist = [...scopedRows].sort((a, b) => {
    const rankA = a.rank ?? Number.POSITIVE_INFINITY;
    const rankB = b.rank ?? Number.POSITIVE_INFINITY;

    if (rankA !== rankB) return rankA - rankB;

    return (b.score ?? -Infinity) - (a.score ?? -Infinity);
  });

  const riskRows = scopedRows.filter((row) => row.riskScore !== null);
  const averageRisk = riskRows.length
    ? riskRows.reduce((sum, row) => sum + (row.riskScore ?? 0), 0) / riskRows.length
    : 0;

  const highRiskCount = riskRows.filter((row) => (row.riskScore ?? 0) >= 7).length;
  const lowRiskCount = riskRows.filter((row) => (row.riskScore ?? 0) <= 3).length;

  const topRiskSymbols = [...riskRows]
    .sort((a, b) => (b.riskScore ?? -Infinity) - (a.riskScore ?? -Infinity))
    .slice(0, 3)
    .map((row) => row.symbol);

  return {
    asOfLabel,
    rows: scopedRows,
    themes,
    watchlist,
    risk: {
      averageRisk,
      highRiskCount,
      lowRiskCount,
      topRiskSymbols,
    },
  };
}
