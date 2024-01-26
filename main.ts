import { OutputMode, exec } from "https://deno.land/x/exec@0.0.5/mod.ts";

import { EndpointConfig } from "./endpoint-config.ts";
import { Datex, constructor, expose, meta, property, replicator,default_property, scope, sync, label } from "unyt_core";
import { Class } from "unyt_core/utils/global_types.ts";
import { Path } from "unyt_node/path.ts";

import { createHash } from "https://deno.land/std@0.91.0/hash/mod.ts";
import { ESCAPE_SEQUENCES, Logger } from "unyt_core/utils/logger.ts";


const notraefik = new Path("./notraefik");
const useTraefik = !notraefik.fs_exists;
console.log("using traefik: ", useTraefik)

let hostPort = 80;
const portOverride = new Path("./port");
if (portOverride.fs_exists && !portOverride.fs_is_dir) {
	hostPort = Number(await portOverride.getTextContent())
}
console.log("using host port: ", hostPort)

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

[certificatesresolvers.myhttpchallenge.acme]
    caserver = "https://acme-v02.api.letsencrypt.org/directory"
    email = "postmaster@unyt.org"
    [certificatesresolvers.myhttpchallenge.acme.httpchallenge] 
    entrypoint = "web"
`

const logger = new Datex.Logger("container manager");

await Datex.Supranet.connect();

enum ContainerStatus {
	STOPPED = 0,
	STARTING = 1,
	RUNNING = 2,
	STOPPING = 3,
	FAILED = 4,
	INITIALIZING = 5,
	ONLINE = 6
}

// parent class for all types of containers
@sync('Container') class Container {

	protected logger!:Datex.Logger;
	#initialized = false;

	// docker container image + id
	@property image!: string
	@property container_name = "Container"
	@property name = "Container"
	@property id = '0';

	network = "main"

	@property owner!: Datex.Endpoint
	@property status: ContainerStatus = ContainerStatus.INITIALIZING;
	@property errorMessage?: string

	#labels: string[] = []
	#ports: [number, number][] = []
	#env: Record<string,string> = {}
	#volumes: Record<string,string> = {}

	debugPort: string|null = null

	get volumes() {return this.#volumes}

	addLabel(label: string) {
		this.#labels.push(label)
	}

	formatVolumeName(name: string) {
		return name.replace(/[^a-zA-Z0-9_.-]/g, '-')
	}

	async addVolume(name: string, path: string) {
		await execCommand(`docker volume create ${name}`)
		this.#volumes[name] = path;
	}

	addVolumePath(hostPath: string, path: string) {
		this.#volumes[hostPath] = path;
	}

	addEnvironmentVariable(name: string, value: string) {
		this.#env[name] = value;
	}

	getFormattedLabels() {
		return this.#labels.map(label => `--label ${label
			.replaceAll('`', '\\`')
			.replaceAll('(', '\\(')
			.replaceAll(')', '\\)')
		}`).join(" ")
	}
	getFormattedPorts() {
		return this.#ports.map(ports => `-p ${ports[1]}:${ports[0]}`).join(" ")
	}
	getFormattedEnvVariables() {
		return Object.entries(this.#env).map(([name, value]) => `--env ${name}=${value}`).join(" ")
	}
	getFormattedVolumes() {
		return Object.entries(this.#volumes).map(([name, path]) => `-v ${name}:${path}`).join(" ")
	}

	uniqueID(size = 4) {
		return new Array(size).fill('xxxx').join('-').replace(/[xy]/g, function(c) {
			const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	  }

	constructor(owner: Datex.Endpoint) {}
	@constructor construct(owner: Datex.Endpoint) {
		this.owner = owner;
		this.container_name = this.uniqueID();
		this.logger = new Datex.Logger(this);
	}
	@replicator replicate(){
		this.logger = new Datex.Logger(this);
		this.#initialized = true;
		this.updateAfterReplicate();
	}

	@property async start(){

		// start => RUNNING or FAILED
		const running = await this.handleStart();
		if (running) {
			this.status = ContainerStatus.RUNNING;

			// get online state
			const online = await this.handleOnline();
			if (online) this.status = ContainerStatus.ONLINE;
			else this.status = ContainerStatus.FAILED;
		}
		else this.status = ContainerStatus.FAILED;


		return running;
	}

	// create docker for the first time
	protected async init(){
		if (this.#initialized) return true;

		// INITIALIZING ...
		this.status = ContainerStatus.INITIALIZING;

		// STOPPED (default state) or FAILED
		const initialized = await this.handleInit();
		if (initialized) this.status = ContainerStatus.STOPPED;
		else this.status = ContainerStatus.FAILED;

		this.#initialized = initialized;

		return initialized;
	}


	protected async handleInit(){
		try {
			const restartPolicy = "always"
			await execCommand(`docker run --network=${this.network}${this.debugPort ? ` -p ${this.debugPort}:9229`:''} --log-opt max-size=10m -d --restart ${restartPolicy} --name ${this.container_name} ${this.getFormattedPorts()} ${this.getFormattedVolumes()} ${this.getFormattedEnvVariables()} ${this.getFormattedLabels()} ${this.image}`)
		} catch (e) {
			console.log(e);
			this.logger.error("error while creating container");
			return false;
		}
		return true;
	}

	protected updateAfterReplicate(){
		// continue start/stop if in inbetween state
		if (this.status == ContainerStatus.STARTING) this.start();
		else if (this.status == ContainerStatus.STOPPING) this.stop();
	}

	protected async handleStart(){
		// first init docker container (if not yet initialized)
		if (!await this.init()) return false;

		this.logger.info("Starting Container " + this.container_name);

		// STARTING ...
		this.status = ContainerStatus.STARTING;

		// start the container
		try {
			await execCommand(`docker container start ${this.container_name}`)
		} catch (e) {
			this.logger.error("error while starting container")
			return false;
		}

		await sleep(2000);

		// check if container is running
		const running = await this.isRunning();
		if (running) {
			this.logger.success("Container is running")
		}
		else {
			this.logger.error("Container is not running")
			return false;
		}

		return true;
	}

	protected async handleOnline() {
		return false;
	}

	@property async stop(force = true){
		this.logger.info("Stopping Container " + this.container_name);

		this.status = ContainerStatus.STOPPING;
		try {
			await execCommand(`docker container ${force?'kill':'stop'} ${this.container_name}`)
		} catch (e) {
			this.logger.error("error while stopping container",e);
			// TODO FAILED or RUNNING?
			this.status = ContainerStatus.FAILED;
			return false;
		}
		this.status = ContainerStatus.STOPPED;
		return true;
	}

	@property public getLogs() {
		const p = Deno.run({
			cmd: ['docker', 'logs', '--follow', this.container_name],
			stdout: 'piped', 
			stderr: 'piped'
		})
		const stream = $$(new Datex.Stream());
		stream.pipe(p.stdout.readable);
		stream.pipe(p.stderr.readable);
		return stream;
	}

	public async remove(){
		// remove from containers list
		containers.getAuto(this.owner).delete(this);

		await Container.removeContainer(this.container_name);
		await Container.removeImage(this.image);

		return true;
	}

	private async isRunning(){
		try {
			const ps = await execCommand(`docker ps | grep ${this.container_name}`);
			return !!ps;
		}
		catch (e) {
			console.log("err:",e)
			return false
		}
	}

	exposePort(port:number, hostPort:number) {
		this.#ports.push([port, hostPort])
	}

	protected enableTraefik(host: string, port?: number) {
		const name = this.image + "-" + createHash("md5").update(host).toString()
		const hasWildcard = host.startsWith('*.');

		const hostRule = hasWildcard ?
			`HostRegexp(\`{subhost:[a-z0-9-_]+}.${host.slice(2)}\`)` :
			`Host(\`${host}\`)`;

		this.addLabel(`traefik.enable=true`);
		this.addLabel(`traefik.http.routers.${name}.rule=${hostRule}`);
		this.addLabel(`traefik.http.routers.${name}.entrypoints=web`);
		this.addLabel(`traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https`);
		this.addLabel(`traefik.http.routers.${name}.middlewares=redirect-to-https@docker`);
		this.addLabel(`traefik.http.routers.${name}-secured.rule=${hostRule}`);
		this.addLabel(`traefik.http.routers.${name}-secured.tls=true`);

		if (hasWildcard) {
			const rawHost = host.slice(2);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.domains[0].main=${rawHost}`);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.domains[0].sans=${host}`);
			this.addLabel(`traefik.http.routers.${name}.tls.domains[0].main=${rawHost}`);
			this.addLabel(`traefik.http.routers.${name}.tls.domains[0].sans=${host}`);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.certresolver=mydnschallenge`);
		} else {
			this.addLabel(`traefik.http.routers.${name}-secured.tls.certresolver=myhttpchallenge`);
		}

		if (port) {
			this.addLabel(`traefik.http.routers.${name}.service=${name}`);
			this.addLabel(`traefik.http.routers.${name}-secured.service=${name}`);
			this.addLabel(`traefik.http.services.${name}.loadbalancer.server.port=${port}`);
		}
	}

	public static async removeContainer(name: string) {
		try {
			await execCommand(`docker rm -f ${name}`)
		} catch (e) {
			logger.error("error while removing container",e);
			return false;
		}
	}

	public static async removeImage(name: string) {
		try {
			await execCommand(`docker image rm -f ${name}`)
		} catch (e) {
			logger.error("error while removing container image",e);
			return false;
		}
	}

}

@sync('WorkbenchContainer') class WorkbenchContainer extends Container {

	@property config!: EndpointConfig

	constructor(owner: Datex.Endpoint, config: EndpointConfig) {super(owner)}
	@constructor constructWorkbenchContanier(owner: Datex.Endpoint, config: EndpointConfig) {
		this.construct(owner)
		this.config = config;
		this.name = "unyt Workbench"
	}

	// custom workbench container init
	override async handleInit(){
		try {
			const username = "user"; // TODO other usernames?
			const config_exported = Datex.Runtime.valueToDatexString(this.config, true, true, true);
	
			this.image = 'unyt-workbench-' + this.config.endpoint.toString().replace(/[^A-Za-z0-9_-]/g,'').toLowerCase();
	
			logger.info("image: " + this.image);
			logger.info("config: " + config_exported);
			logger.info("username: " + username);
	
			// create new config directory to copy to docker
			const tmp_dir = `res/config-files-${new Date().getTime()}`
			await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
			await Deno.writeTextFile(`${tmp_dir}/endpoint.dx`, config_exported)
			
			// create docker container
			await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${this.image} .`)
	
			// remove tmp directory
			await execCommand(`rm -r ${tmp_dir}`);
		}

		catch (e) {
			console.log(e)
			this.logger.error("Error initializing workbench container");
			return false;
		}

		return super.handleInit();
	}

	override async handleOnline() {
		await sleep(6000);
		try {
			await Datex.Supranet.pingEndpoint(this.config.endpoint);
		}
		catch (e) {
			this.logger.error("Workbench Endpoint not reachable")
			await this.stop(); // stop container again for consistant container state
			return false;
		}
		this.logger.success("Workbench Endpoint is reachable");
		return true;
	}

}


