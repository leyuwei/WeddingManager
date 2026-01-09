const assert = require("assert");
const { test, before, after } = require("node:test");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.DATA_PATH = path.join(__dirname, "../data/test-store.json");
process.env.DB_PATH = path.join(os.tmpdir(), "weddingmanager-test.db");

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
  if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
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
      attending: "yes",
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
  assert.ok(guestListText.includes("王小明 携亲朋3位"));

  const seatCardsResponse = await fetch(`${baseUrl}/admin/seat-cards`, {
    headers: { cookie }
  });
  const seatCardsText = await seatCardsResponse.text();
  assert.ok(seatCardsText.includes("王小明"));
  assert.ok(seatCardsText.includes("携亲朋3位"));
});

test("warns when check-in guest is not in the registered list", async () => {
  const response = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      lookup: "未登记来宾",
      confirm_attending: "on",
      actual_attendees: "1"
    })
  });
  const text = await response.text();
  assert.strictEqual(response.status, 200);
  assert.ok(text.includes("未在请柬登记名单中出现"));
});

test("warns when multiple guests share the same lookup on check-in", async () => {
  const rsvpResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "李四",
      phone: "13800000001",
      attending: "yes",
      attendees: "1"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponse.status, 302);

  const rsvpResponseTwo = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "李四",
      phone: "13800000002",
      attending: "yes",
      attendees: "1"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponseTwo.status, 302);

  const response = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      lookup: "李四",
      confirm_attending: "on",
      actual_attendees: "1"
    })
  });
  const text = await response.text();
  assert.strictEqual(response.status, 200);
  assert.ok(text.includes("匹配到多位来宾"));
});

test("allows forcing new guest creation after check-in warning", async () => {
  const response = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      lookup: "临时来宾",
      confirm_attending: "on",
      actual_attendees: "2",
      start_new: "1"
    })
  });
  const text = await response.text();
  assert.strictEqual(response.status, 200);
  assert.ok(text.includes("登记新来宾信息"));

  const confirmResponse = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      new_guest: "1",
      name: "临时来宾",
      phone: "13900000003",
      confirm_attending: "on",
      actual_attendees: "2"
    })
  });
  const confirmText = await confirmResponse.text();
  assert.strictEqual(confirmResponse.status, 200);
  assert.ok(confirmText.includes("签到成功"));
});
