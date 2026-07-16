import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Critical=red, Warning=orange, Info=blue — fixed regardless of theme or chart palette. */
const SEVERITY_STYLES: Record<string, string> = {
  Critical: "border-transparent bg-red-600 text-white dark:bg-red-500",
  Warning: "border-transparent bg-orange-500 text-white dark:bg-orange-500",
  Info: "border-transparent bg-blue-600 text-white dark:bg-blue-500",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <Badge className={cn(style ?? "border-transparent bg-muted text-muted-foreground")}>
      {severity}
    </Badge>
  );
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "Critical":
      return "#dc2626";
    case "Warning":
      return "#f97316";
    case "Info":
      return "#2563eb";
    default:
      return "#898781";
  }
}
