"use client";

import { VoiceStateStage } from "@/components/previews/voice-state-stage";
import { VoiceOrb } from "@/registry/blocks/voice-orb/voice-orb";

// Voice orb on its docs stage: state chips along the bottom, the built-in
// demo by default.
const VoiceOrbPreview = () => <VoiceStateStage Block={VoiceOrb} />;

export default VoiceOrbPreview;
