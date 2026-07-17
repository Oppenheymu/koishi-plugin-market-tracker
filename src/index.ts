import type { SearchObject, SearchResult } from "@koishijs/registry";
import type { Context, Dict } from "koishi";
import { Config } from "./config";
import { computeDiff } from "./diff";
import { renderDiff } from "./render";

export { Config };
export const name = "market-info";
export const inject = { optional: ["puppeteer"] };

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

			const items = computeDiff(previous, current, config);
			previous = current;
			if (!items.length) return;

			const content = await renderDiff(ctx, items, config);
			logger.info(`[插件市场更新] ${items.length} 项变更`);
			ctx.broadcast([content]);
		}, config.interval);
	});
}
