import type { SearchObject, SearchResult } from "@koishijs/registry";
import { type Context, type Dict, deepEqual, pick, sleep } from "koishi";
import { Config, type Receiver } from "./config";

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
			.option("receive", "-r", { authority: 3, value: true })
			.option("receive", "-R", { authority: 3, value: false })
			.action(async ({ session, options }, name) => {
				if (!session) return;
				if (typeof options?.receive === "boolean") {
					const index = config.rules.findIndex((receiver) => {
						return deepEqual(
							pick(receiver, ["platform", "selfId", "channelId", "guildId"]),
							pick(session, ["platform", "selfId", "channelId", "guildId"]),
						);
					});
					if (options.receive) {
						if (index >= 0) return session.text(".not-modified");
						if (!session.channelId) return;
						const receiver: Receiver = {
							platform: session.platform,
							selfId: session.selfId,
							channelId: session.channelId,
							...(session.guildId ? { guildId: session.guildId } : {}),
						};
						config.rules.push(receiver);
					} else {
						if (index < 0) return session.text(".not-modified");
						config.rules.splice(index, 1);
					}
					ctx.scope.update(config, false);
					return session.text(".updated");
				}

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
			const delay = ctx.root.config.delay?.broadcast ?? 0;
			for (let index = 0; index < config.rules.length; ++index) {
				if (index && delay) await sleep(delay);
				const { platform, selfId, channelId, guildId } = config.rules[index];
				const bot = ctx.bots.find(
					(bot) => bot.platform === platform && bot.selfId === selfId,
				);
				if (!bot) {
					logger.warn("未找到对应的机器人：%s/%s", platform, selfId);
					continue;
				}
				bot.sendMessage(channelId, content, guildId);
			}
		}, config.interval);
	});
}
