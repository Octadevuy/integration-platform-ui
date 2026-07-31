import { describe, expect, it } from "vitest"

import { buildSections, formatNumber, lineLabel } from "./debtor-report"
import type {
  AmountByCurrencyDto,
  DebtCategoryLineDto,
  DebtorReportDto,
  InstitutionDebtDto,
} from "../types/admin"

function amounts(mn: number, meUsd: number): AmountByCurrencyDto {
  return {
    localPesos: { value: mn, currency: "LOCAL" },
    foreignPesos: { value: 0, currency: "FOREIGN_LOCAL" },
    foreignUsd: { value: meUsd, currency: "FOREIGN_USD" },
  }
}

function line(
  concept: string,
  conceptDescription: string,
  mn: number,
  meUsd: number,
): DebtCategoryLineDto {
  return { concept, conceptDescription, category: "CURRENT", amounts: amounts(mn, meUsd) }
}

function institution(
  name: string,
  rating: string,
  lines: DebtCategoryLineDto[],
): InstitutionDebtDto {
  return { institutionName: name, institutionCode: null, rating, lines }
}

function report(institutions: InstitutionDebtDto[]): DebtorReportDto {
  return {
    period: "2026-04",
    exchangeRate: 40.253,
    totals: [],
    institutions,
    generatedAt: "2026-05-01T00:00:00Z",
    fromCache: false,
  }
}

// Mirrors the real case verified against the BCU site (MEYER FREITAS, 2026-04):
// Total VIGENTE = 44,968.61 + 4,942,664.10 across BROU and Scotiabank.
describe("buildSections", () => {
  it("sums totals per rubro across institutions, in both currencies", () => {
    const sections = buildSections(
      report([
        institution("BROU", "C1C", [
          line("VIGENTE", "Vigente", 44968.61, 120.36),
          line("CONTINGENCIAS", "Contingencias", 87738.45, 0),
        ]),
        institution("Scotiabank", "C1C", [
          line("VIGENTE", "Vigente", 4942664.1, 498516.91),
          line("GARANTIAS_COMPUTABLES", "Garantias Computables", 5490106.42, 0),
        ]),
      ]),
    )

    const total = sections[0]
    expect(total.title).toBe("Total")
    expect(total.rows).toEqual([
      { label: "Vigente", mn: 44968.61 + 4942664.1, me: 120.36 + 498516.91 },
      { label: "Contingencias", mn: 87738.45, me: 0 },
      { label: "Garantias Computables", mn: 5490106.42, me: 0 },
    ])
  })

  it("keeps one section per institution, in order, with its rating and rows", () => {
    const sections = buildSections(
      report([
        institution("BROU", "C1C", [line("VIGENTE", "Vigente", 100, 0)]),
        institution("PASS CARD S.A.", "C5", [
          line("CASTIGADO_ATRASO", "Castigado - Por atraso", 5777.19, 0),
        ]),
      ]),
    )

    expect(sections.map((s) => s.title)).toEqual(["Total", "BROU", "PASS CARD S.A."])
    expect(sections[1].rating).toBe("C1C")
    expect(sections[2].rating).toBe("C5")
    expect(sections[2].rows).toEqual([
      { label: "Castigado - Por atraso", mn: 5777.19, me: 0 },
    ])
  })

  it("does not merge distinct rubros that share a category", () => {
    const sections = buildSections(
      report([
        institution("A", "C1C", [
          line("VIGENTE", "Vigente", 100, 0),
          line("VIGENTE_CREDITOS_COMUNES", "Vigente - Créditos comunes", 100, 0),
        ]),
      ]),
    )

    expect(sections[0].rows.map((r) => r.label)).toEqual([
      "Vigente",
      "Vigente - Créditos comunes",
    ])
  })
})

describe("lineLabel", () => {
  it("prefers conceptDescription and falls back to the category label for legacy cache lines", () => {
    expect(lineLabel(line("VIGENTE", "Vigente", 0, 0))).toBe("Vigente")
    expect(
      lineLabel({ category: "CONTINGENT", amounts: amounts(0, 0) }),
    ).toBe("Contingencias y garantías")
    expect(lineLabel({ category: "DESCONOCIDA", amounts: amounts(0, 0) })).toBe("DESCONOCIDA")
  })
})

describe("formatNumber", () => {
  it("formats es-UY with two decimals and handles missing values", () => {
    expect(formatNumber(4987632.71)).toBe("4.987.632,71")
    expect(formatNumber(0)).toBe("0,00")
    expect(formatNumber(null)).toBe("-")
    expect(formatNumber(Number.NaN)).toBe("-")
  })
})
