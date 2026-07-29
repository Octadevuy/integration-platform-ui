import { useAzureMonitor } from "@azure/monitor-opentelemetry"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"
import type { Instrumentation } from "next"

// Cloud role name in Application Insights (application map, role filters).
// OTEL_SERVICE_NAME wins if the environment already sets it.
process.env.OTEL_SERVICE_NAME ??= "bcu-ui"

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING

if (connectionString) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook, server-only file
  useAzureMonitor({
    azureMonitorExporterOptions: { connectionString },
    // 1 = export every trace. Lower via env once volume warrants it.
    samplingRatio: Number(process.env.OTEL_SAMPLING_RATIO ?? "1"),
    // Live Metrics keeps an extra outbound stream open; enable only where
    // someone actually watches the pane.
    enableLiveMetrics: process.env.OTEL_LIVE_METRICS === "1",
  })
} else {
  console.warn(
    "APPLICATIONINSIGHTS_CONNECTION_STRING is not set - telemetry is disabled",
  )
}

// The distro registers a global LoggerProvider; without a connection string
// logs.getLogger returns a no-op, so this stays safe in local dev. Records
// carrying exception.* attributes land in the App Insights exceptions table.
export const reportRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const error = err instanceof Error ? err : new Error(String(err))
  const digest = (error as { digest?: string }).digest
  logs.getLogger("bcu-ui").emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: "ERROR",
    body: error.message,
    attributes: {
      "exception.type": error.name,
      "exception.message": error.message,
      "exception.stacktrace": error.stack ?? "",
      "http.request.method": request.method,
      "url.path": request.path,
      "next.route": context.routePath,
      "next.route_type": context.routeType,
      ...(digest ? { "error.digest": digest } : {}),
    },
  })
}
