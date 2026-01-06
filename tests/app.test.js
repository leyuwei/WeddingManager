const assert = require("assert");
const { test, before, after } = require("node:test");
const path = require("path");
const fs = require("fs");

process.env.DATA_PATH = path.join(__dirname, "../data/test-store.json");

const { createServer } = require("../server");

let server;
let baseUrl;

before(() => {
  if (fs.existsSync(process.env.DATA_PATH)) {
    fs.unlinkSync(process.env.DATA_PATH);
  }
  server = createServer().listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
  if (fs.existsSync(process.env.DATA_PATH)) {
    fs.unlinkSync(process.env.DATA_PATH);
  }
});

test("loads invite page", async () => {
  const response = await fetch(`${baseUrl}/invite`);
  const text = await response.text();
  assert.strictEqual(response.status, 200);
  assert.ok(text.includes("婚礼请柬"));
});

test("allows admin login with default account", async () => {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.get("location"), "/admin");
});
