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

export type UserRole = "ADMIN" | "SUPER_ADMIN" | "DEBTOR_VIEWER"

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

export type DocumentType = "CI" | "IDE" | "RUT" | "PASSPORT" | "OTHER"

export interface IdDocumentDto {
  type: DocumentType
  country: string
  number: string
}

export interface ActivitySectorDto {
  code: string
  description: string
}

export interface AmountDto {
  value: number
  currency: string
}

// The BCU debtor report expresses each category line's amount in the three
// currency views shown on the original BCU screen. Rendered defensively in
// the UI (iterate whatever keys are present) rather than assuming this exact
// shape never changes.
export interface AmountByCurrencyDto {
  localPesos: AmountDto
  foreignPesos: AmountDto
  foreignUsd: AmountDto
}

export type DebtCategory =
  | "CURRENT"
  | "CURRENT_NON_AUTO_LIQUIDATING"
  | "CONTINGENT"
  | "WRITTEN_OFF"
  | "PROVISIONS"

export interface DebtCategoryLineDto {
  category: DebtCategory | string
  amounts: AmountByCurrencyDto
}

export type CreditRating =
  | "C1A"
  | "C1C"
  | "C2A"
  | "C2B"
  | "C3"
  | "C4"
  | "C5"
  | "UNCLASSIFIED"
  | "OTHER"

export interface InstitutionDebtDto {
  institutionName: string
  institutionCode: string | null
  rating: CreditRating | string
  lines: DebtCategoryLineDto[]
}

export interface DebtorReportDto {
  period: string
  totals: DebtCategoryLineDto[]
  institutions: InstitutionDebtDto[]
  generatedAt: string
}

export interface DebtorReportResponseDto {
  document: IdDocumentDto
  fullName: string
  activitySector: ActivitySectorDto
  reports: DebtorReportDto[]
}

export interface DebtorReportQuery {
  documentType: DocumentType
  country?: string
  periodFrom?: string
  periodTo?: string
}
