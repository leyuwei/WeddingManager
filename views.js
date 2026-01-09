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
      <a href="/admin/ledger">流水</a>
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

const renderInvitation = ({ settings, sections, fields, inviteUrl }) =>
  adminLayout(
    "请柬设计",
    `
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
  </div>
</section>

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
      席位号
      ${renderTableOptions()}
    </label>
    ${
      tableList.length
        ? ""
        : `<p class="muted full">请先在下方新增桌子，再为来宾分配席位。</p>`
    }
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
            const value = (guest.responses || {})[field.field_key] || "";
            return {
              field,
              value: String(value || "")
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
          )}" form="guest-form-${guest.id}" />
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
                  .map((item) => {
                    const value = item.value;
                    const field = item.field;
                    if (field.field_type === "textarea") {
                      return `
                <label>
                  ${escapeHtml(field.label)}
                  <textarea name="${escapeHtml(
                    field.field_key
                  )}" rows="2" form="guest-form-${guest.id}">${escapeHtml(
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
                  )}" value="${escapeHtml(
                      value
                    )}" form="guest-form-${guest.id}" />
                </label>`;
                  })
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
      <p>支持按类别筛选与导出 Excel。</p>
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
    <link rel="stylesheet" href="/public/css/main.css" />
  </head>
  <body class="print-body">
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

const renderCheckin = ({
  settings,
  fields,
  error,
  result,
  prompt,
  formValues,
  newGuestForm
}) => `
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
        <p class="muted">请输入姓名或手机号完成现场签到。</p>
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
                  .map((field) => {
                    if (field.field_type === "textarea") {
                      return `
                <label>
                  ${escapeHtml(field.label)}
                  <textarea name="${escapeHtml(
                    field.field_key
                  )}" rows="2" ${field.required ? "required" : ""}>${escapeHtml(
                        formValues?.[field.field_key] || ""
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
                          const selected =
                            option === formValues?.[field.field_key]
                              ? "selected"
                              : "";
                          return `<option value="${escaped}" ${selected}>${escaped}</option>`;
                        })
                        .join("");
                      return `
                <label>
                  ${escapeHtml(field.label)}
                  <select name="${escapeHtml(
                    field.field_key
                  )}" ${field.required ? "required" : ""}>
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
                  )}" value="${escapeHtml(
                      formValues?.[field.field_key] || ""
                    )}" ${field.required ? "required" : ""} />
                </label>`;
                  })
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
  renderLedger,
  renderTablePrint,
  renderSeatCards,
  renderAdminCheckins,
  renderAdminLottery,
  renderInvite,
  renderCheckin,
  renderLottery
};
