import { logger, ESCAPE_SEQUENCES } from "unyt_core/datex_all.ts";
import { Datex } from "unyt_core/mod.ts";
import { formatEndpointURL } from "unyt_core/utils/format-endpoint-url.ts";
import { Path } from "unyt_core/utils/path.ts";
import { config } from "../../config.ts";
import Container from "./Container.ts";
import RemoteImageContainer from "./RemoteImageContainer.ts";

@sync export default class UIXAppContainer extends Container {

	@property branch?:string
	@property gitSSH!:string
	@property gitHTTPS!:URL
	@property stage!:string
	@property domains!:Record<string, number> // domain name -> internal port
	@property endpoint!:Datex.Endpoint
	@property advancedOptions?: AdvancedUIXContainerOptions

	@property args?: string[]

	// use v.0.1
	isVersion1 = false;

	static VALID_DOMAIN = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/

	async construct(owner: Datex.Endpoint, endpoint: Datex.Endpoint, gitURL: string, branch?: string, stage = 'prod', domains?: Record<string, number>, env?:string[], args?:string[], persistentVolumePaths?: string[], gitOAuthToken?: string, advancedOptions?: AdvancedUIXContainerOptions) {
		super.construct(owner)

		// validate domains
		for (const domain of Object.keys(domains ?? {})) {
			if (!(
				UIXAppContainer.VALID_DOMAIN.test(domain) || 
				(config.allowArbitraryDomains && domain.startsWith('*.'))
			)) {
				this.errorMessage = `Invalid domain name "${domain}". Only alphanumeric characters and dashes are allowed.`;
				this.status = ContainerStatus.FAILED;
				throw new Error(this.errorMessage);
			}
		}

		// convert from https url
		if (gitURL.startsWith("https://")) {
			this.gitHTTPS = new URL(gitURL);
			this.gitSSH = `git@${this.gitHTTPS.host}:${this.gitHTTPS.pathname.slice(1)}`;
		}
		// convert from ssh url
		else if (gitURL.startsWith("git@")) {
			const [host, pathname] = gitURL.match(/git@([^:]*)+?:(.*)/i)?.slice(1) ?? [];
			if (!host || !pathname)
				throw new Error(`Invalid git URL '${gitURL}'!`);
			this.gitSSH = gitURL;
			this.gitHTTPS = new URL(`https://${host}/${pathname}`);
		}

		// add gh token to URL
		if (gitOAuthToken) {
			this.gitHTTPS.username = "oauth2";
			this.gitHTTPS.password = gitOAuthToken;
		}

		this.container_name = endpoint.name.toLowerCase() + (endpoint.name.endsWith(stage) ? '' : (stage ? '-' + stage : ''))
		this.advancedOptions = advancedOptions;

		this.endpoint = endpoint; // TODO: what if @@local is passed
		this.args = args;
		
		this.branch = branch;
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
		
		this.isVersion1 = !! env?.includes("UIX_VERSION=0.1")

		if (this.isVersion1) console.log("using UIX v0.1")

		// inject environment variables
		for (const envVar of env??[]) {
			const [key, val] = envVar.split("=");
			this.addEnvironmentVariable(key, val)
		}

		// add persistent volumes
		for (const path of persistentVolumePaths??[]) {
			const mappedPath = path.startsWith("./") ? `/app${path.slice(1)}` : path;
			const volumeName = this.formatVolumeName(this.container_name + '-persistent-' + (Object.keys(this.volumes).length))
			await this.addVolume(volumeName, mappedPath);
		}

	}

