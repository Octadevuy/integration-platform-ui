import { ApiRequestError } from "@/lib/admin-api"
import type {
  DebtorReportQuery,
  DebtorReportResponseDto,
  ProblemDetail,
} from "@/types/admin"

async function parseError(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as ProblemDetail
    const message = payload.detail || payload.title || response.statusText || "Request failed"
    throw new ApiRequestError(message, response.status, payload)
  }

  const text = await response.text()
  throw new ApiRequestError(text || response.statusText || "Request failed", response.status, text)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path ? `/api/admin-debtors/${path}` : "/api/admin-debtors"

  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")

  if (init.body) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bcu:session-invalid"))
    }

    throw new ApiRequestError("Sesion no valida o expirada.", 401)
  }

  if (!response.ok) {
    await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function getDebtorReport(
  number: string,
  params: DebtorReportQuery,
): Promise<DebtorReportResponseDto> {
  const query = new URLSearchParams()
  query.set("documentType", params.documentType)
  if (params.country) query.set("country", params.country)
  if (params.periodFrom) query.set("periodFrom", params.periodFrom)
  if (params.periodTo) query.set("periodTo", params.periodTo)

  return request<DebtorReportResponseDto>(
    `${encodeURIComponent(number)}/report?${query.toString()}`,
  )
}
