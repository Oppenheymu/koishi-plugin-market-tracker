import { Schema, Time } from "koishi";

export interface Target {
    platform: string;
    selfId?: string;
    channelId: string;
}

export interface Config {
    endpoint: string;
    interval: number;
    renderImage: boolean;
    showOptions: string[];
    targets: Target[];
}

export const Config = Schema.object({
    targets: Schema.array(
        Schema.object({
            platform: Schema.string().description("平台名称"),
            selfId: Schema.string()
                .description("机器人ID")
                .default(""),
            channelId: Schema.string().description("目标群/频道ID"),
        }),
    )
        .role("table")
        .default([])
        .description("推送目标列表。将更新推送到指定机器人所在的群/频道。留空则不推送。"),
    endpoint: Schema.string()
        .default("https://registry.koishi.chat/index.json")
        .description("插件市场地址。"),
    interval: Schema.number()
        .default(Time.minute * 30)
        .description("轮询间隔（毫秒）。"),
    renderImage: Schema.boolean()
        .default(true)
        .description("是否将更新渲染为图片。需要安装 puppeteer 服务。"),
    showOptions: Schema.array(
        Schema.union([
            Schema.const("hidden").description("显示隐藏的插件"),
            Schema.const("deletion").description("显示删除的插件"),
            Schema.const("publisher").description("显示插件发布者"),
            Schema.const("description").description("显示插件描述"),
        ]),
    )
        .role("checkbox")
        .default([])
        .description("显示选项。"),
});
