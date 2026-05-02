const assert = require("assert");
const { test, before, after } = require("node:test");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.DATA_PATH = path.join(__dirname, "../data/test-store.json");
process.env.DB_PATH = path.join(os.tmpdir(), "weddingmanager-test.db");

const { createServer } = require("../server");
const { loadStore, saveStore } = require("../storage");

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
  assert.ok(text.includes("诚挚邀请您见证我们的幸福时刻"));
  assert.ok(!text.includes("专属定向请柬"));
});

test("includes couple name in invite and checkin page titles", async () => {
  const store = loadStore();
  const previousSettings = { ...store.settings };
  store.settings = {
    ...store.settings,
    couple_name: "赵明 和 钱雨"
  };
  saveStore(store);

  try {
    const inviteResponse = await fetch(`${baseUrl}/invite`);
    const inviteText = await inviteResponse.text();
    assert.strictEqual(inviteResponse.status, 200);
    assert.ok(inviteText.includes("<title>赵明 和 钱雨｜婚礼请柬</title>"));
    assert.ok(
      inviteText.includes(
        '<meta property="og:title" content="赵明 和 钱雨｜婚礼请柬" />'
      )
    );

    const checkinResponse = await fetch(`${baseUrl}/checkin`);
    const checkinText = await checkinResponse.text();
    assert.strictEqual(checkinResponse.status, 200);
    assert.ok(checkinText.includes("<title>赵明 和 钱雨｜来宾登记</title>"));
    assert.ok(
      checkinText.includes(
        '<meta property="og:title" content="赵明 和 钱雨｜来宾登记" />'
      )
    );
  } finally {
    const reset = loadStore();
    reset.settings = previousSettings;
    saveStore(reset);
  }
});

test("supports targeted invite title and recipient rendering", async () => {
  const store = loadStore();
  const previousSettings = { ...store.settings };
  store.settings = {
    ...store.settings,
    couple_name: "赵明 和 钱雨"
  };
  saveStore(store);

  try {
    const targetName = "张三";
    const targetTitle = "先生";
    const response = await fetch(
      `${baseUrl}/invite?target_name=${encodeURIComponent(
        targetName
      )}&target_title=${encodeURIComponent(targetTitle)}`
    );
    const text = await response.text();
    assert.strictEqual(response.status, 200);
    assert.ok(
      text.includes("<title>张三先生专属｜赵明 和 钱雨｜婚礼请柬</title>")
    );
    assert.ok(text.includes("专属定向请柬"));
    assert.ok(text.includes('data-targeted-invite="true"'));
    assert.ok(text.includes('class="target-invite-intro"'));
    assert.ok(text.includes("诚挚邀请<strong>张三先生</strong>"));
    assert.ok(text.includes("见证我们的幸福时刻"));
    assert.ok(text.includes("继续下滑查看请柬内容"));
    assert.ok(
      text.includes('<input type="text" name="name" value="张三" readonly required />')
    );
    assert.ok(text.includes("我不填写，已线下沟通"));
    assert.ok(text.includes('action="/invite/quick-rsvp"'));
    assert.ok(
      text.includes(
        `<input type="hidden" name="target_name" value="${targetName}" />`
      )
    );
    assert.ok(
      text.includes(
        `<input type="hidden" name="target_title" value="${targetTitle}" />`
      )
    );
  } finally {
    const reset = loadStore();
    reset.settings = previousSettings;
    saveStore(reset);
  }
});

test("preserves targeted invite params after rsvp submission", async () => {
  const response = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "定向来宾",
      phone: "13900008888",
      attending: "yes",
      attendees: "2",
      target_name: "王老师",
      target_title: "老师"
    }),
    redirect: "manual"
  });
  assert.strictEqual(response.status, 302);
  assert.strictEqual(
    response.headers.get("location"),
    "/invite?submitted=1&guest_name=%E5%AE%9A%E5%90%91%E6%9D%A5%E5%AE%BE&guest_phone=13900008888&guest_attendees=2&target_name=%E7%8E%8B%E8%80%81%E5%B8%88&target_title=%E8%80%81%E5%B8%88"
  );
});

