# Local patches to the vendored TailAdmin files

Vendor source: TailAdmin free-nextjs-admin-dashboard @ `3f6902572e9d` (the
Tailwind-v3 snapshot of the v2 design), MIT — see `LICENSE.md`. Everything
under `src/components/{ui,form,common}`, `src/context`, `src/hooks/useModal.ts`
and `src/icons` is vendored: configure, do not edit, except for the deviations
below. Each one is marked `PATCH(new-commerce)` in its file. On a re-pull,
re-apply these.

`src/layout/` and `src/components/header/` are **derived** from TailAdmin's
app chrome and are ours to edit freely; upstream treats them as app code too.

| # | File | What changed and why |
|---|---|---|
| 1 | `ui/button/Button.tsx` | Props extend `ButtonHTMLAttributes` (upstream had no `type`, so no submit buttons), default `type="button"`, `isLoading` spinner state, `ghost` + `destructive` variants, visible `focus-visible:` ring (upstream has none). |
| 2 | `form/input/InputField.tsx` | Props extend `InputHTMLAttributes` and spread (upstream was a closed list with only `defaultValue` — no controlled `value`, `onPaste`, `aria-*`). Adds `aria-invalid` on error. |
| 3 | `ui/modal/index.tsx` | `role="dialog"`, `aria-modal`, optional `labelledBy`; backdrop `bg-gray-900/25`, no blur (upstream `bg-gray-400/50 backdrop-blur-[32px]`). Known accepted gap: no portal, no focus trap — the Dialog wrapper moves focus in. |
| 4 | `form/input/Checkbox.tsx` | Optional `ariaLabel` for checkboxes without a visible label (row selection). **Currently unused** — screens use the custom-drawn `ui/common/Field.tsx` Checkbox (native event shape, no forced label wrapper). |
| 5 | `context/ThemeContext.tsx` | Full-file replacement: a shim over next-themes keeping upstream's `useTheme → {theme, toggleTheme}` shape. Upstream applied the saved theme in an effect (flash of light) and had no system setting. |
| 6 | `components/header/UserDropdown.tsx` | Upstream syntax bug: duplicate `className` on the trigger. (File is ours-derived anyway.) |
| 7 | `ui/table/index.tsx` | `TableRow` props extend `HTMLAttributes<HTMLTableRowElement>` and spread, for clickable rows (upstream took only `children` and `className`). |

Not vendored on purpose: `SidebarWidget` (upsell card), `NotificationDropdown`
(no notifications exist), `GridShape` (demo images), charts, calendar, maps,
carousels and their dependencies. Also `form/Select.tsx`, `form/MultiSelect.tsx`
and `form/switch/Switch.tsx`: uncontrolled with no keyboard/ARIA support —
`ui/common/Select.tsx` (Headless UI Listbox in the TailAdmin skin) is the
select.
