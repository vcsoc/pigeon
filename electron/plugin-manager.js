const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const LAMA_MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const LAMA_MODEL_BYTES = 208044816;
const LAMA_MODEL_MIN_BYTES = 150 * 1024 * 1024;
const LAMA_MODEL_MAX_BYTES = 260 * 1024 * 1024;
const BUILT_IN_PLUGINS = [{
  id: 'ai-removal',
  legacyDirectories: ['AI Removal'],
  name: 'AI Object Removal',
  version: '1.1.1',
  author: 'Pigeon',
  category: 'Image editing',
  description: 'Remove painted objects with a private Simple LaMa vision-inpainting model running on this computer.',
  kind: 'service',
  entry: 'server.py',
  model: {
    name: 'Simple LaMa ONNX',
    type: 'Vision inpainting (not an LLM)',
    size: '198 MB',
    bytes: LAMA_MODEL_BYTES,
    purpose: 'Object removal and background reconstruction',
    source: 'Carve/LaMa-ONNX on Hugging Face',
    license: 'Apache-2.0'
  },
  configSchema: [
    { key: 'endpoint', label: 'Local endpoint', type: 'url', default: 'http://127.0.0.1:8765/inpaint' },
    { key: 'pythonExecutable', label: 'Python 3.10/3.11', type: 'text', default: 'auto' },
    { key: 'brushSize', label: 'Default mask brush size', type: 'number', min: 5, max: 200, default: 45 }
  ]
}];

