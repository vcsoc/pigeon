# Pigeon Grafana dashboards

Import `dashboards/pigeon-overview.json` and `dashboards/pigeon-operations.json` through Grafana's dashboard import UI. They expect the provisioned datasource UIDs `prometheus`, `loki`, and `tempo`, and the default OpenTelemetry service name `pigeon-desktop`. If the service name or datasource UIDs are customized, update the queries and datasource references when importing.

The overview shows process memory, diagnostic rates, operation volume and p95 duration, and a privacy-filtered log stream. The operations dashboard includes latency, diagnostic and memory panels plus Tempo TraceQL search and logs. Infrequent operations may have no samples in short windows; select a wider time range. The dashboards cannot show private diagnostic detail or data that Pigeon's instrumentation does not export. See `docs/opentelemetry.md` for signal scope and privacy details.

Dashboard JSON is a portable reference. The copies created through the Grafana API are stored in Grafana's database and can be edited there; edits in Grafana do not automatically update these files.
