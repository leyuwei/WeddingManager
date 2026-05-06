const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const attendeeOptions = Array.from({ length: 20 }, (_, index) =>
  String(index + 1)
);

const normalizeAttendeeValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized || "1";
};

const toDomId = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "-");

const SITE_LOGO_ICON_PATH = "/public/assets/wm-mark.svg";

const renderFaviconLinks = () => `
    <link rel="icon" type="image/svg+xml" href="${SITE_LOGO_ICON_PATH}" />
    <link rel="apple-touch-icon" href="${SITE_LOGO_ICON_PATH}" />`;

const normalizePageCoupleName = (value) =>
  String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildPublicPageTitle = (settings, fallback) => {
  const coupleName = normalizePageCoupleName(settings?.couple_name);
  if (!coupleName) return fallback;
  return `${coupleName}｜${fallback}`;
};

const normalizeInviteRecipient = (targetGuest = {}) => ({
  name: String(targetGuest?.name || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
  title: String(targetGuest?.title || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
});

const getInviteRecipientDisplayName = (targetGuest = {}) => {
  const recipient = normalizeInviteRecipient(targetGuest);
  if (!recipient.name) return "";
  return `${recipient.name}${recipient.title || ""}`;
};

const buildInvitePageTitle = (settings, targetGuest) => {
  const baseTitle = buildPublicPageTitle(settings, "婚礼请柬");
  const recipientName = getInviteRecipientDisplayName(targetGuest);
  if (!recipientName) return baseTitle;
  return `${recipientName}专属｜${baseTitle}`;
};

const buildTargetInviteUrl = (inviteUrl, targetGuest) => {
  const recipient = normalizeInviteRecipient(targetGuest);
  if (!recipient.name) return inviteUrl;
  try {
    const parsed = new URL(inviteUrl);
    parsed.searchParams.set("target_name", recipient.name);
    if (recipient.title) {
      parsed.searchParams.set("target_title", recipient.title);
    } else {
      parsed.searchParams.delete("target_title");
    }
    return parsed.toString();
  } catch (error) {
    const params = new URLSearchParams();
    params.set("target_name", recipient.name);
    if (recipient.title) {
      params.set("target_title", recipient.title);
    }
    const joiner = inviteUrl.includes("?") ? "&" : "?";
    return `${inviteUrl}${joiner}${params.toString()}`;
  }
};

const normalizeTargetInviteRecipientsForView = (value) => {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  value.forEach((item) => {
    const name = String(item?.name || "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
    const title = String(item?.title || "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
    if (!name) return;
    const key = `${name}|${title}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ name, title });
  });
  return normalized.slice(0, 300);
};

const toTargetInviteRecipientsText = (recipients = []) =>
  normalizeTargetInviteRecipientsForView(recipients)
    .map((item) => `${item.name}${item.title ? `,${item.title}` : ""}`)
    .join("\n");

const defaultFriendlyInviteMessageTemplates = [
  "您好！谨代表我们诚挚邀请您拨冗出席婚礼，若蒙莅临，不胜荣幸。",
  "您好！诚挚邀请您见证我们的人生重要时刻，盼您光临指导。",
  "您好！一直承蒙关照，特此奉上婚礼请柬，诚邀您莅临共享喜悦。",
  "您好！在这份重要时刻，我们非常希望能当面表达感谢，诚邀您出席婚礼。"
];

const normalizeFriendlyInviteTemplatesForView = (value) => {
  const source = Array.isArray(value) ? value : defaultFriendlyInviteMessageTemplates;
  const templates = source
    .map((item) =>
      String(item || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 220)
    )
    .filter(Boolean);
  return templates.length ? templates : [...defaultFriendlyInviteMessageTemplates];
};

const hashText = (value) =>
  String(value || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

const buildFriendlyTargetInviteMessage = ({
  recipient,
  inviteUrl,
  coupleName,
  index = 0,
  templates = defaultFriendlyInviteMessageTemplates
}) => {
  const salutation = `${recipient.name}${recipient.title || ""}`;
  const safeCoupleName = String(coupleName || "").trim() || "我们";
  const safeTemplates = normalizeFriendlyInviteTemplatesForView(templates);
  const templateIndex =
    (hashText(`${recipient.name}|${recipient.title || ""}`) + index) %
    safeTemplates.length;
  const greetingTemplate = safeTemplates[templateIndex];
  const greeting = `${salutation}，${greetingTemplate.replace(/^(您好[！!，,。\s]*)/, "")}`
    .replace(/，\s*，/g, "，")
    .replace(/\s+/g, " ")
    .trim();
  const note =
    "补充说明：如果您不方便在请柬末尾直接填写出席信息，可以直接点击请柬末尾的“我不填写，已线下沟通”按钮，我们只登记您的出席姓名。";
  return `${greeting.replace("我们的婚礼", `${safeCoupleName}的婚礼`)}\n附上专属请柬链接：${inviteUrl}\n${note}`;
};

const renderPublicLogoBadge = ({
  href = "/invite",
  className = "public-site-logo"
} = {}) => `
      <a class="${escapeHtml(className)}" href="${escapeHtml(
  href
)}" aria-label="Wedding Manager">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </a>`;

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

const hexToRgbTuple = (value, fallback) => {
  const safeHex = normalizeHexColor(value, fallback).slice(1);
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const normalizeHeroNamePosition = (value, fallback = "near_message") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["near_message", "top", "center"].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const sectionBackgroundModeOptions = [
  { value: "cover", label: "铺满裁剪（当前默认）" },
  { value: "contain", label: "完整显示（可能留白）" },
  { value: "stretch", label: "拉伸填充" },
  { value: "repeat", label: "平铺重复" },
  { value: "repeat-x", label: "横向重复" },
  { value: "repeat-y", label: "纵向重复" }
];

const inviteFontOptions = [
  {
    value: "system",
    label: "系统无衬线（默认）",
    stack:
      '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
  },
  {
    value: "songti",
    label: "宋体 / Songti",
    stack:
      '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun", "NSimSun", "PMingLiU", serif'
  },
  {
    value: "zhong_song",
    label: "华文中宋",
    stack:
      '"STZhongsong", "华文中宋", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif'
  },
  {
    value: "kaiti",
    label: "楷体 / Kaiti",
    stack:
      '"Kaiti SC", "STKaiti", "KaiTi", "楷体", "LXGW WenKai", "DFKai-SB", "Noto Serif SC", serif'
  },
  {
    value: "fangsong",
    label: "仿宋 / FangSong",
    stack:
      '"STFangsong", "FangSong", "仿宋", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif'
  },
  {
    value: "heiti",
    label: "黑体 / Heiti",
    stack:
      '"PingFang SC", "Hiragino Sans GB", "Heiti SC", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif'
  },
  {
    value: "yuanti",
    label: "圆体风格",
    stack:
      '"PingFang SC", "Hiragino Sans GB", "YouYuan", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif'
  },
  {
    value: "romance",
    label: "英文字体浪漫风",
    stack:
      '"Great Vibes", "Noto Serif SC", "Songti SC", "STSong", "PingFang SC", "Microsoft YaHei", serif'
  }
];

const textAnimationOptions = [
  { value: "fade_up", label: "轻柔上浮" },
  { value: "soft_zoom", label: "淡入缩放" },
  { value: "glow_rise", label: "微光浮现" }
];

const countdownThemeOptions = [
  { value: "glass", label: "玻璃卡片" },
  { value: "romantic", label: "浪漫粉金" },
  { value: "ink", label: "墨色简约" },
  { value: "gold", label: "香槟金" }
];

const countdownPositionOptions = [
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上方居中" },
  { value: "top-right", label: "右上" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下方居中" },
  { value: "bottom-right", label: "右下" }
];

const swipeHintPositionOptions = [
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上方居中" },
  { value: "top-right", label: "右上" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下方居中（推荐）" },
  { value: "bottom-right", label: "右下" }
];

const swipeHintStyleOptions = [
  { value: "soft_glow", label: "柔光呼吸（推荐）" },
  { value: "minimal", label: "简洁细线" },
  { value: "festive_chip", label: "喜庆徽章" }
];

const festiveThemeOptions = [
  { value: "classic_red", label: "大红金喜（推荐）" },
  { value: "palace_gold", label: "宫廷鎏金" },
  { value: "garden_bloom", label: "花朝锦色" },
  { value: "champagne_waltz", label: "香槟白金（西式）" }
];

const festiveEffectStyleOptions = [
  { value: "lantern", label: "祝福徽章飘动" },
  { value: "petal", label: "花瓣飘落" },
  { value: "confetti", label: "彩屑庆典" },
  { value: "sparkle", label: "星芒闪烁" }
];

const festiveEffectIntensityOptions = [
  { value: "gentle", label: "轻柔" },
  { value: "normal", label: "标准" },
  { value: "vivid", label: "热闹" }
];

const normalizeSectionBackgroundMode = (value, fallback = "cover") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (sectionBackgroundModeOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeInviteFont = (value, fallback = "system") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (inviteFontOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const getInviteFontStack = (value, fallback = "system") => {
  const normalized = normalizeInviteFont(value, fallback);
  const matched = inviteFontOptions.find((item) => item.value === normalized);
  return matched ? matched.stack : inviteFontOptions[0].stack;
};

const normalizeTextAnimationStyle = (value, fallback = "fade_up") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (textAnimationOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeCountdownTheme = (value, fallback = "glass") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (countdownThemeOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeCountdownPosition = (value, fallback = "top-right") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (countdownPositionOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeSwipeHintPosition = (value, fallback = "bottom-center") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (swipeHintPositionOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeSwipeHintStyle = (value, fallback = "soft_glow") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (swipeHintStyleOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeFestiveTheme = (value, fallback = "classic_red") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveThemeOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeFestiveEffectStyle = (value, fallback = "lantern") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveEffectStyleOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeFestiveEffectIntensity = (value, fallback = "normal") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (festiveEffectIntensityOptions.some((item) => item.value === normalized)) {
    return normalized;
  }
  return fallback;
};

const formatDateTimeLocalInput = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return normalized;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.slice(0, 16);
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (item) => String(item).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate()
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const fallbackCountdownTarget = (settings = {}) => {
  const direct = formatDateTimeLocalInput(settings?.countdown_target_at);
  if (direct) return direct;

  const rawDate = String(settings?.wedding_date || "").trim();
  const zhMatch = rawDate.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:：](\d{2})/
  );
  if (zhMatch) {
    const pad = (item) => String(item).padStart(2, "0");
    return `${zhMatch[1]}-${pad(zhMatch[2])}-${pad(zhMatch[3])}T${pad(
      zhMatch[4]
    )}:${pad(zhMatch[5])}`;
  }

  const isoMatch = rawDate.match(
    /(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{2})/
  );
  if (isoMatch) {
    const pad = (item) => String(item).padStart(2, "0");
    return `${isoMatch[1]}-${pad(isoMatch[2])}-${pad(isoMatch[3])}T${pad(
      isoMatch[4]
    )}:${pad(isoMatch[5])}`;
  }
  return "";
};

const getSectionBackgroundModeLabel = (value) => {
  const normalized = normalizeSectionBackgroundMode(value, "cover");
  const option = sectionBackgroundModeOptions.find(
    (item) => item.value === normalized
  );
  return option ? option.label : sectionBackgroundModeOptions[0].label;
};

const getSectionBackgroundStyle = (value) => {
  const normalized = normalizeSectionBackgroundMode(value, "cover");
  if (normalized === "contain") {
    return {
      size: "contain",
      repeat: "no-repeat",
      position: "center center"
    };
  }
  if (normalized === "stretch") {
    return {
      size: "100% 100%",
      repeat: "no-repeat",
      position: "center center"
    };
  }
  if (normalized === "repeat") {
    return {
      size: "auto",
      repeat: "repeat",
      position: "left top"
    };
  }
  if (normalized === "repeat-x") {
    return {
      size: "auto",
      repeat: "repeat-x",
      position: "left center"
    };
  }
  if (normalized === "repeat-y") {
    return {
      size: "auto",
      repeat: "repeat-y",
      position: "center top"
    };
  }
  return {
    size: "cover",
    repeat: "no-repeat",
    position: "center center"
  };
};

const getCoupleNameLines = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return ["", ""];

  const lineParts = normalized
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (lineParts.length >= 2) {
    return [lineParts[0], lineParts[1]];
  }

  const separators = [
    /\s+and\s+/i,
    /\s*&\s*/,
    /\s*＆\s*/,
    /\s*和\s*/,
    /\s*与\s*/,
    /\s*\+\s*/,
    /\s*\/\s*/,
    /\s*\|\s*/,
    /\s*｜\s*/,
    /\s*,\s*/,
    /\s*，\s*/,
    /\s*、\s*/
  ];

  for (const separator of separators) {
    const parts = normalized
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(" ")];
    }
  }

  return [normalized, ""];
};

const normalizeMapLinkUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^(javascript|data|vbscript):/i.test(normalized)) return "";
  return normalized;
};

const getWeddingRouteImageUrls = (settings = {}) => {
  const rawValue = settings?.wedding_route_image_urls;
  const values = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());
  return [...new Set(values.map((item) => normalizeMapLinkUrl(item)).filter(Boolean))];
};

const buildInviteMapLinks = (settings = {}) => {
  const location = String(settings?.wedding_location || "").trim();
  const customMapUrl = normalizeMapLinkUrl(settings?.wedding_location_map_url);
  const links = [];

  if (customMapUrl) {
    links.push({
      label: "自定义地图链接",
      url: customMapUrl
    });
  }

  if (!location) return links;

  const query = encodeURIComponent(location);
  links.push(
    {
      label: "Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${query}`
    },
    {
      label: "高德地图",
      url: `https://uri.amap.com/search?keyword=${query}&src=weddingmanager&callnative=1`
    },
    {
      label: "百度地图",
      url: `https://map.baidu.com/search/${query}/`
    }
  );

  return links;
};

const renderAttendeeInput = ({
  name,
  value,
  required = false,
  form,
  dataAutoSave = false
}) => {
  const normalized = normalizeAttendeeValue(value);
  const selectId = toDomId(`attendees-select-${name}-${form || "default"}`);
  const inputId = toDomId(`attendees-input-${name}-${form || "default"}`);
  const isCustom =
    normalized && !attendeeOptions.includes(String(normalized).trim());
  return `
      <div class="attendee-picker" data-attendee-picker data-custom="${
    isCustom ? "true" : "false"
  }">
        <select id="${escapeHtml(selectId)}" data-attendee-select ${
    form ? `form="${escapeHtml(form)}"` : ""
  } ${dataAutoSave ? "data-auto-save=\"true\"" : ""}>
          ${attendeeOptions
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}" ${
                  option === normalized ? "selected" : ""
                }>${escapeHtml(option)}</option>`
            )
            .join("")}
          <option value="custom" ${isCustom ? "selected" : ""}>自定义</option>
        </select>
        <input type="number" name="${escapeHtml(
    name
  )}" id="${escapeHtml(inputId)}" min="1" value="${escapeHtml(
    normalized
  )}" class="attendee-input" ${
    form ? `form="${escapeHtml(form)}"` : ""
  } ${required ? "required" : ""} />
      </div>`;
};

const renderInviteAttendeeSelect = ({ name, value, required = false }) => {
  const normalized = normalizeAttendeeValue(value);
  return `
      <select name="${escapeHtml(name)}" class="invite-attendee-select" ${
    required ? "required" : ""
  }>
        ${attendeeOptions
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}" ${
                option === normalized ? "selected" : ""
              }>${escapeHtml(option)}</option>`
          )
          .join("")}
      </select>`;
};

const renderInviteSuccessScript = (settings, submitted, submittedGuest = {}) => {
  if (String(submitted) !== "1") return "";
  const payload = {
    coupleName: settings?.couple_name || "",
    weddingDate: settings?.wedding_date || "",
    weddingLocation: settings?.wedding_location || "",
    heroMessage: settings?.hero_message || "",
    lunarDateEnabled: settings?.lunar_date_enabled === true,
    qrForceHttps: settings?.qr_force_https !== false,
    headingFont: getInviteFontStack(settings?.invite_font_heading, "songti"),
    baseFont: getInviteFontStack(settings?.invite_font_base, "system"),
    guestName: String(submittedGuest?.name || "").trim(),
    guestPhone: String(submittedGuest?.phone || "").trim(),
    guestAttendees: String(submittedGuest?.attendees || "").trim()
  };
  return `
  (() => {
    const data = ${JSON.stringify(payload)};
    const canvas = document.getElementById("inviteCardCanvas");
    const downloadButton = document.getElementById("inviteCardDownload");
    const calendarLink = document.getElementById("inviteAddCalendar");
    const isLocalHost = (hostname) => {
      const normalized = String(hostname || "").trim().toLowerCase();
      return (
        normalized === "localhost" ||
        normalized === "127.0.0.1" ||
        normalized === "[::1]" ||
        normalized === "::1" ||
        normalized === "0.0.0.0" ||
        normalized.endsWith(".local")
      );
    };
    const resolveInviteUrl = () => {
      try {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        if (
          data.qrForceHttps &&
          !isLocalHost(url.hostname) &&
          url.protocol !== "https:"
        ) {
          url.protocol = "https:";
        }
        return url.toString();
      } catch (error) {
        try {
          const fallback = new URL("/invite", window.location.origin || "");
          if (
            data.qrForceHttps &&
            !isLocalHost(fallback.hostname) &&
            fallback.protocol !== "https:"
          ) {
            fallback.protocol = "https:";
          }
          return fallback.toString();
        } catch (nestedError) {
          return "/invite";
        }
      }
    };
    const loadImage = (url) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image-load-failed"));
        image.src = url;
      });
    const updateDownloadLink = () => {
      if (!downloadButton || !canvas) return;
      try {
        downloadButton.href = canvas.toDataURL("image/png");
        downloadButton.download = "婚礼信息卡.png";
      } catch (error) {
        downloadButton.href = "#";
      }
    };

    const pad = (value) => String(value).padStart(2, "0");
    const toIcsDate = (parts) =>
      \`\${parts.year}\${pad(parts.month)}\${pad(parts.day)}T\${pad(
        parts.hour
      )}\${pad(parts.minute)}00\`;
    const parseDate = (raw) => {
      const normalized = String(raw || "").trim();
      if (!normalized) return null;
      const match = normalized.match(
        /(\\d{4})年(\\d{1,2})月(\\d{1,2})日\\s*(\\d{1,2})[:：](\\d{2})/
      );
      if (match) {
        return {
          year: Number(match[1]),
          month: Number(match[2]),
          day: Number(match[3]),
          hour: Number(match[4]),
          minute: Number(match[5])
        };
      }
      const isoMatch = normalized.match(
        /(\\d{4})-(\\d{1,2})-(\\d{1,2})[T\\s](\\d{1,2}):(\\d{2})/
      );
      if (isoMatch) {
        return {
          year: Number(isoMatch[1]),
          month: Number(isoMatch[2]),
          day: Number(isoMatch[3]),
          hour: Number(isoMatch[4]),
          minute: Number(isoMatch[5])
        };
      }
      const parsed = new Date(normalized.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) return null;
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        hour: parsed.getHours(),
        minute: parsed.getMinutes()
      };
    };
    const toDate = (parts) =>
      new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const addHours = (parts, hours) => {
      const date = toDate(parts);
      date.setHours(date.getHours() + hours);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes()
      };
    };
    const formatLunarDate = (parts) => {
      if (!parts || !data.lunarDateEnabled) return "";
      try {
        const date = toDate(parts);
        if (Number.isNaN(date.getTime())) return "";
        const lunarText = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
          year: "numeric",
          month: "long",
          day: "numeric"
        }).format(date);
        return "农历 " + lunarText;
      } catch (error) {
        return "";
      }
    };

    const startParts =
      parseDate(data.weddingDate) ||
      addHours(
        {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: new Date().getDate(),
          hour: new Date().getHours(),
          minute: new Date().getMinutes()
        },
        24
      );
    const endParts = addHours(startParts, 2);
    const dtStart = toIcsDate(startParts);
    const dtEnd = toIcsDate(endParts);
    const dtStamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0]
      .concat("Z");
    const uid = \`wedding-\${Date.now()}@weddingmanager\`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wedding Manager//CN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      \`UID:\${uid}\`,
      \`DTSTAMP:\${dtStamp}\`,
      \`DTSTART;TZID=Asia/Shanghai:\${dtStart}\`,
      \`DTEND;TZID=Asia/Shanghai:\${dtEnd}\`,
      \`SUMMARY:\${data.coupleName || "婚礼邀请"}\`,
      \`LOCATION:\${data.weddingLocation || "婚礼现场"}\`,
      \`DESCRIPTION:\${(data.heroMessage || "诚挚邀请你出席我们的婚礼").replaceAll(
        "\\n",
        "\\\\n"
      )}\`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\\r\\n");

    if (calendarLink) {
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      calendarLink.href = url;
      calendarLink.download = "wedding-invite.ics";
    }

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      const lunarText = formatLunarDate(startParts);
      const inviteUrl = resolveInviteUrl();
      const qrCodeUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=\${encodeURIComponent(
        inviteUrl
      )}\`;
      const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };
      const clipText = (value, maxLength) => {
        const raw = String(value || "");
        return raw.length > maxLength ? raw.slice(0, maxLength) + "…" : raw;
      };
      const drawCard = (qrImage) => {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#fff5f8");
        gradient.addColorStop(1, "#f3f4ff");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#e8dfe6";
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 24, width - 48, height - 48);

        ctx.fillStyle = "#2f2a26";
        ctx.textAlign = "center";
        ctx.font = \`bold 36px \${data.headingFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        ctx.fillText(data.coupleName || "我们的婚礼", width / 2, 104);

        ctx.fillStyle = "#6c5c53";
        ctx.font = \`20px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        ctx.fillText(data.weddingDate || "", width / 2, 160);
        if (lunarText) {
          ctx.fillStyle = "#87756d";
          ctx.font = \`18px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
          ctx.fillText(lunarText, width / 2, 194);
        }
        ctx.fillStyle = "#6c5c53";
        ctx.font = \`20px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        ctx.fillText(data.weddingLocation || "", width / 2, lunarText ? 226 : 196);

        ctx.fillStyle = "#8a7a70";
        ctx.font = \`17px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        const message =
          data.heroMessage || "期待与你及亲朋的美好相聚";
        ctx.fillText(message, width / 2, lunarText ? 258 : 232);

        const guestInfoTop = lunarText ? 272 : 248;
        const guestInfoX = 64;
        const guestInfoWidth = width - 128;
        const guestInfoHeight = 156;
        ctx.save();
        roundRect(guestInfoX, guestInfoTop, guestInfoWidth, guestInfoHeight, 18);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.shadowColor = "rgba(110, 88, 96, 0.12)";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();

        const qrSize = 110;
        const qrPadding = 8;
        const qrWrapSize = qrSize + qrPadding * 2;
        const qrWrapX = guestInfoX + guestInfoWidth - 24 - qrWrapSize;
        const qrWrapY = guestInfoTop + 24;
        const qrX = qrWrapX + qrPadding;
        const qrY = qrWrapY + qrPadding;
        const qrCenterX = qrWrapX + qrWrapSize / 2;
        const infoX = guestInfoX + 28;
        const infoWidth = qrWrapX - infoX - 20;
        const guestInfo = [
          {
            label: "来宾姓名",
            value: clipText(data.guestName || "已登记来宾", 12)
          },
          { label: "出席人数", value: clipText(data.guestAttendees || "-", 12) },
          {
            label: "手机号",
            value: clipText(data.guestPhone || "-", 16)
          }
        ];

        ctx.beginPath();
        ctx.strokeStyle = "rgba(197, 174, 182, 0.55)";
        ctx.lineWidth = 1;
        ctx.moveTo(qrWrapX - 16, guestInfoTop + 18);
        ctx.lineTo(qrWrapX - 16, guestInfoTop + guestInfoHeight - 18);
        ctx.stroke();

        guestInfo.forEach((item, index) => {
          const rowY = guestInfoTop + 52 + index * 34;
          if (index > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(205, 186, 193, 0.35)";
            ctx.lineWidth = 1;
            ctx.moveTo(infoX, rowY - 18);
            ctx.lineTo(infoX + infoWidth, rowY - 18);
            ctx.stroke();
          }
          ctx.textAlign = "left";
          ctx.fillStyle = "#8f7a72";
          ctx.font = \`15px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
          ctx.fillText(item.label, infoX, rowY);
          ctx.textAlign = "right";
          ctx.fillStyle = "#4b3c33";
          ctx.font = \`bold 20px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
          ctx.fillText(item.value, infoX + infoWidth, rowY);
        });

        ctx.textAlign = "center";
        ctx.fillStyle = "#8f7a72";
        ctx.font = \`14px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        ctx.fillText("扫码回到请柬", qrCenterX, guestInfoTop + 20);

        ctx.save();
        roundRect(qrWrapX, qrWrapY, qrWrapSize, qrWrapSize, 14);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "rgba(189, 169, 160, 0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        if (qrImage) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
          ctx.imageSmoothingEnabled = true;
        } else {
          ctx.strokeStyle = "rgba(197, 174, 182, 0.8)";
          ctx.lineWidth = 1;
          ctx.strokeRect(qrX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);
          ctx.fillStyle = "#aa968d";
          ctx.font = \`13px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
          ctx.fillText("二维码加载中", qrCenterX, qrWrapY + qrWrapSize / 2 + 4);
        }

        ctx.fillStyle = "#b7a6a0";
        ctx.font = \`15px \${data.baseFont || "'Inter', 'PingFang SC', sans-serif"}\`;
        ctx.fillText("Wedding Manager", width / 2, height - 36);
      };

      drawCard(null);
      updateDownloadLink();

      loadImage(qrCodeUrl)
        .then((qrImage) => {
          drawCard(qrImage);
          updateDownloadLink();
        })
        .catch(() => {});
    }
  })();
`;
};

