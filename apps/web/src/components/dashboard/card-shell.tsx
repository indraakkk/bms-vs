"use client";

import type { DashboardCard } from "@bms/contract";
import { PencilIcon, XIcon } from "lucide-react";
import { CardRenderer } from "@/components/dashboard/cards/card-renderer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardQuery } from "@/hooks/use-card-query";

export function CardShell({
  card,
  onEdit,
  onRemove,
}: {
  card: DashboardCard;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const query = useCardQuery(card.id, card.config);

  return (
    <Card className="flex h-full w-full flex-col gap-0 py-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3">
        <CardTitle className="truncate text-sm font-medium">{card.title}</CardTitle>
        <div className="flex shrink-0 gap-1" data-no-drag>
          <Button size="icon-xs" variant="ghost" onClick={onEdit} aria-label="Configure card">
            <PencilIcon />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Remove card">
            <XIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-3 pt-2">
        {card.config === null ? (
          <EmptyState message="Configure this card" onClick={onEdit} />
        ) : query.isPending ? (
          <Skeleton className="h-full w-full" />
        ) : query.isError ? (
          <ErrorState message={query.error.message} />
        ) : query.data.rows.length === 0 ? (
          <EmptyState message="No data for this range" />
        ) : (
          <CardRenderer config={card.config} data={query.data} />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, onClick }: { message: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex h-full w-full items-center justify-center rounded-md border border-dashed text-center text-muted-foreground text-xs enabled:hover:bg-accent/50"
    >
      {message}
    </button>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-2 text-center text-destructive text-xs">
      {message}
    </div>
  );
}
