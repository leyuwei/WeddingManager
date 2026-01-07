const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body>
    <header class="top-bar">
      <div class="brand">Wedding Manager</div>
      <nav class="nav-links">
        <a href="/admin">仪表盘</a>
        <a href="/admin/invitation">请柬设计</a>
        <a href="/admin/guests">来宾管理</a>
        <a href="/admin/checkins">现场签到</a>
        <a href="/admin/seat-cards">席位牌</a>
        <a href="/admin/lottery">现场摇奖</a>
        <a href="/admin/admins">管理员</a>
        <a href="/admin/logout">退出</a>
      </nav>
    </header>
    <main class="container">
      ${body}
    </main>
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
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="auth-body">
    <div class="auth-card">
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

const renderDashboard = ({ guestCount, attendingCount }) =>
  adminLayout(
    "仪表盘",
    `
<section class="hero">
  <h1>婚礼全流程控制中心</h1>
  <p>让每一个环节井然有序，打造极致浪漫体验。</p>
</section>
<section class="stats-grid">
  <div class="stat-card">
    <h2>${guestCount}</h2>
    <p>已收到来宾信息</p>
  </div>
  <div class="stat-card accent">
    <h2>${attendingCount}</h2>
    <p>确认出席</p>
  </div>
  <div class="stat-card">
    <h2>✨</h2>
    <p>请柬、席位、摇奖一站式管理</p>
  </div>
</section>
<section class="quick-links">
  <a class="tile" href="/invite" target="_blank">查看请柬效果</a>
  <a class="tile" href="/lottery" target="_blank">大屏抽奖页面</a>
  <a class="tile" href="/admin/checkins">现场签到管理</a>
  <a class="tile" href="/admin/guests">管理来宾信息</a>
</section>
`
  );

const renderAdmins = (admins) =>
  adminLayout(
    "管理员管理",
    `
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
  <h2>当前管理员</h2>
  <table class="table">
    <thead>
      <tr>
        <th>账号</th>
        <th>创建时间</th>
      </tr>
    </thead>
    <tbody>
      ${admins
        .map(
          (admin) => `
      <tr>
        <td>${escapeHtml(admin.username)}</td>
        <td>${escapeHtml(admin.created_at)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</section>
`
  );

const renderInvitation = ({ settings, sections, fields }) =>
  adminLayout(
    "请柬设计",
    `
<section class="card">
  <h1>请柬基础信息</h1>
  <form method="post" action="/admin/invitation/settings" class="form-grid">
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
    <label>
      婚礼地点
      <input type="text" name="wedding_location" value="${escapeHtml(
        settings.wedding_location || ""
      )}" />
    </label>
    <label class="full">
      头图文案
      <input type="text" name="hero_message" value="${escapeHtml(
        settings.hero_message || ""
      )}" />
    </label>
    <button class="btn primary" type="submit">保存设置</button>
  </form>
</section>

<section class="card">
  <h2>请柬页面分屏</h2>
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
      <input type="text" name="image_url" />
    </label>
    <button class="btn primary" type="submit">新增分屏</button>
  </form>
  <div class="list">
    ${sections
      .map(
        (section) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(section.title)}</strong>
        <p>${escapeHtml(section.body)}</p>
        <small>排序：${section.sort_order}</small>
      </div>
      <form method="post" action="/admin/invitation/sections/${section.id}/delete">
        <button class="btn ghost" type="submit">删除</button>
      </form>
    </div>`
      )
      .join("")}
  </div>
</section>

<section class="card">
  <h2>来宾信息收集项</h2>
  <form method="post" action="/admin/invitation/fields" class="form-grid">
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
      <select name="field_type" required>
        <option value="text">文本</option>
        <option value="textarea">多行文本</option>
        <option value="select">下拉选择</option>
      </select>
    </label>
    <label>
      选项（逗号分隔）
      <input type="text" name="options" placeholder="仅下拉选择使用" />
    </label>
    <label class="inline">
      <input type="checkbox" name="required" />
      必填
    </label>
    <button class="btn primary" type="submit">新增字段</button>
  </form>
  <div class="list">
    ${fields
      .map(
        (field) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(field.label)}</strong>
        <p>key: ${escapeHtml(field.field_key)} ｜ 类型：${escapeHtml(
          field.field_type
        )}</p>
      </div>
      <form method="post" action="/admin/invitation/fields/${field.id}/delete">
        <button class="btn ghost" type="submit">删除</button>
      </form>
    </div>`
      )
      .join("")}
  </div>
