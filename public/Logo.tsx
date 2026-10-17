import type { SVGProps } from "react"

/**
 * The application mark.
 *
 * A rounded square holding "B", for Belli.id -- deliberately simple, because
 * it renders at 24px in the sidebar and inside a 36px tile on the sign-in
 * screen, and anything with detail turns to mud at that size. app/icon.svg is
 * the same mark for the browser tab.
 */
export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" {...props}>
    <rect width="32" height="32" rx="7" fill="currentColor" />
    <text
      x="16"
      y="22.5"
      textAnchor="middle"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      fontSize="18"
      fontWeight="700"
      fill="#fff"
    >
      B
    </text>
  </svg>
)
