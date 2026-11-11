import { ReelStudio } from "@/components/admin-panel/studio/reel-studio";
import { studioComponents } from "@/components/admin-panel/studio/studio-components";
import { requireAdminPage } from "@/lib/admin/session";

// Studio: put a screen recording on a 9:16 frame (Reels, TikTok, Shorts) or
// a 16:9 one (YouTube, X, LinkedIn), add sound and export an MP4. Runs in
// the browser with Remotion; the video is never uploaded. A phone mockup can
// show the clip or a live craftUI component. The Studio draws its own title
// bar.
const StudioPage = async () => {
  await requireAdminPage();
  return <ReelStudio components={studioComponents()} />;
};

export default StudioPage;
