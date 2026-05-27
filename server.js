const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '.')));

const databaseConfig = {
    connectionString: process.env.DATABASE_URL
};

if (process.env.DATABASE_URL) {
    databaseConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(databaseConfig);

// 管理员密码（内存存储，服务重启后重置）
let adminPassword = 'admin';

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
app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    if (password === adminPassword) {
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '密码错误' });
    }
});

app.post('/api/admin/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (oldPassword !== adminPassword) {
        return res.json({ success: false, error: '原密码错误' });
    }
    if (!newPassword || newPassword.length < 1) {
        return res.json({ success: false, error: '新密码不能为空' });
    }
    adminPassword = newPassword;
    res.json({ success: true, message: '密码修改成功' });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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