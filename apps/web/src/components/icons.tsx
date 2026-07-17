import type { CardType } from "@bms/contract";

/**
 * Icon set traced 1:1 from the design mock's inline SVGs
 * (VS BMS Dashboard.dc.html) — 24×24 viewBox, 1.8 stroke, currentColor —
 * rather than approximated with lucide, so the rendered glyphs match the
 * approved design pixel-for-pixel.
 */
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 15, ...props }: IconProps) {
  return {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    ...props,
  } as const;
}

export function IconKpi(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4h12l-7 8 7 8H6" />
    </svg>
  );
}

export function IconBar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="11" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="14" rx="1" />
      <rect x="16" y="14" width="4" height="6" rx="1" />
    </svg>
  );
}

export function IconLine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 15l5-6 4 3 6-8" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 18a8 8 0 1 1 14 0" />
      <path d="M12 18l4-5" />
    </svg>
  );
}

export const CARD_TYPE_ICON: Record<CardType, (props: IconProps) => React.ReactElement> = {
  kpi: IconKpi,
  bar: IconBar,
  line: IconLine,
  gauge: IconGauge,
};

export function IconDashboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconFloorPlan(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16M15 5v16" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 14a8 8 0 1 1-9-11 6 6 0 0 0 9 11Z" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconExport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

export function IconImport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />
    </svg>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8V3h10v5" />
      <path d="M7 17H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconFunnel(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 5h18l-7 8v5l-4 2v-7Z" />
    </svg>
  );
}

export function IconGrip(props: IconProps) {
  return (
    <svg {...base({ ...props })} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconDuplicate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2, ...props })}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconSpinner(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 2, ...props })} className="animate-spin">
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

export function IconAlertCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function IconInfoCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function IconChartEmpty(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 1.6, ...props })}>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 2 4-5" />
    </svg>
  );
}

export function IconClockChip(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function IconCanvasEmpty(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 1.5, ...props })}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M17.5 14v7M14 17.5h7" />
    </svg>
  );
}