test("renders batch targeted invite links in admin invitation page", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const settingsResponse = await fetch(`${baseUrl}/admin/invitation/targets/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      target_invite_recipients_text: "张三,先生\n李四,女士\n王五"
    }),
    redirect: "manual"
  });
  assert.strictEqual(settingsResponse.status, 302);

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);
  assert.ok(invitationText.includes("专属请柬批量链接"));
  assert.ok(invitationText.includes('id="targetInviteForm"'));
  assert.ok(invitationText.includes('action="/admin/invitation/targets/save"'));
  assert.ok(invitationText.includes('name="target_invite_recipients_text"'));
  assert.ok(!invitationText.includes("默认定向对象姓名（可选）"));
  assert.ok(!invitationText.includes("默认定向对象称呼（可选）"));
  assert.ok(
    invitationText.includes(
      "target_name=%E5%BC%A0%E4%B8%89&target_title=%E5%85%88%E7%94%9F"
    )
  );
  assert.ok(
    invitationText.includes(
      "target_name=%E6%9D%8E%E5%9B%9B&target_title=%E5%A5%B3%E5%A3%AB"
    )
  );
  assert.ok(invitationText.includes("data-copy-target-link="));
  assert.ok(invitationText.includes("下载邀请图"));
  assert.ok(invitationText.includes('data-download-target-image="true"'));
  assert.ok(invitationText.includes('data-target-couple="'));
  assert.ok(invitationText.includes('data-target-date="'));
  assert.ok(invitationText.includes('data-target-location="'));
});

test("renders friendly invite messages for batch links when enabled", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const settingsResponse = await fetch(`${baseUrl}/admin/invitation/targets/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      target_invite_friendly_message_enabled: "on",
      target_invite_recipients_text: "张三,先生\n李四,老师"
    }),
    redirect: "manual"
  });
  assert.strictEqual(settingsResponse.status, 302);

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);
  assert.ok(invitationText.includes("开启专属请柬友好消息发送模式"));
  assert.ok(invitationText.includes("友好邀请消息（可直接发送）"));
  assert.ok(invitationText.includes("附上专属请柬链接："));
  assert.ok(invitationText.includes("我不填写，已线下沟通"));
  assert.ok(invitationText.includes("复制消息"));
  assert.ok(invitationText.includes("复制全部消息"));
});

test("does not show targeted intro for generic invite even when target recipients exist", async () => {
  const store = loadStore();
  const previousSettings = { ...store.settings };
  store.settings = {
    ...store.settings,
    target_invite_recipients: [{ name: "张三", title: "先生" }],
    target_invite_intro_bg_color: "#884455"
  };
  saveStore(store);

  try {
    const response = await fetch(`${baseUrl}/invite`);
    const text = await response.text();
    assert.strictEqual(response.status, 200);
    assert.ok(!text.includes("专属定向请柬"));
    assert.ok(!text.includes('data-targeted-invite="true"'));
    assert.ok(text.includes("诚挚邀请您见证我们的幸福时刻"));
  } finally {
    const reset = loadStore();
    reset.settings = previousSettings;
    saveStore(reset);
  }
});

