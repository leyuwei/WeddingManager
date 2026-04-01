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
const SESSION_COOKIE_NAME = "wm_session_id";
const LEGACY_SESSION_COOKIE_NAME = "session_id";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = safeDecodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

const getSession = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId =
    cookies[SESSION_COOKIE_NAME] || cookies[LEGACY_SESSION_COOKIE_NAME];
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
};

const createSession = (req, res, adminId) => {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(sessionId, { adminId, createdAt: Date.now() });
  const secureAttribute = isSecureRequest(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureAttribute}`
  );
};

const destroySession = (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const currentSessionId =
    cookies[SESSION_COOKIE_NAME] || cookies[LEGACY_SESSION_COOKIE_NAME];
  if (currentSessionId) {
    sessions.delete(currentSessionId);
  }
  const secureAttribute = isSecureRequest(req) ? "; Secure" : "";
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureAttribute}`,
    `${LEGACY_SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureAttribute}`
  ]);
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

const uploadDir = path.join(__dirname, "public", "uploads");
const ensureUploadDir = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
};

const getAudioExtension = (mimeType, filename) => {
  const normalized = String(mimeType || "").toLowerCase();
  const extFromMime = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm"
  };
  if (extFromMime[normalized]) {
    return extFromMime[normalized];
  }
  const ext = path.extname(filename || "").toLowerCase();
  if (ext) return ext;
  return ".mp3";
};

const getImageExtension = (mimeType, filename) => {
  const normalized = String(mimeType || "").toLowerCase();
  const extFromMime = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg"
  };
  if (extFromMime[normalized]) {
    return extFromMime[normalized];
  }
  const ext = path.extname(filename || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".jpg";
};

const removeInviteMusicFile = (musicUrl) => {
  if (!musicUrl) return;
  if (!musicUrl.startsWith("/public/uploads/")) return;
  const relativePath = musicUrl.replace(/^\//, "");
  const filePath = path.join(__dirname, relativePath);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // ignore cleanup errors
    }
  }
};

const getForwardedHeaderValue = (headerValue) => {
  if (!headerValue) return null;
  return String(headerValue).split(",")[0].trim();
};

const parseForwardedHeader = (forwarded) => {
  if (!forwarded) return {};
  return String(forwarded)
    .split(",")[0]
    .split(";")
    .reduce((acc, part) => {
      const [key, value] = part.split("=");
      if (!key || !value) return acc;
      acc[key.trim().toLowerCase()] = value.trim().replace(/^"|"$/g, "");
      return acc;
    }, {});
};

const parseAbsoluteUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  try {
    return new URL(normalized);
  } catch (error) {
    return null;
  }
};

const normalizeProtocol = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, "")
    .replace(/:$/, "");
  if (!normalized) return null;
  if (normalized === "https" || normalized === "http") {
    return normalized;
  }
  return null;
};

const normalizeHost = (value) => {
  const normalized = String(value || "").trim().replace(/^"|"$/g, "");
  if (!normalized) return "";
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  ) {
    const parsed = parseAbsoluteUrl(normalized);
    if (parsed?.host) {
      return parsed.host;
    }
  }
  return normalized.split("/")[0];
};

const isLocalHostname = (host) => {
  const normalized = String(host || "").trim().toLowerCase();
  if (!normalized) return false;
  const isRawIpv6 =
    normalized.includes(":") &&
    !normalized.startsWith("[") &&
    /^[0-9a-f:]+$/i.test(normalized);
  const bracketEndIndex = normalized.indexOf("]");
  const hostWithoutPort = normalized.startsWith("[")
    ? normalized.slice(1, bracketEndIndex > -1 ? bracketEndIndex : undefined)
    : isRawIpv6
      ? normalized
      : normalized.split(":")[0];
  const plainHost = hostWithoutPort.replace(/^::ffff:/, "");
  return (
    plainHost === "localhost" ||
    plainHost === "127.0.0.1" ||
    plainHost === "::1" ||
    plainHost === "0.0.0.0" ||
    plainHost.endsWith(".local")
  );
};

const detectRequestProtocol = (req, forwarded, host) => {
  const protoCandidates = [
    getForwardedHeaderValue(req.headers["x-forwarded-proto"]),
    getForwardedHeaderValue(req.headers["x-forwarded-protocol"]),
    getForwardedHeaderValue(req.headers["x-forwarded-scheme"]),
    getForwardedHeaderValue(req.headers["x-url-scheme"]),
    getForwardedHeaderValue(req.headers["x-scheme"]),
    forwarded?.proto
  ];
  for (const candidate of protoCandidates) {
    const normalized = normalizeProtocol(candidate);
    if (normalized) return normalized;
  }

  const forwardedSslHeader = String(
    getForwardedHeaderValue(req.headers["x-forwarded-ssl"]) || ""
  )
    .trim()
    .toLowerCase();
  if (forwardedSslHeader === "on") return "https";

  const frontEndHttpsHeader = String(
    getForwardedHeaderValue(req.headers["front-end-https"]) || ""
  )
    .trim()
    .toLowerCase();
  if (frontEndHttpsHeader === "on") return "https";

  const originProtocol = normalizeProtocol(parseAbsoluteUrl(req.headers.origin)?.protocol);
  if (originProtocol) return originProtocol;

  const refererProtocol = normalizeProtocol(
    parseAbsoluteUrl(req.headers.referer)?.protocol
  );
  if (refererProtocol) return refererProtocol;

  if (req.socket?.encrypted) return "https";

  return isLocalHostname(host) ? "http" : "https";
};

const resolveRequestHost = (req, forwarded) =>
  normalizeHost(
    getForwardedHeaderValue(req.headers["x-forwarded-host"]) ||
      forwarded?.host ||
      req.headers.host ||
      parseAbsoluteUrl(req.headers.origin)?.host ||
      parseAbsoluteUrl(req.headers.referer)?.host ||
      "localhost"
  ) || "localhost";

