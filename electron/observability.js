'use strict';

const api=require('@opentelemetry/api');
const {resourceFromAttributes}=require('@opentelemetry/resources');
const {BasicTracerProvider,BatchSpanProcessor}=require('@opentelemetry/sdk-trace-base');
const {MeterProvider,PeriodicExportingMetricReader}=require('@opentelemetry/sdk-metrics');
const {LoggerProvider,BatchLogRecordProcessor}=require('@opentelemetry/sdk-logs');
const {OTLPTraceExporter}=require('@opentelemetry/exporter-trace-otlp-proto');
const {OTLPMetricExporter}=require('@opentelemetry/exporter-metrics-otlp-proto');
const {OTLPLogExporter}=require('@opentelemetry/exporter-logs-otlp-proto');
const {AsyncLocalStorageContextManager}=require('@opentelemetry/context-async-hooks');

const DEFAULT_ENDPOINT='http://tuf.vcsoc.com:4318';
const IPC_OPERATIONS=new Set(['folder-tree:build','library:get','library:rescan','library:refresh-sources','assets:batch-update','assets:similar-groups','assets:auto-tag','library:backup']);
const OPERATIONS=new Set(['sqlite-open','sqlite-read-metadata','sqlite-read-locations','sqlite-read-assets','sqlite-read-collections','sqlite-read-smart-folders','sqlite-migrate-library','sqlite-load-and-migrate','library-worker-loaded','library-worker-transfer','main-asset-index','main-library-adopt','asset-stream','first-metadata-chunk-sent','first-batch-frame-ack','folder-tree-projection','renderer:first-asset-chunk','renderer:first-grid-paint','renderer:asset-stream-complete']);
function signalUrl(env,signal){const specific=env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`];if(specific)return new URL(specific).href;const base=new URL(env.OTEL_EXPORTER_OTLP_ENDPOINT||DEFAULT_ENDPOINT);base.pathname=base.pathname.replace(/\/$/,'')+`/v1/${signal}`;return base.href;}
function createObservability({env=process.env,version='unknown',disabled=false}={}){
  const noop={diagnostic(){},performance(){},run:(_name,fn)=>fn(),shutdown:async()=>{}};
  if(disabled||env.OTEL_SDK_DISABLED==='true'||env.PIGEON_OTEL_ENABLED==='false')return noop;
  try{
    const resource=resourceFromAttributes({'service.name':env.OTEL_SERVICE_NAME||'pigeon-desktop','service.version':version,...(env.OTEL_DEPLOYMENT_ENVIRONMENT?{'deployment.environment.name':env.OTEL_DEPLOYMENT_ENVIRONMENT}:{})});
    const traceExporter=new OTLPTraceExporter({url:signalUrl(env,'traces'),timeoutMillis:3000});
    const metricExporter=new OTLPMetricExporter({url:signalUrl(env,'metrics'),timeoutMillis:3000});
    const logExporter=new OTLPLogExporter({url:signalUrl(env,'logs'),timeoutMillis:3000});
    const traces=new BasicTracerProvider({resource,spanProcessors:[new BatchSpanProcessor(traceExporter,{maxQueueSize:512,maxExportBatchSize:128,scheduledDelayMillis:5000,exportTimeoutMillis:3000})]});
    const metrics=new MeterProvider({resource,readers:[new PeriodicExportingMetricReader({exporter:metricExporter,exportIntervalMillis:15000,exportTimeoutMillis:3000})]});
    const logs=new LoggerProvider({resource,processors:[new BatchLogRecordProcessor(logExporter,{maxQueueSize:512,maxExportBatchSize:128,scheduledDelayMillis:5000,exportTimeoutMillis:3000})]});
    api.context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    const tracer=traces.getTracer('pigeon-desktop'),meter=metrics.getMeter('pigeon-desktop'),logger=logs.getLogger('pigeon-desktop');
    const diagnostics=meter.createCounter('pigeon.diagnostics.total',{description:'Local diagnostics by severity'}),operations=meter.createHistogram('pigeon.operation.duration',{unit:'ms',description:'Selected application operation duration'});
    const memory=meter.createObservableGauge('pigeon.process.memory',{unit:'By',description:'Electron main process memory'});memory.addCallback(result=>{const usage=process.memoryUsage();result.observe(usage.rss,{kind:'rss'});result.observe(usage.heapUsed,{kind:'heap_used'});});
    logger.emit({severityNumber:9,severityText:'INFO',body:'Pigeon desktop telemetry started'});
    const startup=tracer.startSpan('pigeon.startup');startup.end();
    return {
      diagnostic(level){const severity=level==='error'?'error':level==='warning'?'warning':'info';diagnostics.add(1,{severity});logger.emit({severityNumber:severity==='error'?17:severity==='warning'?13:9,severityText:severity.toUpperCase(),body:'Pigeon diagnostic recorded',attributes:{'pigeon.diagnostic.severity':severity}});},
      performance(entry){if(!OPERATIONS.has(entry.name))return;const duration=Math.max(0,Number(entry.durationMs)||0);operations.record(duration,{operation:entry.name});const end=Date.now(),span=tracer.startSpan(`pigeon.${entry.name}`,{startTime:end-duration,attributes:{'pigeon.operation':entry.name}});span.end(end);},
      run(name,fn){if(!IPC_OPERATIONS.has(name))return fn();return tracer.startActiveSpan(`ipc.${name}`,async span=>{try{return await fn();}catch(error){span.setStatus({code:api.SpanStatusCode.ERROR});throw error;}finally{span.end();}});},
      async shutdown(){await Promise.allSettled([traces.shutdown(),metrics.shutdown(),logs.shutdown()]);}
    };
  }catch{return noop;}
}
module.exports={createObservability,signalUrl,OPERATIONS};
