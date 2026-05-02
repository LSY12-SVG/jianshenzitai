import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports");
const baseUrl = process.env.EVAL_BASE_URL ?? "http://127.0.0.1:5173/";
const runtimeNodeModules = process.env.CODEX_RUNTIME_NODE_MODULES;

if (!runtimeNodeModules) {
  throw new Error("缺少 CODEX_RUNTIME_NODE_MODULES 环境变量");
}

const playwrightModuleUrl = pathToFileURL(path.join(runtimeNodeModules, "playwright", "index.mjs")).href;
const { chromium } = await import(playwrightModuleUrl);

const videoItems = [
  { name: "深蹲.mp4", expectedExercise: "squat", expectedCount: null },
  { name: "俯卧撑.mp4", expectedExercise: "pushup", expectedCount: null },
  { name: "平板支撑.mp4", expectedExercise: "plank", expectedCount: null },
  { name: "哑铃弯举.mp4", expectedExercise: "curl", expectedCount: null },
].map((item) => ({
  ...item,
  videoUrl: new URL(encodeURI(item.name), baseUrl).toString(),
}));

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSeconds(value) {
  return value === null || value === undefined ? "-" : `${value.toFixed(2)} s`;
}

function formatSummaryText(result) {
  const notes = [];

  if (result.poseCoverage < 0.85) {
    notes.push("关键点跟踪覆盖率偏低");
  } else {
    notes.push("关键点跟踪覆盖率正常");
  }

  if (result.firstEventSeconds === null) {
    notes.push("未触发动作事件");
  } else if (result.firstEventSeconds > 1.5) {
    notes.push("起始事件响应偏慢");
  } else {
    notes.push("起始事件响应正常");
  }

  if (result.expectedCount !== null) {
    if (result.falsePositiveCount > 0) {
      notes.push(`多计 ${result.falsePositiveCount} 次/组`);
    }
    if (result.missedCount > 0) {
      notes.push(`漏计 ${result.missedCount} 次/组`);
    }
    if (!result.falsePositiveCount && !result.missedCount) {
      notes.push("计数与标注一致");
    }
  } else {
    notes.push("未提供真值次数，暂不评估漏检/误检");
  }

  return notes.join("；");
}

function getActionMetricText(result) {
  if (result.expectedExercise === "plank") {
    return `输出 ${result.summary.holdCount} 组，最长保持 ${formatSeconds(result.summary.bestHoldSeconds)}`;
  }

  return `输出计数 ${result.summary.reps} 次，当前速率 ${result.summary.cadenceText}`;
}

function summarizeReport(results) {
  const total = results.length;
  const avgPoseCoverage = total
    ? results.reduce((sum, result) => sum + result.poseCoverage, 0) / total
    : 0;
  const validResponseResults = results.filter((result) => result.firstEventSeconds !== null);
  const avgFirstEventSeconds = validResponseResults.length
    ? validResponseResults.reduce((sum, result) => sum + result.firstEventSeconds, 0) / validResponseResults.length
    : null;
  const labeledCountResults = results.filter((result) => result.expectedCount !== null);
  const totalFalsePositives = labeledCountResults.reduce((sum, result) => sum + (result.falsePositiveCount ?? 0), 0);
  const totalMissed = labeledCountResults.reduce((sum, result) => sum + (result.missedCount ?? 0), 0);

  return {
    totalVideos: total,
    averagePoseCoverage: avgPoseCoverage,
    averageFirstEventSeconds: avgFirstEventSeconds,
    labeledCountVideos: labeledCountResults.length,
    totalFalsePositives,
    totalMissed,
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# 动作分析事件评估报告");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push(`评测方式：基于页面同一套 MediaPipe + 特征流 + 动作分析器 + 事件层，对 4 个本地视频以 ${report.options.sampleFps} FPS 采样离线复跑。`);
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  lines.push(`- 视频数量：${report.summary.totalVideos}`);
  lines.push(`- 平均关键点覆盖率：${formatPercent(report.summary.averagePoseCoverage)}`);
  lines.push(`- 平均首次事件响应：${report.summary.averageFirstEventSeconds === null ? "-" : formatSeconds(report.summary.averageFirstEventSeconds)}`);
  lines.push(`- 提供真值次数的视频数：${report.summary.labeledCountVideos}`);
  lines.push(`- 总误检次数：${report.summary.totalFalsePositives}`);
  lines.push(`- 总漏检次数：${report.summary.totalMissed}`);
  lines.push("");
  lines.push("## 分视频结果");
  lines.push("");
  lines.push("| 视频 | 分析动作 | 关键点覆盖率 | 首次事件响应 | 输出结果 | 真值次数 | 计数偏差 | 结论 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const result of report.results) {
    lines.push(
      `| ${result.name} | ${result.expectedExercise} | ${formatPercent(result.poseCoverage)} | ${formatSeconds(result.firstEventSeconds)} | ${getActionMetricText(result)} | ${result.expectedCount ?? "-"} | ${result.expectedCount === null ? "-" : `+${result.falsePositiveCount} / -${result.missedCount}`} | ${formatSummaryText(result)} |`,
    );
  }

  lines.push("");
  lines.push("## 详细观察");
  lines.push("");

  for (const result of report.results) {
    lines.push(`### ${result.name}`);
    lines.push("");
    lines.push(`- 分析动作：${result.expectedExercise}`);
    lines.push(`- 关键点覆盖率：${formatPercent(result.poseCoverage)}`);
    lines.push(`- 首次事件响应时间：${formatSeconds(result.firstEventSeconds)}`);
    lines.push(`- 真值次数：${result.expectedCount ?? "-"}`);
    lines.push(`- 误检次数：${result.falsePositiveCount ?? "-"}`);
    lines.push(`- 漏检次数：${result.missedCount ?? "-"}`);
    lines.push(`- 系统输出：${getActionMetricText(result)}`);
    lines.push(`- 简要结论：${formatSummaryText(result)}`);
    lines.push("");
  }

  lines.push("## 说明");
  lines.push("");
  lines.push("- 当前评测已切换为单动作分析模式，每个视频只运行对应动作分析器。");
  lines.push("- 事件层输出的标准事件包括 rep 完成事件与 plank 保持起止事件，时间频率轴和报告都直接消费这些事件。");
  lines.push("- 若要评估漏检/误检，请在 `videoItems` 里补充 `expectedCount` 真值次数。");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.poseAppDebug?.evaluateVideos), null, { timeout: 30000 });

  const report = await page.evaluate(async (items) => {
    return window.poseAppDebug.evaluateVideos(items, { sampleFps: 12 });
  }, videoItems);
  report.summary = summarizeReport(report.results);

  await fs.mkdir(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, "video-evaluation-report.json");
  const mdPath = path.join(reportDir, "video-evaluation-report.md");
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdownReport(report), "utf8");

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    summary: report.summary,
  }, null, 2));
} finally {
  await browser.close();
}
