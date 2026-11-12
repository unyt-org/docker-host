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

/**
 * Execute a command without a shell and return its stdout.
 * Throws if the command fails.
 */
export async function executeCommandOutput(command: string, args: string[]) {
	const result = await new Deno.Command(command, {
		cwd: Deno.cwd(),
		args,
		stdout: "piped",
		stderr: "null"
	}).output();
	if (!result.success) throw new Error(`Could not execute ${command}`);
	return new TextDecoder().decode(result.stdout);
}

export async function executeCommandArgs(command: string, args: string[], output = true) {
	return await executeCommand(command, args, output);
}

export async function executeDocker(args: string[], output = true) {
	return await executeCommand("docker", args, output);
}
export async function executeGit(args: string[], output = true) {
	return await executeCommand("git", args, output);
}
/**
 * Executes the joined args with `sh -c`.
 * WARNING: never pass untrusted / user-provided values to this function
 * (use executeCommandArgs / executeDocker / executeGit instead).
 */
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