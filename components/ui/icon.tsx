import type { ComponentType } from 'react'
import type { IconProps } from '@tabler/icons-react'

import { cn } from '@/lib/utils'

/**
 * Consistent Tabler icon wrapper. Locks the stroke weight (1.75) and a default
 * 18px footprint so every icon across the app reads with the same weight and
 * size. Pass any Tabler icon via the `icon` prop; override size with a
 * `size-*` class and weight with `stroke`.
 *
 *   import { IconHome } from '@tabler/icons-react'
 *   <Icon icon={IconHome} />
 *   <Icon icon={IconHome} className="size-5" stroke={2} />
 */
export function Icon({
  icon: Glyph,
  className,
  stroke = 1.75,
  ...props
}: IconProps & { icon: ComponentType<IconProps> }) {
  return <Glyph stroke={stroke} className={cn('size-[18px] shrink-0', className)} {...props} />
}
