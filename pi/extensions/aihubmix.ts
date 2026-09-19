// aihubmix.ts — AIHubMix provider（实时模型发现 + models.json 镜像）
// 缺少非空 AIHUBMIX_API_KEY 时直接跳过；后端不可达时仅告警。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";

export default async function aihubmixExtension(pi: ExtensionAPI): Promise<void> {
	if (!process.env.AIHUBMIX_API_KEY?.trim()) return;
	try {
		await registerAIHubMix(pi);
	} catch (error) {
		// 缺 key / 探测失败只降级为「provider 不可用」，不抛错打断 pi 启动。
		const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
		console.warn(`AIHubMix provider disabled: ${reason}`);
	}
}
