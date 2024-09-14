import "unyt_core";

export type Config = {
	enableTraefik: boolean, // Set up a traefik container to route traffic to other containers
	hostPort: number, // Port to expose traefik on
	setDNSEntries: boolean, // Set up DNS entries for unyt.app domains (requires access to unyt.app DNS)
	allowArbitraryDomains: boolean, // Allow arbitrary domains to be used (otherwise, only unyt.app domains can be used)
	token: string // Optional access token for the docker host
};

export const config = await datex.get<Config>("../config.dx");