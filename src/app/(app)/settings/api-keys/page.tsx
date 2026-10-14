"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { CopyField } from "@/components/ui/common/CopyField"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { RowMenu } from "@/components/ui/common/RowMenu"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { ApiKey, ApiKeyCreated, ApiKeyList } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"

// P1-201: storefront API keys (04-api-spec.md §4; BR-028, BR-083). The key
// itself comes back once, from create, and is shown in a dialog that only an
// explicit "I've copied it" closes.

// Served by the API (P1-213); relative, like every call, so the dev rewrite
// and the production host both resolve it.
const docsHref = "/v1/storefront/openapi.json"

export default function ApiKeysPage() {
  const canRead = useCan("api_keys:read")
  const canWrite = useCan("api_keys:write")
  const { tenant } = useSession()
  const { data, error, loading, reload } = useResource<ApiKeyList>(
    canRead ? "/v1/api-keys" : null,
  )
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const [editing, setEditing] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  if (!canRead)
    return (
      <Page title="API keys">
        <Empty title="You don't have access to API keys." />
      </Page>
    )

  return (
    <Page
      title="API keys"
      description="Keys let your website read the catalog and take orders through the storefront API. Each key works from one website address."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a
          href={docsHref}
          target="_blank"
          rel="noreferrer"
          className="text-theme-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          Storefront API documentation
        </a>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)}>
            Create key
          </Button>
        )}
      </div>
      <ErrorNotice error={error} title="Could not load API keys" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No API keys yet" />
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={th}>
                Name
              </TableCell>
              <TableCell isHeader className={th}>
                Website
              </TableCell>
              <TableCell isHeader className={th}>
                Created
              </TableCell>
              <TableCell isHeader className={th}>
                Last used
              </TableCell>
              {canWrite && (
                <TableCell isHeader className={`${th} text-right`}>
                  <span className="sr-only">Actions</span>
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((k) => (
              <TableRow key={k.id}>
                <TableCell className={td}>
                  <div className="font-medium text-gray-800 dark:text-white/90">
                    {k.name}
                  </div>
                  {k.created_by && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      by {k.created_by.name}
                    </div>
                  )}
                </TableCell>
                <TableCell className={`${td} font-mono text-xs`}>
                  {k.allowed_origin}
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {formatDateTime(k.created_at, tenant?.timezone)}
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {k.last_used_at
                    ? formatDateTime(k.last_used_at, tenant?.timezone)
                    : "Never"}
                </TableCell>
                {canWrite && (
                  <TableCell className={`${td} text-right`}>
                    <RowMenu
                      label={`Actions for ${k.name}`}
                      actions={[
                        { label: "Edit", onSelect: () => setEditing(k) },
                        {
                          label: "Revoke",
                          destructive: true,
                          onSelect: () => setRevoking(k),
                        },
                      ]}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      ) : null}
      <KeyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(k) => {
          if (k) setCreated(k)
          reload()
        }}
      />
      <KeyDialog
        open={editing !== null}
        apiKey={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <CreatedDialog apiKey={created} onClose={() => setCreated(null)} />
      <RevokeDialog
        apiKey={revoking}
        onClose={() => setRevoking(null)}
        onDone={reload}
      />
    </Page>
  )
}

/** Create a key, or edit one when apiKey is given. */
/**
 * What the merchant typed, as the origin the key is bound to: "tokoabc.com",
 * "www.tokoabc.com/" and "HTTPS://TokoABC.com/shop" become their https://
 * origin; an explicit http:// stays. Anything that doesn't parse goes as typed,
 * so the server's 422 explains it.
 */
function toOrigin(typed: string) {
  const s = typed.trim()
  try {
    const { origin } = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(s) ? s : `https://${s}`,
    )
    return origin === "null" ? s : origin
  } catch {
    return s
  }
}

