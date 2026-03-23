const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './templates.db';
const SOURCE_PATH = './deploy_templates.json';

if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`❌ 소스 파일이 없습니다: ${SOURCE_PATH}`);
    process.exit(1);
}

const sourceTemplates = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const db = new sqlite3.Database(DB_PATH);

console.log('🚀 템플릿 동기화 시작...');

db.serialize(() => {
    // 현재 DB의 템플릿 목록 가져오기 (제목 기준 맵핑)
    db.all('SELECT * FROM templates', [], (err, rows) => {
        if (err) {
            console.error('❌ DB 조회 오류:', err.message);
            return;
        }

        const currentMap = new Map();
        rows.forEach(row => {
            currentMap.set(row.title, row);
        });

        let added = 0;
        let updated = 0;
        let skipped = 0;

        sourceTemplates.forEach(source => {
            const current = currentMap.get(source.title);

            if (!current) {
                // 신규 추가
                const sql = `INSERT INTO templates (title, bg_image_url, thumbnail_base64, zone_data, shape_data, canvas_width, canvas_height, is_active) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const params = [
                    source.title, 
                    source.bg_image_url, 
                    source.thumbnail_base64, 
                    source.zone_data, 
                    source.shape_data, 
                    source.canvas_width, 
                    source.canvas_height, 
                    source.is_active
                ];
                db.run(sql, params);
                console.log(`[ADD]    ${source.title}`);
                added++;
            } else {
                // 수정 여부 체크
                // 비교를 위해 zone_data, shape_data가 객체인 경우 문자열화
                const s_zone = typeof source.zone_data === 'string' ? source.zone_data : JSON.stringify(source.zone_data);
                const s_shape = typeof source.shape_data === 'string' ? source.shape_data : JSON.stringify(source.shape_data);
                const c_zone = current.zone_data;
                const c_shape = current.shape_data;

                const isModified = 
                    source.bg_image_url !== current.bg_image_url ||
                    source.canvas_width !== current.canvas_width ||
                    source.canvas_height !== current.canvas_height ||
                    source.is_active !== current.is_active ||
                    s_zone !== c_zone ||
                    s_shape !== c_shape;

                if (isModified) {
                    // 데이터 수정
                    const sql = `UPDATE templates SET bg_image_url=?, thumbnail_base64=?, zone_data=?, shape_data=?, canvas_width=?, canvas_height=?, is_active=? 
                                 WHERE title=?`;
                    const params = [
                        source.bg_image_url, 
                        source.thumbnail_base64, 
                        s_zone, 
                        s_shape, 
                        source.canvas_width, 
                        source.canvas_height, 
                        source.is_active,
                        source.title
                    ];
                    db.run(sql, params);
                    console.log(`[UPDATE] ${source.title}`);
                    updated++;
                } else {
                    // 변경 없음
                    console.log(`[SKIP]   ${source.title}`);
                    skipped++;
                }
            }
        });

        db.close(() => {
            console.log('\n--- 동기화 결과 ---');
            console.log(`✅ 신규 추가: ${added}`);
            console.log(`🔄 업데이트: ${updated}`);
            console.log(`🆗 유지(건너뜀): ${skipped}`);
            console.log('------------------');
            console.log('✨ 완료되었습니다.');
        });
    });
});
