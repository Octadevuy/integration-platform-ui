"use client"

import { Palette } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "bcu-brand"
type Brand = "new" | "legacy"

export function BrandToggle() {
  const [brand, setBrand] = useState<Brand>("new")

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "legacy") {
      setBrand("legacy")
      document.documentElement.setAttribute("data-brand", "legacy")
    }
  }, [])

  function toggle() {
    const next: Brand = brand === "new" ? "legacy" : "new"
    setBrand(next)
    if (next === "legacy") {
      document.documentElement.setAttribute("data-brand", "legacy")
    } else {
      document.documentElement.removeAttribute("data-brand")
    }
    localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 shadow-lg"
    >
      <Palette />
      Paleta: {brand === "new" ? "Nueva" : "Anterior"}
    </Button>
  )
}
