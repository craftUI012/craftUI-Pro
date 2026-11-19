import { ProfileSettings02 } from "@/registry/blocks/profile-settings-02/profile-settings-02";

// The whole app (sidebar, top bar, settings page) at a fixed height, like a
// browser window: the page scrolls inside the app's main area, the sidebar
// stays put, and the docs box never changes height as groups fold or the
// country list opens.
const ProfileSettings02Preview = () => (
  <div className="bg-muted/40 p-4 sm:p-8">
    <ProfileSettings02 className="h-[52rem]" />
  </div>
);

export default ProfileSettings02Preview;
