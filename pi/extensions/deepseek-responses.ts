// deepseek-responses.ts — DeepSeek Responses API provider + 服务端 web search 注入
// 独立扩展文件：不依赖任何环境变量；注册失败只影响自身，
// 不影响 aihubmix.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	installDeepSeekWebSearch,
	refreshDeepSeekResponsesModelsJson,
	registerDeepSeekResponses,
} from "../lib/third-party/deepseek-responses.ts";

export default async function deepSeekResponsesExtension(pi: ExtensionAPI): Promise<void> {
	// Registration first and synchronously: the provider must be usable even if
	// the models.json mirror below fails or is disabled.
	registerDeepSeekResponses(pi);
	installDeepSeekWebSearch(pi);
	await refreshDeepSeekResponsesModelsJson();
}
