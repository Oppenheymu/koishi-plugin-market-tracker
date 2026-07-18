import { Schema, Time } from "koishi";

export interface Target {
    platform: string;
    selfId?: string;
    channelId: string;
}

export interface Config {
    endpoint: string;
    interval: number;
    showHidden: boolean;
    showDeletion: boolean;
    showPublisher: boolean;
    showDescription: boolean;
    renderImage: boolean;
    targets: Target[];
}

export const Config: Schema<Config> = Schema.object({
    endpoint: Schema.string()
        .default("https://registry.koishi.chat/index.json")
        .description("插件市场地址。"),
    interval: Schema.number()
        .default(Time.minute * 30)
        .description("轮询间隔（毫秒）。"),
    showHidden: Schema.boolean()
        .default(false)
        .description("是否显示隐藏的插件。"),
    showDeletion: Schema.boolean()
        .default(false)
        .description("是否显示删除的插件。"),
    showPublisher: Schema.boolean()
        .default(false)
        .description("是否显示插件发布者。"),
    showDescription: Schema.boolean()
        .default(false)
        .description("是否显示插件描述。"),
    renderImage: Schema.boolean()
        .default(true)
        .description("是否将更新渲染为图片。需要安装 puppeteer 服务。"),
    targets: Schema.array(Schema.object({
        platform: Schema.string()
            .description("平台名称，如 qq、telegram、discord。"),
        selfId: Schema.string()
            .description("机器人账号。同平台单机器人时可留空；多机器人时填 selfId 精确指定。")
            .default(""),
        channelId: Schema.string()
            .description("要推送到的群/频道 ID。"),
    }))
        .default([])
        .description("推送目标列表。将更新推送到指定机器人所在的群/频道。留空则不推送。"),
});
