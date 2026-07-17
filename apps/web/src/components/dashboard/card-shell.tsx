"use client";

import type { DashboardCard } from "@bms/contract";
import { CardRenderer } from "@/components/dashboard/cards/card-renderer";
import {
  CARD_TYPE_ICON,
  IconAlertCircle,
  IconChartEmpty,
  IconDuplicate,
  IconGrip,
  IconPencil,
  IconSpinner,
  IconTrash,
} from "@/components/icons";
import { useCardQuery } from "@/hooks/use-card-query";
import { columnLabel, summarizeConfig } from "@/lib/card-defaults";
import { cn } from "@/lib/utils";

export function CardShell({
  card,
  removing = false,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  card: DashboardCard;
  removing?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const query = useCardQuery(card.id, card.config);
  const TypeIcon = CARD_TYPE_ICON[card.cardType];

  const status =
    card.config === null
      ? "unconfigured"
      : query.isPending
        ? "loading"
        : query.isError
          ? "error"
          : query.data.rows.length === 0
            ? "empty"
            : "ready";

  const filterChip =
    card.config?.filter &&
    `${columnLabel(card.config.source, card.config.filter.column)} = ${card.config.filter.value}`;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[14px] border bg-card",
        removing
          ? "pointer-events-none animate-[card-out_0.2s_ease_forwards]"
          : "animate-[card-in_0.42s_cubic-bezier(0.2,0.8,0.2,1)]",
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <header className="bms-card-drag flex shrink-0 cursor-grab items-center gap-2 border-b bg-card py-[9px] pr-2.5 pl-2 active:cursor-grabbing">
        <span className="flex shrink-0 text-fg-subtle print:hidden" title="Drag to move">
          <IconGrip size={15} />
        </span>
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <TypeIcon size={14} />
        </span>
        <div className="min-w-0 flex-1 leading-[1.25]">
          <div className="truncate font-bold text-[12.5px]">{card.title}</div>
          <div className="truncate text-[10.5px] text-fg-subtle">
            {card.config ? summarizeConfig(card.config) : "Choose a data source & axes"}
          </div>
        </div>
        <div className="flex shrink-0 gap-px print:hidden" data-no-drag>
          <CardAction label="Configure" onClick={onEdit}>
            <IconPencil size={14} />
          </CardAction>
          <CardAction label="Duplicate" onClick={onDuplicate}>
            <IconDuplicate size={14} />
          </CardAction>
          <CardAction label="Remove" onClick={onRemove} destructive>
            <IconTrash size={14} />
          </CardAction>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        {status === "unconfigured" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-[11px] text-center text-muted-foreground">
            <div className="flex size-[46px] items-center justify-center rounded-xl bg-surface-3 text-fg-subtle">
              <IconPencil size={22} />
            </div>
            <div className="max-w-[180px] text-[12.5px] leading-snug">
              Configure this card to pick a data source &amp; axes
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-primary px-[15px] py-[7px] font-bold text-[12px] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Configure card
            </button>
          </div>
        )}

        {status === "loading" && <LoadingState />}

        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-[9px] text-center text-crit">
            <IconAlertCircle size={26} />
            <div className="max-w-[200px] text-[12px] text-muted-foreground">
              {query.error?.message}
            </div>
          </div>
        )}

        {status === "empty" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-[9px] text-center text-fg-subtle">
            <IconChartEmpty size={26} />
            <div className="max-w-[200px] text-[12.5px] text-muted-foreground">
              No rows match this configuration &amp; the current filters
            </div>
          </div>
        )}

        {status === "ready" && card.config && query.data && (
          <div className="min-h-0 flex-1">
            <CardRenderer cardId={card.id} config={card.config} data={query.data} />
          </div>
        )}
      </div>

      {status === "ready" && query.data && (
        <footer className="flex shrink-0 items-center gap-2 border-t px-[11px] py-[7px] font-mono text-[10.5px] text-fg-subtle">
          <span>
            {query.data.meta.rowCount} {query.data.meta.rowCount === 1 ? "row" : "rows"} ·{" "}
            {query.data.meta.executedInMs.toFixed(1)} ms
          </span>
          {filterChip && (
            <span className="ml-auto max-w-[55%] truncate rounded-full bg-surface-3 px-[7px] py-0.5 text-muted-foreground">
              {filterChip}
            </span>
          )}
        </footer>
      )}
    </div>
  );
}

function CardAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-[26px] items-center justify-center rounded-[7px] text-fg-subtle transition-colors",
        destructive ? "hover:bg-crit-soft hover:text-crit" : "hover:bg-surface-3 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[9px]">
      <ShimmerBar className="h-[11px] w-[55%]" />
      <ShimmerBar className="h-11 w-4/5 rounded-lg" />
      <ShimmerBar className="h-[11px] w-2/5" />
      <div className="mt-1 flex items-center gap-2 text-[11.5px] text-fg-subtle">
        <IconSpinner size={14} />
        Querying SQL Server…
      </div>
    </div>
  );
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[5px] bg-surface-3", className)}>
      <span className="absolute inset-0 translate-x-[-160%] animate-[shimmer_1.3s_infinite] bg-gradient-to-r from-transparent via-border-strong to-transparent" />
    </div>
  );
}
