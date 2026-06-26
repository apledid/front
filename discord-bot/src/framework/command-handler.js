import { REST, Routes, Collection } from 'discord.js'
import { errorEmbed, logEmbed, ERROR_COLOR } from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { isBannedFromBot } from '../utils/guard.js'
import { checkPermission } from './permissions.js'
import { checkPolicy } from './rate-limit.js'
import { writeAudit } from './audit.js'
import { rateLimitEmbed } from './embed-kit.js'

/**
 * Middleware-driven command handler.
 *
 * Pipeline (per interaction):
 *   1. ban check     - block known-bad Discord IDs before any work
 *   2. permission    - meta.permission ∈ { public, admin, owner }
 *                       (default 'admin' for backwards compat with the
 *                        existing flat commands that don't declare meta)
 *   3. rate limit    - meta.rateLimit ∈ { cheap, public, admin, destructive }
 *                       (default 'admin')
 *   4. exec          - command.execute(interaction)
 *   5. audit         - row inserted into discord_audit_log + channel mirror
 *                       (commands can call writeAudit() themselves for
 *                        richer per-action detail; auditWrap here is the
 *                        safety net so every action is at least recorded)
 *
 * If exec throws, the audit row is written with success=false and the
 * error message, then a friendly ephemeral reply is sent.
 */

const DEFAULT_META = { permission: 'admin', rateLimit: 'admin' }

export class CommandHandler {
  constructor() {
    this.commands = new Collection()
    this.commandDefs = []  // for slash registration
  }

  register(mod) {
    if (!mod?.data) {
      console.warn('[command-handler] Skipping module without `data` export')
      return
    }
    const name = mod.data.name
    const meta = { ...DEFAULT_META, ...(mod.meta || {}) }
    this.commands.set(name, { ...mod, meta })
    this.commandDefs.push(mod.data.toJSON())
  }

  async registerSlashCommands({ token, clientId, guildId }) {
    const rest = new REST({ version: '10' }).setToken(token)
    // Default: hide every command from non-Discord-admins by setting
    // default_member_permissions='0'. Commands marked meta.permission='public'
    // are visible to everyone (we strip the override so Discord uses its
    // own visible-by-default behavior).
    const commandData = this.commandDefs.map((d) => {
      const cmd = this.commands.get(d.name)
      if (cmd?.meta?.permission === 'public') {
        // Strip - we want Discord to show this command to everyone.
        const { default_member_permissions, ...rest } = d
        void default_member_permissions
        return rest
      }
      return { ...d, default_member_permissions: d.default_member_permissions ?? '0' }
    })
    try {
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData })
        console.log(`[command-handler] ✅ Registered ${commandData.length} guild commands`)
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commandData })
        console.log(`[command-handler] ✅ Registered ${commandData.length} global commands (up to 1h to appear)`)
      }
    } catch (err) {
      console.error('[command-handler] ❌ Failed to register commands:', err.message)
      await sendLog(logEmbed('❌ Command Registration Failed', err.message, ERROR_COLOR))
    }
  }

  async dispatch(interaction) {
    if (!interaction.isChatInputCommand()) return
    const cmd = this.commands.get(interaction.commandName)
    if (!cmd) return

    const meta = cmd.meta
    const subcommand = safeGetSubcommand(interaction)
    const executor = { discord_id: interaction.user.id, username: interaction.user.tag }

    // 1. ban check
    if (isBannedFromBot(executor.discord_id)) {
      console.log(`[handler] BLOCKED /${interaction.commandName} from banned ${executor.username}`)
      return safeReply(interaction, {
        embeds: [errorEmbed('Access Denied', 'You are not allowed to use this bot.')],
        flags: 64,
      })
    }

    // 2. permission
    const perm = await checkPermission(executor.discord_id, meta.permission)
    if (!perm.ok) {
      return safeReply(interaction, {
        embeds: [errorEmbed('Access Denied', perm.reason)],
        flags: 64,
      })
    }

    // 3. rate limit
    const rl = await checkPolicy(meta.rateLimit, executor.discord_id)
    if (!rl.allowed) {
      return safeReply(interaction, {
        embeds: [rateLimitEmbed(rl.retryAfter)],
        flags: 64,
      })
    }

    console.log(`[handler] /${interaction.commandName}${subcommand ? ' ' + subcommand : ''} by ${executor.username}`)

    // 4. exec + 5. audit
    let success = true
    let errorMessage = null
    try {
      await cmd.execute(interaction)
    } catch (err) {
      success = false
      errorMessage = err?.message || String(err)
      console.error(`[handler] Error in /${interaction.commandName}:`, err)
      await sendLog(logEmbed(
        `❌ Command Error: /${interaction.commandName}`,
        `**User:** ${executor.username}\n**Error:** ${errorMessage}`,
        ERROR_COLOR,
      )).catch(() => {})
      const reply = {
        embeds: [errorEmbed('Error', 'An error occurred while executing this command.')],
        flags: 64,
      }
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {})
      } else {
        await interaction.reply(reply).catch(() => {})
      }
    }

    // Best-effort fallback audit row. Commands that want richer detail
    // call writeAudit() themselves (with `mirror: false`) inside their
    // execute() to avoid double-logging.
    // We skip the auto-audit for commands marked `meta.skipAutoAudit`
    // (public commands typically) and on success when the command has
    // already called writeAudit (signalled by attaching `_audited` to
    // the interaction).
    const skipAuto = meta.skipAutoAudit || interaction._audited
    if (!skipAuto) {
      void writeAudit({
        executor,
        command: interaction.commandName,
        subcommand,
        details: { args: safeOptions(interaction) },
        success,
        errorMessage,
        mirror: !success,  // success path already mirrored elsewhere; failures always log
      })
    }
  }
}

function safeGetSubcommand(interaction) {
  try { return interaction.options.getSubcommand(false) || null }
  catch { return null }
}

function safeOptions(interaction) {
  try {
    const opts = {}
    for (const opt of interaction.options.data || []) {
      // Recurse one level into subcommand option data.
      if (Array.isArray(opt.options)) {
        for (const inner of opt.options) {
          if (inner.value !== undefined) opts[inner.name] = String(inner.value).slice(0, 200)
        }
      } else if (opt.value !== undefined) {
        opts[opt.name] = String(opt.value).slice(0, 200)
      }
    }
    return opts
  } catch {
    return {}
  }
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) return interaction.editReply(payload).catch(() => {})
    return interaction.reply(payload).catch(() => {})
  } catch {}
}

/** Helper for command code to mark that it has already written its own
 *  detailed audit row, so the handler skips the fallback insert. */
export function markAudited(interaction) {
  interaction._audited = true
}