const renderFestiveLayerScript = ({
  cornerContainerId = "festiveCornerGroup",
  particleContainerId = "festiveParticles"
} = {}) => `
    (() => {
      const body = document.body;
      if (!body) return;
      const cornerContainer = document.getElementById(${JSON.stringify(
        cornerContainerId
      )});
      const particleContainer = document.getElementById(${JSON.stringify(
        particleContainerId
      )});
      const themeValues = [
        "classic_red",
        "palace_gold",
        "garden_bloom",
        "champagne_waltz"
      ];
      const styleValues = ["lantern", "petal", "confetti", "sparkle"];
      const themeKeyRaw = String(body.dataset.festiveTheme || "classic_red")
        .trim()
        .toLowerCase();
      const styleKeyRaw = String(body.dataset.festiveEffectStyle || "lantern")
        .trim()
        .toLowerCase();
      const intensityKeyRaw = String(
        body.dataset.festiveEffectIntensity || "normal"
      )
        .trim()
        .toLowerCase();
      const themeKey = themeValues.includes(themeKeyRaw)
        ? themeKeyRaw
        : "classic_red";
      const styleKey = styleValues.includes(styleKeyRaw)
        ? styleKeyRaw
        : "lantern";
      const countMap = { gentle: 10, normal: 16, vivid: 24 };
      const durationMap = { gentle: 16, normal: 13, vivid: 10 };
      const particleCount = countMap[intensityKeyRaw] || countMap.normal;
      const baseDuration = durationMap[intensityKeyRaw] || durationMap.normal;
      const cornerMap = {
        classic_red: [
          { side: "left", text: "囍", variant: "is-cn-seal" },
          { side: "right", text: "囍", variant: "is-cn-seal" }
        ],
        palace_gold: [
          { side: "left", text: "瑞", variant: "is-cn-seal" },
          { side: "right", text: "禧", variant: "is-cn-seal" }
        ],
        garden_bloom: [
          { side: "left", text: "❀", variant: "is-floral" },
          { side: "right", text: "❁", variant: "is-floral" }
        ],
        champagne_waltz: [
          { side: "left", text: "✦", variant: "is-western" },
          { side: "right", text: "♡", variant: "is-western" }
        ]
      };
      if (cornerContainer) {
        cornerContainer.innerHTML = "";
        const corners = cornerMap[themeKey] || cornerMap.classic_red;
        corners.forEach((item) => {
          const node = document.createElement("span");
          node.className = (
            "festive-corner festive-corner-" +
            item.side +
            " " +
            (item.variant || "")
          ).trim();
          node.textContent = item.text;
          cornerContainer.appendChild(node);
        });
      }
      if (!particleContainer) return;
      if (body.dataset.festiveEffectEnabled !== "true") return;
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const symbolMap = {
        classic_red: {
          lantern: ["囍", "福", "禧"],
          petal: ["✿", "❀", "❁"],
          confetti: ["●", "◆", "■"],
          sparkle: ["✦", "✧", "★"]
        },
        palace_gold: {
          lantern: ["瑞", "禧", "锦"],
          petal: ["✽", "❀", "✿"],
          confetti: ["◆", "■", "●"],
          sparkle: ["✦", "✧", "✶"]
        },
        garden_bloom: {
          lantern: ["❀", "❁", "❃"],
          petal: ["✿", "❀", "❁"],
          confetti: ["●", "◆", "■"],
          sparkle: ["✦", "✧", "✶"]
        },
        champagne_waltz: {
          lantern: ["♡", "✦", "❦"],
          petal: ["❁", "✽", "✿"],
          confetti: ["●", "◆", "■"],
          sparkle: ["✦", "✧", "★"]
        }
      };
      const sizeMap = { lantern: 24, petal: 20, confetti: 14, sparkle: 16 };
      const themeSymbolMap = symbolMap[themeKey] || symbolMap.classic_red;
      const symbols = themeSymbolMap[styleKey] || themeSymbolMap.lantern;
      const baseSize = sizeMap[styleKey] || sizeMap.lantern;
      particleContainer.innerHTML = "";
      for (let index = 0; index < particleCount; index += 1) {
        const node = document.createElement("span");
        node.className = (
          "festive-particle festive-particle-" + styleKey
        ).trim();
        node.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        node.style.setProperty(
          "--particle-x",
          String(Math.round(Math.random() * 100)) + "%"
        );
        node.style.setProperty(
          "--particle-drift",
          String(Math.round(Math.random() * 90 - 45)) + "px"
        );
        node.style.setProperty(
          "--particle-size",
          (baseSize + Math.random() * 10).toFixed(1) + "px"
        );
        node.style.setProperty(
          "--particle-duration",
          (baseDuration + Math.random() * 8).toFixed(2) + "s"
        );
        node.style.setProperty(
          "--particle-delay",
          (-Math.random() * (baseDuration + 6)).toFixed(2) + "s"
        );
        node.style.setProperty(
          "--particle-rotate",
          String(Math.round(Math.random() * 360 - 180)) + "deg"
        );
        node.style.setProperty(
          "--particle-opacity",
          (0.35 + Math.random() * 0.4).toFixed(2)
        );
        node.style.setProperty(
          "--particle-hue",
          String(Math.round(Math.random() * 36 + 2))
        );
        particleContainer.appendChild(node);
      }
    })();
`;

const attendeePickerScript = `
  (() => {
    const pickers = Array.from(
      document.querySelectorAll("[data-attendee-picker]")
    );
    if (!pickers.length) return;
    const syncPicker = (picker, selectedValue) => {
      const select = picker.querySelector("[data-attendee-select]");
      const input = picker.querySelector(".attendee-input");
      if (!select || !input) return;
      if (selectedValue === "custom") {
        picker.dataset.custom = "true";
        if (!input.value) input.value = "21";
        input.focus();
        return;
      }
      picker.dataset.custom = "false";
      if (selectedValue) {
        input.value = selectedValue;
      }
    };
    pickers.forEach((picker) => {
      const select = picker.querySelector("[data-attendee-select]");
      if (!select) return;
      select.addEventListener("change", (event) => {
        syncPicker(picker, event.target.value);
      });
      const selected = select.value;
      syncPicker(picker, selected);
    });
  })();
`;

const renderAttendingSelect = ({ name, value, required = false, form }) => {
  const isAttending = Boolean(value);
  return `
      <select class="attendee-show-or-not-select" name="${escapeHtml(name)}" ${
    form ? `form="${escapeHtml(form)}"` : ""
  } ${required ? "required" : ""}>
        <option value="yes" ${isAttending ? "selected" : ""}>出席</option>
        <option value="no" ${!isAttending ? "selected" : ""}>不出席</option>
      </select>`;
};

const customFieldTypeLabels = {
  text: "文本",
  textarea: "多行文本",
  select: "下拉选择",
  date: "日期",
  checkbox: "复选框",
  radio: "单选"
};

const builtInGuestFields = [
  {
    field_key: "name",
    label: "姓名",
    field_type: "text",
    required: true,
    is_builtin: true
  },
  {
    field_key: "phone",
    label: "手机号",
    field_type: "text",
    required: true,
    is_builtin: true
  },
  {
    field_key: "attendees",
    label: "出席人数",
    field_type: "select",
    required: true,
    is_builtin: true
  },
  {
    field_key: "attending",
    label: "出席情况",
    field_type: "select",
    required: true,
    is_builtin: true
  }
];

const builtInGuestFieldKeys = builtInGuestFields.map((field) => field.field_key);

const normalizeGuestFieldOrder = ({ settings, fields }) => {
  const customKeys = (fields || [])
    .map((field) => String(field.field_key || "").trim())
    .filter(Boolean);
  const allowed = new Set([...builtInGuestFieldKeys, ...customKeys]);
  const rawOrder = Array.isArray(settings?.invitation_guest_field_order)
    ? settings.invitation_guest_field_order
    : String(settings?.invitation_guest_field_order || "")
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

const getOrderedGuestCollectionFields = ({ settings, fields }) => {
  const orderKeys = normalizeGuestFieldOrder({ settings, fields });
  const builtInMap = new Map(
    builtInGuestFields.map((field) => [field.field_key, { ...field }])
  );
  const customMap = new Map(
    (fields || []).map((field) => [field.field_key, { ...field, is_builtin: false }])
  );
  return orderKeys
    .map((key) => builtInMap.get(key) || customMap.get(key))
    .filter(Boolean);
};

const getFieldTypeLabel = (field) => {
  if (field?.is_builtin) {
    if (field.field_key === "attendees") return "内置选择";
    if (field.field_key === "attending") return "内置选择";
    return "内置文本";
  }
  return getCustomFieldTypeLabel(field);
};

const normalizeCustomFieldType = (field) => {
  const rawType = String(field?.field_type || "")
    .trim()
    .toLowerCase();
  return customFieldTypeLabels[rawType] ? rawType : "text";
};

const getCustomFieldTypeLabel = (field) =>
  customFieldTypeLabels[normalizeCustomFieldType(field)] || "文本";

const getCustomFieldOptions = (field) =>
  String(field?.options || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeCheckboxValues = (value) => {
  const rawValues = Array.isArray(value) ? value : [value];
  return [...new Set(
    rawValues
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  )];
};

const isSingleCheckboxChecked = (values) =>
  (values || []).some((item) =>
    ["1", "true", "yes", "on"].includes(String(item).toLowerCase())
  );

const renderCustomFieldControl = ({ field, value = "", form }) => {
  const fieldType = normalizeCustomFieldType(field);
  const fieldName = escapeHtml(field.field_key || "");
  const requiredAttr = field.required ? "required" : "";
  const formAttr = form ? `form="${escapeHtml(form)}"` : "";
  const valueText = Array.isArray(value) ? value.join(",") : String(value || "");

  if (fieldType === "textarea") {
    return `<textarea name="${fieldName}" rows="2" ${formAttr} ${requiredAttr}>${escapeHtml(
      valueText
    )}</textarea>`;
  }

  if (fieldType === "select") {
    const options = getCustomFieldOptions(field)
      .map((option) => {
        const escaped = escapeHtml(option);
        const selected = option === valueText ? "selected" : "";
        return `<option value="${escaped}" ${selected}>${escaped}</option>`;
      })
      .join("");
    return `<select name="${fieldName}" ${formAttr} ${requiredAttr}>
      <option value="">请选择</option>
      ${options}
    </select>`;
  }

  if (fieldType === "date") {
    return `<input type="date" name="${fieldName}" value="${escapeHtml(
      valueText
    )}" ${formAttr} ${requiredAttr} />`;
  }

  if (fieldType === "radio") {
    const options = getCustomFieldOptions(field);
    const selectedValue = Array.isArray(value)
      ? String(value[value.length - 1] || "").trim()
      : valueText;
    if (!options.length) {
      return `<p class="muted">请先配置单选项。</p>`;
    }
    return `<div class="radio-group">
      ${options
        .map((option) => {
          const escaped = escapeHtml(option);
          const checked = option === selectedValue ? "checked" : "";
          return `<label class="radio-option">
            <input type="radio" name="${fieldName}" value="${escaped}" ${formAttr} ${requiredAttr} ${checked} />
            <span>${escaped}</span>
          </label>`;
        })
        .join("")}
    </div>`;
  }

  if (fieldType === "checkbox") {
    const options = getCustomFieldOptions(field);
    const selectedValues = normalizeCheckboxValues(value);
    if (!options.length) {
      return `<label class="checkbox-option checkbox-single">
        <input type="checkbox" name="${fieldName}" value="1" ${formAttr} ${
        isSingleCheckboxChecked(selectedValues) ? "checked" : ""
      } />
        <span>已确认</span>
      </label>`;
    }
    return `<div class="checkbox-group">
      ${options
        .map((option) => {
          const escaped = escapeHtml(option);
          const checked = selectedValues.includes(option) ? "checked" : "";
          return `<label class="checkbox-option">
            <input type="checkbox" name="${fieldName}" value="${escaped}" ${formAttr} ${checked} />
            <span>${escaped}</span>
          </label>`;
        })
        .join("")}
    </div>`;
  }

  return `<input type="text" name="${fieldName}" value="${escapeHtml(
    valueText
  )}" ${formAttr} ${requiredAttr} />`;
};

const renderCustomFieldInput = ({ field, value = "", form, fullWidth = false }) => {
  const fieldType = normalizeCustomFieldType(field);
  const classes = [];
  if (fullWidth) classes.push("full");
  if (["checkbox", "radio"].includes(fieldType)) classes.push("checkbox-field");
  const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
  if (["checkbox", "radio"].includes(fieldType)) {
    return `<div${classAttr}>
    <div class="field-label-line">
      <span>${escapeHtml(field.label || "")}</span>
      ${field.required ? `<span class="required-badge">必填</span>` : ""}
    </div>
    ${renderCustomFieldControl({ field, value, form })}
  </div>`;
  }
  return `<label${classAttr}>
    <span class="field-label-line">
      <span>${escapeHtml(field.label || "")}</span>
      ${field.required ? `<span class="required-badge">必填</span>` : ""}
    </span>
    ${renderCustomFieldControl({ field, value, form })}
  </label>`;
};

const formatCustomFieldValue = (field, value) => {
  const fieldType = normalizeCustomFieldType(field);
  if (fieldType === "checkbox") {
    const options = getCustomFieldOptions(field);
    const selectedValues = normalizeCheckboxValues(value);
    if (!selectedValues.length) return "";
    if (!options.length) {
      return isSingleCheckboxChecked(selectedValues) ? "已勾选" : "";
    }
    const optionSet = new Set(options);
    const selected = selectedValues.filter((item) => optionSet.has(item));
    return selected.join("、");
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("、");
  }
  return String(value || "").trim();
};

const getAttendeeLabel = (guest) => {
  const rawValue = guest?.responses?.attendees;
  if (!rawValue) return null;
  const normalized = String(rawValue).trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed) || parsed < 2) return null;
  return normalized;
};

const getCompanionLabel = (guest) => {
  const attendeeLabel = getAttendeeLabel(guest);
  if (!attendeeLabel) return null;
  return `携亲朋${attendeeLabel}位`;
};

const formatGuestDisplayName = (guest) => {
  const name = guest?.name || "";
  const companionLabel = getCompanionLabel(guest);
  if (!companionLabel) return name;
  return `${name} ${companionLabel}`;
};

const adminLayout = (title, body) => `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body>
    <header class="top-bar">
      <div class="brand">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </div>
    <nav class="nav-links">
      <a href="/admin">仪表盘</a>
      <a href="/admin/invitation">请柬设计</a>
      <a href="/admin/guests">来宾管理</a>
      <a href="/admin/checkins">现场签到</a>
      <a href="/admin/seat-cards">席位牌</a>
      <a href="/admin/lottery">现场摇奖</a>
      <a href="/admin/ledger">流水</a>
      <a href="/admin/admins">管理员</a>
      <a href="/admin/logout">退出</a>
    </nav>
  </header>
    <main class="container">
      ${body}
    </main>
    <script>
      ${attendeePickerScript}
    </script>
  </body>
</html>
`;

const renderLogin = (error) => `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>管理员登录</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="auth-body">
    <div class="auth-card">
      <div class="auth-brand">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </div>
      <h1>婚礼后台登录</h1>
      <p class="muted">默认账号：admin / admin123</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
      <form method="post" action="/admin/login" class="form-stack">
        <label>
          账号
          <input type="text" name="username" required />
        </label>
        <label>
          密码
          <input type="password" name="password" required />
        </label>
        <button type="submit" class="btn primary">进入管理台</button>
      </form>
    </div>
  </body>
</html>
`;

const renderTargetInviteImageDownloadScript = (
  buttonSelector = "[data-download-target-image='true']"
) => `
      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("image-load-failed"));
          image.src = url;
        });
      const drawRoundedRect = (ctx, x, y, width, height, radius) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };
      const wrapCanvasText = (ctx, text, maxWidth) => {
        const chars = Array.from(String(text || ""));
        const lines = [];
        let current = "";
        chars.forEach((char) => {
          const candidate = current + char;
          if (ctx.measureText(candidate).width > maxWidth && current) {
            lines.push(current);
            current = char;
            return;
          }
          current = candidate;
        });
        if (current) lines.push(current);
        return lines;
      };
      document.querySelectorAll("${buttonSelector}").forEach((button) => {
        button.addEventListener("click", async () => {
          const targetName = String(button.dataset.targetName || "").trim();
          const targetTitle = String(button.dataset.targetTitle || "").trim();
          const inviteUrlValue = String(button.dataset.targetUrl || "").trim();
          const coupleName = String(button.dataset.targetCouple || "").trim();
          const weddingDate = String(button.dataset.targetDate || "").trim();
          const weddingLocation = String(button.dataset.targetLocation || "").trim();
          const backgroundColor = String(button.dataset.targetBg || "#7b1f2f").trim();
          if (!targetName || !inviteUrlValue) return;
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = "正在生成...";
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 1125;
            canvas.height = 2000;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("canvas-not-supported");
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, "rgba(255,255,255,0.08)");
            gradient.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            drawRoundedRect(ctx, 84, 84, canvas.width - 168, canvas.height - 168, 42);
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fill();
            ctx.restore();

            ctx.textAlign = "center";
            ctx.fillStyle = "#ffffff";
            ctx.font = "600 54px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText("专属定向请柬", canvas.width / 2, 220);

            ctx.font = "500 72px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText("诚挚邀请", canvas.width / 2, 380);

            ctx.font = "800 92px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            const guestLines = wrapCanvasText(
              ctx,
              targetName + targetTitle,
              canvas.width - 240
            );
            guestLines.forEach((line, index) => {
              ctx.fillText(line, canvas.width / 2, 510 + index * 110);
            });

            const infoStartY = 510 + guestLines.length * 110 + 40;
            ctx.font = "500 56px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText("见证我们的幸福时刻", canvas.width / 2, infoStartY);

            ctx.save();
            drawRoundedRect(ctx, 120, infoStartY + 110, canvas.width - 240, 420, 36);
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = backgroundColor;
            ctx.font = "700 62px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText(coupleName || "新人姓名", canvas.width / 2, infoStartY + 210);

            ctx.font = "600 40px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillStyle = "#53333c";
            ctx.fillText("婚礼时间", canvas.width / 2, infoStartY + 300);
            ctx.font = "500 38px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText(weddingDate || "待设置婚礼时间", canvas.width / 2, infoStartY + 355);

            ctx.font = "600 40px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText("婚礼地点", canvas.width / 2, infoStartY + 440);
            ctx.font = "500 38px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            const locationLines = wrapCanvasText(
              ctx,
              weddingLocation || "待设置婚礼地点",
              canvas.width - 320
            );
            locationLines.slice(0, 2).forEach((line, index) => {
              ctx.fillText(line, canvas.width / 2, infoStartY + 495 + index * 48);
            });

            const qrSize = 420;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = canvas.height - 650;
            ctx.save();
            drawRoundedRect(ctx, qrX - 26, qrY - 26, qrSize + 52, qrSize + 52, 28);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.restore();

            const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=0&data=" +
              encodeURIComponent(inviteUrlValue);
            const qrImage = await loadImage(qrCodeUrl);
            ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

            ctx.fillStyle = "#ffffff";
            ctx.font = "600 34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
            ctx.fillText("扫码查看完整请柬", canvas.width / 2, canvas.height - 150);

            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = (targetName + (targetTitle || "") + "-专属邀请图.png")
              .replace(/[\\\\/:*?\\"<>|]/g, "-");
            link.click();
            button.textContent = "已下载";
          } catch (error) {
            button.textContent = "生成失败";
          } finally {
            window.setTimeout(() => {
              button.disabled = false;
              button.textContent = originalText || "下载邀请图";
            }, 1200);
          }
        });
      });
`;

const renderTargetInviteCollaborator = ({
  settings,
  inviteUrl,
  collabUrl,
  authenticated = false,
  disabled = false,
  error = "",
  generatedRecipient = null,
  generatedInviteUrl = "",
  generatedMessage = ""
}) => {
  const coupleName = normalizePageCoupleName(settings?.couple_name) || "婚礼请柬";
  const targetInviteIntroBgColor = normalizeHexColor(
    settings?.target_invite_intro_bg_color,
    "#7b1f2f"
  );
  const recipient = normalizeInviteRecipient(generatedRecipient || {});
  const recipientDisplayName = getInviteRecipientDisplayName(recipient);
  const hasGeneratedResult = Boolean(
    recipient.name && generatedInviteUrl && generatedMessage
  );
  if (!authenticated) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>协同邀请登录</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="auth-body">
    <div class="auth-card collab-auth-card">
      <div class="auth-brand">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </div>
      <h1>协同邀请入口</h1>
      <p class="muted">${
        disabled
          ? "管理员尚未启用该协同入口，请联系管理员先设置协同密码。"
          : `输入协同密码后，即可为 ${escapeHtml(coupleName)} 生成专属邀请消息与邀请图。`
      }</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
      ${
        disabled
          ? `<div class="form-stack">
              <a class="btn ghost" href="${escapeHtml(inviteUrl)}" target="_blank">打开公开请柬</a>
            </div>`
          : `<form method="post" action="/invite/collab/login" class="form-stack">
              <label>
                协同密码
                <input type="password" name="password" required />
              </label>
              <button type="submit" class="btn primary">登录协同邀请页</button>
            </form>`
      }
    </div>
  </body>
</html>`;
  }
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(coupleName)}｜协同邀请</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="collab-body">
    <header class="top-bar">
      <a class="brand collab-brand-link" href="${escapeHtml(collabUrl)}">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </a>
      <div class="section-actions">
        <a class="btn ghost" href="${escapeHtml(inviteUrl)}" target="_blank">查看公开请柬</a>
        <a class="btn ghost" href="/invite/collab/logout">退出</a>
      </div>
    </header>
    <main class="container collab-container">
      <section class="card collab-hero-card" style="--collab-accent:${escapeHtml(
        targetInviteIntroBgColor
      )};">
        <div class="collab-hero-head">
          <div>
            <h1>协同专属请柬发送</h1>
            <p class="muted">只填写待发送人的名字和称呼，即可生成邀请消息与邀请图片。</p>
          </div>
          <span class="tag">仅限协同邀请</span>
        </div>
        ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
        <form method="post" action="/invite/collab/generate" class="form-grid">
          <label>
            待发送人名字
            <input type="text" name="target_name" value="${escapeHtml(
              recipient.name
            )}" required />
          </label>
          <label>
            称呼（可选）
            <input type="text" name="target_title" value="${escapeHtml(
              recipient.title
            )}" />
          </label>
          <div class="inline-actions">
            <button class="btn primary" type="submit">生成邀请内容</button>
          </div>
        </form>
      </section>
      <section class="card">
        <div class="section-header">
          <div>
            <h2>生成结果</h2>
            <p class="muted">${
              hasGeneratedResult
                ? `已为 ${escapeHtml(recipientDisplayName)} 生成专属邀请内容。`
                : "登录后在上方填写名字和称呼，即可生成可直接发送的邀请话术和邀请图片。"
            }</p>
          </div>
          ${
            hasGeneratedResult
              ? `<span class="tag">${escapeHtml(recipientDisplayName)}</span>`
              : ""
          }
        </div>
        ${
          hasGeneratedResult
            ? `<div class="form-stack">
                <label>
                  专属请柬链接
                  <textarea class="collab-result-textarea" rows="3" readonly>${escapeHtml(
                    generatedInviteUrl
                  )}</textarea>
                </label>
                <label>
                  邀请消息
                  <textarea class="collab-result-textarea" rows="8" readonly>${escapeHtml(
                    generatedMessage
                  )}</textarea>
                </label>
                <div class="inline-actions">
                  <button class="btn ghost" type="button" data-copy-target-link="${escapeHtml(
                    generatedInviteUrl
                  )}">复制链接</button>
                  <button class="btn ghost" type="button" data-copy-target-link="${escapeHtml(
                    generatedMessage
                  )}">复制消息</button>
                  <a class="btn ghost" href="${escapeHtml(
                    generatedInviteUrl
                  )}" target="_blank">打开专属请柬</a>
                  <button class="btn primary" type="button" data-download-target-image="true" data-target-name="${escapeHtml(
                    recipient.name
                  )}" data-target-title="${escapeHtml(
                    recipient.title
                  )}" data-target-url="${escapeHtml(
                    generatedInviteUrl
                  )}" data-target-couple="${escapeHtml(
                    settings?.couple_name || ""
                  )}" data-target-date="${escapeHtml(
                    settings?.wedding_date || ""
                  )}" data-target-location="${escapeHtml(
                    settings?.wedding_location || ""
                  )}" data-target-bg="${escapeHtml(
                    targetInviteIntroBgColor
                  )}">下载邀请图</button>
                </div>
              </div>`
            : `<p class="muted">该页面不会展示后台其他内容，也不会暴露名单、模板管理等配置，只保留协同发送所需的最小能力。</p>`
        }
      </section>
    </main>
    <script>
      document.querySelectorAll("[data-copy-target-link]").forEach((button) => {
        button.addEventListener("click", async () => {
          const payload = String(button.getAttribute("data-copy-target-link") || "");
          if (!payload) return;
          const originalText = button.textContent;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(payload);
            } else {
              const temp = document.createElement("textarea");
              temp.value = payload;
              document.body.appendChild(temp);
              temp.select();
              document.execCommand("copy");
              temp.remove();
            }
            button.textContent = "已复制";
          } catch (copyError) {
            button.textContent = "复制失败";
          } finally {
            window.setTimeout(() => {
              button.textContent = originalText || "复制";
            }, 1200);
          }
        });
      });
${renderTargetInviteImageDownloadScript()}
    </script>
  </body>
</html>`;
};

