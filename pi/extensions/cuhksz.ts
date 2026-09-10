// cuhksz.ts — CUHKSZ 本地部署 provider（实时模型发现）
// 独立扩展文件：即使 CUHKSZ_API_KEY 缺失导致本扩展加载失败，
// pi 按文件隔离扩展错误，不影响 aihubmix.ts、deepseek-responses.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCUHKSZ } from "../lib/third-party/cuhksz.ts";

export default async function cuhkszExtension(pi: ExtensionAPI): Promise<void> {
	await registerCUHKSZ(pi);
}