</section>
`
  );

const renderGuests = ({ guests, fields }) =>
  adminLayout(
    "来宾管理",
    `
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
      席位号
      <input type="text" name="table_no" placeholder="可选" />
    </label>
    <label class="inline">
      <input type="checkbox" name="attending" checked />
      出席
    </label>
    ${fields
      .map((field) => {
        if (field.field_type === "textarea") {
          return `
    <label class="full">
      ${escapeHtml(field.label)}
      <textarea name="${escapeHtml(field.field_key)}" rows="2" ${
            field.required ? "required" : ""
          }></textarea>
    </label>`;
        }
        if (field.field_type === "select") {
          const options = (field.options || "")
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}">${escapeHtml(
                  option
                )}</option>`
            )
            .join("");
          return `
    <label>
      ${escapeHtml(field.label)}
      <select name="${escapeHtml(field.field_key)}" ${
            field.required ? "required" : ""
          }>
        <option value="">请选择</option>
        ${options}
      </select>
    </label>`;
        }
        return `
    <label>
      ${escapeHtml(field.label)}
      <input type="text" name="${escapeHtml(field.field_key)}" ${
          field.required ? "required" : ""
        } />
    </label>`;
      })
      .join("")}
    <button class="btn primary" type="submit">新增来宾</button>
  </form>
</section>

<section class="card">
  <h1>来宾信息统计</h1>
  <p>可直接编辑来宾信息并保存修改。</p>
  <table class="table">
    <thead>
      <tr>
        <th>姓名</th>
        <th>手机号</th>
        <th>出席</th>
        <th>席位号</th>
        <th>自定义信息</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${guests
        .map(
          (guest) => `
      <tr>
        <td>
          <input type="text" name="name" value="${escapeHtml(
            guest.name
          )}" form="guest-form-${guest.id}" />
          ${
            getCompanionLabel(guest)
              ? `<div class="muted">显示：${escapeHtml(
                  formatGuestDisplayName(guest)
                )}</div>`
              : ""
          }
        </td>
        <td>
          <input type="tel" name="phone" value="${escapeHtml(
            guest.phone
          )}" form="guest-form-${guest.id}" />
        </td>
        <td>
          <label class="inline">
            <input type="checkbox" name="attending" ${
              guest.attending ? "checked" : ""
            } form="guest-form-${guest.id}" />
            出席
          </label>
        </td>
        <td>
          <input type="text" name="table_no" value="${escapeHtml(
            guest.table_no || ""
          )}" placeholder="桌号" form="guest-form-${guest.id}" />
        </td>
        <td>
          <div class="form-stack">
            ${fields
              .map((field) => {
                const value =
                  (guest.responses || {})[field.field_key] || "";
                if (field.field_type === "textarea") {
                  return `
            <label>
              ${escapeHtml(field.label)}
              <textarea name="${escapeHtml(field.field_key)}" rows="2" form="guest-form-${guest.id}">${escapeHtml(
                    value
                  )}</textarea>
            </label>`;
                }
                if (field.field_type === "select") {
                  const options = (field.options || "")
                    .split(",")
                    .map((option) => option.trim())
                    .filter(Boolean)
                    .map((option) => {
                      const escaped = escapeHtml(option);
                      return `<option value="${escaped}" ${
                        option === value ? "selected" : ""
                      }>${escaped}</option>`;
                    })
                    .join("");
                  return `
            <label>
              ${escapeHtml(field.label)}
              <select name="${escapeHtml(
                field.field_key
              )}" form="guest-form-${guest.id}">
                <option value="">请选择</option>
                ${options}
              </select>
            </label>`;
                }
                return `
            <label>
              ${escapeHtml(field.label)}
              <input type="text" name="${escapeHtml(
                field.field_key
              )}" value="${escapeHtml(value)}" form="guest-form-${guest.id}" />
            </label>`;
              })
              .join("")}
          </div>
        </td>
        <td>
          <form method="post" action="/admin/guests/${
            guest.id
          }/update" class="inline-form" id="guest-form-${guest.id}">
            <button class="btn ghost" type="submit">保存</button>
          </form>
          <form method="post" action="/admin/guests/${guest.id}/delete" class="inline-form">
            <button class="btn ghost" type="submit" onclick="return confirm('确认删除该来宾吗？');">删除</button>
          </form>
        </td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</section>
`
  );

const renderSeatCards = (guests) =>
  adminLayout(
    "席位牌",
    `
<section class="card">
  <h1>席位牌自动生成</h1>
  <p>支持A4横向三折席位牌（折成三角柱），每页仅打印一位来宾。</p>
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
  pendingGuests
}) =>
  adminLayout(
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
      </tr>
    </thead>
    <tbody>
      ${
        checkedInGuests.length
          ? checkedInGuests
              .map(
                (guest) => `
      <tr>
        <td>${escapeHtml(guest.name || "-")}</td>
        <td>${escapeHtml(guest.phone || "-")}</td>
        <td>${escapeHtml(guest.table_no || "未分配")}</td>
        <td>${escapeHtml(guest.checkin?.actual_attendees || "-")}</td>
        <td>${escapeHtml(guest.checkin?.checked_in_at || "-")}</td>
      </tr>`
              )
              .join("")
          : `<tr><td colspan="5" class="muted">暂无来宾完成签到</td></tr>`
      }
    </tbody>
  </table>
</section>

<section class="card">
  <h2>未签到来宾</h2>
  <table class="table">
    <thead>
      <tr>
        <th>姓名</th>
        <th>手机号</th>
        <th>席位号</th>
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
        <td>${guest.attending ? "确认出席" : "未确认"}</td>
      </tr>`
              )
              .join("")
          : `<tr><td colspan="4" class="muted">所有来宾均已签到</td></tr>`
      }
    </tbody>
  </table>
</section>
`
  );

