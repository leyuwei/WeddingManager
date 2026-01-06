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

## 测试
```bash
npm test
```
