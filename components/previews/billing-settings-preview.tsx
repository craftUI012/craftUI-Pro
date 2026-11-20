import { BillingSettings } from "@/registry/blocks/billing-settings/billing-settings";

// The whole app (sidebar, top bar, billing page) at a fixed height, like a
// browser window: the page scrolls inside the app's main area and the docs
// box never changes height as the billing details form opens.
const BillingSettingsPreview = () => (
  <div className="bg-muted/40 p-4 sm:p-8">
    <BillingSettings className="h-[52rem]" />
  </div>
);

export default BillingSettingsPreview;