const renderDashboard = ({
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
}) => {
  const checkinProgress = registeredGuestCount
    ? Math.min(
        100,
        Math.round((checkedInGuestCount / registeredGuestCount) * 100)
      )
    : 0;
  return adminLayout(
    "仪表盘",
    `
<section class="hero">
  <div class="hero-content">
    <div>
      <h1>婚礼全流程控制中心</h1>
      <p>让每一个环节井然有序，打造极致浪漫体验。</p>
    </div>
    <div class="hero-actions">
      <a class="btn primary" href="/lottery" target="_blank">进入抽奖大屏幕</a>
      <a class="btn ghost" href="/admin/checkins">查看签到现场</a>
    </div>
  </div>
</section>

<section class="stats-grid">
  <div class="stat-card highlight">
    <h2>${registeredGuestCount}</h2>
    <p>来宾登记人数</p>
    <span class="meta">按请柬登记人数汇总</span>
  </div>
  <div class="stat-card accent">
    <h2>${checkedInGuestCount}</h2>
    <p>已签到人数</p>
    <span class="meta">现场实际签到</span>
  </div>
  <div class="stat-card">
    <h2>${pendingCheckinGuestCount}</h2>
    <p>未签到人数</p>
    <span class="meta">预计仍在途中</span>
  </div>
  <div class="stat-card soft">
    <h2>${guestInviteCount}</h2>
    <p>请柬登记份数</p>
    <span class="meta">含携伴信息</span>
  </div>
</section>

<section class="dashboard-grid">
  <div class="card dashboard-card">
    <div class="card-header">
      <div>
        <h2>扫码入口一览</h2>
        <p class="muted">点击二维码即可在新窗口模拟访问页面。</p>
      </div>
      <div class="progress-indicator">
        <span>签到进度</span>
        <strong>${checkinProgress}%</strong>
      </div>
    </div>
    <div class="progress-bar">
      <span style="width:${checkinProgress}%;"></span>
    </div>
    <div class="qr-grid">
      <div class="qr-card">
        <h3>电子请柬</h3>
        <p>发送给亲友，支持在线回执</p>
        <a class="qr-link" href="${escapeHtml(inviteUrl)}" target="_blank">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
            inviteUrl
          )}" alt="请柬二维码" />
          <span>点击打开请柬</span>
        </a>
        <div class="qr-actions">
          <a class="btn ghost" href="${escapeHtml(
            inviteUrl
          )}" target="_blank">查看请柬</a>
        </div>
      </div>
      <div class="qr-card">
        <h3>现场签到</h3>
        <p>放置签到台，现场扫码登记</p>
        <a class="qr-link" href="${escapeHtml(checkinUrl)}" target="_blank">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
            checkinUrl
          )}" alt="签到二维码" />
          <span>点击打开签到</span>
        </a>
        <div class="qr-actions">
          <a class="btn ghost" href="${escapeHtml(
            checkinUrl
          )}" target="_blank">打开签到页</a>
        </div>
      </div>
    </div>
  </div>
  <div class="card dashboard-card">
    <h2>现场运营摘要</h2>
    <p class="muted">聚焦确认、席位、抽奖等关键节点。</p>
    <div class="summary-grid">
      <div class="summary-card">
        <h3>${confirmedGuestCount}</h3>
        <p>确认出席人数</p>
        <span class="meta">${confirmedInviteCount} 份请柬已确认</span>
      </div>
      <div class="summary-card">
        <h3>${Math.max(guestInviteCount - confirmedInviteCount, 0)}</h3>
        <p>待确认请柬</p>
        <span class="meta">可提醒补充回执</span>
      </div>
      <div class="summary-card">
        <h3>${assignedTableCount}</h3>
        <p>已分配席位请柬</p>
        <span class="meta">共 ${totalTableCount} 桌</span>
      </div>
      <div class="summary-card">
        <h3>${winnerCount}</h3>
        <p>已抽出奖品</p>
        <span class="meta">共设置 ${prizeCount} 个奖品</span>
      </div>
    </div>
    <div class="quick-links">
      <a class="tile" href="/admin/guests">管理来宾信息</a>
      <a class="tile" href="/admin/checkins">现场签到管理</a>
      <a class="tile" href="/admin/seat-cards">批量打印席位牌</a>
      <a class="tile" href="/admin/lottery">现场摇奖设置</a>
    </div>
  </div>
</section>
`
  );
};

const renderAdmins = ({ admins, currentAdminId, error, success }) =>
  adminLayout(
    "管理员管理",
    `
${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
${success ? `<div class="alert" style="background:#e9f7ef;color:#2f8f5f;">${escapeHtml(success)}</div>` : ""}
<section class="card">
  <h1>管理员账户管理</h1>
  <form method="post" action="/admin/admins" class="form-grid">
    <label>
      账号名
      <input type="text" name="username" required />
    </label>
    <label>
      密码
      <input type="password" name="password" required />
    </label>
    <button class="btn primary" type="submit">新增管理员</button>
  </form>
</section>
<section class="card">
  <h2>修改我的密码</h2>
  <form method="post" action="/admin/admins/change-password" class="form-grid">
    <label>
      当前密码
      <input type="password" name="current_password" required />
    </label>
    <label>
      新密码
      <input type="password" name="new_password" required />
    </label>
    <label>
      确认新密码
      <input type="password" name="confirm_password" required />
    </label>
    <button class="btn primary" type="submit">更新密码</button>
  </form>
</section>
<section class="card">
  <h2>当前管理员</h2>
  <table class="table">
    <thead>
      <tr>
        <th>账号</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${admins
        .map(
          (admin) => `
      <tr>
        <td>${escapeHtml(admin.username)}</td>
        <td>${escapeHtml(admin.created_at)}</td>
        <td>
          ${
            admin.id === currentAdminId
              ? `<span class="muted">当前账号</span>`
              : `<form method="post" action="/admin/admins/${admin.id}/delete" class="inline-form">
            <button class="btn ghost" type="submit" onclick="return confirm('确认删除该管理员账号吗？');">删除</button>
          </form>`
          }
        </td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</section>
`
  );

const renderInvitation = ({
  settings,
  sections,
  fields,
  inviteUrl,
  targetInviteCollabUrl,
  error,
  success
}) => {
  const heroOverlayEnabled = settings?.hero_overlay_enabled !== false;
  const heroOverlayColor = normalizeHexColor(
    settings?.hero_overlay_color,
    "#000000"
  );
  const heroOverlayOpacity = clampNumber(
    settings?.hero_overlay_opacity,
    0,
    1,
    0.6
  );
  const heroTextColor = normalizeHexColor(settings?.hero_text_color, "#ffffff");
  const heroNamePosition = normalizeHeroNamePosition(
    settings?.hero_name_position,
    "near_message"
  );
  const lunarDateEnabled = settings?.lunar_date_enabled === true;
  const inviteFontBase = normalizeInviteFont(settings?.invite_font_base, "system");
  const inviteFontHeading = normalizeInviteFont(
    settings?.invite_font_heading,
    "songti"
  );
  const inviteFontCouple = normalizeInviteFont(
    settings?.invite_font_couple,
    "kaiti"
  );
  const inviteFontCountdown = normalizeInviteFont(
    settings?.invite_font_countdown,
    "heiti"
  );
  const textAnimationEnabled = settings?.text_animation_enabled !== false;
  const textAnimationStyle = normalizeTextAnimationStyle(
    settings?.text_animation_style,
    "fade_up"
  );
  const textAnimationDuration = clampNumber(
    settings?.text_animation_duration,
    0.3,
    3,
    0.9
  );
  const textAnimationStaggerMs = Math.round(
    clampNumber(settings?.text_animation_stagger_ms, 0, 500, 120)
  );
  const textAnimationRepeat = settings?.text_animation_repeat === true;
  const countdownEnabled = settings?.countdown_enabled !== false;
  const countdownShowHome = settings?.countdown_show_home !== false;
  const countdownShowSuccess = settings?.countdown_show_success !== false;
  const countdownTargetAt = formatDateTimeLocalInput(settings?.countdown_target_at);
  const countdownLabel =
    String(settings?.countdown_label || "").trim() || "婚礼倒计时";
  const countdownTheme = normalizeCountdownTheme(
    settings?.countdown_theme,
    "glass"
  );
  const countdownBgColor = normalizeHexColor(
    settings?.countdown_bg_color,
    "#ffffff"
  );
  const countdownTextColor = normalizeHexColor(
    settings?.countdown_text_color,
    "#4b3c33"
  );
  const countdownAccentColor = normalizeHexColor(
    settings?.countdown_accent_color,
    "#d68aa1"
  );
  const countdownOpacity = clampNumber(settings?.countdown_opacity, 0.2, 1, 0.9);
  const countdownHomePosition = normalizeCountdownPosition(
    settings?.countdown_home_position,
    "top-right"
  );
  const countdownSuccessPosition = normalizeCountdownPosition(
    settings?.countdown_success_position,
    "top-right"
  );
  const festiveTheme = normalizeFestiveTheme(
    settings?.festive_theme,
    "classic_red"
  );
  const festiveEffectEnabled = settings?.festive_effect_enabled !== false;
  const festiveEffectStyle = normalizeFestiveEffectStyle(
    settings?.festive_effect_style,
    "lantern"
  );
  const festiveEffectIntensity = normalizeFestiveEffectIntensity(
    settings?.festive_effect_intensity,
    "normal"
  );
  const swipeHintEnabled = settings?.swipe_hint_enabled !== false;
  const swipeHintText =
    String(settings?.swipe_hint_text || "").trim() || "上滑查看下一页";
  const swipeHintPosition = normalizeSwipeHintPosition(
    settings?.swipe_hint_position,
    "bottom-center"
  );
  const swipeHintStyle = normalizeSwipeHintStyle(
    settings?.swipe_hint_style,
    "soft_glow"
  );
  const qrForceHttps = settings?.qr_force_https !== false;
  const targetInviteRecipients = normalizeTargetInviteRecipientsForView(
    settings?.target_invite_recipients
  );
  const targetInviteFriendlyMessageEnabled =
    settings?.target_invite_friendly_message_enabled === true;
  const targetInviteIntroBgColor = normalizeHexColor(
    settings?.target_invite_intro_bg_color,
    "#7b1f2f"
  );
  const targetInviteMessageTemplates = normalizeFriendlyInviteTemplatesForView(
    settings?.target_invite_message_templates
  );
  const targetInviteCollabEnabled = Boolean(
    String(settings?.target_invite_collab_password_hash || "").trim()
  );
  const buildTargetInviteImageButton = (recipient, inviteUrlValue) =>
    `<button class="btn ghost small" type="button" data-download-target-image="true" data-target-name="${escapeHtml(
      recipient.name || ""
    )}" data-target-title="${escapeHtml(
      recipient.title || ""
    )}" data-target-url="${escapeHtml(
      inviteUrlValue
    )}" data-target-couple="${escapeHtml(
      settings?.couple_name || ""
    )}" data-target-date="${escapeHtml(
      settings?.wedding_date || ""
    )}" data-target-location="${escapeHtml(
      settings?.wedding_location || ""
    )}" data-target-bg="${escapeHtml(
      targetInviteIntroBgColor
    )}">下载邀请图</button>`;
  const targetInviteRecipientsText = toTargetInviteRecipientsText(
    targetInviteRecipients
  );
  const targetInviteDirectRecipients = targetInviteRecipients;
  const targetInviteDirectMessages = targetInviteDirectRecipients.map(
    (item, index) => {
      const itemUrl = buildTargetInviteUrl(inviteUrl, item);
      return {
        displayName: `${item.name}${item.title || ""}`,
        message: buildFriendlyTargetInviteMessage({
          recipient: item,
          inviteUrl: itemUrl,
          coupleName: settings?.couple_name,
          index,
          templates: targetInviteMessageTemplates
        })
      };
    }
  );
  const targetInviteDirectRowsHtml = targetInviteDirectMessages
    .map(
      (item, index) => `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.displayName)}</td>
      <td><textarea rows="5" readonly>${escapeHtml(item.message)}</textarea></td>
      <td>
        <button class="btn ghost small" type="button" data-copy-target-link="${escapeHtml(
          item.message
        )}">复制消息</button>
        ${buildTargetInviteImageButton(
          targetInviteDirectRecipients[index],
          buildTargetInviteUrl(inviteUrl, targetInviteDirectRecipients[index])
        )}
      </td>
    </tr>`
    )
    .join("");
  const targetInviteDirectCopyAll = targetInviteDirectMessages
    .map((item, index) => `【${index + 1}】${item.message}`)
    .join("\n\n");
  const targetInviteTemplateItemsHtml = targetInviteMessageTemplates
    .map(
      (template, index) => `<div class="list-item invitation-field-item">
      <form method="post" action="/admin/invitation/targets/templates/${index}/update" class="form-grid">
        <label class="full">
          模板 ${index + 1}
          <textarea name="template" rows="3" required>${escapeHtml(template)}</textarea>
        </label>
        <div class="inline-actions full">
          <button class="btn primary" type="submit">保存模板</button>
        </div>
      </form>
      <form method="post" action="/admin/invitation/targets/templates/${index}/delete" class="inline-form section-editor-delete">
        <button class="btn ghost" type="submit" onclick="return confirm('确认删除该话术模板吗？');">删除模板</button>
      </form>
    </div>`
    )
    .join("");
  const targetInviteRecipientCount = targetInviteRecipients.length;
  const invitationStatusHtml = `${
    error ? `<div class="alert">${escapeHtml(error)}</div>` : ""
  }${
    success
      ? `<div class="alert alert-success">${escapeHtml(success)}</div>`
      : ""
  }`;
  const targetInviteLinksDialogHtml = `<dialog class="guest-dialog invite-utility-dialog" id="targetInviteLinksDialog">
    <div class="dialog-header">
      <div>
        <strong>定向发送专用链接</strong>
        <div class="muted">逐条查看、复制邀请信息或下载邀请图。</div>
      </div>
      <button class="btn ghost small" type="button" data-dialog-close>关闭</button>
    </div>
    <div class="dialog-body invite-utility-dialog-body">
      ${
        targetInviteDirectMessages.length
          ? `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>对象</th>
                    <th>邀请信息</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>${targetInviteDirectRowsHtml}</tbody>
              </table>
            </div>`
          : `<div class="muted">请先在“专属请柬批量链接”中配置名单后再查看。</div>`
      }
    </div>
    <div class="dialog-actions">
      ${
        targetInviteDirectMessages.length
          ? `<button class="btn ghost" type="button" data-copy-target-all="${escapeHtml(
              targetInviteDirectCopyAll
            )}">复制全部邀请信息</button>`
          : ""
      }
      <button class="btn primary" type="button" data-dialog-close>完成</button>
    </div>
  </dialog>`;
  const targetInviteTemplatesDialogHtml = `<dialog class="guest-dialog invite-utility-dialog" id="targetInviteTemplatesDialog">
    <div class="dialog-header">
      <div>
        <strong>友好邀请话术模板</strong>
        <div class="muted">新增、编辑、删除模板，系统会随机套用。</div>
      </div>
      <button class="btn ghost small" type="button" data-dialog-close>关闭</button>
    </div>
    <div class="dialog-body invite-utility-dialog-body">
      <form method="post" action="/admin/invitation/targets/templates" class="form-grid">
        <label class="full">
          新增模板
          <textarea name="template" rows="3" required placeholder="示例：您好！诚挚邀请您拨冗出席我们的婚礼，盼您莅临指导。"></textarea>
        </label>
        <div class="section-editor-actions full">
          <button class="btn primary" type="submit">新增模板</button>
        </div>
      </form>
      <div class="list invitation-field-list">
        ${targetInviteTemplateItemsHtml}
      </div>
    </div>
    <div class="dialog-actions">
      <button class="btn primary" type="button" data-dialog-close>完成</button>
    </div>
  </dialog>`;
  const targetInviteCollabDialogHtml = `<dialog class="guest-dialog invite-utility-dialog" id="targetInviteCollabDialog">
    <div class="dialog-header">
      <div>
        <strong>协同其他人共同邀请</strong>
        <div class="muted">设置协同密码后，把二维码或链接发给协作者，对方登录后只能生成专属邀请消息和邀请图片。</div>
      </div>
      <button class="btn ghost small" type="button" data-dialog-close>关闭</button>
    </div>
    <div class="dialog-body invite-utility-dialog-body">
      <form method="post" action="/admin/invitation/targets/collab/save" class="form-grid">
        <label class="full">
          协同邀请密码
          <input type="password" name="target_invite_collab_password" placeholder="${
            targetInviteCollabEnabled ? "输入新密码可重新设置" : "至少 4 位，保存后启用"
          }" required />
        </label>
        <p class="muted full">密码仅以加密摘要方式保存，后台不会回显旧密码；如需更新，请直接输入新密码重新保存。</p>
        <div class="inline-actions full">
          <button class="btn primary" type="submit">保存协同密码</button>
          ${
            targetInviteCollabEnabled
              ? `<button class="btn ghost" type="submit" name="action" value="disable" formnovalidate onclick="return confirm('确认停用协同邀请吗？');">停用协同邀请</button>`
              : ""
          }
        </div>
      </form>
      ${
        targetInviteCollabEnabled
          ? `<div class="qr-grid collab-qr-grid">
              <div class="qr-card">
                <h3>协同登录二维码</h3>
                <p>协作者扫码后需先输入上方设置的协同密码。</p>
                <a class="qr-link" href="${escapeHtml(targetInviteCollabUrl)}" target="_blank">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
                    targetInviteCollabUrl
                  )}" alt="协同邀请二维码" />
                  <span>点击打开协同邀请页</span>
                </a>
                <div class="qr-actions">
                  <a class="btn ghost" href="${escapeHtml(
                    targetInviteCollabUrl
                  )}" target="_blank">打开协同页</a>
                  <button class="btn ghost" type="button" data-copy-target-link="${escapeHtml(
                    targetInviteCollabUrl
                  )}">复制链接</button>
                </div>
              </div>
            </div>`
          : `<div class="muted">保存协同密码后，这里会显示可分享的二维码和专属链接。</div>`
      }
    </div>
    <div class="dialog-actions">
      <button class="btn primary" type="button" data-dialog-close>完成</button>
    </div>
  </dialog>`;
  const orderedGuestFields = getOrderedGuestCollectionFields({ settings, fields });
  const routeImageUrls = getWeddingRouteImageUrls(settings);
  const orderedFieldKeysValue = orderedGuestFields
    .map((field) => field.field_key)
    .join(",");
  const orderedFieldOrderItemsHtml = orderedGuestFields
    .map((field) => {
      const key = escapeHtml(field.field_key || "");
      const label = escapeHtml(field.label || field.field_key || "");
      const typeLabel = escapeHtml(getFieldTypeLabel(field));
      const tag = field.is_builtin
        ? `<span class="tag">内置</span>`
        : `<span class="tag muted-tag">自定义</span>`;
      const requiredBadge = field.required
        ? `<span class="required-badge">必填</span>`
        : "";
      return `<div class="field-order-item" data-order-item draggable="true" data-field-key="${key}">
        <span class="field-order-handle" aria-hidden="true">☰</span>
        <div class="field-order-info">
          <div class="field-order-title">
            <strong>${label}</strong>
            ${tag}
            ${requiredBadge}
          </div>
          <div class="muted">key: ${key} ｜ 类型：${typeLabel}</div>
        </div>
        <div class="field-order-actions">
          <button class="btn ghost small" type="button" data-order-move="-1">上移</button>
          <button class="btn ghost small" type="button" data-order-move="1">下移</button>
        </div>
      </div>`;
    })
    .join("");
  const routeImagePreviewHtml = routeImageUrls.length
    ? `<div class="full route-image-grid">
        ${routeImageUrls
          .map(
            (url) => `<a href="${escapeHtml(
              url
            )}" target="_blank" rel="noopener noreferrer">
                  <img src="${escapeHtml(url)}" alt="路线图" loading="lazy" />
                </a>`
          )
          .join("")}
      </div>`
    : `<p class="muted full">尚未配置实景路线图。</p>`;
  const invitationFieldItemsHtml = fields
    .map((field) => {
      const options = getCustomFieldOptions(field);
      const fieldType = normalizeCustomFieldType(field);
      const needOptions = ["select", "checkbox", "radio"].includes(fieldType);
      const requiredId = `invitationFieldRequired-${field.id}`;
      return `
    <div class="list-item invitation-field-item">
      <div class="section-editor-head">
        <div class="invitation-field-title">
          <strong>${escapeHtml(field.label)}</strong>
          ${field.required ? `<span class="required-badge">必填</span>` : `<span class="muted">选填</span>`}
        </div>
        <span class="muted">字段 #${escapeHtml(field.id)} ｜ 当前类型：${escapeHtml(
        getCustomFieldTypeLabel(field)
      )}</span>
      </div>
      <form method="post" action="/admin/invitation/fields/${field.id}/update" class="form-grid invitation-field-form invitation-field-edit-form" data-field-config-form>
        <label>
          字段名称
          <input type="text" name="label" value="${escapeHtml(field.label)}" required />
        </label>
        <label>
          字段标识
          <input type="text" name="field_key" value="${escapeHtml(
            field.field_key
          )}" required />
        </label>
        <label>
          类型
          <select name="field_type" required data-field-type-select>
            <option value="text" ${fieldType === "text" ? "selected" : ""}>文本</option>
            <option value="textarea" ${fieldType === "textarea" ? "selected" : ""}>多行文本</option>
            <option value="select" ${fieldType === "select" ? "selected" : ""}>下拉选择</option>
            <option value="date" ${fieldType === "date" ? "selected" : ""}>日期</option>
            <option value="checkbox" ${fieldType === "checkbox" ? "selected" : ""}>复选框</option>
            <option value="radio" ${fieldType === "radio" ? "selected" : ""}>单选</option>
          </select>
        </label>
        <label data-options-wrap class="${needOptions ? "" : "is-disabled"}">
          选项（逗号分隔）
          <input type="text" name="options" value="${escapeHtml(
            options.join(",")
          )}" placeholder="下拉选择、单选或复选框使用，如：素食,不吃辣,海鲜过敏" ${
        needOptions ? "" : "disabled"
      } />
        </label>
        <div class="field-required-wrap">
          <label class="required-switch" for="${escapeHtml(requiredId)}">
            <span>设为必填</span>
            <input type="checkbox" id="${escapeHtml(requiredId)}" name="required" ${
        field.required ? "checked" : ""
      } />
          </label>
          <p class="muted">开启后，来宾提交时必须填写该项。</p>
        </div>
        <div class="section-editor-actions full invitation-field-actions">
          <button class="btn primary" type="submit">保存修改</button>
        </div>
      </form>
      <form method="post" action="/admin/invitation/fields/${field.id}/delete" class="inline-form section-editor-delete">
        <button class="btn ghost" type="submit" onclick="return confirm('确认删除该字段吗？');">删除</button>
      </form>
    </div>`;
    })
    .join("");
  return adminLayout(
    "请柬设计",
    `
