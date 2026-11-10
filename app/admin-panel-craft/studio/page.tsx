import { ReelStudio } from "@/components/admin-panel/studio/reel-studio";
import { requireAdminPage } from "@/lib/admin/session";

// Studio: put a screen recording on a 9:16 frame, add sound and export an
// MP4 for Reels, TikTok and Shorts. Runs in the browser with Remotion; the
// video is never uploaded. The Studio draws its own title bar.
const StudioPage = async () => {
  await requireAdminPage();
  return <ReelStudio />;
};

export default StudioPage;