test("supports add update delete friendly invite templates", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const addResponse = await fetch(`${baseUrl}/admin/invitation/targets/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      template: "您好！这是模板新增测试，诚邀您莅临指导。"
    }),
    redirect: "manual"
  });
  assert.strictEqual(addResponse.status, 302);

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);
  assert.ok(invitationText.includes("友好邀请话术模板"));
  assert.ok(invitationText.includes("模板新增测试"));

  const match = invitationText.match(
    /action="\/admin\/invitation\/targets\/templates\/(\d+)\/update"[\s\S]*?模板新增测试/
  );
  assert.ok(match);
  const index = match[1];

  const updateResponse = await fetch(
    `${baseUrl}/admin/invitation/targets/templates/${index}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie
      },
      body: new URLSearchParams({
        template: "您好！这是模板编辑测试，期待与您现场相见。"
      }),
      redirect: "manual"
    }
  );
  assert.strictEqual(updateResponse.status, 302);

  const afterUpdateResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const afterUpdateText = await afterUpdateResponse.text();
  assert.ok(afterUpdateText.includes("模板编辑测试"));

  const deleteResponse = await fetch(
    `${baseUrl}/admin/invitation/targets/templates/${index}/delete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie
      },
      redirect: "manual"
    }
  );
  assert.strictEqual(deleteResponse.status, 302);
});

test("supports quick offline confirmation for targeted invite", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const requiredFieldResponse = await fetch(`${baseUrl}/admin/invitation/fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      label: "线下备注",
      field_key: "offline_note_required_test",
      field_type: "text",
      required: "on"
    }),
    redirect: "manual"
  });
  assert.strictEqual(requiredFieldResponse.status, 302);

  const quickResponse = await fetch(`${baseUrl}/invite/quick-rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      target_name: "线下确认来宾",
      target_title: "女士"
    }),
    redirect: "manual"
  });
  assert.strictEqual(quickResponse.status, 302);
  const location = quickResponse.headers.get("location") || "";
  assert.ok(location.includes("submitted_mode=offline_quick"));
  assert.ok(location.includes("target_name=%E7%BA%BF%E4%B8%8B%E7%A1%AE%E8%AE%A4%E6%9D%A5%E5%AE%BE"));

  const store = loadStore();
  const guest = (store.guests || []).find((item) => item.name === "线下确认来宾");
  assert.ok(guest);
  assert.strictEqual(guest.attending, true);
  assert.strictEqual(String(guest.responses?.attendees || ""), "1");
  assert.ok(String(guest.phone || "").startsWith("offline:"));

  const submittedResponse = await fetch(`${baseUrl}${location}`);
  const submittedText = await submittedResponse.text();
  assert.strictEqual(submittedResponse.status, 200);
  assert.ok(submittedText.includes("已为您登记“线下沟通确认出席”"));
});

test("renders favicon and logo on login and qr entry pages", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`);
  const loginText = await loginResponse.text();
  assert.strictEqual(loginResponse.status, 200);
  assert.ok(loginText.includes('href="/public/assets/wm-mark.svg"'));
  assert.ok(loginText.includes('class="auth-brand"'));

  const inviteResponse = await fetch(`${baseUrl}/invite`);
  const inviteText = await inviteResponse.text();
  assert.strictEqual(inviteResponse.status, 200);
  assert.ok(inviteText.includes('href="/public/assets/wm-mark.svg"'));
  assert.ok(inviteText.includes('class="public-site-logo invite-site-logo"'));

  const checkinResponse = await fetch(`${baseUrl}/checkin`);
  const checkinText = await checkinResponse.text();
  assert.strictEqual(checkinResponse.status, 200);
  assert.ok(checkinText.includes('href="/public/assets/wm-mark.svg"'));
  assert.ok(checkinText.includes('class="public-site-logo checkin-site-logo"'));
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
  const setCookie = response.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("wm_session_id="));
});

test("sets secure session cookie when request is forwarded as https", async () => {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Forwarded-Proto": "https"
    },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  assert.strictEqual(response.status, 302);
  const setCookie = response.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("wm_session_id="));
  assert.ok(setCookie.includes("Secure"));
});

test("forces https qr links by default even when proxy reports http", async () => {
  const proxyHost = "wedding.example.com";
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Forwarded-Proto": "http",
      "X-Forwarded-Host": proxyHost
    },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  assert.strictEqual(loginResponse.status, 302);
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const dashboardResponse = await fetch(`${baseUrl}/admin`, {
    headers: {
      cookie,
      "X-Forwarded-Proto": "http",
      "X-Forwarded-Host": proxyHost
    }
  });
  const dashboardText = await dashboardResponse.text();
  assert.strictEqual(dashboardResponse.status, 200);
  assert.ok(dashboardText.includes(`https://${proxyHost}/invite`));
  assert.ok(dashboardText.includes(`https://${proxyHost}/checkin`));
  assert.ok(
    dashboardText.includes(
      encodeURIComponent(`https://${proxyHost}/invite`)
    )
  );
  assert.ok(
    dashboardText.includes(
      encodeURIComponent(`https://${proxyHost}/checkin`)
    )
  );

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: {
      cookie,
      "X-Forwarded-Proto": "http",
      "X-Forwarded-Host": proxyHost
    }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);
  assert.ok(invitationText.includes(`https://${proxyHost}/invite`));
  assert.ok(
    invitationText.includes(
      encodeURIComponent(`https://${proxyHost}/invite`)
    )
  );

  const checkinsResponse = await fetch(`${baseUrl}/admin/checkins`, {
    headers: {
      cookie,
      "X-Forwarded-Proto": "http",
      "X-Forwarded-Host": proxyHost
    }
  });
  const checkinsText = await checkinsResponse.text();
  assert.strictEqual(checkinsResponse.status, 200);
  assert.ok(checkinsText.includes(`https://${proxyHost}/checkin`));
  assert.ok(
    checkinsText.includes(
      encodeURIComponent(`https://${proxyHost}/checkin`)
    )
  );
});

