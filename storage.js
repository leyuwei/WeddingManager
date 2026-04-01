const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { hashPassword } = require("./password");

const dataPath =
  process.env.DATA_PATH || path.join(__dirname, "data", "store.json");
const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "store.db");
const dbDir = path.dirname(dbPath);
try {
  fs.mkdirSync(dbDir, { recursive: true });
} catch (error) {
  if (error.code !== "EEXIST" || !fs.existsSync(dbDir)) {
    throw error;
  }
  if (!fs.statSync(dbDir).isDirectory()) {
    throw error;
  }
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(
  "CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
);

const readAllRows = () =>
  db.prepare("SELECT key, value FROM store").all();

const upsertRow = db.prepare(
  "INSERT INTO store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

const defaultStore = () => ({
  admins: [],
  invitation_sections: [],
  invitation_fields: [],
  guests: [],
  tables: [],
  checkins: [],
  prizes: [],
  winners: [],
  ledger: [],
  settings: {},
  counters: {}
});

const loadStore = () => {
  const rows = readAllRows();
  let store = defaultStore();

  if (rows.length > 0) {
    rows.forEach((row) => {
      store[row.key] = JSON.parse(row.value);
    });
  } else if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, "utf-8");
    const legacyStore = raw ? JSON.parse(raw) : {};
    store = { ...store, ...legacyStore };
  }

  store = seedStore(store);
  saveStore(store);
  return store;
};

const saveStore = (store) => {
  const transaction = db.transaction((payload) => {
    Object.entries(payload).forEach(([key, value]) => {
      upsertRow.run(key, JSON.stringify(value));
    });
  });
  transaction(store);
};

const nextId = (store, key) => {
  const current = store.counters[key] || 0;
  const next = current + 1;
  store.counters[key] = next;
  return next;
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

const normalizeOpacity = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
};

const normalizeBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
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

const normalizeRangedNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

