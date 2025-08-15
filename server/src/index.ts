import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 导入路由
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import shareRoutes from './routes/shares';
import userRoutes from './routes/users';

// 导入中间件
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 创建上传目录
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 创建缩略图目录
const thumbnailDir = path.join(uploadDir, 'thumbnails');
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP在窗口期内最多100个请求
  message: {
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 中间件配置
app.use(helmet()); // 安全头
app.use(compression()); // 响应压缩
app.use(limiter); // 速率限制
app.use(morgan('combined')); // 日志记录

// CORS配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析JSON和URL编码的请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 提供上传的文件访问
app.use('/uploads', express.static(uploadDir));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/users', userRoutes);

// 404处理
app.use(notFound);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📁 上传目录: ${uploadDir}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 前端URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});

export default app;