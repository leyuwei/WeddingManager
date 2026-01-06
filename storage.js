const fs = require("fs");
const path = require("path");
const { hashPassword } = require("./password");

const dataPath =
  process.env.DATA_PATH || path.join(__dirname, "data", "store.json");

const defaultStore = () => ({
  admins: [],
  invitation_sections: [],
  invitation_fields: [],
  guests: [],
  prizes: [],
  winners: [],
  settings: {},
  counters: {}
});

const loadStore = () => {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    const store = seedStore(defaultStore());
    saveStore(store);
    return store;
  }
  const raw = fs.readFileSync(dataPath, "utf-8");
  const store = raw ? JSON.parse(raw) : defaultStore();
  return seedStore(store);
};

const saveStore = (store) => {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
};

const nextId = (store, key) => {
  const current = store.counters[key] || 0;
  const next = current + 1;
  store.counters[key] = next;
  return next;
};

const seedStore = (store) => {
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
        image_url:
          "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=1600&auto=format&fit=crop"
      },
      {
        id: nextId(store, "invitation_sections"),
        sort_order: 2,
        title: "婚礼信息",
        body: "时间：2025年5月20日 17:30\n地点：海滨花园宴会厅",
        image_url:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"
      },
      {
        id: nextId(store, "invitation_sections"),
        sort_order: 3,
        title: "期待与你见面",
        body: "你的到来是我们最好的礼物。",
        image_url:
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=1600&auto=format&fit=crop"
      }
    ];
  }

  if (!store.invitation_fields || store.invitation_fields.length === 0) {
    store.invitation_fields = [
      {
        id: nextId(store, "invitation_fields"),
        label: "出席人数",
        field_key: "attendees",
        field_type: "select",
        options: "1,2,3,4+",
        required: true
      },
      {
        id: nextId(store, "invitation_fields"),
        label: "忌口/过敏",
        field_key: "dietary",
        field_type: "text",
        options: "",
        required: false
      }
    ];
  }

  if (!store.settings || Object.keys(store.settings).length === 0) {
    store.settings = {
      couple_name: "林曦 & 周然",
      wedding_date: "2025年5月20日 17:30",
      wedding_location: "海滨花园宴会厅",
      hero_message: "诚挚邀请你见证我们的幸福时刻"
    };
  }

  store.guests = store.guests || [];
  store.prizes = store.prizes || [];
  store.winners = store.winners || [];
  store.counters = store.counters || {};
  return store;
};

module.exports = { loadStore, saveStore, nextId, dataPath };
