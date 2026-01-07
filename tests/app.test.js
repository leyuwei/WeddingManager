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

test("shows formatted guest name for multiple attendees in lists and seat cards", async () => {
  const rsvpResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "王小明",
      phone: "13800000000",
      attending: "on",
      attendees: "3"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponse.status, 302);

  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const guestListResponse = await fetch(`${baseUrl}/admin/guests`, {
    headers: { cookie }
  });
  const guestListText = await guestListResponse.text();
  assert.ok(guestListText.includes("王小明携亲朋3位"));

  const seatCardsResponse = await fetch(`${baseUrl}/admin/seat-cards`, {
    headers: { cookie }
  });
  const seatCardsText = await seatCardsResponse.text();
  assert.ok(seatCardsText.includes("王小明携亲朋3位"));
});
