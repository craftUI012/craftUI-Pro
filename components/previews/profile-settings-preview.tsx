import { ProfileSettings } from "@/registry/blocks/profile-settings/profile-settings";

// A settings page is taller than any docs box, and it grows as lists open,
// so it sits in a fixed-height stage that scrolls inside, like an app
// window: the docs box never changes height, and the save bar sticks to
// the stage's bottom edge as it would to the viewport in an app.
//
// The block fills its container (in an app it sits left-aligned beside the
// app's sidebar), but its content is only as wide as the nav plus the 40rem
// panel: 14rem + 3.5rem + 40rem = 57.5rem on desktop. Capped at that and
// centred here, so the showcase has even space on both sides.
const ProfileSettingsPreview = () => (
  <div className="bg-background h-[48rem] overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
    <div className="mx-auto w-full max-w-[57.5rem]">
      <ProfileSettings />
    </div>
  </div>
);

export default ProfileSettingsPreview;
