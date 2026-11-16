import { Inter_Tight, Crimson_Pro } from "next/font/google";

import { ReelStudio } from "@/components/admin-panel/studio/reel-studio";
import { studioComponents } from "@/components/admin-panel/studio/studio-components";
import { requireAdminPage } from "@/lib/admin/session";

// Studio: put a screen recording on a 9:16 frame (Reels, TikTok, Shorts) or
// a 16:9 one (YouTube, X, LinkedIn), add sound and export an MP4. Runs in
// the browser with Remotion; the video is never uploaded. A phone mockup can
// show the clip or a live craftUI component. The Studio draws its own title
// bar.

// The Grid board's fonts, loaded on this page only. Their resolved families
// are passed down, not CSS variables: the export renders outside this
// page's elements, where a variable set here wouldn't reach. One weight
// each, without the optical-size axis, so the export (drawn on a canvas)
// gets the same letters as the preview (its renderer ignores font
// variations, so a font with optical sizes would export differently).
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400", "500"] });
const serif = Crimson_Pro({ subsets: ["latin"], weight: "400" });

const StudioPage = async () => {
  await requireAdminPage();
  return (
    <ReelStudio
      components={studioComponents()}
      fonts={{ sans: sans.style.fontFamily, serif: serif.style.fontFamily }}
    />
  );
};

export default StudioPage;