	protected async handleNetwork() {
		// make sure main network exists
		await execCommand(`docker network inspect ${this.network} &>/dev/null || docker network create ${this.network}`)
		
		if (config.enableTraefik) {
			// has traefik?
			try {
				await execCommand(`docker container ls | grep traefik`)
				console.log("has traefik container");
			}
			catch {
				console.log("no traefik container detected, creating a new traefik container");
				const traefikDir = new Path("/etc/traefik/");
				
				// init and start traefik container
				if (!traefikDir.fs_exists)
					await Deno.mkdir("/etc/traefik/", { recursive: true });

				const traefikTomlPath = traefikDir.asDir().getChildPath("traefik.toml");
				const acmeJsonPath = traefikDir.asDir().getChildPath("acme.json");

				await Deno.create(acmeJsonPath.normal_pathname)
				await execCommand(`chmod 600 ${acmeJsonPath.normal_pathname}`)
				await Deno.writeTextFile(traefikTomlPath.normal_pathname, defaulTraefikToml)

				const traefikContainer = new RemoteImageContainer(Datex.LOCAL_ENDPOINT, "traefik", "v2.5");
				traefikContainer.exposePort(80, config.hostPort)
				traefikContainer.exposePort(443, 443)
				traefikContainer.addVolumePath("/var/run/docker.sock", "/var/run/docker.sock")
				traefikContainer.addVolumePath(traefikTomlPath.normal_pathname, "/etc/traefik/traefik.toml")
				traefikContainer.addVolumePath(acmeJsonPath.normal_pathname, "/acme.json")

				traefikContainer.start();
				logger.error(traefikContainer)
				// this.exposePort(80, 80);
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
					catch (e) {
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
					}
					catch (e) {
						this.logger.error("Error removing DNS entry for " + domain);
						console.error(e)
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
	override async handleInit(){
		// setup network
		await this.handleNetwork()

		// remove any existing previous container
		const existingContainers = ContainerManager.findContainer({type: UIXAppContainer, properties: {
			gitHTTPS: this.gitHTTPS,
			stage: this.stage
		}})
		for (const existingContainer of existingContainers) {
			this.logger.error("removing existing container", existingContainer)
			await existingContainer.remove()
		}

		this.image = this.container_name

		try {
			const domains = this.domains ?? [formatEndpointURL(this.endpoint)];

			this.logger.info("image: " + this.image);
			this.logger.info("repo: " + this.gitHTTPS + " / " + this.gitSSH);
			this.logger.info("branch: " + this.branch);
			this.logger.info("endpoint: " + this.endpoint);
			this.logger.info("domains: " + Object.entries(domains).map(([d,p])=>`${d} (port ${p})`).join(", "));
			this.logger.info("advancedOptions: " + this.advancedOptions ? JSON.stringify(this.advancedOptions) : "-");
			
			// clone repo
			const dir = await Deno.makeTempDir({prefix:'uix-app-'});
			const dockerfilePath = `${dir}/Dockerfile`;
			const repoPath = `${dir}/repo`;
			let repoIsPublic = false;
		
			try {
				// TODO add for GitLab
				repoIsPublic = (await (await fetch(`https://api.github.com/repos/${this.orgName}/${this.repoName}`)).json()).visibility == "public"
			}
			catch {}

			// try clone with https first
			try {
				await execCommand(`git clone --depth 1 --single-branch --branch ${this.branch} --recurse-submodules ${this.gitHTTPS} ${repoPath}`, true)
			}
			catch (e) {

				Object.freeze(this.gitHTTPS);
				// was probably a github token error, don't try ssh
				if (this.gitHTTPS.username === "oauth2") {
					this.errorMessage = `Could not clone git repository ${this.gitHTTPS}: Authentication failed.\nPlease make sure the ${this.gitOrigin} access token is valid and enables read access to the repository.`;
					throw e;
				}

				let sshKey: string|undefined;
				try {
					sshKey = await this.tryGetSSHKey();
					console.log("ssh public key: " + sshKey)
				}
				catch (e) {
					console.log("Failed to generate ssh key: ", e)
				}

				// try clone with ssh
				try {
					await execCommand(`git clone --depth 1 --recurse-submodules ${sshKey ? this.gitSSH.replace(this.gitHTTPS.hostname, this.uniqueGitHostName) : this.gitSSH} ${repoPath}`, true)
				}
				catch (e) {
					console.log(e)

					let errorMessage = `Could not clone git repository ${this.gitSSH}. Please make sure the repository is accessible by ${Datex.Runtime.endpoint.main}. You can achieve this by doing one of the following:\n\n`

					let opt = 1;
					const appendOption = (option: string) => {
						errorMessage += `${opt++}. ${option}\n`
					}

					if (!repoIsPublic) appendOption(`Make the repository publicly accessible (${this.gitOrigin === "GitHub" ? new URL(`./settings`, this.gitOriginURL).toString() : new URL("./edit", this.gitOriginURL).toString()})`);
					appendOption(`Pass a ${this.gitOrigin} access token with --git-token=<token> (Generate at ${this.gitOrigin === "GitHub" ? `https://github.com/settings/personal-access-tokens/new` : new URL(`./-/settings/access_tokens`, this.gitOriginURL)})`)
					if (sshKey) appendOption(`Add the following SSH key to your repository (${this.gitOrigin === "GitHub" ? new URL(`./settings/keys/new`, this.gitOriginURL) : new URL(`./-/settings/repository`, this.gitOriginURL)}): \n\n${ESCAPE_SEQUENCES.GREY}${sshKey}${ESCAPE_SEQUENCES.RESET}\n`);
					this.errorMessage = errorMessage;
					throw e;
				}
			}

			// set debug port
			let i=0;
			for (const arg of this.args??[]) {
				if (arg.startsWith("--inspect")) {
					this.debugPort = arg.match(/\:(\d+)$/)?.[1] ?? "9229";
					this.args![i] = `--inspect=0.0.0.0:${this.debugPort}`
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
			await execCommand(`docker build -f ${dockerfilePath} --build-arg stage=${this.stage} --build-arg host_endpoint=${Datex.Runtime.endpoint} -t ${this.image} ${dir}`)

			// remove tmp dir
			await Deno.remove(dir, {recursive: true});

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
			await this.addVolume(this.formatVolumeName(this.container_name+'-'+'datex-cache'), '/datex-cache')

			// add persistent volume for deno localStoragae
			await this.addVolume(this.formatVolumeName(this.container_name+'-'+'localstorage'), '/root/.cache/deno/location_data')

			// // add volume for host data, available in /app/hostdata
			// this.addVolumePath('/root/data', '/app/hostdata')
		}

		catch (e) {
			console.log("error", e);
			// this.logger.error("Error initializing UIX container");
			return false;
		}

		return super.handleInit();
	}

	private get sshKeyName() {
		return Datex.Runtime.endpoint.main.name.replaceAll('-','_') +
			'_' + this.orgName?.replaceAll('-','_').replaceAll('/','_') +
			'_' + this.repoName?.replaceAll('-','_').replaceAll('/','_');
	}

	private get sshKeyPath() {
		const homeDir = Deno.env.get("HOME");
		if (!homeDir) throw new Error("Could not get home directory");
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

			// ssh keyscan
			await execCommand(`ssh-keyscan -H ${this.gitHTTPS.hostname} >> ${homeDir}/.ssh/known_hosts`)

			await execCommand(`ssh-keygen -t rsa -b 4096 -N '' -C '${Datex.Runtime.endpoint.main}' -f ${keyPath}`)
			// add to ssh/config
			let existingConfig = "";
			try {
				existingConfig = await Deno.readTextFile(`${homeDir}/.ssh/config`);
			}
			catch {}
			await Deno.writeTextFile(`${homeDir}/.ssh/config`, `${existingConfig}

Host ${this.uniqueGitHostName}
	User git
	Hostname ${this.gitHTTPS.hostname}
	IdentityFile ${keyPath}
`)
			// return public key
			return await Deno.readTextFile(keyPath+".pub");
		}

		
	}

	private async getDockerFileContent() {
		let dockerfile = await Deno.readTextFile(this.isVersion1 ? './res/uix-app-docker/Dockerfile_v0.1' : './res/uix-app-docker/Dockerfile');

		// add uix run args + custom importmap/run path
		dockerfile = dockerfile
			.replace("{{UIX_ARGS}}", this.args?.join(" ")??"")
			.replace("{{IMPORTMAP_PATH}}", this.advancedOptions?.importMapPath ?? 'https://dev.cdn.unyt.org/importmap_compat.json')
			.replace("{{UIX_RUN_PATH}}", this.advancedOptions?.uixRunPath ?? 'https://cdn.unyt.org/uix@0.1.x/run.ts')

		// expose port
		if (this.debugPort) {
			dockerfile = dockerfile.replace("{{EXPOSE_DEBUG}}", "EXPOSE 9229")
		}
		else {
			dockerfile = dockerfile.replace("{{EXPOSE_DEBUG}}", "")
		}
		return dockerfile;
	}


	override async handleOnline(){
		// wait until endpoint inside container is reachable
		this.logger.info("Waiting for "+this.endpoint+" to come online");
		let iterations = 0;
		while (true) {
			await sleep(2000);
			if (await this.endpoint.isOnline()) {
				this.logger.success("Endpoint "+this.endpoint+" is online");
				return true;
			}
			if (iterations++ > 20) {
				this.logger.error("Endpoint "+this.endpoint+" not reachable")
				return false;
			}
		}
	}
	
}
