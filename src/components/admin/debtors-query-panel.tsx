"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format, parse, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getDebtorReport } from "@/lib/admin-debtors-api"
import { cn } from "@/lib/utils"
import type {
  AmountDto,
  DebtCategoryLineDto,
  DebtorReportDto,
  DebtorReportQuery,
  DebtorReportResponseDto,
  DocumentType,
  InstitutionDebtDto,
} from "@/types/admin"

const documentTypeValues = ["CI", "IDE", "RUT", "PASSPORT", "OTHER"] as const

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/

function getCurrentMonth() {
  return format(new Date(), "yyyy-MM")
}

const optionalPeriod = z
  .union([z.string().regex(periodPattern, "Formato YYYY-MM"), z.literal("")])
  .optional()

const querySchema = z
  .object({
    documentType: z.enum(documentTypeValues),
    number: z
      .string()
      .trim()
      .min(1, "Requerido")
      .max(50, "Maximo 50 caracteres"),
    country: z
      .string()
      .trim()
      .length(2, "Usa el codigo ISO de 2 letras"),
    periodFrom: optionalPeriod,
    periodTo: optionalPeriod,
  })
  .refine((data) => Boolean(data.periodFrom) === Boolean(data.periodTo), {
    message: "Completa ambos periodos (desde/hasta) o ninguno",
    path: ["periodTo"],
  })
  .refine((data) => !data.periodFrom || data.periodFrom <= getCurrentMonth(), {
    message: "No puede ser posterior al mes actual",
    path: ["periodFrom"],
  })
  .refine((data) => !data.periodTo || data.periodTo <= getCurrentMonth(), {
    message: "No puede ser posterior al mes actual",
    path: ["periodTo"],
  })

type QueryForm = z.infer<typeof querySchema>

interface SubmittedQuery {
  number: string
  params: DebtorReportQuery
}

function PeriodField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: string | undefined
  onChange: (value: string) => void
  error?: string
}) {
  const selected = value ? parse(value, "yyyy-MM", new Date()) : undefined

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-muted-foreground">(opcional)</span>
      </Label>
      <Popover>
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
            format(selected, "MMMM yyyy", { locale: es })
          ) : (
            <span>Seleccionar mes</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            captionLayout="dropdown"
            defaultMonth={selected}
            disabled={{ after: new Date() }}
            endMonth={new Date()}
            mode="single"
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM") : "")}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
      <p className="text-xs text-destructive">{error}</p>
    </div>
  )
}

function formatInstant(value: string | null | undefined) {
  if (!value) return "-"

  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm")
  } catch {
    return value
  }
}

function formatAmount(amount: AmountDto | null | undefined) {
  if (!amount) return "-"

  const formattedValue = Number.isFinite(amount.value)
    ? amount.value.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(amount.value)

  return `${formattedValue} ${amount.currency}`
}

// Renders whatever currency-view keys are present rather than hardcoding
// localPesos/foreignPesos/foreignUsd, in case the backend shape changes.
function renderAmounts(amounts: unknown) {
  if (!amounts || typeof amounts !== "object") {
    return <span className="text-muted-foreground">-</span>
  }

  const entries = Object.entries(amounts as Record<string, AmountDto>)

  if (!entries.length) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {entries.map(([key, value]) => (
        <span key={key}>
          <span className="text-muted-foreground">{key}:</span> {formatAmount(value)}
        </span>
      ))}
    </div>
  )
}

function renderCategoryLines(lines: DebtCategoryLineDto[]) {
  if (!lines.length) {
    return <span className="text-xs text-muted-foreground">Sin lineas</span>
  }

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <div key={`${line.category}-${index}`} className="text-xs">
          <span className="font-medium">{line.category}</span>
          <div className="ml-2">{renderAmounts(line.amounts)}</div>
        </div>
      ))}
    </div>
  )
}

function DebtorIdentity({ report }: { report: DebtorReportResponseDto }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">Deudor</p>
      <p className="font-medium">{report.fullName || "-"}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Documento: {report.document.type} {report.document.country} {report.document.number}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Rubro: {report.activitySector.code} - {report.activitySector.description}
      </p>
    </div>
  )
}

