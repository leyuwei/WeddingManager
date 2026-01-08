const http = require("http");
const path = require("path");
const fs = require("fs");
const { URL } = require("url");
const querystring = require("querystring");
const { hashPassword, verifyPassword } = require("./password");
const { loadStore, saveStore, nextId } = require("./storage");
const {
  renderLogin,
  renderDashboard,
  renderAdmins,
  renderInvitation,
  renderGuests,
  renderTablePrint,
  renderSeatCards,
  renderAdminCheckins,
  renderAdminLottery,
  renderLedger,
  renderInvite,
  renderCheckin,
  renderLottery
} = require("./views");

const sessions = new Map();

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

const getSession = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.session_id;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
};

const createSession = (res, adminId) => {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(sessionId, { adminId, createdAt: Date.now() });
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`
  );
};

const destroySession = (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies.session_id) {
    sessions.delete(cookies.session_id);
  }
  res.setHeader(
    "Set-Cookie",
    "session_id=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );
};

const parseBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        resolve(data ? JSON.parse(data) : {});
        return;
      }
      resolve(querystring.parse(data));
    });
  });

const ledgerCategories = [
  { value: "场地租用", label: "场地租用" },
  { value: "婚礼仪式", label: "婚礼仪式" },
  { value: "宾客住宿", label: "宾客住宿" },
  { value: "礼品奖品", label: "礼品奖品" },
  { value: "路费餐费", label: "路费餐费" },
  { value: "礼金红包", label: "礼金红包" },
  { value: "其它", label: "其它" }
];
const ledgerCategoryValues = new Set(
  ledgerCategories.map((category) => category.value)
);
const ledgerDirectionValues = new Set(["income", "expense"]);

const sendResponse = (res, status, body, type = "text/html") => {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8` });
  res.end(body);
};

const redirect = (res, location) => {
  res.writeHead(302, { Location: location });
  res.end();
};

