"use client";

import type {
  Aggregation,
  CardConfig,
  DashboardCard,
  DataSource,
  MetaResponse,
} from "@bms/contract";
import { useState } from "react";
import { CARD_TYPE_ICON, IconClose, IconInfoCircle, IconSpinner } from "@/components/icons";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeta } from "@/hooks/use-meta";
import {
  CARD_TYPE_LABEL,
  columnLabel,
  defaultCardTitle,
  SOURCE_LABEL,
  summarizeConfig,
} from "@/lib/card-defaults";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard-store";

const AGGREGATIONS: Aggregation[] = ["sum", "avg", "min", "max", "count"];
const NONE = "__none__";

const FIELD_SELECT_CLASS =
  "h-auto w-full rounded-[9px] border-border bg-surface-3 px-3 py-2.5 font-semibold text-[13px] shadow-none dark:bg-surface-3 dark:hover:bg-surface-3";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[9px] border-border bg-surface-3 px-3 py-2.5 font-semibold text-[13px] shadow-none dark:bg-surface-3";

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

function emptyForm(cardType: DashboardCard["cardType"], title: string): FormState {
  return {
    source: "",
    metric: "",
    x: "",
    y: "",
    // The mock's defaults: bars usually sum a measure, everything else averages.
    aggregation: cardType === "bar" ? "sum" : "avg",
    groupBy: "",
    min: "0",
    max: "100",
    target: "70",
    filterColumn: "",
    filterValue: "",
    title,
  };
}

