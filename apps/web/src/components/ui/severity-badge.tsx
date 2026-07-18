import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Severity keeps its fixed meaning per the PDF: Critical=red, Warning=orange,
 * Info=blue — via the theme's crit/warn/info tokens (soft pill + strong
 * text, the mock's badge idiom). The tokens are calibrated to the palette
 * in globals.css so both themes stay legible and weight-matched.
 */
const SEVERITY_STYLES: Record<string, string> = {
  Critical: "border-transparent bg-crit-soft text-crit",
  Warning: "border-transparent bg-warn-soft text-warn",
  Info: "border-transparent bg-info-soft text-info",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <Badge className={cn("font-bold", style ?? "border-transparent bg-muted text-muted-foreground")}>
      {severity}
    </Badge>
  );
}

/** Bar-cell colors for severity dimensions — theme tokens, not hexes,
 *  so they track the dark/light toggle. */
export function severityColor(severity: string): string {
  switch (severity) {
    case "Critical":
      return "var(--crit)";
    case "Warning":
      return "var(--warn)";
    case "Info":
      return "var(--info)";
    default:
      return "var(--fg-subtle)";
  }
}
