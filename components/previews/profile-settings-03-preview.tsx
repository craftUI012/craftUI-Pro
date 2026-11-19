import { ProfileSettings03 } from "@/registry/blocks/profile-settings-03/profile-settings-03";

// The whole settings screen at a fixed height, like a browser window: the
// page scrolls inside its own area beside the rail, and the docs box never
// changes height as rows open or popovers appear.
const ProfileSettings03Preview = () => (
  <div className="bg-muted/40 p-4 sm:p-8">
    <ProfileSettings03 className="h-[52rem]" />
  </div>
);

export default ProfileSettings03Preview;
