import type { Context } from "koishi";
import type {} from "koishi-plugin-puppeteer";
import type { Config } from "./config";
import type { DiffItem } from "./types";

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
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

	const tags: Record<DiffItem["type"], string> = {
		added: "新增",
		updated: "更新",
		deleted: "删除",
	};

	const renderItem = (item: DiffItem): string => {
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
          <span class="item-tag">${tags[item.type]}</span>
          <div class="item-body">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${version}${desc}${publisher}
          </div>
        </div>`;
	};

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: transparent;
  }
  .container {
    width: 560px;
    background: linear-gradient(160deg, #1a1d29 0%, #15172a 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .header {
    padding: 28px 28px 22px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  .header h1 {
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .header .subtitle {
    color: rgba(255,255,255,0.65);
    font-size: 12px;
    margin-top: 6px;
    letter-spacing: 1px;
  }
  .header .time {
    color: rgba(255,255,255,0.75);
    font-size: 12px;
    margin-top: 8px;
  }
  .stats {
    display: flex;
    gap: 20px;
    padding: 14px 28px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgba(255,255,255,0.55);
  }
  .stat .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .stat.added .dot { background: #52c41a; }
  .stat.updated .dot { background: #1890ff; }
  .stat.deleted .dot { background: #ff4d4f; }
  .stat .count { color: #fff; font-weight: 700; }
  .items { padding: 14px 20px 22px; }
  .item {
    display: flex;
    align-items: flex-start;
    padding: 12px 16px;
    margin-bottom: 8px;
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
    border-left: 3px solid transparent;
  }
  .item:last-child { margin-bottom: 0; }
  .item.added { border-left-color: #52c41a; }
  .item.updated { border-left-color: #1890ff; }
  .item.deleted { border-left-color: #ff4d4f; }
  .item-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 12px;
    margin-top: 1px;
    flex-shrink: 0;
    line-height: 1.6;
  }
  .item.added .item-tag { background: rgba(82,196,26,0.15); color: #52c41a; }
  .item.updated .item-tag { background: rgba(24,144,255,0.15); color: #1890ff; }
  .item.deleted .item-tag { background: rgba(255,77,79,0.15); color: #ff4d4f; }
  .item-body { flex: 1; min-width: 0; }
  .item-name {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    word-break: break-all;
  }
  .item-version {
    color: rgba(255,255,255,0.5);
    font-size: 12px;
    margin-top: 3px;
    font-family: "SF Mono", "Fira Code", monospace;
  }
  .item-version .arrow { color: rgba(255,255,255,0.3); margin: 0 5px; }
  .item-version .new { color: #1890ff; font-weight: 600; }
  .item-desc {
    color: rgba(255,255,255,0.45);
    font-size: 12px;
    margin-top: 5px;
    line-height: 1.5;
  }
  .item-publisher {
    color: rgba(255,255,255,0.35);
    font-size: 11px;
    margin-top: 3px;
  }
  .footer {
    padding: 12px 28px;
    text-align: center;
    color: rgba(255,255,255,0.2);
    font-size: 11px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 插件市场更新</h1>
      <div class="subtitle">KOISHI PLUGIN MARKET</div>
      <div class="time">${timeStr}</div>
    </div>
    <div class="stats">
      <div class="stat added"><span class="dot"></span>新增 <span class="count">${added}</span></div>
      <div class="stat updated"><span class="dot"></span>更新 <span class="count">${updated}</span></div>
      <div class="stat deleted"><span class="dot"></span>删除 <span class="count">${deleted}</span></div>
    </div>
    <div class="items">
      ${items.map(renderItem).join("")}
    </div>
    <div class="footer">共 ${items.length} 项变更 · Powered by Koishi</div>
  </div>
</body>
</html>`;
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
			ctx.logger("market").warn("图片渲染失败，回退到文本模式", error);
		}
	}
	return `[插件市场更新]\n${formatDiffText(items)}`;
}
