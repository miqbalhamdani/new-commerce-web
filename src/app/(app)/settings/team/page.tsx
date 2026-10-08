"use client"

import { useState } from "react"

import Badge from "@/components/ui/badge/Badge"
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
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, NativeSelect } from "@/components/ui/common/Field"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Role, User, UserPage } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"

// P1-066: team and roles (04-api-spec.md §4; BR-023, BR-025..BR-027). The
// role picker renders from GET /v1/roles, never a hardcoded list.

const statusBadge = {
  invited: "warning",
  active: "success",
  disabled: "light",
} as const

export default function TeamPage() {
  const canRead = useCan("users:read")
  const canWrite = useCan("users:write")
  const { user: me, tenant } = useSession()
  const [cursor, setCursor] = useState<string | null>(null)
  const { data, error, loading, reload } = useResource<UserPage>(
    canRead ? `/v1/users?limit=50${cursor ? `&cursor=${cursor}` : ""}` : null,
  )
  const { data: roles } = useResource<Role[]>(canRead ? "/v1/roles" : null)
  const [inviting, setInviting] = useState(false)
  const [rowError, setRowError] = useState<ApiError | null>(null)
  const api = useApi()
  // Only an owner can grant or change the owner role (BR-023).
  const grantable = (roles ?? []).filter(
    (r) => r.name !== "owner" || me?.role === "owner",
  )

  if (!canRead)
    return (
      <Page title="Team">
        <Empty title="You don't have access to the team." />
      </Page>
    )

  async function act(path: string, method: string, body?: unknown) {
    try {
      await api(path, { method, body })
      setRowError(null)
      reload()
    } catch (err) {
      setRowError(asApiError(err))
    }
  }

  return (
    <Page
      title="Team"
      description="Who can sign in to your shop's admin, and what each person can do."
      actions={
        canWrite && (
          <Button size="sm" onClick={() => setInviting(true)}>
            Invite someone
          </Button>
        )
      }
    >
      <ErrorNotice
        error={error ?? rowError}
        title="Could not update the team"
      />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="Nobody yet" />
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={th}>
                Name
              </TableCell>
              <TableCell isHeader className={th}>
                Role
              </TableCell>
              <TableCell isHeader className={th}>
                Status
              </TableCell>
              <TableCell isHeader className={th}>
                Last sign-in
              </TableCell>
              {canWrite && (
                <TableCell isHeader className={`${th} text-right`}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((u: User) => {
              const editable =
                canWrite && (u.role !== "owner" || me?.role === "owner")
              return (
                <TableRow key={u.id}>
                  <TableCell className={td}>
                    <div className="font-medium text-gray-800 dark:text-white/90">
                      {u.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell className={td}>
                    {editable ? (
                      <NativeSelect
                        className="!h-9"
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={(e) =>
                          void act(`/v1/users/${u.id}`, "PATCH", {
                            role: e.target.value,
                          })
                        }
                      >
                        {grantable.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      u.role
                    )}
                  </TableCell>
                  <TableCell className={td}>
                    <Badge size="sm" color={statusBadge[u.status]}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`${td} text-gray-500 dark:text-gray-400`}
                  >
                    {formatDateTime(u.last_login_at, tenant?.timezone)}
                  </TableCell>
                  {canWrite && (
                    <TableCell className={`${td} text-right`}>
                      {editable && u.status === "invited" && (
                        <Button
                          size="sm"
                          className="!py-1.5"
                          variant="ghost"
                          onClick={() =>
                            void act(`/v1/users/${u.id}/resend-invite`, "POST")
                          }
                        >
                          Resend invite
                        </Button>
                      )}
                      {editable && u.status === "active" && u.id !== me?.id && (
                        <Button
                          size="sm"
                          className="!py-1.5"
                          variant="ghost"
                          onClick={() =>
                            void act(`/v1/users/${u.id}`, "DELETE")
                          }
                        >
                          Disable
                        </Button>
                      )}
                      {editable && u.status === "disabled" && (
                        <Button
                          size="sm"
                          className="!py-1.5"
                          variant="ghost"
                          onClick={() =>
                            void act(`/v1/users/${u.id}`, "PATCH", {
                              status: "active",
                            })
                          }
                        >
                          Re-enable
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </ListTable>
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(data.next_cursor)}
          >
            Next page
          </Button>
        </div>
      )}
      <InviteDialog
        open={inviting}
        roles={grantable}
        onClose={() => setInviting(false)}
        onDone={reload}
      />
    </Page>
  )
}

function InviteDialog({
  open,
  roles,
  onClose,
  onDone,
}: {
  open: boolean
  roles: Role[]
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [form, setForm] = useState({ email: "", name: "", role: "ops" })
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api("/v1/users/invite", { method: "POST", body: form })
      setForm({ email: "", name: "", role: "ops" })
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
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Invite someone"
      description="They get an email with a link to set a password. The link works for 7 days."
    >
      <form onSubmit={invite} className="flex flex-col gap-3">
        <Field
          id="invite-email"
          label="Email"
          error={fieldError(error, "email")}
        >
          <Input
            id="invite-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field id="invite-name" label="Name" error={fieldError(error, "name")}>
          <Input
            id="invite-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field id="invite-role" label="Role" error={fieldError(error, "role")}>
          <NativeSelect
            id="invite-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} — {r.description}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {error && !error.problem.errors?.length && (
          <ErrorNotice error={error} title="Could not invite" />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={busy}>
            Send invitation
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
