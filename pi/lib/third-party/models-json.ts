// models-json.ts — 安全地把 provider 配置刷新进 pi 的 models.json。
//
// 动机：pi 的 registerProvider 只在当前进程生效；Raft daemon 等只读
// models.json 的消费方看不到扩展注册的 provider。每次 pi 启动（扩展加载）
// 时把发现的模型写回 models.json，声明式与编程式两条路径就都有了。
//
// 安全保证：
// 1. 现有文件不是合法 JSON → 拒绝修改（不碰用户文件）。
// 2. 内容无变化 → 不写（避免每次启动都动文件）。
// 3. 写入走 临时文件 + rename 原子替换，写入前对序列化结果做 JSON.parse
//    往返校验，写入后重读校验；任何一步失败都会尽量恢复 .bak。
// 4. 每次真实更新前把旧文件复制为 models.json.bak 作为回滚点。

import { copyFile, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, join } from "node:path";
import { agentDir } from "../agent-paths.ts";

export type ProviderConfig = Record<string, unknown>;

export type RefreshResult =
	| { status: "created" | "updated"; path: string; modelCount: number }
	| { status: "unchanged"; path: string }
	| { status: "skipped"; reason: string };

export type ModelsJsonDependencies = {
	readFileImpl?: typeof readFile;
	writeFileImpl?: typeof writeFile;
	renameImpl?: typeof rename;
	mkdirImpl?: typeof mkdir;
	copyFileImpl?: typeof copyFile;
	rmImpl?: typeof rm;
};

function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

/** 与 pi 的 getAgentDir() 解析保持一致：PI_CODING_AGENT_DIR → ~/.pi/agent。 */
export function defaultModelsJsonPath(
	environment: Record<string, string | undefined>,
): string {
	return join(agentDir(environment), "models.json");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 键排序的稳定序列化，用于"内容是否变化"的比较，与键序无关。 */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	if (isPlainObject(value)) {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value) ?? "undefined";
}

function parseModelsJson(text: string, path: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(
			`${path} 不是合法 JSON（${asError(error).message}），为避免改坏文件，本次刷新被拒绝`,
		);
	}
	if (!isPlainObject(parsed)) {
		throw new Error(`${path} 顶层不是 JSON 对象，为避免改坏文件，本次刷新被拒绝`);
	}
	if ("providers" in parsed && !isPlainObject(parsed.providers)) {
		throw new Error(
			`${path} 的 providers 字段不是对象，为避免改坏文件，本次刷新被拒绝`,
		);
	}
	return parsed;
}

function assertValidProviderConfig(
	providerId: string,
	config: ProviderConfig,
): number {
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) {
		throw new Error(`非法 provider id: ${JSON.stringify(providerId)}`);
	}
	if (typeof config.baseUrl !== "string" || !config.baseUrl.trim()) {
		throw new Error(`provider ${providerId}: baseUrl 缺失或为空，拒绝写入`);
	}
	if (typeof config.api !== "string" || !config.api.trim()) {
		throw new Error(`provider ${providerId}: api 缺失或为空，拒绝写入`);
	}
	const models = config.models;
	if (!Array.isArray(models) || models.length === 0) {
		throw new Error(`provider ${providerId}: models 为空，拒绝写入`);
	}
	for (const model of models) {
		if (!isPlainObject(model) || typeof model.id !== "string" || !model.id.trim()) {
			throw new Error(`provider ${providerId}: 存在没有 id 的模型条目，拒绝写入`);
		}
	}
	return models.length;
}

export type RefreshOptions = {
	path: string;
	providerId: string;
	config: ProviderConfig;
};

export async function refreshModelsJsonProvider(
	options: RefreshOptions,
	dependencies: ModelsJsonDependencies = {},
): Promise<RefreshResult> {
	assertValidProviderConfig(options.providerId, options.config);
	await mkdir(dirname(options.path), { recursive: true });
	const path = join(await realpath(dirname(options.path)), basename(options.path));
	const lockPath = `${path}.lock`;
	const deadline = Date.now() + 5_000;
	for (;;) {
		try {
			await mkdir(lockPath);
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			if (Date.now() >= deadline) {
				throw new Error(`Timed out waiting for ${lockPath}; if a writer crashed, remove the lock after stopping all writers.`);
			}
			await delay(25);
		}
	}
	try {
		return await refreshLocked({ ...options, path }, dependencies);
	} finally {
		await rm(lockPath, { recursive: true, force: true });
	}
}

async function refreshLocked(
	options: RefreshOptions,
	dependencies: ModelsJsonDependencies,
): Promise<RefreshResult> {
	const readFileImpl = dependencies.readFileImpl ?? readFile;
	const writeFileImpl = dependencies.writeFileImpl ?? writeFile;
	const renameImpl = dependencies.renameImpl ?? rename;
	const mkdirImpl = dependencies.mkdirImpl ?? mkdir;
	const copyFileImpl = dependencies.copyFileImpl ?? copyFile;
	const rmImpl = dependencies.rmImpl ?? rm;

	const { path, providerId, config } = options;
	const modelCount = assertValidProviderConfig(providerId, config);

	let existed = true;
	let document: Record<string, unknown>;
	try {
		document = parseModelsJson(await readFileImpl(path, "utf8"), path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			existed = false;
			document = {};
		} else {
			throw error;
		}
	}

	const providers = (document.providers ??= {});
	if (!isPlainObject(providers)) {
		// parseModelsJson 已经挡掉了非对象 providers；这里是类型防御。
		throw new Error(`${path} 的 providers 字段不是对象，拒绝刷新`);
	}

	if (
		providerId in providers &&
		stableStringify(providers[providerId]) === stableStringify(config)
	) {
		return { status: "unchanged", path };
	}

	providers[providerId] = config;
	const serialized = `${JSON.stringify(document, null, 2)}\n`;

	// 写入前往返校验：确保序列化结果仍然是合法 JSON 且目标 section 完整。
	const roundTripped = parseModelsJson(serialized, `${path} (序列化结果)`);
	const roundTrippedModels = (
		(roundTripped.providers as Record<string, unknown>)[providerId] as ProviderConfig
	).models;
	if (!Array.isArray(roundTrippedModels) || roundTrippedModels.length !== modelCount) {
		throw new Error(`${path} 序列化往返校验失败，拒绝写入`);
	}

	await mkdirImpl(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	const backupPath = `${path}.bak`;

	try {
		await writeFileImpl(temporaryPath, serialized, {
			encoding: "utf8",
			mode: 0o600,
		});
		if (existed) {
			// Do not replace the file unless this transaction has a valid rollback copy.
			await copyFileImpl(path, backupPath);
		}
		await renameImpl(temporaryPath, path);
	} catch (error) {
		await rmImpl(temporaryPath, { force: true }).catch(() => undefined);
		throw error;
	}

	// 写入后重读校验；失败时尽力从 .bak 恢复。
	try {
		const verified = parseModelsJson(await readFileImpl(path, "utf8"), path);
		const verifiedModels = (
			(verified.providers as Record<string, unknown>)[providerId] as ProviderConfig
		).models;
		if (!Array.isArray(verifiedModels) || verifiedModels.length !== modelCount) {
			throw new Error("写入后校验发现目标 section 不完整");
		}
	} catch (error) {
		if (existed) {
			await copyFileImpl(backupPath, path).catch(() => undefined);
		} else {
			await rmImpl(path, { force: true }).catch(() => undefined);
		}
		throw new Error(
			`${path} 写入后校验失败（${asError(error).message}），已尽量恢复原文件`,
		);
	}

	return {
		status: existed ? "updated" : "created",
		path,
		modelCount,
	};
}
