# 在线网盘系统

基于 React + Express + PostgreSQL 的云存储平台，提供文件上传、下载、分享和预览功能。

## 🚀 功能特性

- **用户认证**：注册、登录、JWT认证
- **文件管理**：上传、下载、删除、文件夹管理
- **文件预览**：支持图片、视频、文档、音频预览
- **分享功能**：生成分享链接，支持密码保护和到期时间
- **到期管理**：文件和分享链接自动过期清理
- **存储管理**：用户存储配额管理

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS 样式框架
- Zustand 状态管理
- React Router 路由管理
- Headless UI 组件库

### 后端
- Node.js + Express 4
- JWT 认证
- Multer 文件上传
- Sharp 图片处理
- FFmpeg 视频处理

### 数据库
- PostgreSQL 15
- 支持UUID主键
- 完整的索引优化

### 文件预览
- 图片：react-image-gallery / react-photo-view
- 视频：react-player / video.js
- 文档：react-pdf / OnlyOffice
- 代码：react-ace + prism.js
- 音频：react-h5-audio-player

## 📁 项目结构

```
online-netdisk/
├── client/                 # 前端React应用
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/         # 页面
│   │   ├── hooks/         # 自定义Hook
│   │   ├── utils/         # 工具函数
│   │   ├── stores/        # Zustand状态管理
│   │   └── types/         # TypeScript类型定义
│   ├── public/            # 静态资源
│   └── package.json
├── server/                # 后端Express应用
│   ├── src/
│   │   ├── routes/        # 路由
│   │   ├── controllers/   # 控制器
│   │   ├── models/        # 数据模型
│   │   ├── middleware/    # 中间件
│   │   ├── utils/         # 工具函数
│   │   └── config/        # 配置文件
│   ├── uploads/           # 文件上传目录
│   └── package.json
├── database/              # 数据库相关
│   ├── migrations/        # 数据库迁移文件
│   └── seeds/            # 初始数据
├── shared/               # 共享类型定义
└── docs/                 # 文档
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- PostgreSQL >= 15
- npm >= 8.0.0

### 安装依赖
```bash
# 安装所有依赖
npm run install:all
```

### 配置数据库
1. 创建PostgreSQL数据库
2. 复制 `server/.env.example` 到 `server/.env`
3. 配置数据库连接信息

### 运行项目
```bash
# 同时启动前端和后端开发服务器
npm run dev

# 或者分别启动
npm run dev:client  # 前端开发服务器 (http://localhost:5173)
npm run dev:server  # 后端API服务器 (http://localhost:3000)
```

### 构建部署
```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 📖 API文档

详细的API文档请参考 [技术架构文档](.trae/documents/在线网盘系统-技术架构文档.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License