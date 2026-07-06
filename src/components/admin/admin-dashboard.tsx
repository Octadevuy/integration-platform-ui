"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import {
  Check,
  Copy,
  Eye,
  FileSearch,
  KeyRound,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  RotateCw,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react"
import { useSession } from "next-auth/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  listScopes,
  removeScope,
  revokeApiKey,
  rotateApiKey,
  updateClient,
} from "@/lib/admin-api"
import type {
  ApiKeyResponse,
  AuditEventResponse,
  CreateApiKeyRequest,
  IntegrationClientResponse,
  PermissionScopeResponse,
} from "@/types/admin"
import { cn } from "@/lib/utils"
import { UsersPanel } from "@/components/admin/users-panel"
import { DebtorsQueryPanel } from "@/components/admin/debtors-query-panel"
import { UserDropdown } from "@/components/admin/user-dropdown"

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
  const { data: session } = useSession()

  const isSuperAdmin = session?.role === "SUPER_ADMIN"
  const canViewDebtors = isSuperAdmin || session?.role === "DEBTOR_VIEWER"

  const [activeSection, setActiveSection] = useState<"integrations" | "users" | "debtors">(
    "integrations",
  )

  useEffect(() => {
    if (session && !isSuperAdmin) {
      setActiveSection("debtors")
    }
  }, [session, isSuperAdmin])

  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(null)
  const [selectedKeyPrefix, setSelectedKeyPrefix] = useState<string | null>(null)

  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [editClientOpen, setEditClientOpen] = useState(false)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false)
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false)
  const [assignScopeValue, setAssignScopeValue] = useState("")
  const [createKeyScopes, setCreateKeyScopes] = useState<string[]>([])
  const [createKeyScopeValue, setCreateKeyScopeValue] = useState("")
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null)
  const [copiedApiKey, setCopiedApiKey] = useState(false)

  const registerAuditAction = (_entry: Omit<AuditAction, "id" | "at">) => {
    void _entry
  }

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients(),
    enabled: isSuperAdmin,
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
    queryKey: ["api-keys", effectiveSelectedClientCode],
    queryFn: () => listApiKeys(effectiveSelectedClientCode as string),
    enabled: Boolean(effectiveSelectedClientCode),
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
    queryKey: ["audit-events", effectiveSelectedClientCode],
    queryFn: () =>
      listAuditEvents({
        clientCode: effectiveSelectedClientCode ?? undefined,
        size: 100,
      }),
    enabled: isSuperAdmin,
  })

  const scopedAuditActions = useMemo<AuditEventResponse[]>(
    () => auditEventsQuery.data ?? [],
    [auditEventsQuery.data],
  )

  const scopesQuery = useQuery({
    queryKey: ["available-scopes"],
    queryFn: () => listScopes(),
    enabled: isSuperAdmin,
  })

  const availableScopes = useMemo<PermissionScopeResponse[]>(() => scopesQuery.data ?? [], [scopesQuery.data])

  const unassignedScopes = useMemo(
    () =>
      availableScopes.filter((scope) => !selectedKey?.scopes.includes(scope.scope)),
    [availableScopes, selectedKey],
  )

  const effectiveAssignScopeValue = useMemo(() => {
    if (assignScopeValue && unassignedScopes.some((scope) => scope.scope === assignScopeValue)) {
      return assignScopeValue
    }

    return unassignedScopes[0]?.scope ?? ""
  }, [assignScopeValue, unassignedScopes])

  const availableCreateKeyScopes = useMemo(
    () => availableScopes.filter((scope) => !createKeyScopes.includes(scope.scope)),
    [availableScopes, createKeyScopes],
  )

  const effectiveCreateKeyScopeValue = useMemo(() => {
    if (
      createKeyScopeValue
      && availableCreateKeyScopes.some((scope) => scope.scope === createKeyScopeValue)
    ) {
      return createKeyScopeValue
    }

    return availableCreateKeyScopes[0]?.scope ?? ""
  }, [availableCreateKeyScopes, createKeyScopeValue])

  const invalidateAuditEvents = () =>
    queryClient.invalidateQueries({ queryKey: ["audit-events"] })

  const refreshData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["clients"] })

    if (effectiveSelectedClientCode) {
      await queryClient.invalidateQueries({
        queryKey: ["api-keys", effectiveSelectedClientCode],
      })
    }

    await invalidateAuditEvents()
  }

  const createClientMutation = useMutation({
    mutationFn: (payload: CreateClientForm) => createClient(payload),
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
      updateClient(clientCode, payload),
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
    mutationFn: (clientCode: string) => deactivateClient(clientCode),
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
      createApiKey(clientCode, payload),
    onSuccess: async (result) => {
      setCreateKeyOpen(false)
      setCreateKeyScopes([])
      setCreateKeyScopeValue("")
      setSelectedKeyPrefix(result.keyPrefix)
      registerAuditAction({
        action: "CREATE_API_KEY",
        target: `${result.clientCode}/${result.keyPrefix}`,
        detail: "Nueva API key emitida",
      })
      if (result.apiKey) {
        setRevealedApiKey(result.apiKey)
      } else {
        toast.success("API key creada")
      }
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
      revokeApiKey(clientCode, keyPrefix),
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
    }) => rotateApiKey(clientCode, keyPrefix, payload),
    onSuccess: async (result) => {
      setSelectedKeyPrefix(result.keyPrefix)
      registerAuditAction({
        action: "ROTATE_API_KEY",
        target: `${result.clientCode}/${result.keyPrefix}`,
        detail: "API key rotada",
      })
      if (result.apiKey) {
        setRevealedApiKey(result.apiKey)
      } else {
        toast.success("API key rotada")
      }
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
    }) => assignScope(clientCode, keyPrefix, scope),
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
    }) => removeScope(clientCode, keyPrefix, scope),
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
        scopes: createKeyScopes,
      },
    })
  })

  const addCreateKeyScope = () => {
    const scope = effectiveCreateKeyScopeValue.trim()

    if (!scope) {
      toast.error("Selecciona un scope para agregar")
      return
    }

    setCreateKeyScopes((current) => (current.includes(scope) ? current : [...current, scope]))
  }

  const removeCreateKeyScope = (scopeToRemove: string) => {
    setCreateKeyScopes((current) => current.filter((scope) => scope !== scopeToRemove))
  }

  const submitScopeAssign = () => {
    if (!effectiveSelectedClientCode || !effectiveSelectedKeyPrefix) {
      return
    }

    const scope = effectiveAssignScopeValue.trim()

    if (!scope) {
      toast.error("Selecciona un scope")
      return
    }

    assignScopeMutation.mutate({
      clientCode: effectiveSelectedClientCode,
      keyPrefix: effectiveSelectedKeyPrefix,
      scope,
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-accent)_0%,var(--color-background)_45%,var(--color-background)_100%)] px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-2xl bg-gradient-to-r from-ring via-accent-foreground to-foreground p-6 text-white shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium uppercase tracking-wide">
                <Shield className="size-3.5" />
                Consola EnLaMano
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Administración de accesos y operaciones
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-white/85 sm:text-base">
                Gestiona integraciones, API keys y scopes, usuarios administrativos y consultas de
                deudores desde un unico panel, con auditoria completa de cada accion.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => refreshData()}
                type="button"
                disabled={clientsQuery.isFetching || apiKeysQuery.isFetching}
              >
                {clientsQuery.isFetching || apiKeysQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Actualizar
              </Button>
              <UserDropdown />
            </div>
          </div>
        </section>

        <div className="flex gap-5 items-start">
          <aside className="w-52 shrink-0">
            <nav className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-sm">
              {isSuperAdmin ? (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                    activeSection === "integrations"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setActiveSection("integrations")}
                >
                  <Link2 className="size-4 shrink-0" />
                  Integraciones
                </button>
              ) : null}
              {isSuperAdmin ? (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                    activeSection === "users"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setActiveSection("users")}
                >
                  <UserCog className="size-4 shrink-0" />
                  Usuarios Admin
                </button>
              ) : null}
              {canViewDebtors ? (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                    activeSection === "debtors"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setActiveSection("debtors")}
                >
                  <FileSearch className="size-4 shrink-0" />
                  Consulta de Deudores
                </button>
              ) : null}
            </nav>
          </aside>

          <div className="flex-1 flex flex-col gap-5 min-w-0">
          {activeSection === "integrations" && <>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="inline-flex items-center gap-2">
                <Users className="size-4 text-accent-foreground" />
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
                <div className="py-2">
                  <div className="mb-2 flex gap-3 border-b pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3 border-b py-2.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
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

          <Card className="border border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="inline-flex items-center gap-2">
                <KeyRound className="size-4 text-accent-foreground" />
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
                  onClick={() => {
                    createApiKeyForm.reset({ expiresAt: "" })
                    setCreateKeyScopes([])
                    setCreateKeyScopeValue("")
                    setCreateKeyOpen(true)
                  }}
                >
                  <Plus className="size-4" />
                  Nueva key
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {apiKeysQuery.isPending && effectiveSelectedClientCode ? (
                <div className="py-2">
                  <div className="mb-2 flex gap-3 border-b pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 border-b py-2.5">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
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
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
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
                    <Select
                      value={effectiveAssignScopeValue}
                      onValueChange={(value) => setAssignScopeValue(value ?? "")}
                    >
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Selecciona un scope" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedScopes.map((scope) => (
                          <SelectItem key={scope.scope} value={scope.scope}>
                            {scope.scope}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={submitScopeAssign}
                      disabled={assignScopeMutation.isPending || !unassignedScopes.length}
                    >
                      {assignScopeMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      Asignar scope
                    </Button>
                    {!unassignedScopes.length ? (
                      <p className="text-xs text-muted-foreground">No hay scopes disponibles para asignar.</p>
                    ) : null}
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

        <Card className="border border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="inline-flex items-center gap-2">
              <Eye className="size-4 text-accent-foreground" />
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
              {clientsQuery.isPending ? (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16 mt-2" />
                </div>
              ) : (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedClient?.displayName || "-"}</p>
                  <p className="text-xs text-muted-foreground">{selectedClient?.clientCode || "-"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estado: {selectedClient?.active ? "Activo" : "Inactivo"}
                  </p>
                </div>
              )}
              {apiKeysQuery.isPending && effectiveSelectedClientCode ? (
                <div>
                  <div className="mb-2 flex gap-3 border-b pb-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 border-b py-2.5">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <DataTable
                  columns={historyColumns}
                  data={keyHistory}
                  emptyMessage="Sin eventos de historial para este cliente"
                  getRowId={(row) => row.id}
                />
              )}
            </div>
            <div>
              <Alert>
                <AlertTitle>Acciones auditables</AlertTitle>
                <AlertDescription>
                  Esta tabla registra acciones ejecutadas desde esta consola para trazabilidad operativa.
                </AlertDescription>
              </Alert>
              <div className="mt-3">
                {auditEventsQuery.isPending ? (
                  <div>
                    <div className="mb-2 flex gap-3 border-b pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3 border-b py-2.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    columns={auditColumns}
                    data={scopedAuditActions}
                    emptyMessage="Aun no hay acciones auditables registradas"
                    getRowId={(row) => String(row.id)}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
          </>}
          {activeSection === "users" && <UsersPanel />}
          {activeSection === "debtors" && canViewDebtors && <DebtorsQueryPanel />}
          </div>
        </div>
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

      <Dialog
        open={createKeyOpen}
        onOpenChange={(open) => {
          setCreateKeyOpen(open)

          if (!open) {
            createApiKeyForm.reset({ expiresAt: "" })
            setCreateKeyScopes([])
            setCreateKeyScopeValue("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva API key</DialogTitle>
            <DialogDescription>
              Se genera para {effectiveSelectedClientCode || "-"}. Selecciona multiples scopes definidos en backend.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCreateKey}>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expira en (opcional)</Label>
              <Input id="expiresAt" type="datetime-local" {...createApiKeyForm.register("expiresAt")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scope">Scopes</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={effectiveCreateKeyScopeValue}
                  onValueChange={(value) => setCreateKeyScopeValue(value ?? "")}
                >
                  <SelectTrigger id="scope" className="w-full sm:w-72">
                    <SelectValue placeholder="Selecciona un scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCreateKeyScopes.map((scope) => (
                      <SelectItem key={scope.scope} value={scope.scope}>
                        {scope.scope}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCreateKeyScope}
                  disabled={!availableCreateKeyScopes.length}
                >
                  Agregar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {createKeyScopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="inline-flex items-center gap-1.5 px-2 py-1">
                    {scope}
                    <button
                      className="rounded-sm hover:text-destructive"
                      type="button"
                      onClick={() => removeCreateKeyScope(scope)}
                      title={`Quitar ${scope}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                {!createKeyScopes.length ? (
                  <p className="text-xs text-muted-foreground">No hay scopes seleccionados.</p>
                ) : null}
              </div>
              {scopesQuery.isError ? (
                <p className="text-xs text-destructive">No se pudieron cargar los scopes desde backend.</p>
              ) : null}
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

      <Dialog
        open={!!revealedApiKey}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedApiKey(null)
            setCopiedApiKey(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key creada</DialogTitle>
            <DialogDescription>
              Copia y guarda la clave ahora. El backend no la volvera a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={revealedApiKey ?? ""}
                className="font-mono text-sm"
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!revealedApiKey) return
                  void navigator.clipboard.writeText(revealedApiKey).then(() => {
                    setCopiedApiKey(true)
                    setTimeout(() => setCopiedApiKey(false), 2000)
                  })
                }}
                title="Copiar al portapapeles"
              >
                {copiedApiKey ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Una vez que cierres este dialogo, no podras recuperar el valor completo.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedApiKey(null)
                setCopiedApiKey(false)
              }}
            >
              Ya la guarde
            </Button>
          </DialogFooter>
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
