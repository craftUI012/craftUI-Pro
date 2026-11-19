import { SecuritySettings } from "@/registry/blocks/security-settings/security-settings";

// A settings page is taller than any docs box, and it grows as rows open,
// so it sits in a fixed-height stage that scrolls inside, like an app
// window: the docs box never changes height. From xl the checkup moves to
// a sticky right column (nav 14rem + 40rem + 18rem and gaps = 78rem).
const SecuritySettingsPreview = () => (
  <div className="bg-background h-[48rem] overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
    <div className="mx-auto w-full max-w-[78rem]">
      <SecuritySettings />
    </div>
  </div>
);

export default SecuritySettingsPreview;
