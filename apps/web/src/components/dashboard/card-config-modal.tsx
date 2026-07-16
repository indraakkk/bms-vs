"use client";

import type { Aggregation, CardConfig, DashboardCard, DataSource, MetaResponse } from "@bms/contract";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeta } from "@/hooks/use-meta";
import { CARD_TYPE_LABEL } from "@/lib/card-defaults";
import { useDashboardStore } from "@/stores/dashboard-store";

const AGGREGATIONS: Aggregation[] = ["sum", "avg", "min", "max", "count"];
const NONE = "__none__";

interface FormState {
  source: DataSource | "";
  metric: string;
  x: string;
  y: string;
  aggregation: Aggregation;
  groupBy: string;
  min: string;
  max: string;
  target: string;
  filterColumn: string;
  filterValue: string;
  title: string;
}

function emptyForm(title: string): FormState {
  return {
    source: "",
    metric: "",
    x: "",
    y: "",
    aggregation: "sum",
    groupBy: "",
    min: "0",
    max: "100",
    target: "50",
    filterColumn: "",
    filterValue: "",
    title,
  };
}

function formFromConfig(config: CardConfig, title: string): FormState {
  const base = emptyForm(title);
  base.source = config.source;
  base.aggregation = config.aggregation;
  base.filterColumn = config.filter?.column ?? "";
  base.filterValue = config.filter?.value ?? "";
  if (config.cardType === "kpi" || config.cardType === "gauge") {
    base.metric = config.metric;
  }
  if (config.cardType === "gauge") {
    base.min = String(config.min);
    base.max = String(config.max);
    base.target = String(config.target);
  }
  if (config.cardType === "bar" || config.cardType === "line") {
    base.x = config.x;
    base.y = config.y;
  }
  if (config.cardType === "line") {
    base.groupBy = config.groupBy ?? "";
  }
  return base;
}

