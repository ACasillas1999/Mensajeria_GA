import mysql from 'mysql2/promise';
import 'dotenv/config';

const main = async () => {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [settings] = await pool.query(
    'SELECT setting_key, setting_value FROM auto_reply_settings'
  );
  console.log('settings:', settings);

  const [rules] = await pool.query(
    'SELECT id, name, trigger_keywords, is_active, priority, match_type, case_sensitive FROM auto_replies'
  );
  console.log('rules:', rules);

  const [cols] = await pool.query(
    "SHOW COLUMNS FROM mensajes LIKE 'is_auto_reply'"
  );
  console.log('is_auto_reply column:', cols);

  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