const isHttpsForcedForQr = (settings) => {
  const value = settings?.qr_force_https;
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return true;
};

const isSecureRequest = (req) => {
  const forwarded = parseForwardedHeader(req.headers.forwarded);
  const host = resolveRequestHost(req, forwarded);
  return detectRequestProtocol(req, forwarded, host) === "https";
};

const getBaseUrl = (req) => {
  const forwarded = parseForwardedHeader(req.headers.forwarded);
  const host = resolveRequestHost(req, forwarded);
  const proto = detectRequestProtocol(req, forwarded, host);
  return `${proto}://${host}`;
};

const getQrBaseUrl = (req, settings = {}) => {
  const baseUrl = getBaseUrl(req);
  if (!isHttpsForcedForQr(settings)) return baseUrl;
  try {
    const parsed = new URL(baseUrl);
    if (isLocalHostname(parsed.hostname) || parsed.protocol === "https:") {
      return parsed.toString().replace(/\/$/, "");
    }
    parsed.protocol = "https:";
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    return baseUrl;
  }
};

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
  const headers = { "Content-Type": `${type}; charset=utf-8` };
  if (type === "text/html") {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    headers.Pragma = "no-cache";
    headers.Expires = "0";
  }
  res.writeHead(status, headers);
  res.end(body);
};

const redirect = (res, location) => {
  const headers = {
    Location: location,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  };
  if (location.startsWith("/admin")) {
    headers.Vary = "Cookie";
  }
  res.writeHead(302, headers);
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
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm"
  };
  const contentType = types[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  const headers = { "Content-Type": contentType };
  if ([".css", ".js"].includes(ext)) {
    headers["Cache-Control"] = "no-cache";
  }
  res.writeHead(200, headers);
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

const normalizeLedgerDirectionFromImport = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["收入", "进账", "income", "in"].includes(normalized)) return "income";
  if (["支出", "花费", "expense", "out"].includes(normalized)) return "expense";
  return normalizeLedgerDirection(normalized);
};

const parseLedgerAmount = (value) => {
  const normalized = String(value || "").trim().replaceAll(",", "");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeLedgerDate = (value) => {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return new Date().toISOString().slice(0, 10);
};

const parseCsvRows = (csvText) => {
  const text = String(csvText || "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows;
};

const normalizeImportHeader = (value) =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const getImportHeaderIndex = (headers, candidateNames) => {
  const normalizedHeaders = (headers || []).map(normalizeImportHeader);
  for (const candidate of candidateNames) {
    const index = normalizedHeaders.indexOf(normalizeImportHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
};

const parsePartySize = (value) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
};

const parseAttendingValue = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "true", "1", "on"].includes(normalized)) return true;
  if (["no", "false", "0", "off"].includes(normalized)) return false;
  return null;
};

const normalizeHexColor = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

const parseBooleanValue = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const heroNamePositionValues = new Set(["near_message", "top", "center"]);

const normalizeHeroNamePosition = (value, fallback = "near_message") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (heroNamePositionValues.has(normalized)) return normalized;
  return fallback;
};

const sectionBackgroundModeValues = new Set([
  "cover",
  "contain",
  "stretch",
  "repeat",
  "repeat-x",
  "repeat-y"
]);

const normalizeSectionBackgroundMode = (value, fallback = "cover") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (sectionBackgroundModeValues.has(normalized)) return normalized;
  return fallback;
};

const inviteFontValues = new Set([
  "system",
  "songti",
  "zhong_song",
  "kaiti",
  "fangsong",
  "heiti",
  "yuanti",
  "romance"
]);

const normalizeInviteFont = (value, fallback = "system") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (inviteFontValues.has(normalized)) return normalized;
  return fallback;
};

const textAnimationStyleValues = new Set([
  "fade_up",
  "soft_zoom",
  "glow_rise"
]);

const normalizeTextAnimationStyle = (value, fallback = "fade_up") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (textAnimationStyleValues.has(normalized)) return normalized;
  return fallback;
};

const countdownThemeValues = new Set(["glass", "romantic", "ink", "gold"]);

const normalizeCountdownTheme = (value, fallback = "glass") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (countdownThemeValues.has(normalized)) return normalized;
  return fallback;
};

const countdownPositionValues = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);

const normalizeCountdownPosition = (value, fallback = "top-right") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (countdownPositionValues.has(normalized)) return normalized;
  return fallback;
};

const swipeHintPositionValues = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);

const normalizeSwipeHintPosition = (value, fallback = "bottom-center") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (swipeHintPositionValues.has(normalized)) return normalized;
  return fallback;
};

const swipeHintStyleValues = new Set(["soft_glow", "minimal", "festive_chip"]);

const normalizeSwipeHintStyle = (value, fallback = "soft_glow") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (swipeHintStyleValues.has(normalized)) return normalized;
  return fallback;
};

const festiveThemeValues = new Set([
  "classic_red",
  "palace_gold",
  "garden_bloom",
  "champagne_waltz"
]);

const normalizeFestiveTheme = (value, fallback = "classic_red") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveThemeValues.has(normalized)) return normalized;
  return fallback;
};

const festiveEffectStyleValues = new Set([
  "lantern",
  "petal",
  "confetti",
  "sparkle"
]);

const normalizeFestiveEffectStyle = (value, fallback = "lantern") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveEffectStyleValues.has(normalized)) return normalized;
  return fallback;
};

const festiveEffectIntensityValues = new Set(["gentle", "normal", "vivid"]);

const normalizeFestiveEffectIntensity = (value, fallback = "normal") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveEffectIntensityValues.has(normalized)) return normalized;
  return fallback;
};

