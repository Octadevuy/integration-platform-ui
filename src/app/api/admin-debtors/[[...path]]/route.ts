import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

const ADMIN_PREFIX = "/api/v1/admin/debtors"
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag"]

export const dynamic = "force-dynamic"

function resolveBaseUrl() {
  const rawCandidate =
    process.env.BCU_API_BASE_URL || process.env.NEXT_PUBLIC_DEFAULT_BCU_API_URL || ""

  const candidate = rawCandidate
    .trim()
    .replace(/^['\"]+/, "")
    .replace(/['\"]+$/, "")

  if (!candidate) {
    throw new Error("Missing target base URL")
  }

  const parsed = new URL(candidate)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported target protocol")
  }

  return parsed.toString().replace(/\/+$/, "")
}

async function forward(request: NextRequest, path: string[]) {
  const session = await auth()

  if (!session) {
    return NextResponse.json(
      {
        title: "Unauthorized",
        detail: "A valid session is required.",
      },
      { status: 401 },
    )
  }

  const backendToken = session.backendToken

  if (!backendToken) {
    return NextResponse.json(
      {
        title: "Unauthorized",
        detail: "No backend token in session.",
      },
      { status: 401 },
    )
  }

  let targetBaseUrl: string

  try {
    targetBaseUrl = resolveBaseUrl()
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid target base URL"

    return NextResponse.json(
      {
        title: "Invalid target base URL",
        detail,
      },
      { status: 400 },
    )
  }

  const suffix = path.length ? `/${path.join("/")}` : ""
  const targetUrl = new URL(`${targetBaseUrl}${ADMIN_PREFIX}${suffix}`)
  targetUrl.search = request.nextUrl.search

  const headers = new Headers()
  headers.set("accept", request.headers.get("accept") || "application/json")
  headers.set("authorization", `Bearer ${backendToken}`)

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.text() : undefined

  if (body) {
    headers.set("content-type", request.headers.get("content-type") || "application/json")
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  })

  if (response.status === 401) {
    return NextResponse.json(
      {
        title: "Unauthorized",
        detail: "Backend rejected the session token. Please log in again.",
      },
      { status: 401 },
    )
  }

  const payload = await response.text()
  const responseHeaders = new Headers()

  FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
    const value = response.headers.get(headerName)

    if (value) {
      responseHeaders.set(headerName, value)
    }
  })

  return new NextResponse(payload, {
    status: response.status,
    headers: responseHeaders,
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params
  return forward(request, path)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params
  return forward(request, path)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params
  return forward(request, path)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params
  return forward(request, path)
}