@sync('RemoteImageContainer') class RemoteImageContainer extends Container {

	@property version?:string
	@property url!:string

	constructor(owner: Datex.Endpoint, url: string, version?:string) {super(owner)}
	@constructor constructRemoteImageContainer(owner: Datex.Endpoint, url: string, version?: string) {
		this.construct(owner)
		this.version = version;
		this.url = url;
		this.name = url;
	}

	// update docker image
	@property async update(){
		try {
			this.image = `${this.url}${this.version?':'+this.version:''}`;
			await execCommand(`docker pull ${this.image}`);
		}

		catch (e) {
			console.log(e)
			this.logger.error("Error initializing remote image container");
			return false;
		}
		return true;
	}

	// custom workbench container init
	override async handleInit(){
		if (!await this.update()) return false;
		return super.handleInit();
	}

	// custom start
	override async handleStart(){
		// always pull image first
		if (!await this.update()) return false;

		return super.handleStart();
	}
}


@sync('UIXAppContainer') class UIXAppContainer extends Container {

	@property branch?:string
	@property gitSSH!:string
	@property gitHTTPS!:string
	@property stage!:string
	@property domains!:Record<string, number> // domain name -> internal port
	@property endpoint!:Datex.Endpoint

	@property args?: string[]

	// use v.0.1
	isVersion1 = false;