function KeyDialog({
  open,
  apiKey,
  onClose,
  onSaved,
}: {
  open: boolean
  apiKey?: ApiKey | null
  onClose: () => void
  /** Called with the new key on create, with nothing on edit. */
  onSaved: (created?: ApiKeyCreated) => void
}) {
  const api = useApi()
  const [form, setForm] = useState({ name: "", allowed_origin: "" })
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  // Prefill when the dialog opens on a different key.
  if (open && apiKey && loadedFor !== apiKey.id) {
    setLoadedFor(apiKey.id)
    setForm({ name: apiKey.name, allowed_origin: apiKey.allowed_origin })
  }

  function close() {
    setForm({ name: "", allowed_origin: "" })
    setError(null)
    setLoadedFor(null)
    onClose()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const sent = { ...form, allowed_origin: toOrigin(form.allowed_origin) }
    setForm(sent)
    try {
      if (apiKey) {
        // Send only what changed (BR-009).
        const body: Record<string, string> = {}
        if (sent.name !== apiKey.name) body.name = sent.name
        if (sent.allowed_origin !== apiKey.allowed_origin)
          body.allowed_origin = sent.allowed_origin
        await api(`/v1/api-keys/${apiKey.id}`, { method: "PATCH", body })
        onSaved()
      } else {
        onSaved(
          await api<ApiKeyCreated>("/v1/api-keys", {
            method: "POST",
            body: sent,
          }),
        )
      }
      close()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={apiKey ? `Edit ${apiKey.name}` : "Create an API key"}
      description={
        apiKey
          ? "Changing the website address takes effect within a minute."
          : "The key works only from the website address you give it, and from your website's own server."
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field id="key-name" label="Name" error={fieldError(error, "name")}>
          <Input
            id="key-name"
            required
            placeholder="Main website"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field
          id="key-origin"
          label="Website address"
          hint="Such as tokoabc.com or www.tokoabc.com; https:// is added for you. A second address needs its own key."
          error={fieldError(error, "allowed_origin")}
        >
          <Input
            id="key-origin"
            required
            placeholder="tokoabc.com"
            value={form.allowed_origin}
            onChange={(e) =>
              setForm({ ...form, allowed_origin: e.target.value })
            }
            onBlur={() =>
              setForm({
                ...form,
                allowed_origin: toOrigin(form.allowed_origin),
              })
            }
          />
        </Field>
        {error && !error.problem.errors?.length && (
          <ErrorNotice error={error} title="Could not save the key" />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={busy}>
            {apiKey ? "Save" : "Create key"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * The one sight of a key's plaintext (BR-028). Not dismissible by Escape or
 * the overlay: closing it by accident would lose the key for good.
 */
function CreatedDialog({
  apiKey,
  onClose,
}: {
  apiKey: ApiKeyCreated | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={apiKey !== null}
      onOpenChange={(o) => !o && onClose()}
      dismissible={false}
      title="Copy your API key now"
      description={`For ${apiKey?.allowed_origin ?? ""}. Put it in your website's settings.`}
      footer={
        <Button size="sm" onClick={onClose}>
          I&apos;ve copied it
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          role="alert"
          className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400"
        >
          This is the only time the key is shown. If you lose it, revoke it
          and create a new one.
        </div>
        {apiKey && <CopyField id="new-key" label="API key" value={apiKey.key} />}
      </div>
    </Dialog>
  )
}

function RevokeDialog({
  apiKey,
  onClose,
  onDone,
}: {
  apiKey: ApiKey | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function revoke() {
    if (!apiKey) return
    setBusy(true)
    try {
      await api(`/v1/api-keys/${apiKey.id}`, { method: "DELETE" })
      setError(null)
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={apiKey !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Revoke ${apiKey?.name ?? ""}?`}
      description={`Your website at ${apiKey?.allowed_origin ?? ""} stops working with this key within a minute. This can't be undone.`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            isLoading={busy}
            onClick={revoke}
          >
            Revoke
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
