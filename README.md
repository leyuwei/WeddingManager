# WeddingManager

婚礼全流程管理系统，包含管理员后台、移动请柬、来宾统计与席位牌、现场大屏抽奖等功能。

## 功能概览
- 管理后台：管理员账户管理、请柬设计、来宾统计、席位牌生成、摇奖设置。
- 移动请柬：竖向滑动展示图文、来宾信息收集（支持自定义字段）、可重复编辑。
- 来宾管理：统计表格、席位分配、自动席位牌。
- 现场摇奖：炫酷大屏展示、奖品配置、随机抽取获奖者。

## 快速开始
```bash
node server.js
```

默认管理员账号：`admin / admin123`

## 数据库配置（SQLite 推荐）
本项目默认使用 SQLite 存储数据，启动时会自动初始化数据库文件。

- 环境变量 `DB_PATH`：SQLite 文件路径（默认 `data/store.db`）。
- 环境变量 `DATA_PATH`：旧版 JSON 存储路径（默认 `data/store.json`）。当数据库为空时会自动读取并导入。

示例：
```bash
export DB_PATH=/var/lib/wedding-manager/store.db
node server.js
```

## 生产部署建议（Ubuntu + Nginx）
1. 使用 `pm2` 或 `systemd` 启动 `node server.js`。
2. Nginx 反向代理到 `http://127.0.0.1:3000`。
3. 配置 `SESSION_SECRET` 环境变量提升安全性。

## 使用 systemd 管理服务
下面示例以 `ubuntu` 用户为例，假设项目目录为 `/opt/WeddingManager`，并使用 `nvm` 管理 Node 版本。

### 1) 为运行用户安装 nvm 与 Node 18
使用 `wedding` 用户登录或切换（如默认root用户请忽略）：
```bash
sudo -u wedding -i
```

安装 nvm（示例版本仅供参考）：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

加载 nvm 并安装 Node 18：
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 18
nvm alias default 18
```

### 2) 创建 systemd 服务文件
编辑 `/etc/systemd/system/wedding.service`：
```ini
[Unit]
Description=WeddingManager Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/WeddingManager
Environment=NODE_ENV=production
ExecStart=/bin/bash -lc 'export NVM_DIR="$HOME/.nvm"; \
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; \
  nvm use 18; \
  node server.js'
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> 说明：`/bin/bash -lc` 用于加载 nvm 环境并执行 `nvm use 18`，确保以 Node 18 启动。

### 3) 启动与自启
```bash
sudo systemctl daemon-reload
sudo systemctl enable wedding
sudo systemctl start wedding
```

查看状态与日志：
```bash
sudo systemctl status wedding-manager
journalctl -u wedding-manager -f
```

## 测试
```bash
npm test
```
