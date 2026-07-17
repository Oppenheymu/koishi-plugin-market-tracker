import type { SearchObject, SearchResult } from "@koishijs/registry";
import type { Context, Dict } from "koishi";
import { Config } from "./config";

export { Config };
export const name = "market-info";

export function apply(ctx: Context, config: Config) {
	ctx.i18n.define("zh", require("../locals/zh_CN"));

	const logger = ctx.logger("market");

	const makeDict = (result: SearchResult) => {
		const dict: Dict<SearchObject> = {};
		for (const object of result.objects) {
			if (object.manifest?.hidden && !config.showHidden) continue;
			dict[object.shortname] = object;
		}
		return dict;
	};

	const getMarket = async () => {
		const data = await ctx.http.get<SearchResult>(config.endpoint);
		return makeDict(data);
	};

	ctx.on("ready", async () => {
		let previous: Dict<SearchObject> = {};
		try {
			previous = await getMarket();
		} catch (error) {
			logger.warn("初始化插件市场数据失败", error);
		}

		ctx
			.command("market [name]")
			.action(async ({ session }, name) => {
				if (!session) return;
				if (!name) {
					return session.text(".overview", [Object.values(previous).length]);
				}
				const data = previous[name];
				if (!data) return session.text(".not-found", [name]);
				return session.text(".detail", data);
			});

		ctx.setInterval(async () => {
			let current: Dict<SearchObject>;
			try {
				current = await getMarket();
			} catch (error) {
				logger.warn("拉取插件市场数据失败", error);
				return;
			}

			const diff = Object.keys({ ...previous, ...current })
				.map((name): string | undefined => {
					const version1 = previous[name]?.package.version;
					const version2 = current[name]?.package.version;
					if (version1 === version2) return undefined;

					if (!version1) {
						let output = `新增：${name}`;
						if (config.showPublisher)
							output += ` (@${current[name].package.publisher?.username})`;
						if (config.showDescription) {
							const description = current[name].manifest?.description;
							if (description && typeof description === "object") {
								output += `\n  ${description.zh || description.en}`;
							} else if (description && typeof description === "string") {
								output += `\n  ${description}`;
							}
						}
						return output;
					}

					if (version2) {
						return `更新：${name} (${version1} → ${version2})`;
					}

					if (config.showDeletion) {
						return `删除：${name}`;
					}
					return undefined;
				})
				.filter(Boolean)
				.sort() as string[];
			previous = current;
			if (!diff.length) return;

			const content = ["[插件市场更新]", ...diff].join("\n");
			logger.info(content);
			ctx.broadcast([content]);
		}, config.interval);
	});
}
