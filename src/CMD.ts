import { Datex } from "unyt_core/mod.ts";

const logger = new Datex.Logger("CMD");

export async function executeDocker(args: string[], output = true) {
	let status = false;
	try {
		status = (await new Deno.Command(
			"docker",
			{
				stderr: "inherit",
				stdout: output ? "inherit" : "null",
				args
			}
		).spawn().status).success;
	} catch (e) {
		logger.error(`Could not execute "docker ${args.join(" ")}"`);
		throw e;
	}
	if (!status) {
		logger.error(`"docker ${args.join(" ")}" failed`);
		throw new Error("Could not execute");
	}
}
export async function executeShell(args: string[], output = true) {
	let status = false;
	try {
		status = (await new Deno.Command("sh", {
			args: ["-c", args.join(" ")],
			stderr: output ? "inherit" : "null",
			stdout: output ? "inherit" : "null"
		}).spawn().status).success;
	} catch (e) {
		logger.error(`Could not execute "${args.join(" ")}"`);
		throw e;
	}
	if (!status) {
		logger.error(`"${args.join(" ")}" failed`);
		throw new Error("Could not execute");
	}
}