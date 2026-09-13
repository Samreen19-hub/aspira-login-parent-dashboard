import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function hostFromUrl(url) {
  try {
    return new URL(url).hostname
  } catch {
    return '(unparseable)'
  }
}

const host = hostFromUrl(process.env.DATABASE_URL || '')
const hostPrefix = host.split('.')[0] // e.g. ep-round-cell-xxxxx
console.log('[v0] host_prefix:', hostPrefix)
console.log('[v0] host_matches_expected:', host.startsWith('ep-round-cell'))

const requiredTables = [
  ['neon_auth', 'user'],
  ['neon_auth', 'account'],
  ['neon_auth', 'session'],
  ['neon_auth', 'verification'],
  ['public', 'profiles'],
  ['public', 'connections'],
]

const client = await pool.connect()
try {
  const found = {}
  for (const [schema, table] of requiredTables) {
    const r = await client.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`${schema}.${table}`],
    )
    found[`${schema}.${table}`] = r.rows[0].exists
  }
  console.log('[v0] tables:', JSON.stringify(found, null, 2))

  const users = await client.query('SELECT count(*)::int AS c FROM neon_auth."user"')
  console.log('[v0] user_count:', users.rows[0].c)

  const profiles = await client.query('SELECT count(*)::int AS c FROM public.profiles')
  console.log('[v0] profiles_count:', profiles.rows[0].c)

  const sessions = await client.query('SELECT count(*)::int AS c FROM neon_auth."session"')
  console.log('[v0] session_count:', sessions.rows[0].c)
} finally {
  client.release()
  await pool.end()
}
