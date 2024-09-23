import { Datex } from "unyt_core/mod.ts";

const logger = new Datex.Logger("CMD");

async function executeCommand(command: string, args: string[], output = true) {
	let status = false;
	try {
		status = (await new Deno.Command(
			command,
			{
				cwd: Deno.cwd(),
				stderr: "inherit",
				stdout: output ? "inherit" : "null",
				args
			}
		).spawn().status).success;
	} catch (e) {
		if (output) logger.error(`Could not execute "${command} ${args.join(" ")}"`);
		throw e;
	}
	if (!status) {
		if (output) logger.error(`"${command} ${args.join(" ")}" failed`);
		throw new Error(`Could not execute ${command}`);
	}
}

export async function executeDocker(args: string[], output = true) {
	return await executeCommand("docker", args, output);
}
export async function executeGit(args: string[], output = true) {
	return await executeCommand("git", args, output);
}
export async function executeShell(args: string[], output = true) {
	let status = false;
	try {
		status = (await new Deno.Command("sh", {
			cwd: Deno.cwd(),
			args: ["-c", args.join(" ")],
			stderr: output ? "inherit" : "null",
			stdout: output ? "inherit" : "null"
		}).spawn().status).success;
	} catch (e) {
		if (output) logger.error(`Could not execute "${args.join(" ")}"`);
		throw e;
	}
	if (!status) {
		if (output) logger.error(`"${args.join(" ")}" failed`);
		throw new Error(`Failed at shell command "${args.join(" ")}"`);
	}
}