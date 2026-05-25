const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    let retries = 5;
    while (retries > 0) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            console.log('Database tables initialized');
            return;
        } catch (err) {
            console.error('Error initializing database:', err);
            retries--;
            if (retries > 0) {
                console.log(`Retrying... ${retries} attempts left`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    console.error('Failed to initialize database after all retries');
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
            [user.id, JSON.stringify([])]
        );
        
        res.json({ success: true, message: '注册成功' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: '用户名已存在' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
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
        
        const userBookmarks = bookmarksResult.rows.length > 0 
            ? JSON.parse(bookmarksResult.rows[0].data) 
            : [];
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            },
            bookmarks: userBookmarks
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save-bookmarks', async (req, res) => {
    const { userId, bookmarks: bookmarksData } = req.body;
    
    try {
        await pool.query(
            'UPDATE bookmarks SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [JSON.stringify(bookmarksData), userId]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/get-bookmarks/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT data FROM bookmarks WHERE user_id = $1',
            [userId]
        );
        
        const userBookmarks = result.rows.length > 0 
            ? JSON.parse(result.rows[0].data) 
            : [];
        
        res.json({ success: true, bookmarks: userBookmarks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
        );
        
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query('DELETE FROM bookmarks WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        
        res.json({ success: true, message: '用户已删除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

initDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});