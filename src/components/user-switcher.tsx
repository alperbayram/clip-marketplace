"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CurrentUser = { id: string; email: string; role: "admin" | "creator" };

export function UserSwitcher({
  currentUser,
}: {
  currentUser: CurrentUser | null | undefined;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: users } = trpc.auth.listUsers.useQuery();
  const switchUser = trpc.auth.switchUser.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      router.refresh();
    },
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Dev sign-in:</span>
      <Select
        value={currentUser?.id ?? null}
        onValueChange={(userId) => {
          if (typeof userId === "string") switchUser.mutate({ userId });
        }}
      >
        <SelectTrigger size="sm" className="w-56" aria-label="Switch user">
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>
        <SelectContent>
          {users?.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.email} ({u.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