export function CardConfigModal({
  cardId,
  onClose,
}: {
  cardId: string | null;
  onClose: () => void;
}) {
  const { data: meta, isPending: metaPending } = useMeta();
  const card = useDashboardStore((s) => s.cards.find((c) => c.id === cardId));
  const updateCard = useDashboardStore((s) => s.updateCard);

  return (
    <Dialog open={cardId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {card && (
          <CardConfigForm
            key={card.id}
            card={card}
            meta={meta}
            metaPending={metaPending}
            onSave={(title, config) => {
              updateCard(card.id, title, config);
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Keyed by card.id from the parent — remounts (and re-derives initial
 *  form state) whenever a different card is opened, instead of an effect
 *  syncing state on prop change. */
function CardConfigForm({
  card,
  meta,
  metaPending,
  onSave,
  onCancel,
}: {
  card: DashboardCard;
  meta: MetaResponse | undefined;
  metaPending: boolean;
  onSave: (title: string, config: CardConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    card.config ? formFromConfig(card.config, card.title) : emptyForm(card.title),
  );

  const columns = form.source && meta ? meta.tableMeta[form.source] : [];
  const numericColumns = columns.filter((c) => c.isNumeric);
  const timestampColumns = columns.filter((c) => c.isTimestamp);
  const yOptions = form.aggregation === "count" ? columns : numericColumns;

  function setSource(source: DataSource) {
    setForm((f) => ({
      ...f,
      source,
      metric: "",
      x: "",
      y: "",
      groupBy: "",
      filterColumn: "",
      filterValue: "",
    }));
  }

  function buildConfig(): CardConfig | null {
    if (!form.source) return null;
    const filter =
      form.filterColumn && form.filterValue
        ? { column: form.filterColumn, value: form.filterValue }
        : undefined;
    switch (card.cardType) {
      case "kpi":
        if (!form.metric) return null;
        return {
          cardType: "kpi",
          source: form.source,
          metric: form.metric,
          aggregation: form.aggregation,
          filter,
        };
      case "gauge":
        if (!form.metric) return null;
        return {
          cardType: "gauge",
          source: form.source,
          metric: form.metric,
          aggregation: form.aggregation,
          min: Number(form.min),
          max: Number(form.max),
          target: Number(form.target),
          filter,
        };
      case "bar":
        if (!form.x || !form.y) return null;
        return {
          cardType: "bar",
          source: form.source,
          x: form.x,
          y: form.y,
          aggregation: form.aggregation,
          filter,
        };
      case "line":
        if (!form.x || !form.y) return null;
        return {
          cardType: "line",
          source: form.source,
          x: form.x,
          y: form.y,
          aggregation: form.aggregation,
          groupBy: form.groupBy || undefined,
          filter,
        };
    }
  }

  const config = buildConfig();
  const canSave = config !== null && form.title.trim().length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configure {CARD_TYPE_LABEL[card.cardType]} card</DialogTitle>
      </DialogHeader>

      {metaPending ? (
          <p className="text-muted-foreground text-sm">Loading columns…</p>
        ) : (
          <div className="grid gap-4">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>

            <Field label="Data source">
              <Select value={form.source} onValueChange={(v) => setSource(v as DataSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {meta &&
                    (Object.keys(meta.tableMeta) as DataSource[]).map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            {(card.cardType === "kpi" || card.cardType === "gauge") && (
              <Field label="Metric">
                <Select
                  value={form.metric}
                  onValueChange={(v) => setForm((f) => ({ ...f, metric: v }))}
                  disabled={!form.source}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a column" />
                  </SelectTrigger>
                  <SelectContent>
                    {yOptions.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {(card.cardType === "bar" || card.cardType === "line") && (
              <>
                <Field label={card.cardType === "line" ? "X axis (timestamp)" : "X axis"}>
                  <Select
                    value={form.x}
                    onValueChange={(v) => setForm((f) => ({ ...f, x: v }))}
                    disabled={!form.source}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {(card.cardType === "line" ? timestampColumns : columns).map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Y axis">
                  <Select
                    value={form.y}
                    onValueChange={(v) => setForm((f) => ({ ...f, y: v }))}
                    disabled={!form.source}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {yOptions.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {card.cardType === "line" && (
              <Field label="Group by (optional)">
                <Select
                  value={form.groupBy || NONE}
                  onValueChange={(v) => setForm((f) => ({ ...f, groupBy: v === NONE ? "" : v }))}
                  disabled={!form.source}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {columns
                      .filter((c) => !c.isTimestamp)
                      .map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Aggregation">
              <Select
                value={form.aggregation}
                onValueChange={(v) => setForm((f) => ({ ...f, aggregation: v as Aggregation }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATIONS.map((agg) => (
                    <SelectItem key={agg} value={agg} className="capitalize">
                      {agg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {card.cardType === "gauge" && (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Min">
                  <Input
                    type="number"
                    value={form.min}
                    onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))}
                  />
                </Field>
                <Field label="Max">
                  <Input
                    type="number"
                    value={form.max}
                    onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))}
                  />
                </Field>
                <Field label="Target">
                  <Input
                    type="number"
                    value={form.target}
                    onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Filter column (optional)">
                <Select
                  value={form.filterColumn || NONE}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      filterColumn: v === NONE ? "" : v,
                      filterValue: v === NONE ? "" : f.filterValue,
                    }))
                  }
                  disabled={!form.source}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {columns
                      .filter((c) => !c.isTimestamp)
                      .map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Filter value">
                <Input
                  value={form.filterValue}
                  disabled={!form.filterColumn}
                  onChange={(e) => setForm((f) => ({ ...f, filterValue: e.target.value }))}
                  placeholder={form.filterColumn ? "e.g. BLD-001" : "—"}
                />
              </Field>
            </div>
          </div>
        )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!canSave}
          onClick={() => {
            if (config) onSave(form.title.trim(), config);
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
