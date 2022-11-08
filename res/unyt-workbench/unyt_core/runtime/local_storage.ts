// custom localstorage class that handles browser and node local storage and temporary (session) storage

import { fs, urlToPath } from "../utils/utils.js";
import { client_type, cwdURL, logger } from "../utils/global_values.js";

class LocalStorage implements Storage {
	[name: string]: any;
	get length() {return Object.getOwnPropertyNames(this).length};

	#cache_file: URL

	constructor(){
		this.#init();
		this.#exitListener();
	}

	#init(name:string = '@@local', default_data:string = '{}') {
		this.clear();

		// file setup
		const cache_dir = new URL('./.datex-cache/', cwdURL);
		this.#cache_file = new URL(name, cache_dir);
		if (!fs.existsSync(urlToPath(cache_dir))) fs.mkdirSync(urlToPath(cache_dir));
		if (!fs.existsSync(urlToPath(this.#cache_file))) fs.writeFileSync(urlToPath(this.#cache_file), default_data);

		// try to parse JSON
		try {
			let serialized = fs.readFileSync(urlToPath(this.#cache_file));
			let data = JSON.parse(new TextDecoder().decode(serialized));
			Object.assign(this, data);
		}
		catch (e) {
			logger.warn("Could not read node localStorage file")
		} // ignore

	}

	#exitListener(){
		process.on('beforeExit', (code)=>{
			logger.debug(`Process exit: ${code}. Saving Node LocalStorage...`);
			this.#save();
		});
	}

	#save(){
		fs.writeFileSync(urlToPath(this.#cache_file), JSON.stringify(this));
	}


	clear(): void {
		for (let key of Object.getOwnPropertyNames(this)) {
			delete this[key];
		}
	}
	getItem(key: string): string {
		return this[key];
	}
	key(index: number): string {
		return Object.getOwnPropertyNames(this)[index];
	}
	removeItem(key: string): void {
		delete this[key];
	}
	setItem(key: string, value: string): void {
		this[key] = String(value);
	}

}

export const localStorage = client_type == "node" ? new LocalStorage() : globalThis.localStorage;