const renderInvite = ({ settings, sections, fields, submitted }) => `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>婚礼请柬</title>
    <link rel="stylesheet" href="/public/css/invite.css" />
  </head>
  <body>
    <div class="invite">
      <section class="hero">
        <div class="hero-overlay">
          <h1>${escapeHtml(settings.couple_name || "")}</h1>
          <p>${escapeHtml(settings.hero_message || "")}</p>
          <div class="hero-meta">
            <span>${escapeHtml(settings.wedding_date || "")}</span>
            <span>${escapeHtml(settings.wedding_location || "")}</span>
          </div>
        </div>
      </section>

      <div class="sections">
        ${sections
          .map(
            (section) => `
        <section class="story" style="background-image: url('${escapeHtml(
          section.image_url || ""
        )}')">
          <div class="story-card">
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.body).replaceAll("\n", "<br/>")}</p>
          </div>
        </section>`
          )
          .join("")}
      </div>

      <section class="rsvp" id="rsvp">
        <div class="rsvp-card">
          <h2>填写来宾信息</h2>
          ${
            String(submitted) === "1"
              ? `<div class="success">已收到你的信息，感谢祝福！可再次提交以修改。</div>`
              : ""
          }
          <form method="post" action="/invite/rsvp" class="form-stack">
            <label>
              姓名
              <input type="text" name="name" required />
            </label>
            <label>
              手机号
              <input type="tel" name="phone" required />
            </label>
            <label class="inline">
              <input type="checkbox" name="attending" checked />
              我将出席婚礼
            </label>
            ${fields
              .map((field) => {
                if (field.field_type === "textarea") {
                  return `
            <label>
              ${escapeHtml(field.label)}
              <textarea name="${escapeHtml(field.field_key)}" rows="2" ${
                    field.required ? "required" : ""
                  }></textarea>
            </label>`;
                }
                if (field.field_type === "select") {
                  const options = (field.options || "")
                    .split(",")
                    .map((option) => option.trim())
                    .filter(Boolean)
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(option)}">${escapeHtml(
                          option
                        )}</option>`
                    )
                    .join("");
                  return `
            <label>
              ${escapeHtml(field.label)}
              <select name="${escapeHtml(field.field_key)}" ${
                    field.required ? "required" : ""
                  }>
                <option value="">请选择</option>
                ${options}
              </select>
            </label>`;
                }
                return `
            <label>
              ${escapeHtml(field.label)}
              <input type="text" name="${escapeHtml(field.field_key)}" ${
                  field.required ? "required" : ""
                } />
            </label>`;
              })
              .join("")}
            <button class="btn primary" type="submit">提交信息</button>
          </form>
        </div>
      </section>
    </div>
  </body>
</html>
`;

const renderCheckin = ({ settings, error, result, prompt, formValues }) => `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>现场签到</title>
    <link rel="stylesheet" href="/public/css/checkin.css" />
  </head>
  <body>
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
        <p class="muted">请填写姓名或手机号完成现场签到。</p>
        <div class="notice">签到信息将用于现场抽奖，请谨慎确认填写。</div>
        ${
          error
            ? `<div class="alert">${escapeHtml(error)}</div>`
            : ""
        }
        ${
          prompt
            ? `<div class="prompt-card">
              <div class="prompt-title">需要确认</div>
              <p>${escapeHtml(prompt.message || "")}</p>
              <div class="prompt-actions">
                <a class="btn ghost" href="/checkin">重新填写</a>
                <form method="post" action="/checkin">
                  <input type="hidden" name="force_new" value="1" />
                  <input type="hidden" name="name" value="${escapeHtml(
                    formValues?.name || ""
                  )}" />
                  <input type="hidden" name="phone" value="${escapeHtml(
                    formValues?.phone || ""
                  )}" />
                  <input type="hidden" name="actual_attendees" value="${escapeHtml(
                    formValues?.actual_attendees || "1"
                  )}" />
                  <input type="hidden" name="confirm_attending" value="on" />
                  <button class="btn primary" type="submit">作为新增来宾签到</button>
                </form>
              </div>
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
              </div>
            </div>`
            : ""
        }
        <form method="post" action="/checkin" class="form-stack">
          <label>
            姓名
            <input type="text" name="name" placeholder="可填写姓名" value="${escapeHtml(
              formValues?.name || ""
            )}" />
          </label>
          <label>
            手机号
            <input type="tel" name="phone" placeholder="可填写手机号" value="${escapeHtml(
              formValues?.phone || ""
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
        </form>
      </section>
    </div>
  </body>
</html>
`;

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
    <link rel="stylesheet" href="/public/css/lottery.css" />
  </head>
  <body>
    <div class="lottery-screen">
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
  renderGuests,
  renderSeatCards,
  renderAdminCheckins,
  renderAdminLottery,
  renderInvite,
  renderCheckin,
  renderLottery
};
