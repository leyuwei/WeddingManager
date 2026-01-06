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
  renderSeatCards,
  renderAdminLottery,
  renderInvite,
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
    const guestCount = store.guests.length;
    const attendingCount = store.guests.filter((g) => g.attending).length;
    sendResponse(
      res,
      200,
      renderDashboard({ guestCount, attendingCount })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/admin/admins") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    sendResponse(res, 200, renderAdmins(store.admins));
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
    const guests = store.guests.map((guest) => ({
      ...guest,
      responses: guest.responses || {}
    }));
    sendResponse(
      res,
      200,
      renderGuests({ guests, fields: store.invitation_fields })
    );
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
    const responses = {};
    store.invitation_fields.forEach((field) => {
      responses[field.field_key] = body[field.field_key] || "";
    });
    const existing = store.guests.find((guest) => guest.phone === body.phone);
    if (existing) {
      existing.name = body.name;
      existing.attending = Boolean(body.attending);
      existing.table_no = body.table_no || "";
      existing.responses = responses;
      existing.updated_at = new Date().toISOString();
    } else {
      store.guests.push({
        id: nextId(store, "guests"),
        name: body.name,
        phone: body.phone,
        attending: Boolean(body.attending),
        responses,
        table_no: body.table_no || "",
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
    const responses = {};
    store.invitation_fields.forEach((field) => {
      responses[field.field_key] = body[field.field_key] || "";
    });
    store.guests = store.guests.map((guest) =>
      guest.id === id
        ? {
            ...guest,
            name: body.name || guest.name,
            phone: body.phone || guest.phone,
            table_no: body.table_no || "",
            attending: Boolean(body.attending),
            responses,
            updated_at: new Date().toISOString()
          }
        : guest
    );
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  const guestDeleteMatch = pathname.match(/^\/admin\/guests\/(\d+)\/delete$/);
  if (req.method === "POST" && guestDeleteMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const id = Number(guestDeleteMatch[1]);
    store.guests = store.guests.filter((guest) => guest.id !== id);
    saveStore(store);
    redirect(res, "/admin/guests");
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
    sendResponse(
      res,
      200,
      renderLottery({
        prizes: store.prizes,
        isAdmin: Boolean(session),
        guests: store.guests.filter((guest) => guest.attending)
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/lottery/draw") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const prize = store.prizes.find((item) => String(item.id) === body.prizeId);
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
    const eligible = store.guests.filter(
      (guest) =>
        guest.attending &&
        !store.winners.some(
          (winner) => winner.prize_id === prize.id && winner.guest_id === guest.id
        )
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
