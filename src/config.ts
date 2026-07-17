import { Schema, Time } from "koishi";

export interface Receiver {
	platform: string;
	selfId: string;
	channelId: string;
	guildId?: string;
}

const Receiver: Schema<Receiver> = Schema.object({
	platform: Schema.string().required().description("平台名称。"),
	selfId: Schema.string().required().description("机器人 ID。"),
	channelId: Schema.string().required().description("频道 ID。"),
	guildId: Schema.string().description("群组 ID。"),
});

export interface Config {
	rules: Receiver[];
	endpoint: string;
	interval: number;
	showHidden: boolean;
	showDeletion: boolean;
	showPublisher: boolean;
	showDescription: boolean;
}

export const Config: Schema<Config> = Schema.object({
	rules: Schema.array(Receiver).role("table").description("推送规则列表。"),
	endpoint: Schema.string()
		.default("https://registry.koishi.chat/index.json")
		.description("插件市场地址。"),
	interval: Schema.number()
		.default(Time.minute * 30)
		.description("轮询间隔 (毫秒)。"),
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
});
