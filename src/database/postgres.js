import pg from 'pg';
import { config } from '../config/slack.js';

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || config.database.path;

let pool;

if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  console.log('Using PostgreSQL database');
} else {
  console.log('DATABASE_URL not set or not PostgreSQL, will use SQLite fallback');
  pool = null;
}

export default pool;
