import { useAuthStore } from '../stores/authStore';

// API基础配置
const API_BASE_URL = 'http://localhost:3000/api';

// 请求配置接口
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

// 请求缓存和去重
const requestCache = new Map<string, Promise<any>>();
const CACHE_DURATION = 5000; // 5秒缓存

// 生成缓存键
const getCacheKey = (endpoint: string, config: RequestConfig): string => {
  return `${config.method || 'GET'}:${endpoint}:${JSON.stringify(config.body || {})}`;
};

// 文件接口
export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified: string;
  path: string;
  mimeType?: string;
  previewUrl?: string;
  parentId?: string;
}

// 分享链接接口
export interface ShareLink {
  id: string;
  fileName: string;
  filePath: string;
  shareUrl: string;
  accessType: 'public' | 'password' | 'private';
  password?: string;
  expiresAt?: string;
  downloadLimit?: number;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  isActive: boolean;
}

// 用户信息接口
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt: string;
}

// 存储统计接口
export interface StorageStats {
  used: number;
  total: number;
  files: number;
  folders: number;
}

// 通用API请求函数
const apiRequest = async <T>(endpoint: string, config: RequestConfig = {}): Promise<T> => {
  const { method = 'GET', headers = {}, body } = config;
  
  // 对于GET请求，检查缓存和去重
  if (method === 'GET') {
    const cacheKey = getCacheKey(endpoint, config);
    
    // 如果有正在进行的相同请求，返回该Promise
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey)!;
    }
    
    // 创建新的请求Promise
    const requestPromise = executeRequest<T>(endpoint, config);
    
    // 缓存请求Promise
    requestCache.set(cacheKey, requestPromise);
    
    // 设置缓存过期
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, CACHE_DURATION);
    
    return requestPromise;
  }
  
  // 非GET请求直接执行
  return executeRequest<T>(endpoint, config);
};

// 执行实际的HTTP请求
const executeRequest = async <T>(endpoint: string, config: RequestConfig = {}): Promise<T> => {
  const { method = 'GET', headers = {}, body } = config;
  
  // 获取认证token
  const token = useAuthStore.getState().token;
  
  // 构建请求头
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };
  
  // 添加认证头
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
    
    // 处理401未授权错误
    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new Error('未授权访问，请重新登录');
    }
    
    // 处理其他HTTP错误
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '请求失败' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 处理空响应
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error(`API请求失败 [${method} ${endpoint}]:`, error);
    throw error;
  }
};