const serveStatic = (req, res, pathname) => {
  const filePath = path.join(__dirname, pathname);
  if (!filePath.startsWith(path.join(__dirname, "public"))) {
    sendResponse(res, 403, "Forbidden", "text/plain");
    return true;
  }
  if (!fs.existsSync(filePath)) {
    sendResponse(res, 404, "Not Found", "text/plain");
    return true;
  }
  const ext = path.extname(filePath);
  const types = {
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };
  const contentType = types[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
};

const requireAdmin = (req, res) => {
  const session = getSession(req);
  if (!session || !session.adminId) {
    redirect(res, "/admin/login");
    return null;
  }
  return session;
};

const getCheckedInGuests = (store) => {
  const checkinMap = new Map(
    (store.checkins || []).map((checkin) => [checkin.guest_id, checkin])
  );
  const checkedInGuests = (store.guests || [])
    .filter((guest) => checkinMap.has(guest.id))
    .map((guest) => ({ ...guest, checkin: checkinMap.get(guest.id) }));
  const pendingGuests = (store.guests || []).filter(
    (guest) => !checkinMap.has(guest.id)
  );
  return { checkedInGuests, pendingGuests, checkinMap };
};

const normalizeTableNo = (value) => String(value || "").trim();

const normalizeLedgerCategory = (value) => {
  const normalized = String(value || "").trim();
  if (ledgerCategoryValues.has(normalized)) return normalized;
  return "其它";
};

const normalizeLedgerDirection = (value) => {
  const normalized = String(value || "").trim();
  if (ledgerDirectionValues.has(normalized)) return normalized;
  return "expense";
};

const parseLedgerAmount = (value) => {
  const parsed = Number.parseFloat(String(value || "").trim());
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeLedgerDate = (value) => {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return new Date().toISOString().slice(0, 10);
};

const parsePartySize = (value) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
};

const getGuestPartySizeFromResponses = (responses) =>
  parsePartySize(responses?.attendees);

const getAssignedSeats = (guests, tableNo, excludeGuestId = null) =>
  (guests || []).reduce((sum, guest) => {
    if (normalizeTableNo(guest.table_no) !== tableNo) return sum;
    if (excludeGuestId && guest.id === excludeGuestId) return sum;
    return sum + getGuestPartySizeFromResponses(guest.responses || {});
  }, 0);

const getValidTableNo = (value, tables) => {
  const tableNos = new Set(
    (tables || [])
      .map((table) => normalizeTableNo(table.table_no))
      .filter(Boolean)
  );
  const normalized = normalizeTableNo(value);
  if (!normalized) return "";
  return tableNos.has(normalized) ? normalized : "";
};

const sortTables = (tables) =>
  [...(tables || [])].sort((a, b) =>
    String(a.table_no || "").localeCompare(String(b.table_no || ""), "zh-Hans", {
      numeric: true,
      sensitivity: "base"
    })
  );

const upsertCheckin = (store, guestId, actualAttendees) => {
  store.checkins = store.checkins || [];
  const existing = store.checkins.find(
    (checkin) => checkin.guest_id === guestId
  );
  const payload = {
    guest_id: guestId,
    actual_attendees: actualAttendees,
    checked_in_at: new Date().toISOString()
  };
  if (existing) {
    Object.assign(existing, payload);
    return existing;
  }
  const record = { id: nextId(store, "checkins"), ...payload };
  store.checkins.push(record);
  return record;
};

const updateCheckinAttendees = (store, guestId, actualAttendees) => {
  store.checkins = store.checkins || [];
  const existing = store.checkins.find(
    (checkin) => checkin.guest_id === guestId
  );
  if (existing) {
    existing.actual_attendees = actualAttendees;
    return existing;
  }
  const record = {
    id: nextId(store, "checkins"),
    guest_id: guestId,
    actual_attendees: actualAttendees,
    checked_in_at: new Date().toISOString()
  };
  store.checkins.push(record);
  return record;
};

const handleRequest = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname.startsWith("/public/")) {
    serveStatic(req, res, pathname);
    return;
  }

  if (req.method === "GET" && pathname === "/") {
    redirect(res, "/admin");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/login") {
    sendResponse(res, 200, renderLogin(null));
    return;
  }

  if (req.method === "POST" && pathname === "/admin/login") {
    const body = await parseBody(req);
    const store = loadStore();
    const admin = store.admins.find((item) => item.username === body.username);
    if (!admin || !verifyPassword(body.password || "", admin.password_hash)) {
      sendResponse(res, 200, renderLogin("账号或密码错误"));
      return;
    }
    createSession(res, admin.id);
    redirect(res, "/admin");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/logout") {
    destroySession(req, res);
    redirect(res, "/admin/login");
    return;
  }

  if (req.method === "GET" && pathname === "/admin") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const guestInviteCount = store.guests.length;
    const registeredGuestCount = store.guests.reduce(
      (sum, guest) => sum + getGuestPartySizeFromResponses(guest.responses || {}),
      0
    );
    const confirmedInvites = store.guests.filter((g) => g.attending);
    const confirmedInviteCount = confirmedInvites.length;
    const confirmedGuestCount = confirmedInvites.reduce(
      (sum, guest) => sum + getGuestPartySizeFromResponses(guest.responses || {}),
      0
    );
    const checkedInGuestCount = (store.checkins || []).reduce(
      (sum, checkin) => sum + parsePartySize(checkin.actual_attendees),
      0
    );
    const pendingCheckinGuestCount = Math.max(
      registeredGuestCount - checkedInGuestCount,
      0
    );
    const assignedTableCount = store.guests.filter((guest) =>
      normalizeTableNo(guest.table_no)
    ).length;
    const totalTableCount = store.tables.length;
    const prizeCount = store.prizes.length;
    const winnerCount = store.winners.length;
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const inviteUrl = `${proto}://${host}/invite`;
    const checkinUrl = `${proto}://${host}/checkin`;
    sendResponse(
      res,
      200,
      renderDashboard({
        guestInviteCount,
        registeredGuestCount,
        checkedInGuestCount,
        pendingCheckinGuestCount,
        confirmedInviteCount,
        confirmedGuestCount,
        assignedTableCount,
        totalTableCount,
        prizeCount,
        winnerCount,
        inviteUrl,
        checkinUrl
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/admin/admins") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const error = url.searchParams.get("error");
    const success = url.searchParams.get("success");
    sendResponse(
      res,
      200,
      renderAdmins({
        admins: store.admins,
        currentAdminId: session.adminId,
        error,
        success
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/admin/admins") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    if (body.username && body.password) {
      const store = loadStore();
      store.admins.push({
        id: nextId(store, "admins"),
        username: body.username,
        password_hash: hashPassword(body.password),
        created_at: new Date().toISOString()
      });
      saveStore(store);
    }
    redirect(res, "/admin/admins");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/admins/change-password") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const currentPassword = String(body.current_password || "");
    const newPassword = String(body.new_password || "");
    const confirmPassword = String(body.confirm_password || "");
    if (!currentPassword || !newPassword) {
      const message = encodeURIComponent("请填写当前密码与新密码。");
      redirect(res, `/admin/admins?error=${message}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      const message = encodeURIComponent("两次输入的新密码不一致。");
      redirect(res, `/admin/admins?error=${message}`);
      return;
    }
    const store = loadStore();
    const admin = store.admins.find((item) => item.id === session.adminId);
    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      const message = encodeURIComponent("当前密码不正确。");
      redirect(res, `/admin/admins?error=${message}`);
      return;
    }
    admin.password_hash = hashPassword(newPassword);
    saveStore(store);
    const message = encodeURIComponent("密码已更新。");
    redirect(res, `/admin/admins?success=${message}`);
    return;
  }

  const adminDeleteMatch = pathname.match(/^\/admin\/admins\/(\d+)\/delete$/);
  if (req.method === "POST" && adminDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(adminDeleteMatch[1]);
    store.admins = store.admins.filter((admin) => admin.id !== id);
    saveStore(store);
    redirect(res, "/admin/admins");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/invitation") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    sendResponse(
      res,
      200,
      renderInvitation({
        settings: store.settings,
        sections: store.invitation_sections.sort(
          (a, b) => a.sort_order - b.sort_order
        ),
        fields: store.invitation_fields
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/settings") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    store.settings = {
      ...store.settings,
      couple_name: body.couple_name || "",
      wedding_date: body.wedding_date || "",
      wedding_location: body.wedding_location || "",
      hero_message: body.hero_message || ""
    };
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/sections") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    store.invitation_sections.push({
      id: nextId(store, "invitation_sections"),
      sort_order: Number(body.sort_order) || 0,
      title: body.title || "",
      body: body.body || "",
      image_url: body.image_url || ""
    });
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  const sectionDeleteMatch = pathname.match(
    /^\/admin\/invitation\/sections\/(\d+)\/delete$/
  );
  if (req.method === "POST" && sectionDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(sectionDeleteMatch[1]);
    store.invitation_sections = store.invitation_sections.filter(
      (section) => section.id !== id
    );
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/fields") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    if (body.label && body.field_key && body.field_type) {
      const store = loadStore();
      store.invitation_fields.push({
        id: nextId(store, "invitation_fields"),
        label: body.label,
        field_key: body.field_key,
        field_type: body.field_type,
        options: body.options || "",
        required: Boolean(body.required)
      });
      saveStore(store);
    }
    redirect(res, "/admin/invitation");
    return;
  }

  const fieldDeleteMatch = pathname.match(
    /^\/admin\/invitation\/fields\/(\d+)\/delete$/
  );
  if (req.method === "POST" && fieldDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(fieldDeleteMatch[1]);
    store.invitation_fields = store.invitation_fields.filter(
      (field) => field.id !== id
    );
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/guests") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const error = url.searchParams.get("error");
    const errorGuestId = url.searchParams.get("error_guest");
    const guests = store.guests.map((guest) => ({
      ...guest,
      responses: guest.responses || {}
    }));
    sendResponse(
      res,
      200,
      renderGuests({
        guests,
        fields: store.invitation_fields,
        tables: sortTables(store.tables),
        error,
        errorGuestId
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/admin/guests/export") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const fields = store.invitation_fields || [];
    const header = [
      "姓名",
      "手机号",
      "出席",
      "席位号",
      ...fields.map((field) => field.label)
    ];
    const rows = (store.guests || []).map((guest) => {
      const responses = guest.responses || {};
      const base = [
        guest.name || "",
        guest.phone || "",
        guest.attending ? "是" : "否",
        guest.table_no || ""
      ];
      const extras = fields.map((field) => responses[field.field_key] || "");
      return [...base, ...extras];
    });
    const escapeCsvValue = (value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
      }
      return text;
    };
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const filename = `guests-${new Date().toISOString().slice(0, 10)}.csv`;
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    });
    res.end(`\uFEFF${csv}`);
    return;
  }

  if (req.method === "GET" && pathname === "/admin/ledger") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const error = url.searchParams.get("error");
    const category = String(url.searchParams.get("category") || "").trim();
    const activeCategory = ledgerCategoryValues.has(category) ? category : "";
    const entries = [...(store.ledger || [])].sort((a, b) => {
      const dateA = new Date(a.occurred_at || a.created_at || 0).getTime();
      const dateB = new Date(b.occurred_at || b.created_at || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    });
    sendResponse(
      res,
      200,
      renderLedger({
        entries,
        categories: ledgerCategories,
        activeCategory,
        error
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/admin/ledger/export") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const category = String(url.searchParams.get("category") || "").trim();
    const activeCategory = ledgerCategoryValues.has(category) ? category : "";
    const entries = (store.ledger || []).filter((entry) =>
      activeCategory ? entry.category === activeCategory : true
    );
    const header = [
      "日期",
      "收支",
      "类型",
      "金额",
      "具体用途",
      "付款人",
      "对象",
      "方式",
      "备注"
    ];
    const rows = entries.map((entry) => [
      entry.occurred_at || "",
      entry.direction === "income" ? "收入" : "支出",
      entry.category || "",
      entry.amount ?? "",
      entry.purpose || "",
      entry.payer || "",
      entry.payee || "",
      entry.method || "",
      entry.note || ""
    ]);
    const escapeCsvValue = (value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
      }
      return text;
    };
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const filenameParts = ["ledger", new Date().toISOString().slice(0, 10)];
    if (activeCategory) {
      filenameParts.push(activeCategory);
    }
    const filename = `${filenameParts.join("-")}.csv`;
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    });
    res.end(`\uFEFF${csv}`);
    return;
  }

  if (req.method === "POST" && pathname === "/admin/ledger") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const amount = parseLedgerAmount(body.amount);
    const purpose = String(body.purpose || "").trim();
    const payer = String(body.payer || "").trim();
    if (!amount || !purpose || !payer) {
      const message = encodeURIComponent("请填写金额、用途与付款人。");
      redirect(res, `/admin/ledger?error=${message}`);
      return;
    }
    const store = loadStore();
    store.ledger = store.ledger || [];
    store.ledger.push({
      id: nextId(store, "ledger"),
      amount,
      direction: normalizeLedgerDirection(body.direction),
      category: normalizeLedgerCategory(body.category),
      purpose,
      payer,
      payee: body.payee || "",
      method: body.method || "",
      note: body.note || "",
      occurred_at: normalizeLedgerDate(body.occurred_at),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    saveStore(store);
    redirect(res, "/admin/ledger");
    return;
  }

  const ledgerUpdateMatch = pathname.match(/^\/admin\/ledger\/(\d+)\/update$/);
  if (req.method === "POST" && ledgerUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(ledgerUpdateMatch[1]);
    const entry = (store.ledger || []).find((item) => item.id === id);
    if (!entry) {
      redirect(res, "/admin/ledger");
      return;
    }
    const amount = parseLedgerAmount(body.amount);
    const purpose = String(body.purpose || "").trim();
    const payer = String(body.payer || "").trim();
    if (!amount || !purpose || !payer) {
      const message = encodeURIComponent("请完善金额、用途与付款人。");
      const returnTo = (body.return_to || "").trim();
      const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
      redirect(res, `/admin/ledger?error=${message}${hash}`);
      return;
    }
    entry.amount = amount;
    entry.direction = normalizeLedgerDirection(body.direction);
    entry.category = normalizeLedgerCategory(body.category);
    entry.purpose = purpose;
    entry.payer = payer;
    entry.payee = body.payee || "";
    entry.method = body.method || "";
    entry.note = body.note || "";
    entry.occurred_at = normalizeLedgerDate(body.occurred_at);
    entry.updated_at = new Date().toISOString();
    saveStore(store);
    const returnTo = (body.return_to || "").trim();
    const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
    redirect(res, `/admin/ledger${hash}`);
    return;
  }

  const ledgerDeleteMatch = pathname.match(/^\/admin\/ledger\/(\d+)\/delete$/);
  if (req.method === "POST" && ledgerDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(ledgerDeleteMatch[1]);
    store.ledger = (store.ledger || []).filter((item) => item.id !== id);
    saveStore(store);
    redirect(res, "/admin/ledger");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/guests") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    if (!body.name || !body.phone) {
      redirect(res, "/admin/guests");
      return;
    }
    const store = loadStore();
    const tableNo = getValidTableNo(body.table_no, store.tables);
    const responses = {};
    store.invitation_fields.forEach((field) => {
      responses[field.field_key] = body[field.field_key] || "";
    });
    if (tableNo) {
      const targetTable = store.tables.find(
        (table) => normalizeTableNo(table.table_no) === tableNo
      );
      const seats = Math.max(Number.parseInt(targetTable?.seats, 10) || 0, 0);
      if (seats > 0) {
        const assignedSeats = getAssignedSeats(store.guests, tableNo);
        const incomingSeats = getGuestPartySizeFromResponses(responses);
        if (assignedSeats + incomingSeats > seats) {
          const message = encodeURIComponent(
            `桌号 ${tableNo} 已超出最大承载 ${seats} 位，请调整座位。`
          );
          redirect(res, `/admin/guests?error=${message}`);
          return;
        }
      }
    }
    const existing = store.guests.find((guest) => guest.phone === body.phone);
    if (existing) {
      existing.name = body.name;
      existing.attending = Boolean(body.attending);
      existing.table_no = tableNo;
      existing.responses = responses;
      existing.updated_at = new Date().toISOString();
    } else {
      store.guests.push({
        id: nextId(store, "guests"),
        name: body.name,
        phone: body.phone,
        attending: Boolean(body.attending),
        responses,
        table_no: tableNo,
        updated_at: new Date().toISOString()
      });
    }
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  const guestUpdateMatch = pathname.match(/^\/admin\/guests\/(\d+)\/update$/);
  if (req.method === "POST" && guestUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(guestUpdateMatch[1]);
    const tableNo = getValidTableNo(body.table_no, store.tables);
    const responses = {};
    store.invitation_fields.forEach((field) => {
      responses[field.field_key] = body[field.field_key] || "";
    });
    if (tableNo) {
      const targetTable = store.tables.find(
        (table) => normalizeTableNo(table.table_no) === tableNo
      );
      const seats = Math.max(Number.parseInt(targetTable?.seats, 10) || 0, 0);
      if (seats > 0) {
        const assignedSeats = getAssignedSeats(store.guests, tableNo, id);
        const incomingSeats = getGuestPartySizeFromResponses(responses);
        if (assignedSeats + incomingSeats > seats) {
          const message = encodeURIComponent(
            `桌号 ${tableNo} 已超出最大承载 ${seats} 位，请调整座位。`
          );
          const returnTo = (body.return_to || "").trim();
          const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
          redirect(
            res,
            `/admin/guests?error=${message}&error_guest=${id}${hash}`
          );
          return;
        }
      }
    }
    store.guests = store.guests.map((guest) =>
      guest.id === id
        ? {
            ...guest,
            name: body.name || guest.name,
            phone: body.phone || guest.phone,
            table_no: tableNo,
            attending: Boolean(body.attending),
            responses,
            updated_at: new Date().toISOString()
          }
        : guest
    );
    saveStore(store);
    const returnTo = (body.return_to || "").trim();
    const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
    redirect(res, `/admin/guests${hash}`);
    return;
  }

  const guestDeleteMatch = pathname.match(/^\/admin\/guests\/(\d+)\/delete$/);
  if (req.method === "POST" && guestDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(guestDeleteMatch[1]);
    store.guests = store.guests.filter((guest) => guest.id !== id);
    store.checkins = (store.checkins || []).filter(
      (checkin) => checkin.guest_id !== id
    );
    saveStore(store);
    const returnTo = (body.return_to || "").trim();
    redirect(res, returnTo || "/admin/guests");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/tables") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const tableNo = normalizeTableNo(body.table_no);
    if (!tableNo) {
      redirect(res, "/admin/guests");
      return;
    }
    const seats = Math.max(Number.parseInt(body.seats, 10) || 0, 0);
    const existing = store.tables.find(
      (table) => normalizeTableNo(table.table_no) === tableNo
    );
    const payload = {
      table_no: tableNo,
      nickname: (body.nickname || "").trim(),
      seats,
      preference: (body.preference || "").trim(),
      updated_at: new Date().toISOString()
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      store.tables.push({
        id: nextId(store, "tables"),
        ...payload
      });
    }
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  const tableUpdateMatch = pathname.match(/^\/admin\/tables\/(\d+)\/update$/);
  if (req.method === "POST" && tableUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(tableUpdateMatch[1]);
    const tableNo = normalizeTableNo(body.table_no);
    if (!tableNo) {
      redirect(res, "/admin/guests");
      return;
    }
    const seats = Math.max(Number.parseInt(body.seats, 10) || 0, 0);
    let previousTableNo = "";
    store.tables = store.tables.map((table) => {
      if (table.id !== id) return table;
      previousTableNo = normalizeTableNo(table.table_no);
      return {
        ...table,
        table_no: tableNo,
        nickname: (body.nickname || "").trim(),
        seats,
        preference: (body.preference || "").trim(),
        updated_at: new Date().toISOString()
      };
    });
    if (previousTableNo && previousTableNo !== tableNo) {
      store.guests = store.guests.map((guest) =>
        normalizeTableNo(guest.table_no) === previousTableNo
          ? { ...guest, table_no: tableNo }
          : guest
      );
    }
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  const tableDeleteMatch = pathname.match(/^\/admin\/tables\/(\d+)\/delete$/);
  if (req.method === "POST" && tableDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(tableDeleteMatch[1]);
    let tableNo = "";
    store.tables = store.tables.filter((table) => {
      if (table.id !== id) return true;
      tableNo = normalizeTableNo(table.table_no);
      return false;
    });
    if (tableNo) {
      store.guests = store.guests.map((guest) =>
        normalizeTableNo(guest.table_no) === tableNo
          ? { ...guest, table_no: "" }
          : guest
      );
    }
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/tables/print") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    sendResponse(
      res,
      200,
      renderTablePrint({
        tables: sortTables(store.tables),
        guests: store.guests
      })
    );
    return;
  }

  const tablePrintMatch = pathname.match(/^\/admin\/tables\/(\d+)\/print$/);
  if (req.method === "GET" && tablePrintMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(tablePrintMatch[1]);
    const table = store.tables.find((item) => item.id === id);
    if (!table) {
      sendResponse(res, 404, "Not Found", "text/plain");
      return;
    }
    sendResponse(
      res,
      200,
      renderTablePrint({
        tables: [table],
        guests: store.guests
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/admin/checkins") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const { checkedInGuests, pendingGuests } = getCheckedInGuests(store);
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const checkinUrl = `${proto}://${host}/checkin`;
    sendResponse(
      res,
      200,
      renderAdminCheckins({
        checkinUrl,
        totalGuests: store.guests.length,
        checkedInCount: checkedInGuests.length,
        checkedInGuests,
        pendingGuests,
        tables: sortTables(store.tables)
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/admin/checkins/manual") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const tableNo = (body.table_no || "").trim();
    const actualAttendees = Math.max(
      Number.parseInt(body.actual_attendees, 10) || 1,
      1
    );
    if (!name) {
      redirect(res, "/admin/checkins");
      return;
    }
    const store = loadStore();
    let guest = null;
    if (phone) {
      guest = store.guests.find((item) => item.phone === phone);
    }
    if (!guest) {
      guest = store.guests.find((item) => item.name === name);
    }
    if (guest) {
      guest.name = name || guest.name;
      if (phone) guest.phone = phone;
      if (tableNo) guest.table_no = tableNo;
      guest.attending = true;
      guest.updated_at = new Date().toISOString();
    } else {
      guest = {
        id: nextId(store, "guests"),
        name,
        phone,
        attending: true,
        responses: {},
        table_no: tableNo,
        updated_at: new Date().toISOString()
      };
      store.guests.push(guest);
    }
    upsertCheckin(store, guest.id, actualAttendees);
    saveStore(store);
    redirect(res, "/admin/checkins");
    return;
  }

  const checkinUpdateMatch = pathname.match(/^\/admin\/checkins\/(\d+)\/update$/);
  if (req.method === "POST" && checkinUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(checkinUpdateMatch[1]);
    const tableNo = (body.table_no || "").trim();
    const actualAttendees = Math.max(
      Number.parseInt(body.actual_attendees, 10) || 1,
      1
    );
    store.guests = store.guests.map((guest) =>
      guest.id === id ? { ...guest, table_no: tableNo } : guest
    );
    updateCheckinAttendees(store, id, actualAttendees);
    saveStore(store);
    redirect(res, "/admin/checkins");
    return;
  }

  const checkinCancelMatch = pathname.match(/^\/admin\/checkins\/(\d+)\/cancel$/);
  if (req.method === "POST" && checkinCancelMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(checkinCancelMatch[1]);
    store.checkins = (store.checkins || []).filter(
      (checkin) => checkin.guest_id !== id
    );
    saveStore(store);
    redirect(res, "/admin/checkins");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/seat-cards") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const guests = store.guests.filter((guest) => guest.attending);
    sendResponse(res, 200, renderSeatCards(guests));
    return;
  }

  if (req.method === "GET" && pathname === "/admin/lottery") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const winners = store.winners.map((winner) => {
      const prize = store.prizes.find((item) => item.id === winner.prize_id);
      const guest = store.guests.find((item) => item.id === winner.guest_id);
      return {
        ...winner,
        prize_name: prize ? prize.name : "-",
        guest_name: guest ? guest.name : "-"
      };
    });
    sendResponse(
      res,
      200,
      renderAdminLottery({ prizes: store.prizes, winners })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/admin/lottery/prizes") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    if (body.name) {
      const store = loadStore();
      store.prizes.push({
        id: nextId(store, "prizes"),
        name: body.name,
        quantity: Number(body.quantity) || 1
      });
      saveStore(store);
    }
    redirect(res, "/admin/lottery");
    return;
  }

  const prizeDeleteMatch = pathname.match(
    /^\/admin\/lottery\/prizes\/(\d+)\/delete$/
  );
  if (req.method === "POST" && prizeDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(prizeDeleteMatch[1]);
    store.prizes = store.prizes.filter((prize) => prize.id !== id);
    store.winners = store.winners.filter((winner) => winner.prize_id !== id);
    saveStore(store);
    redirect(res, "/admin/lottery");
    return;
  }

  if (req.method === "GET" && pathname === "/invite") {
    const store = loadStore();
    sendResponse(
      res,
      200,
      renderInvite({
        settings: store.settings,
        sections: store.invitation_sections.sort(
          (a, b) => a.sort_order - b.sort_order
        ),
        fields: store.invitation_fields,
        submitted: url.searchParams.get("submitted")
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/checkin") {
    const store = loadStore();
    sendResponse(
      res,
      200,
      renderCheckin({
        settings: store.settings,
        fields: store.invitation_fields,
        error: null,
        result: null,
        prompt: null,
        formValues: {},
        newGuestForm: false
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/checkin") {
    const body = await parseBody(req);
    const lookupInput = (body.lookup || "").trim();
    const normalizedLookup = lookupInput.replace(/\s+/g, "");
    const isLikelyPhone = /^\d{6,}$/.test(normalizedLookup);
    const confirmAttending = Boolean(body.confirm_attending);
    const startNew = body.start_new === "1";
    const newGuest = body.new_guest === "1";
    const actualAttendees = Math.max(
      Number.parseInt(body.actual_attendees, 10) || 1,
      1
    );
    const store = loadStore();
    const formValues = {
      lookup: lookupInput,
      actual_attendees: String(actualAttendees),
      confirm_attending: confirmAttending,
      name: (body.name || "").trim(),
      phone: (body.phone || "").trim()
    };
    store.invitation_fields.forEach((field) => {
      formValues[field.field_key] = body[field.field_key] || "";
    });
    if (startNew) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: store.invitation_fields,
          error: null,
          result: null,
          prompt: null,
          formValues,
          newGuestForm: true
        })
      );
      return;
    }
    if (newGuest) {
      if (!formValues.name || !formValues.phone) {
        sendResponse(
          res,
          200,
          renderCheckin({
            settings: store.settings,
            fields: store.invitation_fields,
            error: "请填写姓名和手机号后再签到。",
            result: null,
            prompt: null,
            formValues,
            newGuestForm: true
          })
        );
        return;
      }
      if (!confirmAttending) {
        sendResponse(
          res,
          200,
          renderCheckin({
            settings: store.settings,
            fields: store.invitation_fields,
            error: "请确认到场出席状态。",
            result: null,
            prompt: null,
            formValues,
            newGuestForm: true
          })
        );
        return;
      }
      const responses = {};
      store.invitation_fields.forEach((field) => {
        responses[field.field_key] = body[field.field_key] || "";
      });
      const guest = {
        id: nextId(store, "guests"),
        name: formValues.name,
        phone: formValues.phone,
        attending: true,
        responses,
        table_no: "",
        updated_at: new Date().toISOString()
      };
      store.guests.push(guest);
      const checkinRecord = upsertCheckin(store, guest.id, actualAttendees);
      saveStore(store);
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: store.invitation_fields,
          error: null,
          result: {
            name: guest.name,
            table_no: guest.table_no || "未分配",
            actual_attendees: actualAttendees,
            checked_in_at: checkinRecord.checked_in_at
          },
          prompt: null,
          formValues,
          newGuestForm: false
        })
      );
      return;
    }
    if (!lookupInput) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: store.invitation_fields,
          error: "请填写姓名或手机号后再签到。",
          result: null,
          prompt: null,
          formValues,
          newGuestForm: false
        })
      );
      return;
    }
    if (!confirmAttending) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: store.invitation_fields,
          error: "请确认到场出席状态。",
          result: null,
          prompt: null,
          formValues,
          newGuestForm: false
        })
      );
      return;
    }
    const phoneMatches = normalizedLookup
      ? store.guests.filter((item) => item.phone === normalizedLookup)
      : [];
    const nameMatches = lookupInput
      ? store.guests.filter((item) => item.name === lookupInput)
      : [];
    const matchMap = new Map();
    [...phoneMatches, ...nameMatches].forEach((item) => {
      matchMap.set(item.id, item);
    });
    const uniqueMatches = Array.from(matchMap.values());
    let guest = uniqueMatches.length === 1 ? uniqueMatches[0] : null;
    if (!guest) {
      let message =
        "未在请柬登记名单中出现，是否填写错误？若确认为新来宾可继续登记。";
      if (uniqueMatches.length > 1) {
        message = "匹配到多位来宾，请联系工作人员确认，或登记为新来宾。";
      }
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: store.invitation_fields,
          error: null,
          result: null,
          prompt: { message },
          formValues,
          newGuestForm: false
        })
      );
      return;
    }
    if (guest) {
      if (isLikelyPhone) {
        guest.phone = normalizedLookup;
      } else {
        guest.name = lookupInput;
      }
      guest.attending = true;
      guest.updated_at = new Date().toISOString();
    }
    const checkinRecord = upsertCheckin(store, guest.id, actualAttendees);
    saveStore(store);
    sendResponse(
      res,
      200,
      renderCheckin({
        settings: store.settings,
        fields: store.invitation_fields,
        error: null,
        result: {
          name: guest.name,
          table_no: guest.table_no || "未分配",
          actual_attendees: actualAttendees,
          checked_in_at: checkinRecord.checked_in_at
        },
        prompt: null,
        formValues,
        newGuestForm: false
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/invite/rsvp") {
    const body = await parseBody(req);
    if (!body.name || !body.phone) {
      sendResponse(res, 400, "请填写姓名和手机号", "text/plain");
      return;
    }
    const store = loadStore();
    const responses = {};
    store.invitation_fields.forEach((field) => {
      responses[field.field_key] = body[field.field_key] || "";
    });
    const existing = store.guests.find((guest) => guest.phone === body.phone);
    if (existing) {
      existing.name = body.name;
      existing.attending = Boolean(body.attending);
      existing.responses = responses;
      existing.updated_at = new Date().toISOString();
    } else {
      store.guests.push({
        id: nextId(store, "guests"),
        name: body.name,
        phone: body.phone,
        attending: Boolean(body.attending),
        responses,
        table_no: "",
        updated_at: new Date().toISOString()
      });
    }
    saveStore(store);
    redirect(res, "/invite?submitted=1");
    return;
  }

  if (req.method === "GET" && pathname === "/lottery") {
    const store = loadStore();
    const session = getSession(req);
    const { checkedInGuests } = getCheckedInGuests(store);
    const winners = store.winners.map((winner) => {
      const prize = store.prizes.find((item) => item.id === winner.prize_id);
      const guest = store.guests.find((item) => item.id === winner.guest_id);
      return {
        ...winner,
        prize_name: prize ? prize.name : "-",
        guest_name: guest ? guest.name : "-"
      };
    });
    sendResponse(
      res,
      200,
      renderLottery({
        prizes: store.prizes,
        isAdmin: Boolean(session),
        guests: checkedInGuests,
        winners
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/lottery/reset") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    store.winners = [];
    saveStore(store);
    sendResponse(res, 200, JSON.stringify({ ok: true }), "application/json");
    return;
  }

  if (req.method === "POST" && pathname === "/lottery/draw") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const prizeId = body.prizeId ?? body.prize_id;
    const prize = store.prizes.find(
      (item) => String(item.id) === String(prizeId)
    );
    if (!prize) {
      sendResponse(res, 400, JSON.stringify({ error: "奖品不存在" }), "application/json");
      return;
    }
    const prizeWinners = store.winners.filter(
      (winner) => winner.prize_id === prize.id
    );
    if (prizeWinners.length >= prize.quantity) {
      sendResponse(res, 400, JSON.stringify({ error: "奖品已抽完" }), "application/json");
      return;
    }
    const { checkinMap } = getCheckedInGuests(store);
    const eligible = store.guests.filter(
      (guest) =>
        checkinMap.has(guest.id) &&
        !store.winners.some((winner) => winner.guest_id === guest.id)
    );
    if (eligible.length === 0) {
      sendResponse(res, 400, JSON.stringify({ error: "暂无可抽取来宾" }), "application/json");
      return;
    }
    const winner = eligible[Math.floor(Math.random() * eligible.length)];
    store.winners.push({
      id: nextId(store, "winners"),
      prize_id: prize.id,
      guest_id: winner.id,
      created_at: new Date().toISOString()
    });
    saveStore(store);
    sendResponse(
      res,
      200,
      JSON.stringify({ winner }),
      "application/json"
    );
    return;
  }

  sendResponse(res, 404, "Not Found", "text/plain");
};

const createServer = () => http.createServer(handleRequest);

if (require.main === module) {
  const port = process.env.PORT || 11021;
  createServer().listen(port, () => {
    console.log(`Wedding Manager running on http://localhost:${port}`);
  });
}

module.exports = { createServer };
