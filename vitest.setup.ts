import "@testing-library/jest-dom/vitest"

// jsdom has no matchMedia; the vendored sidebar asks it whether it is on a
// phone. Answer "no" -- the desktop layout -- for every query.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