function PeriodReport({ report }: { report: DebtorReportDto }) {
  const totalsColumns = useMemo<ColumnDef<DebtCategoryLineDto>[]>(
    () => [
      {
        accessorKey: "category",
        header: "Categoria",
      },
      {
        id: "amounts",
        header: "Montos",
        cell: ({ row }) => renderAmounts(row.original.amounts),
      },
    ],
    [],
  )

  const institutionColumns = useMemo<ColumnDef<InstitutionDebtDto>[]>(
    () => [
      {
        accessorKey: "institutionName",
        header: "Institucion",
      },
      {
        accessorKey: "institutionCode",
        header: "Codigo",
        cell: ({ row }) => row.original.institutionCode ?? "-",
      },
      {
        accessorKey: "rating",
        header: "Calificacion",
        cell: ({ row }) => <Badge variant="outline">{row.original.rating}</Badge>,
      },
      {
        id: "lines",
        header: "Lineas por categoria",
        cell: ({ row }) => renderCategoryLines(row.original.lines),
      },
    ],
    [],
  )

  return (
    <Card className="border border-slate-200/70">
      <CardHeader className="border-b border-slate-200/80">
        <CardTitle className="text-base">Periodo {report.period}</CardTitle>
        <CardDescription>Generado: {formatInstant(report.generatedAt)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div>
          <p className="mb-2 text-sm font-medium">Totales</p>
          <DataTable
            columns={totalsColumns}
            data={report.totals}
            emptyMessage="Sin totales para este periodo"
            getRowId={(row, index) => `${row.category}-${index}`}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Instituciones</p>
          <DataTable
            columns={institutionColumns}
            data={report.institutions}
            emptyMessage="Sin instituciones reportantes para este periodo"
            getRowId={(row, index) => `${row.institutionName}-${index}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function DebtorsQueryPanel() {
  const [submittedQuery, setSubmittedQuery] = useState<SubmittedQuery | null>(null)
  const [requestId, setRequestId] = useState(0)

  const form = useForm<QueryForm>({
    resolver: zodResolver(querySchema),
    defaultValues: {
      documentType: "CI",
      number: "",
      country: "UY",
      periodFrom: "",
      periodTo: "",
    },
  })

  const reportQuery = useQuery({
    queryKey: ["debtor-report", requestId, submittedQuery],
    queryFn: () => {
      if (!submittedQuery) {
        return Promise.reject(new Error("Falta la consulta"))
      }

      return getDebtorReport(submittedQuery.number, submittedQuery.params)
    },
    enabled: Boolean(submittedQuery),
  })

  useEffect(() => {
    if (reportQuery.isError) {
      console.error("Error al consultar el informe del deudor:", reportQuery.error)
      toast.error("Ocurrió un error al realizar la consulta")
    }
  }, [reportQuery.isError, reportQuery.error])

  const onSubmit = form.handleSubmit((values) => {
    setRequestId((id) => id + 1)
    setSubmittedQuery({
      number: values.number.trim(),
      params: {
        documentType: values.documentType as DocumentType,
        country: values.country || undefined,
        periodFrom: values.periodFrom || undefined,
        periodTo: values.periodTo || undefined,
      },
    })
  })

  const report = reportQuery.data

  return (
    <div className="flex flex-col gap-5">
      <Card className="border border-slate-200/70">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="inline-flex items-center gap-2">
            <Search className="size-4 text-sky-700" />
            Consulta de deudores
          </CardTitle>
          <CardDescription>
            Consulta de solo lectura sobre los mismos datos de informe de deudores del BCU
            que reciben los consumidores externos de la API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Controller
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypeValues.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debtorNumber">Numero de documento</Label>
              <Input id="debtorNumber" {...form.register("number")} />
              <p className="text-xs text-destructive">{form.formState.errors.number?.message}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debtorCountry">Pais</Label>
              <Input id="debtorCountry" {...form.register("country")} />
              <p className="text-xs text-destructive">{form.formState.errors.country?.message}</p>
            </div>
            <Controller
              control={form.control}
              name="periodFrom"
              render={({ field }) => (
                <PeriodField
                  error={form.formState.errors.periodFrom?.message}
                  id="periodFrom"
                  label="Periodo desde"
                  onChange={(value) => {
                    field.onChange(value)
                    form.setValue("periodTo", value, { shouldValidate: true })
                  }}
                  value={field.value}
                />
              )}
            />
            <Controller
              control={form.control}
              name="periodTo"
              render={({ field }) => (
                <PeriodField
                  error={form.formState.errors.periodTo?.message}
                  id="periodTo"
                  label="Periodo hasta"
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
            <div className="flex justify-end sm:col-span-2 lg:col-span-5">
              <Button type="submit" disabled={reportQuery.isFetching}>
                {reportQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Consultar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!submittedQuery ? (
        <Card className="border border-dashed border-slate-200/70">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Ingresa un documento y consulta para ver el informe de deudor.
          </CardContent>
        </Card>
      ) : null}

      {submittedQuery && reportQuery.isFetching ? (
        <Card className="border border-slate-200/70">
          <CardContent className="space-y-3 py-4">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-40" />
            <div className="mt-2">
              <div className="mb-2 flex gap-3 border-b pb-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-24" />
                ))}
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 border-b py-2.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-24" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {report && !reportQuery.isFetching ? (
        <div className="flex flex-col gap-5">
          <DebtorIdentity report={report} />

          {report.reports.length ? (
            report.reports.map((periodReport) => (
              <PeriodReport key={periodReport.period} report={periodReport} />
            ))
          ) : (
            <Card className="border border-slate-200/70">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No hay informes disponibles para el periodo solicitado.
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  )
}
