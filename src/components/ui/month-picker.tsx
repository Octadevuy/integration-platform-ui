"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MONTH_INDEXES = Array.from({ length: 12 }, (_, index) => index)

interface MonthPickerProps {
  selected?: Date
  defaultYear?: number
  disabled?: (date: Date) => boolean
  onSelect: (date: Date) => void
  locale?: string
  className?: string
}

function MonthPicker({
  selected,
  defaultYear,
  disabled,
  onSelect,
  locale,
  className,
}: MonthPickerProps) {
  const [year, setYear] = React.useState(
    () => defaultYear ?? selected?.getFullYear() ?? new Date().getFullYear()
  )

  const monthLabels = React.useMemo(
    () =>
      MONTH_INDEXES.map((month) =>
        new Date(2000, month, 1).toLocaleString(locale, { month: "short" })
      ),
    [locale]
  )

  return (
    <div className={cn("w-64 p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <Button
          className="size-7"
          onClick={() => setYear((current) => current - 1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          className="size-7"
          onClick={() => setYear((current) => current + 1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {monthLabels.map((label, month) => {
          const date = new Date(year, month, 1)
          const isDisabled = disabled?.(date) ?? false
          const isSelected =
            selected?.getFullYear() === year && selected?.getMonth() === month

          return (
            <Button
              className="capitalize"
              disabled={isDisabled}
              key={label}
              onClick={() => onSelect(date)}
              size="sm"
              type="button"
              variant={isSelected ? "default" : "ghost"}
            >
              {label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export { MonthPicker }