test("allows disabling forced https for all qr links", async () => {
  const proxyHost = "wedding.example.com";
  const store = loadStore();
  store.settings = { ...store.settings, qr_force_https: false };
  saveStore(store);

  try {
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Host": proxyHost
      },
      body: new URLSearchParams({ username: "admin", password: "admin123" }),
      redirect: "manual"
    });
    assert.strictEqual(loginResponse.status, 302);
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);

    const dashboardResponse = await fetch(`${baseUrl}/admin`, {
      headers: {
        cookie,
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Host": proxyHost
      }
    });
    const dashboardText = await dashboardResponse.text();
    assert.strictEqual(dashboardResponse.status, 200);
    assert.ok(dashboardText.includes(`http://${proxyHost}/invite`));
    assert.ok(dashboardText.includes(`http://${proxyHost}/checkin`));
    assert.ok(
      dashboardText.includes(encodeURIComponent(`http://${proxyHost}/invite`))
    );
    assert.ok(
      dashboardText.includes(encodeURIComponent(`http://${proxyHost}/checkin`))
    );

    const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
      headers: {
        cookie,
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Host": proxyHost
      }
    });
    const invitationText = await invitationResponse.text();
    assert.strictEqual(invitationResponse.status, 200);
    assert.ok(invitationText.includes(`http://${proxyHost}/invite`));
    assert.ok(
      invitationText.includes(encodeURIComponent(`http://${proxyHost}/invite`))
    );

    const checkinsResponse = await fetch(`${baseUrl}/admin/checkins`, {
      headers: {
        cookie,
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Host": proxyHost
      }
    });
    const checkinsText = await checkinsResponse.text();
    assert.strictEqual(checkinsResponse.status, 200);
    assert.ok(checkinsText.includes(`http://${proxyHost}/checkin`));
    assert.ok(
      checkinsText.includes(encodeURIComponent(`http://${proxyHost}/checkin`))
    );
  } finally {
    const reset = loadStore();
    reset.settings = { ...reset.settings, qr_force_https: true };
    saveStore(reset);
  }
});

test("does not crash when receiving malformed cookies", async () => {
  const response = await fetch(`${baseUrl}/admin`, {
    headers: { cookie: "bad=%E0%A4%A" },
    redirect: "manual"
  });
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.get("location"), "/admin/login");
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

test("allows selecting phone when multiple guests share the same name", async () => {
  const rsvpResponseOne = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "重名来宾A",
      phone: "13900000005",
      attending: "yes",
      attendees: "1"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponseOne.status, 302);

  const rsvpResponseTwo = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "重名来宾A",
      phone: "13900000006",
      attending: "yes",
      attendees: "2"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponseTwo.status, 302);

  const response = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      lookup: "重名来宾A",
      confirm_attending: "on",
      actual_attendees: "2"
    })
  });
  const text = await response.text();
  assert.strictEqual(response.status, 200);
  assert.ok(text.includes("请选择对应手机号后继续签到"));
  assert.ok(text.includes('name="selected_guest_id"'));
  assert.ok(text.includes("139****0005") || text.includes("139****0006"));

  const matchedIds = Array.from(
    text.matchAll(/name="selected_guest_id"\s+value="(\d+)"/g)
  ).map((item) => item[1]);
  assert.ok(matchedIds.length >= 2);

  const confirmResponse = await fetch(`${baseUrl}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      lookup: "重名来宾A",
      selected_guest_id: matchedIds[1],
      confirm_attending: "on",
      actual_attendees: "2"
    })
  });
  const confirmText = await confirmResponse.text();
  assert.strictEqual(confirmResponse.status, 200);
  assert.ok(confirmText.includes("签到成功"));
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

test("supports date and checkbox custom fields with required validation", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const dateFieldResponse = await fetch(`${baseUrl}/admin/invitation/fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      label: "到达日期",
      field_key: "arrival_date_test",
      field_type: "date",
      required: "on"
    }),
    redirect: "manual"
  });
  assert.strictEqual(dateFieldResponse.status, 302);

  const checkboxFieldResponse = await fetch(
    `${baseUrl}/admin/invitation/fields`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie
      },
      body: new URLSearchParams({
        label: "交通方式",
        field_key: "transport_test",
        field_type: "checkbox",
        options: "自驾,高铁",
        required: "on"
      }),
      redirect: "manual"
    }
  );
  assert.strictEqual(checkboxFieldResponse.status, 302);

  const missingCheckboxResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "字段校验来宾",
      phone: "13900009990",
      attending: "yes",
      attendees: "1",
      arrival_date_test: "2026-05-20"
    }),
    redirect: "manual"
  });
  const missingCheckboxText = await missingCheckboxResponse.text();
  assert.strictEqual(missingCheckboxResponse.status, 400);
  assert.ok(missingCheckboxText.includes("交通方式"));

  const rsvpResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "日期复选框来宾",
      phone: "13900009991",
      attending: "yes",
      attendees: "2",
      arrival_date_test: "2026-05-21",
      transport_test: "高铁"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponse.status, 302);

  const exportResponse = await fetch(`${baseUrl}/admin/guests/export`, {
    headers: { cookie }
  });
  const exportText = await exportResponse.text();
  assert.strictEqual(exportResponse.status, 200);
  assert.ok(exportText.includes("2026-05-21"));
  assert.ok(exportText.includes("高铁"));
});

