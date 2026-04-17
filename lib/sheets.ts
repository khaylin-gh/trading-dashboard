export async function getSheetData() {
  const res = await fetch(
    process.env.NEXT_PUBLIC_SHEET_CSV_URL!
  );

  const text = await res.text();

  return text.split("\n").map((row) => row.split(","));
}
