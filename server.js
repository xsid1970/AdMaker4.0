const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public', { index: 'login.html' }));
app.use('/uploads', express.static('uploads')); 

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database('./ad_system.db', (err) => {
    if (err) console.error('DB 연결 오류:', err.message);
    else console.log('✅ 데이터베이스 연결 성공 (V7.0 Ultimate)');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT,
        contact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`INSERT OR IGNORE INTO users (id, password, role) VALUES ('admin', 'admin', 'admin')`);
    db.run(`ALTER TABLE users ADD COLUMN name TEXT`, (err)=>{});
    db.run(`ALTER TABLE users ADD COLUMN contact TEXT`, (err)=>{});

    db.run(`CREATE TABLE IF NOT EXISTS ads_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        name TEXT,
        contact TEXT,
        note TEXT,
        templateType TEXT,
        zoneData TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // V7.0 썸네일 저장을 위한 DB 컬럼 자동 추가 (이미 있으면 무시됨)
    db.run(`ALTER TABLE ads_history ADD COLUMN thumbnail_base64 TEXT`, (err) => {}); 
    db.run(`ALTER TABLE ads_history ADD COLUMN canvas_width INTEGER`, (err) => {});
    db.run(`ALTER TABLE ads_history ADD COLUMN canvas_height INTEGER`, (err) => {});

    db.run(`CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        bg_image_url TEXT NOT NULL,
        thumbnail_base64 TEXT,
        zone_data TEXT,
        shape_data TEXT,
        canvas_width INTEGER DEFAULT 720,
        canvas_height INTEGER DEFAULT 420,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '파일 없음' });
    res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/templates', (req, res) => {
    const { id, title, bg_image_url, thumbnail_base64, zone_data, shape_data, canvas_width, canvas_height, is_active } = req.body;
    if (id) {
        db.run(`UPDATE templates SET title=?, bg_image_url=?, thumbnail_base64=?, zone_data=?, shape_data=?, canvas_width=?, canvas_height=?, is_active=? WHERE id=?`, 
            [title, bg_image_url, thumbnail_base64, JSON.stringify(zone_data), JSON.stringify(shape_data), canvas_width, canvas_height, is_active, id], 
            err => res.json({ success: !err, id: id }));
    } else {
        db.run(`INSERT INTO templates (title, bg_image_url, thumbnail_base64, zone_data, shape_data, canvas_width, canvas_height, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            [title, bg_image_url, thumbnail_base64, JSON.stringify(zone_data), JSON.stringify(shape_data), canvas_width, canvas_height, is_active], 
            function(err) { res.json({ success: !err, id: this.lastID }); });
    }
});
app.get('/api/admin/templates', (req, res) => db.all(`SELECT * FROM templates ORDER BY created_at DESC`, [], (err, rows) => res.json(rows)));
app.delete('/api/admin/templates/:id', (req, res) => db.run(`DELETE FROM templates WHERE id = ?`, req.params.id, err => res.json({ success: !err })));

app.delete('/api/admin/ads/cleanup', (req, res) => {
    const months = parseInt(req.query.months) || 3;
    db.run(`DELETE FROM ads_history WHERE created_at <= date('now', '-${months} month')`, function(err) {
        res.json({ success: !err, deletedCount: this.changes });
    });
});

app.get('/api/templates', (req, res) => {
    db.all(`SELECT * FROM templates WHERE is_active = 1 ORDER BY created_at DESC`, [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/ads', (req, res) => {
    const { id, company, name, contact, note, templateType, zoneData, thumbnail_base64, canvas_width, canvas_height } = req.body;
    if (!company) return res.status(400).json({ success: false, error: '상호명 필수' });
    if (id) {
        db.run(`UPDATE ads_history SET company=?, name=?, contact=?, note=?, templateType=?, zoneData=?, thumbnail_base64=?, canvas_width=?, canvas_height=?, created_at=CURRENT_TIMESTAMP WHERE id=?`,
            [company, name, contact, note, templateType, JSON.stringify(zoneData), thumbnail_base64, canvas_width, canvas_height, id], function(err) { res.json({ success: !err, id: id }); });
    } else {
        db.run(`INSERT INTO ads_history (company, name, contact, note, templateType, zoneData, thumbnail_base64, canvas_width, canvas_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [company, name, contact, note, templateType, JSON.stringify(zoneData), thumbnail_base64, canvas_width, canvas_height], function(err) { res.json({ success: !err, id: this.lastID }); });
    }
});
app.get('/api/ads', (req, res) => {
    const search = req.query.search || ''; const date = req.query.date || '';
    let query = `SELECT * FROM ads_history WHERE 1=1`; const params = [];
    if (search) { query += ` AND (company LIKE ? OR note LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
    if (date) { query += ` AND date(created_at) = ?`; params.push(date); }
    query += ` ORDER BY created_at DESC LIMIT 60`; // V7.0 썸네일 표시를 위해 60개 불러옴
    db.all(query, params, (err, rows) => res.json(rows));
});
app.delete('/api/ads/:id', (req, res) => db.run(`DELETE FROM ads_history WHERE id = ?`, req.params.id, function(err) { res.json({ success: !err }); }));

app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    db.get(`SELECT role FROM users WHERE id = ? AND password = ?`, [id, password], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (row) res.json({ success: true, role: row.role });
        else res.json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    });
});

app.post('/api/register', (req, res) => {
    const { id, password } = req.body;
    if(!id || !password) return res.json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
    db.get(`SELECT id FROM users WHERE id = ?`, [id], (err, row) => {
        if (row) return res.json({ success: false, message: '이미 사용 중인 아이디입니다.' });
        db.run(`INSERT INTO users (id, password, role) VALUES (?, ?, ?)`, [id, password, 'employee'], (err) => {
            if (err) res.status(500).json({ success: false, error: err.message });
            else res.json({ success: true, message: '가입 완료! 이제 로그인할 수 있습니다.' });
        });
    });
});

app.post('/api/change-password', (req, res) => {
    const { id, oldPassword, newPassword, name, contact } = req.body;
    db.get(`SELECT id FROM users WHERE id = ? AND password = ?`, [id, oldPassword], (err, row) => {
        if (row) {
            let q = `UPDATE users SET name=?, contact=?`; let p = [name, contact];
            if(newPassword) { q += `, password=?`; p.push(newPassword); }
            q += ` WHERE id=?`; p.push(id);
            db.run(q, p, (err) => {
                if (err) res.status(500).json({ success: false, error: err.message });
                else res.json({ success: true, message: '정보가 성공적으로 변경되었습니다.' });
            });
        } else {
            res.json({ success: false, message: '아이디 또는 기존 비밀번호를 다시 확인해주세요.' });
        }
    });
});

app.get('/api/admin/users', (req, res) => db.all(`SELECT id, role, name, contact, created_at FROM users`, [], (err, rows) => res.json(rows)));
app.get('/api/users/:id', (req, res) => db.get(`SELECT id, role, name, contact FROM users WHERE id=?`, [req.params.id], (err, row) => res.json(row)));
app.post('/api/admin/users', (req, res) => {
    const { id, password, role, name, contact } = req.body;
    db.run(`INSERT INTO users (id, password, role, name, contact) VALUES (?, ?, ?, ?, ?)`, [id, password, role, name, contact], err => res.json({ success: !err, message: err?err.message:'' }));
});
app.put('/api/admin/users/:id', (req, res) => {
    const { password, role, name, contact } = req.body;
    let q = `UPDATE users SET role=?, name=?, contact=?`; let p = [role, name, contact];
    if(password) { q += `, password=?`; p.push(password); }
    q += ` WHERE id=?`; p.push(req.params.id);
    db.run(q, p, err => res.json({ success: !err }));
});
app.delete('/api/admin/users/:id', (req, res) => db.run(`DELETE FROM users WHERE id=?`, [req.params.id], err => res.json({ success: !err })));

app.listen(PORT, () => console.log(`🚀 서버 실행 중: http://localhost:${PORT}`));