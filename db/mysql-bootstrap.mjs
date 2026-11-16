import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'joyto',
  multipleStatements: true,
};

if (!/^[a-zA-Z0-9_]+$/.test(config.database)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  try {
    const [existingTables] = await connection.execute(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?',
      [config.database],
    );
    const tableCount = Number(existingTables[0]?.count ?? 0);
    if (tableCount > 0) {
      throw new Error(`Database '${config.database}' already contains tables. Refusing to overwrite existing data.`);
    }

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${config.database}\`;`);

    const sql = await readFile(path.join(__dirname, 'mysql-local.sql'), 'utf8');
    await connection.query(sql);
    console.log(`✅ Database '${config.database}' initialized successfully in MySQL.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('❌ MySQL bootstrap failed:', error.message);
  process.exit(1);
});
