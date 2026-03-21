import { query, withTransaction } from '../lib/db.js'

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
  return rows[0] || null
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [id])
  return rows[0] || null
}

export async function listUsers() {
  const { rows } = await query(`
    SELECT id, email, full_name, role, is_active, created_at, updated_at
    FROM app_users
    ORDER BY full_name ASC, email ASC
  `)
  return rows
}

export async function createUser(input) {
  const { rows } = await query(
    `
      INSERT INTO app_users (email, password_hash, full_name, role, is_active)
      VALUES (LOWER($1), $2, $3, $4, COALESCE($5, true))
      RETURNING *
    `,
    [input.email, input.password_hash, input.full_name, input.role, input.is_active],
  )
  return rows[0]
}

export async function updateUserStatus(id, isActive) {
  const { rows } = await query(
    `
      UPDATE app_users
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, isActive],
  )
  return rows[0] || null
}

export async function createInvite(input) {
  const { rows } = await query(
    `
      INSERT INTO user_invitations (email, full_name, role, token_hash, expires_at, invited_by)
      VALUES (LOWER($1), $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          token_hash = EXCLUDED.token_hash,
          expires_at = EXCLUDED.expires_at,
          invited_by = EXCLUDED.invited_by,
          accepted_at = NULL,
          updated_at = NOW()
      RETURNING id, email, full_name, role, expires_at
    `,
    [input.email, input.full_name, input.role, input.token_hash, input.expires_at, input.invited_by],
  )
  return rows[0]
}

export async function findInviteByTokenHash(tokenHash) {
  const { rows } = await query(
    `
      SELECT *
      FROM user_invitations
      WHERE token_hash = $1
        AND accepted_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash],
  )
  return rows[0] || null
}

export async function completeInvite(invite, passwordHash) {
  return withTransaction(async (client) => {
    const existingUser = await client.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [invite.email])
    if (existingUser.rows[0]) {
      throw Object.assign(new Error('A user with this email already exists.'), { status: 409 })
    }

    const userResult = await client.query(
      `
        INSERT INTO app_users (email, password_hash, full_name, role, is_active)
        VALUES (LOWER($1), $2, $3, $4, true)
        RETURNING *
      `,
      [invite.email, passwordHash, invite.full_name, invite.role],
    )

    await client.query(
      `
        UPDATE user_invitations
        SET accepted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [invite.id],
    )

    return userResult.rows[0]
  })
}
