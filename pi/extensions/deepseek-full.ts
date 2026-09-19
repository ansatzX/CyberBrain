// deepseek-full.ts — distinct from Pi's built-in deepseek provider.
// 独立扩展文件：不依赖任何环境变量；注册失败只影响自身，
// 不影响 aihubmix.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	installDeepSeekWebSearch,
	refreshDeepSeekModelsJson,
	registerDeepSeek,
} from "../lib/third-party/deepseek-full.ts";

export default async function deepSeekFullExtension(pi: ExtensionAPI): Promise<void> {
	const env = { ...process.env };
	// Registration first and synchronously: the provider must be usable even if
	// the models.json mirror below fails or is disabled.
	registerDeepSeek(pi, env);
	installDeepSeekWebSearch(pi, env);
	await refreshDeepSeekModelsJson(env);
}
