#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const templateDir = path.resolve(__dirname, "../templates/japanese-v1");
const metadata = JSON.parse(
  fs.readFileSync(path.join(templateDir, "template.json"), "utf8")
);
const html = fs.readFileSync(path.join(templateDir, "template.html"), "utf8");
const referencePath = path.join(templateDir, "reference.png");
const runtime = require("../runtime/mission-invoice-runtime.cjs");

assert.equal(metadata.id, "japanese-v1");
assert.equal(metadata.status, "stored");
assert.equal(metadata.runtimeIntegration, false);
assert.equal(metadata.nativeFloatingReceipt.contentWidthPt, 280);
assert.equal(metadata.nativeFloatingReceipt.outerWindowWidthPt, 292);
assert.equal(metadata.nativeFloatingReceipt.shadowInsetsPt.leading, 6);
assert.equal(metadata.nativeFloatingReceipt.shadowInsetsPt.trailing, 6);
assert.ok(fs.statSync(referencePath).size > 0);

for (const placeholder of metadata.placeholders) {
  assert.match(html, new RegExp(`{{${placeholder}}}`));
}

assert.match(html, /width:\s*min\(400px,\s*100%\)/);
assert.match(html, /min-height:\s*560px/);
assert.match(html, /--wine:\s*#7a0d1e/i);
assert.match(html, /--paper:\s*#f6f3ee/i);
assert.match(html, /clip-path:\s*polygon/);
assert.match(html, /利用明細番号/);
assert.match(html, /任務資訊/);
assert.match(html, /Token 合計/);

assert.equal(
  runtime.tools.some((tool) => tool.name === "set_receipt_template"),
  false
);
assert.equal(
  runtime.tools.some((tool) => tool.name === "get_receipt_templates"),
  false
);

process.stdout.write("stored japanese template tests passed\n");
