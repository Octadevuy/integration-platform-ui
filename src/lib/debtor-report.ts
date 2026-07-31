import type { DebtCategoryLineDto, DebtorReportDto } from "../types/admin"

// Spanish display names for the coarse categories, used for lines cached
// before the backend exposed conceptDescription.
export const categoryLabels: Record<string, string> = {
  CURRENT: "Vigente",
  CURRENT_NON_AUTO_LIQUIDATING: "Vigente - no autoliquidable",
  // CONTINGENT aggregates contingencias, contratos suscriptos and the three
  // garantías rubros, so the bare "Contingencias" label would be misleading.
  CONTINGENT: "Contingencias y garantías",
  WRITTEN_OFF: "Vencido y castigado",
  PROVISIONS: "Previsiones",
}

export function lineLabel(line: DebtCategoryLineDto) {
  return line.conceptDescription ?? categoryLabels[line.category] ?? line.category
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-"

  return value.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Raw BCU rating codes as shown on the BCU site (the API sends enum names like "C1C").
export const ratingLabels: Record<string, string> = {
  C1A: "1A",
  C1C: "1C",
  C2A: "2A",
  C2B: "2B",
  C3: "3",
  C4: "4",
  C5: "5",
  UNCLASSIFIED: "Sin clasificar",
  OTHER: "Otro",
}

export interface RubroLineRow {
  label: string
  mn: number
  me: number
}

// One group of the per-period table, mirroring the BCU site layout: a "Total"
// section followed by one section per institution, each listing its rubros.
export interface ReportSection {
  title: string
  rating?: string
  rows: RubroLineRow[]
}

// The "Total" section on the BCU site lists per-rubro sums across institutions,
// so totals are computed here from the institution lines (the API's `totals`
// field aggregates by coarse category instead and is not shown in this table).
export function buildSections(report: DebtorReportDto): ReportSection[] {
  const totals = new Map<string, RubroLineRow>()
  const institutionSections: ReportSection[] = []

  for (const institution of report.institutions) {
    const rows: RubroLineRow[] = []

    for (const line of institution.lines) {
      const label = lineLabel(line)
      const mn = line.amounts?.localPesos?.value ?? 0
      const me = line.amounts?.foreignUsd?.value ?? 0

      rows.push({ label, mn, me })

      const key = line.concept ?? line.category
      const total = totals.get(key)
      if (total) {
        total.mn += mn
        total.me += me
      } else {
        totals.set(key, { label, mn, me })
      }
    }

    institutionSections.push({
      title: institution.institutionName,
      rating: institution.rating,
      rows,
    })
  }

  const totalSection: ReportSection = { title: "Total", rows: [...totals.values()] }
  return [totalSection, ...institutionSections]
}
