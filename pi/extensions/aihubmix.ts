// aihubmix.ts — AIHubMix provider（实时模型发现）
// 独立扩展文件：即使 AIHUBMIX_API_KEY 缺失导致本扩展加载失败，
// pi 按文件隔离扩展错误，不影响 deepseek-responses.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";

export default async function aihubmixExtension(pi: ExtensionAPI): Promise<void> {
	await registerAIHubMix(pi);
}
