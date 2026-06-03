export interface IntegrationClientResponse {
  clientCode: string
  displayName: string
  active: boolean
  createdAt: string
}

export interface ApiKeyResponse {
  clientCode: string
  keyPrefix: string
  apiKey: string | null
  active: boolean
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  scopes: string[]
}

export interface CreateIntegrationClientRequest {
  clientCode: string
  displayName: string
  active: boolean
}

export interface UpdateIntegrationClientRequest {
  displayName: string
  active: boolean
}

export interface CreateApiKeyRequest {
  expiresAt?: string
  scopes: string[]
}

export interface ConnectionSettings {
  baseUrl: string
  adminApiKey: string
  rememberKey: boolean
}

export interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
}
