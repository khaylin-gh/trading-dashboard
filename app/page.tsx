import { getDashboardData } from "@/lib/sheets";

function panelStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
  };
}

export default async function Home() {
  const data = await getDashboardData();

  return (
    <main
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        margin: "0 auto",
        maxWidth: 1080,
        padding: "24px 16px 40px",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Trading Dashboard</h1>
        <p style={{ marginTop: 6, color: "#475569" }}>
          Data source: Google Sheets CSV • Sheet tabs like "4/16" are interpreted as April 16, 2026.
        </p>
        <p style={{ marginTop: 4, fontWeight: 600 }}>As of: {data.asOfLabel}</p>
      </header>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          alignItems: "start",
        }}
      >
        <article style={panelStyle()}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Themes</h2>
          {data.themes.length === 0 ? (
            <p style={{ color: "#64748b" }}>No theme data found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {data.themes.map((theme) => (
                <li
                  key={theme.theme}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 10,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{theme.theme}</strong>
                    <span>Avg Score: {theme.avgScore.toFixed(1)}</span>
                  </div>
                  <div style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>
                    Ideas: {theme.ideas} • Leaders: {theme.leaders.join(", ") || "-"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article style={panelStyle()}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Ranked Watchlist</h2>
          {data.watchlist.length === 0 ? (
            <p style={{ color: "#64748b" }}>No watchlist rows found.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10 }}>
              {data.watchlist.slice(0, 12).map((row, index) => (
                <li key={`${row.symbol}-${index}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{row.symbol}</strong>
                    <span>Rank {row.rank ?? index + 1}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>
                    {row.theme} • Score {row.score ?? "-"} • Change {row.changePercent ?? "-"}%
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article style={panelStyle()}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Risk Panel</h2>
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Avg Risk Score: <strong>{data.risk.averageRisk.toFixed(2)}</strong>
            </div>
            <div>
              High Risk (≥7): <strong>{data.risk.highRiskCount}</strong>
            </div>
            <div>
              Low Risk (≤3): <strong>{data.risk.lowRiskCount}</strong>
            </div>
            <div>
              Highest Risk Symbols: <strong>{data.risk.topRiskSymbols.join(", ") || "-"}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
