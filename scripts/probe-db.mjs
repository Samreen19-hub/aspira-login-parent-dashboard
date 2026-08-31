import { Pool } from 'pg'

const url = process.env.DATABASE_URL
console.log('[v0] DATABASE_URL present:', !!url)
console.log('[v0] NEON_AUTH_BASE_URL present:', !!process.env.NEON_AUTH_BASE_URL)
console.log('[v0] NEON_AUTH_COOKIE_SECRET present:', !!process.env.NEON_AUTH_COOKIE_SECRET)
if (!url) process.exit(0)
const pool = new Pool({ connectionString: url })
try {
  const schemas = await pool.query(
    "select schema_name from information_schema.schemata order by 1",
  )
  console.log('[v0] schemas:', schemas.rows.map((r) => r.schema_name).join(', '))
  const tables = await pool.query(
    "select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1,2",
  )
  console.log('[v0] tables:', JSON.stringify(tables.rows))
} catch (e) {
  console.log('[v0] query error:', e.message)
} finally {
  await pool.end()
}
