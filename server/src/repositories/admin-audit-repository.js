import { query } from '../lib/db.js'

export async function createAdminAuditLog({ actorUserId, targetUserId = null, action, summary, details = null }) {
  const { rows } = await query(
    `
      INSERT INTO admin_audit_logs (actor_user_id, target_user_id, action, summary, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [actorUserId, targetUserId, action, summary, details],
  )
  return rows[0]
}

export async function listAdminAuditLogs({ limit = 100 }) {
  const { rows } = await query(
    `
      SELECT
        aal.*,
        actor.full_name AS actor_full_name,
        actor.email AS actor_email,
        target.full_name AS target_full_name,
        target.email AS target_email
      FROM admin_audit_logs aal
      LEFT JOIN app_users actor ON actor.id = aal.actor_user_id
      LEFT JOIN app_users target ON target.id = aal.target_user_id
      ORDER BY aal.created_at DESC
      LIMIT $1
    `,
    [limit],
  )
  return rows.map((row) => ({
    ...row,
    actor: {
      full_name: row.actor_full_name,
      email: row.actor_email,
    },
    target: {
      full_name: row.target_full_name,
      email: row.target_email,
    },
  }))
}