${invitationStatusHtml}
<section class="card">
  <div class="section-header">
    <div>
      <h1>请柬链接二维码</h1>
      <p>方便管理员下载或截图，用于分享给亲友。</p>
    </div>
  </div>
  <div class="qr-grid">
    <div class="qr-card">
      <h3>电子请柬</h3>
      <p>扫码即可进入请柬页面</p>
      <a class="qr-link" href="${escapeHtml(inviteUrl)}" target="_blank">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
          inviteUrl
        )}" alt="请柬二维码" />
        <span>点击打开请柬</span>
      </a>
      <div class="qr-actions">
        <a class="btn ghost" href="${escapeHtml(
          inviteUrl
        )}" target="_blank">打开请柬</a>
        <a class="btn ghost" href="https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
          inviteUrl
        )}" download="invitation-qr.png">下载二维码</a>
      </div>
    </div>
    <div class="qr-card">
      <h3>定向发送专用链接</h3>
      <p>按专属对象逐条生成邀请信息，列表已收纳到弹窗中，主页面保持简洁。</p>
      <div class="qr-actions">
        <button class="btn ghost" type="button" data-dialog-target="targetInviteLinksDialog">查看邀请信息列表</button>
        ${
          targetInviteDirectMessages.length
            ? `<button class="btn ghost" type="button" data-copy-target-all="${escapeHtml(
                targetInviteDirectCopyAll
              )}">复制全部邀请信息</button>`
            : ""
        }
      </div>
      <p class="muted">${
        targetInviteDirectMessages.length
          ? `当前已生成 ${targetInviteDirectMessages.length} 条专属邀请信息。`
          : "请先在下方“专属请柬批量链接”中配置名单。"
      }</p>
    </div>
  </div>
</section>

<section class="card">
  <h2>专属请柬批量链接</h2>
  <p class="muted">支持手动填写或导入名单。每行格式：姓名,称呼（称呼可省略），并支持独立保存生效。</p>
  <form id="targetInviteForm" method="post" action="/admin/invitation/targets/save" class="form-grid">
    <label>
      专属首屏背景色
      <input type="color" name="target_invite_intro_bg_color" value="${escapeHtml(
        targetInviteIntroBgColor
      )}" />
    </label>
    <div class="field-required-wrap full">
      <label class="required-switch" for="targetInviteFriendlyMessageEnabled">
        <span>开启专属请柬友好消息发送模式</span>
        <input type="checkbox" id="targetInviteFriendlyMessageEnabled" name="target_invite_friendly_message_enabled" ${
          targetInviteFriendlyMessageEnabled ? "checked" : ""
        } />
      </label>
      <p class="muted">开启后，批量展示内容会自动改为“礼貌邀请话术 + 专属链接 + 线下快捷说明”，并按对象随机套用多套模板。</p>
    </div>
    <label class="full">
      批量名单（每行一个）
      <textarea id="targetInviteRecipientsText" name="target_invite_recipients_text" rows="6" placeholder="示例：&#10;张三,先生&#10;李四,女士">${escapeHtml(
        targetInviteRecipientsText
      )}</textarea>
    </label>
    <label>
      导入名单文件（.txt/.csv）
      <input type="file" id="targetInviteRecipientsFile" accept=".txt,.csv,text/plain,text/csv" />
    </label>
    <div class="inline-actions">
      <button class="btn ghost" type="button" id="targetInviteRecipientsImport">导入并追加到名单</button>
      <span class="muted" id="targetInviteRecipientsStatus">导入后记得点击“保存并生效”。</span>
    </div>
    <div class="section-editor-actions full">
      <button class="btn primary" type="submit">保存并生效</button>
    </div>
  </form>
  <div class="inline-actions">
    <button class="btn ghost" type="button" data-dialog-target="targetInviteLinksDialog">查看专属邀请信息</button>
    <button class="btn ghost" type="button" data-dialog-target="targetInviteTemplatesDialog">管理友好话术模板</button>
    <button class="btn ghost" type="button" data-dialog-target="targetInviteCollabDialog">协同其他人共同邀请</button>
  </div>
  <div class="muted">
    已配置 ${targetInviteRecipientCount} 位专属对象。
    ${
      targetInviteRecipients.length
        ? `当前模式：${targetInviteFriendlyMessageEnabled ? "友好邀请消息" : "专属链接"}。`
        : "保存名单后可在弹窗中查看详情。"
    }
    ${targetInviteCollabEnabled ? "协同邀请已启用。" : "尚未设置协同邀请密码。"}
  </div>
</section>

<section class="card">
  <h1>请柬基础信息</h1>
  <form id="invitationSettingsForm" method="post" action="/admin/invitation/settings" class="form-grid invitation-settings-form">
    <div class="full invitation-settings-group" data-settings-group="basic">
      <div class="invitation-settings-head">
        <h3>基础信息</h3>
        <p>先配置婚礼核心信息与二维码链接策略，确保对外分享口径一致。</p>
      </div>
      <div class="invitation-settings-grid">
        <label>
          新人姓名
          <input type="text" name="couple_name" value="${escapeHtml(
            settings.couple_name || ""
          )}" />
        </label>
        <label>
          婚礼日期
          <input type="text" name="wedding_date" value="${escapeHtml(
            settings.wedding_date || ""
          )}" />
        </label>
        <label class="full">
          婚礼地点
          <input type="text" name="wedding_location" value="${escapeHtml(
            settings.wedding_location || ""
          )}" />
        </label>
        <div class="field-required-wrap full">
          <label class="required-switch" for="lunarDateEnabled">
            <span>显示农历日期</span>
            <input type="checkbox" id="lunarDateEnabled" name="lunar_date_enabled" ${
              lunarDateEnabled ? "checked" : ""
            } />
          </label>
          <p class="muted">开启后，婚礼日期等时间信息会额外显示一行中国农历日期。</p>
        </div>
        <div class="field-required-wrap full">
          <label class="required-switch" for="qrForceHttps">
            <span>二维码链接强制使用 HTTPS</span>
            <input type="checkbox" id="qrForceHttps" name="qr_force_https" ${
              qrForceHttps ? "checked" : ""
            } />
          </label>
          <p class="muted">默认开启。开启后，后台与婚礼信息卡中的二维码会优先使用 https:// 域名（localhost 本地调试除外）。</p>
        </div>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="festive">
      <div class="invitation-settings-head">
        <h3>喜庆主题与动画</h3>
        <p>首页、分屏页和签到页会共用这一套视觉主题。可按中式或西式氛围切换。</p>
      </div>
      <div class="invitation-settings-grid">
        <label>
          喜庆主题风格
          <select name="festive_theme">
            ${festiveThemeOptions
              .map((option) => {
                const selected = festiveTheme === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <div class="field-required-wrap">
          <label class="required-switch" for="festiveEffectEnabled">
            <span>启用喜庆动态元素</span>
            <input type="checkbox" id="festiveEffectEnabled" name="festive_effect_enabled" ${
              festiveEffectEnabled ? "checked" : ""
            } />
          </label>
          <p class="muted">将在首页、分屏与签到页面加入漂浮装饰动画，营造更热闹的现场感。</p>
        </div>
        <label>
          动态元素样式
          <select name="festive_effect_style">
            ${festiveEffectStyleOptions
              .map((option) => {
                const selected = festiveEffectStyle === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          动画热闹程度
          <select name="festive_effect_intensity">
            ${festiveEffectIntensityOptions
              .map((option) => {
                const selected =
                  festiveEffectIntensity === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <p class="muted full">建议：移动端首选“轻柔/标准”，现场大屏可选“热闹”增强节庆氛围。</p>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="hero">
      <div class="invitation-settings-head">
        <h3>头图与视觉</h3>
        <p>决定请柬首页第一印象，包括文案、主视觉、姓名排版和遮罩可读性。</p>
      </div>
      <div class="invitation-settings-grid">
        <label class="full">
          头图文案
          <input type="text" name="hero_message" value="${escapeHtml(
            settings.hero_message || ""
          )}" />
        </label>
        <label class="full">
          头图背景图 URL
          <input type="text" id="inviteHeroImageUrl" name="hero_image_url" value="${escapeHtml(
            settings.hero_image_url || ""
          )}" />
        </label>
        <div class="full image-upload-box" data-image-upload-box data-target-input="inviteHeroImageUrl">
          <label>
            上传头图背景图
            <input type="file" accept="image/*" data-image-upload-file />
          </label>
          <div class="inline-actions">
            <button class="btn ghost" type="button" data-image-upload-button>上传并填入 URL</button>
            <span class="muted" data-image-upload-status>支持 JPG/PNG/WebP/GIF，建议横图。</span>
          </div>
        </div>
        <label>
          新人姓名位置
          <select name="hero_name_position">
            <option value="near_message" ${
              heroNamePosition === "near_message" ? "selected" : ""
            }>贴近下方文案</option>
            <option value="top" ${
              heroNamePosition === "top" ? "selected" : ""
            }>页面最上方</option>
            <option value="center" ${
              heroNamePosition === "center" ? "selected" : ""
            }>页面居中</option>
          </select>
        </label>
        <label>
          头图文字颜色
          <input type="color" name="hero_text_color" value="${escapeHtml(
            heroTextColor
          )}" />
        </label>
        <p class="muted full">可将“新人姓名”贴近文案、放在页面顶部，或置于页面中间。</p>
        <div class="field-required-wrap full">
          <label class="required-switch" for="heroOverlayEnabled">
            <span>启用头图半透明遮罩</span>
            <input type="checkbox" id="heroOverlayEnabled" name="hero_overlay_enabled" ${
              heroOverlayEnabled ? "checked" : ""
            } />
          </label>
          <p class="muted">关闭后将不再渲染遮罩层。</p>
        </div>
        <label>
          遮罩颜色
          <input type="color" name="hero_overlay_color" value="${escapeHtml(
            heroOverlayColor
          )}" />
        </label>
        <label>
          遮罩不透明度（0~1）
          <input type="number" name="hero_overlay_opacity" min="0" max="1" step="0.05" value="${escapeHtml(
            heroOverlayOpacity.toFixed(2)
          )}" />
        </label>
        <p class="muted full">当背景图较复杂或偏暗时，可开启遮罩并调节颜色与透明度，提升顶部文字可读性。</p>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="fonts">
      <div class="invitation-settings-head">
        <h3>文字字体</h3>
        <p>支持 iOS / Android 原生字库组合，可分别设置正文、标题、新人姓名和倒计时字体。</p>
      </div>
      <div class="invitation-settings-grid">
        <label>
          全局正文字体
          <select name="invite_font_base">
            ${inviteFontOptions
              .map((option) => {
                const selected = inviteFontBase === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          标题字体（分屏标题/表单标题）
          <select name="invite_font_heading">
            ${inviteFontOptions
              .map((option) => {
                const selected =
                  inviteFontHeading === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          新人姓名字体
          <select name="invite_font_couple">
            ${inviteFontOptions
              .map((option) => {
                const selected = inviteFontCouple === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          倒计时字体
          <select name="invite_font_countdown">
            ${inviteFontOptions
              .map((option) => {
                const selected =
                  inviteFontCountdown === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="text-animation">
      <div class="invitation-settings-head">
        <h3>文字动效</h3>
        <p>控制首页和分屏文案的滚动入场方式，强化请柬节奏感。</p>
      </div>
      <div class="invitation-settings-grid">
        <div class="field-required-wrap full">
          <label class="required-switch" for="textAnimationEnabled">
            <span>启用文字动效</span>
            <input type="checkbox" id="textAnimationEnabled" name="text_animation_enabled" ${
              textAnimationEnabled ? "checked" : ""
            } />
          </label>
          <label class="inline">
            <input type="checkbox" name="text_animation_repeat" ${
              textAnimationRepeat ? "checked" : ""
            } />
            滚动离开后允许再次播放动效
          </label>
        </div>
        <label>
          动效风格
          <select name="text_animation_style">
            ${textAnimationOptions
              .map((option) => {
                const selected =
                  textAnimationStyle === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          动效时长（秒）
          <input type="number" name="text_animation_duration" min="0.3" max="3" step="0.1" value="${escapeHtml(
            textAnimationDuration.toFixed(1)
          )}" />
        </label>
        <label>
          动效错峰间隔（毫秒）
          <input type="number" name="text_animation_stagger_ms" min="0" max="500" step="10" value="${escapeHtml(
            String(textAnimationStaggerMs)
          )}" />
        </label>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="swipe-hint">
      <div class="invitation-settings-head">
        <h3>首页上滑提示</h3>
        <p>在首页温和提示宾客“上滑查看下一页”，支持自定义文案、位置和样式。</p>
      </div>
      <div class="invitation-settings-grid">
        <div class="field-required-wrap full">
          <label class="required-switch" for="swipeHintEnabled">
            <span>启用上滑提示动画</span>
            <input type="checkbox" id="swipeHintEnabled" name="swipe_hint_enabled" ${
              swipeHintEnabled ? "checked" : ""
            } />
          </label>
          <p class="muted">建议保持开启，首次查看时可更自然地引导宾客浏览下一个分屏。</p>
        </div>
        <label>
          提示文案
          <input type="text" name="swipe_hint_text" value="${escapeHtml(
            swipeHintText
          )}" />
        </label>
        <label>
          提示位置
          <select name="swipe_hint_position">
            ${swipeHintPositionOptions
              .map((option) => {
                const selected =
                  swipeHintPosition === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          提示样式
          <select name="swipe_hint_style">
            ${swipeHintStyleOptions
              .map((option) => {
                const selected = swipeHintStyle === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="countdown">
      <div class="invitation-settings-head">
        <h3>倒计时配置</h3>
        <p>支持首页和提交成功页展示倒计时卡片，可自定义主题、配色、透明度和位置。</p>
      </div>
      <div class="invitation-settings-grid">
        <div class="field-required-wrap full">
          <label class="required-switch" for="countdownEnabled">
            <span>启用倒计时牌</span>
            <input type="checkbox" id="countdownEnabled" name="countdown_enabled" ${
              countdownEnabled ? "checked" : ""
            } />
          </label>
          <label class="inline">
            <input type="checkbox" name="countdown_show_home" ${
              countdownShowHome ? "checked" : ""
            } />
            首页显示倒计时牌
          </label>
          <label class="inline">
            <input type="checkbox" name="countdown_show_success" ${
              countdownShowSuccess ? "checked" : ""
            } />
            提交成功页显示倒计时牌
          </label>
        </div>
        <label>
          倒计时目标时间
          <input type="datetime-local" name="countdown_target_at" value="${escapeHtml(
            countdownTargetAt
          )}" />
        </label>
        <p class="muted full">若留空，前台会尝试根据“婚礼日期”自动解析倒计时目标时间。</p>
        <label>
          倒计时标题文案
          <input type="text" name="countdown_label" value="${escapeHtml(
            countdownLabel
          )}" />
        </label>
        <label>
          倒计时主题
          <select name="countdown_theme">
            ${countdownThemeOptions
              .map((option) => {
                const selected = countdownTheme === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          倒计时卡片不透明度（0.2~1）
          <input type="number" name="countdown_opacity" min="0.2" max="1" step="0.05" value="${escapeHtml(
            countdownOpacity.toFixed(2)
          )}" />
        </label>
        <label>
          倒计时背景色
          <input type="color" name="countdown_bg_color" value="${escapeHtml(
            countdownBgColor
          )}" />
        </label>
        <label>
          倒计时文字色
          <input type="color" name="countdown_text_color" value="${escapeHtml(
            countdownTextColor
          )}" />
        </label>
        <label>
          倒计时强调色
          <input type="color" name="countdown_accent_color" value="${escapeHtml(
            countdownAccentColor
          )}" />
        </label>
        <label>
          首页倒计时位置
          <select name="countdown_home_position">
            ${countdownPositionOptions
              .map((option) => {
                const selected =
                  countdownHomePosition === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          成功页倒计时位置
          <select name="countdown_success_position">
            ${countdownPositionOptions
              .map((option) => {
                const selected =
                  countdownSuccessPosition === option.value ? "selected" : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="map-route">
      <div class="invitation-settings-head">
        <h3>路线与地图</h3>
        <p>配置地图超链接与实景路线图，来宾可以在请柬中快速完成导航。</p>
      </div>
      <div class="invitation-settings-grid">
        <label class="full">
          婚礼地点地图超链接（可选）
          <input type="url" name="wedding_location_map_url" value="${escapeHtml(
            settings.wedding_location_map_url || ""
          )}" placeholder="如 https://maps.google.com/?q=海滨花园宴会厅" />
        </label>
        <p class="muted full">前台点击“地图导航”后会弹出地图应用选择（Google Maps / 高德地图 / 百度地图），并附带此自定义链接。</p>
        <label class="full">
          地图导航实景路线图（每行一个 URL）
          <textarea id="weddingRouteImageUrls" name="wedding_route_image_urls" rows="3" placeholder="如：https://example.com/route-1.jpg">${escapeHtml(
            routeImageUrls.join("\n")
          )}</textarea>
        </label>
        <div
          class="full image-upload-box"
          data-image-upload-box
          data-target-input="weddingRouteImageUrls"
          data-target-mode="append-lines"
          data-upload-multiple="true"
        >
          <label>
            上传实景路线图（可多选）
            <input type="file" accept="image/*" multiple data-image-upload-file />
          </label>
          <div class="inline-actions">
            <button class="btn ghost" type="button" data-image-upload-button>上传并追加到列表</button>
            <span class="muted" data-image-upload-status>可上传多张，提交设置后会展示在来宾地图弹窗中。</span>
          </div>
        </div>
        ${routeImagePreviewHtml}
      </div>
    </div>

    <div class="full invitation-settings-group" data-settings-group="others">
      <div class="invitation-settings-head">
        <h3>其他显示设置</h3>
        <p>统一调节来宾端阅读大小，方便不同年龄层在手机上查看请柬。</p>
      </div>
      <div class="invitation-settings-grid">
        <label>
          来宾页面字号放大倍数
          <input type="number" name="guest_font_scale" min="1" max="2.5" step="0.1" value="${escapeHtml(
            settings.guest_font_scale || "1.1"
          )}" />
        </label>
      </div>
    </div>

    <div class="full invitation-settings-submit">
      <button class="btn primary" type="submit">保存设置</button>
    </div>
  </form>
</section>

<section class="card">
  <h2>请柬背景音乐</h2>
  <p class="muted">上传后，来宾打开请柬将自动循环播放，可点击左上角音乐按钮暂停/播放。</p>
  <div class="form-grid">
    <label class="full">
      上传音乐文件
      <input type="file" id="inviteMusicFile" accept="audio/*" />
    </label>
    <div class="full inline-actions">
      <button class="btn primary" type="button" id="inviteMusicUpload">上传并启用</button>
      ${
        settings.invitation_music_url
          ? `<form method="post" action="/admin/invitation/music/delete">
              <button class="btn ghost" type="submit">移除背景音乐</button>
            </form>`
          : ""
      }
    </div>
    <div class="full">
      <div class="muted" id="inviteMusicStatus"></div>
    </div>
    ${
      settings.invitation_music_url
        ? `<div class="full">
            <audio controls src="${escapeHtml(
              settings.invitation_music_url
            )}"></audio>
            <p class="muted">当前已启用背景音乐</p>
          </div>`
        : `<div class="full muted">尚未设置背景音乐。</div>`
    }
  </div>
</section>

<section class="card">
  <h2>请柬页面分屏</h2>
  <p class="muted">每个分屏可单独设置背景图显示模式，适配横图、竖图、纹理图等不同素材。</p>
  <form method="post" action="/admin/invitation/sections" class="form-grid">
    <label>
      排序
      <input type="number" name="sort_order" />
    </label>
    <label>
      标题
      <input type="text" name="title" required />
    </label>
    <label class="full">
      文案
      <textarea name="body" rows="3" required></textarea>
    </label>
    <label class="full">
      图片 URL
      <input type="text" id="sectionImageUrlNew" name="image_url" />
    </label>
    <label>
      背景模式
      <select name="background_mode">
        ${sectionBackgroundModeOptions
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}">${escapeHtml(
                option.label
              )}</option>`
          )
          .join("")}
      </select>
    </label>
    <div class="full image-upload-box" data-image-upload-box data-target-input="sectionImageUrlNew">
      <label>
        上传分屏背景图
        <input type="file" accept="image/*" data-image-upload-file />
      </label>
      <div class="inline-actions">
        <button class="btn ghost" type="button" data-image-upload-button>上传并填入 URL</button>
        <span class="muted" data-image-upload-status>上传后将自动填入上方“图片 URL”。</span>
      </div>
    </div>
    <button class="btn primary" type="submit">新增分屏</button>
  </form>
  <div class="list invitation-section-list">
    ${sections
      .map(
        (section) => `
    <div class="list-item invitation-section-item">
      <div class="section-editor-head">
        <strong>分屏 #${escapeHtml(section.id)}</strong>
        <span class="muted">当前排序：${escapeHtml(
          section.sort_order
        )} ｜ 背景模式：${escapeHtml(
          getSectionBackgroundModeLabel(section.background_mode)
        )}</span>
      </div>
      <form method="post" action="/admin/invitation/sections/${section.id}/update" class="form-grid section-editor-form">
        <label>
          排序
          <input type="number" name="sort_order" value="${escapeHtml(
            section.sort_order
          )}" />
        </label>
        <label>
          标题
          <input type="text" name="title" value="${escapeHtml(
            section.title
          )}" required />
        </label>
        <label class="full">
          文案
          <textarea name="body" rows="3" required>${escapeHtml(
            section.body
          )}</textarea>
        </label>
        <label class="full">
          图片 URL
          <input type="text" id="sectionImageUrl-${escapeHtml(
            section.id
          )}" name="image_url" value="${escapeHtml(
            section.image_url || ""
          )}" />
        </label>
        <label>
          背景模式
          <select name="background_mode">
            ${sectionBackgroundModeOptions
              .map((option) => {
                const selected =
                  normalizeSectionBackgroundMode(
                    section.background_mode,
                    "cover"
                  ) === option.value
                    ? "selected"
                    : "";
                return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(
                  option.label
                )}</option>`;
              })
              .join("")}
          </select>
        </label>
        <div class="full image-upload-box" data-image-upload-box data-target-input="sectionImageUrl-${escapeHtml(
          section.id
        )}">
          <label>
            上传分屏背景图
            <input type="file" accept="image/*" data-image-upload-file />
          </label>
          <div class="inline-actions">
            <button class="btn ghost" type="button" data-image-upload-button>上传并填入 URL</button>
            <span class="muted" data-image-upload-status>上传后将自动填入上方“图片 URL”。</span>
          </div>
        </div>
        <div class="section-editor-actions full">
          <button class="btn primary" type="submit">保存修改</button>
        </div>
      </form>
      <form method="post" action="/admin/invitation/sections/${section.id}/delete" class="inline-form section-editor-delete">
        <button class="btn ghost" type="submit" onclick="return confirm('确认删除该分屏吗？');">删除</button>
      </form>
    </div>`
      )
      .join("")}
  </div>
</section>

<section class="card">
  <h2>来宾信息收集项排序</h2>
  <p class="muted">拖拽调整前后顺序，内置字段与自定义字段都支持。</p>
  <form method="post" action="/admin/invitation/field-order" id="fieldOrderForm">
    <input
      type="hidden"
      name="order_keys"
      id="fieldOrderKeys"
      value="${escapeHtml(orderedFieldKeysValue)}"
    />
    <div class="field-order-list" id="fieldOrderList">
      ${orderedFieldOrderItemsHtml}
    </div>
    <div class="section-editor-actions">
      <button class="btn primary" type="submit">保存排序</button>
    </div>
  </form>
</section>

<section class="card">
  <h2>来宾信息收集项</h2>
  <form method="post" action="/admin/invitation/fields" class="form-grid invitation-field-form" data-field-config-form>
    <label>
      字段名称
      <input type="text" name="label" required />
    </label>
    <label>
      字段标识
      <input type="text" name="field_key" required placeholder="如 dietary" />
    </label>
    <label>
      类型
      <select name="field_type" required data-field-type-select>
        <option value="text">文本</option>
        <option value="textarea">多行文本</option>
        <option value="select">下拉选择</option>
        <option value="date">日期</option>
        <option value="checkbox">复选框</option>
        <option value="radio">单选</option>
      </select>
    </label>
    <label id="invitationFieldOptionsWrap" class="is-disabled" data-options-wrap>
      选项（逗号分隔）
      <input type="text" name="options" placeholder="下拉选择、单选或复选框使用，如：素食,不吃辣,海鲜过敏" disabled />
    </label>
    <div class="field-required-wrap">
      <label class="required-switch" for="invitationFieldRequired">
        <span>设为必填</span>
        <input type="checkbox" id="invitationFieldRequired" name="required" />
      </label>
      <p class="muted">开启后，来宾提交时必须填写该项。</p>
    </div>
    <button class="btn primary" type="submit">新增字段</button>
  </form>
  <div class="list invitation-field-list">
    ${invitationFieldItemsHtml}
  </div>
