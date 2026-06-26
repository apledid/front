import cron from 'node-cron'
// nightly-cleanup deliberately not imported. The job posted a daily
// "Deleted N unverified accounts" report that spammed the staff
// channel with a list of dead usernames. Disabled at the user's
// request. Re-add by uncommenting the import + the TASKS entry below
// if/when the report becomes useful again. The module file is
// preserved so the cleanup logic can still be invoked manually via
// /staff schedule run-now nightly_cleanup once the entry is restored.
import * as weeklyLeaderboard from './weekly-leaderboard.js'
import * as dailyStats from './daily-stats.js'
import * as rankBadges from './rank-badges.js'

/**
 * Registers all scheduled tasks. Called once at startup from index.js
 * after the Discord client is logged in.
 *
 * Each task is registered with node-cron and also exposed by key for
 * `/staff schedule run-now <task>` to invoke directly. The bot is a
 * single-instance Railway deploy so we don't need distributed locking;
 * the bot_scheduled_tasks ledger gives us observability when a job ran.
 *
 * All cron expressions are interpreted as UTC.
 */

export const TASKS = {
  // nightly_cleanup intentionally removed (2026-05). Was deleting
  // unverified accounts older than 24h every night at 03:00 UTC and
  // posting a noisy report to the staff channel. The cleanup logic
  // still exists in /staff cleanup (commands/staff.js) for manual
  // runs; just isn't on a schedule anymore.
  [weeklyLeaderboard.taskKey]: {
    cronExpr: '0 9 * * 1',   // Monday 09:00 UTC
    run: weeklyLeaderboard.run,
    needsClient: true,
    description: 'Post top-10 leaderboard to LEADERBOARD_CHANNEL_ID',
  },
  [dailyStats.taskKey]: {
    cronExpr: '0 8 * * *',   // 08:00 UTC daily
    run: dailyStats.run,
    needsClient: true,
    description: 'Post platform-stats card to STAFF_CHANNEL_ID',
  },
  [rankBadges.taskKey]: {
    cronExpr: '15 * * * *',  // hourly at :15 - the leaderboard is live, so a
                             // daily badge pass left a #3 wearing a #1 badge
                             // for hours after the ranking changed.
    run: rankBadges.run,
    needsClient: false,
    description: 'Grant/revoke top-3 leaderboard rank badges (#1/#2/#3)',
  },
}

let registered = false

/** Register all cron tasks. Idempotent. */
export function registerSchedules(client) {
  if (registered) return
  for (const [key, task] of Object.entries(TASKS)) {
    cron.schedule(task.cronExpr, async () => {
      console.log(`[cron] firing ${key} (${task.cronExpr})`)
      try {
        await task.run(task.needsClient ? client : undefined)
      } catch (err) {
        console.error(`[cron] ${key} threw:`, err?.message || err)
      }
    }, { timezone: 'UTC' })
    console.log(`[cron] registered ${key} @ ${task.cronExpr} UTC`)
  }
  registered = true
  console.log(`[cron] registered ${Object.keys(TASKS).length} tasks`)
}

/** Invoke a task by key. Used by /staff schedule run-now <task>.
 *  Returns the task's return value. */
export async function runTaskNow(key, client) {
  const task = TASKS[key]
  if (!task) throw new Error(`Unknown task: ${key}`)
  return task.run(task.needsClient ? client : undefined)
}
