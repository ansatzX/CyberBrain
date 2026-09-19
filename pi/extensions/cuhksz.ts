// cuhksz.ts — CUHKSZ 本地部署 provider（实时模型发现 + 参数探测 + models.json 镜像）
// 独立扩展文件：CUHKSZ_API_KEY 缺失或后端不可达时本扩展直接失效（不注册 provider，
// 只留一行告警），不影响 aihubmix.ts、deepseek-full.ts 等其他扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCUHKSZ } from "../lib/third-party/cuhksz.ts";

export default async function cuhkszExtension(pi: ExtensionAPI): Promise<void> {
	try {
		await registerCUHKSZ(pi);
	} catch (error) {
		// 缺 key / 探测失败只降级为「provider 不可用」，不抛错打断 pi 启动。
		const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
		console.warn(`CUHKSZ provider disabled: ${reason}`);
	}
}