</section>
${targetInviteLinksDialogHtml}
${targetInviteTemplatesDialogHtml}
${targetInviteCollabDialogHtml}
<script>
    (() => {
      const uploadButton = document.getElementById("inviteMusicUpload");
      const fileInput = document.getElementById("inviteMusicFile");
      const status = document.getElementById("inviteMusicStatus");
      if (uploadButton && fileInput && status) {
        const setStatus = (message, isError = false) => {
          status.textContent = message;
          status.classList.toggle("alert", isError);
          status.classList.toggle("muted", !isError);
        };

        uploadButton.addEventListener("click", () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) {
            setStatus("请选择音频文件后再上传。", true);
            return;
          }
          if (!file.type.startsWith("audio/")) {
            setStatus("仅支持上传音频文件。", true);
            return;
          }
          setStatus("正在上传，请稍候...");
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const response = await fetch("/admin/invitation/music", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl: reader.result, filename: file.name })
              });
              if (response.ok) {
                window.location.reload();
                return;
              }
              const text = await response.text();
              setStatus(text || "上传失败，请稍后再试。", true);
            } catch (error) {
              setStatus("上传失败，请检查网络连接。", true);
            }
          };
          reader.readAsDataURL(file);
        });
      }

      const invitationSettingsForm = document.querySelector(
        "form.invitation-settings-form"
      );
      const targetRecipientsTextarea = document.getElementById(
        "targetInviteRecipientsText"
      );
      const targetRecipientsFile = document.getElementById(
        "targetInviteRecipientsFile"
      );
      const targetRecipientsImportButton = document.getElementById(
        "targetInviteRecipientsImport"
      );
      const targetRecipientsStatus = document.getElementById(
        "targetInviteRecipientsStatus"
      );
      if (
        targetRecipientsTextarea &&
        targetRecipientsFile &&
        targetRecipientsImportButton &&
        targetRecipientsStatus
      ) {
        const setTargetStatus = (message, isError = false) => {
          targetRecipientsStatus.textContent = message;
          targetRecipientsStatus.classList.toggle("alert", isError);
          targetRecipientsStatus.classList.toggle("muted", !isError);
        };
        targetRecipientsImportButton.addEventListener("click", () => {
          const file = targetRecipientsFile.files && targetRecipientsFile.files[0];
          if (!file) {
            setTargetStatus("请先选择要导入的名单文件。", true);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const imported = String(reader.result || "")
              .replaceAll(String.fromCharCode(13), "")
              .split(String.fromCharCode(10))
              .map((line) => line.trim())
              .filter(Boolean);
            if (!imported.length) {
              setTargetStatus("文件中没有读取到有效名单。", true);
              return;
            }
            const existing = String(targetRecipientsTextarea.value || "")
              .replaceAll(String.fromCharCode(13), "")
              .split(String.fromCharCode(10))
              .map((line) => line.trim())
              .filter(Boolean);
            const merged = [...new Set([...existing, ...imported])];
            targetRecipientsTextarea.value = merged.join(String.fromCharCode(10));
            setTargetStatus(
              "已导入 " + imported.length + " 条名单，请点击“保存并生效”。"
            );
          };
          reader.onerror = () => {
            setTargetStatus("读取文件失败，请重试。", true);
          };
          reader.readAsText(file, "utf-8");
        });
      }
      document.querySelectorAll("[data-copy-target-link]").forEach((button) => {
        button.addEventListener("click", async () => {
          const link = String(button.getAttribute("data-copy-target-link") || "");
          if (!link) return;
          const originalText = button.textContent;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(link);
            } else {
              const temp = document.createElement("textarea");
              temp.value = link;
              document.body.appendChild(temp);
              temp.select();
              document.execCommand("copy");
              temp.remove();
            }
            button.textContent = "已复制";
            setTimeout(() => {
              button.textContent = originalText || "复制链接";
            }, 1200);
          } catch (error) {
            button.textContent = "复制失败";
            setTimeout(() => {
              button.textContent = originalText || "复制链接";
            }, 1200);
          }
        });
      });
      document.querySelectorAll("[data-copy-target-all]").forEach((button) => {
        button.addEventListener("click", async () => {
          const payload = String(button.getAttribute("data-copy-target-all") || "");
          if (!payload) return;
          const originalText = button.textContent;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(payload);
            } else {
              const temp = document.createElement("textarea");
              temp.value = payload;
              document.body.appendChild(temp);
              temp.select();
              document.execCommand("copy");
              temp.remove();
            }
            button.textContent = "已复制全部";
            setTimeout(() => {
              button.textContent = originalText || "复制全部";
            }, 1200);
          } catch (error) {
            button.textContent = "复制失败";
            setTimeout(() => {
              button.textContent = originalText || "复制全部";
            }, 1200);
          }
        });
      });
      document.querySelectorAll("[data-dialog-target]").forEach((trigger) => {
        trigger.addEventListener("click", () => {
          const dialogId = trigger.getAttribute("data-dialog-target");
          const dialog = dialogId ? document.getElementById(dialogId) : null;
          if (!dialog) return;
          if (typeof dialog.showModal === "function") {
            dialog.showModal();
            return;
          }
          dialog.setAttribute("open", "");
        });
      });
      document.querySelectorAll("[data-dialog-close]").forEach((button) => {
        button.addEventListener("click", () => {
          const dialog = button.closest("dialog");
          if (!dialog) return;
          if (typeof dialog.close === "function") {
            dialog.close();
            return;
          }
          dialog.removeAttribute("open");
        });
      });
      document.querySelectorAll("dialog").forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
          if (event.target !== dialog) return;
          if (typeof dialog.close === "function") {
            dialog.close();
            return;
          }
          dialog.removeAttribute("open");
        });
      });
${renderTargetInviteImageDownloadScript()}
      if (invitationSettingsForm) {
        const bindToggleGroup = (toggleName, dependentNames) => {
          const toggle = invitationSettingsForm.querySelector(
            '[name="' + toggleName + '"]'
          );
          if (!toggle) return;
          const nodes = dependentNames
            .map((name) =>
              invitationSettingsForm.querySelector('[name="' + name + '"]')
            )
            .filter(Boolean);
          const refresh = () => {
            const enabled = toggle.checked;
            nodes.forEach((node) => {
              node.disabled = !enabled;
              const wrapper = node.closest("label");
              if (wrapper) wrapper.classList.toggle("is-disabled", !enabled);
            });
          };
          toggle.addEventListener("change", refresh);
          refresh();
        };

        bindToggleGroup("hero_overlay_enabled", [
          "hero_overlay_color",
          "hero_overlay_opacity"
        ]);
        bindToggleGroup("text_animation_enabled", [
          "text_animation_repeat",
          "text_animation_style",
          "text_animation_duration",
          "text_animation_stagger_ms"
        ]);
        bindToggleGroup("swipe_hint_enabled", [
          "swipe_hint_text",
          "swipe_hint_position",
          "swipe_hint_style"
        ]);
        bindToggleGroup("countdown_enabled", [
          "countdown_show_home",
          "countdown_show_success",
          "countdown_target_at",
          "countdown_label",
          "countdown_theme",
          "countdown_opacity",
          "countdown_bg_color",
          "countdown_text_color",
          "countdown_accent_color",
          "countdown_home_position",
          "countdown_success_position"
        ]);
        bindToggleGroup("festive_effect_enabled", [
          "festive_effect_style",
          "festive_effect_intensity"
        ]);
      }

      const readFileAsDataUrl = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result || "");
          reader.onerror = () => reject(new Error("读取文件失败"));
          reader.readAsDataURL(file);
        });

      const uploadInvitationImage = async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        const response = await fetch("/admin/invitation/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, filename: file.name || "" })
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "上传失败，请稍后重试。");
        }
        return result.url || "";
      };

      const imageUploadBoxes = Array.from(
        document.querySelectorAll("[data-image-upload-box]")
      );
      imageUploadBoxes.forEach((box) => {
        const file = box.querySelector("[data-image-upload-file]");
        const button = box.querySelector("[data-image-upload-button]");
        const statusEl = box.querySelector("[data-image-upload-status]");
        const targetId = box.getAttribute("data-target-input");
        const targetInput = targetId ? document.getElementById(targetId) : null;
        if (!file || !button || !statusEl || !targetInput) return;

        const setBoxStatus = (message, isError = false) => {
          statusEl.textContent = message;
          statusEl.classList.toggle("is-error", isError);
        };

        const isLikelyImageFile = (item) => {
          const mimeType = String(item?.type || "").toLowerCase();
          if (mimeType.startsWith("image/")) return true;
          const fileName = String(item?.name || "").toLowerCase();
          return /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(fileName);
        };

        button.addEventListener("click", async (event) => {
          if (event) event.preventDefault();
          setBoxStatus("正在准备上传...");
          const selectedFiles = Array.from(file.files || []);
          if (!selectedFiles.length) {
            setBoxStatus("请先选择图片文件。", true);
            return;
          }
          if (!selectedFiles.every((item) => isLikelyImageFile(item))) {
            setBoxStatus("仅支持图片文件。", true);
            return;
          }
          const targetMode = box.getAttribute("data-target-mode") || "replace";
          const lineBreak = String.fromCharCode(10);
          button.disabled = true;
          setBoxStatus(
            selectedFiles.length > 1
              ? "正在上传 1/" + selectedFiles.length + " 张图片..."
              : "正在上传图片，请稍候..."
          );
          try {
            const uploadedUrls = [];
            for (let index = 0; index < selectedFiles.length; index += 1) {
              const selected = selectedFiles[index];
              if (selectedFiles.length > 1) {
                setBoxStatus(
                  "正在上传 " + (index + 1) + "/" + selectedFiles.length + " 张图片..."
                );
              }
              const imageUrl = await uploadInvitationImage(selected);
              uploadedUrls.push(imageUrl);
            }
            if (targetMode === "append-lines") {
              const existing = String(targetInput.value || "")
                .replaceAll(String.fromCharCode(13), "")
                .split(lineBreak)
                .map((item) => item.trim())
                .filter(Boolean);
              targetInput.value = [...new Set([...existing, ...uploadedUrls])].join(
                lineBreak
              );
            } else {
              targetInput.value = uploadedUrls[uploadedUrls.length - 1] || "";
            }
            setBoxStatus(
              uploadedUrls.length > 1
                ? "上传成功，已追加 " + uploadedUrls.length + " 条 URL。"
                : "上传成功，已自动填入 URL。"
            );
          } catch (error) {
            setBoxStatus(error.message || "上传失败，请稍后重试。", true);
          } finally {
            button.disabled = false;
          }
        });
      });

      const fieldOrderList = document.getElementById("fieldOrderList");
      const fieldOrderKeysInput = document.getElementById("fieldOrderKeys");
      if (fieldOrderList && fieldOrderKeysInput) {
        const syncFieldOrder = () => {
          const order = Array.from(
            fieldOrderList.querySelectorAll("[data-order-item]")
          )
            .map((item) => item.getAttribute("data-field-key") || "")
            .filter(Boolean);
          fieldOrderKeysInput.value = order.join(",");
        };

        let draggingItem = null;
        const getDragAfterElement = (container, y) => {
          const candidates = Array.from(
            container.querySelectorAll("[data-order-item]:not(.is-dragging)")
          );
          return candidates.reduce(
            (closest, item) => {
              const box = item.getBoundingClientRect();
              const offset = y - box.top - box.height / 2;
              if (offset < 0 && offset > closest.offset) {
                return { offset, element: item };
              }
              return closest;
            },
            { offset: Number.NEGATIVE_INFINITY, element: null }
          ).element;
        };

        fieldOrderList.querySelectorAll("[data-order-item]").forEach((item) => {
          item.addEventListener("dragstart", (event) => {
            if (event?.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "text/plain",
                item.getAttribute("data-field-key") || ""
              );
            }
            draggingItem = item;
            item.classList.add("is-dragging");
          });
          item.addEventListener("dragend", () => {
            item.classList.remove("is-dragging");
            draggingItem = null;
            syncFieldOrder();
          });
        });

        fieldOrderList.addEventListener("dragenter", (event) => {
          event.preventDefault();
        });
        fieldOrderList.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (event?.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
          if (!draggingItem) return;
          const afterElement = getDragAfterElement(fieldOrderList, event.clientY);
          if (!afterElement) {
            fieldOrderList.appendChild(draggingItem);
            return;
          }
          fieldOrderList.insertBefore(draggingItem, afterElement);
        });
        fieldOrderList.addEventListener("drop", (event) => {
          event.preventDefault();
          syncFieldOrder();
        });

        fieldOrderList
          .querySelectorAll("button[data-order-move]")
          .forEach((button) => {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              const direction = Number(button.getAttribute("data-order-move")) || 0;
              const item = button.closest("[data-order-item]");
              if (!item || !direction) return;
              if (direction < 0) {
                const prev = item.previousElementSibling;
                if (!prev) return;
                fieldOrderList.insertBefore(item, prev);
              } else {
                const next = item.nextElementSibling;
                if (!next) return;
                fieldOrderList.insertBefore(next, item);
              }
              syncFieldOrder();
            });
          });

        syncFieldOrder();
      }

      const syncFieldOptions = (form) => {
        const fieldTypeSelect = form.querySelector("[data-field-type-select]");
        const optionsWrap = form.querySelector("[data-options-wrap]");
        const optionsInput = optionsWrap
          ? optionsWrap.querySelector("input[name='options']")
          : null;
        if (!fieldTypeSelect || !optionsWrap || !optionsInput) return;
        const needOptions = ["select", "checkbox", "radio"].includes(fieldTypeSelect.value);
        optionsWrap.classList.toggle("is-disabled", !needOptions);
        optionsInput.disabled = !needOptions;
        if (!needOptions) {
          optionsInput.value = "";
        }
      };

      document
        .querySelectorAll("[data-field-config-form]")
        .forEach((form) => {
          const fieldTypeSelect = form.querySelector("[data-field-type-select]");
          if (!fieldTypeSelect) return;
          fieldTypeSelect.addEventListener("change", () => syncFieldOptions(form));
          syncFieldOptions(form);
        });
    })();
  </script>
`
  );
};

const renderGuests = ({ guests, fields, tables, error, errorGuestId }) => {
  const tableList = tables || [];
  const getGuestPartySize = (guest) => {
    const rawValue = guest?.responses?.attendees;
    if (!rawValue) return 1;
    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return parsed;
  };
  const tableNos = new Set(
    tableList
      .map((table) => String(table.table_no || "").trim())
      .filter(Boolean)
  );
  const renderTableOptions = (selectedValue = "") => {
    const normalized = String(selectedValue || "").trim();
    const options = tableList
      .map((table) => {
        const tableNo = String(table.table_no || "").trim();
        if (!tableNo) return "";
        const nickname = table.nickname
          ? ` · ${escapeHtml(table.nickname)}`
          : "";
        return `<option value="${escapeHtml(tableNo)}" ${
          tableNo === normalized ? "selected" : ""
        }>桌 ${escapeHtml(tableNo)}${nickname}</option>`;
      })
      .join("");
    return `
      <select name="table_no">
        <option value="">未分配</option>
        ${options}
      </select>`;
  };

  return adminLayout(
    "来宾管理",
    `
${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
<section class="card">
  <h1>手动新增来宾</h1>
  <form method="post" action="/admin/guests" class="form-grid">
    <label>
      姓名
      <input type="text" name="name" required />
    </label>
    <label>
      手机号
      <input type="tel" name="phone" required />
    </label>
    <label>
      出席人数
      ${renderAttendeeInput({ name: "attendees", required: true })}
    </label>
    <label>
      出席情况
      ${renderAttendingSelect({ name: "attending", value: true, required: true })}
    </label>
    <label>
      席位号
      ${renderTableOptions()}
    </label>
    ${
      tableList.length
        ? ""
        : `<p class="muted full">请先在下方新增桌子，再为来宾分配席位。</p>`
    }
    ${fields
      .map((field) =>
        renderCustomFieldInput({
          field,
          fullWidth: ["textarea", "checkbox", "radio"].includes(
            normalizeCustomFieldType(field)
          )
        })
      )
      .join("")}
    <button class="btn primary" type="submit">新增来宾</button>
  </form>
</section>

<section class="card">
  <div class="section-header">
    <div>
      <h1>桌号管理与可视化</h1>
      <p>新增、编辑或删除桌子，并为来宾分配席位。</p>
    </div>
    <a class="btn primary" href="/admin/tables/print" target="_blank">一键打印全部桌牌</a>
  </div>
  <form method="post" action="/admin/tables" class="form-grid">
    <label>
      桌子编号
      <input type="text" name="table_no" placeholder="如 1、A1" required />
    </label>
    <label>
      桌子昵称
      <input type="text" name="nickname" placeholder="如 亲友桌" />
    </label>
    <label>
      座位数
      <input type="number" name="seats" min="0" placeholder="如 10" />
    </label>
    <label>
      宴席偏好
      <input type="text" name="preference" placeholder="如 靠舞台/素食" />
    </label>
    <button class="btn primary" type="submit">新增桌子</button>
  </form>
  ${
    tableList.length
      ? `<div class="table-grid">
    ${tableList
      .map((table) => {
        const seatCount = Math.max(Number(table.seats) || 0, 0);
        const assignedGuests = guests.filter(
          (guest) => String(guest.table_no || "").trim() === table.table_no
        );
        const assignedCount = assignedGuests.reduce(
          (sum, guest) => sum + getGuestPartySize(guest),
          0
        );
        const isOverCapacity = seatCount > 0 && assignedCount > seatCount;
        return `
      <div class="table-card">
        <div class="table-visual">
          <div class="table-visual-core">
            <div class="table-number">桌 ${escapeHtml(table.table_no)}</div>
            <div class="table-nickname">${
              table.nickname ? escapeHtml(table.nickname) : "未命名"
            }</div>
            ${
              seatCount
                ? `<div class="table-seat-ring" style="--seat-count:${escapeHtml(
                    seatCount
                  )}">
              ${Array.from({ length: seatCount })
                .map(
                  (_, index) =>
                    `<span class="table-seat ${
                      index < assignedCount ? "seat-assigned" : "seat-open"
                    }" style="--seat-index:${index}"></span>`
                )
                .join("")}
            </div>`
                : ""
            }
          </div>
          <div class="table-visual-seats">
            ${seatCount ? `${escapeHtml(seatCount)} 位` : "未填写座位数"}
          </div>
          <div class="table-visual-preference">${
            table.preference ? escapeHtml(table.preference) : "暂无偏好"
          }</div>
        </div>
        ${
          isOverCapacity
            ? `<div class="table-capacity-warning">已超出最大承载 ${escapeHtml(
                seatCount
              )} 位，请调整座位。</div>`
            : ""
        }
        <div class="table-guest-list">
          <div class="table-guest-title">已分配来宾</div>
          ${
            assignedGuests.length
              ? assignedGuests
                  .map(
                    (guest) =>
                      `<span class="table-guest-name">${escapeHtml(
                        formatGuestDisplayName(guest)
                      )}</span>`
                  )
                  .join("")
              : `<span class="muted">暂无来宾</span>`
          }
        </div>
        <form method="post" action="/admin/tables/${table.id}/update" class="table-form">
          <label>
            桌号
            <input type="text" name="table_no" value="${escapeHtml(
              table.table_no
            )}" required />
          </label>
          <label>
            昵称
            <input type="text" name="nickname" value="${escapeHtml(
              table.nickname || ""
            )}" />
          </label>
          <label>
            座位数
            <input type="number" name="seats" min="0" value="${escapeHtml(
              table.seats || 0
            )}" />
          </label>
          <label>
            宴席偏好
            <input type="text" name="preference" value="${escapeHtml(
              table.preference || ""
            )}" />
          </label>
          <button class="btn ghost" type="submit">保存修改</button>
        </form>
        <div class="table-actions">
          <a class="btn ghost" href="/admin/tables/${table.id}/print" target="_blank">打印此桌</a>
          <form method="post" action="/admin/tables/${table.id}/delete" class="inline-form">
            <button class="btn ghost" type="submit" onclick="return confirm('确认删除该桌子吗？');">删除</button>
          </form>
        </div>
      </div>`;
      })
      .join("")}
  </div>`
      : `<p class="muted">暂无桌子信息，请先新增桌子。</p>`
  }
</section>

<section class="card">
  <div class="section-header">
    <div>
      <h1>来宾信息统计</h1>
      <p>可直接编辑来宾信息并保存修改。未分配或桌号不存在的来宾将高亮提醒。</p>
    </div>
    <div class="section-actions">
      <a class="btn ghost" href="/admin/guests/export">导出Excel</a>
      <form method="post" action="/admin/guests/clear" class="inline-form">
        <button class="btn ghost" type="submit" onclick="return confirm('确定要清除所有来宾与签到数据吗？此操作不可恢复。') && confirm('请再次确认：确定要清除所有来宾与签到数据吗？');">清除来宾与签到</button>
      </form>
    </div>
  </div>
  <div class="table-scroll">
  <table class="table guest-table">
    <thead>
      <tr>
        <th>姓名</th>
        <th>手机号</th>
        <th>出席</th>
        <th class="attendee-count-col">出席人数</th>
        <th>席位号</th>
        <th>自定义信息</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${guests
        .map((guest, index) => {
          const tableNo = String(guest.table_no || "").trim();
          const hasValidTable = tableNo && tableNos.has(tableNo);
          const rowClasses = [];
          if (!hasValidTable) rowClasses.push("guest-row-alert");
          if (guest.attendee_adjusted) rowClasses.push("guest-row-adjusted");
          const rowClass = rowClasses.length
            ? ` class="${rowClasses.join(" ")}"`
            : "";
          const isErrorGuest =
            error && Number(errorGuestId) === Number(guest.id);
          const prevGuest = guests[index - 1];
          const nextGuest = guests[index + 1];
          const focusGuestId = nextGuest?.id || prevGuest?.id || guest.id;
          const customInfoItems = fields.map((field) => {
            const rawValue = (guest.responses || {})[field.field_key] || "";
            return {
              field,
              rawValue,
              value: formatCustomFieldValue(field, rawValue)
            };
          });
          const filledCustomInfo = customInfoItems.filter((item) =>
            item.value.trim()
          );
          const customInfoCount = filledCustomInfo.length;
          const customInfoPreview = filledCustomInfo
            .slice(0, 2)
            .map(
              (item) =>
                `${escapeHtml(item.field.label)}：${escapeHtml(item.value)}`
            )
            .join(" ｜ ");
          const customInfoSummary = customInfoCount
            ? `已填写 ${customInfoCount} 项`
            : "暂无填写";
          const dialogId = `guest-dialog-${guest.id}`;
          return `
      <tr${rowClass} id="guest-${guest.id}">
        <td>
          <input type="text" name="name" value="${escapeHtml(
            guest.name
          )}" form="guest-form-${guest.id}" required />
          ${
            getCompanionLabel(guest)
              ? `<div class="muted">显示：${escapeHtml(
                  formatGuestDisplayName(guest)
                )}</div>`
              : ""
          }
          ${
            guest.attendee_adjusted
              ? `<div class="adjusted-note">人数变动，请尽快调整桌位安排。</div>`
              : ""
          }
        </td>
        <td>
          <input type="tel" name="phone" value="${escapeHtml(
            guest.phone
          )}" form="guest-form-${guest.id}" required />
        </td>
        <td>
          ${renderAttendingSelect({
            name: "attending",
            value: guest.attending,
            required: true,
            form: `guest-form-${guest.id}`
          })}
        </td>
        <td class="attendee-count-col">
          ${renderAttendeeInput({
            name: "attendees",
            value: guest.responses?.attendees,
            required: true,
            form: `guest-form-${guest.id}`
          })}
        </td>
        <td>
          <select name="table_no" form="guest-form-${guest.id}" data-auto-save="true">
            <option value="">未分配</option>
            ${tableList
              .map((table) => {
                const tableValue = String(table.table_no || "").trim();
                if (!tableValue) return "";
                const nickname = table.nickname
                  ? ` · ${escapeHtml(table.nickname)}`
                  : "";
                return `<option value="${escapeHtml(tableValue)}" ${
                  tableValue === tableNo ? "selected" : ""
                }>桌 ${escapeHtml(tableValue)}${nickname}</option>`;
              })
              .join("")}
          </select>
          ${
            isErrorGuest
              ? `<div class="field-error">${escapeHtml(error)}</div>`
              : ""
          }
        </td>
        <td>
          <div class="custom-info-cell">
            <div>
              <div class="custom-info-summary">${customInfoSummary}</div>
              ${
                customInfoPreview
                  ? `<div class="custom-info-preview">${customInfoPreview}</div>`
                  : `<div class="muted">可点击查看/编辑</div>`
              }
            </div>
            <button class="btn ghost small" type="button" data-dialog-target="${dialogId}">查看/编辑</button>
          </div>
          <dialog class="guest-dialog" id="${dialogId}">
            <div class="dialog-header">
              <div>
                <strong>自定义信息</strong>
                <div class="muted">${escapeHtml(guest.name)} · ${
            customInfoCount ? customInfoSummary : "暂无填写"
          }</div>
              </div>
              <button class="btn ghost small" type="button" data-dialog-close>关闭</button>
            </div>
            <div class="dialog-body">
              <div class="form-stack dialog-fields">
                ${customInfoItems
                  .map((item) =>
                    renderCustomFieldInput({
                      field: item.field,
                      value: item.rawValue,
                      form: `guest-form-${guest.id}`
                    })
                  )
                  .join("")}
              </div>
            </div>
            <div class="dialog-actions">
              <button class="btn ghost" type="button" data-dialog-close>关闭</button>
              <button class="btn primary" type="submit" form="guest-form-${guest.id}">保存修改</button>
            </div>
          </dialog>
        </td>
        <td>
          <div class="guest-actions">
            <form method="post" action="/admin/guests/${
              guest.id
            }/update" class="inline-form" id="guest-form-${guest.id}">
              <input type="hidden" name="return_to" value="guest-${guest.id}" />
              <button class="btn ghost" type="submit">保存</button>
            </form>
            <form method="post" action="/admin/guests/${guest.id}/delete" class="inline-form">
              <input type="hidden" name="return_to" value="guest-${focusGuestId}" />
              <button class="btn ghost" type="submit" onclick="return confirm('确认删除该来宾吗？');">删除</button>
            </form>
          </div>
        </td>
      </tr>`;
        })
        .join("")}
    </tbody>
  </table>
  </div>
</section>
<script>
  (() => {
    const autoSaveSelects = Array.from(
      document.querySelectorAll("select[data-auto-save='true']")
    );
    autoSaveSelects.forEach((select) => {
      select.addEventListener("change", () => {
        const formId = select.getAttribute("form");
        const form = formId ? document.getElementById(formId) : null;
        if (!form) return;
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
      });
    });

    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    const dialogTriggers = Array.from(
      document.querySelectorAll("[data-dialog-target]")
    );
    dialogTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const dialogId = trigger.getAttribute("data-dialog-target");
        const dialog = dialogId ? document.getElementById(dialogId) : null;
        if (!dialog) return;
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      });
    });

    const closeButtons = Array.from(
      document.querySelectorAll("[data-dialog-close]")
    );
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = button.closest("dialog");
        if (!dialog) return;
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      });
    });

    const dialogs = Array.from(document.querySelectorAll("dialog"));
    dialogs.forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      });
    });
  })();
</script>
`
  );
};

