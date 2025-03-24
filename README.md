# Twitter 自动回复机器人

这是一个基于 Node.js 的 Twitter 自动回复机器人项目，可以自动监控特定推文并发送回复。

## 功能特点

- 自动监控 Twitter 推文
- 支持自定义回复内容
- 使用 PostgreSQL 数据库存储数据（支持向量搜索）
- 支持多账号管理
- 自动保存和更新 Twitter Cookies
- 守护进程自动恢复
- Docker 容器化部署

## 环境要求

- Node.js >= 22
- PostgreSQL >= 17 (with pgvector)
- pnpm >= 8
- Docker (可选)
- Docker Compose V2 (可选)

## 安装步骤

### 方式一：本地运行

1. 克隆项目

```bash
git clone [项目地址]
cd twitter-goat
```

2. 安装依赖

```bash
pnpm install
```

3. 配置环境变量
创建 `.env` 文件并添加以下配置：

```env
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=twitter_bot

# Twitter 配置
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email
TWITTER_2FA_SECRET=your_2fa_secret
```

4. 运行项目

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

### 方式二：Docker 运行

1. 克隆项目并进入目录

```bash
git clone [项目地址]
cd twitter-goat
```

2. 配置环境变量
复制 `.env.example` 为 `.env` 并填写配置（同上）

3. 使用 Docker Compose 启动

```bash
# 构建并启动容器
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 停止服务并删除数据卷
docker compose down -v
```

## 数据库设置

项目使用 PostgreSQL 数据库（带 pgvector 扩展），会自动创建以下表：

- `x_twitter_cookies`: 存储 Twitter 账号的 cookies
- `x_replied_tweets`: 记录已回复的推文
- `x_account_profiles`: 用户档案信息
- `x_events`: 系统事件记录

## 注意事项

1. 数据库连接
   - 确保 PostgreSQL 服务已启动
   - 检查数据库连接字符串是否正确
   - 确保数据库用户有足够的权限
   - pgvector 扩展用于向量搜索功能

2. Twitter 账号
   - 需要提供有效的 Twitter 账号信息
   - 建议定期更新 cookies 以保持登录状态
   - 注意遵守 Twitter 的使用条款和限制

3. Docker 部署
   - 确保 Docker 和 Docker Compose V2 已正确安装
   - 数据库数据会持久化保存在 Docker 卷中
   - 可以通过环境变量自定义配置
   - 使用健康检查确保服务正常运行

4. 守护进程
   - 程序会自动处理异常并尝试恢复
   - 支持优雅关闭
   - 可以通过日志监控运行状态

## 项目结构

```
twitter-goat/
├── src/
│   ├── config/     # 配置文件
│   ├── db/         # 数据库相关
│   ├── services/   # 业务逻辑
│   └── utils/      # 工具函数
├── dist/           # 编译后的文件
├── .env           # 环境变量
├── Dockerfile     # Docker 构建文件
├── docker-compose.yml # Docker 编排文件
└── package.json   # 项目配置
```

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
