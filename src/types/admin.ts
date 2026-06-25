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

export interface PermissionScopeResponse {
  scope: string
  description: string | null
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

export interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
}

export type AuditAction =
  | "CLIENT_CREATED"
  | "CLIENT_UPDATED"
  | "CLIENT_DEACTIVATED"
  | "API_KEY_CREATED"
  | "API_KEY_REVOKED"
  | "API_KEY_ROTATED"
  | "SCOPE_ASSIGNED"
  | "SCOPE_REMOVED"
  | "AUTH_FAILED"

export type AuditOutcome = "SUCCESS" | "FAILURE"

export type AuditTargetType = "CLIENT" | "API_KEY" | "SCOPE" | "AUTH"

export interface AuditEventResponse {
  id: number
  occurredAt: string
  action: AuditAction
  outcome: AuditOutcome
  targetType: AuditTargetType
  actorClientCode: string | null
  actorKeyPrefix: string | null
  targetClientCode: string | null
  targetKeyPrefix: string | null
  detail: string | null
  requestMethod: string | null
  requestPath: string | null
  requestIp: string | null
  requestUserAgent: string | null
}

export interface AuditEventQuery {
  clientCode?: string | null
  action?: AuditAction | null
  from?: string | null
  to?: string | null
  page?: number
  size?: number
}

export type UserRole = "ADMIN" | "SUPER_ADMIN"

export interface UserResponse {
  id: number
  username: string
  email: string | null
  name: string | null
  role: UserRole
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface CreateUserRequest {
  username: string
  password: string
  role: UserRole
  email?: string | null
  name?: string | null
}

export interface UpdateUserRequest {
  role: UserRole
  active: boolean
  email?: string | null
  name?: string | null
}