const normalizeDateTimeLike = (value, fallback = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    return normalized;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const pad = (item) => String(item).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate()
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const normalizeExternalLink = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^(javascript|data|vbscript):/i.test(normalized)) return "";
  return normalized;
};

const normalizeExternalLinks = (value) => {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());
  const normalized = list
    .map((item) => normalizeExternalLink(item))
    .filter(Boolean);
  return [...new Set(normalized)];
};

const invitationFieldTypeValues = new Set([
  "text",
  "textarea",
  "select",
  "date",
  "checkbox",
  "radio"
]);
const invitationFieldTypesWithOptions = new Set(["select", "checkbox", "radio"]);

const normalizeInvitationFieldType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (invitationFieldTypeValues.has(normalized)) return normalized;
  return "text";
};

const normalizeInvitationFieldOptions = (fieldType, value) => {
  if (!invitationFieldTypesWithOptions.has(fieldType)) return "";
  return String(value || "")
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean)
    .join(",");
};

const normalizeInvitationField = (field = {}) => {
  const fieldType = normalizeInvitationFieldType(field.field_type);
  return {
    ...field,
    field_type: fieldType,
    options: normalizeInvitationFieldOptions(fieldType, field.options)
  };
};

const getInvitationFields = (store) =>
  (store?.invitation_fields || []).map((field) => normalizeInvitationField(field));

const builtInGuestFieldKeys = ["name", "phone", "attendees", "attending"];