test("supports editing invitation custom fields", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const createFieldResponse = await fetch(`${baseUrl}/admin/invitation/fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      label: "餐食偏好原始",
      field_key: "meal_pref_edit_test",
      field_type: "text"
    }),
    redirect: "manual"
  });
  assert.strictEqual(createFieldResponse.status, 302);

  const invitationBeforeResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationBeforeText = await invitationBeforeResponse.text();
  assert.strictEqual(invitationBeforeResponse.status, 200);

  const fieldIdMatch = invitationBeforeText.match(
    /action="\/admin\/invitation\/fields\/(\d+)\/update"[\s\S]*?name="field_key" value="meal_pref_edit_test"/
  );
  assert.ok(fieldIdMatch);
  const fieldId = fieldIdMatch[1];

  const updateFieldResponse = await fetch(
    `${baseUrl}/admin/invitation/fields/${fieldId}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie
      },
      body: new URLSearchParams({
        label: "餐食偏好更新",
        field_key: "meal_pref_updated_test",
        field_type: "radio",
        options: "鸡肉,牛肉,素食"
      }),
      redirect: "manual"
    }
  );
  assert.strictEqual(updateFieldResponse.status, 302);

  const invitationAfterResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationAfterText = await invitationAfterResponse.text();
  assert.strictEqual(invitationAfterResponse.status, 200);
  assert.ok(
    invitationAfterText.includes(
      `action="/admin/invitation/fields/${fieldId}/update"`
    )
  );
  assert.ok(invitationAfterText.includes('name="label" value="餐食偏好更新"'));
  assert.ok(
    invitationAfterText.includes(
      'name="field_key" value="meal_pref_updated_test"'
    )
  );
  assert.ok(invitationAfterText.includes("name=\"options\" value=\"鸡肉,牛肉,素食\""));
  assert.ok(invitationAfterText.includes('<option value="radio" selected>单选</option>'));
});

