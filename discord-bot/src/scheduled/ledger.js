import supabase from '../utils/supabase.js'

/**
 * Write the result of a scheduled task to the bot_scheduled_tasks ledger.
 * `/staff schedule status` reads this table to show when each task last
 * ran and what it did.
 */
export async function writeTaskResult(taskKey, { status, details, error }) {
  try {
    await supabase
      .from('bot_scheduled_tasks')
      .upsert({
        task_key: taskKey,
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        last_run_details: details || {},
        last_error: error || null,
      }, { onConflict: 'task_key' })
  } catch (err) {
    console.error(`[scheduled-ledger] Failed to write ${taskKey} result:`, err?.message || err)
  }
}
