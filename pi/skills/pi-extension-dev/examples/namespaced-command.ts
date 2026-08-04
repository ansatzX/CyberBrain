import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function namespacedCommand(pi: ExtensionAPI) {
	pi.registerCommand("ansatz:hello", {
		description: "Demonstrate a namespaced extension command",
		handler: async (args, ctx) => {
			const name = args.trim() || "world";
			ctx.ui.notify(`Hello ${name}!`, "info");
		},
	});
}