// 文件管理API
export const fileApi = {
  // 获取文件列表
  getFiles: async (path: string = '/', folderId?: string): Promise<FileItem[]> => {
    console.log('🔍 API调用: getFiles', { path, folderId });
    
    try {
      const params = new URLSearchParams();
      if (path) params.append('path', path);
      if (folderId) params.append('folderId', folderId);
      
      const queryString = params.toString();
      const endpoint = `/files${queryString ? `?${queryString}` : ''}`;
      
      console.log('📡 请求端点:', endpoint);
      
      const response = await apiRequest<any>(endpoint);
      console.log('📥 API响应:', response);
      
      // 处理嵌套响应结构
      let items: FileItem[] = [];
      
      if (response.data) {
        // 如果响应有data字段，使用data
        const data = response.data;
        
        if (data.folders && Array.isArray(data.folders)) {
          const folders = data.folders.map((folder: any) => ({
            id: folder.id,
            name: folder.name,
            type: 'folder' as const,
            modified: folder.updated_at || folder.created_at,
            path: folder.path,
            parentId: folder.parent_id
          }));
          items.push(...folders);
        }
        
        if (data.files && Array.isArray(data.files)) {
          const files = data.files.map((file: any) => ({
            id: file.id,
            name: file.name,
            type: 'file' as const,
            size: file.size,
            modified: file.updated_at || file.created_at,
            path: file.file_path,
            mimeType: file.mime_type,
            previewUrl: file.preview_url,
            parentId: file.folder_id
          }));
          items.push(...files);
        }
      } else if (Array.isArray(response)) {
        // 如果响应直接是数组
        items = response.map((item: any) => ({
          id: item.id,
          name: item.name,
          type: item.type || (item.mime_type ? 'file' : 'folder'),
          size: item.size,
          modified: item.updated_at || item.created_at,
          path: item.path || item.file_path,
          mimeType: item.mime_type,
          previewUrl: item.preview_url,
          parentId: item.parent_id || item.folder_id
        }));
      }
      
      console.log('✅ 处理后的文件列表:', items);
      return items;
      
    } catch (error) {
      console.error('❌ 获取文件列表失败:', error);
      throw error;
    }
  },
  
  // 上传文件
  uploadFile: async (file: File, path: string = '/', onProgress?: (progress: number) => void): Promise<FileItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    
    const token = useAuthStore.getState().token;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              id: response.id,
              name: response.name,
              type: 'file',
              size: response.size,
              modified: response.created_at,
              path: response.file_path,
              mimeType: response.mime_type
            });
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        } else {
          reject(new Error(`上传失败: ${xhr.statusText}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'));
      });
      
      xhr.open('POST', `${API_BASE_URL}/files/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },
  
  // 下载文件
  downloadFile: async (fileId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${useAuthStore.getState().token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('下载失败');
    }
    
    return response.blob();
  },
  
  // 删除文件
  deleteFile: async (fileId: string): Promise<void> => {
    await apiRequest(`/files/${fileId}`, { method: 'DELETE' });
  },
  
  // 获取文件预览
  getFilePreview: async (fileId: string): Promise<{ previewUrl: string; mimeType: string }> => {
    return apiRequest(`/files/${fileId}/preview`);
  },
  
  // 创建文件夹
  createFolder: async (name: string, path: string = '/'): Promise<FileItem> => {
    const response = await apiRequest<any>('/files/folder', {
      method: 'POST',
      body: { name, path }
    });
    
    return {
      id: response.id,
      name: response.name,
      type: 'folder',
      modified: response.created_at,
      path: response.path
    };
  },
  
  // 重命名文件夹
  renameFolder: async (folderId: string, newName: string): Promise<FileItem> => {
    const response = await apiRequest<any>(`/files/folder/${folderId}`, {
      method: 'PUT',
      body: { name: newName }
    });
    
    return {
      id: response.id,
      name: response.name,
      type: 'folder',
      modified: response.updated_at,
      path: response.path
    };
  },
  
  // 删除文件夹
  deleteFolder: async (folderId: string): Promise<void> => {
    await apiRequest(`/files/folder/${folderId}`, { method: 'DELETE' });
  }
};

// 分享管理API
export const shareApi = {
  // 获取用户的分享列表
  getUserShares: async (): Promise<ShareLink[]> => {
    return apiRequest('/shares');
  },
  
  // 创建分享链接
  createShare: async (data: {
    filePath: string;
    accessType: 'public' | 'password' | 'private';
    password?: string;
    expiresAt?: string;
    downloadLimit?: number;
  }): Promise<ShareLink> => {
    return apiRequest('/shares', {
      method: 'POST',
      body: data
    });
  },
  
  // 获取分享信息
  getShareInfo: async (token: string): Promise<ShareLink> => {
    return apiRequest(`/shares/${token}`);
  },
  
  // 验证分享密码
  verifySharePassword: async (token: string, password: string): Promise<{ success: boolean }> => {
    return apiRequest(`/shares/${token}/verify`, {
      method: 'POST',
      body: { password }
    });
  },
  
  // 下载分享的文件
  downloadSharedFile: async (token: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/shares/${token}/download`);
    if (!response.ok) {
      throw new Error('下载失败');
    }
    return response.blob();
  },
  
  // 删除分享
  deleteShare: async (shareId: string): Promise<void> => {
    await apiRequest(`/shares/${shareId}`, { method: 'DELETE' });
  },
  
  // 更新分享设置
  updateShare: async (shareId: string, data: Partial<{
    accessType: 'public' | 'password' | 'private';
    password?: string;
    expiresAt?: string;
    downloadLimit?: number;
    isActive: boolean;
  }>): Promise<ShareLink> => {
    return apiRequest(`/shares/${shareId}`, {
      method: 'PUT',
      body: data
    });
  }
};

// 用户管理API
export const userApi = {
  // 获取用户资料
  getUserProfile: async (): Promise<UserProfile> => {
    return apiRequest('/users/profile');
  },
  
  // 更新用户资料
  updateUserProfile: async (data: Partial<{
    email: string;
    name: string;
  }>): Promise<UserProfile> => {
    return apiRequest('/users/profile', {
      method: 'PUT',
      body: data
    });
  },
  
  // 修改密码
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiRequest('/users/password', {
      method: 'PUT',
      body: data
    });
  },
  
  // 获取存储统计
  getStorageStats: async (): Promise<StorageStats> => {
    return apiRequest('/users/storage');
  },
  
  // 上传头像
  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    // 这里需要特殊处理，因为是文件上传
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/users/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('头像上传失败');
    }
    
    return response.json();
  }
};

// 认证相关接口
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
  };
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
    name: string;
  };
}

// 导出统一的API对象
export const api = {
  file: fileApi,
  share: shareApi,
  user: userApi
};

export default api;