import assert from "node:assert/strict";
import test from "node:test";
import utilityCommands from "../extensions/utility-commands.ts";

for (const command of ["ansatz:diff", "ansatz:status"]) {
	for (const failure of [{ code: 128, killed: false, stderr: "fatal: not a git repository" }, { code: 0, killed: true, stderr: "" }]) {
		test(`${command} reports Git failure ${JSON.stringify(failure)}`, async () => {
			const handlers = new Map<string, any>();
			const messages: string[] = [];
			utilityCommands({
				registerCommand(name: string, definition: any) { handlers.set(name, definition.handler); },
				async exec(_command: string, _args: string[], options: any) {
					assert.equal(options.cwd, "/test-workspace");
					return { stdout: "", ...failure };
				},
			} as any);
			await handlers.get(command)("", {
				cwd: "/test-workspace", hasUI: false,
				sessionManager: { getSessionFile: () => "/nonexistent/utility-test-session" },
				ui: { notify(message: string) { messages.push(message); } },
			});
			assert.match(messages.join("\n"), /git failed:/);
			assert.doesNotMatch(messages.join("\n"), /\(clean\)|dirty files: 0/);
		});
	}
}
