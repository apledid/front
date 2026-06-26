import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js'

/**
 * Embed paginator backed by Prev / Next buttons.
 *
 * Usage:
 *
 *   const items = await fetchAllRows()
 *   await paginate(interaction, items, (page, info) =>
 *     buildEmbedForPage(page, info)        // returns EmbedBuilder
 *   , { pageSize: 10 })
 *
 * `renderPage(pageItems, info)` is called once per page render.
 * `info` is `{ page, totalPages, total, pageSize }`.
 *
 * Only the original invoker can navigate. After `timeoutMs` (default
 * 5 min) the buttons disable but the embed stays visible.
 */
export async function paginate(interaction, items, renderPage, {
  pageSize = 10,
  timeoutMs = 5 * 60 * 1000,
} = {}) {
  const safeItems = Array.isArray(items) ? items : []
  const totalPages = Math.max(1, Math.ceil(safeItems.length / pageSize))
  let page = 1

  function buildView() {
    const start = (page - 1) * pageSize
    const pageItems = safeItems.slice(start, start + pageSize)
    const embed = renderPage(pageItems, {
      page,
      totalPages,
      total: safeItems.length,
      pageSize,
    })
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pg:first')
        .setLabel('«')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId('pg:prev')
        .setLabel('‹')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId('pg:info')
        .setLabel(`${page} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('pg:next')
        .setLabel('›')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
      new ButtonBuilder()
        .setCustomId('pg:last')
        .setLabel('»')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    )
    return { embed, row }
  }

  const initial = buildView()
  const reply = interaction.deferred || interaction.replied
    ? await interaction.editReply({ embeds: [initial.embed], components: totalPages > 1 ? [initial.row] : [] })
    : await interaction.reply({ embeds: [initial.embed], components: totalPages > 1 ? [initial.row] : [], fetchReply: true })

  if (totalPages <= 1) return

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
    filter: (i) => i.user.id === interaction.user.id,
  })

  collector.on('collect', async (i) => {
    if (i.customId === 'pg:first') page = 1
    else if (i.customId === 'pg:prev') page = Math.max(1, page - 1)
    else if (i.customId === 'pg:next') page = Math.min(totalPages, page + 1)
    else if (i.customId === 'pg:last') page = totalPages
    else return
    const view = buildView()
    await i.update({ embeds: [view.embed], components: [view.row] }).catch(() => {})
  })

  collector.on('end', async () => {
    try {
      const final = buildView()
      // Disable every button so the message reads as "no longer interactive".
      const disabled = ActionRowBuilder.from(final.row)
      for (const btn of disabled.components) btn.setDisabled(true)
      await interaction.editReply({ embeds: [final.embed], components: [disabled] })
    } catch {}
  })
}
