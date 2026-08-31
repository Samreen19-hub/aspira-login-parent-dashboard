import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const cols = await pool.query(
    "select column_name, data_type, is_nullable from information_schema.columns where table_schema='neon_auth' and table_name='user' order by ordinal_position",
  )
  console.log('[v0] neon_auth.user columns:', JSON.stringify(cols.rows, null, 1))
  const cnt = await pool.query('select count(*)::int as n from neon_auth."user"')
  console.log('[v0] user count:', cnt.rows[0].n)
} catch (e) {
  console.log('[v0] err', e.message)
} finally { await pool.end() }