const renderLedger = ({ entries, categories, activeCategory, error }) => {
  const ledgerEntries = entries || [];
  const categoryList = categories || [];
  const today = new Date().toISOString().slice(0, 10);
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  const summarizeEntries = (items) =>
    items.reduce(
      (summary, entry) => {
        const amount = Number(entry.amount) || 0;
        if (entry.direction === "income") {
          summary.income += amount;
        } else {
          summary.expense += amount;
        }
        summary.net = summary.income - summary.expense;
        return summary;
      },
      { income: 0, expense: 0, net: 0 }
    );
  const overallSummary = summarizeEntries(ledgerEntries);
  const categorySummaries = categoryList.map((category) => {
    const items = ledgerEntries.filter(
      (entry) => entry.category === category.value
    );
    return {
      ...category,
      summary: summarizeEntries(items)
    };
  });
  const filteredEntries = activeCategory
    ? ledgerEntries.filter((entry) => entry.category === activeCategory)
    : ledgerEntries;
  const exportHref = activeCategory
    ? `/admin/ledger/export?category=${encodeURIComponent(activeCategory)}`
    : "/admin/ledger/export";

  const renderCategoryOptions = (selectedValue = "") =>
    categoryList
      .map((category) => {
        const selected = selectedValue === category.value ? "selected" : "";
        return `<option value="${escapeHtml(
          category.value
        )}" ${selected}>${escapeHtml(category.label)}</option>`;
      })
      .join("");

  return adminLayout(
    "流水管理",
    `
${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
<section class="card ledger-summary">
  <div class="section-header">
    <div>
      <h1>婚礼流水总览</h1>
      <p>实时掌握各类别余额与整体收支表现。</p>
    </div>
    <div class="ledger-overall">
      <div>
        <span class="muted">总收入</span>
        <div class="ledger-total income">¥${formatMoney(
          overallSummary.income
        )}</div>
      </div>
      <div>
        <span class="muted">总支出</span>
        <div class="ledger-total expense">¥${formatMoney(
          overallSummary.expense
        )}</div>
      </div>
      <div>
        <span class="muted">结余</span>
        <div class="ledger-total ${
          overallSummary.net >= 0 ? "income" : "expense"
        }">¥${formatMoney(overallSummary.net)}</div>
      </div>
    </div>
  </div>
  <div class="ledger-summary-grid">
    ${categorySummaries
      .map(
        (category) => `
    <div class="ledger-card">
      <div class="ledger-card-title">${escapeHtml(category.label)}</div>
      <div class="ledger-balance ${
        category.summary.net >= 0 ? "income" : "expense"
      }">¥${formatMoney(category.summary.net)}</div>
      <div class="ledger-meta">
        <span>收入 ¥${formatMoney(category.summary.income)}</span>
        <span>支出 ¥${formatMoney(category.summary.expense)}</span>
      </div>
    </div>`
      )
      .join("")}
  </div>
</section>

<section class="card">
  <h2>新增流水</h2>
  <form method="post" action="/admin/ledger" class="form-grid">
    <label>
      发生日期
      <input type="date" name="occurred_at" value="${escapeHtml(
        today
      )}" required />
    </label>
    <label>
      收支类型
      <select name="direction" required>
        <option value="expense">支出</option>
        <option value="income">收入</option>
      </select>
    </label>
    <label>
      类型
      <select name="category" required>
        ${renderCategoryOptions()}
      </select>
    </label>
    <label>
      金额
      <input type="number" name="amount" min="0" step="0.01" required />
    </label>
    <label class="full">
      具体用途
      <input type="text" name="purpose" required />
    </label>
    <label>
      付款人
      <input type="text" name="payer" required />
    </label>
    <label>
      收款/支出对象
      <input type="text" name="payee" />
    </label>
    <label>
      付款方式
      <input type="text" name="method" placeholder="现金/转账/支付宝等" />
    </label>
    <label class="full">
      备注
      <textarea name="note" rows="2"></textarea>
    </label>
    <button class="btn primary" type="submit">保存流水</button>
  </form>
</section>

<section class="card">
  <div class="section-header">
    <div>
      <h2>流水单</h2>
      <p>支持按类别筛选、导出与导入 CSV。</p>
    </div>
    <div class="ledger-actions">
      <form method="get" action="/admin/ledger" class="inline-form ledger-filter">
        <label>
          类型筛选
          <select name="category">
            <option value="">全部类别</option>
            ${renderCategoryOptions(activeCategory)}
          </select>
        </label>
        <button class="btn ghost" type="submit">筛选</button>
      </form>
      <div class="ledger-import">
        <input type="file" id="ledgerImportFile" accept=".csv,text/csv" />
        <button class="btn ghost" type="button" id="ledgerImportButton">导入CSV</button>
        <span class="muted ledger-import-status" id="ledgerImportStatus">可直接导入系统导出的流水 CSV 文件。</span>
      </div>
      <a class="btn primary" href="${exportHref}">导出Excel</a>
    </div>
  </div>
  <div class="table-scroll">
    <table class="table ledger-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>收支</th>
          <th>类型</th>
          <th>金额</th>
          <th>具体用途</th>
          <th>付款人</th>
          <th>对象</th>
          <th>方式</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${
          filteredEntries.length
            ? filteredEntries
                .map((entry) => {
                  const amountValue = Number(entry.amount || 0).toFixed(2);
                  return `
        <tr id="ledger-${entry.id}">
          <td>
            <input type="date" name="occurred_at" value="${escapeHtml(
              entry.occurred_at || today
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <select name="direction" form="ledger-form-${entry.id}">
              <option value="expense" ${
                entry.direction === "expense" ? "selected" : ""
              }>支出</option>
              <option value="income" ${
                entry.direction === "income" ? "selected" : ""
              }>收入</option>
            </select>
          </td>
          <td>
            <select name="category" form="ledger-form-${entry.id}">
              ${renderCategoryOptions(entry.category)}
            </select>
          </td>
          <td>
            <input type="number" name="amount" min="0" step="0.01" value="${escapeHtml(
              amountValue
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <input type="text" name="purpose" value="${escapeHtml(
              entry.purpose || ""
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <input type="text" name="payer" value="${escapeHtml(
              entry.payer || ""
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <input type="text" name="payee" value="${escapeHtml(
              entry.payee || ""
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <input type="text" name="method" value="${escapeHtml(
              entry.method || ""
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <input type="text" name="note" value="${escapeHtml(
              entry.note || ""
            )}" form="ledger-form-${entry.id}" />
          </td>
          <td>
            <form method="post" action="/admin/ledger/${
              entry.id
            }/update" class="inline-form" id="ledger-form-${entry.id}">
              <input type="hidden" name="return_to" value="ledger-${entry.id}" />
              <button class="btn ghost" type="submit">保存</button>
            </form>
            <form method="post" action="/admin/ledger/${entry.id}/delete" class="inline-form">
              <button class="btn ghost" type="submit" onclick="return confirm('确认删除该流水吗？');">删除</button>
            </form>
          </td>
        </tr>`;
                })
                .join("")
            : `<tr><td colspan="10" class="muted">暂无流水记录。</td></tr>`
        }
      </tbody>
    </table>
  </div>
</section>
<script>
  (() => {
    const filterSelect = document.querySelector(".ledger-filter select");
    if (filterSelect) {
      filterSelect.addEventListener("change", () => {
        if (typeof filterSelect.form?.requestSubmit === "function") {
          filterSelect.form.requestSubmit();
        } else if (filterSelect.form) {
          filterSelect.form.submit();
        }
      });
    }

    const importFileInput = document.getElementById("ledgerImportFile");
    const importButton = document.getElementById("ledgerImportButton");
    const importStatus = document.getElementById("ledgerImportStatus");
    if (importFileInput && importButton && importStatus) {
      const setImportStatus = (message, isError = false) => {
        importStatus.textContent = message;
        importStatus.classList.toggle("is-error", isError);
      };

      importButton.addEventListener("click", () => {
        const file = importFileInput.files && importFileInput.files[0];
        if (!file) {
          setImportStatus("请先选择 CSV 文件。", true);
          return;
        }
        const lowerName = String(file.name || "").toLowerCase();
        if (!lowerName.endsWith(".csv") && file.type !== "text/csv") {
          setImportStatus("仅支持导入 CSV 文件。", true);
          return;
        }
        setImportStatus("正在读取并导入，请稍候...");
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const response = await fetch("/admin/ledger/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                csv_text: reader.result || "",
                filename: file.name || ""
              })
            });
            const result = await response.json();
            if (!response.ok) {
              setImportStatus(result.error || "导入失败，请检查文件内容。", true);
              return;
            }
            const summary = "导入完成：新增 " + (result.inserted || 0) + " 条，跳过 " + (result.skipped || 0) + " 条。";
            setImportStatus(summary, false);
            if (Array.isArray(result.errors) && result.errors.length) {
              setImportStatus(summary + " " + result.errors.slice(0, 2).join(" "), true);
            }
            setTimeout(() => {
              location.reload();
            }, 700);
          } catch (error) {
            setImportStatus("导入失败，请检查网络连接或文件格式。", true);
          }
        };
        reader.readAsText(file);
      });
    }
  })();
</script>
`
  );
};

const renderTablePrint = ({ tables, guests }) => {
  const tableList = tables || [];
  const guestList = guests || [];
  const pages = tableList
    .map((table, index) => {
      const tableNo = String(table.table_no || "").trim();
      const assignedGuests = guestList.filter(
        (guest) => String(guest.table_no || "").trim() === tableNo
      );
      const hasNextPage = index < tableList.length - 1;
      return `
  <section class="table-print-page${hasNextPage ? " page-break" : ""}">
    <div class="table-print-hero">
      <div class="table-print-number">桌号 ${escapeHtml(tableNo)}</div>
      <div class="table-print-nickname">${escapeHtml(
        table.nickname || "未命名桌"
      )}</div>
    </div>
    <div class="table-print-guest-list">
      ${
        assignedGuests.length
          ? assignedGuests
              .map(
                (guest) => `
        <div class="table-print-guest-name">${escapeHtml(
          formatGuestDisplayName(guest)
        )}</div>`
              )
              .join("")
          : `<div class="table-print-guest-empty">暂无来宾分配</div>`
      }
    </div>
  </section>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>桌号打印</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="print-body">
    <div class="print-logo">
      <img src="${SITE_LOGO_ICON_PATH}" alt="" />
      <span>Wedding Manager</span>
    </div>
    <div class="print-actions">
      <button class="btn primary" type="button" onclick="window.print()">一键打印</button>
      <a class="btn ghost" href="/admin/guests">返回来宾管理</a>
    </div>
    ${pages || `<p class="muted">暂无桌子可打印。</p>`}
  </body>
</html>
`;
};

const renderSeatCards = (guests) =>
  adminLayout(
    "席位牌",
    `
<section class="card">
  <h1>席位牌自动生成</h1>
  <p>支持A4横向三折席位牌（折成三角柱），每页仅打印一位来宾。</p>
  <p class="muted">点击任意席位牌即可单独打印该来宾。</p>
  <div class="seat-actions">
    <button class="btn primary" type="button" onclick="window.print()">一键打印席位牌</button>
  </div>
</section>
<section class="seat-grid">
  ${guests
    .map(
      (guest) => `
  <div class="seat-card">
    <div class="seat-panel seat-panel-name">
      <div class="seat-name">${escapeHtml(guest.name)}</div>
      ${
        getCompanionLabel(guest)
          ? `<div class="seat-name">${escapeHtml(
              getCompanionLabel(guest)
            )}</div>`
          : ""
      }
    </div>
    <div class="seat-panel seat-panel-center">
      <div class="seat-table">桌号 ${escapeHtml(guest.table_no || "未分配")}</div>
      <div class="seat-note">欢迎出席我们的婚礼</div>
    </div>
    <div class="seat-panel seat-panel-name">
      <div class="seat-name">${escapeHtml(guest.name)}</div>
      ${
        getCompanionLabel(guest)
          ? `<div class="seat-name">${escapeHtml(
              getCompanionLabel(guest)
            )}</div>`
          : ""
      }
    </div>
  </div>`
    )
    .join("")}
</section>
<script>
  (() => {
    const cards = Array.from(document.querySelectorAll(".seat-card"));
    if (!cards.length) return;
    const clearSelection = () => {
      document.body.classList.remove("print-single");
      cards.forEach((card) => card.classList.remove("seat-card-print"));
    };
    const handleAfterPrint = () => {
      clearSelection();
      window.removeEventListener("afterprint", handleAfterPrint);
    };
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((item) =>
          item.classList.toggle("seat-card-print", item === card)
        );
        document.body.classList.add("print-single");
        window.addEventListener("afterprint", handleAfterPrint);
        window.print();
      });
    });
  })();
</script>
`
  );

const renderAdminLottery = ({ prizes, winners }) =>
  adminLayout(
    "现场摇奖",
    `
<section class="card">
  <h1>摇奖设置</h1>
  <form method="post" action="/admin/lottery/prizes" class="form-grid">
    <label>
      奖品名称
      <input type="text" name="name" required />
    </label>
    <label>
      数量
      <input type="number" name="quantity" min="1" value="1" />
    </label>
    <button class="btn primary" type="submit">新增奖品</button>
  </form>
  <div class="list">
    ${prizes
      .map(
        (prize) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(prize.name)}</strong>
        <p>数量：${prize.quantity}</p>
      </div>
      <form method="post" action="/admin/lottery/prizes/${prize.id}/delete">
        <button class="btn ghost" type="submit">删除</button>
      </form>
    </div>`
      )
      .join("")}
  </div>
</section>
<section class="card">
  <h2>中奖记录</h2>
  <table class="table">
    <thead>
      <tr>
        <th>奖品</th>
        <th>来宾</th>
        <th>时间</th>
      </tr>
    </thead>
    <tbody>
      ${winners
        .map(
          (winner) => `
      <tr>
        <td>${escapeHtml(winner.prize_name)}</td>
        <td>${escapeHtml(winner.guest_name)}</td>
        <td>${escapeHtml(winner.created_at)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</section>
`
  );

const renderAdminCheckins = ({
  checkinUrl,
  totalGuests,
  checkedInCount,
  checkedInGuests,
  pendingGuests,
  tables
}) => {
  const getGuestPartySize = (guest) => {
    const rawValue = guest?.responses?.attendees;
    if (!rawValue) return 1;
    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return parsed;
  };
  return adminLayout(
    "现场签到",
    `
<section class="card">
  <h1>现场签到二维码</h1>
  <p>来宾扫码即可进入签到页面。</p>
  <div class="list-item" style="align-items: flex-start; gap: 24px;">
    <div>
      <strong>签到链接</strong>
      <p><a href="${escapeHtml(checkinUrl)}" target="_blank">${escapeHtml(
        checkinUrl
      )}</a></p>
      <p class="muted">可将该链接生成二维码打印张贴在签到台。</p>
    </div>
    <div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        checkinUrl
      )}" alt="签到二维码" style="width: 180px; height: 180px; border-radius: 12px; border: 1px solid #eee;"/>
    </div>
  </div>
</section>

<section class="card">
  <h2>手动新增到场来宾</h2>
  <form method="post" action="/admin/checkins/manual" class="form-grid">
    <label>
      姓名
      <input type="text" name="name" required />
    </label>
    <label>
      手机号
      <input type="tel" name="phone" placeholder="可选" />
    </label>
    <label>
      席位号
      <input type="text" name="table_no" placeholder="可选" />
    </label>
    <label>
      实际出席人数
      <input type="number" name="actual_attendees" min="1" value="1" required />
    </label>
    <button class="btn primary" type="submit">立即签到</button>
  </form>
</section>

<section class="card">
  <h2>签到进度</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <h2>${totalGuests}</h2>
      <p>全部来宾</p>
    </div>
    <div class="stat-card accent">
      <h2>${checkedInCount}</h2>
      <p>已签到</p>
    </div>
    <div class="stat-card">
      <h2>${Math.max(totalGuests - checkedInCount, 0)}</h2>
      <p>未签到</p>
    </div>
  </div>
</section>

<section class="card">
  <h2>已签到来宾</h2>
  <table class="table">
    <thead>
      <tr>
        <th>姓名</th>
        <th>手机号</th>
        <th>席位号</th>
        <th>实际人数</th>
        <th>签到时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${
        checkedInGuests.length
          ? checkedInGuests
              .map(
                (guest) => `
      <tr${guest.attendee_adjusted ? ' class="guest-row-adjusted"' : ""}>
        <td>
          ${escapeHtml(guest.name || "-")}
          ${
            guest.attendee_adjusted
              ? `<div class="adjusted-note">人数变动，请尽快调整桌位安排。</div>`
              : ""
          }
        </td>
        <td>${escapeHtml(guest.phone || "-")}</td>
        <td>${escapeHtml(guest.table_no || "未分配")}</td>
        <td>${escapeHtml(guest.checkin?.actual_attendees || "-")}</td>
        <td>${escapeHtml(guest.checkin?.checked_in_at || "-")}</td>
        <td>
          <div class="table-actions">
            <button
              class="btn ghost"
              type="button"
              data-checkin-edit="true"
              data-guest-id="${guest.id}"
              data-guest-name="${escapeHtml(guest.name || "-")}"
              data-table-no="${escapeHtml(guest.table_no || "")}"
              data-attendees="${escapeHtml(guest.checkin?.actual_attendees || "1")}"
            >编辑</button>
            <form method="post" action="/admin/checkins/${guest.id}/cancel" class="inline-form">
              <button class="btn ghost" type="submit" onclick="return confirm('确认取消该来宾签到记录吗？');">取消签到</button>
            </form>
          </div>
        </td>
      </tr>`
              )
              .join("")
          : `<tr><td colspan="6" class="muted">暂无来宾完成签到</td></tr>`
      }
    </tbody>
  </table>
  <dialog class="modal" id="checkinEditModal">
    <form method="post" class="form-stack" id="checkinEditForm">
      <h3>编辑签到信息</h3>
      <p class="muted" id="checkinEditName"></p>
      <label>
        席位号
        <select name="table_no" id="checkinEditTableNo">
          <option value="">未分配</option>
          ${(tables || [])
            .map((table) => {
              const tableValue = String(table.table_no || "").trim();
              if (!tableValue) return "";
              const nickname = table.nickname
                ? ` · ${escapeHtml(table.nickname)}`
                : "";
              return `<option value="${escapeHtml(
                tableValue
              )}">桌 ${escapeHtml(tableValue)}${nickname}</option>`;
            })
            .join("")}
        </select>
      </label>
      <label>
        实际出席人数
        <input type="number" name="actual_attendees" id="checkinEditAttendees" min="1" value="1" required />
      </label>
      <div class="table-actions">
        <button class="btn ghost" type="button" data-modal-close="true">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  </dialog>
</section>

<section class="card">
  <h2>未签到来宾</h2>
  <table class="table">
    <thead>
      <tr>
        <th>姓名</th>
        <th>手机号</th>
        <th>席位号</th>
        <th>登记人数</th>
        <th>出席意向</th>
      </tr>
    </thead>
    <tbody>
      ${
        pendingGuests.length
          ? pendingGuests
              .map(
                (guest) => `
      <tr>
        <td>${escapeHtml(guest.name || "-")}</td>
        <td>${escapeHtml(guest.phone || "-")}</td>
        <td>${escapeHtml(guest.table_no || "未分配")}</td>
        <td>${escapeHtml(getGuestPartySize(guest))}</td>
        <td>${guest.attending ? "确认出席" : "未确认"}</td>
      </tr>`
              )
              .join("")
          : `<tr><td colspan="5" class="muted">所有来宾均已签到</td></tr>`
      }
    </tbody>
  </table>
</section>
<script>
  (() => {
    const modal = document.getElementById("checkinEditModal");
    const form = document.getElementById("checkinEditForm");
    const nameEl = document.getElementById("checkinEditName");
    const tableInput = document.getElementById("checkinEditTableNo");
    const attendeesInput = document.getElementById("checkinEditAttendees");
    if (!modal || !form || !nameEl || !tableInput || !attendeesInput) return;
    const buttons = Array.from(
      document.querySelectorAll("button[data-checkin-edit='true']")
    );
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const guestId = button.dataset.guestId;
        nameEl.textContent = button.dataset.guestName || "";
        tableInput.value = button.dataset.tableNo || "";
        attendeesInput.value = button.dataset.attendees || "1";
        form.action = "/admin/checkins/" + guestId + "/update";
        if (typeof modal.showModal === "function") {
          modal.showModal();
        } else {
          modal.setAttribute("open", "true");
        }
      });
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.close();
      }
    });
    const closeButton = modal.querySelector("[data-modal-close='true']");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        modal.close();
      });
    }
  })();