const normalizeInvitationGuestFieldOrder = (orderValue, fields = []) => {
  const customKeys = (fields || [])
    .map((field) => String(field.field_key || "").trim())
    .filter(Boolean);
  const allowed = new Set([...builtInGuestFieldKeys, ...customKeys]);
  const rawOrder = Array.isArray(orderValue)
    ? orderValue
    : String(orderValue || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const ordered = [];
  rawOrder.forEach((key) => {
    if (!allowed.has(key)) return;
    if (ordered.includes(key)) return;
    ordered.push(key);
  });
  [...builtInGuestFieldKeys, ...customKeys].forEach((key) => {
    if (ordered.includes(key)) return;
    ordered.push(key);
  });
  return ordered;
};

const normalizeCheckboxResponse = (field, rawValue) => {
  const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length) return "";

  const options = normalizeInvitationFieldOptions(
    "checkbox",
    field?.options || ""
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (options.length) {
    const optionSet = new Set(options);
    const selected = values.filter((item) => optionSet.has(item));
    return [...new Set(selected)].join(",");
  }

  const checked = values.some(
    (item) => !["0", "false", "off", "no"].includes(item.toLowerCase())
  );
  return checked ? "1" : "";
};

const normalizeRadioResponse = (field, rawValue) => {
  const singleValue = Array.isArray(rawValue)
    ? rawValue[rawValue.length - 1]
    : rawValue;
  const normalized = String(singleValue || "").trim();
  if (!normalized) return "";
  const options = normalizeInvitationFieldOptions("radio", field?.options || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!options.length) return "";
  return options.includes(normalized) ? normalized : "";
};

const normalizeInvitationFieldResponse = (field, rawValue) => {
  const fieldType = normalizeInvitationFieldType(field?.field_type);
  if (fieldType === "checkbox") {
    return normalizeCheckboxResponse(field, rawValue);
  }
  if (fieldType === "radio") {
    return normalizeRadioResponse(field, rawValue);
  }
  const singleValue = Array.isArray(rawValue)
    ? rawValue[rawValue.length - 1]
    : rawValue;
  const normalized = String(singleValue || "").trim();
  if (fieldType === "date" && normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }
  return normalized;
};

const collectInvitationFieldResponses = (fields = [], body = {}) =>
  (fields || []).reduce((responses, field) => {
    responses[field.field_key] = normalizeInvitationFieldResponse(
      field,
      body[field.field_key]
    );
    return responses;
  }, {});

const hasRequiredFieldValue = (field, value) => {
  const fieldType = normalizeInvitationFieldType(field?.field_type);
  if (fieldType === "checkbox") {
    return Boolean(normalizeCheckboxResponse(field, value));
  }
  return Boolean(String(value ?? "").trim());
};

const getMissingGuestFieldLabels = (values, fields = []) => {
  const missing = [];
  if (!values.name) missing.push("姓名");
  if (!values.phone) missing.push("手机号");
  if (!values.attendees) missing.push("出席人数");
  if (values.attending === null) missing.push("出席情况");
  fields
    .filter((field) => field.required)
    .forEach((field) => {
      const fieldValue = values.responses?.[field.field_key];
      if (!hasRequiredFieldValue(field, fieldValue)) missing.push(field.label);
    });
  return missing;
};

const getGuestPartySizeFromResponses = (responses) =>
  parsePartySize(responses?.attendees);

const getAssignedSeats = (guests, tableNo, excludeGuestId = null) =>
  (guests || []).reduce((sum, guest) => {
    if (normalizeTableNo(guest.table_no) !== tableNo) return sum;
    if (excludeGuestId && guest.id === excludeGuestId) return sum;
    return sum + getGuestPartySizeFromResponses(guest.responses || {});
  }, 0);

const getStoredAttendeeCount = (guest) => {
  const responses = guest.responses || {};
  if (!Object.prototype.hasOwnProperty.call(responses, "attendees")) {
    return null;
  }
  return parsePartySize(responses.attendees);
};

const syncGuestAttendeesWithCheckin = (guest, actualAttendees) => {
  const responses = guest.responses || {};
  const recordedAttendees = getStoredAttendeeCount(guest);
  if (recordedAttendees === null) {
    guest.responses = { ...responses, attendees: String(actualAttendees) };
    guest.attendee_adjusted = false;
    delete guest.attendee_adjusted_from;
    delete guest.attendee_adjusted_at;
    return;
  }
  if (recordedAttendees !== actualAttendees) {
    guest.responses = { ...responses, attendees: String(actualAttendees) };
    guest.attendee_adjusted = true;
    guest.attendee_adjusted_from = recordedAttendees;
    guest.attendee_adjusted_at = new Date().toISOString();
    return;
  }
  guest.responses = { ...responses, attendees: String(actualAttendees) };
  guest.attendee_adjusted = false;
  delete guest.attendee_adjusted_from;
  delete guest.attendee_adjusted_at;
};

const maskPhoneForDisambiguation = (value) => {
  const normalized = String(value || "").replace(/\s+/g, "");
  if (!normalized) return "手机号未登记";
  if (normalized.length <= 4) return normalized;
  if (normalized.length <= 7) {
    return `${normalized.slice(0, 1)}***${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
};

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
    createSession(req, res, admin.id);
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
    const guestIds = new Set(store.guests.map((guest) => guest.id));
    const checkedInGuestCount = (store.checkins || []).reduce((sum, checkin) => {
      if (!guestIds.has(checkin.guest_id)) return sum;
      return sum + parsePartySize(checkin.actual_attendees);
    }, 0);
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
    const baseUrl = getQrBaseUrl(req, store.settings);
    const inviteUrl = `${baseUrl}/invite`;
    const checkinUrl = `${baseUrl}/checkin`;
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
    const invitationFields = getInvitationFields(store);
    const baseUrl = getQrBaseUrl(req, store.settings);
    const inviteUrl = `${baseUrl}/invite`;
    sendResponse(
      res,
      200,
      renderInvitation({
        settings: store.settings,
        sections: store.invitation_sections.sort(
          (a, b) => a.sort_order - b.sort_order
        ),
        fields: invitationFields,
        inviteUrl
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/settings") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    const parsedFontScale = Number(body.guest_font_scale);
    const parsedHeroOverlayOpacity = Number(body.hero_overlay_opacity);
    const parsedTextAnimationDuration = Number(body.text_animation_duration);
    const parsedTextAnimationStagger = Number(body.text_animation_stagger_ms);
    const parsedCountdownOpacity = Number(body.countdown_opacity);
    const storedHeroOverlayOpacity = Number(store.settings.hero_overlay_opacity);
    const safeStoredHeroOverlayOpacity = Number.isNaN(storedHeroOverlayOpacity)
      ? 0.6
      : Math.min(1, Math.max(0, storedHeroOverlayOpacity));
    const guestFontScale = Number.isNaN(parsedFontScale)
      ? store.settings.guest_font_scale || 1.1
      : Math.min(2.5, Math.max(1, parsedFontScale));
    const heroOverlayOpacity = Number.isNaN(parsedHeroOverlayOpacity)
      ? safeStoredHeroOverlayOpacity
      : Math.min(1, Math.max(0, parsedHeroOverlayOpacity));
    const textAnimationDuration = Number.isNaN(parsedTextAnimationDuration)
      ? Math.min(3, Math.max(0.3, Number(store.settings.text_animation_duration || 0.9)))
      : Math.min(3, Math.max(0.3, parsedTextAnimationDuration));
    const textAnimationStagger = Number.isNaN(parsedTextAnimationStagger)
      ? Math.min(500, Math.max(0, Number(store.settings.text_animation_stagger_ms || 120)))
      : Math.min(500, Math.max(0, parsedTextAnimationStagger));
    const countdownOpacity = Number.isNaN(parsedCountdownOpacity)
      ? Math.min(1, Math.max(0.2, Number(store.settings.countdown_opacity || 0.9)))
      : Math.min(1, Math.max(0.2, parsedCountdownOpacity));
    store.settings = {
      ...store.settings,
      couple_name: body.couple_name || "",
      wedding_date: body.wedding_date || "",
      wedding_location: body.wedding_location || "",
      wedding_location_map_url: normalizeExternalLink(
        body.wedding_location_map_url
      ),
      wedding_route_image_urls: normalizeExternalLinks(
        body.wedding_route_image_urls
      ),
      invitation_guest_field_order: normalizeInvitationGuestFieldOrder(
        store.settings?.invitation_guest_field_order,
        invitationFields
      ),
      hero_message: body.hero_message || "",
      hero_image_url: String(body.hero_image_url || "").trim(),
      hero_overlay_enabled: parseBooleanValue(body.hero_overlay_enabled),
      hero_overlay_color: normalizeHexColor(
        body.hero_overlay_color,
        store.settings.hero_overlay_color || "#000000"
      ),
      hero_overlay_opacity: heroOverlayOpacity,
      hero_text_color: normalizeHexColor(
        body.hero_text_color,
        store.settings.hero_text_color || "#ffffff"
      ),
      hero_name_position: normalizeHeroNamePosition(
        body.hero_name_position,
        store.settings.hero_name_position || "near_message"
      ),
      lunar_date_enabled: parseBooleanValue(body.lunar_date_enabled),
      invite_font_base: normalizeInviteFont(
        body.invite_font_base,
        store.settings.invite_font_base || "system"
      ),
      invite_font_heading: normalizeInviteFont(
        body.invite_font_heading,
        store.settings.invite_font_heading || "songti"
      ),
      invite_font_couple: normalizeInviteFont(
        body.invite_font_couple,
        store.settings.invite_font_couple || "kaiti"
      ),
      invite_font_countdown: normalizeInviteFont(
        body.invite_font_countdown,
        store.settings.invite_font_countdown || "heiti"
      ),
      text_animation_enabled: parseBooleanValue(body.text_animation_enabled),
      text_animation_style: normalizeTextAnimationStyle(
        body.text_animation_style,
        store.settings.text_animation_style || "fade_up"
      ),
      text_animation_duration: textAnimationDuration,
      text_animation_stagger_ms: textAnimationStagger,
      text_animation_repeat: parseBooleanValue(body.text_animation_repeat),
      swipe_hint_enabled: parseBooleanValue(body.swipe_hint_enabled),
      swipe_hint_text:
        String(body.swipe_hint_text || "").trim() || "上滑查看下一页",
      swipe_hint_position: normalizeSwipeHintPosition(
        body.swipe_hint_position,
        store.settings.swipe_hint_position || "bottom-center"
      ),
      swipe_hint_style: normalizeSwipeHintStyle(
        body.swipe_hint_style,
        store.settings.swipe_hint_style || "soft_glow"
      ),
      countdown_enabled: parseBooleanValue(body.countdown_enabled),
      countdown_show_home: parseBooleanValue(body.countdown_show_home),
      countdown_show_success: parseBooleanValue(body.countdown_show_success),
      countdown_target_at: normalizeDateTimeLike(
        body.countdown_target_at,
        store.settings.countdown_target_at || ""
      ),
      countdown_label: String(body.countdown_label || "").trim() || "婚礼倒计时",
      countdown_theme: normalizeCountdownTheme(
        body.countdown_theme,
        store.settings.countdown_theme || "glass"
      ),
      countdown_bg_color: normalizeHexColor(
        body.countdown_bg_color,
        store.settings.countdown_bg_color || "#ffffff"
      ),
      countdown_text_color: normalizeHexColor(
        body.countdown_text_color,
        store.settings.countdown_text_color || "#4b3c33"
      ),
      countdown_accent_color: normalizeHexColor(
        body.countdown_accent_color,
        store.settings.countdown_accent_color || "#d68aa1"
      ),
      countdown_opacity: countdownOpacity,
      countdown_home_position: normalizeCountdownPosition(
        body.countdown_home_position,
        store.settings.countdown_home_position || "top-right"
      ),
      countdown_success_position: normalizeCountdownPosition(
        body.countdown_success_position,
        store.settings.countdown_success_position || "top-right"
      ),
      festive_theme: normalizeFestiveTheme(
        body.festive_theme,
        store.settings.festive_theme || "classic_red"
      ),
      festive_effect_enabled: parseBooleanValue(body.festive_effect_enabled),
      festive_effect_style: normalizeFestiveEffectStyle(
        body.festive_effect_style,
        store.settings.festive_effect_style || "lantern"
      ),
      festive_effect_intensity: normalizeFestiveEffectIntensity(
        body.festive_effect_intensity,
        store.settings.festive_effect_intensity || "normal"
      ),
      guest_font_scale: guestFontScale,
      qr_force_https: parseBooleanValue(body.qr_force_https)
    };
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/music") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const dataUrl = body.dataUrl || "";
    const filename = body.filename || "";
    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      sendResponse(res, 400, "无效的音频数据。", "text/plain");
      return;
    }
    const mimeType = match[1];
    if (!mimeType.startsWith("audio/")) {
      sendResponse(res, 400, "仅支持上传音频文件。", "text/plain");
      return;
    }
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length) {
      sendResponse(res, 400, "音频内容为空。", "text/plain");
      return;
    }
    if (buffer.length > 15 * 1024 * 1024) {
      sendResponse(res, 400, "音频文件过大，请上传 15MB 以内文件。", "text/plain");
      return;
    }
    ensureUploadDir();
    const ext = getAudioExtension(mimeType, filename);
    const safeName = `invite-music-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, buffer);
    const store = loadStore();
    removeInviteMusicFile(store.settings.invitation_music_url);
    store.settings = {
      ...store.settings,
      invitation_music_url: `/public/uploads/${safeName}`
    };
    saveStore(store);
    sendResponse(res, 200, "ok", "text/plain");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/music/delete") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    removeInviteMusicFile(store.settings.invitation_music_url);
    store.settings = { ...store.settings, invitation_music_url: "" };
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/images") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const dataUrl = body.dataUrl || "";
    const filename = body.filename || "";
    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "无效的图片数据。" }),
        "application/json"
      );
      return;
    }
    const mimeType = match[1];
    if (!mimeType.startsWith("image/")) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "仅支持上传图片文件。" }),
        "application/json"
      );
      return;
    }
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "图片内容为空。" }),
        "application/json"
      );
      return;
    }
    if (buffer.length > 10 * 1024 * 1024) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "图片文件过大，请上传 10MB 以内文件。" }),
        "application/json"
      );
      return;
    }
    ensureUploadDir();
    const ext = getImageExtension(mimeType, filename);
    const safeName = `invite-image-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, buffer);
    sendResponse(
      res,
      200,
      JSON.stringify({ url: `/public/uploads/${safeName}` }),
      "application/json"
    );
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
      title: String(body.title || "").trim(),
      body: String(body.body || "").trim(),
      background_mode: normalizeSectionBackgroundMode(
        body.background_mode,
        "cover"
      ),
      image_url: String(body.image_url || "").trim()
    });
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  const sectionUpdateMatch = pathname.match(
    /^\/admin\/invitation\/sections\/(\d+)\/update$/
  );
  if (req.method === "POST" && sectionUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const id = Number(sectionUpdateMatch[1]);
    store.invitation_sections = (store.invitation_sections || []).map((section) =>
      section.id === id
        ? {
            ...section,
            sort_order: Number(body.sort_order) || 0,
            title: String(body.title || "").trim(),
            body: String(body.body || "").trim(),
            background_mode: normalizeSectionBackgroundMode(
              body.background_mode,
              section.background_mode || "cover"
            ),
            image_url: String(body.image_url || "").trim()
          }
        : section
    );
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
    const label = String(body.label || "").trim();
    const fieldKey = String(body.field_key || "").trim();
    const fieldType = normalizeInvitationFieldType(body.field_type);
    const options = normalizeInvitationFieldOptions(fieldType, body.options);
    if (label && fieldKey && fieldKey !== "attendees") {
      const store = loadStore();
      store.invitation_fields.push({
        id: nextId(store, "invitation_fields"),
        label,
        field_key: fieldKey,
        field_type: fieldType,
        options,
        required: Boolean(body.required)
      });
      const invitationFields = getInvitationFields(store);
      const nextOrderInput = [
        ...(store.settings?.invitation_guest_field_order || []),
        fieldKey
      ];
      store.settings = {
        ...store.settings,
        invitation_guest_field_order: normalizeInvitationGuestFieldOrder(
          nextOrderInput,
          invitationFields
        )
      };
      saveStore(store);
    }
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/invitation/field-order") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    store.settings = {
      ...store.settings,
      invitation_guest_field_order: normalizeInvitationGuestFieldOrder(
        body.order_keys,
        invitationFields
      )
    };
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  const fieldUpdateMatch = pathname.match(/^\/admin\/invitation\/fields\/(\d+)\/update$/);
  if (req.method === "POST" && fieldUpdateMatch) {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const label = String(body.label || "").trim();
    const fieldKey = String(body.field_key || "").trim();
    const fieldType = normalizeInvitationFieldType(body.field_type);
    const options = normalizeInvitationFieldOptions(fieldType, body.options);
    const id = Number(fieldUpdateMatch[1]);
    if (label && fieldKey && fieldKey !== "attendees") {
      const store = loadStore();
      const previousField = (store.invitation_fields || []).find(
        (field) => field.id === id
      );
      store.invitation_fields = (store.invitation_fields || []).map((field) =>
        field.id === id
          ? {
              ...field,
              label,
              field_key: fieldKey,
              field_type: fieldType,
              options,
              required: Boolean(body.required)
            }
          : field
      );
      const invitationFields = getInvitationFields(store);
      const currentOrder = store.settings?.invitation_guest_field_order || [];
      const nextOrderInput =
        previousField && previousField.field_key !== fieldKey
          ? currentOrder.map((key) =>
              key === previousField.field_key ? fieldKey : key
            )
          : currentOrder;
      store.settings = {
        ...store.settings,
        invitation_guest_field_order: normalizeInvitationGuestFieldOrder(
          nextOrderInput,
          invitationFields
        )
      };
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
    const invitationFields = getInvitationFields(store);
    store.settings = {
      ...store.settings,
      invitation_guest_field_order: normalizeInvitationGuestFieldOrder(
        store.settings?.invitation_guest_field_order,
        invitationFields
      )
    };
    saveStore(store);
    redirect(res, "/admin/invitation");
    return;
  }

  if (req.method === "GET" && pathname === "/admin/guests") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
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
        fields: invitationFields,
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
    const fields = getInvitationFields(store);
    const header = [
      "姓名",
      "手机号",
      "出席",
      "出席人数",
      "席位号",
      ...fields.map((field) => field.label)
    ];
    const rows = (store.guests || []).map((guest) => {
      const responses = guest.responses || {};
      const base = [
        guest.name || "",
        guest.phone || "",
        guest.attending ? "是" : "否",
        responses.attendees || "",
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

  if (req.method === "POST" && pathname === "/admin/ledger/import") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await parseBody(req);
    const csvText = String(body.csv_text ?? body.csvText ?? "");
    if (!csvText.trim()) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "请先选择要导入的 CSV 文件。" }),
        "application/json"
      );
      return;
    }
    if (Buffer.byteLength(csvText, "utf8") > 3 * 1024 * 1024) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "导入文件过大，请控制在 3MB 以内。" }),
        "application/json"
      );
      return;
    }

    const rows = parseCsvRows(csvText).filter((row) =>
      row.some((cell) => String(cell || "").trim())
    );
    if (rows.length < 2) {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "未读取到有效数据，请上传包含表头与数据行的 CSV 文件。" }),
        "application/json"
      );
      return;
    }

    const header = rows[0];
    const indices = {
      occurred_at: getImportHeaderIndex(header, ["日期", "发生日期"]),
      direction: getImportHeaderIndex(header, ["收支", "收支类型"]),
      category: getImportHeaderIndex(header, ["类型", "分类"]),
      amount: getImportHeaderIndex(header, ["金额"]),
      purpose: getImportHeaderIndex(header, ["具体用途", "用途"]),
      payer: getImportHeaderIndex(header, ["付款人"]),
      payee: getImportHeaderIndex(header, ["对象", "收款/支出对象"]),
      method: getImportHeaderIndex(header, ["方式", "付款方式"]),
      note: getImportHeaderIndex(header, ["备注"])
    };

    if (indices.amount < 0 || indices.purpose < 0 || indices.payer < 0) {
      sendResponse(
        res,
        400,
        JSON.stringify({
          error:
            "缺少必要列：金额、具体用途、付款人。请使用系统导出的模板后再导入。"
        }),
        "application/json"
      );
      return;
    }

    const readCell = (row, index) =>
      index >= 0 ? String(row[index] || "").replace(/^\uFEFF/, "").trim() : "";

    const store = loadStore();
    store.ledger = store.ledger || [];
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    rows.slice(1).forEach((row, rowIndex) => {
      const lineNo = rowIndex + 2;
      if (!row.some((cell) => String(cell || "").trim())) return;

      const amount = parseLedgerAmount(readCell(row, indices.amount));
      const purpose = readCell(row, indices.purpose);
      const payer = readCell(row, indices.payer);
      if (!amount || !purpose || !payer) {
        skipped += 1;
        errors.push(`第${lineNo}行缺少必要字段（金额/用途/付款人）。`);
        return;
      }

      const direction = normalizeLedgerDirectionFromImport(
        readCell(row, indices.direction)
      );
      const category = normalizeLedgerCategory(readCell(row, indices.category));
      const occurredAt = normalizeLedgerDate(readCell(row, indices.occurred_at));
      store.ledger.push({
        id: nextId(store, "ledger"),
        amount,
        direction,
        category,
        purpose,
        payer,
        payee: readCell(row, indices.payee),
        method: readCell(row, indices.method),
        note: readCell(row, indices.note),
        occurred_at: occurredAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      inserted += 1;
    });

    if (inserted > 0) {
      saveStore(store);
    }
    sendResponse(
      res,
      200,
      JSON.stringify({
        inserted,
        skipped,
        errors: errors.slice(0, 20)
      }),
      "application/json"
    );
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
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const attendees = String(body.attendees || "").trim();
    const attending = parseAttendingValue(body.attending);
    const tableNo = getValidTableNo(body.table_no, store.tables);
    const responses = collectInvitationFieldResponses(invitationFields, body);
    responses.attendees = attendees;
    const missingFields = getMissingGuestFieldLabels(
      {
        name,
        phone,
        attendees,
        attending,
        responses
      },
      invitationFields
    );
    if (missingFields.length) {
      const message = encodeURIComponent(
        `请填写必填项：${missingFields.join("、")}。`
      );
      redirect(res, `/admin/guests?error=${message}`);
      return;
    }
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
    const existing = store.guests.find((guest) => guest.phone === phone);
    if (existing) {
      existing.name = name;
      existing.attending = attending;
      existing.table_no = tableNo;
      existing.responses = responses;
      existing.updated_at = new Date().toISOString();
    } else {
      store.guests.push({
        id: nextId(store, "guests"),
        name,
        phone,
        attending,
        responses,
        table_no: tableNo,
        updated_at: new Date().toISOString()
      });
    }
    saveStore(store);
    redirect(res, "/admin/guests");
    return;
  }

  if (req.method === "POST" && pathname === "/admin/guests/clear") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const store = loadStore();
    store.guests = [];
    store.checkins = [];
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
    const invitationFields = getInvitationFields(store);
    const id = Number(guestUpdateMatch[1]);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const attendees = String(body.attendees || "").trim();
    const attending = parseAttendingValue(body.attending);
    const tableNo = getValidTableNo(body.table_no, store.tables);
    const responses = collectInvitationFieldResponses(invitationFields, body);
    responses.attendees = attendees;
    const missingFields = getMissingGuestFieldLabels(
      {
        name,
        phone,
        attendees,
        attending,
        responses
      },
      invitationFields
    );
    if (missingFields.length) {
      const message = encodeURIComponent(
        `请填写必填项：${missingFields.join("、")}。`
      );
      const returnTo = (body.return_to || "").trim();
      const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
      redirect(res, `/admin/guests?error=${message}&error_guest=${id}${hash}`);
      return;
    }
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
            name: name || guest.name,
            phone: phone || guest.phone,
            table_no: tableNo,
            attending,
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
    const hash = returnTo ? `#${encodeURIComponent(returnTo)}` : "";
    redirect(res, `/admin/guests${hash}`);
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
    const totalAttendees = (store.guests || []).reduce(
      (sum, guest) =>
        sum + getGuestPartySizeFromResponses(guest.responses || {}),
      0
    );
    const checkedInAttendees = checkedInGuests.reduce(
      (sum, guest) => sum + parsePartySize(guest.checkin?.actual_attendees),
      0
    );
    const baseUrl = getQrBaseUrl(req, store.settings);
    const checkinUrl = `${baseUrl}/checkin`;
    sendResponse(
      res,
      200,
      renderAdminCheckins({
        checkinUrl,
        totalGuests: totalAttendees,
        checkedInCount: checkedInAttendees,
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
      syncGuestAttendeesWithCheckin(guest, actualAttendees);
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
    syncGuestAttendeesWithCheckin(guest, actualAttendees);
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
    store.guests = store.guests.map((guest) => {
      if (guest.id !== id) return guest;
      const updatedGuest = { ...guest, table_no: tableNo };
      syncGuestAttendeesWithCheckin(updatedGuest, actualAttendees);
      updatedGuest.updated_at = new Date().toISOString();
      return updatedGuest;
    });
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
    const invitationFields = getInvitationFields(store);
    const submitted = url.searchParams.get("submitted");
    const submittedGuest = {
      name: String(url.searchParams.get("guest_name") || "").trim(),
      phone: String(url.searchParams.get("guest_phone") || "").trim(),
      attendees: String(url.searchParams.get("guest_attendees") || "").trim()
    };
    sendResponse(
      res,
      200,
      renderInvite({
        settings: store.settings,
        sections: store.invitation_sections.sort(
          (a, b) => a.sort_order - b.sort_order
        ),
        fields: invitationFields,
        submitted,
        submittedGuest
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/checkin") {
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    sendResponse(
      res,
      200,
      renderCheckin({
        settings: store.settings,
        fields: invitationFields,
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
    const selectedGuestId = Number.parseInt(body.selected_guest_id, 10) || 0;
    const actualAttendees = Math.max(
      Number.parseInt(body.actual_attendees, 10) || 1,
      1
    );
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    const formValues = {
      lookup: lookupInput,
      actual_attendees: String(actualAttendees),
      confirm_attending: confirmAttending,
      selected_guest_id: selectedGuestId > 0 ? String(selectedGuestId) : "",
      name: (body.name || "").trim(),
      phone: (body.phone || "").trim()
    };
    invitationFields.forEach((field) => {
      formValues[field.field_key] = normalizeInvitationFieldResponse(
        field,
        body[field.field_key]
      );
    });
    if (startNew) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
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
            fields: invitationFields,
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
            fields: invitationFields,
            error: "请确认到场出席状态。",
            result: null,
            prompt: null,
            formValues,
            newGuestForm: true
          })
        );
        return;
      }
      const responses = collectInvitationFieldResponses(invitationFields, body);
      responses.attendees = String(body.attendees || actualAttendees);
      const missingFields = getMissingGuestFieldLabels(
        {
          name: formValues.name,
          phone: formValues.phone,
          attendees: responses.attendees,
          attending: true,
          responses
        },
        invitationFields
      );
      if (missingFields.length) {
        sendResponse(
          res,
          200,
          renderCheckin({
            settings: store.settings,
            fields: invitationFields,
            error: `请填写必填项：${missingFields.join("、")}。`,
            result: null,
            prompt: null,
            formValues,
            newGuestForm: true
          })
        );
        return;
      }
      const guest = {
        id: nextId(store, "guests"),
        name: formValues.name,
        phone: formValues.phone,
        attending: true,
        responses,
        table_no: "",
        updated_at: new Date().toISOString()
      };
      syncGuestAttendeesWithCheckin(guest, actualAttendees);
      store.guests.push(guest);
      const checkinRecord = upsertCheckin(store, guest.id, actualAttendees);
      saveStore(store);
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
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
    const resolveGuestMatches = () => {
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
      return Array.from(matchMap.values());
    };

    const submitGuestCheckin = (guest) => {
      if (isLikelyPhone && normalizedLookup) {
        guest.phone = normalizedLookup;
      } else if (lookupInput) {
        guest.name = lookupInput;
      }
      guest.attending = true;
      syncGuestAttendeesWithCheckin(guest, actualAttendees);
      guest.updated_at = new Date().toISOString();
      const checkinRecord = upsertCheckin(store, guest.id, actualAttendees);
      saveStore(store);
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
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
    };

    if (selectedGuestId > 0) {
      if (!confirmAttending) {
        sendResponse(
          res,
          200,
          renderCheckin({
            settings: store.settings,
            fields: invitationFields,
            error: "请确认到场出席状态。",
            result: null,
            prompt: null,
            formValues,
            newGuestForm: false
          })
        );
        return;
      }
      const candidateMatches = resolveGuestMatches();
      let selectedGuest = null;
      if (candidateMatches.length) {
        selectedGuest =
          candidateMatches.find((item) => item.id === selectedGuestId) || null;
      } else if (!lookupInput) {
        selectedGuest =
          store.guests.find((item) => item.id === selectedGuestId) || null;
      }
      if (!selectedGuest) {
        sendResponse(
          res,
          200,
          renderCheckin({
            settings: store.settings,
            fields: invitationFields,
            error: "未找到你选择的来宾信息，请重新输入后再试。",
            result: null,
            prompt: null,
            formValues,
            newGuestForm: false
          })
        );
        return;
      }
      submitGuestCheckin(selectedGuest);
      return;
    }

    if (!lookupInput) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
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
          fields: invitationFields,
          error: "请确认到场出席状态。",
          result: null,
          prompt: null,
          formValues,
          newGuestForm: false
        })
      );
      return;
    }

    const uniqueMatches = resolveGuestMatches();
    if (!uniqueMatches.length) {
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
          error: null,
          result: null,
          prompt: {
            message: "未在请柬登记名单中出现，是否填写错误？若确认为新来宾可继续登记。"
          },
          formValues,
          newGuestForm: false
        })
      );
      return;
    }

    if (uniqueMatches.length > 1) {
      const disambiguationMatches = uniqueMatches.map((item) => {
        const tableNo = normalizeTableNo(item.table_no);
        const attendees = getStoredAttendeeCount(item);
        return {
          id: item.id,
          name: item.name || "",
          phone: item.phone || "",
          phone_display: maskPhoneForDisambiguation(item.phone || ""),
          meta: `${tableNo ? `桌号 ${tableNo}` : "桌号未分配"} · ${
            attendees ? `登记${attendees}位` : "登记人数未填"
          }`
        };
      });
      sendResponse(
        res,
        200,
        renderCheckin({
          settings: store.settings,
          fields: invitationFields,
          error: null,
          result: null,
          prompt: null,
          disambiguation: {
            lookup: lookupInput,
            matches: disambiguationMatches
          },
          formValues,
          newGuestForm: false
        })
      );
      return;
    }

    submitGuestCheckin(uniqueMatches[0]);
    return;
  }

  if (req.method === "POST" && pathname === "/invite/rsvp") {
    const body = await parseBody(req);
    const store = loadStore();
    const invitationFields = getInvitationFields(store);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const attendees = String(body.attendees || "").trim();
    const attending = parseAttendingValue(body.attending);
    const responses = collectInvitationFieldResponses(invitationFields, body);
    responses.attendees = attendees;
    const missingFields = getMissingGuestFieldLabels(
      {
        name,
        phone,
        attendees,
        attending,
        responses
      },
      invitationFields
    );
    if (missingFields.length) {
      sendResponse(
        res,
        400,
        `请填写必填项：${missingFields.join("、")}。`,
        "text/plain"
      );
      return;
    }
    const existing = store.guests.find((guest) => guest.phone === phone);
    if (existing) {
      existing.name = name;
      existing.attending = attending;
      existing.responses = responses;
      existing.updated_at = new Date().toISOString();
    } else {
      store.guests.push({
        id: nextId(store, "guests"),
        name,
        phone,
        attending,
        responses,
        table_no: "",
        updated_at: new Date().toISOString()
      });
    }
    saveStore(store);
    const successParams = new URLSearchParams({
      submitted: "1",
      guest_name: name,
      guest_phone: phone,
      guest_attendees: attendees
    });
    redirect(res, `/invite?${successParams.toString()}`);
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
