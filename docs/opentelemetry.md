# OpenTelemetry

Pigeon's Electron main process exports OTLP/HTTP protobuf traces, metrics and logs as service `pigeon-desktop`. The default collector is `http://tuf.vcsoc.com:4318`. This is an unauthenticated, unencrypted private-network endpoint; use it only on a trusted network. For other deployments, configure a secured collector or gateway. Telemetry failures do not block application work.

## Configuration

Set environment variables before launching Pigeon:

- `PIGEON_OTEL_ENABLED=false` or `OTEL_SDK_DISABLED=true` disables export. Smoke tests and isolated Pigeon E2E profiles disable it automatically.
- `OTEL_SERVICE_NAME` overrides `pigeon-desktop`; `OTEL_DEPLOYMENT_ENVIRONMENT` adds the `deployment.environment.name` resource attribute.
- `OTEL_EXPORTER_OTLP_ENDPOINT` sets the base URL; `/v1/traces`, `/v1/metrics`, and `/v1/logs` are appended. Signal-specific `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, and `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` take full URLs. The exporter uses HTTP/protobuf.
- Standard OTLP exporter header environment variables can supply gateway credentials; keep them in the deployment's secret store, not the repository. Do not put credentials in endpoint URLs.

Example for development on the collector host only:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 pigeon
```

## Data and scope

Traces cover a bounded set of application timing events and selected IPC operations. Metrics include selected operation durations, diagnostic counts by severity, and main-process memory. Logs report startup and diagnostic severity, but deliberately omit diagnostic messages and context because those may contain file paths, asset names, or other private data. No request arguments, portfolio IDs, asset names, raw URLs or file paths are exported. Other worker and renderer processes are not independently instrumented; selected renderer timing events already collected by the main process can be exported. Outgoing HTTP and worker/database process boundaries are not automatically traced.

Async context is maintained within selected main-process IPC operations. No baggage is propagated or exported; the allowlist is empty. Trace context and baggage are not sent across external HTTP or process boundaries. Adding propagation requires an explicit allowlist and a trusted destination; never forward private baggage to arbitrary services.

The SDK uses bounded queues and timeouts. Shutdown attempts a bounded flush. Local diagnostics remain unchanged and may contain more detail; they are not sent verbatim to the collector. Grafana Explore can search Loki for `{service_name="pigeon-desktop"}`, Tempo for service `pigeon-desktop`, and Prometheus for `pigeon_process_memory` or `pigeon_diagnostics_total` (metric names may be normalized by the collector). Grafana access credentials are configured separately and are not OTLP credentials.