test("supports required radio custom field validation", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const radioFieldResponse = await fetch(`${baseUrl}/admin/invitation/fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      label: "到场时段",
      field_key: "arrival_slot_radio_test",
      field_type: "radio",
      options: "上午场,下午场",
      required: "on"
    }),
    redirect: "manual"
  });
  assert.strictEqual(radioFieldResponse.status, 302);

  const missingRadioResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "单选缺失来宾",
      phone: "13900009992",
      attending: "yes",
      attendees: "1",
      arrival_date_test: "2026-05-22",
      transport_test: "自驾"
    }),
    redirect: "manual"
  });
  const missingRadioText = await missingRadioResponse.text();
  assert.strictEqual(missingRadioResponse.status, 400);
  assert.ok(missingRadioText.includes("到场时段"));

  const invalidRadioResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "单选非法来宾",
      phone: "13900009993",
      attending: "yes",
      attendees: "1",
      arrival_date_test: "2026-05-22",
      transport_test: "自驾",
      arrival_slot_radio_test: "夜场"
    }),
    redirect: "manual"
  });
  const invalidRadioText = await invalidRadioResponse.text();
  assert.strictEqual(invalidRadioResponse.status, 400);
  assert.ok(invalidRadioText.includes("到场时段"));

  const validRadioResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "单选通过来宾",
      phone: "13900009994",
      attending: "yes",
      attendees: "2",
      arrival_date_test: "2026-05-23",
      transport_test: "高铁",
      arrival_slot_radio_test: "上午场"
    }),
    redirect: "manual"
  });
  assert.strictEqual(validRadioResponse.status, 302);

  const exportResponse = await fetch(`${baseUrl}/admin/guests/export`, {
    headers: { cookie }
  });
  const exportText = await exportResponse.text();
  assert.strictEqual(exportResponse.status, 200);
  assert.ok(exportText.includes("上午场"));
});

test("supports reordering invitation guest fields including built-in fields", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const createFieldResponse = await fetch(`${baseUrl}/admin/invitation/fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      label: "最喜欢的歌曲",
      field_key: "favorite_song_order_test",
      field_type: "text"
    }),
    redirect: "manual"
  });
  assert.strictEqual(createFieldResponse.status, 302);

  const orderKeys = [
    "attending",
    "favorite_song_order_test",
    "name",
    "phone",
    "attendees"
  ].join(",");
  const reorderResponse = await fetch(`${baseUrl}/admin/invitation/field-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      order_keys: orderKeys
    }),
    redirect: "manual"
  });
  assert.strictEqual(reorderResponse.status, 302);

  const adminInvitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const adminInvitationText = await adminInvitationResponse.text();
  assert.strictEqual(adminInvitationResponse.status, 200);
  const orderValueMatch = adminInvitationText.match(
    /name="order_keys"\s+id="fieldOrderKeys"\s+value="([^"]+)"/
  );
  assert.ok(orderValueMatch);
  const savedOrderKeys = orderValueMatch[1];
  assert.ok(
    savedOrderKeys === orderKeys || savedOrderKeys.startsWith(`${orderKeys},`)
  );

  const inviteResponse = await fetch(`${baseUrl}/invite`);
  const inviteText = await inviteResponse.text();
  assert.strictEqual(inviteResponse.status, 200);
  const attendingIndex = inviteText.indexOf('name="attending"');
  const customIndex = inviteText.indexOf('name="favorite_song_order_test"');
  const nameIndex = inviteText.indexOf('name="name"');
  const phoneIndex = inviteText.indexOf('name="phone"');
  const attendeesIndex = inviteText.indexOf('name="attendees"');
  assert.ok(attendingIndex >= 0);
  assert.ok(customIndex >= 0);
  assert.ok(nameIndex >= 0);
  assert.ok(phoneIndex >= 0);
  assert.ok(attendeesIndex >= 0);
  assert.ok(attendingIndex < customIndex);
  assert.ok(customIndex < nameIndex);
  assert.ok(nameIndex < phoneIndex);
  assert.ok(phoneIndex < attendeesIndex);
});

test("keeps admin invitation inline script syntactically valid", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);

  const scriptMatch = invitationText.match(
    /<script>\s*([\s\S]*?)\s*<\/script>/
  );
  assert.ok(scriptMatch);
  assert.doesNotThrow(() => new Function(scriptMatch[1]));
  assert.doesNotMatch(
    scriptMatch[1],
    /join\("\s*[\r\n]+\s*"\)/
  );
  assert.ok(invitationText.includes('id="fieldOrderList"'));
  assert.ok(invitationText.includes('data-order-item draggable="true"'));
  assert.ok(invitationText.includes('data-order-move="-1"'));
});

test("shows festive theme controls and festive layer on invite page", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const adminInvitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const adminInvitationText = await adminInvitationResponse.text();
  assert.strictEqual(adminInvitationResponse.status, 200);
  assert.ok(adminInvitationText.includes('name="festive_theme"'));
  assert.ok(adminInvitationText.includes('name="festive_effect_enabled"'));
  assert.ok(adminInvitationText.includes('name="festive_effect_style"'));
  assert.ok(adminInvitationText.includes('name="festive_effect_intensity"'));
  assert.ok(adminInvitationText.includes('name="swipe_hint_enabled"'));
  assert.ok(adminInvitationText.includes('name="swipe_hint_text"'));
  assert.ok(adminInvitationText.includes('name="swipe_hint_position"'));
  assert.ok(adminInvitationText.includes('name="swipe_hint_style"'));
  assert.ok(adminInvitationText.includes('data-settings-group="basic"'));
  assert.ok(adminInvitationText.includes('data-settings-group="festive"'));
  assert.ok(adminInvitationText.includes('data-settings-group="swipe-hint"'));
  assert.ok(adminInvitationText.includes('value="champagne_waltz"'));

  const inviteResponse = await fetch(`${baseUrl}/invite`);
  const inviteText = await inviteResponse.text();
  assert.strictEqual(inviteResponse.status, 200);
  assert.ok(inviteText.includes('data-festive-theme="'));
  assert.ok(inviteText.includes('data-festive-effect-enabled="'));
  assert.ok(inviteText.includes('id="festiveCornerGroup"'));
  assert.ok(inviteText.includes('id="festiveParticles"'));
  assert.ok(inviteText.includes('data-swipe-hint="true"'));
  assert.ok(!inviteText.includes('festive-corner-left">囍</span>'));

  const checkinResponse = await fetch(`${baseUrl}/checkin`);
  const checkinText = await checkinResponse.text();
  assert.strictEqual(checkinResponse.status, 200);
  assert.ok(checkinText.includes('data-festive-theme="'));
  assert.ok(checkinText.includes('data-festive-effect-enabled="'));
  assert.ok(checkinText.includes('id="checkinFestiveCornerGroup"'));
  assert.ok(checkinText.includes('id="checkinFestiveParticles"'));
});

test("allows editing invitation sections", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const updateResponse = await fetch(
    `${baseUrl}/admin/invitation/sections/1/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie
      },
      body: new URLSearchParams({
        sort_order: "9",
        title: "分屏编辑测试标题",
        body: "分屏编辑测试文案",
        image_url: "https://example.com/image-edit-test.jpg"
      }),
      redirect: "manual"
    }
  );
  assert.strictEqual(updateResponse.status, 302);

  const invitationResponse = await fetch(`${baseUrl}/admin/invitation`, {
    headers: { cookie }
  });
  const invitationText = await invitationResponse.text();
  assert.strictEqual(invitationResponse.status, 200);
  assert.ok(invitationText.includes("分屏编辑测试标题"));
  assert.ok(invitationText.includes("分屏编辑测试文案"));
});

