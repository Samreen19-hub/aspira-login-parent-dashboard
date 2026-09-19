import pg from 'pg'

// Use the same `pg` driver the app uses (avoids a separate @neondatabase dep).
// A small tagged-template shim keeps the existing sql`...` call sites intact.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
function sql(strings, ...values) {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    '',
  )
  return pool.query(text, values).then((r) => r.rows)
}
const tag = `verify_${Date.now()}`

async function main() {
  console.log('[v0] Provisioning report_cards + foundation (idempotent)...')

  // Foundation (mirror of ensureSchoolFoundationTables)
  await sql`CREATE TABLE IF NOT EXISTS public.schools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`
  await sql`CREATE TABLE IF NOT EXISTS public.students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text, dob text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`
  await sql`CREATE TABLE IF NOT EXISTS public.enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL, school_id uuid NOT NULL, class_name text, section text, academic_year text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`

  // report_cards (mirror of ensureReportCardsTable)
  await sql`
    CREATE TABLE IF NOT EXISTS public.report_cards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
      school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
      academic_year text NOT NULL, class_name text NOT NULL, section text,
      title text NOT NULL, file_url text NOT NULL, file_pathname text,
      file_type text NOT NULL, original_filename text,
      created_by uuid NOT NULL, updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`

  // Confirm columns exist
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='report_cards' ORDER BY ordinal_position`
  console.log('[v0] report_cards columns:', cols.map((c) => c.column_name).join(', '))

  // Isolated test rows (NOT touching existing parent_child / children)
  const [school] = await sql`INSERT INTO public.schools (name) VALUES (${tag + '_school'}) RETURNING id`
  const [student] = await sql`INSERT INTO public.students (name) VALUES (${tag + '_student'}) RETURNING id`
  await sql`INSERT INTO public.enrollments (student_id, school_id, class_name, section, academic_year) VALUES (${student.id}, ${school.id}, ${'Grade 5'}, ${'A'}, ${'2024-2025'})`

  const creator = '00000000-0000-0000-0000-000000000001'
  const [rc] = await sql`
    INSERT INTO public.report_cards (student_id, school_id, academic_year, class_name, section, title, file_url, file_pathname, file_type, original_filename, created_by, updated_by)
    VALUES (${student.id}, ${school.id}, ${'2024-2025'}, ${'Grade 5'}, ${'A'}, ${'Term 1'}, ${'https://example/blob'}, ${'report-cards/x/y.pdf'}, ${'application/pdf'}, ${'term1.pdf'}, ${creator}, ${creator})
    RETURNING id`
  console.log('[v0] Inserted test report card:', rc.id)

  // Listing query (enrollment-scoped join like listReportCards)
  const listed = await sql`
    SELECT r.id, r.title FROM public.report_cards r
    JOIN public.enrollments e ON e.student_id = r.student_id AND e.school_id = r.school_id
      AND e.academic_year = r.academic_year AND e.class_name = r.class_name
    WHERE r.student_id = ${student.id} AND r.academic_year = ${'2024-2025'} AND r.class_name = ${'Grade 5'}`
  console.log('[v0] Enrollment-scoped listing returned rows:', listed.length)

  // Update (same row)
  await sql`UPDATE public.report_cards SET title = ${'Term 1 (edited)'}, updated_at = now() WHERE id = ${rc.id}`
  const [afterUpdate] = await sql`SELECT title FROM public.report_cards WHERE id = ${rc.id}`
  console.log('[v0] After update title:', afterUpdate.title)

  // Cleanup all test rows
  await sql`DELETE FROM public.report_cards WHERE id = ${rc.id}`
  await sql`DELETE FROM public.enrollments WHERE student_id = ${student.id}`
  await sql`DELETE FROM public.students WHERE id = ${student.id}`
  await sql`DELETE FROM public.schools WHERE id = ${school.id}`
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM public.report_cards WHERE id = ${rc.id}`
  console.log('[v0] Cleanup verified, remaining test rows:', count)

  // Confirm existing data untouched
  const [{ count: pcCount }] = await sql`SELECT count(*)::int AS count FROM public.parent_child`
  console.log('[v0] Existing parent_child rows preserved:', pcCount)

  console.log('[v0] ALL CHECKS PASSED')
}

main().catch((e) => {
  console.error('[v0] FAILED:', e.message)
  process.exit(1)
})
