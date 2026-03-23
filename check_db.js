const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ad_system.db');

db.all(`SELECT * FROM templates ORDER BY id DESC LIMIT 2`, [], (err, rows) => {
    if (err) throw err;
    console.log("Templates: ", JSON.stringify(rows, null, 2));
});
db.all(`SELECT * FROM ads_history ORDER BY id DESC LIMIT 2`, [], (err, rows) => {
    if (err) throw err;
    console.log("Ads History: ", JSON.stringify(rows, null, 2));
});
