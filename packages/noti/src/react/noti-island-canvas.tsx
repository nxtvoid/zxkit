'use client'

import { useId, useState, type CSSProperties } from 'react'
import { nextInstanceId } from '../core/instance-id'

interface NotiIslandCanvasProps {
  /**
   * How wide to draw. Passed in rather than read from a constant: the item
   * measures the box the stylesheet resolved, and a silhouette on a different
   * width than the element misaligns the pill, the header and the mask.
   */
  width: number
  /** The pill's height, same source as the width. */
  compactHeight: number
  /** Full height of the silhouette, pill included. */
  height: number
  /** How tall the card body is below the pill. Zero while compact. */
  bodyHeight: number
  edge: 'top' | 'bottom'
  fill: string
  roundness: number
  blur: number
  expanded: boolean
}

/**
 * The island silhouette: two rectangles through one alpha-merging filter. The
 * blur spreads their edges, the colour matrix snaps the alpha back hard, and
 * what is left where they meet is a concave neck no border radius can express.
 */
export function NotiIslandCanvas({
  width,
  compactHeight,
  height,
  bodyHeight,
  edge,
  fill,
  roundness,
  blur,
  expanded,
}: NotiIslandCanvasProps) {
  const reactId = useId()
  // `useId` is only unique inside one React root, and the store is shared
  // across roots and duplicate bundles on purpose. Two islands with the same
  // filter id would have one resolving the other's `url(#…)`.
  const [unique] = useState(nextInstanceId)
  const filterId = `noti-island-goo-${reactId.replaceAll(':', '')}-${unique}`

  // The pill overshoots into the body: without that overlap the filter has
  // nothing to merge and the two shapes meet as a straight seam.
  const pillHeight = expanded ? compactHeight + blur * 3 : compactHeight

  const style: CSSProperties = {
    ['--noti-pill-height' as string]: `${pillHeight}px`,
    ['--noti-body-rect-height' as string]: `${bodyHeight}px`,
    // After the goo, never inside it: a shadow drawn before the alpha matrix is
    // snapped away by it. The fallback keeps the chain valid without a stylesheet.
    filter: `url(#${filterId}) var(--noti-shadow, drop-shadow(0 0 0 transparent))`,
  }

  // `fill` as a property, not the presentation attribute: the default is a
  // `var()`, and browsers do not substitute one inside an SVG attribute.
  const surface: CSSProperties = { fill }

  return (
    <div data-noti-island-canvas='' data-noti-edge={edge} aria-hidden='true' style={style}>
      <svg data-noti-island-svg='' width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter
            id={filterId}
            x='-20%'
            y='-20%'
            width='140%'
            height='140%'
            colorInterpolationFilters='sRGB'
          >
            <feGaussianBlur in='SourceGraphic' stdDeviation={blur} result='blur' />
            <feColorMatrix
              in='blur'
              mode='matrix'
              values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10'
              result='goo'
            />
            <feComposite in='SourceGraphic' in2='goo' operator='atop' />
          </filter>
        </defs>

        <rect data-noti-island-pill='' rx={roundness} ry={roundness} style={surface} />
        <rect
          data-noti-island-body=''
          y={compactHeight}
          width={width}
          rx={roundness}
          ry={roundness}
          style={surface}
          opacity={expanded ? 1 : 0}
        />
      </svg>
    </div>
  )
}
