import type { SVGProps } from "react"

/**
 * The application mark.
 *
 * A rounded square holding "NC" -- deliberately simple, because it renders at
 * 24px in the sidebar and inside a 36px tile on the sign-in screen, and
 * anything with detail turns to mud at that size.
 */
export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" {...props}>
    <rect width="32" height="32" rx="7" fill="currentColor" />
    <text
      x="16"
      y="21"
      textAnchor="middle"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      fontSize="13"
      fontWeight="600"
      fill="#fff"
    >
      NC
    </text>
  </svg>
)
