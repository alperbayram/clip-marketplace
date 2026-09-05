"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { UserSwitcher } from "./user-switcher";

export function SiteHeader() {
  const { data: me } = trpc.auth.me.useQuery();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold">
            Clip Marketplace
          </Link>
          {me?.role === "admin" && (
            <Link
              href="/admin/campaigns"
              className="text-muted-foreground hover:text-foreground"
            >
              Admin
            </Link>
          )}
          {me?.role === "creator" && (
            <>
              <Link
                href="/campaigns"
                className="text-muted-foreground hover:text-foreground"
              >
                Browse campaigns
              </Link>
              <Link
                href="/my-submissions"
                className="text-muted-foreground hover:text-foreground"
              >
                My submissions
              </Link>
            </>
          )}
        </nav>
        <UserSwitcher currentUser={me} />
      </div>
    </header>
  );
}
