// deepseek-responses.ts — DeepSeek Responses API provider + 服务端 web search 注入
// 独立扩展文件：不依赖任何环境变量；注册失败只影响自身，
// 不影响 aihubmix.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	installDeepSeekWebSearch,
	registerDeepSeekResponses,
} from "../lib/third-party/deepseek-responses.ts";

export default function deepSeekResponsesExtension(pi: ExtensionAPI): void {
	registerDeepSeekResponses(pi);
	installDeepSeekWebSearch(pi);
}
