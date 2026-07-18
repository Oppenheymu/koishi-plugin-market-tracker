import type { SearchObject, SearchResult } from "@koishijs/registry";
import type { Context, Dict } from "koishi";
import { Config } from "./config";
import { computeDiff } from "./diff";
import { renderDiff } from "./render";

export { Config };
export const name = "market-tracker";

export const inject = { 
	required: [ "database" ],
	optional: ["puppeteer"]
};

function describeError(error: unknown): string {
	if (error instanceof Error) {
		const cause = error.cause;
		if (cause instanceof Error) return `${error.message}: ${cause.message}`;
		return error.message;
	}
	return String(error);
}

export function apply(ctx: Context, config: Config) {
    ctx.i18n.define("zh", require("../locals/zh_CN"));
    ctx.i18n.define("en", require("../locals/en"));

    const logger = ctx.logger("market-tracker");

    const makeDict = (result: SearchResult) => {
        const dict: Dict<SearchObject> = {};
        for (const object of result.objects) {
            if (object.manifest?.hidden && !config.showOptions.includes("hidden")) continue;
            dict[object.shortname] = object;
        }
        return dict;
    };

	const getMarket = async () => {
		let lastError: unknown;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const data = await ctx.http.get<SearchResult>(config.endpoint, {
					timeout: 30 * 1000,
				});
				return makeDict(data);
			} catch (error) {
				lastError = error;
				if (attempt < 3) {
					const delay = attempt * 2000;
					logger.warn(
						`拉取失败（第 ${attempt} 次）：${describeError(error)}，${delay / 1000} 秒后重试`,
					);
					await new Promise<void>((resolve) => setTimeout(resolve, delay));
				}
			}
		}
		throw lastError;
	};

    ctx.on("ready", async () => {
        let previous: Dict<SearchObject> = {};
        try {
            previous = await getMarket();
        } catch (error) {
            logger.warn(`初始化插件市场数据失败：${describeError(error)}`);
        }

        ctx.command("market [name]").action(async ({ session }, name) => {
            if (!session) return;
            if (!name) {
                return session.text(".overview", [
                    Object.values(previous).length,
                ]);
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
                logger.warn(`拉取插件市场数据失败：${describeError(error)}`);
                return;
            }

            const items = computeDiff(previous, current, config);
            previous = current;
            if (!items.length) return;

            const content = await renderDiff(ctx, items, config);
            logger.info(`[插件市场更新] ${items.length} 项变更`);
            for (const target of config.targets) {
                const botId = target.selfId
                    ? `${target.platform}:${target.selfId}`
                    : target.platform;
                const bot = ctx.bots.find(
                    (b) => b.platform === target.platform
                        && (!target.selfId || b.selfId === target.selfId),
                );
                if (!bot?.isActive) {
                    logger.warn(`机器人 ${botId} 不可用，跳过 ${target.channelId}`);
                    continue;
                }
                try {
                    await bot.sendMessage(target.channelId, content);
                } catch (error) {
                    logger.warn(
                        `推送到 ${target.platform}:${target.channelId} 失败：${describeError(error)}`,
                    );
                }
            }
        }, config.interval);
    });
}
