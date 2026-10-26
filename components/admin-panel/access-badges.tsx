import { Badge } from "@/components/ui/badge";
import type { Entitlements } from "@/lib/billing/entitlements";

// What a user can use right now, as badges: Lifetime, Yearly, N items, or
// No access.
export const AccessBadges = ({ access }: { access: Entitlements }) => {
  if (!access.hasAllAccess && access.itemIds.length === 0) {
    return <Badge variant="outline">No access</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {access.hasLifetime && <Badge>Lifetime</Badge>}
      {access.hasYearly && <Badge>Yearly</Badge>}
      {access.itemIds.length > 0 && (
        <Badge variant="secondary">
          {access.itemIds.length}{" "}
          {access.itemIds.length === 1 ? "item" : "items"}
        </Badge>
      )}
    </span>
  );
};

// How each status looks: only "active" grants access.
const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
  active: "default",
  refunded: "destructive",
};

// A purchase's status: only "active" grants access.
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
    {status.replaceAll("_", " ")}
  </Badge>
);
