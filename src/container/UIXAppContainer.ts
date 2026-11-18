import { logger, ESCAPE_SEQUENCES } from "unyt_core/datex_all.ts";
import { Datex } from "unyt_core/mod.ts";
import { formatEndpointURL } from "unyt_core/utils/format-endpoint-url.ts";
import { Path } from "unyt_core/utils/path.ts";
import { config } from "../config.ts";
import { Container } from "./Container.ts";
import { RemoteImageContainer } from "./RemoteImageContainer.ts";
import { ContainerStatus } from "./Types.ts";
import { getIP } from "https://deno.land/x/get_ip@v2.0.0/mod.ts";
import { ContainerManager } from "../../main.ts";
import { executeCommandArgs, executeCommandOutput, executeDocker, executeGit, executeShell } from "../CMD.ts";
import { containers } from "../../main.ts";

const publicServerIP = await getIP({ ipv6: false });
const defaulTraefikToml = `
[entryPoints]
  [entryPoints.web]
  address = ":80"

  [entryPoints.web-secure]
  address = ":443"

[api]
  dashboard = true

[providers.docker]
  endpoint = "unix:///var/run/docker.sock"
  exposedByDefault = false
  network = "main"

[certificatesresolvers.le.acme]
    caserver = "https://acme-v02.api.letsencrypt.org/directory"
    email = "postmaster@unyt.org"
    [certificatesresolvers.le.acme.httpchallenge] 
    entrypoint = "web"
`;

export type AdvancedUIXContainerOptions = {
	importMapPath?: string, 
	uixRunPath?: string
};

@sync export class UIXAppContainer extends Container {
	@property branch!: string;
	@property gitSSH!: string;
	@property gitHTTPS!: URL;
	@property stage!: string;
	@property domains!: Record<string, number>; // domain name -> internal port
	@property endpoint!: Datex.Endpoint;
	@property advancedOptions?: AdvancedUIXContainerOptions;
	@property args?: string[]

	// use v.0.1
	version = 0;
	static VALID_DOMAIN = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
	// allowed characters for git repository paths (org/repo)
	static VALID_GIT_PATH = /^\/?[A-Za-z0-9._~\-]+(\/[A-Za-z0-9._~\-]+)+\/?$/
	// allowed characters for values that are inserted into the Dockerfile CMD (sh -c "...")
	static SAFE_CMD_VALUE = /^[A-Za-z0-9_\-.,:\/@+=%~]*$/
	static VALID_ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

	// port for a domain: null/undefined = default port
	static isValidPort(port: unknown) {
		if (port === null || port === undefined) return true;
		const n = Number(port);
		return Number.isInteger(n) && n >= 1 && n <= 65535;
	}

	// Optional enforced deno lock file (env DENO_LOCK=<lock file in repo root>, e.g. deno.prod.lock).
	// The file is copied to deno.lock in the container and deno runs with --frozen: the app only starts
	// if all remote modules (e.g. UIX/DATEX from a CDN) match the hashes in the lock file.
	static VALID_LOCK_FILE = /^[A-Za-z0-9_][A-Za-z0-9_.\-]{0,99}\.lock$/;
	#lockFile?: string

	// Optional Deno version for the app container (env DENO_VERSION=x.y.z), e.g. to run the same
	// Deno version as in local development (required for a shared deno.lock with DENO_LOCK)
	static VALID_DENO_VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
	#denoVersion?: string

	// Optional online check over HTTP (env UIX_ONLINE_CHECK=http) for apps that are not connected
	// to the DATEX network (endpoint config connect: false) - otherwise the container is only
	// considered online when its endpoint is reachable over DATEX
	#httpOnlineCheck = false

	// git access token, not exposed as a synced property
	#gitOAuthToken?: string