const seedStore = (store) => {
  const defaultHeroImageUrl =
    "https://images.unsplash.com/photo-1505489304219-85ce17010209?q=80&w=1600&auto=format&fit=crop";
  if (!store.admins || store.admins.length === 0) {
    store.admins = store.admins || [];
    store.admins.push({
      id: nextId(store, "admins"),
      username: "admin",
      password_hash: hashPassword("admin123"),
      created_at: new Date().toISOString()
    });
  }

  if (!store.invitation_sections || store.invitation_sections.length === 0) {
    store.invitation_sections = [
      {
        id: nextId(store, "invitation_sections"),
        sort_order: 1,
        title: "我们的故事",
        body: "从初见到牵手，我们把每一份心动写进这场婚礼。",
        background_mode: "cover",
        image_url:
          "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=1600&auto=format&fit=crop"
      },
      {
        id: nextId(store, "invitation_sections"),
        sort_order: 2,
        title: "婚礼信息",
        body: "时间：2025年5月20日 17:30\n地点：海滨花园宴会厅",
        background_mode: "cover",
        image_url:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"
      },
      {
        id: nextId(store, "invitation_sections"),
        sort_order: 3,
        title: "期待与你见面",
        body: "你的到来是我们最好的礼物。",
        background_mode: "cover",
        image_url:
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=1600&auto=format&fit=crop"
      }
    ];
  }

  store.invitation_sections = (store.invitation_sections || []).map(
    (section = {}) => ({
      ...section,
      background_mode: normalizeSectionBackgroundMode(
        section.background_mode,
        "cover"
      )
    })
  );

  if (!store.invitation_fields || store.invitation_fields.length === 0) {
    store.invitation_fields = [
      {
        id: nextId(store, "invitation_fields"),
        label: "忌口/过敏",
        field_key: "dietary",
        field_type: "text",
        options: "",
        required: false
      }
    ];
  } else {
    store.invitation_fields = store.invitation_fields.filter(
      (field) => field.field_key !== "attendees"
    );
  }

  if (!store.settings || Object.keys(store.settings).length === 0) {
    store.settings = {
      couple_name: "林曦 & 周然",
      wedding_date: "2025年5月20日 17:30",
      wedding_location: "海滨花园宴会厅",
      wedding_location_map_url: "",
      wedding_route_image_urls: [],
      invitation_guest_field_order: [],
      lunar_date_enabled: false,
      hero_message: "诚挚邀请你见证我们的幸福时刻",
      hero_image_url: defaultHeroImageUrl,
      hero_overlay_enabled: true,
      hero_overlay_color: "#000000",
      hero_overlay_opacity: 0.6,
      hero_text_color: "#ffffff",
      hero_name_position: "near_message",
      invite_font_base: "system",
      invite_font_heading: "songti",
      invite_font_couple: "kaiti",
      invite_font_countdown: "heiti",
      text_animation_enabled: true,
      text_animation_style: "fade_up",
      text_animation_duration: 0.9,
      text_animation_stagger_ms: 120,
      text_animation_repeat: false,
      swipe_hint_enabled: true,
      swipe_hint_text: "上滑查看下一页",
      swipe_hint_position: "bottom-center",
      swipe_hint_style: "soft_glow",
      countdown_enabled: true,
      countdown_show_home: true,
      countdown_show_success: true,
      countdown_target_at: "",
      countdown_label: "婚礼倒计时",
      countdown_theme: "glass",
      countdown_bg_color: "#ffffff",
      countdown_text_color: "#4b3c33",
      countdown_accent_color: "#d68aa1",
      countdown_opacity: 0.9,
      countdown_home_position: "top-right",
      countdown_success_position: "top-right",
      festive_theme: "classic_red",
      festive_effect_enabled: true,
      festive_effect_style: "lantern",
      festive_effect_intensity: "normal",
      guest_font_scale: 1.1,
      qr_force_https: true,
      invitation_music_url: ""
    };
  } else if (
    store.settings.guest_font_scale === undefined ||
    store.settings.guest_font_scale === null
  ) {
    store.settings.guest_font_scale = 1.1;
  }

  if (!store.settings.invitation_music_url) {
    store.settings.invitation_music_url = "";
  }

  if (!store.settings.hero_image_url) {
    store.settings.hero_image_url = defaultHeroImageUrl;
  }

  store.settings.hero_overlay_enabled = normalizeBoolean(
    store.settings.hero_overlay_enabled,
    true
  );
  store.settings.hero_overlay_color = normalizeHexColor(
    store.settings.hero_overlay_color,
    "#000000"
  );
  store.settings.hero_overlay_opacity = normalizeOpacity(
    store.settings.hero_overlay_opacity,
    0.6
  );
  store.settings.hero_text_color = normalizeHexColor(
    store.settings.hero_text_color,
    "#ffffff"
  );
  store.settings.hero_name_position = normalizeHeroNamePosition(
    store.settings.hero_name_position,
    "near_message"
  );
  store.settings.lunar_date_enabled = normalizeBoolean(
    store.settings.lunar_date_enabled,
    false
  );
  store.settings.invite_font_base = normalizeInviteFont(
    store.settings.invite_font_base,
    "system"
  );
  store.settings.invite_font_heading = normalizeInviteFont(
    store.settings.invite_font_heading,
    "songti"
  );
  store.settings.invite_font_couple = normalizeInviteFont(
    store.settings.invite_font_couple,
    "kaiti"
  );
  store.settings.invite_font_countdown = normalizeInviteFont(
    store.settings.invite_font_countdown,
    "heiti"
  );
  store.settings.text_animation_enabled = normalizeBoolean(
    store.settings.text_animation_enabled,
    true
  );
  store.settings.text_animation_style = normalizeTextAnimationStyle(
    store.settings.text_animation_style,
    "fade_up"
  );
  store.settings.text_animation_duration = normalizeRangedNumber(
    store.settings.text_animation_duration,
    0.3,
    3,
    0.9
  );
  store.settings.text_animation_stagger_ms = normalizeRangedNumber(
    store.settings.text_animation_stagger_ms,
    0,
    500,
    120
  );
  store.settings.text_animation_repeat = normalizeBoolean(
    store.settings.text_animation_repeat,
    false
  );
  store.settings.swipe_hint_enabled = normalizeBoolean(
    store.settings.swipe_hint_enabled,
    true
  );
  store.settings.swipe_hint_text =
    String(store.settings.swipe_hint_text || "").trim() || "上滑查看下一页";
  store.settings.swipe_hint_position = normalizeSwipeHintPosition(
    store.settings.swipe_hint_position,
    "bottom-center"
  );
  store.settings.swipe_hint_style = normalizeSwipeHintStyle(
    store.settings.swipe_hint_style,
    "soft_glow"
  );
  store.settings.countdown_enabled = normalizeBoolean(
    store.settings.countdown_enabled,
    true
  );
  store.settings.countdown_show_home = normalizeBoolean(
    store.settings.countdown_show_home,
    true
  );
  store.settings.countdown_show_success = normalizeBoolean(
    store.settings.countdown_show_success,
    true
  );
  store.settings.countdown_target_at = normalizeDateTimeLike(
    store.settings.countdown_target_at,
    ""
  );
  store.settings.countdown_label = String(
    store.settings.countdown_label || ""
  ).trim() || "婚礼倒计时";
  store.settings.countdown_theme = normalizeCountdownTheme(
    store.settings.countdown_theme,
    "glass"
  );
  store.settings.countdown_bg_color = normalizeHexColor(
    store.settings.countdown_bg_color,
    "#ffffff"
  );
  store.settings.countdown_text_color = normalizeHexColor(
    store.settings.countdown_text_color,
    "#4b3c33"
  );
  store.settings.countdown_accent_color = normalizeHexColor(
    store.settings.countdown_accent_color,
    "#d68aa1"
  );
  store.settings.countdown_opacity = normalizeRangedNumber(
    store.settings.countdown_opacity,
    0.2,
    1,
    0.9
  );
  store.settings.countdown_home_position = normalizeCountdownPosition(
    store.settings.countdown_home_position,
    "top-right"
  );
  store.settings.countdown_success_position = normalizeCountdownPosition(
    store.settings.countdown_success_position,
    "top-right"
  );
  store.settings.festive_theme = normalizeFestiveTheme(
    store.settings.festive_theme,
    "classic_red"
  );
  store.settings.festive_effect_enabled = normalizeBoolean(
    store.settings.festive_effect_enabled,
    true
  );
  store.settings.festive_effect_style = normalizeFestiveEffectStyle(
    store.settings.festive_effect_style,
    "lantern"
  );
  store.settings.festive_effect_intensity = normalizeFestiveEffectIntensity(
    store.settings.festive_effect_intensity,
    "normal"
  );
  store.settings.qr_force_https = normalizeBoolean(
    store.settings.qr_force_https,
    true
  );

  if (!store.settings.wedding_location_map_url) {
    store.settings.wedding_location_map_url = "";
  }

  if (!Array.isArray(store.settings.wedding_route_image_urls)) {
    const rawValue = String(store.settings.wedding_route_image_urls || "");
    store.settings.wedding_route_image_urls = rawValue
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(store.settings.invitation_guest_field_order)) {
    const rawValue = String(store.settings.invitation_guest_field_order || "");
    store.settings.invitation_guest_field_order = rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  store.guests = store.guests || [];
  store.tables = store.tables || [];
  store.checkins = store.checkins || [];
  store.prizes = store.prizes || [];
  store.winners = store.winners || [];
  store.ledger = store.ledger || [];
  store.counters = store.counters || {};
  return store;
};

module.exports = { loadStore, saveStore, nextId, dataPath, dbPath };
