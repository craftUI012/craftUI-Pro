import { StudioFiles } from "@/components/admin-panel/studio-files";
import { StudioForm } from "@/components/admin-panel/studio-form";
import { requireAdminPage } from "@/lib/admin/session";
import { showReels } from "@/lib/flags";
import { listStudioComponents } from "@/lib/studio/context";
import { readMediaFolders } from "@/lib/studio/local-media";

// The video Studio: pick a component and the kind of video, and the
// director plans it as a storyboard (JSON) to review here. Filming and
// rendering run separately (`pnpm video <storyboard>`), on a dev machine,
// where the local video files card also lives.
const AdminStudioPage = async () => {
  await requireAdminPage();
  const [components, folders] = await Promise.all([
    listStudioComponents(),
    showReels ? readMediaFolders() : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Pick a component and the kind of video. The director reads the
          component&apos;s source, props and docs and plans the video as a
          storyboard you can review before anything is filmed.
        </p>
      </div>
      <StudioForm components={components} canSave={showReels} />
      {folders && <StudioFiles folders={folders} />}
    </div>
  );
};

export default AdminStudioPage;
