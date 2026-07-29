import type { Instrumentation } from "next"

// Runs once per server boot, before any request is handled. The Azure
// Monitor distro only works on the Node.js runtime (it pulls in native
// Node APIs), so the edge runtime is skipped via dynamic import.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node")
  }
}

// Reports every server-side error Next.js captures (RSC render, route
// handlers, server actions, proxy) as an exception in Application Insights.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportRequestError } = await import("./instrumentation.node")
    reportRequestError(err, request, context)
  }
}