test("supports ledger csv import", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const csvText = [
    "日期,收支,类型,金额,具体用途,付款人,对象,方式,备注",
    "2026-06-01,支出,场地租用,1200,测试导入场地费,张三,酒店,转账,第一条",
    "2026-06-02,收入,礼金红包,5200,测试导入礼金,李四,亲友,微信,第二条",
    "2026-06-03,支出,婚礼仪式,,缺少金额会跳过,王五,策划公司,现金,第三条"
  ].join("\n");

  const importResponse = await fetch(`${baseUrl}/admin/ledger/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie
    },
    body: JSON.stringify({
      csv_text: csvText,
      filename: "ledger-import-test.csv"
    })
  });
  const importResult = await importResponse.json();
  assert.strictEqual(importResponse.status, 200);
  assert.strictEqual(importResult.inserted, 2);
  assert.strictEqual(importResult.skipped, 1);

  const exportResponse = await fetch(`${baseUrl}/admin/ledger/export`, {
    headers: { cookie }
  });
  const exportText = await exportResponse.text();
  assert.strictEqual(exportResponse.status, 200);
  assert.ok(exportText.includes("测试导入场地费"));
  assert.ok(exportText.includes("测试导入礼金"));
});

test("supports uploading invitation background images", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const imageDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+X9kAAAAASUVORK5CYII=";
  const uploadResponse = await fetch(`${baseUrl}/admin/invitation/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie
    },
    body: JSON.stringify({
      dataUrl: imageDataUrl,
      filename: "hero-test.png"
    })
  });
  const uploadResult = await uploadResponse.json();
  assert.strictEqual(uploadResponse.status, 200);
  assert.ok(uploadResult.url.startsWith("/public/uploads/invite-image-"));

  const imageResponse = await fetch(`${baseUrl}${uploadResult.url}`);
  assert.strictEqual(imageResponse.status, 200);
  assert.ok((imageResponse.headers.get("content-type") || "").includes("image/"));

  const settingsResponse = await fetch(`${baseUrl}/admin/invitation/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      couple_name: "上传测试新人",
      wedding_date: "2026年6月6日 18:00",
      wedding_location: "测试地点",
      hero_message: "测试文案",
      hero_image_url: uploadResult.url,
      guest_font_scale: "1.1"
    }),
    redirect: "manual"
  });
  assert.strictEqual(settingsResponse.status, 302);

  const inviteResponse = await fetch(`${baseUrl}/invite`);
  const inviteText = await inviteResponse.text();
  assert.strictEqual(inviteResponse.status, 200);
  assert.ok(inviteText.includes(uploadResult.url));
});

test("supports wedding location map links with multi-map chooser", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "admin123" }),
    redirect: "manual"
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const location = "上海市浦东新区花园路88号";
  const customMapUrl = "https://example.com/custom-map-link";
  const routeImageOne = "https://example.com/route-1.jpg";
  const routeImageTwo = "https://example.com/route-2.jpg";
  const settingsResponse = await fetch(`${baseUrl}/admin/invitation/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie
    },
    body: new URLSearchParams({
      couple_name: "地图功能测试",
      wedding_date: "2026年6月8日 18:00",
      wedding_location: location,
      wedding_location_map_url: customMapUrl,
      wedding_route_image_urls: `${routeImageOne}\n${routeImageTwo}`,
      hero_message: "测试地图选择器",
      guest_font_scale: "1.1"
    }),
    redirect: "manual"
  });
  assert.strictEqual(settingsResponse.status, 302);

  const inviteResponse = await fetch(`${baseUrl}/invite`);
  const inviteText = await inviteResponse.text();
  assert.strictEqual(inviteResponse.status, 200);

  const encodedLocation = encodeURIComponent(location);
  assert.ok(inviteText.includes('data-map-chooser-open="true"'));
  assert.ok(inviteText.includes('id="inviteMapChooser"'));
  assert.ok(inviteText.includes("Google Maps"));
  assert.ok(inviteText.includes("高德地图"));
  assert.ok(inviteText.includes("百度地图"));
  assert.ok(inviteText.includes(customMapUrl));
  assert.ok(inviteText.includes(routeImageOne));
  assert.ok(inviteText.includes(routeImageTwo));
  assert.ok(inviteText.includes("map-route-gallery"));
  assert.ok(
    inviteText.includes(
      `https://www.google.com/maps/search/?api=1&amp;query=${encodedLocation}`
    )
  );
  assert.ok(
    inviteText.includes(
      `https://uri.amap.com/search?keyword=${encodedLocation}&amp;src=weddingmanager&amp;callnative=1`
    )
  );
  assert.ok(
    inviteText.includes(`https://map.baidu.com/search/${encodedLocation}/`)
  );

  const rsvpResponse = await fetch(`${baseUrl}/invite/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "地图导航保存来宾",
      phone: "13900009995",
      attending: "yes",
      attendees: "1",
      arrival_date_test: "2026-06-08",
      transport_test: "高铁",
      arrival_slot_radio_test: "上午场",
      favorite_song_order_test: "告白气球"
    }),
    redirect: "manual"
  });
  assert.strictEqual(rsvpResponse.status, 302);
  assert.strictEqual(rsvpResponse.headers.get("location"), "/invite?submitted=1");

  const submittedInviteResponse = await fetch(`${baseUrl}/invite?submitted=1`);
  const submittedInviteText = await submittedInviteResponse.text();
  assert.strictEqual(submittedInviteResponse.status, 200);
  assert.ok(submittedInviteText.includes("查看地图导航"));
  assert.ok(submittedInviteText.includes('id="inviteMapChooser"'));
  assert.ok(submittedInviteText.includes(routeImageOne));
});
