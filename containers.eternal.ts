import { Datex } from "unyt_core/mod.ts";
import { StorageMap } from "unyt_core/types/storage-map.ts";
import { Container } from "./src/container/Container.ts";

export const containers = new StorageMap<Datex.Endpoint, Set<Container>>();