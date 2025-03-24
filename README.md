# Twitter Goat

一个基于 Node.js 的 Twitter API 服务，支持多账号管理和自动化操作。

## 功能特点

- 多账号管理
  - 支持多个 Twitter 账号同时运行
  - 自动管理账号登录状态
  - 自动处理 Cookie 更新

- RESTful API 接口
  - 健康检查接口
  - 账号管理接口
  - 推文搜索和回复
  - 用户资料查询

- 系统特性
  - 优雅关闭支持
  - 服务状态监控
  - 完整的错误处理
  - 详细的日志记录

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 快速开始

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

复制 `.env.example` 到 `.env` 并配置：

```env
# API 服务配置
PORT=3000

# Twitter 账号配置
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email
TWITTER_2FA_SECRET=your_2fa_secret  # 可选
```

4. 运行服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

## API 接口说明

### 健康检查
- `GET /health`
  - 检查服务运行状态
  - 返回: `{ status: 'ok' }`

### 账号管理
- `POST /login`
  - 登录 Twitter 账号
  - 自动创建账号（如果不存在）
  - 请求体:
    ```json
    {
      "username": "your_username",
      "password": "your_password",
      "email": "your_email",
      "twoFactorSecret": "optional_2fa_secret"
    }
    ```
  - 返回: 账号 ID 和登录状态

### 推文操作
- `GET /accounts/:accountId/search`
  - 搜索推文
  - 参数:
    - `query`: 搜索关键词
    - `limit`: 返回数量（默认: 20）

- `POST /accounts/:accountId/tweet`
  - 发送推文回复
  - 请求体:
    ```json
    {
      "tweetId": "target_tweet_id",
      "replyText": "reply_content"
    }
    ```

### 用户操作
- `GET /accounts/:accountId/user/:username`
  - 获取用户资料

- `GET /accounts/:accountId/user/:username/tweets`
  - 获取用户推文列表
  - 参数:
    - `limit`: 返回数量（默认: 20）

## 项目结构

```
twitter-goat/
├── src/
│   ├── services/          # 服务实现
│   │   ├── api.ts        # API 服务
│   │   └── client.ts     # Twitter 客户端服务
│   └── utils/            # 工具函数
│       ├── logger.ts     # 日志工具
│       └── serviceManager.ts  # 服务管理器
├── dist/                 # 编译后的文件
└── package.json         # 项目配置
```

## 错误处理

服务包含完整的错误处理机制：
- 输入验证
- 账号认证
- 请求限流
- 服务状态监控

## 开发说明

1. 代码规范
   - 使用 ESLint 进行代码检查
   - 使用 Prettier 进行代码格式化
   - 运行 `pnpm format` 格式化代码
   - 运行 `pnpm lint` 检查代码规范

2. 服务管理
   - 支持优雅关闭
   - 自动处理 SIGINT/SIGTERM 信号
   - 完整的服务生命周期管理

3. 日志记录
   - 使用 pino 进行日志记录
   - 支持开发环境美化输出
   - 记录详细的操作和错误信息

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
