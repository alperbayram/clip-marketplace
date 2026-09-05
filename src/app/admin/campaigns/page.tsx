"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { CAMPAIGN_STATUSES } from "@/shared/validators/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function AdminCampaignsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const { data, isLoading } = trpc.campaign.adminList.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: (status as (typeof CAMPAIGN_STATUSES)[number]) || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button
          nativeButton={false}
          render={<Link href="/admin/campaigns/new">New campaign</Link>}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by title…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search campaigns by title"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(typeof value === "string" ? value : null);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status && (
          <Button variant="ghost" onClick={() => setStatus(null)}>
            Clear filter
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payout / 1k views</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {campaign.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  ${(campaign.payoutPerKViewsCents / 100).toFixed(2)}
                </TableCell>
                <TableCell>
                  ${(campaign.totalBudgetCents / 100).toFixed(2)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {campaign.startsAt} → {campaign.endsAt}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
