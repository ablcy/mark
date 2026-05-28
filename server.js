const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
// 自定义静态文件托管：让分享短码路由优先于静态文件
const staticDir = path.join(__dirname, '.');
const staticFiles = new Set(['favicon.png', 'favicon.ico', 'app.js', 'styles.css', 'admin.html', 'index.html', 'share.html', 'mark.png', 'mark1.png']);
app.use((req, res, next) => {
    const urlPath = req.path.replace(/^\//, '');
    // 如果是已知静态文件或 api/admin 路由，直接走 express.static
    if (staticFiles.has(urlPath) || req.path.startsWith('/api/') || req.path === '/admin' || req.path === '/') {
        return express.static(staticDir)(req, res, next);
    }
    next();
});

const databaseConfig = {
    connectionString: process.env.DATABASE_URL
};

if (process.env.DATABASE_URL) {
    databaseConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(databaseConfig);

// 管理员密码（从数据库加载，默认 'admin'）
let adminPassword = 'admin';

// 从数据库加载管理员密码
async function loadAdminPassword() {
    try {
        const result = await pool.query(
            "SELECT value FROM admin_settings WHERE key = 'admin_password'"
        );
        if (result.rows.length > 0) {
            // 数据库中存储的是 bcrypt hash
            adminPassword = result.rows[0].value;
            console.log('Admin password loaded from database');
        } else {
            // 首次启动，存入默认密码 hash
            const defaultHash = await bcrypt.hash('admin', 10);
            await pool.query(
                "INSERT INTO admin_settings (key, value) VALUES ('admin_password', $1) ON CONFLICT (key) DO NOTHING",
                [defaultHash]
            );
            adminPassword = defaultHash;
            console.log('Default admin password saved to database');
        }
    } catch (err) {
        console.error('Failed to load admin password, using default:', err.message);
        adminPassword = await bcrypt.hash('admin', 10);
    }
}

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

async function initDatabase() {
    let retries = 5;
    while (retries > 0) {
        try {
            console.log('Attempting to initialize database...');
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Users table created or already exists');
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    data JSONB NOT NULL DEFAULT '[]',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Bookmarks table created or already exists');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS admin_settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);
            console.log('Admin settings table created or already exists');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS shares (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    title VARCHAR(200),
                    content JSONB NOT NULL DEFAULT '[]',
                    domain VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Shares table created or already exists');

            // 迁移：为旧 shares 表添加 domain 列
            try {
                await pool.query("ALTER TABLE shares ADD COLUMN IF NOT EXISTS domain VARCHAR(255)");
            } catch (e) {
                // 列已存在则忽略
            }
            
            console.log('Database tables initialized successfully');
            return true;
        } catch (err) {
            console.error('Error initializing database:', err.message);
            retries--;
            if (retries > 0) {
                console.log(`Retrying in 3 seconds... ${retries} attempts left`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('Failed to initialize database after all retries');
    return false;
}

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 检查注册限额
    try {
        const limitResult = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_limit'");
        const limit = limitResult.rows.length > 0 ? parseInt(limitResult.rows[0].value, 10) : 10;
        if (limit === 0) {
            return res.status(403).json({ error: '当前不允许注册新用户' });
        }

        const today = new Date().toISOString().split('T')[0];
        const countResult = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_count_date'");
        const storedDate = countResult.rows.length > 0 ? countResult.rows[0].value : '';
        let todayCount = 0;
        if (storedDate === today) {
            const cnt = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_count_today'");
            todayCount = cnt.rows.length > 0 ? parseInt(cnt.rows[0].value, 10) : 0;
        } else {
            // 新的一天，重置计数
            await pool.query("INSERT INTO admin_settings (key, value) VALUES ('registration_count_date', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [today]);
            await pool.query("INSERT INTO admin_settings (key, value) VALUES ('registration_count_today', '0') ON CONFLICT (key) DO UPDATE SET value = '0'");
        }

        if (todayCount >= limit) {
            return res.status(403).json({ error: '已经超过每天注册用户限制，请24小时后重新申请注册' });
        }
    } catch (err) {
        console.error('Register limit check error:', err);
        return res.status(500).json({ error: '服务器错误' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userResult = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        
        const user = userResult.rows[0];
        
        await pool.query(
            'INSERT INTO bookmarks (user_id, data) VALUES ($1, $2)',
            [user.id, '[]']
        );

        // 增加今日注册计数
        const today = new Date().toISOString().split('T')[0];
        await pool.query("INSERT INTO admin_settings (key, value) VALUES ('registration_count_date', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [today]);
        await pool.query("UPDATE admin_settings SET value = (COALESCE((SELECT value::int FROM admin_settings WHERE key = 'registration_count_today'), 0) + 1)::text WHERE key = 'registration_count_today'");
        
        res.json({ success: true, message: '注册成功' });
    } catch (err) {
        console.error('Register error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: '用户名已存在' });
        }
        res.status(500).json({ error: '注册失败，请重试' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    try {
        const userResult = await pool.query(
            'SELECT id, username, password FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const user = userResult.rows[0];
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const bookmarksResult = await pool.query(
            'SELECT data FROM bookmarks WHERE user_id = $1',
            [user.id]
        );
        
        let userBookmarks = [];
        if (bookmarksResult.rows.length > 0 && bookmarksResult.rows[0].data) {
            try {
                userBookmarks = typeof bookmarksResult.rows[0].data === 'string' 
                    ? JSON.parse(bookmarksResult.rows[0].data) 
                    : bookmarksResult.rows[0].data;
            } catch (e) {
                console.error('Error parsing bookmarks:', e);
            }
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            },
            bookmarks: userBookmarks
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: '登录失败，请重试' });
    }
});

app.post('/api/save-bookmarks', async (req, res) => {
    const { userId, bookmarks: bookmarksData } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    try {
        const bookmarksJson = JSON.stringify(bookmarksData || []);
        
        const existing = await pool.query(
            'SELECT id FROM bookmarks WHERE user_id = $1',
            [userId]
        );
        
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE bookmarks SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
                [bookmarksJson, userId]
            );
        } else {
            await pool.query(
                'INSERT INTO bookmarks (user_id, data) VALUES ($1, $2)',
                [userId, bookmarksJson]
            );
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Save bookmarks error:', err);
        res.status(500).json({ error: '保存失败，请重试' });
    }
});

app.get('/api/get-bookmarks/:userId', async (req, res) => {
    const { userId } = req.params;
    
    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    try {
        const result = await pool.query(
            'SELECT data FROM bookmarks WHERE user_id = $1',
            [userId]
        );
        
        let userBookmarks = [];
        if (result.rows.length > 0 && result.rows[0].data) {
            try {
                userBookmarks = typeof result.rows[0].data === 'string' 
                    ? JSON.parse(result.rows[0].data) 
                    : result.rows[0].data;
            } catch (e) {
                console.error('Error parsing bookmarks:', e);
            }
        }
        
        res.json({ success: true, bookmarks: userBookmarks });
    } catch (err) {
        console.error('Get bookmarks error:', err);
        res.status(500).json({ error: '获取书签失败，请重试' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
        );
        
        res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    try {
        await pool.query('DELETE FROM bookmarks WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        
        res.json({ success: true, message: '用户已删除' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: '删除用户失败' });
    }
});

// 批量删除用户
app.post('/api/users/batch-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '请选择要删除的用户' });
    }
    try {
        for (const id of ids) {
            await pool.query('DELETE FROM bookmarks WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM users WHERE id = $1', [id]);
        }
        res.json({ success: true, message: `已删除 ${ids.length} 个用户` });
    } catch (err) {
        console.error('Batch delete error:', err);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 重置用户密码
app.post('/api/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 1) {
        return res.status(400).json({ error: '新密码不能为空' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
        res.json({ success: true, message: '密码修改成功' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// 管理员 API
app.post('/api/admin/verify', async (req, res) => {
    const { password } = req.body;
    try {
        const valid = await bcrypt.compare(password, adminPassword);
        if (valid) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: '密码错误' });
        }
    } catch (err) {
        console.error('Admin verify error:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

app.post('/api/admin/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const valid = await bcrypt.compare(oldPassword, adminPassword);
        if (!valid) {
            return res.json({ success: false, error: '原密码错误' });
        }
        if (!newPassword || newPassword.length < 1) {
            return res.json({ success: false, error: '新密码不能为空' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE admin_settings SET value = $1 WHERE key = 'admin_password'",
            [hashedPassword]
        );
        adminPassword = hashedPassword;
        res.json({ success: true, message: '密码修改成功' });
    } catch (err) {
        console.error('Admin change password error:', err);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// 获取/更新注册限额
app.get('/api/admin/registration-limit', async (req, res) => {
    try {
        const limitResult = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_limit'");
        const countDateResult = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_count_date'");
        const countResult = await pool.query("SELECT value FROM admin_settings WHERE key = 'registration_count_today'");

        const limit = limitResult.rows.length > 0 ? parseInt(limitResult.rows[0].value, 10) : 10;
        const today = new Date().toISOString().split('T')[0];
        const storedDate = countDateResult.rows.length > 0 ? countDateResult.rows[0].value : '';
        const todayCount = storedDate === today
            ? (countResult.rows.length > 0 ? parseInt(countResult.rows[0].value, 10) : 0)
            : 0;

        res.json({ success: true, limit, todayCount });
    } catch (err) {
        console.error('Get registration limit error:', err);
        res.status(500).json({ error: '获取失败' });
    }
});

app.post('/api/admin/registration-limit', async (req, res) => {
    const { limit } = req.body;
    if (limit === undefined || limit === null || limit < 0) {
        return res.status(400).json({ error: '请输入有效数字' });
    }
    try {
        await pool.query("INSERT INTO admin_settings (key, value) VALUES ('registration_limit', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(limit)]);
        res.json({ success: true, limit: parseInt(limit, 10) });
    } catch (err) {
        console.error('Update registration limit error:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ====== 分享功能 ======

// 已知路由列表，避免分享短码冲突
const KNOWN_PATHS = new Set(['admin', 'api', 'favicon.png', 'favicon.ico', 'index.html', 'app.js', 'styles.css', 'admin.html', 'share.html']);

app.post('/api/share/create', async (req, res) => {
    const { userId, code, title, content } = req.body;
    if (!userId || !code || !content) {
        return res.status(400).json({ error: '参数不完整' });
    }
    // 检查是否与已知路径冲突
    if (KNOWN_PATHS.has(code.toLowerCase())) {
        return res.status(400).json({ error: '短码与系统路径冲突，请换一个' });
    }
    try {
        // 检查是否已存在
        const exist = await pool.query('SELECT id FROM shares WHERE code = $1', [code]);
        if (exist.rows.length > 0) {
            return res.status(409).json({ error: '该短码已被使用，请换一个' });
        }
        await pool.query(
            'INSERT INTO shares (user_id, code, title, content) VALUES ($1, $2, $3, $4)',
            [userId, code, title || '', JSON.stringify(content)]
        );
        res.json({ success: true, code });
    } catch (err) {
        console.error('Share create error:', err);
        res.status(500).json({ error: '创建分享失败' });
    }
});

app.get('/api/share/:code', async (req, res) => {
    try {
        const result = await pool.query('SELECT title, content, created_at FROM shares WHERE code = $1', [req.params.code]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '分享不存在' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Share get error:', err);
        res.status(500).json({ error: '获取分享失败' });
    }
});

// 分享查看页面 - 放在所有 API 路由之后，静态文件之前需要特殊处理
// 改为在 express.static 之前用条件判断
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 分享短码路由（匹配所有非静态文件、非 API 的路径）
app.get('/:code', async (req, res) => {
    const code = req.params.code;
    try {
        const result = await pool.query('SELECT title, content, domain, created_at FROM shares WHERE code = $1', [code]);
        if (result.rows.length === 0) {
            // 不是分享短码，返回 404
            return res.status(404).send('Not Found');
        }
        const share = result.rows[0];
        const items = typeof share.content === 'string' ? JSON.parse(share.content) : share.content;
        // 渲染分享查看页面
        const html = renderSharePage(share.title, items, code, share.domain || '');
        res.send(html);
    } catch (err) {
        console.error('Share view error:', err);
        res.status(500).send('Server Error');
    }
});

// 分享页面渲染
function renderSharePage(title, items, code, domain) {
    // 递归渲染分享内容（包括嵌套文件夹）
    function renderShareItems(list, depth) {
        if (!list || list.length === 0) return '';
        const pad = depth * 16;
        return list.map(item => {
            if (item.type === 'folder') {
                const childHtml = item.children && item.children.length > 0
                    ? renderShareItems(item.children, depth + 1)
                    : '';
                const count = countItems(item.children || []);
                return `<div class="share-folder" onclick="this.classList.toggle('share-folder--open')" style="padding-left:${pad + 16}px">
                    <span class="share-folder-arrow">&#9654;</span>
                    <span class="share-folder-icon">&#x1F4C1;</span>
                    <span>${escapeHtml(item.name || item.title || '')}</span>
                    ${count > 0 ? `<span class="share-count">${count}项</span>` : ''}
                </div>
                <div class="share-folder-children">${childHtml}</div>`;
            }
            return `<a class="share-link" href="${escapeHtml(item.url || '')}" target="_blank" rel="noopener" style="padding-left:${pad + 16}px">
                <div class="share-link-title">${escapeHtml(item.title || '')}</div>
                <div class="share-link-url">${escapeHtml(item.url || '')}</div>
            </a>`;
        }).join('');
    }

    const itemsHtml = renderShareItems(items, 0);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title || '分享')} - Mark</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;min-height:100vh}
        .share-header{background:#2c3e50;color:white;padding:20px 24px;text-align:center}
        .share-header h1{font-size:20px;font-weight:500;margin-bottom:4px}
        .share-header .share-meta{font-size:12px;opacity:.7}
        .share-list{max-width:640px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:4px}
        .share-link{display:flex;flex-direction:column;padding:12px 16px;background:white;border-radius:6px;text-decoration:none;color:#333;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:box-shadow .15s;gap:4px}
        .share-link:hover{box-shadow:0 2px 8px rgba(0,0,0,.12)}
        .share-link-title{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .share-link-url{font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .share-folder{display:flex;align-items:center;padding:10px 16px;background:#f0f4ff;border-radius:6px;gap:8px;color:#333;cursor:pointer;user-select:none;transition:background .1s}
        .share-folder:hover{background:#dce8ff}
        .share-folder-arrow{font-size:10px;transition:transform .2s;flex-shrink:0;color:#666}
        .share-folder--open .share-folder-arrow{transform:rotate(90deg)}
        .share-folder-icon{font-size:18px}
        .share-count{font-size:12px;color:#888;margin-left:auto}
        .share-folder-children{display:none;flex-direction:column;gap:4px}
        .share-folder--open+.share-folder-children{display:flex}
        .share-empty{text-align:center;padding:40px;color:#888;font-size:14px}
        .share-footer{text-align:center;padding:20px;color:#999;font-size:12px}
    </style>
</head>
<body>
    <div class="share-header">
        <h1>${escapeHtml(title || '分享')}</h1>
        <div class="share-meta">来自 Mark 书签分享</div>
    </div>
    <div class="share-list">
        ${itemsHtml || '<div class="share-empty">暂无内容</div>'}
    </div>
    <div class="share-footer">mark.lcy.app/${escapeHtml(code)} &middot; Powered by Mark</div>
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function countItems(children) {
    let count = 0;
    for (const c of children) {
        if (c.type === 'bookmark') count++;
        else if (c.type === 'folder') count += 1 + countItems(c.children || []);
    }
    return count;
}

// ====== 管理员短链接管理 ======

// 获取所有短链接
app.get('/api/admin/shares', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.code, s.title, s.domain, s.created_at, s.user_id, u.username
            FROM shares s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, shares: result.rows });
    } catch (err) {
        console.error('Get shares error:', err);
        res.status(500).json({ error: '获取短链接列表失败' });
    }
});

// 获取当前用户的短链接
app.get('/api/my-shares', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }
    try {
        const result = await pool.query(
            'SELECT id, code, title, created_at FROM shares WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, shares: result.rows });
    } catch (err) {
        console.error('Get my shares error:', err);
        res.status(500).json({ error: '获取短链接失败' });
    }
});

// 用户删除自己的短链接
app.delete('/api/my-shares/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }
    try {
        await pool.query('DELETE FROM shares WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete my share error:', err);
        res.status(500).json({ error: '删除短链接失败' });
    }
});

// 修改短链接短码
app.post('/api/admin/shares/:id/domain', async (req, res) => {
    const { id } = req.params;
    const { domain } = req.body;
    if (!domain || domain.trim() === '') {
        return res.status(400).json({ error: '短码不能为空' });
    }
    try {
        // 检查是否与已知路径冲突
        if (KNOWN_PATHS.has(domain.trim().toLowerCase())) {
            return res.status(400).json({ error: '短码与系统路径冲突，请换一个' });
        }
        // 检查是否已存在
        const exist = await pool.query('SELECT id FROM shares WHERE code = $1 AND id != $2', [domain.trim(), id]);
        if (exist.rows.length > 0) {
            return res.status(409).json({ error: '该短码已被使用，请换一个' });
        }
        await pool.query('UPDATE shares SET code = $1, domain = $1 WHERE id = $2', [domain.trim(), id]);
        res.json({ success: true, code: domain.trim() });
    } catch (err) {
        console.error('Update share code error:', err);
        res.status(500).json({ error: '更新短码失败' });
    }
});

// 删除短链接
app.delete('/api/admin/shares/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM shares WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete share error:', err);
        res.status(500).json({ error: '删除短链接失败' });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
    console.log('Starting server...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');
    
    const dbInitialized = await initDatabase();
    
    if (dbInitialized) {
        console.log('Database connection successful');
        await loadAdminPassword();
        // 每次启动清理 shares 脏数据
        try {
            await pool.query("UPDATE shares SET domain = NULL WHERE domain LIKE 'mark.lcy.app%'");
            console.log('Cleaned share domain data');
        } catch (e) {
            // 忽略
        }
    } else {
        console.log('Database connection failed, server will start anyway');
    }
    
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Main app: http://localhost:${port}/`);
        console.log(`Admin panel: http://localhost:${port}/admin`);
    });
}

startServer();