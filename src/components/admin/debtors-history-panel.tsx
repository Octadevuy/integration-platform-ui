"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parse, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Search,
} from "lucide-react"
import { useState } from "react"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { listDebtorQueryHistory } from "@/lib/admin-debtors-api"
import { cn } from "@/lib/utils"
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

const EMPTY_FILTERS: FilterForm = {
  documentNumber: "",
  from: "",
  to: "",
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const [open, setOpen] = useState(false)
  const now = new Date()

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-muted-foreground">(opcional)</span>
      </Label>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selected && "text-muted-foreground"
              )}
            />
          }
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? (
            format(selected, "dd/MM/yyyy", { locale: es })
          ) : (
            <span>Seleccionar fecha</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={es}
            defaultMonth={selected}
            disabled={(date) => date > now}
            selected={selected}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "")
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function DebtorsHistoryPanel() {
  const [filters, setFilters] = useState<FilterForm>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterForm>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)

  const hasAnyFilter = (f: FilterForm) => Boolean(f.documentNumber.trim() || f.from || f.to)
  const canFilter = hasAnyFilter(filters)
  const isFiltered = hasAnyFilter(appliedFilters)

  const historyQuery = useQuery({
    queryKey: ["debtor-query-history", appliedFilters, page],
    queryFn: () =>
      listDebtorQueryHistory({
        documentNumber: appliedFilters.documentNumber.trim() || undefined,
        from: appliedFilters.from ? toInstantStartOfDay(appliedFilters.from) : undefined,
        to: appliedFilters.to ? toInstantEndOfDay(appliedFilters.to) : undefined,
        page,
        size: 20,
      }),
    placeholderData: keepPreviousData,
  })

  const historyPage = historyQuery.data
  const events = historyPage?.content ?? []
  const totalPages = historyPage?.totalPages ?? 0

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
    if (!canFilter) return
    setPage(0)
    setAppliedFilters(filters)
  }

  const onClear = () => {
    setPage(0)
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
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
            <DateField
              id="historyFrom"
              label="Desde"
              value={filters.from}
              onChange={(value) => setFilters((f) => ({ ...f, from: value }))}
            />
            <DateField
              id="historyTo"
              label="Hasta"
              value={filters.to}
              onChange={(value) => setFilters((f) => ({ ...f, to: value }))}
            />
            <div className="flex flex-col items-end justify-end gap-1 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                {isFiltered || canFilter ? (
                  <Button type="button" variant="ghost" onClick={onClear}>
                    Limpiar
                  </Button>
                ) : null}
                <Button type="submit" disabled={!canFilter || historyQuery.isFetching}>
                  {historyQuery.isFetching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Filtrar
                </Button>
              </div>
              {!canFilter ? (
                <p className="text-xs text-muted-foreground">
                  Para filtrar, ingresa numero de documento, desde o hasta
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="pt-4">
          {historyQuery.isPending ? (
            <div className="py-2">
              <div className="mb-2 flex gap-3 border-b pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-24" />
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 border-b py-2.5">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-24" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={events}
              emptyMessage={
                isFiltered
                  ? "No hay consultas registradas para los filtros seleccionados"
                  : "Aun no hay consultas registradas"
              }
              getRowId={(row) => String(row.id)}
            />
          )}
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Pagina {page + 1} de {totalPages} ({historyPage?.totalElements} consultas)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={page === 0 || historyQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={page + 1 >= totalPages || historyQuery.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