	async construct(
		owner: Datex.Endpoint,
		endpoint: Datex.Endpoint,
		gitURL: string,
		branch: string,
		stage = 'prod',
		domains?: Record<string, number>,
		env?:string[],
		args?:string[],
		persistentVolumePaths?: string[],
		gitOAuthToken?: string,
		advancedOptions?: AdvancedUIXContainerOptions) {
		super.construct(owner);

		// validate domains
		for (const domain of Object.keys(domains ?? {})) {
			if (!(
				UIXAppContainer.VALID_DOMAIN.test(domain) || 
				(config.allowArbitraryDomains && domain.startsWith('*.') && UIXAppContainer.VALID_DOMAIN.test(domain.slice(2)))
			) || !UIXAppContainer.isValidPort(domains![domain])) {
				this.errorMessage = `Invalid domain name "${domain}". Only alphanumeric characters and dashes are allowed.`;
				this.status = ContainerStatus.FAILED;
				throw new Error(this.errorMessage);
			}
		}

		// convert from https url
		if (gitURL.startsWith("https://")) {
			this.gitHTTPS = new URL(gitURL);
			// strip any credentials from the url
			this.gitHTTPS.username = "";
			this.gitHTTPS.password = "";
			this.gitSSH = `git@${this.gitHTTPS.hostname}:${this.gitHTTPS.pathname.slice(1)}`;
		}
		// convert from ssh url
		else if (gitURL.startsWith("git@")) {
			const [host, pathname] = gitURL.match(/^git@([^:]*)+?:(.*)$/i)?.slice(1) ?? [];
			if (!host || !pathname)
				throw new Error(`Invalid git URL '${gitURL}'!`);
			this.gitHTTPS = new URL(`https://${host}/${pathname}`);
			this.gitSSH = `git@${this.gitHTTPS.hostname}:${this.gitHTTPS.pathname.slice(1)}`;
		}
		else throw new Error(`Invalid git URL '${gitURL}'! Only https:// and git@ URLs are supported.`);

		// strict validation: host and path are used in git/ssh commands and file paths
		if (
			!UIXAppContainer.VALID_DOMAIN.test(this.gitHTTPS.hostname) ||
			this.gitHTTPS.port ||
			this.gitHTTPS.search || this.gitHTTPS.hash ||
			!UIXAppContainer.VALID_GIT_PATH.test(this.gitHTTPS.pathname) ||
			this.gitHTTPS.pathname.split("/").some(p => p === "." || p === "..")
		) {
			this.errorMessage = `Invalid git URL '${gitURL}'!`;
			this.status = ContainerStatus.FAILED;
			throw new Error(this.errorMessage);
		}

		// git access token (only used for cloning, never stored in a synced property)
		if (gitOAuthToken) {
			if (typeof gitOAuthToken !== "string" || !/^[A-Za-z0-9_\-.]+$/.test(gitOAuthToken))
				throw new Error("Invalid git access token");
			this.#gitOAuthToken = gitOAuthToken;
		}

		if (stage !== undefined && (typeof stage !== "string" || !/^[A-Za-z0-9_\-]{0,40}$/.test(stage)))
			throw new Error(`Invalid stage '${stage}'`);

		this.container_name = (endpoint.name + (endpoint.name.toLowerCase().endsWith(stage.toLowerCase()) ? '' : (stage ? '-' + stage : '')))
			.replace(/[^a-z0-9@_#-]/gmi, '-')
			.toLowerCase();
		this.advancedOptions = advancedOptions;

		this.endpoint = endpoint; // TODO: what if @@local is passed

		// validate uix args + advanced options (inserted into the Dockerfile CMD)
		if (args !== undefined && args !== null) {
			if (!Array.isArray(args) || args.some(a => typeof a !== "string" || !UIXAppContainer.SAFE_CMD_VALUE.test(a)))
				throw new Error(`Invalid UIX args: ${JSON.stringify(args)}`);
		}
		for (const key of ["importMapPath", "uixRunPath"] as const) {
			const val = advancedOptions?.[key];
			if (val !== undefined && val !== null && !UIXAppContainer.SAFE_CMD_VALUE.test(String(val)))
				throw new Error(`Invalid ${key}: ${val}`);
		}
		this.args = args;
		
		this.branch = branch ?? "main";
		this.stage = stage;
		this.domains = domains ?? {};

		// check if only unyt.app domains are used
		if (!config.allowArbitraryDomains) {
			for (const domain of Object.keys(this.domains)) {
				if (!domain.endsWith('.unyt.app')) {
					this.errorMessage = `Invalid domain "${domain}". Only unyt.app domains are allowed`;
					this.status = ContainerStatus.FAILED;
					throw new Error(this.errorMessage);
				}
			}
		}
		// inject environment variables
		for (const envVar of env??[]) {
			if (typeof envVar !== "string" || !envVar.includes("="))
				throw new Error(`Invalid environment variable`);
			const key = envVar.slice(0, envVar.indexOf("="));
			const val = envVar.slice(envVar.indexOf("=") + 1);
			if (!UIXAppContainer.VALID_ENV_KEY.test(key))
				throw new Error(`Invalid environment variable name '${key}'`);
			this.addEnvironmentVariable(key, val);

			if (key === "UIX_ONLINE_CHECK") {
				if (val !== "http" && val !== "datex")
					throw new Error(`Invalid UIX_ONLINE_CHECK '${val}': must be 'http' or 'datex'`);
				this.#httpOnlineCheck = val === "http";
			}

			if (key === "DENO_VERSION") {
				if (!UIXAppContainer.VALID_DENO_VERSION.test(val))
					throw new Error(`Invalid DENO_VERSION '${val}': must be a version like 2.7.13`);
				this.#denoVersion = val;
				this.logger.info(`Using Deno ${val}`);
			}

			if (key === "DENO_LOCK") {
				if (!UIXAppContainer.VALID_LOCK_FILE.test(val))
					throw new Error(`Invalid DENO_LOCK '${val}': must be the name of a .lock file in the repository root (e.g. deno.prod.lock)`);
				this.#lockFile = val;
				this.logger.info(`Enforcing deno lock file ${val}`);
			}

			if (key === "UIX_VERSION") {
				this.version = +val.replace("0.", "");
				if (![0, 1, 3].includes(this.version))
					throw new Error(`Unsupported UIX_VERSION '${val}'`);
				this.logger.info(`Using UIX v${this.version}`);
			}
		}

		// add persistent volumes
		for (const path of persistentVolumePaths ?? []) {
			if (typeof path !== "string" || !/^\.?\/[A-Za-z0-9_\-.\/]*$/.test(path) || path.split("/").includes(".."))
				throw new Error(`Invalid persistent volume path '${path}'`);
			const mappedPath = path.startsWith("./") ? `/app${path.slice(1)}` : path;
			const volumeName = this.formatVolumeName(`${this.container_name}-persistent-${(Object.keys(this.volumes).length)}`);
			await this.addVolume(volumeName, mappedPath);
		}
	}

	protected async handleNetwork() {
		// make sure main network exists
		try {
			await executeDocker([
				"network",
				"inspect",
				this.network,
			], false);
		} catch {
			await executeDocker([
				"network",
				"create",
				this.network,
			], false);
		}
		
		if (config.enableTraefik) {
			// has traefik?
			try {
				await executeShell(["docker", "ps", "|", "grep", "traefik"], false);
				this.logger.success("Found existing traefik container");
			} catch {
				this.logger.info("Could not detect existing traefik container. Creating new traefik container...");
				const traefikDir = new Path("/etc/traefik/");

				// init and start traefik container
				if (!traefikDir.fs_exists)
					await Deno.mkdir("/etc/traefik/", { recursive: true });

				const traefikTomlPath = traefikDir.asDir().getChildPath("traefik.toml");
				const acmeJsonPath = traefikDir.asDir().getChildPath("acme.json");

				await Deno.create(acmeJsonPath.normal_pathname)
				await executeShell(["chmod", "600", acmeJsonPath.normal_pathname], false);
				await Deno.writeTextFile(traefikTomlPath.normal_pathname, defaulTraefikToml)

				// @ts-ignore $
				const traefikContainer = new RemoteImageContainer(Datex.LOCAL_ENDPOINT, "traefik", "v2.5");
				traefikContainer.exposePort(80, config.hostPort)
				traefikContainer.exposePort(443, 443)
				traefikContainer.addVolumePath("/var/run/docker.sock", "/var/run/docker.sock")
				traefikContainer.addVolumePath(traefikTomlPath.normal_pathname, "/etc/traefik/traefik.toml")
				traefikContainer.addVolumePath(acmeJsonPath.normal_pathname, "/acme.json")
				traefikContainer.startInternal();
				logger.success("Created traefik container", traefikContainer);
			}
		}
	}

	protected override async onBeforeStart() {
		if (config.setDNSEntries) {
			for (const domain of Object.keys(this.domains)) {
				// currently only for unyt.app
				if (domain.endsWith('.unyt.app')) {
					this.logger.info("Setting DNS entry for " + domain + " to " + publicServerIP);
					try {
						await datex `@+unyt-dns-1.DNSManager.addARecord(${domain}, ${publicServerIP})`
						this.logger.success("Successfully set DNS entry for " + domain);
					}
					catch {
						this.logger.error("Error setting DNS entry for " + domain);
						this.errorMessage = `Could not set DNS entry for ${domain} (Internal error)`;
						this.status = ContainerStatus.FAILED;
					}
				}
			}
		}
	}

	protected override async onBeforeStop() {
		if (config.setDNSEntries) {
			for (const domain of Object.keys(this.domains)) {
				// currently only for unyt.app
				if (domain.endsWith('.unyt.app')) {
					this.logger.info("Removing DNS entry for " + domain);
					try {
						await datex `@+unyt-dns-1.DNSManager.removeARecord(${domain})`
						this.logger.success("Successfully removed DNS entry for " + domain);
					} catch (e) {
						this.logger.error("Error removing DNS entry for " + domain);
						this.logger.error(e);
					}
				}
			}
		}
	}

	get orgName() {
		return this.gitHTTPS.pathname.split("/").at(1)!;
	}
	get repoName() {
		return this.gitHTTPS.pathname.split('/').slice(2).join("/")!.replace('.git', '');
	}

	get gitOrigin() {
		return ({
			"github.com": "GitHub",
			"gitlab.com": "GitLab"
		} as const)[this.gitHTTPS.hostname] ?? "GitLab";
	}
	
	get gitOriginURL() {
		return new URL(`/${this.orgName}/${this.repoName}/`, this.gitHTTPS);
	}

	// custom workbench container init
	override async handleInit() {
		// setup network
		await this.handleNetwork();

		// remove any existing previous container
		const existingContainers = await ContainerManager.findContainer<UIXAppContainer>({type: UIXAppContainer, properties: {
			// gitHTTPS: this.gitHTTPS,
			// stage: this.stage
			container_name: this.container_name
		}});
		if (existingContainers.length === 0) {
			this.logger.info(`Found no existing containers ${this.gitHTTPS} (${this.stage}). Creating new...`);
			// FIXME
			// for await (const [endpoint, cs] of containers.entries()) {
			// 	for (const c of cs) {
			// 		console.log(c instanceof UIXAppContainer)
			// 		console.log(endpoint, c.container_name, (c as unknown as UIXAppContainer).stage, c.gitHTTPS)
			// 	}
			// }
		}
		for (const existingContainer of existingContainers) {
			this.logger.warn("Removing existing container", existingContainer)
			await existingContainer.remove();
		}
		this.image = this.container_name;
		try {
			const domains = this.domains ?? [formatEndpointURL(this.endpoint)];
			this.logger.info("Image: " + this.image);
			this.logger.info("Repo: " + this.gitHTTPS + " / " + this.gitSSH);
			this.logger.info("Branch: " + this.branch);
			this.logger.info("Endpoint: " + this.endpoint);
			this.logger.info("Domains: " + Object.entries(domains).map(([d,p])=>`${d} (port ${p})`).join(", "));
			this.logger.info("Options: " + (this.advancedOptions ? JSON.stringify(this.advancedOptions) : "{}"));
			
			// clone repo
			const dir = await Deno.makeTempDir({ prefix:'uix-app-' });
			const dockerfilePath = `${dir}/Dockerfile`;
			const repoPath = `${dir}/repo`;
			let repoIsPublic = false;
		
			try {
				if (this.gitOrigin === "GitHub")
					repoIsPublic = (await (await fetch(`https://api.github.com/repos/${encodeURIComponent(this.orgName)}/${this.repoName.split("/").map(encodeURIComponent).join("/")}`)).json()).visibility == "public"
				else if (this.gitOrigin === "GitLab")
					repoIsPublic = (await (await fetch(`${this.gitOriginURL}info/refs?service=git-upload-pack`)).json());
			} catch { /* */}

			// clone url with access token (not stored)
			const cloneURL = new URL(this.gitHTTPS.toString());
			if (this.#gitOAuthToken) {
				cloneURL.username = "oauth2";
				cloneURL.password = this.#gitOAuthToken;
			}

			// try clone with https first
			try {
				await executeGit([
					"clone",
					"--depth", "1",
					"--single-branch",
					"--branch", this.branch,
					"--recurse-submodules",
					"--",
					cloneURL.toString(),
					repoPath
				], true);
			} catch (e) {
				// was probably a github token error, don't try ssh
				if (this.#gitOAuthToken) {
					this.errorMessage = `Could not clone git repository ${this.gitHTTPS}: Authentication failed.\nPlease make sure the ${this.gitOrigin} access token is valid and enables read access to the repository.`;
					throw e;
				}

				let sshKey: string|undefined;
				try {
					sshKey = await this.tryGetSSHKey();
					this.logger.info("SSH public key: " + sshKey)
				} catch (e) {
					this.logger.info("Failed to generate SSH key: ", e)
				}

				// try clone with ssh
				try {
					const key = sshKey ? this.gitSSH.replace(this.gitHTTPS.hostname, this.uniqueGitHostName) : this.gitSSH;
					await executeGit([
						"clone",
						"--depth", "1",
						"--recurse-submodules",
						"--",
						key,
						repoPath
					], true);
				} catch (e) {
					this.logger.error(e);
					let errorMessage = `Could not clone git repository ${this.gitSSH}. Please make sure the repository is accessible by ${Datex.Runtime.endpoint.main}. You can achieve this by doing one of the following:\n\n`

					let opt = 1;
					const appendOption = (option: string) => {
						errorMessage += `${opt++}. ${option}\n`;
					}

					if (!repoIsPublic)
						appendOption(`Make the repository publicly accessible (${this.gitOrigin === "GitHub" ? new URL(`./settings`, this.gitOriginURL).toString() : new URL("./edit", this.gitOriginURL).toString()})`);
					appendOption(`Pass a ${this.gitOrigin} access token with --git-token=<token> (Generate at ${this.gitOrigin === "GitHub" ? `https://github.com/settings/personal-access-tokens/new` : new URL(`./-/settings/access_tokens`, this.gitOriginURL)})`)
					if (sshKey)
						appendOption(`Add the following SSH key to your repository (${this.gitOrigin === "GitHub" ? new URL(`./settings/keys/new`, this.gitOriginURL) : new URL(`./-/settings/repository`, this.gitOriginURL)}): \n\n${ESCAPE_SEQUENCES.GREY}${sshKey}${ESCAPE_SEQUENCES.RESET}\n`);
					this.errorMessage = errorMessage;
					throw e;
				}
			}

			// Deno 2 always loads the "importMap" from deno.json (even if --import-map is passed).
			// UIX apps point it to a generated file (e.g. .datex-cache/importmap.lock.json) that does not exist
			// in a fresh clone - create it from the public import map, the same map the app is started with.
			await this.ensureConfigImportMap(repoPath);

			// enforced lock file must exist in the repository
			if (this.#lockFile) {
				try {
					const stat = await Deno.lstat(`${repoPath}/${this.#lockFile}`);
					if (!stat.isFile) throw new Error("not a file");
				}
				catch {
					this.errorMessage = `DENO_LOCK is set, but the lock file '${this.#lockFile}' does not exist in the repository root (branch ${this.branch}).`;
					throw new Error(this.errorMessage);
				}
			}

			// set debug port
			let i=0;
			if (!this.args)
				this.args = [];
			for (const arg of this.args??[]) {
				if (arg.startsWith("--inspect")) {
					this.debugPort = arg.match(/\:(\d+)$/)?.[1] ?? "9229";
					this.args[i] = `--inspect=0.0.0.0:${this.debugPort}`
				}
				i++;
			}

			// copy dockerfile
			const dockerfile = await this.getDockerFileContent();
			await Deno.writeTextFile(dockerfilePath, dockerfile);

			// also remove docker container + docker image with same name remove to make sure
			await Container.removeContainer(this.container_name);
			await Container.removeImage(this.image);

			// create docker container
			// TODO: --build-arg uix_args="${this.args?.join(" ")??""}"
			await executeDocker([
				"build",
				"-f", dockerfilePath,
				"--build-arg", `stage=${this.stage}`,
				"--build-arg", `host_endpoint=${Datex.Runtime.endpoint}`,
				"-t",
				this.image,
				dir
			], true)

			// remove tmp dir
			await Deno.remove(dir, { recursive: true });

			// enable traefik routing
			if (config.enableTraefik) {
				for (const [domain, port] of Object.entries(domains)) {
					this.enableTraefik(domain, port);
				}
				this.addEnvironmentVariable("UIX_HOST_DOMAINS", Object.keys(domains).join(","));
			}
			// expose port 80
			else {
				this.exposePort(80, config.hostPort)
			}

			// add persistent volume for datex cache
			await this.addVolume(this.formatVolumeName(`${this.container_name}-datex-cache`), '/datex-cache');

			// add persistent volume for deno localStoragae
			await this.addVolume(this.formatVolumeName(`${this.container_name}-localstorage`), '/root/.cache/deno/location_data');

			// // add volume for host data, available in /app/hostdata
			// this.addVolumePath('/root/data', '/app/hostdata')
		} catch (e) {
			this.logger.error(e);
			return false;
		}
		return super.handleInit();
	}

	/**
	 * Creates the import map referenced in deno.json ("importMap") if it is a relative path
	 * that does not exist in the repository, as a copy of the app's public import map
	 * ("_publicImportMap" in deno.json or the local importMapPath of the deployment).
	 */
	private async ensureConfigImportMap(repoPath: string) {
		let config: Record<string, unknown>;
		try {
			config = JSON.parse(await Deno.readTextFile(`${repoPath}/deno.json`));
		}
		catch {
			return; // no deno.json (or not plain JSON)
		}
		// only relative paths inside the repository
		const insideRepo = (path: unknown): path is string =>
			typeof path === "string" && path.length > 0 && !path.includes("\0") &&
			!path.startsWith("/") && !/^[a-z]+:/i.test(path) && !path.split("/").includes("..");

		const importMap = config.importMap;
		if (!insideRepo(importMap)) return;
		try {
			await Deno.lstat(`${repoPath}/${importMap}`);
			return; // exists
		}
		catch { /* missing */ }

		const sourceCandidates = [config._publicImportMap, this.advancedOptions?.importMapPath?.toString()];
		for (const source of sourceCandidates) {
			if (!insideRepo(source)) continue;
			try {
				const stat = await Deno.lstat(`${repoPath}/${source}`);
				if (!stat.isFile) continue;
				const target = `${repoPath}/${importMap}`;
				await Deno.mkdir(target.substring(0, target.lastIndexOf("/")), { recursive: true });
				await Deno.copyFile(`${repoPath}/${source}`, target);
				this.logger.info(`Created ${importMap} from ${source} (import map referenced in deno.json)`);
				return;
			}
			catch { /* try next */ }
		}
		this.logger.warn(`deno.json references the import map ${importMap}, which does not exist in the repository`);
	}

	private get sshKeyName() {
		return (Datex.Runtime.endpoint.main.name.replaceAll('-','_') +
			'_' + this.orgName?.replaceAll('-','_').replaceAll('/','_') +
			'_' + this.repoName?.replaceAll('-','_').replaceAll('/','_'))
			.replace(/[^A-Za-z0-9_]/g, '_');
	}

	private get sshKeyPath() {
		const homeDir = Deno.env.get("HOME");
		if (!homeDir)
			throw new Error("Could not get home directory");
		return `${homeDir}/.ssh/id_rsa_${this.sshKeyName}`;
	}

	private get uniqueGitHostName() {
		return `git_${this.sshKeyName}`;
	}

	private async tryGetSSHKey() {
		const homeDir = Deno.env.get("HOME");
  		const keyPath = this.sshKeyPath;
		// return public key if already exists
		try {
			return await Deno.readTextFile(keyPath+".pub");
		}
		// generate new key
		catch {

			// ssh keyscan (no shell, hostname is validated but must never be interpolated into a shell command)
			const knownHosts = await executeCommandOutput("ssh-keyscan", [
				"-H", "--", this.gitHTTPS.hostname
			]);
			await Deno.mkdir(`${homeDir}/.ssh`, { recursive: true, mode: 0o700 });
			await Deno.writeTextFile(`${homeDir}/.ssh/known_hosts`, knownHosts, { append: true });
			await executeCommandArgs("ssh-keygen", [
				"-t", "rsa",
				"-b", "4096",
				"-N", "",
				"-C", Datex.Runtime.endpoint.main.toString(),
				"-f", keyPath
			]);
			// add to ssh/config
			let existingConfig = "";
			try {
				existingConfig = await Deno.readTextFile(`${homeDir}/.ssh/config`);
			} catch {/* pass */}
			await Deno.writeTextFile(`${homeDir}/.ssh/config`, `${existingConfig}

Host ${this.uniqueGitHostName}
	User git
	Hostname ${this.gitHTTPS.hostname}
	IdentityFile ${keyPath}
`);
			// return public key
			return await Deno.readTextFile(`${keyPath}.pub`);
		}
	}

	private async getDockerFileContent() {
		let dockerfile = await Deno.readTextFile(
				`./res/uix-app-docker/Dockerfile_v0.${this.version}`
		);

		// add uix run args + custom importmap/run path
		dockerfile = dockerfile
			.replace("{{UIX_ARGS}}", this.args?.join(" ")??"")
			.replace("{{IMPORTMAP_PATH}}", (
				this.advancedOptions?.importMapPath ? 
					this.advancedOptions.importMapPath.toString() :
					'https://dev.cdn.unyt.org/importmap_compat.json'
			))
			.replace("{{UIX_RUN_PATH}}", (
				this.advancedOptions?.uixRunPath ? 
					this.advancedOptions.uixRunPath.toString() :
					'https://cdn.unyt.org/uix@0.1.x/run.ts'
			));

		// expose port
		if (this.debugPort)
			dockerfile = dockerfile.replace("{{EXPOSE_DEBUG}}", "EXPOSE 9229")
		else
			dockerfile = dockerfile.replace("{{EXPOSE_DEBUG}}", "")

		// custom Deno version (only for templates using the denoland/deno binary image)
		if (this.#denoVersion) {
			if (!/denoland\/deno:bin-[0-9.]+/.test(dockerfile))
				throw new Error(`DENO_VERSION is not supported for UIX v0.${this.version}`);
			dockerfile = dockerfile.replace(/denoland\/deno:bin-[0-9.]+/, `denoland/deno:bin-${this.#denoVersion}`);
		}

		// enforce lock file: use the given lock file as deno.lock (instead of deleting it) and run with --frozen
		if (this.#lockFile) {
			if (!dockerfile.includes("rm -f deno.lock; ") || !/deno run /.test(dockerfile))
				throw new Error(`DENO_LOCK is not supported for UIX v0.${this.version}`);
			dockerfile = dockerfile
				.replace("rm -f deno.lock; ", this.#lockFile == "deno.lock" ? "" : `cp ${this.#lockFile} deno.lock; `)
				.replace(/deno run /, "deno run --frozen --lock=deno.lock ");
		}
		return dockerfile;
	}

	/**
	 * Wait until the app inside the container responds to HTTP requests (port 80 on the docker network)
	 */
	private async handleOnlineHTTP() {
		this.logger.info(`Waiting for ${this.container_name} to respond to HTTP requests`);
		const name = Container.assertSafeDockerName(this.container_name, "container name");
		for (let i = 0; i < 30; i++) {
			await sleep(3000);
			try {
				const ips = (await executeCommandOutput("docker", [
					"inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", "--", name
				])).trim().split(/\s+/).filter(ip => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
				for (const ip of ips) {
					const res = await fetch(`http://${ip}:80/`, { signal: AbortSignal.timeout(5000), redirect: "manual" });
					await res.body?.cancel();
					if (res.status < 500) {
						this.logger.success(`${this.container_name} is online (HTTP ${res.status})`);
						return true;
					}
				}
			}
			catch { /* not reachable yet */ }
		}
		this.logger.error(`${this.container_name} does not respond to HTTP requests`);
		return false;
	}

	override async handleOnline() {
		if (this.#httpOnlineCheck) return await this.handleOnlineHTTP();
		// wait until endpoint inside container is reachable
		this.logger.info(`Waiting for ${this.endpoint} to come online`);
		let iterations = 0;
		while (true) {
			await sleep(2000);
			if (await this.endpoint.isOnline()) {
				this.logger.success(`Endpoint ${this.endpoint} is online`);
				return true;
			}
			if (iterations++ > 20) {
				this.logger.error(`Endpoint ${this.endpoint} not reachable"`)
				return false;
			}
		}
	}
}
