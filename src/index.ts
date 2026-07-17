import type { SearchObject, SearchResult } from "@koishijs/registry";
import {
    type Context,
    type Dict,
    deepEqual,
    pick,
    Schema,
    sleep,
    Time,
} from "koishi";

export const name = "market-info";

interface 接收者 {
    platform: string;
    selfId: string;
    channelId: string;
    guildId?: string;
}

const 接收者: Schema<接收者> = Schema.object({
    platform: Schema.string().required().description("平台名称。"),
    selfId: Schema.string().required().description("机器人 ID。"),
    channelId: Schema.string().required().description("频道 ID。"),
    guildId: Schema.string().description("群组 ID。"),
});

export interface Config {
    规则: 接收者[];
    地址: string;
    间隔: number;
    显示隐藏: boolean;
    显示删除: boolean;
    显示发布者: boolean;
    显示描述: boolean;
}

export const Config: Schema<Config> = Schema.object({
    规则: Schema.array(接收者).role("table").description("推送规则列表。"),
    地址: Schema.string()
        .default("https://registry.koishi.chat/index.json")
        .description("插件市场地址。"),
    间隔: Schema.number()
        .default(Time.minute * 30)
        .description("轮询间隔 (毫秒)。"),
    显示隐藏: Schema.boolean()
        .default(false)
        .description("是否显示隐藏的插件。"),
    显示删除: Schema.boolean()
        .default(false)
        .description("是否显示删除的插件。"),
    显示发布者: Schema.boolean()
        .default(false)
        .description("是否显示插件发布者。"),
    显示描述: Schema.boolean().default(false).description("是否显示插件描述。"),
});

export function apply(ctx: Context, 配置: Config) {
    ctx.i18n.define("zh", require("../locals/zh_CN"));

    const 日志 = ctx.logger("market");

    const 构建字典 = (结果: SearchResult) => {
        const 字典: Dict<SearchObject> = {};
        for (const 条目 of 结果.objects) {
            if (条目.manifest?.hidden && !配置.显示隐藏) continue;
            字典[条目.shortname] = 条目;
        }
        return 字典;
    };

    const 获取市场 = async () => {
        const 数据 = await ctx.http.get<SearchResult>(配置.地址);
        return 构建字典(数据);
    };

    ctx.on("ready", async () => {
        let 旧数据: Dict<SearchObject> = {};
        try {
            旧数据 = await 获取市场();
        } catch (错误) {
            日志.warn("初始化插件市场数据失败", 错误);
        }

        ctx.command("market [插件名]")
            .option("receive", "-r", { authority: 3, value: true })
            .option("receive", "-R", { authority: 3, value: false })
            .action(async ({ session, options: 选项 }, 插件名) => {
                if (!session) return;
                if (typeof 选项?.receive === "boolean") {
                    const 索引 = 配置.规则.findIndex((现有接收者) => {
                        return deepEqual(
                            pick(现有接收者, [
                                "platform",
                                "selfId",
                                "channelId",
                                "guildId",
                            ]),
                            pick(session, [
                                "platform",
                                "selfId",
                                "channelId",
                                "guildId",
                            ]),
                        );
                    });
                    if (选项.receive) {
                        if (索引 >= 0) return session.text(".not-modified");
                        if (!session.channelId) return;
                        const 新接收者: 接收者 = {
                            platform: session.platform,
                            selfId: session.selfId,
                            channelId: session.channelId,
                            ...(session.guildId
                                ? { guildId: session.guildId }
                                : {}),
                        };
                        配置.规则.push(新接收者);
                    } else {
                        if (索引 < 0) return session.text(".not-modified");
                        配置.规则.splice(索引, 1);
                    }
                    ctx.scope.update(配置, false);
                    return session.text(".updated");
                }

                if (!插件名) {
                    return session.text(".overview", [
                        Object.values(旧数据).length,
                    ]);
                }

                const 数据 = 旧数据[插件名];
                if (!数据) return session.text(".not-found", [插件名]);
                return session.text(".detail", 数据);
            });

        ctx.setInterval(async () => {
            let 新数据: Dict<SearchObject>;
            try {
                新数据 = await 获取市场();
            } catch (错误) {
                日志.warn("拉取插件市场数据失败", 错误);
                return;
            }

            const 差异 = Object.keys({ ...旧数据, ...新数据 })
                .map((插件名): string | undefined => {
                    const 旧版本 = 旧数据[插件名]?.package.version;
                    const 新版本 = 新数据[插件名]?.package.version;
                    if (旧版本 === 新版本) return undefined;

                    if (!旧版本) {
                        let 输出 = `新增：${插件名}`;
                        if (配置.显示发布者)
                            输出 += ` (@${新数据[插件名].package.publisher?.username})`;
                        if (配置.显示描述) {
                            const 描述 = 新数据[插件名].manifest?.description;
                            if (描述 && typeof 描述 === "object") {
                                输出 += `\n  ${描述.zh || 描述.en}`;
                            } else if (描述 && typeof 描述 === "string") {
                                输出 += `\n  ${描述}`;
                            }
                        }
                        return 输出;
                    }

                    if (新版本) {
                        return `更新：${插件名} (${旧版本} → ${新版本})`;
                    }

                    if (配置.显示删除) {
                        return `删除：${插件名}`;
                    }
                    return undefined;
                })
                .filter(Boolean)
                .sort() as string[];
            旧数据 = 新数据;
            if (!差异.length) return;

            const 内容 = ["[插件市场更新]", ...差异].join("\n");
            日志.info(内容);
            const 延迟 = ctx.root.config.delay?.broadcast ?? 0;
            for (let 索引 = 0; 索引 < 配置.规则.length; ++索引) {
                if (索引 && 延迟) await sleep(延迟);
                const { platform, selfId, channelId, guildId } =
                    配置.规则[索引];
                const 机器人 = ctx.bots.find(
                    (候选) =>
                        候选.platform === platform && 候选.selfId === selfId,
                );
                if (!机器人) {
                    日志.warn("未找到对应的机器人：%s/%s", platform, selfId);
                    continue;
                }
                机器人.sendMessage(channelId, 内容, guildId);
            }
        }, 配置.间隔);
    });
}
