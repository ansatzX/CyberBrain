import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";
import {
	installDeepSeekWebSearch,
	registerDeepSeekResponses,
} from "../lib/third-party/deepseek-responses.ts";

export default async function thirdPartyAllInOne(pi: ExtensionAPI): Promise<void> {
	await registerAIHubMix(pi);
	registerDeepSeekResponses(pi);
	installDeepSeekWebSearch(pi);
}
