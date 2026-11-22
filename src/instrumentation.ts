import type { Instrumentation } from "next";
import { captureError } from "@/lib/observability";

export async function register() {
  // Reserved for OpenTelemetry/Sentry initialization in a later version.
  // Keeping this hook present means onRequestError below is wired for production.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureError(error, {
    source: "next.onRequestError",
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
