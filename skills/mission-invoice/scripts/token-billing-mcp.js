#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DATA_DIR = process.env.TOKEN_BILLING_PANEL_DATA_DIR || path.join(os.homedir(), ".codex-token-billing");
const OVERRIDE_RUNTIME = path.join(DATA_DIR, "runtime", "mission-invoice-runtime.cjs");
const BUNDLED_RUNTIME = path.resolve(__dirname, "..", "runtime", "mission-invoice-runtime.cjs");

function runtimePath() {
  return fs.existsSync(OVERRIDE_RUNTIME) ? OVERRIDE_RUNTIME : BUNDLED_RUNTIME;
}

function loadRuntime() {
  const file = runtimePath();
  delete require.cache[require.resolve(file)];
  return require(file);
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function parseCliArgs(runtime) {
  const command = process.argv[2];
  const rawJson = process.argv[3] || "{}";
  if (!command) return null;
  const toolName = runtime.cliAliases?.[command] || command;
  let args;
  try {
    args = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Invalid JSON arguments: ${error.message}`);
  }
  return { toolName, args };
}

async function runCli() {
  const runtime = loadRuntime();
  runtime.ensureStore?.();
  const parsed = parseCliArgs(runtime);
  if (!parsed) return false;
  const result = await runtime.callTool(parsed.toolName, parsed.args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return true;
}

let buffer = Buffer.alloc(0);

function extractMessages() {
  const messages = [];
  while (buffer.length > 0) {
    const text = buffer.toString("utf8");
    if (text.startsWith("Content-Length:")) {
      const headerEnd = text.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = text.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = Buffer.byteLength(text.slice(0, headerEnd + 4), "utf8");
      if (buffer.length < bodyStart + length) break;
      messages.push(buffer.subarray(bodyStart, bodyStart + length).toString("utf8"));
      buffer = buffer.subarray(bodyStart + length);
      continue;
    }

    const newline = text.indexOf("\n");
    if (newline === -1) break;
    messages.push(text.slice(0, newline).trim());
    buffer = buffer.subarray(Buffer.byteLength(text.slice(0, newline + 1), "utf8"));
  }
  return messages.filter(Boolean);
}

function runMcpServer() {
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    for (const rawMessage of extractMessages()) {
      let request;
      try {
        request = JSON.parse(rawMessage);
      } catch {
        continue;
      }
      Promise.resolve()
        .then(() => {
          const runtime = loadRuntime();
          runtime.ensureStore?.();
          return runtime.handle(request);
        })
        .then((result) => {
          if (request.id === undefined) return;
          sendMessage({ jsonrpc: "2.0", id: request.id, result });
        })
        .catch((error) => {
          if (request.id === undefined) return;
          sendMessage({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32000, message: error.message }
          });
        });
    }
  });
}

runCli()
  .then((handled) => {
    if (!handled) runMcpServer();
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