	constructor(owner: Datex.Endpoint, endpoint: Datex.Endpoint, gitURL: string, branch?:string, stage?: string, domains?: Record<string, number>, env?:string[], args?:string[], persistentVolumePaths?: string[], gitHubToken?: string) {super(owner)}
	@constructor constructUIXAppContainer(owner: Datex.Endpoint, endpoint: Datex.Endpoint, gitURL: string, branch?: string, stage = 'prod', domains?: Record<string, number>, env?:string[], args?:string[], persistentVolumePaths?: string[], gitHubToken?: string) {
		this.construct(owner)

		// convert from https github url
		if (gitURL.startsWith("https://")) {
			this.gitHTTPS = gitURL;
			this.gitSSH = gitURL.replace('https://github.com/', 'git@github.com:');
		}
		// convert from ssh github url
		else if (gitURL.startsWith("git@github.com")) {
			this.gitSSH = gitURL;
			this.gitHTTPS = gitURL.replace('git@github.com:','https://github.com/');
		}

		// add gh token to URL
		if (gitHubToken) {
			this.gitHTTPS = this.gitHTTPS.replace("https://github.com/", "https://oauth2:"+gitHubToken+"@github.com/")
		}

		this.container_name = endpoint.name + (endpoint.name.endsWith(stage) ? '' : (stage ? '-' + stage : ''))

		this.endpoint = endpoint; // TODO: what if @@local is passed
		this.args = args;
		
		this.branch = branch;
		this.stage = stage;
		this.domains = domains ?? {};
		
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
			this.addVolume(volumeName, mappedPath);
		}

	}

	protected async handleNetwork() {
		// make sure main network exists
		await execCommand(`docker network inspect ${this.network} &>/dev/null || docker network create ${this.network}`)
		
		if (useTraefik) {
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
				traefikContainer.exposePort(80, hostPort)
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
	
			const domains = this.domains ?? [Datex.Unyt.formatEndpointURL(this.endpoint)!.replace("https://","")];

			this.logger.info("image: " + this.image);
			this.logger.info("repo: " + this.gitHTTPS + " / " + this.gitSSH);
			this.logger.info("branch: " + this.branch);
			this.logger.info("endpoint: " + this.endpoint);
			this.logger.info("domains: " + Object.entries(domains).map(([d,p])=>`${d} (port ${p})`).join(", "));

			const orgName = this.gitHTTPS.split('/').at(-2);
			const repoName = this.gitHTTPS.split('/').pop()!.replace('.git', '');

			// clone repo
			const dir = await Deno.makeTempDir({prefix:'uix-app-'});
			const dockerfilePath = `${dir}/Dockerfile`;
			const repoPath = `${dir}/repo`;
			let repoIsPublic = false
			try {
				repoIsPublic = (await (await fetch(`https://api.github.com/repos/${orgName}/${repoName}`)).json()).visibility == "public"
			}
			catch {}

			console.log(`repo ${orgName}/${repoName} is public: ${repoIsPublic}`)

			// try clone with https first
			try {
				await execCommand(`git clone --recurse-submodules ${this.gitHTTPS} ${repoPath}`, true)
			}

			catch {
				// try clone with ssh
				try {
					await execCommand(`git clone --recurse-submodules ${this.gitSSH} ${repoPath}`, true)
				}
				catch (e) {
					let sshKey: string|undefined;
					try {
						sshKey = await this.tryGetSSHKey();
						console.log("ssh public key: " + sshKey)
					}
					catch (e) {
						console.log("Failed to generate ssh key: ", e)
					}
					let errorMessage = `Could not clone git repository ${this.gitSSH}. Please make sure the repository is accessible by ${Datex.Runtime.endpoint.main}. You can achieve this by doing one of the following:\n\n`
					let opt = 1;
					const appendOption = (option: string) => {
						errorMessage += `${opt++}. ${option}\n`
					}
					if (!repoIsPublic) appendOption(`Make the repository publicly accessible (https://github.com/${orgName}/${repoName}/settings)`);
					if (this.gitHTTPS.startsWith("https://github.com/")) {
						appendOption(`Pass a GitHub access token with --gh-token=<token> (Generate at https://github.com/settings/personal-access-tokens/new)`)
					}
					if (sshKey) appendOption(`Add the following SSH key to your repository (https://github.com/${orgName}/${repoName}/settings/keys/new): \n\n${ESCAPE_SEQUENCES.GREY}${sshKey}${ESCAPE_SEQUENCES.RESET}\n`);
					this.errorMessage = errorMessage;
					throw e;
				}
			}


			await execCommand(`cd ${repoPath} && git checkout ${this.branch}`)

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
			if (useTraefik) {
				for (const [domain, port] of Object.entries(domains)) {
					this.enableTraefik(domain, port);
				}
				this.addEnvironmentVariable("UIX_HOST_DOMAINS", Object.keys(domains).join(","));
			}
			// expose port 80
			else {
				this.exposePort(80, hostPort)
			}

			// add persistent volume for datex cache
			await this.addVolume(this.formatVolumeName(this.container_name+'-'+'datex-cache'), '/datex-cache')

			// add persistent volume for deno localStoragae
			await this.addVolume(this.formatVolumeName(this.container_name+'-'+'localstorage'), '/deno-dir/location_data')

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

	private async tryGetSSHKey() {
		const homeDir = Deno.env.get("HOME");
		if (!homeDir) throw new Error("Could not get home directory");
  		const keyPath = `${homeDir}/.ssh/id_rsa_${Datex.Runtime.endpoint.main.name.replaceAll('-','_').replace('@+','').replace('@','').replace('@@','')}`;

		// return public key if already exists
		try {
			return await Deno.readTextFile(keyPath+".pub");
		}
		// generate new key
		catch {
			await execCommand(`ssh-keygen -t rsa -b 4096 -N "" -C "${Datex.Runtime.endpoint.main}" -f ${keyPath}`)
			// add to ssh/config
			await Deno.writeTextFile("~${homeDir}/.ssh/config", `
Host github.com (${Datex.Runtime.endpoint.main})
	User git
	Hostname github.com
	IdentityFile ${keyPath}
			`)
			// return public key
			return await Deno.readTextFile(keyPath+".pub");
		}

		
	}

	private async getDockerFileContent() {
		let dockerfile = await Deno.readTextFile(this.isVersion1 ? './res/uix-app-docker/Dockerfile_v0.1' : './res/uix-app-docker/Dockerfile');

		// add uix run args
		dockerfile = dockerfile.replace("{{UIX_ARGS}}", this.args?.join(" ")??"")

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

@default_property @scope class ContainerManager {

	@expose static async getContainers():Promise<Set<Container>>{
		return containers.getAuto(datex.meta!.sender);
	}

	@expose static async createWorkbenchContainer():Promise<WorkbenchContainer>{
		const sender = datex.meta!.sender;
		logger.info("Creating new Workbench Container for " + sender);

		// create config
		const config = new EndpointConfig();
		config.endpoint = Datex.Endpoint.getNewEndpoint();

		// init and start WorkbenchContainer
		const container = new WorkbenchContainer(sender, config);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	@expose static async createRemoteImageContainer(url:string):Promise<RemoteImageContainer>{
		const sender = datex.meta!.sender;

		logger.info("Creating new Remote Image Container for " + sender, url);

		// init and start RemoteImageContainer
		const container = new RemoteImageContainer(sender, url);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	@expose static async createUIXAppContainer(gitURL:string, branch: string, endpoint: Datex.Endpoint, stage?: string, domains?: Record<string, number>, env?: string[], args?: string[], persistentVolumePaths?: string[], gitHubToken?: string):Promise<UIXAppContainer>{
		const sender = datex.meta!.sender;

		console.log("Creating new UIX App Container for " + sender, gitURL, branch, env);

		// init and start RemoteImageContainer
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domains, env, args, persistentVolumePaths, gitHubToken);
		container.start();
		await sleep(2000); // wait for immediate status updates

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	private static addContainer(endpoint:Datex.Endpoint, container:Container) {
		containers.getAuto(endpoint).add(container);
	}


	public static findContainer({type, properties, endpoint}: {type?: Class<Container>, endpoint?: Datex.Endpoint, properties?: Record<string, any>}) {
		const matches = []
		iterate: for (const [containerEndpoint, containerSet] of containers) {
			// match endpoint
			if (endpoint && !containerEndpoint.equals(endpoint)) continue;

			for (const container of containerSet) {
				// match container type
				if (!type || container instanceof type) {
					// match properties
					if (properties) {
						for (const [key, value] of Object.entries(properties)) {
							if ((container as any)[key] !== value) continue iterate;
						}
					}
					matches.push(container);
				}
			}
		}
		return matches;
	}

}

const containers = (await lazyEternalVar("containers") ?? $$(new Map<Datex.Endpoint, Set<Container>>)).setAutoDefault(Set);
logger.info(containers.size + " containers in cache")


async function execCommand<DenoRun extends boolean = false>(command:string, denoRun?:DenoRun): Promise<DenoRun extends true ? Deno.ProcessStatus : string> {
	console.log("exec: " + command)

	if (denoRun) {
		const status = await Deno.run({
			cmd: command.split(" "),
		}).status();
	
		if (!status.success) throw status.code;
		else return status as any;
	}
	else {
		const {status, output} = (await exec(`bash -c "${command.replaceAll('"', '\\"')}"`, {output: OutputMode.Capture}));
		if (!status.success) throw output;
		else return output  as any;
	}
}
