import { NextRequest, NextResponse } from "next/server"

const ADMIN_PREFIX = "/api/v1/admin/integrations"
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag"]

export const dynamic = "force-dynamic"

function resolveBaseUrl(request: NextRequest) {
  const candidate =
    request.headers.get("x-target-base-url") ||
    process.env.BCU_API_BASE_URL ||
    process.env.NEXT_PUBLIC_DEFAULT_BCU_API_URL ||
    ""

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
  const adminApiKey = request.headers.get("x-admin-api-key")

  if (!adminApiKey) {
    return NextResponse.json(
      {
        title: "Missing admin API key",
        detail: "Send x-admin-api-key with an admin.manage credential.",
      },
      { status: 400 },
    )
  }

  let targetBaseUrl: string

  try {
    targetBaseUrl = resolveBaseUrl(request)
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
  headers.set("x-api-key", adminApiKey)

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