-- 在线网盘系统数据库初始化脚本
-- 创建时间: 2024-01-01
-- 版本: 1.0.0

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  storage_used BIGINT DEFAULT 0,
  storage_limit BIGINT DEFAULT 5368709120, -- 5GB
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- 创建文件夹表
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保同一用户下的同一父目录中文件夹名称唯一
  CONSTRAINT unique_folder_name_per_parent UNIQUE (user_id, parent_id, name, is_deleted)
);

-- 文件夹表索引
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
CREATE INDEX IF NOT EXISTS idx_folders_is_deleted ON folders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);

-- 创建文件表
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  is_deleted BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE, -- 文件到期时间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 文件大小必须大于0
  CONSTRAINT positive_file_size CHECK (size > 0)
);

-- 文件表索引
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);

-- 创建分享表
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token VARCHAR(32) UNIQUE NOT NULL,
  password VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER DEFAULT 0,
  download_limit INTEGER, -- 下载次数限制
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 下载次数不能为负数
  CONSTRAINT non_negative_download_count CHECK (download_count >= 0),
  -- 下载限制必须大于0
  CONSTRAINT positive_download_limit CHECK (download_limit IS NULL OR download_limit > 0)
);

-- 分享表索引
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
CREATE INDEX IF NOT EXISTS idx_shares_file_id ON shares(file_id);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_is_active ON shares(is_active);
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at DESC);

-- 创建到期任务管理表
CREATE TABLE IF NOT EXISTS expiry_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('file', 'share')),
  target_id UUID NOT NULL, -- 文件ID或分享ID
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- 确保同一类型的同一目标只有一个未处理的任务
  CONSTRAINT unique_unprocessed_task UNIQUE (task_type, target_id, is_processed)
);

-- 到期任务表索引
CREATE INDEX IF NOT EXISTS idx_expiry_tasks_expires_at ON expiry_tasks(expires_at);
CREATE INDEX IF NOT EXISTS idx_expiry_tasks_is_processed ON expiry_tasks(is_processed);
CREATE INDEX IF NOT EXISTS idx_expiry_tasks_task_type ON expiry_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_expiry_tasks_target_id ON expiry_tasks(target_id);

-- 创建用户会话表（可选，用于管理用户登录状态）
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户会话表索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- 创建系统日志表（可选，用于审计和监控）
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统日志表索引
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_resource_type ON system_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- 创建触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：计算用户存储使用量
CREATE OR REPLACE FUNCTION calculate_user_storage_usage(user_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    total_size BIGINT;
BEGIN
    SELECT COALESCE(SUM(size), 0) INTO total_size
    FROM files
    WHERE user_id = user_uuid AND is_deleted = false;
    
    RETURN total_size;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：更新用户存储使用量
CREATE OR REPLACE FUNCTION update_user_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- 处理INSERT和UPDATE操作
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE users 
        SET storage_used = calculate_user_storage_usage(NEW.user_id)
        WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    
    -- 处理DELETE操作
    IF TG_OP = 'DELETE' THEN
        UPDATE users 
        SET storage_used = calculate_user_storage_usage(OLD.user_id)
        WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：自动更新用户存储使用量
CREATE TRIGGER trigger_update_user_storage_usage
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_user_storage_usage();

-- 创建视图：用户文件统计
CREATE OR REPLACE VIEW user_file_stats AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    COUNT(f.id) as total_files,
    COALESCE(SUM(f.size), 0) as total_size,
    u.storage_used,
    u.storage_limit,
    ROUND((u.storage_used::DECIMAL / u.storage_limit::DECIMAL) * 100, 2) as usage_percentage
FROM users u
LEFT JOIN files f ON u.id = f.user_id AND f.is_deleted = false
GROUP BY u.id, u.name, u.email, u.storage_used, u.storage_limit;

-- 创建视图：文件类型统计
CREATE OR REPLACE VIEW file_type_stats AS
SELECT 
    user_id,
    CASE 
        WHEN mime_type LIKE 'image/%' THEN 'image'
        WHEN mime_type LIKE 'video/%' THEN 'video'
        WHEN mime_type LIKE 'audio/%' THEN 'audio'
        WHEN mime_type IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') THEN 'document'
        WHEN mime_type LIKE 'text/%' THEN 'text'
        ELSE 'other'
    END as file_type,
    COUNT(*) as file_count,
    SUM(size) as total_size
FROM files 
WHERE is_deleted = false
GROUP BY user_id, file_type;

-- 插入默认数据
INSERT INTO users (email, password_hash, name, plan) VALUES 
('admin@netdisk.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', '系统管理员', 'premium'),
('demo@netdisk.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', '演示用户', 'free')
ON CONFLICT (email) DO NOTHING;

-- 创建默认文件夹
INSERT INTO folders (user_id, name, path) 
SELECT id, '我的文档', '/我的文档' FROM users WHERE email = 'demo@netdisk.com'
ON CONFLICT DO NOTHING;

INSERT INTO folders (user_id, name, path) 
SELECT id, '图片', '/图片' FROM users WHERE email = 'demo@netdisk.com'
ON CONFLICT DO NOTHING;

INSERT INTO folders (user_id, name, path) 
SELECT id, '视频', '/视频' FROM users WHERE email = 'demo@netdisk.com'
ON CONFLICT DO NOTHING;

-- 创建数据库版本表
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 记录当前版本
INSERT INTO schema_versions (version, description) VALUES 
(1, '初始数据库结构')
ON CONFLICT (version) DO NOTHING;

-- 输出创建完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 数据库初始化完成！';
    RAISE NOTICE '📊 创建了以下表：';
    RAISE NOTICE '   - users (用户表)';
    RAISE NOTICE '   - folders (文件夹表)';
    RAISE NOTICE '   - files (文件表)';
    RAISE NOTICE '   - shares (分享表)';
    RAISE NOTICE '   - expiry_tasks (到期任务表)';
    RAISE NOTICE '   - user_sessions (用户会话表)';
    RAISE NOTICE '   - system_logs (系统日志表)';
    RAISE NOTICE '🔧 创建了触发器和函数用于自动维护数据一致性';
    RAISE NOTICE '👤 创建了默认用户账户（密码：123456）';
END $$;