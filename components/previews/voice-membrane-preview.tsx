"use client";

import { VoiceStateStage } from "@/components/previews/voice-state-stage";
import { VoiceMembrane } from "@/registry/blocks/voice-membrane/voice-membrane";

// Voice membrane on its docs stage: state chips along the bottom, the
// built-in demo by default.
const VoiceMembranePreview = () => <VoiceStateStage Block={VoiceMembrane} />;

export default VoiceMembranePreview;
