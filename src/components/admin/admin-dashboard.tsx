"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import {
  Eye,
  KeyRound,
  Link2,
  Link2Off,
  Loader2,
  LogOut,
  Plus,
  Power,
  RefreshCw,
  RotateCw,
  Server,
  Shield,
  Users,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DataTable } from "@/components/data-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  assignScope,
  createApiKey,
  createClient,
  deactivateClient,
  getErrorMessage,
  listApiKeys,
  listAuditEvents,
  listClients,
  removeScope,
  revokeApiKey,
  rotateApiKey,
  updateClient,
} from "@/lib/admin-api"
import type {
  ApiKeyResponse,
  AuditEventResponse,
  ConnectionSettings,
  CreateApiKeyRequest,
  IntegrationClientResponse,
} from "@/types/admin"

const STORAGE_KEY = "bcu-admin-ui:settings"
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_DEFAULT_BCU_API_URL || "http://localhost:8080"

const createClientSchema = z.object({
  clientCode: z
    .string()
    .trim()
    .min(3, "Minimo 3 caracteres")
    .max(80, "Maximo 80 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Usa solo letras, numeros, punto, guion o guion bajo"),
  displayName: z.string().trim().min(2, "Minimo 2 caracteres").max(200, "Maximo 200 caracteres"),
  active: z.boolean(),
})

const updateClientSchema = z.object({
  displayName: z.string().trim().min(2, "Minimo 2 caracteres").max(200, "Maximo 200 caracteres"),
  active: z.boolean(),
})

const createApiKeySchema = z.object({
  expiresAt: z.string().trim().optional(),
  scopes: z.string().trim().optional(),
})

type CreateClientForm = z.infer<typeof createClientSchema>
type UpdateClientForm = z.infer<typeof updateClientSchema>
type CreateApiKeyForm = z.infer<typeof createApiKeySchema>

type AuditAction = {
  id: string
  at: string
  action: string
  target: string
  detail: string
}

type KeyHistoryEvent = {
  id: string
  at: string
  type: "created" | "used" | "revoked" | "expires"
  keyPrefix: string
  detail: string
}