const defaultState = () => ({ plugins: {} });
function safeState(value) { return value && typeof value === 'object' && value.plugins && typeof value.plugins === 'object' ? value : defaultState(); }
function pluginDefaults(plugin) { return Object.fromEntries((plugin.configSchema || []).map((field) => [field.key, field.default])); }
function isLoopbackEndpoint(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
function existingFile(file) { return fsp.access(file).then(() => true).catch(() => false); }
function formatError(error) { return String(error?.message || error || 'Unknown plugin error').trim().slice(-1600); }
function runCommand(command, args, cwd, { timeoutMs = 900000, signal = null, onOutput = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = [];
    let settled = false;
    const append = (chunk) => { const text = String(chunk); output.push(text); onOutput?.(text); };
    const finish = (error, value = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => { child.kill(); finish(new Error('Plugin setup was canceled')); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Plugin setup timed out')); }, timeoutMs);
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', (error) => finish(error));
    child.once('exit', (code) => {
      const text = output.join('');
      finish(code === 0 ? null : new Error(text.slice(-1200) || `Plugin setup exited with code ${code}`), text.slice(-8000));
    });
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }
  });
}
async function compatiblePython(configured = 'auto') {
  const requested = String(configured || 'auto').trim();
  const check = async (executable, args = []) => {
    try {
      const output = await runCommand(executable, [...args, '-c', 'import sys; print(sys.executable); print(f"{sys.version_info.major}.{sys.version_info.minor}")'], process.cwd(), { timeoutMs: 20000 });
      const lines = output.trim().split(/\r?\n/), version = lines.at(-1);
      return ['3.10', '3.11'].includes(version) ? { executable: lines.at(-2), version } : null;
    } catch { return null; }
  };
  if (!['auto', 'python'].includes(requested.toLowerCase())) {
    const found = await check(requested);
    if (found) return found;
    throw new Error('AI Object Removal requires Python 3.10 or 3.11. Choose a compatible executable or set Python to auto.');
  }
  if (process.platform === 'win32') {
    for (const version of ['-3.11', '-3.10']) { const found = await check('py', [version]); if (found) return found; }
  }
  try {
    const executable = (await runCommand('uv', ['python', 'find', '3.11'], process.cwd(), { timeoutMs: 20000 })).trim().split(/\r?\n/).at(-1);
    const found = executable && await check(executable);
    if (found) return found;
  } catch {}
  for (const executable of ['python3.11', 'python3.10', 'python']) { const found = await check(executable); if (found) return found; }
  throw new Error('Python 3.10 or 3.11 was not found. Install Python 3.11, install uv, or configure a compatible executable in Plugin Manager.');
}

function createPluginManager({ pluginsDir, bundledDir }) {
  const stateFile = path.join(pluginsDir, 'plugin-state.json');
  const processes = new Map(), runtime = new Map(), setupOperations = new Map(), logs = new Map();
  const pluginDirectory = (id) => path.join(pluginsDir, id);
  const modelPaths = (id) => {
    const directory = pluginDirectory(id), modelDirectory = path.join(directory, 'models'), target = path.join(modelDirectory, 'lama_fp32.onnx');
    return { directory, modelDirectory, target, partial: `${target}.partial`, marker: path.join(directory, '.model-ready') };
  };
  const appendLog = (id, message) => {
    const entries = logs.get(id) || [];
    for (const line of String(message || '').split(/\r?\n/).filter(Boolean)) entries.push(`${new Date().toISOString()}  ${line}`);
    logs.set(id, entries.slice(-80));
  };
  const setRuntime = (id, status, detail, extra = {}) => {
    runtime.set(id, { ...(runtime.get(id) || {}), status, detail, updatedAt: Date.now(), ...extra });
    appendLog(id, detail);
  };
  async function load() { try { return safeState(JSON.parse(await fsp.readFile(stateFile, 'utf8'))); } catch { return defaultState(); } }
  async function save(state) { await fsp.mkdir(pluginsDir, { recursive: true }); await fsp.writeFile(stateFile, JSON.stringify(state, null, 2)); }
  async function installed(plugin) { return existingFile(path.join(pluginDirectory(plugin.id), plugin.entry)); }
  async function refreshBundled(plugin) {
    const source = path.join(bundledDir, plugin.id), target = pluginDirectory(plugin.id);
    await fsp.mkdir(target, { recursive: true });
    for (const name of [plugin.entry, 'requirements.txt', 'README.md']) await fsp.copyFile(path.join(source, name), path.join(target, name));
  }
  async function migrateLegacy(plugin) {
    if (await installed(plugin)) return false;
    for (const legacyName of plugin.legacyDirectories || []) {
      const legacy = path.join(pluginsDir, legacyName);
      if (!await existingFile(path.join(legacy, plugin.entry))) continue;
      await refreshBundled(plugin);
      setRuntime(plugin.id, 'installed', `Migrated the legacy “${legacyName}” plugin into managed storage. Your old folder was left unchanged.`);
      return true;
    }
    return false;
  }
  async function inspectModel(id) {
    const files = modelPaths(id);
    let bytes = 0, partialBytes = 0;
    try { bytes = (await fsp.stat(files.target)).size; } catch {}
    try { partialBytes = (await fsp.stat(files.partial)).size; } catch {}
    const marker = await existingFile(files.marker), validSize = bytes >= LAMA_MODEL_MIN_BYTES && bytes <= LAMA_MODEL_MAX_BYTES;
    return {
      ready: Boolean(marker && validSize),
      status: marker && validSize ? 'ready' : partialBytes ? 'partial' : bytes ? 'unvalidated' : 'missing',
      bytes, partialBytes, totalBytes: LAMA_MODEL_BYTES,
      percent: Math.max(0, Math.min(100, Math.floor((partialBytes || bytes) / LAMA_MODEL_BYTES * 100))),
      filename: 'lama_fp32.onnx', directory: files.modelDirectory
    };
  }
  async function list() {
    const state = await load(), result = [];
    for (const plugin of BUILT_IN_PLUGINS) {
      await migrateLegacy(plugin);
      const record = state.plugins[plugin.id] || {}, isInstalled = await installed(plugin), active = processes.get(plugin.id), operation = setupOperations.get(plugin.id), modelState = plugin.model ? await inspectModel(plugin.id) : { ready: true, status: 'ready' };
      const current = runtime.get(plugin.id) || {};
      const status = operation ? 'installing' : active && !active.killed ? (current.status || 'starting') : (current.status || (modelState.ready ? 'ready' : isInstalled ? 'installed' : 'available'));
      result.push({
        ...plugin, installed: isInstalled, modelReady: modelState.ready, modelState,
        enabled: Boolean(record.enabled && isInstalled), configured: { ...pluginDefaults(plugin), ...(record.config || {}) },
        status, statusDetail: current.detail || '', setupActive: Boolean(operation),
        python: current.python || record.python || null, logs: logs.get(plugin.id) || []
      });
    }
    let names = [];
    try { names = await fsp.readdir(pluginsDir); } catch {}
    for (const name of names.filter((item) => item.endsWith('.js'))) {
      const id = `local:${name}`, record = state.plugins[id] || {};
      result.push({ id, name: path.basename(name, '.js'), version: 'Local', author: 'Local file', category: 'Automation', description: 'Sandboxed JavaScript automation installed in the Pigeon plugins folder.', kind: 'script', entry: name, installed: true, enabled: record.enabled !== false, configured: {}, configSchema: [], status: 'ready', statusDetail: '', logs: [] });
    }
    return result;
  }
  async function downloadLamaModel(directory, id, signal) {
    const { modelDirectory, target, partial, marker } = modelPaths(id);
    await fsp.mkdir(modelDirectory, { recursive: true });
    await fsp.rm(marker, { force: true });
    try {
      const stat = await fsp.stat(target);
      if (stat.size >= LAMA_MODEL_MIN_BYTES && stat.size <= LAMA_MODEL_MAX_BYTES) return target;
      await fsp.rm(target, { force: true });
    } catch {}
    let existing = 0;
    try { existing = (await fsp.stat(partial)).size; if (existing > LAMA_MODEL_MAX_BYTES) { existing = 0; await fsp.rm(partial, { force: true }); } } catch {}
    const request = async (offset) => {
      const headers = { 'user-agent': 'Pigeon-AI-Removal/1.2' };
      if (offset) headers.range = `bytes=${offset}-`;
      return fetch(LAMA_MODEL_URL, { headers, signal });
    };
    setRuntime(id, 'installing', existing ? `Resuming Simple LaMa download at ${Math.round(existing / 1024 / 1024)} MB…` : 'Connecting to the Simple LaMa model download…', { progress: { phase: 'download', received: existing, total: LAMA_MODEL_BYTES } });
    let response = await request(existing);
    if (existing && response.status !== 206) { existing = 0; await fsp.rm(partial, { force: true }); response = await request(0); }
    if (!response.ok || !response.body) throw new Error(`Model download failed with HTTP ${response.status}. Check your connection and choose Resume setup to retry.`);
    const contentRange = response.headers.get('content-range'), parsedRangeTotal = Number(contentRange?.split('/').at(-1)), contentLength = Number(response.headers.get('content-length'));
    const total = Number.isFinite(parsedRangeTotal) ? parsedRangeTotal : Number.isFinite(contentLength) ? existing + contentLength : LAMA_MODEL_BYTES;
    if (total < LAMA_MODEL_MIN_BYTES || total > LAMA_MODEL_MAX_BYTES) throw new Error('The model host reported an unsafe download size. No model was installed.');
    const stream = fs.createWriteStream(partial, { flags: existing ? 'a' : 'w' }), reader = response.body.getReader();
    let received = existing, lastReported = -1;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal.aborted) throw new Error('Plugin setup was canceled');
        received += value.byteLength;
        if (received > LAMA_MODEL_MAX_BYTES) throw new Error('The model download exceeded the safety limit.');
        if (!stream.write(Buffer.from(value))) await new Promise((resolve) => stream.once('drain', resolve));
        const percent = Math.min(99, Math.floor(received / total * 100));
        if (percent !== lastReported) {
          lastReported = percent;
          setRuntime(id, 'installing', `Downloading Simple LaMa ONNX · ${percent}% · ${Math.round(received / 1024 / 1024)} of ${Math.round(total / 1024 / 1024)} MB`, { progress: { phase: 'download', percent, received, total } });
        }
      }
      await new Promise((resolve, reject) => stream.end((error) => error ? reject(error) : resolve()));
    } catch (error) { stream.destroy(); throw error; }
    if (received < LAMA_MODEL_MIN_BYTES) throw new Error('The model download is incomplete. The partial download was retained for Resume setup.');
    await fsp.rm(target, { force: true });
    await fsp.rename(partial, target);
    setRuntime(id, 'installing', 'Model downloaded · validating with ONNX Runtime…', { progress: { phase: 'validation', percent: 100, received, total } });
    return target;
  }
  async function install(id) {
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id);
    if (!plugin) throw new Error('Plugin is not in the available catalog');
    await fsp.mkdir(pluginsDir, { recursive: true });
    await refreshBundled(plugin);
    const state = await load(), record = state.plugins[id] || {};
    state.plugins[id] = { ...record, enabled: false, config: { ...pluginDefaults(plugin), ...(record.config || {}) } };
    await save(state);
    setRuntime(id, 'installed', 'Plugin files installed. Set up the private runtime and model next.');
    return list();
  }
  async function setup(id) {
    if (setupOperations.has(id)) throw new Error('Setup is already running. Progress is shown in Plugin Manager.');
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id);
    if (!plugin || !await installed(plugin)) throw new Error('Install the plugin first');
    const controller = new AbortController();
    setupOperations.set(id, controller);
    try {
      await refreshBundled(plugin);
      if (id !== 'ai-removal') return list();
      const state = await load(), config = { ...pluginDefaults(plugin), ...(state.plugins[id]?.config || {}) }, directory = pluginDirectory(id), venv = path.join(directory, '.venv');
      const venvPython = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
      let pythonInfo = state.plugins[id]?.python || null;
      setRuntime(id, 'installing', 'Finding Python 3.10/3.11…', { progress: { phase: 'python', percent: null } });
      if (!await existingFile(venvPython)) {
        pythonInfo = await compatiblePython(config.pythonExecutable);
        setRuntime(id, 'installing', `Creating a private Python ${pythonInfo.version} environment…`, { python: pythonInfo, progress: { phase: 'environment', percent: null } });
        await runCommand(pythonInfo.executable, ['-m', 'venv', venv], directory, { signal: controller.signal, onOutput: (text) => appendLog(id, text) });
      } else {
        try {
          const version = (await runCommand(venvPython, ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], directory, { timeoutMs: 20000, signal: controller.signal })).trim().split(/\r?\n/).at(-1);
          pythonInfo = { executable: venvPython, version };
        } catch {}
      }
      setRuntime(id, 'installing', 'Installing ONNX Runtime and image-processing dependencies…', { python: pythonInfo, progress: { phase: 'dependencies', percent: null } });
      await runCommand(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', path.join(directory, 'requirements.txt')], directory, { signal: controller.signal, onOutput: (text) => appendLog(id, text) });
      await downloadLamaModel(directory, id, controller.signal);
      setRuntime(id, 'installing', 'Validating the model and ONNX input contract…', { python: pythonInfo, progress: { phase: 'validation', percent: null } });
      await runCommand(venvPython, [path.join(directory, 'server.py'), '--prepare-model'], directory, { signal: controller.signal, onOutput: (text) => appendLog(id, text) });
      const nextState = await load();
      nextState.plugins[id] = { ...(nextState.plugins[id] || {}), python: pythonInfo };
      await save(nextState);
      setRuntime(id, 'ready', 'Simple LaMa ONNX is validated and ready. Enable the plugin to use it in the Image Editor.', { python: pythonInfo, progress: { phase: 'ready', percent: 100 } });
    } catch (error) {
      const detail = formatError(error);
      setRuntime(id, controller.signal.aborted ? 'canceled' : 'error', `${detail} Partial downloads are retained and can be resumed.`, { progress: null });
      throw new Error(detail);
    } finally { setupOperations.delete(id); }
    return list();
  }
  async function prepare(id) {
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id);
    if (!plugin) throw new Error('Plugin is not in the available catalog');
    if (!await installed(plugin)) await install(id);
    return setup(id);
  }
  async function cancelSetup(id) {
    const operation = setupOperations.get(id);
    if (!operation) return list();
    operation.abort();
    setRuntime(id, 'canceled', 'Canceling setup… The partial model download will be retained.');
    return list();
  }
  function stop(id) {
    const child = processes.get(id);
    if (child) { processes.delete(id); child.kill(); }
    setRuntime(id, 'stopped', 'Plugin is disabled.');
  }
  async function healthEndpoint(config) { return new URL('/health', config.endpoint).toString(); }
  async function health(id, { attempts = 1 } = {}) {
    const plugin = (await list()).find((item) => item.id === id);
    if (!plugin?.installed) return { ok: false, detail: 'Plugin is not installed.' };
    const endpoint = await healthEndpoint(plugin.configured);
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(700), cache: 'no-store' });
        const payload = await response.json();
        if (response.ok && payload.ok && payload.modelReady) return { ok: true, endpoint, model: payload.model, detail: `${payload.model} is healthy at ${endpoint}` };
        lastError = new Error(payload.modelReady === false ? 'The service is running but its model is not ready.' : `Health check returned HTTP ${response.status}.`);
      } catch (error) { lastError = error; }
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return { ok: false, endpoint, detail: formatError(lastError || 'The local service did not respond.') };
  }
  async function start(id) {
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id);
    if (!plugin || !await installed(plugin)) throw new Error('Install the plugin first');
    const bundledEntry=path.join(bundledDir,plugin.id,plugin.entry),installedEntry=path.join(pluginDirectory(plugin.id),plugin.entry);
    let bundledChanged=false;try{bundledChanged=!((await fsp.readFile(bundledEntry)).equals(await fsp.readFile(installedEntry)));}catch{}
    if(bundledChanged){if(processes.has(id))stop(id);await refreshBundled(plugin);setRuntime(id,'installed',`Updated ${plugin.name} to ${plugin.version}.`);}
    if (processes.has(id)) {
      const checked = await health(id, { attempts: 2 });
      if (checked.ok) return checked;
      stop(id);
    }
    if (id !== 'ai-removal') return { ok: true };
    const state = await load(), config = { ...pluginDefaults(plugin), ...(state.plugins[id]?.config || {}) };
    if (!isLoopbackEndpoint(config.endpoint)) throw new Error('AI Removal requires a loopback-only HTTP endpoint');
    const model = await inspectModel(id);
    if (!model.ready) throw new Error('Simple LaMa is not ready. Choose Install & set up or Resume setup first.');
    const directory = pluginDirectory(id), venvPython = process.platform === 'win32' ? path.join(directory, '.venv', 'Scripts', 'python.exe') : path.join(directory, '.venv', 'bin', 'python');
    if (!await existingFile(venvPython)) throw new Error('The managed Python runtime is missing. Choose Repair runtime & model.');
    const endpoint = new URL(config.endpoint), child = spawn(venvPython, [path.join(directory, plugin.entry)], {
      cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PIGEON_AI_REMOVAL_PORT: endpoint.port || '8765' }
    });
    processes.set(id, child);
    setRuntime(id, 'starting', 'Loading Simple LaMa ONNX and starting the private local service…');
    child.stdout.on('data', (chunk) => appendLog(id, chunk));
    child.stderr.on('data', (chunk) => appendLog(id, chunk));
    child.once('error', (error) => { if (processes.get(id) === child) processes.delete(id); setRuntime(id, 'error', formatError(error)); });
    child.once('exit', (code) => { if (processes.get(id) === child) processes.delete(id); if (runtime.get(id)?.status !== 'stopped') setRuntime(id, code === 0 ? 'stopped' : 'error', `Local AI service stopped with code ${code}. See setup log for details.`); });
    child.unref();
    const checked = await health(id, { attempts: 180 });
    if (!checked.ok) { const recent=(logs.get(id)||[]).slice(-4).join(' · ');stop(id);throw new Error(`AI service could not start · ${checked.detail}${recent?` · ${recent}`:''}`); }
    setRuntime(id, 'running', checked.detail);
    return checked;
  }
  async function ensureRunning(id) {
    const state = await load();
    if (!state.plugins[id]?.enabled) throw new Error('Enable AI Object Removal in Plugin Manager first');
    const checked = await health(id, { attempts: 1 });
    if (checked.ok) return checked;
    return start(id);
  }
  async function setEnabled(id, enabled) {
    const state = await load(), plugins = await list(), plugin = plugins.find((item) => item.id === id);
    if (!plugin) throw new Error('Plugin not found');
    if (!plugin.installed) throw new Error('Install the plugin first');
    if (enabled && plugin.kind === 'service') await start(id);
    if (!enabled && plugin.kind === 'service') stop(id);
    state.plugins[id] = { ...(state.plugins[id] || {}), enabled: Boolean(enabled), config: { ...(plugin.configured || {}), ...(state.plugins[id]?.config || {}) } };
    await save(state);
    return list();
  }
  async function configure(id, config) {
    const plugin = (await list()).find((item) => item.id === id);
    if (!plugin) throw new Error('Plugin not found');
    const next = { ...plugin.configured };
    for (const field of plugin.configSchema || []) if (Object.hasOwn(config || {}, field.key)) next[field.key] = field.type === 'number' ? Math.max(field.min || -Infinity, Math.min(field.max || Infinity, Number(config[field.key]) || field.default)) : String(config[field.key] ?? field.default).trim();
    if (id === 'ai-removal' && !isLoopbackEndpoint(next.endpoint)) throw new Error('AI Removal requires a loopback-only HTTP endpoint');
    const state = await load(), wasEnabled = Boolean(state.plugins[id]?.enabled);
    if (wasEnabled && plugin.kind === 'service') stop(id);
    state.plugins[id] = { ...(state.plugins[id] || {}), enabled: false, config: next };
    await save(state);
    if (wasEnabled && plugin.kind === 'service') {
      await start(id);
      const refreshed = await load(); refreshed.plugins[id].enabled = true; await save(refreshed);
    }
    setRuntime(id, wasEnabled ? 'running' : plugin.modelReady ? 'ready' : 'installed', wasEnabled ? 'Configuration saved and local service restarted.' : 'Configuration saved.');
    return list();
  }
  async function importModel(id, sourcePath) {
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id);
    if (!plugin || !await installed(plugin)) throw new Error('Install the plugin before importing a model');
    const stat = await fsp.stat(sourcePath);
    if (stat.size < LAMA_MODEL_MIN_BYTES || stat.size > LAMA_MODEL_MAX_BYTES) throw new Error('The selected file is not a supported Simple LaMa ONNX model size.');
    const files = modelPaths(id);
    await fsp.mkdir(files.modelDirectory, { recursive: true });
    await fsp.rm(files.marker, { force: true });
    await fsp.copyFile(sourcePath, files.target);
    setRuntime(id, 'installed', 'Local model imported. Choose Validate imported model to finish setup.');
    return list();
  }
  async function removeModel(id) {
    if (setupOperations.has(id)) throw new Error('Cancel setup before removing the model.');
    stop(id);
    const state = await load();
    if (state.plugins[id]) { state.plugins[id].enabled = false; await save(state); }
    const files = modelPaths(id);
    await Promise.all([fsp.rm(files.target, { force: true }), fsp.rm(files.partial, { force: true }), fsp.rm(files.marker, { force: true })]);
    setRuntime(id, 'installed', 'Managed model removed. The plugin configuration and private runtime were retained.');
    return list();
  }
  async function uninstall(id) {
    const plugin = BUILT_IN_PLUGINS.find((item) => item.id === id), state = await load();
    if (!plugin) {
      const local = (await list()).find((item) => item.id === id && item.kind === 'script');
      if (!local) throw new Error('Plugin not found');
      await fsp.rm(path.join(pluginsDir, path.basename(local.entry)), { force: true }); delete state.plugins[id]; await save(state); return list();
    }
    setupOperations.get(id)?.abort(); stop(id);
    await fsp.rm(pluginDirectory(id), { recursive: true, force: true }); delete state.plugins[id]; await save(state); runtime.delete(id); logs.delete(id);
    return list();
  }
  async function configuration(id) { return (await list()).find((item) => item.id === id)?.configured || {}; }
  async function restoreEnabled() {
    for (const plugin of await list()) if (plugin.enabled && plugin.kind === 'service') start(plugin.id).catch((error) => setRuntime(plugin.id, 'error', formatError(error)));
  }
  function close() { for (const operation of setupOperations.values()) operation.abort(); for (const id of [...processes.keys()]) stop(id); }
  return { list, install, setup, prepare, cancelSetup, health, ensureRunning, importModel, removeModel, uninstall, setEnabled, configure, configuration, restoreEnabled, close };
}

module.exports = { BUILT_IN_PLUGINS, createPluginManager, isLoopbackEndpoint, compatiblePython, LAMA_MODEL_URL, LAMA_MODEL_BYTES };