</script>
`
  );
};

const renderInvite = ({
  settings,
  sections,
  fields,
  submitted,
  submittedMode,
  submittedGuest,
  targetGuest
}) => {
  const isSubmitted = String(submitted) === "1";
  const guestFontScale = clampNumber(settings?.guest_font_scale, 1, 2.5, 1.1);
  const inviteMusicUrl = settings?.invitation_music_url || "";
  const rawWeddingDate = String(settings?.wedding_date || "").trim();
  const lunarDateEnabled = settings?.lunar_date_enabled === true;
  const heroOverlayEnabled = settings?.hero_overlay_enabled !== false;
  const heroOverlayColor = normalizeHexColor(
    settings?.hero_overlay_color,
    "#000000"
  );
  const heroOverlayOpacity = clampNumber(
    settings?.hero_overlay_opacity,
    0,
    1,
    0.6
  );
  const heroTextColor = normalizeHexColor(settings?.hero_text_color, "#ffffff");
  const heroNamePosition = normalizeHeroNamePosition(
    settings?.hero_name_position,
    "near_message"
  );
  const inviteFontBaseKey = normalizeInviteFont(settings?.invite_font_base, "system");
  const inviteFontHeadingKey = normalizeInviteFont(
    settings?.invite_font_heading,
    "songti"
  );
  const inviteFontCoupleKey = normalizeInviteFont(
    settings?.invite_font_couple,
    "kaiti"
  );
  const inviteFontCountdownKey = normalizeInviteFont(
    settings?.invite_font_countdown,
    "heiti"
  );
  const inviteFontBaseStack = getInviteFontStack(inviteFontBaseKey, "system");
  const inviteFontHeadingStack = getInviteFontStack(
    inviteFontHeadingKey,
    "songti"
  );
  const inviteFontCoupleStack = getInviteFontStack(inviteFontCoupleKey, "kaiti");
  const inviteFontCountdownStack = getInviteFontStack(
    inviteFontCountdownKey,
    "heiti"
  );
  const inviteFontPresetMap = inviteFontOptions.reduce((acc, option) => {
    acc[option.value] = option.stack;
    return acc;
  }, {});
  const textAnimationEnabled = settings?.text_animation_enabled !== false;
  const textAnimationStyle = normalizeTextAnimationStyle(
    settings?.text_animation_style,
    "fade_up"
  );
  const textAnimationDuration = clampNumber(
    settings?.text_animation_duration,
    0.3,
    3,
    0.9
  );
  const textAnimationStaggerMs = Math.round(
    clampNumber(settings?.text_animation_stagger_ms, 0, 500, 120)
  );
  const textAnimationRepeat = settings?.text_animation_repeat === true;
  const countdownEnabled = settings?.countdown_enabled !== false;
  const countdownShowHome = settings?.countdown_show_home !== false;
  const countdownShowSuccess = settings?.countdown_show_success !== false;
  const countdownTargetAt = fallbackCountdownTarget(settings);
  const hasCountdownTarget = Boolean(countdownTargetAt);
  const countdownLabel =
    String(settings?.countdown_label || "").trim() || "婚礼倒计时";
  const countdownTheme = normalizeCountdownTheme(
    settings?.countdown_theme,
    "glass"
  );
  const countdownBgColor = normalizeHexColor(
    settings?.countdown_bg_color,
    "#ffffff"
  );
  const countdownTextColor = normalizeHexColor(
    settings?.countdown_text_color,
    "#4b3c33"
  );
  const countdownAccentColor = normalizeHexColor(
    settings?.countdown_accent_color,
    "#d68aa1"
  );
  const countdownOpacity = clampNumber(settings?.countdown_opacity, 0.2, 1, 0.9);
  const countdownHomePosition = normalizeCountdownPosition(
    settings?.countdown_home_position,
    "top-right"
  );
  const countdownSuccessPosition = normalizeCountdownPosition(
    settings?.countdown_success_position,
    "top-right"
  );
  const festiveTheme = normalizeFestiveTheme(
    settings?.festive_theme,
    "classic_red"
  );
  const festiveEffectEnabled = settings?.festive_effect_enabled !== false;
  const festiveEffectStyle = normalizeFestiveEffectStyle(
    settings?.festive_effect_style,
    "lantern"
  );
  const festiveEffectIntensity = normalizeFestiveEffectIntensity(
    settings?.festive_effect_intensity,
    "normal"
  );
  const swipeHintEnabled = settings?.swipe_hint_enabled !== false;
  const swipeHintText =
    String(settings?.swipe_hint_text || "").trim() || "上滑查看下一页";
  const swipeHintPosition = normalizeSwipeHintPosition(
    settings?.swipe_hint_position,
    "bottom-center"
  );
  const swipeHintStyle = normalizeSwipeHintStyle(
    settings?.swipe_hint_style,
    "soft_glow"
  );
  const inviteRecipient = normalizeInviteRecipient(targetGuest);
  const inviteRecipientDisplayName = getInviteRecipientDisplayName(inviteRecipient);
  const isTargetedInvite = Boolean(inviteRecipient.name);
  const isOfflineQuickSubmitted = String(submittedMode || "").trim() === "offline_quick";
  const targetInviteIntroBgColor = normalizeHexColor(
    settings?.target_invite_intro_bg_color,
    "#7b1f2f"
  );
  const genericHeroMessage = "诚挚邀请您见证我们的幸福时刻";
  const invitePageTitle = buildInvitePageTitle(settings, inviteRecipient);
  const renderCountdownCard = ({ scopeClass, positionClass }) => {
    if (!countdownEnabled || !hasCountdownTarget) return "";
    return `<div class="countdown-card countdown-theme-${escapeHtml(
      countdownTheme
    )} ${escapeHtml(scopeClass)} countdown-pos-${escapeHtml(
      positionClass
    )}" data-countdown-target="${escapeHtml(countdownTargetAt)}">
      <div class="countdown-title">${escapeHtml(countdownLabel)}</div>
      ${
        lunarDateEnabled
          ? `<div class="countdown-lunar-date" data-lunar-raw="${escapeHtml(
              countdownTargetAt
            )}" hidden></div>`
          : ""
      }
      <div class="countdown-grid">
        <div class="countdown-item">
          <span data-countdown-part="days">--</span>
          <small>天</small>
        </div>
        <div class="countdown-item">
          <span data-countdown-part="hours">--</span>
          <small>时</small>
        </div>
        <div class="countdown-item">
          <span data-countdown-part="minutes">--</span>
          <small>分</small>
        </div>
        <div class="countdown-item">
          <span data-countdown-part="seconds">--</span>
          <small>秒</small>
        </div>
      </div>
      <div class="countdown-finished" data-countdown-finished hidden>今天就是婚礼日，欢迎赴约</div>
    </div>`;
  };
  const heroCountdownHtml =
    countdownShowHome && !isSubmitted
      ? renderCountdownCard({
          scopeClass: "countdown-home",
          positionClass: countdownHomePosition
        })
      : "";
  const successCountdownHtml =
    countdownShowSuccess && isSubmitted
      ? renderCountdownCard({
          scopeClass: "countdown-success",
          positionClass: countdownSuccessPosition
        })
      : "";
  const hasSuccessCountdown = Boolean(successCountdownHtml);
  const heroOverlayRgb = hexToRgbTuple(heroOverlayColor, "#000000");
  const heroTextRgb = hexToRgbTuple(heroTextColor, "#ffffff");
  const effectiveHeroOverlayOpacity = heroOverlayEnabled ? heroOverlayOpacity : 0;
  const [coupleNameLine1, coupleNameLine2] = getCoupleNameLines(
    settings?.couple_name || ""
  );
  const mapLinks = buildInviteMapLinks(settings);
  const routeImageUrls = getWeddingRouteImageUrls(settings);
  const hasMapChooser = mapLinks.length > 0 || routeImageUrls.length > 0;
  const orderedGuestFields = getOrderedGuestCollectionFields({ settings, fields });
  const mapChooserDialogHtml = hasMapChooser
    ? `<dialog class="map-chooser-dialog" id="inviteMapChooser">
        <div class="map-chooser-head">
          <strong>地图导航与路线指引</strong>
          <button class="map-chooser-close" type="button" data-map-chooser-close>关闭</button>
        </div>
        <p class="map-chooser-location">${escapeHtml(
          settings.wedding_location || "婚礼地点"
        )}</p>
        ${
          routeImageUrls.length
            ? `<div class="map-route-gallery">
                ${routeImageUrls
                  .map(
                    (url) => `<a href="${escapeHtml(
                      url
                    )}" target="_blank" rel="noopener noreferrer">
                        <img src="${escapeHtml(url)}" alt="实景路线图" loading="lazy" />
                      </a>`
                  )
                  .join("")}
              </div>`
            : ""
        }
        <div class="map-chooser-list">
          ${
            mapLinks.length
              ? mapLinks
                  .map(
                    (item) => `<a class="map-chooser-link" href="${escapeHtml(
                      item.url
                    )}" target="_blank" rel="noopener noreferrer" data-map-chooser-link>
                      ${escapeHtml(item.label)}
                    </a>`
                  )
                  .join("")
              : `<div class="muted">暂未配置地图链接。</div>`
          }
        </div>
      </dialog>`
    : "";
  const heroImageUrl =
    settings?.hero_image_url ||
    "https://images.unsplash.com/photo-1505489304219-85ce17010209?q=80&w=1600&auto=format&fit=crop";
  return `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>${escapeHtml(invitePageTitle)}</title>
    <meta property="og:title" content="${escapeHtml(invitePageTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(
      invitePageTitle
    )}" />
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/invite.css" />
  </head>
  <body
    data-text-animation-enabled="${textAnimationEnabled ? "true" : "false"}"
    data-text-animation-style="${escapeHtml(textAnimationStyle)}"
    data-text-animation-repeat="${textAnimationRepeat ? "true" : "false"}"
    data-lunar-enabled="${lunarDateEnabled ? "true" : "false"}"
    data-festive-theme="${escapeHtml(festiveTheme)}"
    data-festive-effect-enabled="${festiveEffectEnabled ? "true" : "false"}"
    data-festive-effect-style="${escapeHtml(festiveEffectStyle)}"
    data-festive-effect-intensity="${escapeHtml(festiveEffectIntensity)}"
    data-font-base-key="${escapeHtml(inviteFontBaseKey)}"
    data-font-heading-key="${escapeHtml(inviteFontHeadingKey)}"
    data-font-couple-key="${escapeHtml(inviteFontCoupleKey)}"
    data-font-countdown-key="${escapeHtml(inviteFontCountdownKey)}"
    data-targeted-invite="${isTargetedInvite ? "true" : "false"}"
    data-submitted-state="${isSubmitted ? "true" : "false"}"
    style="--guest-font-scale: ${guestFontScale}; --hero-text-color: ${heroTextColor}; --hero-text-color-rgb: ${heroTextRgb}; --hero-overlay-color-rgb: ${heroOverlayRgb}; --hero-overlay-opacity: ${effectiveHeroOverlayOpacity}; --invite-font-base: ${escapeHtml(
      inviteFontBaseStack
    )}; --invite-font-heading: ${escapeHtml(
      inviteFontHeadingStack
    )}; --invite-font-couple: ${escapeHtml(
      inviteFontCoupleStack
    )}; --invite-font-countdown: ${escapeHtml(
      inviteFontCountdownStack
    )}; --text-anim-duration: ${escapeHtml(
      textAnimationDuration.toFixed(2)
    )}s; --text-anim-stagger: ${escapeHtml(
      String(textAnimationStaggerMs)
    )}ms; --countdown-bg-color: ${escapeHtml(
      countdownBgColor
    )}; --countdown-text-color: ${escapeHtml(
      countdownTextColor
    )}; --countdown-accent-color: ${escapeHtml(
      countdownAccentColor
    )}; --countdown-card-opacity: ${escapeHtml(
      countdownOpacity.toFixed(2)
    )};"
  >
    <div class="invite">
      <div class="festive-layer" aria-hidden="true">
        <div class="festive-ribbon"></div>
        <div class="festive-corners" id="festiveCornerGroup"></div>
        <div class="festive-particles" id="festiveParticles"></div>
      </div>
      ${
        inviteMusicUrl
          ? `<button class="music-toggle" type="button" data-invite-music-toggle="true" aria-label="播放背景音乐">
              <span class="music-icon">♪</span>
            </button>
            <audio id="inviteMusic" src="${escapeHtml(
              inviteMusicUrl
            )}" loop preload="auto"></audio>`
          : ""
      }
      ${renderPublicLogoBadge({
        href: "/invite",
        className: "public-site-logo invite-site-logo"
      })}

      ${
            isSubmitted
              ? `<div class="invite-success ${
                hasSuccessCountdown
                  ? `has-countdown countdown-success-layout-${escapeHtml(
                      countdownSuccessPosition
                    )}`
                  : ""
              }">
            ${successCountdownHtml}
            <div class="invite-success-text invite-text-anim" data-text-anim="true" style="--text-anim-order:2;">
              ${isOfflineQuickSubmitted
                ? `${inviteRecipientDisplayName ? `${escapeHtml(inviteRecipientDisplayName)}，` : ""}已为您登记“线下沟通确认出席”。<br>后续管理员会根据线下沟通内容补充详细信息。`
                : `${inviteRecipientDisplayName ? `${escapeHtml(inviteRecipientDisplayName)}，` : ""}已收到您的信息，感谢祝福！<br>期待与您及亲朋在婚礼现场相见。`}
            </div>
            <div class="invite-success-card invite-text-anim" data-text-anim="true" style="--text-anim-order:3;">
              <canvas id="inviteCardCanvas" width="720" height="480"></canvas>
            </div>
	            <div class="invite-success-actions invite-text-anim" data-text-anim="true" style="--text-anim-order:4;">
	              <a class="btn primary invite-success-main-btn" id="inviteCardDownload" href="#">下载婚礼信息卡</a>
	            </div>
              ${
                hasMapChooser
                  ? `<div class="invite-success-map-row invite-text-anim" data-text-anim="true" style="--text-anim-order:5;">
                       <button class="btn primary invite-success-main-btn invite-success-map-btn" type="button" data-map-chooser-open="true">查看地图导航</button>
                     </div>`
                  : ""
              }
            <div class="invite-success-note invite-text-anim" data-text-anim="true" style="--text-anim-order:6;">
              如填写错误，您可随时通过请柬链接重填
            </div>
          </div>`
              : `

      ${
        isTargetedInvite
          ? `<section class="target-invite-intro" style="background:${escapeHtml(
              targetInviteIntroBgColor
            )}">
              <div class="target-invite-intro-inner">
                <h2 class="target-invite-intro-title invite-text-anim" data-text-anim="true" style="--text-anim-order:1;">专属定向请柬</h2>
                <p class="target-invite-intro-message invite-text-anim" data-text-anim="true" style="--text-anim-order:2;">
                  诚挚邀请<strong>${escapeHtml(inviteRecipientDisplayName)}</strong><br/>
                  见证我们的幸福时刻<br/>
                  <span>继续下滑查看请柬内容</span>
                </p>
              </div>
            </section>`
          : ""
      }
      <section class="hero" style="background-image: url('${escapeHtml(
        heroImageUrl
      )}')">
        <div class="hero-overlay hero-name-position-${escapeHtml(
          heroNamePosition
        )}">
          ${heroCountdownHtml}
          <h1 class="couple-name invite-text-anim" data-text-anim="true" style="--text-anim-order:2;">
            <span>${escapeHtml(coupleNameLine1)}</span>
            ${
              coupleNameLine2
                ? `<span class="couple-separator">&amp;</span>
                   <span>${escapeHtml(coupleNameLine2)}</span>`
                : ""
            }
          </h1>
          <div class="hero-main-text">
            <p class="hero-message invite-text-anim" data-text-anim="true" style="--text-anim-order:3;">${escapeHtml(
              genericHeroMessage
            )}</p>
            <div class="hero-meta invite-text-anim" data-text-anim="true" style="--text-anim-order:4;">
              <span>${escapeHtml(settings.wedding_date || "")}</span>
              ${
                lunarDateEnabled
                  ? `<span class="hero-lunar-date" data-lunar-raw="${escapeHtml(
                      rawWeddingDate
                    )}" hidden></span>`
                  : ""
              }
              <span>${escapeHtml(settings.wedding_location || "")}</span>
              ${
                hasMapChooser
                  ? `<button class="hero-map-open" type="button" data-map-chooser-open="true">地图导航</button>`
                  : ""
              }
            </div>
          </div>
          ${
            swipeHintEnabled
              ? `<button class="swipe-hint swipe-hint-pos-${escapeHtml(
                  swipeHintPosition
                )} swipe-hint-style-${escapeHtml(
                  swipeHintStyle
                )}" type="button" data-swipe-hint="true">
                  <span class="swipe-hint-text">${escapeHtml(swipeHintText)}</span>
                  <span class="swipe-hint-arrows" aria-hidden="true">
                    <i></i>
                    <i></i>
                  </span>
                </button>`
              : ""
          }
        </div>
      </section>

      <div class="sections">
        ${sections
          .map((section) => {
            const bgStyle = getSectionBackgroundStyle(section.background_mode);
            return `
        <section class="story" style="background-image: url('${escapeHtml(
          section.image_url || ""
        )}'); --story-bg-size: ${escapeHtml(
              bgStyle.size
            )}; --story-bg-repeat: ${escapeHtml(
              bgStyle.repeat
            )}; --story-bg-position: ${escapeHtml(bgStyle.position)};">
          <div class="story-card">
            <h2 class="invite-text-anim" data-text-anim="true" style="--text-anim-order:1;">${escapeHtml(
              section.title
            )}</h2>
            <p class="invite-text-anim" data-text-anim="true" style="--text-anim-order:2;">${escapeHtml(
              section.body
            ).replaceAll("\n", "<br/>")}</p>
          </div>
        </section>`;
          })
          .join("")}
      </div>

	      <section class="rsvp" id="rsvp">
	        <div class="rsvp-card">
	          <h2 class="invite-text-anim" data-text-anim="true" style="--text-anim-order:1;">填写来宾信息</h2>
            ${
              isTargetedInvite
                ? `<div class="invite-text-anim" data-text-anim="true" style="--text-anim-order:1.5;">
                    <form method="post" action="/invite/quick-rsvp" class="inline-form target-quick-rsvp-form">
                      <input type="hidden" name="target_name" value="${escapeHtml(
                        inviteRecipient.name
                      )}" />
                      <input type="hidden" name="target_title" value="${escapeHtml(
                        inviteRecipient.title
                      )}" />
                      <button class="btn primary target-quick-rsvp-btn" type="submit">我不填写，已线下沟通</button>
                    </form>
                  </div>`
                : ""
            }
	          <form method="post" action="/invite/rsvp" class="form-stack">
              <input type="hidden" name="target_name" value="${escapeHtml(
                inviteRecipient.name
              )}" />
              <input type="hidden" name="target_title" value="${escapeHtml(
                inviteRecipient.title
              )}" />
	            ${orderedGuestFields
                .map((field) => {
                  if (field.is_builtin && field.field_key === "name") {
                    return `<label>
                      姓名
                      <input type="text" name="name" value="${escapeHtml(
                        inviteRecipient.name || ""
                      )}" ${isTargetedInvite ? "readonly" : ""} required />
                    </label>`;
                  }
                  if (field.is_builtin && field.field_key === "phone") {
                    return `<label>
                      手机号
                      <input type="tel" name="phone" required />
                    </label>`;
                  }
                  if (field.is_builtin && field.field_key === "attendees") {
                    return `<label>
                      出席人数
                      ${renderInviteAttendeeSelect({
                        name: "attendees",
                        required: true
                      })}
                    </label>`;
                  }
                  if (field.is_builtin && field.field_key === "attending") {
                    return `<label>
                      出席情况
                      ${renderAttendingSelect({
                        name: "attending",
                        value: true,
                        required: true
                      })}
                    </label>`;
                  }
                  return renderCustomFieldInput({ field });
                })
                .join("")}
	            <button class="btn primary" type="submit" style="font-size:large">提交信息</button>
	          </form>
	        </div>
	      </section>

	      `
	      }
      ${mapChooserDialogHtml}
	    </div>
	  </body>
  <script>
    (() => {
      const presetMap = ${JSON.stringify(inviteFontPresetMap)};
      const bodyEl = document.body;
      if (!bodyEl) return;
      const readKey = (name, fallback) => {
        const value = String(bodyEl.getAttribute(name) || "")
          .trim()
          .toLowerCase();
        if (!value) return fallback;
        return Object.prototype.hasOwnProperty.call(presetMap, value)
          ? value
          : fallback;
      };
      bodyEl.style.setProperty(
        "--invite-font-base",
        presetMap[readKey("data-font-base-key", "system")]
      );
      bodyEl.style.setProperty(
        "--invite-font-heading",
        presetMap[readKey("data-font-heading-key", "songti")]
      );
      bodyEl.style.setProperty(
        "--invite-font-couple",
        presetMap[readKey("data-font-couple-key", "kaiti")]
      );
      bodyEl.style.setProperty(
        "--invite-font-countdown",
        presetMap[readKey("data-font-countdown-key", "heiti")]
      );
    })();

    ${attendeePickerScript}
    ${renderInviteSuccessScript(settings, submitted, submittedGuest)}
    (() => {
      const musicButton = document.querySelector("[data-invite-music-toggle]");
      const audio = document.getElementById("inviteMusic");
      if (!musicButton || !audio) return;
      let userPaused = false;

      const setState = (isPlaying) => {
        musicButton.classList.toggle("is-playing", isPlaying);
        musicButton.setAttribute(
          "aria-label",
          isPlaying ? "暂停背景音乐" : "播放背景音乐"
        );
      };

      const tryPlay = () => {
        audio.muted = false;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(() => setState(true)).catch(() => setState(false));
        } else {
          setState(!audio.paused);
        }
      };

      const unlockPlay = () => {
        if (!userPaused && audio.paused) {
          tryPlay();
        }
      };

      tryPlay();

      musicButton.addEventListener("click", () => {
        if (audio.paused) {
          userPaused = false;
          tryPlay();
        } else {
          userPaused = true;
          audio.pause();
          setState(false);
        }
      });

      audio.addEventListener("play", () => setState(true));
      audio.addEventListener("pause", () => {
        if (!userPaused) {
          setState(false);
        }
      });

      document.addEventListener("click", unlockPlay, { once: true });
      document.addEventListener("touchstart", unlockPlay, { once: true });
    })();

    (() => {
      const cards = Array.from(document.querySelectorAll("[data-countdown-target]"));
      if (!cards.length) return;

      const pad = (value) => String(Math.max(0, value)).padStart(2, "0");
      const syncSuccessCountdownLayout = () => {
        const successPanels = Array.from(
          document.querySelectorAll(".invite-success.has-countdown")
        );
        successPanels.forEach((panel) => {
          const className = panel.className || "";
          const isTop = /countdown-success-layout-top-/.test(className);
          if (!isTop) {
            panel.style.removeProperty("--success-countdown-clearance");
            return;
          }
          const card = panel.querySelector(".countdown-success");
          if (!card) return;
          const height = Math.ceil(card.getBoundingClientRect().height || 0);
          if (height <= 0) return;
          panel.style.setProperty(
            "--success-countdown-clearance",
            String(height + 28) + "px"
          );
        });
      };
      const resolveTarget = (value) => {
        const normalized = String(value || "").trim();
        if (!normalized) return null;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
          return new Date(normalized + ":00");
        }
        return new Date(normalized);
      };

      const renderCard = (card) => {
        const target = resolveTarget(card.dataset.countdownTarget);
        if (!target || Number.isNaN(target.getTime())) return;
        const now = new Date();
        const diff = target.getTime() - now.getTime();
        const finished = diff <= 0;
        const rest = finished ? 0 : diff;
        const days = Math.floor(rest / (24 * 60 * 60 * 1000));
        const hours = Math.floor((rest / (60 * 60 * 1000)) % 24);
        const minutes = Math.floor((rest / (60 * 1000)) % 60);
        const seconds = Math.floor((rest / 1000) % 60);
        const updates = { days, hours, minutes, seconds };
        Object.entries(updates).forEach(([key, value]) => {
          const node = card.querySelector('[data-countdown-part="' + key + '"]');
          if (node) node.textContent = key === "days" ? String(value) : pad(value);
        });
        const finishedNode = card.querySelector("[data-countdown-finished]");
        if (finishedNode) {
          finishedNode.hidden = !finished;
        }
      };

      const tick = () => {
        cards.forEach((card) => renderCard(card));
      };

      tick();
      syncSuccessCountdownLayout();
      window.__syncInviteCountdownLayout = syncSuccessCountdownLayout;
      window.addEventListener("resize", syncSuccessCountdownLayout);
      window.setInterval(tick, 1000);
    })();

    (() => {
      const enabled = document.body.dataset.lunarEnabled === "true";
      if (!enabled) return;
      const targets = Array.from(document.querySelectorAll("[data-lunar-raw]"));
      if (!targets.length) return;

      const parseDate = (raw) => {
        const normalized = String(raw || "").trim();
        if (!normalized) return null;
        const zhDateTime = normalized.match(
          /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:：](\d{2})/
        );
        if (zhDateTime) {
          return new Date(
            Number(zhDateTime[1]),
            Number(zhDateTime[2]) - 1,
            Number(zhDateTime[3]),
            Number(zhDateTime[4]),
            Number(zhDateTime[5])
          );
        }
        const zhDate = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (zhDate) {
          return new Date(
            Number(zhDate[1]),
            Number(zhDate[2]) - 1,
            Number(zhDate[3]),
            12,
            0
          );
        }
        const isoDateTime = normalized.match(
          /(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/
        );
        if (isoDateTime) {
          return new Date(
            Number(isoDateTime[1]),
            Number(isoDateTime[2]) - 1,
            Number(isoDateTime[3]),
            Number(isoDateTime[4]),
            Number(isoDateTime[5])
          );
        }
        const isoDate = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (isoDate) {
          return new Date(
            Number(isoDate[1]),
            Number(isoDate[2]) - 1,
            Number(isoDate[3]),
            12,
            0
          );
        }
        return new Date(normalized.replace(" ", "T"));
      };

      const toLunarLabel = (date) => {
        if (!date || Number.isNaN(date.getTime())) return "";
        try {
          const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
            year: "numeric",
            month: "long",
            day: "numeric"
          }).format(date);
          return "农历 " + lunar;
        } catch (error) {
          return "";
        }
      };

      targets.forEach((target) => {
        const parsed = parseDate(target.dataset.lunarRaw);
        if (!parsed || Number.isNaN(parsed.getTime())) return;
        const label = toLunarLabel(parsed);
        if (!label) return;
        target.textContent = label;
        target.hidden = false;
      });

      if (typeof window.__syncInviteCountdownLayout === "function") {
        window.__syncInviteCountdownLayout();
      }
    })();

    ${renderFestiveLayerScript()}

    (() => {
      const container = document.querySelector(".invite");
      const introSection = document.querySelector(".target-invite-intro");
      if (!container) return;
      const isTargeted = document.body.dataset.targetedInvite === "true";
      const isSubmittedState = document.body.dataset.submittedState === "true";
      if (!isTargeted || isSubmittedState || !introSection) return;
      if (window.location.hash) return;
      const focusIntro = () => {
        if (typeof introSection.scrollIntoView === "function") {
          introSection.scrollIntoView({ block: "start", behavior: "auto" });
        } else {
          container.scrollTop = 0;
        }
      };
      // Force dedicated intro page to be visible first in targeted mode.
      focusIntro();
      window.requestAnimationFrame(focusIntro);
      window.setTimeout(focusIntro, 80);
    })();

    (() => {
      const nodes = Array.from(document.querySelectorAll("[data-text-anim='true']"));
      if (!nodes.length) return;
      const enabled = document.body.dataset.textAnimationEnabled === "true";
      if (!enabled) {
        nodes.forEach((node) => node.classList.add("is-visible"));
        return;
      }
      if (typeof IntersectionObserver !== "function") {
        nodes.forEach((node) => node.classList.add("is-visible"));
        return;
      }
      const repeat = document.body.dataset.textAnimationRepeat === "true";
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
            } else if (repeat) {
              entry.target.classList.remove("is-visible");
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
      );
      nodes.forEach((node) => observer.observe(node));
    })();

    (() => {
      const hint = document.querySelector("[data-swipe-hint='true']");
      const container = document.querySelector(".invite");
      const hero = document.querySelector(".hero");
      if (!hint || !container || !hero) return;

      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        hint.classList.add("is-hidden");
      };

      const reveal = () => {
        if (dismissed) return;
        hint.classList.add("is-visible");
      };
      window.setTimeout(reveal, 320);

      const scrollToNextSection = () => {
        const nextSection =
          container.querySelector(".story") ||
          container.querySelector(".rsvp");
        if (nextSection && typeof nextSection.scrollIntoView === "function") {
          nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        dismiss();
      };

      hint.addEventListener("click", (event) => {
        if (event) event.preventDefault();
        scrollToNextSection();
      });

      container.addEventListener(
        "scroll",
        () => {
          if (container.scrollTop > 26) dismiss();
        },
        { passive: true }
      );

      container.addEventListener(
        "wheel",
        () => {
          dismiss();
        },
        { passive: true, once: true }
      );

      if (typeof IntersectionObserver !== "function") return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.62) {
              dismiss();
              observer.disconnect();
            }
          });
        },
        { root: container, threshold: [0.62] }
      );
      observer.observe(hero);
    })();

    (() => {
      const openButtons = Array.from(
        document.querySelectorAll("[data-map-chooser-open='true']")
      );
      const dialog = document.getElementById("inviteMapChooser");
      if (!openButtons.length || !dialog) return;

      const closeDialog = () => {
        if (typeof dialog.close === "function") {
          dialog.close();
          return;
        }
        dialog.removeAttribute("open");
      };

      const openDialog = () => {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
          return;
        }
        dialog.setAttribute("open", "true");
      };

      openButtons.forEach((button) => {
        button.addEventListener("click", openDialog);
      });
      dialog.querySelectorAll("[data-map-chooser-close]").forEach((button) => {
        button.addEventListener("click", closeDialog);
      });
      dialog.querySelectorAll("[data-map-chooser-link]").forEach((link) => {
        link.addEventListener("click", () => {
          setTimeout(closeDialog, 50);
        });
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          closeDialog();
        }
      });
    })();
  </script>
</html>
`;
};

