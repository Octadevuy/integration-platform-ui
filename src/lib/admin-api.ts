import type {
  ApiKeyResponse,
  AuditEventQuery,
  AuditEventResponse,
  ConnectionSettings,
  CreateApiKeyRequest,
  CreateIntegrationClientRequest,
  IntegrationClientResponse,
  PermissionScopeResponse,
  ProblemDetail,
  UpdateIntegrationClientRequest,
} from "@/types/admin"

export class ApiRequestError extends Error {
  status: number
  payload?: ProblemDetail | string

  constructor(message: string, status: number, payload?: ProblemDetail | string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.payload = payload
  }
}

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

async function request<T>(
  settings: ConnectionSettings,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  void settings

  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")

  if (init.body) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(`/api/admin/${path}`, {
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

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Ocurrió un error inesperado."
}

export async function listClients(settings: ConnectionSettings) {
  return request<IntegrationClientResponse[]>(settings, "")
}

export async function createClient(
  settings: ConnectionSettings,
  payload: CreateIntegrationClientRequest,
) {
  return request<IntegrationClientResponse>(settings, "", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateClient(
  settings: ConnectionSettings,
  clientCode: string,
  payload: UpdateIntegrationClientRequest,
) {
  return request<IntegrationClientResponse>(settings, encodeURIComponent(clientCode), {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deactivateClient(settings: ConnectionSettings, clientCode: string) {
  return request<IntegrationClientResponse>(settings, encodeURIComponent(clientCode), {
    method: "DELETE",
  })
}

export async function listApiKeys(settings: ConnectionSettings, clientCode: string) {
  return request<ApiKeyResponse[]>(
    settings,
    `${encodeURIComponent(clientCode)}/api-keys`,
  )
}

export async function listScopes(settings: ConnectionSettings) {
  return request<PermissionScopeResponse[]>(settings, "scopes")
}

export async function createApiKey(
  settings: ConnectionSettings,
  clientCode: string,
  payload: CreateApiKeyRequest,
) {
  return request<ApiKeyResponse>(settings, `${encodeURIComponent(clientCode)}/api-keys`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function revokeApiKey(
  settings: ConnectionSettings,
  clientCode: string,
  keyPrefix: string,
) {
  return request<ApiKeyResponse>(
    settings,
    `${encodeURIComponent(clientCode)}/api-keys/${encodeURIComponent(keyPrefix)}/revoke`,
    {
      method: "POST",
    },
  )
}

export async function rotateApiKey(
  settings: ConnectionSettings,
  clientCode: string,
  keyPrefix: string,
  payload: CreateApiKeyRequest,
) {
  return request<ApiKeyResponse>(
    settings,
    `${encodeURIComponent(clientCode)}/api-keys/${encodeURIComponent(keyPrefix)}/rotate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export async function assignScope(
  settings: ConnectionSettings,
  clientCode: string,
  keyPrefix: string,
  scope: string,
) {
  return request<ApiKeyResponse>(
    settings,
    `${encodeURIComponent(clientCode)}/api-keys/${encodeURIComponent(keyPrefix)}/scopes/${encodeURIComponent(scope)}`,
    {
      method: "POST",
    },
  )
}

export async function removeScope(
  settings: ConnectionSettings,
  clientCode: string,
  keyPrefix: string,
  scope: string,
) {
  return request<ApiKeyResponse>(
    settings,
    `${encodeURIComponent(clientCode)}/api-keys/${encodeURIComponent(keyPrefix)}/scopes/${encodeURIComponent(scope)}`,
    {
      method: "DELETE",
    },
  )
}

export async function listAuditEvents(
  settings: ConnectionSettings,
  query: AuditEventQuery = {},
) {
  const params = new URLSearchParams()
  if (query.clientCode) params.set("clientCode", query.clientCode)
  if (query.action) params.set("action", query.action)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (typeof query.page === "number") params.set("page", String(query.page))
  if (typeof query.size === "number") params.set("size", String(query.size))
  const qs = params.toString()
  return request<AuditEventResponse[]>(settings, `audit-events${qs ? `?${qs}` : ""}`)
}
