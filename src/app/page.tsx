"use client"

import dynamic from "next/dynamic"

const AdminDashboard = dynamic(() => import("@/components/admin/admin-dashboard").then((mod) => mod.AdminDashboard), {
  ssr: false,
})

export default function Home() {
  return <AdminDashboard />
}
