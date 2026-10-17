import { act } from "@testing-library/react"
import { vi } from "vitest"

/**
 * Stands in for Google Identity Services on window.google: renderButton is a
 * spy, and signIn hands the page a credential as Google's button would.
 */
export function fakeGoogle() {
  let callback: ((r: { credential: string }) => void) | null = null
  const renderButton = vi.fn()
  window.google = {
    accounts: {
      id: {
        initialize: (o) => {
          callback = o.callback
        },
        renderButton,
      },
    },
  }
  return {
    renderButton,
    signIn: (credential: string) => act(() => callback!({ credential })),
  }
}
