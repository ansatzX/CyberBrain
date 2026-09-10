import { homedir } from "node:os";
import { join } from "node:path";

/** Match Pi's getAgentDir, including its supported ~/ override. */
export function agentDir(environment: Record<string, string | undefined> = process.env): string {
	const configured = environment.PI_CODING_AGENT_DIR?.trim();
	if (!configured) return join(homedir(), ".pi", "agent");
	if (configured === "~") return homedir();
	return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}
