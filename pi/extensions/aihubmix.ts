// Keep Pi's native AIHubMix provider; override its endpoint and refresh the catalog.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";

export default function aihubmixExtension(pi: ExtensionAPI): void {
	registerAIHubMix(pi);
}