const renderCheckin = ({
  settings,
  fields,
  error,
  result,
  prompt,
  formValues,
  newGuestForm,
  disambiguation = null
}) => {
  const guestFontScale = clampNumber(settings?.guest_font_scale, 1, 2.5, 1.1);
  const festiveTheme = normalizeFestiveTheme(
    settings?.festive_theme,
    "classic_red"
  );
  const festiveEffectEnabled = settings?.festive_effect_enabled !== false;
  const festiveEffectStyle = normalizeFestiveEffectStyle(
    settings?.festive_effect_style,
    "lantern"
  );
  const festiveEffectIntensity = normalizeFestiveEffectIntensity(
    settings?.festive_effect_intensity,
    "normal"
  );
  const checkinPageTitle = buildPublicPageTitle(settings, "来宾登记");
  const disambiguationMatches = Array.isArray(disambiguation?.matches)
    ? disambiguation.matches.filter(
        (item) =>
          Number.isFinite(Number(item?.id)) && Number(item.id) > 0
      )
    : [];
  const selectedGuestIdValue = String(formValues?.selected_guest_id || "").trim();
  const disambiguationHtml = disambiguationMatches.length
    ? `<div class="prompt-card disambiguation-card">
          <div class="prompt-title">匹配到多位来宾，请再确认手机号</div>
          <p>我们为你匹配到了多位「${escapeHtml(
            disambiguation?.lookup || formValues?.lookup || ""
          )}」，请选择对应手机号后继续签到。</p>
          <form method="post" action="/checkin" class="form-stack">
            <input type="hidden" name="lookup" value="${escapeHtml(
              formValues?.lookup || ""
            )}" />
            <input type="hidden" name="actual_attendees" value="${escapeHtml(
              formValues?.actual_attendees || "1"
            )}" />
            <input type="hidden" name="confirm_attending" value="on" />
            <div class="disambiguation-list">
              ${disambiguationMatches
                .map((item, index) => {
                  const isChecked = selectedGuestIdValue
                    ? selectedGuestIdValue === String(item.id || "")
                    : index === 0;
                  return `<label class="disambiguation-option">
                      <input type="radio" name="selected_guest_id" value="${escapeHtml(
                        String(item.id || "")
                      )}" ${isChecked ? "checked" : ""} required />
                      <span class="disambiguation-text">
                        <span class="disambiguation-main">${escapeHtml(
                          item.phone_display || "手机号未登记"
                        )}</span>
                        <span class="disambiguation-meta">${escapeHtml(
                          item.meta || "请核对手机号后选择"
                        )}</span>
                      </span>
                    </label>`;
                })
                .join("")}
            </div>
            <div class="prompt-actions">
              <button class="btn primary" type="submit">确认并签到</button>
              <a class="btn ghost" href="/checkin">重新填写</a>
              <button class="btn ghost" type="submit" name="start_new" value="1">都不是我，登记新来宾</button>
            </div>
          </form>
          <p class="muted">小提示：如发现手机号有误，可请现场工作人员协助。</p>
        </div>`
    : "";
  return `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>${escapeHtml(checkinPageTitle)}</title>
    <meta property="og:title" content="${escapeHtml(checkinPageTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(
      checkinPageTitle
    )}" />
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/checkin.css" />
  </head>
  <body
    data-festive-theme="${escapeHtml(festiveTheme)}"
    data-festive-effect-enabled="${festiveEffectEnabled ? "true" : "false"}"
    data-festive-effect-style="${escapeHtml(festiveEffectStyle)}"
    data-festive-effect-intensity="${escapeHtml(festiveEffectIntensity)}"
    style="--guest-font-scale: ${guestFontScale};"
  >
    <div class="festive-layer" aria-hidden="true">
      <div class="festive-ribbon"></div>
      <div class="festive-corners" id="checkinFestiveCornerGroup"></div>
      <div class="festive-particles" id="checkinFestiveParticles"></div>
    </div>
    ${renderPublicLogoBadge({
      href: "/checkin",
      className: "public-site-logo checkin-site-logo"
    })}
    <div class="checkin-page">
      <header class="checkin-hero">
        <div class="hero-card">
          <h1>${escapeHtml(settings.couple_name || "")}</h1>
          <p>${escapeHtml(settings.hero_message || "")}</p>
          <div class="hero-meta">
            <span>${escapeHtml(settings.wedding_date || "")}</span>
            <span>${escapeHtml(settings.wedding_location || "")}</span>
          </div>
        </div>
      </header>

      <section class="checkin-card">
        <h2>现场签到</h2>
        <p class="muted">请输入姓名或手机号完成现场签到。</p>
        <div class="notice">签到信息将用于现场抽奖，请谨慎确认填写。</div>
        ${
          error
            ? `<div class="alert">${escapeHtml(error)}</div>`
            : ""
        }
        ${disambiguationHtml}
        ${
          prompt
            ? `<div class="prompt-card">
              <div class="prompt-title">需要确认</div>
              <p>${escapeHtml(prompt.message || "")}</p>
              <div class="prompt-actions">
                <a class="btn ghost" href="/checkin">重新填写</a>
                <form method="post" action="/checkin">
                  <input type="hidden" name="start_new" value="1" />
                  <input type="hidden" name="lookup" value="${escapeHtml(
                    formValues?.lookup || ""
                  )}" />
                  <input type="hidden" name="actual_attendees" value="${escapeHtml(
                    formValues?.actual_attendees || "1"
                  )}" />
                  <input type="hidden" name="confirm_attending" value="on" />
                  <button class="btn primary" type="submit">登记新来宾</button>
                </form>
              </div>
            </div>`
            : ""
        }
        ${
          newGuestForm
            ? `<div class="prompt-card">
              <div class="prompt-title">登记新来宾信息</div>
              <p class="muted">请按照请柬模板填写信息后继续签到。</p>
              <form method="post" action="/checkin" class="form-stack">
                <input type="hidden" name="new_guest" value="1" />
                <input type="hidden" name="actual_attendees" value="${escapeHtml(
                  formValues?.actual_attendees || "1"
                )}" />
                <label>
                  姓名
                  <input type="text" name="name" value="${escapeHtml(
                    formValues?.name || ""
                  )}" required />
                </label>
                <label>
                  手机号
                  <input type="tel" name="phone" value="${escapeHtml(
                    formValues?.phone || ""
                  )}" required />
                </label>
                ${(fields || [])
                  .map((field) =>
                    renderCustomFieldInput({
                      field,
                      value: formValues?.[field.field_key] || ""
                    })
                  )
                  .join("")}
                <label class="inline">
                  <input type="checkbox" name="confirm_attending" required ${
                    formValues?.confirm_attending ? "checked" : ""
                  } />
                  我已到场并确认出席
                </label>
                <div class="table-actions">
                  <a class="btn ghost" href="/checkin">返回</a>
                  <button class="btn primary" type="submit">完成签到</button>
                </div>
              </form>
            </div>`
            : ""
        }
        ${
          result
            ? `<div class="result-card">
              <div class="result-title">签到成功，欢迎光临！</div>
              <div class="result-info">
                <div>
                  <strong>姓名</strong>
                  <span>${escapeHtml(result.name || "-")}</span>
                </div>
                <div>
                  <strong>桌号</strong>
                  <span>${escapeHtml(result.table_no || "未分配")}</span>
                </div>
                <div>
                  <strong>出席人数</strong>
                  <span>${escapeHtml(result.actual_attendees || "-")}</span>
                </div>
                <div>
                  <strong>签到时间</strong>
                  <span>${escapeHtml(result.checked_in_at || "-")}</span>
                </div>
              </div>
            </div>
            <div class="souvenir-section">
              <div class="souvenir-title">签到纪念卡</div>
              <div class="souvenir-card" data-couple="${escapeHtml(
                settings.couple_name || ""
              )}" data-location="${escapeHtml(
                settings.wedding_location || ""
              )}" data-date="${escapeHtml(
                settings.wedding_date || ""
              )}" data-guest="${escapeHtml(
                result.name || ""
              )}" data-time="${escapeHtml(
                result.checked_in_at || ""
              )}" data-table="${escapeHtml(
                result.table_no || "未分配"
              )}" data-attendees="${escapeHtml(
                result.actual_attendees || "1"
              )}">
                <canvas id="souvenirCanvas" width="720" height="960"></canvas>
              </div>
              <div class="souvenir-actions">
                <a class="btn primary" id="downloadSouvenir" href="#" download="签到纪念卡.png">下载纪念卡</a>
                <p class="muted">提示：可长按图片保存或截图留念。</p>
              </div>
            </div>`
            : ""
        }
        ${
          newGuestForm
            ? ""
            : `<form method="post" action="/checkin" class="form-stack">
          <label>
            姓名或手机号
            <input type="text" name="lookup" placeholder="请输入姓名或手机号" value="${escapeHtml(
              formValues?.lookup || ""
            )}" />
          </label>
          <label>
            实际出席人数
            <input type="number" name="actual_attendees" min="1" value="${escapeHtml(
              formValues?.actual_attendees || "1"
            )}" required />
          </label>
          <label class="inline">
            <input type="checkbox" name="confirm_attending" required ${
              formValues?.confirm_attending ? "checked" : ""
            } />
            我已到场并确认出席
          </label>
          <button class="btn primary" type="submit">确认签到</button>
        </form>`
        }
      </section>
    </div>
    <script>
      ${renderFestiveLayerScript({
        cornerContainerId: "checkinFestiveCornerGroup",
        particleContainerId: "checkinFestiveParticles"
      })}
    </script>
    ${
      result
        ? `<script>
      (() => {
        const card = document.querySelector(".souvenir-card");
        const canvas = document.getElementById("souvenirCanvas");
        if (!card || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const data = {
          couple: card.dataset.couple || "",
          location: card.dataset.location || "",
          date: card.dataset.date || "",
          guest: card.dataset.guest || "",
          time: card.dataset.time || "",
          table: card.dataset.table || "",
          attendees: card.dataset.attendees || ""
        };

        const toLocalTime = (value) => {
          if (!value) return "";
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) return value;
          return parsed.toLocaleString("zh-CN", { hour12: false });
        };

        const width = canvas.width;
        const height = canvas.height;
        const radius = 32;
        ctx.clearRect(0, 0, width, height);

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#fff1f6");
        gradient.addColorStop(0.5, "#f5f7ff");
        gradient.addColorStop(1, "#fef9f2");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const roundRect = (x, y, w, h, r) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        };

        ctx.save();
        roundRect(56, 80, width - 112, height - 160, radius);
        ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#5c3d45";
        ctx.font = "bold 36px 'Playfair Display', 'PingFang SC', serif";
        ctx.textAlign = "center";
        ctx.fillText("婚礼纪念卡", width / 2, 170);

        ctx.font = "600 28px 'PingFang SC', 'Inter', sans-serif";
        ctx.fillStyle = "#7a5760";
        ctx.fillText(data.couple || "新人姓名", width / 2, 225);

        ctx.font = "500 20px 'PingFang SC', 'Inter', sans-serif";
        ctx.fillStyle = "#9b7a84";
        ctx.fillText(data.date || "婚礼日期", width / 2, 262);
        ctx.fillText(data.location || "婚礼地点", width / 2, 292);

        const infoItems = [
          { label: "来宾姓名", value: data.guest || "来宾" },
          { label: "签到时间", value: toLocalTime(data.time) || "-" },
          { label: "席位号", value: data.table || "未分配" },
          { label: "出席人数", value: data.attendees || "-" }
        ];

        const startY = 380;
        const boxHeight = 110;
        infoItems.forEach((item, index) => {
          const y = startY + index * boxHeight;
          ctx.save();
          roundRect(120, y, width - 240, 86, 20);
          ctx.fillStyle = "#fdf6f8";
          ctx.shadowColor = "rgba(255, 182, 193, 0.3)";
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.restore();

          ctx.fillStyle = "#8a6b73";
          ctx.font = "600 18px 'PingFang SC', 'Inter', sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(item.label, 160, y + 30);
          ctx.fillStyle = "#4f3239";
          ctx.font = "600 24px 'PingFang SC', 'Inter', sans-serif";
          ctx.fillText(item.value, 160, y + 62);
        });

        ctx.fillStyle = "#b08d96";
        ctx.font = "500 18px 'PingFang SC', 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("愿今日美好永存 · 感谢您的到来", width / 2, height - 110);

        const link = document.getElementById("downloadSouvenir");
        if (link) {
          link.href = canvas.toDataURL("image/png");
        }
      })();
    </script>`
        : ""
    }
  </body>
</html>
`;
};

const renderLottery = ({ prizes, isAdmin, guests, winners }) => {
  const winnerGuestIds = new Set((winners || []).map((winner) => winner.guest_id));
  const eligibleGuests = (guests || []).filter(
    (guest) => !winnerGuestIds.has(guest.id)
  );
  const prizeSummaries = (prizes || []).map((prize) => {
    const prizeWinners = (winners || []).filter(
      (winner) => winner.prize_id === prize.id
    );
    const remaining = Math.max(prize.quantity - prizeWinners.length, 0);
    return { ...prize, remaining };
  });
  const recentWinners = (winners || [])
    .slice(-6)
    .reverse()
    .map((winner) => ({
      ...winner,
      prize_name: winner.prize_name || "",
      guest_name: winner.guest_name || ""
    }));
  return `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>婚礼现场摇奖</title>
    ${renderFaviconLinks()}
    <link rel="stylesheet" href="/public/css/lottery.css" />
  </head>
  <body>
    <div class="lottery-screen">
      <a class="lottery-site-logo" href="/invite" aria-label="Wedding Manager">
        <img src="${SITE_LOGO_ICON_PATH}" alt="" />
        <span>Wedding Manager</span>
      </a>
      <header class="stage-header">
        <div class="stage-title">现场摇奖时刻</div>
      </header>
      <div class="lottery-panel">
        <aside class="panel prize-panel">
          <div class="panel-title">
            <h2>奖品列表</h2>
            <span>挑选当前奖项</span>
          </div>
          <ul class="prize-list">
            ${
              prizeSummaries.length
                ? prizeSummaries
                    .map(
                      (prize) => `
            <li data-id="${prize.id}" data-remaining="${prize.remaining}" class="${
                        prize.remaining === 0 ? "disabled" : ""
                      }">
              <div class="prize-main">
                <span>${escapeHtml(prize.name)}</span>
                <small>剩余 ${prize.remaining}</small>
              </div>
              <div class="prize-status">${
                prize.remaining === 0 ? "已抽完" : "正在抽取"
              }</div>
            </li>`
                    )
                    .join("")
                : `<li class="empty">暂无奖品，请在后台先配置</li>`
            }
          </ul>
        </aside>
        <section class="panel draw-panel">
          <div class="draw-effects">
            <div class="pulse-ring"></div>
            <div class="pulse-ring delay"></div>
            <div class="pulse-ring delay-two"></div>
          </div>
          <div class="status-grid">
            <div class="status-card">
              <span>确认出席</span>
              <strong id="attendingCount">${guests?.length || 0}</strong>
            </div>
            <div class="status-card highlight">
              <span>待抽人数</span>
              <strong id="eligibleCount">${eligibleGuests.length}</strong>
            </div>
            <div class="status-card">
              <span>已开奖</span>
              <strong id="awardedCount">${winners?.length || 0}</strong>
            </div>
          </div>
          <div class="lottery-display">
            <div class="smoke-layer" aria-hidden="true"></div>
            <div class="countdown" id="countdown">3</div>
            <div class="winner-title">心跳时刻</div>
            <div class="winner-name" id="winnerName">等待抽取</div>
            <div class="rolling-list" id="rollingList" aria-live="polite"></div>
            <div class="action-bar">
              ${
                isAdmin
                  ? `<button class="btn glow" id="drawBtn">开始摇奖</button>
                <button class="btn ghost" id="resetBtn">重置名单</button>`
                  : `<div class="hint">登录后台后即可开始抽奖</div>`
              }
            </div>
          </div>
          <div class="winner-feed">
            <div class="panel-title">
              <h3>最新揭晓</h3>
              <span>喜悦瞬间</span>
            </div>
            <ul id="winnerFeed">
              ${
                recentWinners.length
                  ? recentWinners
                      .map(
                        (winner) => `
              <li>
                <span>${escapeHtml(winner.guest_name || "-")}</span>
                <small>${escapeHtml(winner.prize_name || "幸运奖")}</small>
              </li>`
                      )
                      .join("")
                  : `<li class="empty">等待幸运揭晓</li>`
              }
            </ul>
          </div>
        </section>
      </div>
    </div>
    <script>
      const drawBtn = document.getElementById("drawBtn");
      const winnerName = document.getElementById("winnerName");
      const winnerTitle = document.querySelector(".winner-title");
      const rollingList = document.getElementById("rollingList");
      const smokeLayer = document.querySelector(".smoke-layer");
      const prizes = document.querySelectorAll(".prize-list li");
      const countdown = document.getElementById("countdown");
      const eligibleCount = document.getElementById("eligibleCount");
      const awardedCount = document.getElementById("awardedCount");
      const winnerFeed = document.getElementById("winnerFeed");
      const resetBtn = document.getElementById("resetBtn");

      const guestNames = ${JSON.stringify(
        eligibleGuests.map((guest) => guest.name).filter(Boolean)
      )};
      const totalAttending = ${guests?.length || 0};
      let rollingTimer;
      let isDrawing = false;
      let activePrize = null;

      const setActivePrize = (prize) => {
        if (!prize || prize.classList.contains("disabled")) return;
        prizes.forEach((item) => item.classList.remove("active"));
        prize.classList.add("active");
        activePrize = prize;
      };
      const firstAvailable = Array.from(prizes).find(
        (prize) => !prize.classList.contains("disabled")
      );
      if (firstAvailable) {
        setActivePrize(firstAvailable);
      }
      prizes.forEach((prize) => {
        prize.addEventListener("click", () => {
          setActivePrize(prize);
        });
      });
      const buildRollingList = () => {
        if (!rollingList) return;
        const pool = guestNames.length ? guestNames : ["等待来宾加入"];
        const items = Array.from({ length: 18 }, () => {
          return pool[Math.floor(Math.random() * pool.length)];
        });
        const loopItems = [...items, ...items];
        rollingList.innerHTML = \`<ul>\${loopItems
          .map((name) => \`<li>\${name}</li>\`)
          .join("")}</ul>\`;
      };

      const updateCounts = () => {
        if (eligibleCount) eligibleCount.textContent = guestNames.length;
        if (awardedCount)
          awardedCount.textContent = totalAttending - guestNames.length;
      };

      const updatePrizeRemaining = (prize) => {
        if (!prize) return;
        const remaining = Number(prize.dataset.remaining || 0) - 1;
        prize.dataset.remaining = remaining;
        const remainingEl = prize.querySelector("small");
        if (remainingEl) remainingEl.textContent = \`剩余 \${remaining}\`;
        if (remaining <= 0) {
          prize.classList.add("disabled");
          const status = prize.querySelector(".prize-status");
          if (status) status.textContent = "已抽完";
          const nextAvailable = Array.from(prizes).find(
            (item) => !item.classList.contains("disabled")
          );
          if (nextAvailable) {
            setActivePrize(nextAvailable);
          }
        }
      };

      const startRolling = () => {
        buildRollingList();
        rollingList?.classList.add("active");
        smokeLayer?.classList.add("active");
        winnerTitle.textContent = "心跳时刻";
        winnerName.textContent = "名单滚动中...";
        winnerName.classList.add("rolling");
        rollingTimer = setInterval(buildRollingList, 900);
      };

      const stopRolling = () => {
        rollingList?.classList.remove("active");
        smokeLayer?.classList.remove("active");
        winnerName.classList.remove("rolling");
        clearInterval(rollingTimer);
        rollingTimer = null;
        winnerTitle.textContent = "幸运来宾";
      };

      const runCountdown = async () => {
        if (!countdown) return;
        countdown.classList.add("active");
        for (const value of ["3", "2", "1"]) {
          countdown.textContent = value;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        countdown.classList.remove("active");
      };

      const addWinnerFeed = (name, prizeName) => {
        if (!winnerFeed) return;
        if (winnerFeed.querySelector(".empty")) {
          winnerFeed.innerHTML = "";
        }
        const item = document.createElement("li");
        item.innerHTML = \`<span>\${name}</span><small>\${prizeName}</small>\`;
        winnerFeed.prepend(item);
      };

      if (drawBtn) {
        drawBtn.addEventListener("click", async () => {
          if (!activePrize || isDrawing) return;
          if (Number(activePrize.dataset.remaining || 0) <= 0) return;
          if (!guestNames.length) {
            winnerName.textContent = "暂无可抽取来宾";
            return;
          }
          isDrawing = true;
          drawBtn.disabled = true;
          await runCountdown();
          startRolling();
          const minRollTime = new Promise((resolve) =>
            setTimeout(resolve, 3600)
          );
          try {
            const response = await fetch("/lottery/draw", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prizeId: activePrize.dataset.id })
            });
            const result = await response.json();
            await minRollTime;
            stopRolling();
            if (!response.ok) {
              winnerName.textContent = result.error || "抽奖失败";
              return;
            }
            winnerName.textContent = result.winner.name;
            const winnerIndex = guestNames.indexOf(result.winner.name);
            if (winnerIndex >= 0) {
              guestNames.splice(winnerIndex, 1);
            }
            updateCounts();
            updatePrizeRemaining(activePrize);
            addWinnerFeed(
              result.winner.name,
              activePrize.querySelector("span")?.textContent || "幸运奖"
            );
          } catch (error) {
            await minRollTime;
            stopRolling();
            winnerName.textContent = "抽奖失败，请重试";
          } finally {
            isDrawing = false;
            drawBtn.disabled = false;
          }
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
          if (!confirm("确认重置所有中奖名单？")) return;
          try {
            const response = await fetch("/lottery/reset", {
              method: "POST"
            });
            if (!response.ok) {
              const result = await response.json();
              alert(result.error || "重置失败");
              return;
            }
            location.reload();
          } catch (error) {
            alert("重置失败，请稍后再试");
          }
        });
      }

      updateCounts();
    </script>
  </body>
</html>
`;
};

module.exports = {
  renderLogin,
  renderDashboard,
  renderAdmins,
  renderInvitation,
  renderTargetInviteCollaborator,
  renderGuests,
  renderLedger,
  renderTablePrint,
  renderSeatCards,
  renderAdminCheckins,
  renderAdminLottery,
  renderInvite,
  renderCheckin,
  renderLottery
};
