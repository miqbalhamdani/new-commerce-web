"use client"

import Input from "@/components/form/input/InputField"
import { EyeCloseIcon, EyeIcon } from "@/icons"
import { useState } from "react"

/** The vendored InputField with TailAdmin's show/hide eye, as in its sign-in form. */
export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        aria-label="Change password visibility"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-4 top-[22px] z-9 -translate-y-1/2 cursor-pointer text-gray-500 dark:text-gray-400"
      >
        {visible ? (
          <EyeIcon aria-hidden="true" className="size-5 fill-current" />
        ) : (
          <EyeCloseIcon aria-hidden="true" className="size-5 fill-current" />
        )}
      </button>
    </div>
  )
}
