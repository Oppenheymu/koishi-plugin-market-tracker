import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Context } from "koishi";
import type {} from "koishi-plugin-puppeteer";
import type { Config } from "./config";
import type { DiffItem } from "./types";

const template = readFileSync(resolve(__dirname, "template.html"), "utf-8");

const TAGS: Record<DiffItem["type"], string> = {
	added: "新增",
	updated: "更新",
	deleted: "删除",
};

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderItem(item: DiffItem): string {
	let version = "";
	if (item.type === "updated" && item.version1 && item.version2) {
		version = `<div class="item-version">${escapeHtml(item.version1)}<span class="arrow">→</span><span class="new">${escapeHtml(item.version2)}</span></div>`;
	}
	let desc = "";
	if (item.description) {
		desc = `<div class="item-desc">${escapeHtml(item.description)}</div>`;
	}
	let publisher = "";
	if (item.publisher) {
		publisher = `<div class="item-publisher">@${escapeHtml(item.publisher)}</div>`;
	}
	return `<div class="item ${item.type}">
          <span class="item-tag">${TAGS[item.type]}</span>
          <div class="item-body">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${version}${desc}${publisher}
          </div>
        </div>`;
}

function buildDiffHtml(items: DiffItem[], timestamp: Date): string {
	const timeStr = timestamp.toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
	const added = items.filter((i) => i.type === "added").length;
	const updated = items.filter((i) => i.type === "updated").length;
	const deleted = items.filter((i) => i.type === "deleted").length;

	return template
		.replace(/<!--time-->/g, () => timeStr)
		.replace(/<!--added-->/g, () => String(added))
		.replace(/<!--updated-->/g, () => String(updated))
		.replace(/<!--deleted-->/g, () => String(deleted))
		.replace(/<!--items-->/g, () => items.map(renderItem).join(""))
		.replace(/<!--total-->/g, () => String(items.length));
}

function formatDiffText(items: DiffItem[]): string {
	return items
		.map((item) => {
			if (item.type === "added") {
				let output = `新增：${item.name}`;
				if (item.publisher) output += ` (@${item.publisher})`;
				if (item.description) output += `\n  ${item.description}`;
				return output;
			}
			if (item.type === "updated") {
				return `更新：${item.name} (${item.version1} → ${item.version2})`;
			}
			return `删除：${item.name}`;
		})
		.join("\n");
}

export async function renderDiff(
	ctx: Context,
	items: DiffItem[],
	config: Config,
): Promise<string> {
	if (config.renderImage) {
		try {
			const html = buildDiffHtml(items, new Date());
			return await ctx.puppeteer.render(html, async (page, next) => {
				await page.setViewport({
					width: 600,
					height: 800,
					deviceScaleFactor: 2,
				});
				return next((await page.$(".container")) ?? undefined);
			});
		} catch (error) {
			ctx.logger("market-tracker").warn("图片渲染失败，回退到文本模式", error);
		}
	}
	return `[插件市场更新]\n${formatDiffText(items)}`;
}