function toIsoDateTime(value?: string) {
  if (!value) {
    return undefined
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

function parseScopes(value?: string) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function formatInstant(value: string | null) {
  if (!value) {
    return "-"
  }

  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm")
  } catch {
    return value
  }
}

function buildSettings(baseUrl: string, adminApiKey: string, rememberKey: boolean): ConnectionSettings {
  return {
    baseUrl,
    adminApiKey,
    rememberKey,
  }
}

function readStoredSettings() {
  if (typeof window === "undefined") {
    return {
      baseUrl: DEFAULT_BASE_URL,
      adminApiKey: "",
      rememberKey: true,
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {
      baseUrl: DEFAULT_BASE_URL,
      adminApiKey: "",
      rememberKey: true,
    }
  }

  try {
    const saved = JSON.parse(raw) as Partial<ConnectionSettings>

    return {
      baseUrl: typeof saved.baseUrl === "string" && saved.baseUrl.trim() ? saved.baseUrl : DEFAULT_BASE_URL,
      adminApiKey: typeof saved.adminApiKey === "string" ? saved.adminApiKey : "",
      rememberKey: typeof saved.rememberKey === "boolean" ? saved.rememberKey : true,
    }
  } catch {
    return {
      baseUrl: DEFAULT_BASE_URL,
      adminApiKey: "",
      rememberKey: true,
    }
  }
}

function buildKeyHistory(apiKeys: ApiKeyResponse[]): KeyHistoryEvent[] {
  return apiKeys
    .flatMap((key) => {
      const events: KeyHistoryEvent[] = [
        {
          id: `${key.keyPrefix}-created`,
          at: key.createdAt,
          type: "created",
          keyPrefix: key.keyPrefix,
          detail: "API key creada",
        },
      ]

      if (key.lastUsedAt) {
        events.push({
          id: `${key.keyPrefix}-used`,
          at: key.lastUsedAt,
          type: "used",
          keyPrefix: key.keyPrefix,
          detail: "Ultimo uso registrado",
        })
      }

      if (key.revokedAt) {
        events.push({
          id: `${key.keyPrefix}-revoked`,
          at: key.revokedAt,
          type: "revoked",
          keyPrefix: key.keyPrefix,
          detail: "API key revocada",
        })
      }

      if (key.expiresAt) {
        events.push({
          id: `${key.keyPrefix}-expires`,
          at: key.expiresAt,
          type: "expires",
          keyPrefix: key.keyPrefix,
          detail: "Expiracion configurada",
        })
      }

      return events
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function AdminDashboard() {
  const queryClient = useQueryClient()
  const initialSettings = useMemo(() => readStoredSettings(), [])

  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl)
  const [adminApiKey, setAdminApiKey] = useState(initialSettings.adminApiKey)
  const [rememberKey, setRememberKey] = useState(initialSettings.rememberKey)

  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(null)
  const [selectedKeyPrefix, setSelectedKeyPrefix] = useState<string | null>(null)

  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [editClientOpen, setEditClientOpen] = useState(false)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false)
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false)
  const [assignScopeValue, setAssignScopeValue] = useState("")

  const registerAuditAction = (_entry: Omit<AuditAction, "id" | "at">) => {
    void _entry
  }

  useEffect(() => {
    const payload = JSON.stringify(
      buildSettings(baseUrl, rememberKey ? adminApiKey : "", rememberKey),
    )

    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [adminApiKey, baseUrl, rememberKey])

  const settings = useMemo(
    () => buildSettings(baseUrl, adminApiKey, rememberKey),
    [adminApiKey, baseUrl, rememberKey],
  )

  const canConnect = Boolean(baseUrl.trim() && adminApiKey.trim())

  const clientsQuery = useQuery({
    queryKey: ["clients", settings.baseUrl, settings.adminApiKey],
    queryFn: () => listClients(settings),
    enabled: canConnect,
  })

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data])

  const effectiveSelectedClientCode = useMemo(() => {
    if (!clients.length) {
      return null
    }

    if (selectedClientCode && clients.some((client) => client.clientCode === selectedClientCode)) {
      return selectedClientCode
    }

    return clients[0].clientCode
  }, [clients, selectedClientCode])

  const selectedClient = useMemo(
    () => clients.find((client) => client.clientCode === effectiveSelectedClientCode) || null,
    [clients, effectiveSelectedClientCode],
  )

  const apiKeysQuery = useQuery({
    queryKey: ["api-keys", settings.baseUrl, settings.adminApiKey, effectiveSelectedClientCode],
    queryFn: () => listApiKeys(settings, effectiveSelectedClientCode as string),
    enabled: canConnect && Boolean(effectiveSelectedClientCode),
  })

  const apiKeys = useMemo(() => apiKeysQuery.data ?? [], [apiKeysQuery.data])

  const effectiveSelectedKeyPrefix = useMemo(() => {
    if (!apiKeys.length) {
      return null
    }

    if (selectedKeyPrefix && apiKeys.some((key) => key.keyPrefix === selectedKeyPrefix)) {
      return selectedKeyPrefix
    }

    return apiKeys[0].keyPrefix
  }, [apiKeys, selectedKeyPrefix])

  const selectedKey = useMemo(
    () => apiKeys.find((item) => item.keyPrefix === effectiveSelectedKeyPrefix) || null,
    [apiKeys, effectiveSelectedKeyPrefix],
  )

  const keyHistory = useMemo(() => buildKeyHistory(apiKeys), [apiKeys])

  const auditEventsQuery = useQuery({
    queryKey: [
      "audit-events",
      settings.baseUrl,
      settings.adminApiKey,
      effectiveSelectedClientCode,
    ],
    queryFn: () =>
      listAuditEvents(settings, {
        clientCode: effectiveSelectedClientCode ?? undefined,
        size: 100,
      }),
    enabled: canConnect,
  })

  const scopedAuditActions = useMemo<AuditEventResponse[]>(
    () => auditEventsQuery.data ?? [],
    [auditEventsQuery.data],
  )

  const invalidateAuditEvents = () =>
    queryClient.invalidateQueries({
      queryKey: ["audit-events", settings.baseUrl, settings.adminApiKey],
    })

  const refreshData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["clients", settings.baseUrl, settings.adminApiKey] })

    if (effectiveSelectedClientCode) {
      await queryClient.invalidateQueries({
        queryKey: ["api-keys", settings.baseUrl, settings.adminApiKey, effectiveSelectedClientCode],
      })
    }

    await invalidateAuditEvents()
  }

  const createClientMutation = useMutation({
    mutationFn: (payload: CreateClientForm) => createClient(settings, payload),
    onSuccess: async (client) => {
      setSelectedClientCode(client.clientCode)
      setCreateClientOpen(false)
      registerAuditAction({
        action: "CREATE_CLIENT",
        target: client.clientCode,
        detail: `Cliente ${client.displayName} creado`,
      })
      toast.success("Cliente creado", {
        description: `${client.clientCode} disponible para uso inmediato.`,
      })
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo crear el cliente", {
        description: getErrorMessage(error),
      })
    },
  })

  const updateClientMutation = useMutation({
    mutationFn: ({ clientCode, payload }: { clientCode: string; payload: UpdateClientForm }) =>
      updateClient(settings, clientCode, payload),
    onSuccess: async () => {
      setEditClientOpen(false)
      registerAuditAction({
        action: "UPDATE_CLIENT",
        target: effectiveSelectedClientCode || "-",
        detail: "Datos del cliente actualizados",
      })
      toast.success("Cliente actualizado")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo actualizar el cliente", {
        description: getErrorMessage(error),
      })
    },
  })

  const deactivateClientMutation = useMutation({
    mutationFn: (clientCode: string) => deactivateClient(settings, clientCode),
    onSuccess: async () => {
      setConfirmDeactivateOpen(false)
      registerAuditAction({
        action: "DEACTIVATE_CLIENT",
        target: effectiveSelectedClientCode || "-",
        detail: "Cliente desactivado por operador",
      })
      toast.success("Cliente desactivado")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo desactivar", {
        description: getErrorMessage(error),
      })
    },
  })

  const createApiKeyMutation = useMutation({
    mutationFn: ({ clientCode, payload }: { clientCode: string; payload: CreateApiKeyRequest }) =>
      createApiKey(settings, clientCode, payload),
    onSuccess: async (result) => {
      setCreateKeyOpen(false)
      setSelectedKeyPrefix(result.keyPrefix)
      registerAuditAction({
        action: "CREATE_API_KEY",
        target: `${result.clientCode}/${result.keyPrefix}`,
        detail: "Nueva API key emitida",
      })
      toast.success("API key creada", {
        description: result.apiKey
          ? "Guardala ahora: el backend solo la devuelve una vez."
          : "La clave se genero correctamente.",
      })
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo crear la API key", {
        description: getErrorMessage(error),
      })
    },
  })

  const revokeApiKeyMutation = useMutation({
    mutationFn: ({ clientCode, keyPrefix }: { clientCode: string; keyPrefix: string }) =>
      revokeApiKey(settings, clientCode, keyPrefix),
    onSuccess: async () => {
      setConfirmRevokeOpen(false)
      registerAuditAction({
        action: "REVOKE_API_KEY",
        target: `${effectiveSelectedClientCode || "-"}/${effectiveSelectedKeyPrefix || "-"}`,
        detail: "API key revocada por operador",
      })
      toast.success("API key revocada")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo revocar", {
        description: getErrorMessage(error),
      })
    },
  })

  const rotateApiKeyMutation = useMutation({
    mutationFn: ({
      clientCode,
      keyPrefix,
      payload,
    }: {
      clientCode: string
      keyPrefix: string
      payload: CreateApiKeyRequest
    }) => rotateApiKey(settings, clientCode, keyPrefix, payload),
    onSuccess: async (result) => {
      setSelectedKeyPrefix(result.keyPrefix)
      registerAuditAction({
        action: "ROTATE_API_KEY",
        target: `${result.clientCode}/${result.keyPrefix}`,
        detail: "API key rotada",
      })
      toast.success("API key rotada")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo rotar", {
        description: getErrorMessage(error),
      })
    },
  })

  const assignScopeMutation = useMutation({
    mutationFn: ({
      clientCode,
      keyPrefix,
      scope,
    }: {
      clientCode: string
      keyPrefix: string
      scope: string
    }) => assignScope(settings, clientCode, keyPrefix, scope),
    onSuccess: async (_, variables) => {
      setAssignScopeValue("")
      registerAuditAction({
        action: "ASSIGN_SCOPE",
        target: `${variables.clientCode}/${variables.keyPrefix}`,
        detail: `Scope asignado: ${variables.scope}`,
      })
      toast.success("Scope asignado")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo asignar scope", {
        description: getErrorMessage(error),
      })
    },
  })

  const removeScopeMutation = useMutation({
    mutationFn: ({
      clientCode,
      keyPrefix,
      scope,
    }: {
      clientCode: string
      keyPrefix: string
      scope: string
    }) => removeScope(settings, clientCode, keyPrefix, scope),
    onSuccess: async (_, variables) => {
      registerAuditAction({
        action: "REMOVE_SCOPE",
        target: `${variables.clientCode}/${variables.keyPrefix}`,
        detail: `Scope removido: ${variables.scope}`,
      })
      toast.success("Scope removido")
      await refreshData()
    },
    onError: (error) => {
      toast.error("No se pudo remover scope", {
        description: getErrorMessage(error),
      })
    },
  })

  const clientColumns = useMemo<ColumnDef<IntegrationClientResponse>[]>(
    () => [
      {
        accessorKey: "clientCode",
        header: "Client code",
      },
      {
        accessorKey: "displayName",
        header: "Nombre",
      },
      {
        accessorKey: "active",
        header: "Estado",
        cell: ({ row }) =>
          row.original.active ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>,
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: ({ row }) => formatInstant(row.original.createdAt),
      },
    ],
    [],
  )

  const apiKeyColumns = useMemo<ColumnDef<ApiKeyResponse>[]>(
    () => [
      {
        accessorKey: "keyPrefix",
        header: "Prefix",
      },
      {
        accessorKey: "active",
        header: "Estado",
        cell: ({ row }) =>
          row.original.active ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Revocada</Badge>,
      },
      {
        accessorKey: "expiresAt",
        header: "Expira",
        cell: ({ row }) => formatInstant(row.original.expiresAt),
      },
      {
        accessorKey: "lastUsedAt",
        header: "Ultimo uso",
        cell: ({ row }) => formatInstant(row.original.lastUsedAt),
      },
    ],
    [],
  )

  const historyColumns = useMemo<ColumnDef<KeyHistoryEvent>[]>(
    () => [
      {
        accessorKey: "at",
        header: "Fecha",
        cell: ({ row }) => formatInstant(row.original.at),
      },
      {
        accessorKey: "keyPrefix",
        header: "Key",
      },
      {
        accessorKey: "type",
        header: "Evento",
        cell: ({ row }) => {
          const type = row.original.type

          if (type === "created") {
            return <Badge variant="secondary">Creacion</Badge>
          }

          if (type === "used") {
            return <Badge variant="outline">Uso</Badge>
          }

          if (type === "revoked") {
            return <Badge variant="destructive">Revocacion</Badge>
          }

          return <Badge variant="outline">Expiracion</Badge>
        },
      },
      {
        accessorKey: "detail",
        header: "Detalle",
      },
    ],
    [],
  )

  const auditColumns = useMemo<ColumnDef<AuditEventResponse>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: "Fecha",
        cell: ({ row }) => formatInstant(row.original.occurredAt),
      },
      {
        accessorKey: "action",
        header: "Accion",
        cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
      },
      {
        accessorKey: "outcome",
        header: "Resultado",
        cell: ({ row }) => (
          <Badge variant={row.original.outcome === "SUCCESS" ? "default" : "destructive"}>
            {row.original.outcome}
          </Badge>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        cell: ({ row }) =>
          row.original.actorClientCode
            ? `${row.original.actorClientCode}${row.original.actorKeyPrefix ? ` (${row.original.actorKeyPrefix})` : ""}`
            : "-",
      },
      {
        id: "target",
        header: "Objetivo",
        cell: ({ row }) => {
          const code = row.original.targetClientCode
          const prefix = row.original.targetKeyPrefix
          if (!code && !prefix) return "-"
          return `${code ?? ""}${prefix ? ` / ${prefix}` : ""}`
        },
      },
      {
        accessorKey: "detail",
        header: "Detalle",
        cell: ({ row }) => row.original.detail ?? "-",
      },
    ],
    [],
  )

  const createClientForm = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      clientCode: "",
      displayName: "",
      active: true,
    },
  })

  const updateClientForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      displayName: selectedClient?.displayName || "",
      active: selectedClient?.active ?? true,
    },
  })

  useEffect(() => {
    if (!selectedClient) {
      return
    }

    updateClientForm.reset({
      displayName: selectedClient.displayName,
      active: selectedClient.active,
    })
  }, [selectedClient, updateClientForm])

  const createApiKeyForm = useForm<CreateApiKeyForm>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      expiresAt: "",
      scopes: "debtors.read",
    },
  })

  const submitCreateClient = createClientForm.handleSubmit((values) => {
    createClientMutation.mutate(values)
  })

  const submitEditClient = updateClientForm.handleSubmit((values) => {
    if (!effectiveSelectedClientCode) {
      return
    }

    updateClientMutation.mutate({
      clientCode: effectiveSelectedClientCode,
      payload: values,
    })
  })

  const submitCreateKey = createApiKeyForm.handleSubmit((values) => {
    if (!effectiveSelectedClientCode) {
      return
    }

    createApiKeyMutation.mutate({
      clientCode: effectiveSelectedClientCode,
      payload: {
        expiresAt: toIsoDateTime(values.expiresAt),
        scopes: parseScopes(values.scopes),
      },
    })
  })

  const submitScopeAssign = () => {
    if (!effectiveSelectedClientCode || !effectiveSelectedKeyPrefix) {
      return
    }

    const scope = assignScopeValue.trim()

    if (!scope) {
      toast.error("Ingresa un scope")
      return
    }

    assignScopeMutation.mutate({
      clientCode: effectiveSelectedClientCode,
      keyPrefix: effectiveSelectedKeyPrefix,
      scope,
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f0f9ff_0%,#f9fafb_45%,#ffffff_100%)] px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-700 to-slate-900 p-6 text-white shadow-lg shadow-sky-900/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium uppercase tracking-wide">
                <Shield className="size-3.5" />
                Admin · BCU API
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Control de integraciones, API keys y scopes
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-sky-100/95 sm:text-base">
                Panel operativo para administrar credenciales de consumo y permisos del backend
                <span className="font-semibold"> /api/v1/admin/integrations</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => refreshData()}
                type="button"
                disabled={!canConnect || clientsQuery.isFetching || apiKeysQuery.isFetching}
              >
                {clientsQuery.isFetching || apiKeysQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Actualizar
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/15 hover:text-white"
                onClick={() => signOut({ callbackUrl: "/login" })}
                type="button"
              >
                <LogOut className="size-4" />
                Salir
              </Button>
            </div>
          </div>
        </section>

        <Card className="border border-cyan-100">
          <CardHeader className="border-b border-cyan-100">
            <CardTitle className="inline-flex items-center gap-2">
              <Server className="size-4 text-cyan-700" />
              Conexion al backend
            </CardTitle>
            <CardDescription>
              La API key se usa solo en este navegador. Activa &quot;Recordar&quot; para persistirla localmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 py-4 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Label htmlFor="baseUrl">BCU API base URL</Label>
              <Input
                id="baseUrl"
                placeholder="http://localhost:8080"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </div>
            <div className="sm:col-span-5">
              <Label htmlFor="adminApiKey">X-API-Key (admin.manage)</Label>
              <Input
                id="adminApiKey"
                placeholder="prefix.secret"
                value={adminApiKey}
                onChange={(event) => setAdminApiKey(event.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-1">
              <Switch checked={rememberKey} onCheckedChange={setRememberKey} />
              <span className="text-xs text-muted-foreground">Recordar</span>
            </div>
          </CardContent>
        </Card>

        {!canConnect ? (
          <Alert variant="destructive">
            <AlertTitle>Faltan datos para conectar</AlertTitle>
            <AlertDescription>
              Completa URL base y API key para cargar clientes y credenciales.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border border-slate-200/70">
            <CardHeader className="border-b border-slate-200/80">
              <CardTitle className="inline-flex items-center gap-2">
                <Users className="size-4 text-sky-700" />
                Clientes de integracion
              </CardTitle>
              <CardDescription>Crea, actualiza y desactiva consumidores internos.</CardDescription>
              <CardAction>
                <Button size="sm" type="button" onClick={() => setCreateClientOpen(true)}>
                  <Plus className="size-4" />
                  Nuevo cliente
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {clientsQuery.isPending ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <DataTable
                  columns={clientColumns}
                  data={clients}
                  emptyMessage="No hay clientes cargados"
                  getRowId={(row) => row.clientCode}
                  onRowClick={(row) => setSelectedClientCode(row.clientCode)}
                  selectedRowId={effectiveSelectedClientCode}
                />
              )}

              {selectedClient ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditClientOpen(true)} type="button">
                    Editar cliente
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDeactivateOpen(true)}
                    type="button"
                    disabled={deactivateClientMutation.isPending || !selectedClient.active}
                  >
                    {deactivateClientMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Power className="size-4" />
                    )}
                    Desactivar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-slate-200/70">
            <CardHeader className="border-b border-slate-200/80">
              <CardTitle className="inline-flex items-center gap-2">
                <KeyRound className="size-4 text-sky-700" />
                API keys
              </CardTitle>
              <CardDescription>
                {effectiveSelectedClientCode
                  ? `Gestionando credenciales de ${effectiveSelectedClientCode}`
                  : "Selecciona un cliente para administrar credenciales"}
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  type="button"
                  disabled={!effectiveSelectedClientCode}
                  onClick={() => setCreateKeyOpen(true)}
                >
                  <Plus className="size-4" />
                  Nueva key
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {apiKeysQuery.isPending && effectiveSelectedClientCode ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <DataTable
                  columns={apiKeyColumns}
                  data={apiKeys}
                  emptyMessage={effectiveSelectedClientCode ? "Sin API keys" : "Elegi un cliente"}
                  getRowId={(row) => row.keyPrefix}
                  onRowClick={(row) => setSelectedKeyPrefix(row.keyPrefix)}
                  selectedRowId={effectiveSelectedKeyPrefix}
                />
              )}

              {effectiveSelectedClientCode && selectedKey ? (
                <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedKey.keyPrefix}</Badge>
                    {selectedKey.scopes.map((scope) => (
                      <button
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-100"
                        key={scope}
                        onClick={() =>
                          removeScopeMutation.mutate({
                            clientCode: effectiveSelectedClientCode,
                            keyPrefix: selectedKey.keyPrefix,
                            scope,
                          })
                        }
                        type="button"
                        disabled={removeScopeMutation.isPending}
                        title="Quitar scope"
                      >
                        {scope}
                        <Link2Off className="size-3" />
                      </button>
                    ))}
                    {!selectedKey.scopes.length ? (
                      <p className="text-xs text-muted-foreground">Sin scopes asignados.</p>
                    ) : null}
                  </div>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-56"
                      placeholder="scope a asignar"
                      value={assignScopeValue}
                      onChange={(event) => setAssignScopeValue(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={submitScopeAssign}
                      disabled={assignScopeMutation.isPending}
                    >
                      {assignScopeMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      Asignar scope
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        rotateApiKeyMutation.mutate({
                          clientCode: effectiveSelectedClientCode,
                          keyPrefix: selectedKey.keyPrefix,
                          payload: { scopes: selectedKey.scopes },
                        })
                      }
                      disabled={rotateApiKeyMutation.isPending}
                    >
                      {rotateApiKeyMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCw className="size-4" />
                      )}
                      Rotar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      type="button"
                      onClick={() => setConfirmRevokeOpen(true)}
                      disabled={revokeApiKeyMutation.isPending || !selectedKey.active}
                    >
                      {revokeApiKeyMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Power className="size-4" />
                      )}
                      Revocar
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card className="border border-slate-200/70">
          <CardHeader className="border-b border-slate-200/80">
            <CardTitle className="inline-flex items-center gap-2">
              <Eye className="size-4 text-sky-700" />
              Detalle de cliente
            </CardTitle>
            <CardDescription>
              {selectedClient
                ? `Vista de detalle para ${selectedClient.clientCode}`
                : "Selecciona un cliente para ver historial y auditoria"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{selectedClient?.displayName || "-"}</p>
                <p className="text-xs text-muted-foreground">{selectedClient?.clientCode || "-"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Estado: {selectedClient?.active ? "Activo" : "Inactivo"}
                </p>
              </div>
              <DataTable
                columns={historyColumns}
                data={keyHistory}
                emptyMessage="Sin eventos de historial para este cliente"
                getRowId={(row) => row.id}
              />
            </div>
            <div>
              <Alert>
                <AlertTitle>Acciones auditables</AlertTitle>
                <AlertDescription>
                  Esta tabla registra acciones ejecutadas desde esta consola para trazabilidad operativa.
                </AlertDescription>
              </Alert>
              <div className="mt-3">
                <DataTable
                  columns={auditColumns}
                  data={scopedAuditActions}
                  emptyMessage="Aun no hay acciones auditables registradas"
                  getRowId={(row) => String(row.id)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createClientOpen} onOpenChange={setCreateClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente de integracion</DialogTitle>
            <DialogDescription>
              El code debe ser unico y luego se utilizara para gestionar API keys.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCreateClient}>
            <div className="space-y-1.5">
              <Label htmlFor="clientCode">Client code</Label>
              <Input id="clientCode" {...createClientForm.register("clientCode")} />
              <p className="text-xs text-destructive">{createClientForm.formState.errors.clientCode?.message}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...createClientForm.register("displayName")} />
              <p className="text-xs text-destructive">{createClientForm.formState.errors.displayName?.message}</p>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={createClientForm.control}
                name="active"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
              <span className="text-sm">Activo al crear</span>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Crear cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Actualiza nombre de referencia y estado operativo.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitEditClient}>
            <div className="space-y-1.5">
              <Label>Client code</Label>
              <Input disabled value={selectedClient?.clientCode || ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayNameEdit">Display name</Label>
              <Input id="displayNameEdit" {...updateClientForm.register("displayName")} />
              <p className="text-xs text-destructive">{updateClientForm.formState.errors.displayName?.message}</p>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={updateClientForm.control}
                name="active"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
              <span className="text-sm">Cliente activo</span>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateClientMutation.isPending || !effectiveSelectedClientCode}>
                {updateClientMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva API key</DialogTitle>
            <DialogDescription>
              Se genera para {effectiveSelectedClientCode || "-"}. Define scopes separados por coma.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCreateKey}>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expira en (opcional)</Label>
              <Input id="expiresAt" type="datetime-local" {...createApiKeyForm.register("expiresAt")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scopes">Scopes</Label>
              <Input id="scopes" placeholder="debtors.read,admin.manage" {...createApiKeyForm.register("scopes")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createApiKeyMutation.isPending || !effectiveSelectedClientCode}>
                {createApiKeyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Crear API key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar desactivacion</DialogTitle>
            <DialogDescription>
              Esta accion desactiva al cliente {effectiveSelectedClientCode || "-"}.
              Sus credenciales dejaran de operar hasta reactivarlo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setConfirmDeactivateOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={!effectiveSelectedClientCode || deactivateClientMutation.isPending}
              onClick={() => {
                if (!effectiveSelectedClientCode) {
                  return
                }

                deactivateClientMutation.mutate(effectiveSelectedClientCode)
              }}
            >
              {deactivateClientMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar desactivacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRevokeOpen} onOpenChange={setConfirmRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar revocacion</DialogTitle>
            <DialogDescription>
              Se revocara la API key {effectiveSelectedKeyPrefix || "-"} del cliente {effectiveSelectedClientCode || "-"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setConfirmRevokeOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={!effectiveSelectedClientCode || !effectiveSelectedKeyPrefix || revokeApiKeyMutation.isPending}
              onClick={() => {
                if (!effectiveSelectedClientCode || !effectiveSelectedKeyPrefix) {
                  return
                }

                revokeApiKeyMutation.mutate({
                  clientCode: effectiveSelectedClientCode,
                  keyPrefix: effectiveSelectedKeyPrefix,
                })
              }}
            >
              {revokeApiKeyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar revocacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
