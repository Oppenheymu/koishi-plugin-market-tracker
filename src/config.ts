import { Schema, Time } from "koishi";

export interface Config {
	endpoint: string;
	interval: number;
	showHidden: boolean;
	showDeletion: boolean;
	showPublisher: boolean;
	showDescription: boolean;
	renderImage: boolean;
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
});