function formFromConfig(
  cardType: DashboardCard["cardType"],
  config: CardConfig,
  title: string,
): FormState {
  const base = emptyForm(cardType, title);
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

/** The mock's auto-generated titles, used when the title field is left blank. */
function autoTitle(config: CardConfig): string {
  switch (config.cardType) {
    case "kpi":
      return config.aggregation === "count"
        ? "Total Records"
        : `${config.aggregation.charAt(0).toUpperCase()}${config.aggregation.slice(1)} ${columnLabel(config.source, config.metric)}`;
    case "gauge":
      return columnLabel(config.source, config.metric) || "Gauge";
    case "bar":
      return `${columnLabel(config.source, config.y)} by ${columnLabel(config.source, config.x)}`;
    case "line":
      return `${columnLabel(config.source, config.y)} trend`;
  }
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
      <DialogContent
        showCloseButton={false}
        className="max-h-[88vh] w-[min(560px,calc(100%-2rem))] gap-0 overflow-auto rounded-[18px] border-border-strong bg-card p-0 shadow-[0_24px_70px_-20px_rgba(0,0,0,.7)] sm:max-w-[560px]"
      >
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
  const TypeIcon = CARD_TYPE_ICON[card.cardType];
  const [form, setForm] = useState<FormState>(() =>
    card.config
      ? formFromConfig(card.cardType, card.config, card.title)
      : // A still-default title ("New KPI Card") starts blank so a saved
        // card gets the mock's auto-generated name instead.
        emptyForm(card.cardType, card.title === defaultCardTitle(card.cardType) ? "" : card.title),
  );

  const columns = form.source && meta ? meta.tableMeta[form.source] : [];
  const numericColumns = columns.filter((c) => c.isNumeric);
  const timestampColumns = columns.filter((c) => c.isTimestamp);
  const metricOptions = form.aggregation === "count" ? columns : numericColumns;
  const isCount = form.aggregation === "count";
  const metricHint = isCount ? " (ignored for Count)" : "";

  const gaugeRangeInvalid =
    card.cardType === "gauge" && Number(form.min) >= Number(form.max);

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
        if (!form.metric || gaugeRangeInvalid) return null;
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

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-5 py-[18px]">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-primary">
          <TypeIcon size={16} />
        </span>
        <div className="flex-1">
          <DialogTitle className="font-extrabold text-[15px] leading-tight">
            Configure {CARD_TYPE_LABEL[card.cardType]}
          </DialogTitle>
          <div className="text-[11.5px] text-fg-subtle">
            Map database columns to this card&apos;s axes
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex size-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <IconClose size={17} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {metaPending ? (
          <div className="flex items-center gap-[9px] py-2.5 text-[12.5px] text-fg-subtle">
            <IconSpinner size={15} />
            Fetching columns from /api/meta…
          </div>
        ) : (
          <>
            <Field label="Data source">
              <Select value={form.source} onValueChange={(v) => setSource(v as DataSource)}>
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue placeholder="Select a table…" />
                </SelectTrigger>
                <SelectContent>
                  {meta &&
                    (Object.keys(meta.tableMeta) as DataSource[]).map((source) => (
                      <SelectItem key={source} value={source}>
                        {SOURCE_LABEL[source]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            {form.source && (
              <>
                {(card.cardType === "kpi" || card.cardType === "gauge") && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Metric field${metricHint}`}>
                      <Select
                        value={form.metric}
                        onValueChange={(v) => setForm((f) => ({ ...f, metric: v }))}
                      >
                        <SelectTrigger className={FIELD_SELECT_CLASS}>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {metricOptions.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <AggregationField
                      value={form.aggregation}
                      onChange={(v) => setForm((f) => ({ ...f, aggregation: v }))}
                    />
                  </div>
                )}

                {card.cardType === "bar" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="X-axis · category">
                        <Select
                          value={form.x}
                          onValueChange={(v) => setForm((f) => ({ ...f, x: v }))}
                        >
                          <SelectTrigger className={FIELD_SELECT_CLASS}>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={`Y-axis · value${metricHint}`}>
                        <Select
                          value={form.y}
                          onValueChange={(v) => setForm((f) => ({ ...f, y: v }))}
                        >
                          <SelectTrigger className={FIELD_SELECT_CLASS}>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {metricOptions.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <AggregationField
                      value={form.aggregation}
                      onChange={(v) => setForm((f) => ({ ...f, aggregation: v }))}
                    />
                  </>
                )}

                {card.cardType === "line" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="X-axis · time">
                        <Select
                          value={form.x}
                          onValueChange={(v) => setForm((f) => ({ ...f, x: v }))}
                        >
                          <SelectTrigger className={FIELD_SELECT_CLASS}>
                            <SelectValue placeholder="Timestamp · hourly" />
                          </SelectTrigger>
                          <SelectContent>
                            {timestampColumns.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.label} · hourly
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={`Y-axis · value${metricHint}`}>
                        <Select
                          value={form.y}
                          onValueChange={(v) => setForm((f) => ({ ...f, y: v }))}
                        >
                          <SelectTrigger className={FIELD_SELECT_CLASS}>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {metricOptions.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <AggregationField
                        value={form.aggregation}
                        onChange={(v) => setForm((f) => ({ ...f, aggregation: v }))}
                      />
                      <Field
                        label={
                          <>
                            Group by · series{" "}
                            <span className="font-medium text-fg-subtle">(optional)</span>
                          </>
                        }
                      >
                        <Select
                          value={form.groupBy || NONE}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, groupBy: v === NONE ? "" : v }))
                          }
                        >
                          <SelectTrigger className={FIELD_SELECT_CLASS}>
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
                    </div>
                  </>
                )}

                {card.cardType === "gauge" && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Min">
                      <Input
                        type="number"
                        className={FIELD_INPUT_CLASS}
                        value={form.min}
                        onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))}
                      />
                    </Field>
                    <Field label="Max">
                      <Input
                        type="number"
                        className={FIELD_INPUT_CLASS}
                        value={form.max}
                        onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))}
                      />
                    </Field>
                    <Field label="Target">
                      <Input
                        type="number"
                        className={FIELD_INPUT_CLASS}
                        value={form.target}
                        onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                      />
                    </Field>
                  </div>
                )}

                <div className="border-t border-dashed pt-[15px]">
                  <Field
                    label={
                      <>
                        Filter <span className="font-medium text-fg-subtle">(optional)</span>
                      </>
                    }
                  >
                    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-[9px]">
                      <Select
                        value={form.filterColumn || NONE}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            filterColumn: v === NONE ? "" : v,
                            filterValue: v === NONE ? "" : f.filterValue,
                          }))
                        }
                      >
                        <SelectTrigger className={cn(FIELD_SELECT_CLASS, "py-[9px] text-[12.5px]")}>
                          <SelectValue placeholder="No filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No filter</SelectItem>
                          {columns
                            .filter((c) => !c.isTimestamp)
                            .map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className={cn(FIELD_INPUT_CLASS, "py-[9px] text-[12.5px]")}
                        value={form.filterValue}
                        disabled={!form.filterColumn}
                        onChange={(e) => setForm((f) => ({ ...f, filterValue: e.target.value }))}
                        placeholder={form.filterColumn ? "e.g. BLD-001" : "Any value"}
                      />
                      <span className="whitespace-nowrap text-[11px] text-fg-subtle">per-card</span>
                    </div>
                  </Field>
                </div>

                <Field label="Card title">
                  <Input
                    className={FIELD_INPUT_CLASS}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={config ? autoTitle(config) : "Auto-generated"}
                  />
                </Field>

                {gaugeRangeInvalid && (
                  <div className="flex items-center gap-2 font-semibold text-[12.5px] text-warn">
                    <IconInfoCircle size={15} />
                    Gauge Min must be less than Max
                  </div>
                )}

                <div className="flex items-center gap-[9px] rounded-[10px] border bg-secondary px-[13px] py-[11px] text-[12px] text-muted-foreground">
                  <span className="shrink-0 text-primary">
                    <IconInfoCircle size={15} />
                  </span>
                  <span>
                    {config
                      ? `Preview · ${summarizeConfig(config)}`
                      : "Complete the fields above to preview"}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-2.5 border-t bg-card px-5 py-[15px]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[9px] border bg-secondary px-[17px] py-2.5 font-semibold text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={config === null}
          onClick={() => {
            if (config) onSave(form.title.trim() || autoTitle(config), config);
          }}
          className="rounded-[9px] bg-primary px-[18px] py-2.5 font-bold text-[13px] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Apply configuration
        </button>
      </div>
    </>
  );
}

function AggregationField({
  value,
  onChange,
}: {
  value: Aggregation;
  onChange: (value: Aggregation) => void;
}) {
  return (
    <Field label="Aggregation">
      <Select value={value} onValueChange={(v) => onChange(v as Aggregation)}>
        <SelectTrigger className={cn(FIELD_SELECT_CLASS, "capitalize")}>
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
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-[7px]">
      <span className="font-bold text-[12px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
