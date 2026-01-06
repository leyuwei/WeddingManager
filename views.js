const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
  <p>建议打印时使用浏览器打印功能。</p>
</section>
<section class="seat-grid">
  ${guests
    .map(
      (guest) => `
  <div class="seat-card">
    <div class="seat-table">桌号 ${escapeHtml(guest.table_no || "未分配")}</div>
    <div class="seat-name">${escapeHtml(guest.name)}</div>
    <div class="seat-note">欢迎出席我们的婚礼</div>
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

const renderLottery = ({ prizes, isAdmin, guests }) => `
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
      <header>
        <h1>幸运摇奖</h1>
        <p>让幸福与欢呼一起绽放</p>
      </header>
      <div class="lottery-panel">
        <div class="prize-selector">
          <h2>奖品列表</h2>
          <ul>
            ${prizes
              .map(
                (prize) => `
            <li data-id="${prize.id}">
              <span>${escapeHtml(prize.name)}</span>
              <small>剩余 ${prize.quantity}</small>
            </li>`
              )
              .join("")}
          </ul>
        </div>
        <div class="lottery-display">
          <div class="smoke-layer" aria-hidden="true"></div>
          <div class="winner-title">准备好了吗？</div>
          <div class="winner-name" id="winnerName">等待抽取</div>
          <div class="rolling-list" id="rollingList" aria-live="polite"></div>
          ${
            isAdmin
              ? `<button class="btn glow" id="drawBtn">开始抽奖</button>`
              : `<div class="hint">登录后台后即可开始抽奖</div>`
          }
        </div>
      </div>
    </div>
    <script>
      const drawBtn = document.getElementById("drawBtn");
      const winnerName = document.getElementById("winnerName");
      const winnerTitle = document.querySelector(".winner-title");
      const rollingList = document.getElementById("rollingList");
      const smokeLayer = document.querySelector(".smoke-layer");
      const prizes = document.querySelectorAll(".prize-selector li");
      const guestNames = ${JSON.stringify(
        (guests || []).map((guest) => guest.name).filter(Boolean)
      )};
      let rollingTimer;
      let isDrawing = false;
      let activePrize = prizes[0];
      if (activePrize) {
        activePrize.classList.add("active");
      }
      prizes.forEach((prize) => {
        prize.addEventListener("click", () => {
          prizes.forEach((item) => item.classList.remove("active"));
          prize.classList.add("active");
          activePrize = prize;
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

      if (drawBtn) {
        drawBtn.addEventListener("click", async () => {
          if (!activePrize || isDrawing) return;
          isDrawing = true;
          drawBtn.disabled = true;
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
    </script>
  </body>
</html>
`;

module.exports = {
  renderLogin,
  renderDashboard,
  renderAdmins,
  renderInvitation,
  renderGuests,
  renderSeatCards,
  renderAdminLottery,
  renderInvite,
  renderLottery
};
