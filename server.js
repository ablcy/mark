const express = require('express');
const Datastore = require('nedb');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const users = new Datastore({ filename: 'users.db', autoload: true });
const bookmarks = new Datastore({ filename: 'bookmarks.db', autoload: true });

users.ensureIndex({ fieldName: 'username', unique: true });
bookmarks.ensureIndex({ fieldName: 'userId', unique: true });

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        users.insert({ username, password: hashedPassword, createdAt: new Date() }, (err, user) => {
            if (err) {
                if (err.errorType === 'uniqueViolated') {
                    return res.status(400).json({ error: '用户名已存在' });
                }
                return res.status(500).json({ error: err.message });
            }
            
            bookmarks.insert({ userId: user._id, data: [], updatedAt: new Date() }, (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ success: true, message: '注册成功' });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    users.findOne({ username }, async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        bookmarks.findOne({ userId: user._id }, (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const userBookmarks = row ? row.data : [];
            
            res.json({
                success: true,
                user: {
                    id: user._id,
                    username: user.username
                },
                bookmarks: userBookmarks
            });
        });
    });
});

app.post('/api/save-bookmarks', (req, res) => {
    const { userId, bookmarks: bookmarksData } = req.body;
    
    bookmarks.update({ userId }, { $set: { data: bookmarksData, updatedAt: new Date() } }, { upsert: true }, (err, numReplaced) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true });
    });
});

app.get('/api/get-bookmarks/:userId', (req, res) => {
    const { userId } = req.params;
    
    bookmarks.findOne({ userId }, (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const userBookmarks = row ? row.data : [];
        res.json({ success: true, bookmarks: userBookmarks });
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});