"use client"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { History, Loader2, Search } from "lucide-react"
import { useState } from "react"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listDebtorQueryHistory } from "@/lib/admin-debtors-api"
import type { AuditEventResponse } from "@/types/admin"

function formatInstant(value: string | null | undefined) {
  if (!value) return "-"

  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm")
  } catch {
    return value
  }
}

function toInstantStartOfDay(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toISOString()
}

function toInstantEndOfDay(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59.999`).toISOString()
}

interface FilterForm {
  documentNumber: string
  from: string
  to: string
}

export function DebtorsHistoryPanel() {
  const [filters, setFilters] = useState<FilterForm>({
    documentNumber: "",
    from: "",
    to: "",
  })
  const [appliedFilters, setAppliedFilters] = useState<FilterForm>(filters)

  const historyQuery = useQuery({
    queryKey: ["debtor-query-history", appliedFilters],
    queryFn: () =>
      listDebtorQueryHistory({
        documentNumber: appliedFilters.documentNumber.trim() || undefined,
        from: appliedFilters.from ? toInstantStartOfDay(appliedFilters.from) : undefined,
        to: appliedFilters.to ? toInstantEndOfDay(appliedFilters.to) : undefined,
        size: 100,
      }),
  })

  const events = historyQuery.data ?? []

  const columns: ColumnDef<AuditEventResponse>[] = [
    {
      accessorKey: "occurredAt",
      header: "Fecha",
      cell: ({ row }) => formatInstant(row.original.occurredAt),
    },
    {
      id: "documentNumber",
      header: "Documento consultado",
      cell: ({ row }) => row.original.targetClientCode ?? "-",
    },
    {
      id: "origin",
      header: "Origen",
      cell: ({ row }) =>
        row.original.actorKeyPrefix ? (
          <Badge variant="outline">API externa</Badge>
        ) : (
          <Badge variant="secondary">Panel admin</Badge>
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
      accessorKey: "outcome",
      header: "Resultado",
      cell: ({ row }) => (
        <Badge variant={row.original.outcome === "SUCCESS" ? "default" : "destructive"}>
          {row.original.outcome}
        </Badge>
      ),
    },
    {
      accessorKey: "detail",
      header: "Detalle",
      cell: ({ row }) => row.original.detail ?? "-",
    },
  ]

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedFilters(filters)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="border border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="inline-flex items-center gap-2">
            <History className="size-4 text-brand-icon" />
            Historial de consultas
          </CardTitle>
          <CardDescription>
            Registro de auditoría de todas las consultas de reporte de deudores, sin importar si
            fueron realizadas desde el panel admin o por consumidores externos vía API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="historyDocumentNumber">Numero de documento</Label>
              <Input
                id="historyDocumentNumber"
                value={filters.documentNumber}
                onChange={(e) => setFilters((f) => ({ ...f, documentNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="historyFrom">Desde</Label>
              <Input
                id="historyFrom"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="historyTo">Hasta</Label>
              <Input
                id="historyTo"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit" disabled={historyQuery.isFetching}>
                {historyQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="pt-4">
          <DataTable
            columns={columns}
            data={events}
            emptyMessage="No hay consultas registradas para los filtros seleccionados"
            getRowId={(row) => String(row.id)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
