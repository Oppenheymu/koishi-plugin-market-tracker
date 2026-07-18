import type { SearchObject } from "@koishijs/registry";
import type { Dict } from "koishi";
import type { Config } from "./config";
import type { DiffItem } from "./types";

export function computeDiff(
    previous: Dict<SearchObject>,
    current: Dict<SearchObject>,
    config: Config,
): DiffItem[] {
    return Object.keys({ ...previous, ...current })
        .map((name): DiffItem | undefined => {
            const version1 = previous[name]?.package.version;
            const version2 = current[name]?.package.version;
            if (version1 === version2) return undefined;

            if (!version1) {
                const item: DiffItem = {
                    type: "added",
                    name,
                    version2,
                };
                if (config.showPublisher) {
                    const username = current[name].package.publisher?.username;
                    if (username) item.publisher = username;
                }
                if (config.showDescription) {
                    const description = current[name].manifest?.description;
                    if (description && typeof description === "object") {
                        item.description = description.zh || description.en;
                    } else if (description && typeof description === "string") {
                        item.description = description;
                    }
                }
                return item;
            }

            if (version2) {
                return {
                    type: "updated",
                    name,
                    version1,
                    version2,
                };
            }

            if (config.showDeletion) {
                return {
                    type: "deleted",
                    name,
                    version1,
                };
            }
            return undefined;
        })
        .filter((x): x is DiffItem => x !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
}
