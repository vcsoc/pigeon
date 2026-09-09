const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function launch(profile, reportDir) {
  if (
    (await fsp.readFile(path.join(profile, ".pigeon-e2e-profile"), "utf8")) !==
    "pigeon-e2e-v1\n"
  )
    throw Error("Not an isolated E2E profile");
  const log = fs.createWriteStream(path.join(reportDir, "electron.log"));
  const started = Date.now(),
    errors = [],
    pending = new Map();
  let endpoint = "",
    sequence = 0,
    stderr = "",
    lastActionAt = 0,
    socket,
    spawnError;
  let closed = false;
  const child = spawn(
    require("electron"),
    [
      path.join(__dirname, "bootstrap.cjs"),
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      "--mute-audio",
      ...(process.env.PIGEON_E2E_HEADLESS === "1"
        ? ["--ozone-platform=headless"]
        : []),
    ],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, PIGEON_E2E_PROFILE: profile },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.once("error", (error) => {
    spawnError = error;
  });
  let shutdown = async () => {
    child.kill("SIGTERM");
  };
  const onSignal = () => {
    void shutdown().finally(() => process.exit(1));
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  child.stdout.pipe(log, { end: false });
  child.stderr.on("data", (chunk) => {
    log.write(chunk);
    stderr += chunk;
    endpoint =
      stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1] || endpoint;
  });
  try {
    shutdown = close;
    const deadline = Date.now() + 15000;
    while (!endpoint) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode)
        throw Error(`Electron exited before debugger: ${stderr}`);
      if (Date.now() > deadline) {
        child.kill("SIGTERM");
        throw Error("Electron debugger startup timed out");
      }
      await sleep(25);
    }
    const url = new URL(endpoint);
    let target;
    while (!target) {
      const list = await (
        await fetch(`http://${url.host}/json/list`, {
          signal: AbortSignal.timeout(2000),
        })
      ).json();
      target = list.find((t) => t.type === "page");
      if (Date.now() > deadline) throw Error("No renderer target");
      if (!target) await sleep(25);
    }
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("CDP websocket connection timed out")),
        5000,
      );
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(Error("CDP websocket connection failed"));
      };
    });
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = pending.get(message.id);
        if (entry) {
          clearTimeout(entry.timer);
          pending.delete(message.id);
          message.error
            ? entry.reject(Error(message.error.message))
            : entry.resolve(message.result);
        }
      } else if (message.method === "Runtime.exceptionThrown")
        errors.push(message.params.exceptionDetails);
    };
    function send(method, params = {}, timeout = 5000) {
      return new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
          reject(Error("CDP connection closed"));
          return;
        }
        const id = ++sequence,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(Error(`CDP timeout: ${method}`));
          }, timeout);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw Error(
          result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text,
        );
      return result.result?.value;
    }
    await send("Runtime.enable");
    await send("Page.enable");
    async function wait(expression, timeout = 5000) {
      const began = Date.now();
      let last;
      while (Date.now() - began < timeout) {
        last = await evaluate(expression);
        if (last) return { value: last, ms: Date.now() - began };
        await sleep(25);
      }
      throw Error(
        `Condition timed out (${timeout}ms): ${expression}\nLast: ${JSON.stringify(last)}`,
      );
    }
    async function point(selector) {
      const result = await evaluate(
        `(async()=>{let e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:e.closest('#sidebar-tree-scroll')?'center':'nearest',inline:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height&&r.bottom>0&&r.top<innerHeight&&getComputedStyle(e).visibility!=='hidden'?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`,
      );
      if (!result) throw Error(`Target not visible: ${selector}`);
      return result;
    }
    async function move(selector) {
      const p = await point(selector);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...p });
      return p;
    }
    async function click(selector, { button = "left", modifiers = 0 } = {}) {
      await move(selector);
      const p = await point(selector);
      const hit = await evaluate(
        `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),hit=document.elementFromPoint(${p.x},${p.y});return e?.contains(hit);})()`,
      );
      if (!hit) throw Error(`Target obscured or moving: ${selector}`);
      lastActionAt = Date.now();
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...p,
        button,
        buttons: button === "right" ? 2 : 1,
        clickCount: 1,
        modifiers,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...p,
        button,
        buttons: 0,
        clickCount: 1,
        modifiers,
      });
    }
    async function key(key, code, modifiers = 0) {
      const digit = /^[0-9]$/.test(key),
        letter = key.length === 1;
      const virtual = digit
        ? key.charCodeAt(0)
        : {
            Escape: 27,
            Enter: 13,
            Backspace: 8,
            ArrowDown: 40,
            ArrowUp: 38,
            ArrowLeft: 37,
            ArrowRight: 39,
          }[key] || (letter ? key.toUpperCase().charCodeAt(0) : 0);
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code:
          code ||
          (digit ? "Digit" + key : letter ? "Key" + key.toUpperCase() : key),
        modifiers,
        windowsVirtualKeyCode: virtual,
        ...(!modifiers && letter ? { text: key } : {}),
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: code || key,
        modifiers,
        windowsVirtualKeyCode: virtual,
      });
    }
    async function fill(selector, text) {
      await click(selector);
      await key("a", "KeyA", process.platform === "darwin" ? 4 : 2);
      await key("Backspace");
      if (text) {
        lastActionAt = Date.now();
        await send("Input.insertText", { text });
      }
    }
    async function screenshot(name) {
      const result = await send("Page.captureScreenshot", { format: "png" });
      await fsp.writeFile(
        path.join(reportDir, name + ".png"),
        Buffer.from(result.data, "base64"),
      );
    }
    async function close() {
      if (closed) return;
      closed = true;
      process.removeListener("SIGTERM", onSignal);
      process.removeListener("SIGINT", onSignal);
      socket?.close();
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(Error("Driver closed"));
      }
      pending.clear();
      child.kill("SIGTERM");
      for (
        let i = 0;
        i < 100 && child.exitCode === null && !child.signalCode;
        i++
      )
        await sleep(50);
      if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
      log.end();
    }
    return {
      started,
      get lastActionAt() {
        return lastActionAt;
      },
      child,
      errors,
      send,
      evaluate,
      wait,
      point,
      move,
      click,
      key,
      fill,
      screenshot,
      close,
    };
  } catch (error) {
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGINT", onSignal);
    socket?.close();
    child.kill("SIGTERM");
    for (
      let i = 0;
      i < 100 && child.exitCode === null && !child.signalCode && !spawnError;
      i++
    )
      await sleep(50);
    if (child.exitCode === null && !child.signalCode && !spawnError)
      child.kill("SIGKILL");
    log.end();
    throw error;
  }
}
module.exports = { launch, sleep };
