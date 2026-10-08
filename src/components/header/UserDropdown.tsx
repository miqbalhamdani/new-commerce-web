"use client"

// Derived from TailAdmin's UserDropdown (@3f6902572e9d) and ours to edit: the
// demo identity and profile links are replaced by the session user, a system
// theme item (the header toggle only flips light/dark) and sign out.

import { Dropdown } from "../ui/dropdown/Dropdown"
import { DropdownItem } from "../ui/dropdown/DropdownItem"
import { useSession } from "@/lib/auth/session"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import React, { useState } from "react"

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, tenant, signOut } = useSession()
  const { setTheme } = useTheme()
  const router = useRouter()

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation()
    setIsOpen((open) => !open)
  }

  function closeDropdown() {
    setIsOpen(false)
  }

  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        aria-label="User menu"
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-theme-sm font-semibold text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400">
          {initials}
        </span>

        <span className="mr-1 block text-theme-sm font-medium">{user?.name}</span>

        <svg
          aria-hidden="true"
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
            {user?.name}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {user?.role} · {tenant?.name}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pb-3 pt-4 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={() => {
                setTheme("system")
                closeDropdown()
              }}
              baseClassName=""
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Use system theme
            </DropdownItem>
          </li>
        </ul>
        <DropdownItem
          onItemClick={() => {
            closeDropdown()
            void signOut().then(() => router.replace("/login"))
          }}
          baseClassName=""
          className="group mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          Sign out
        </DropdownItem>
      </Dropdown>
    </div>
  )
}
