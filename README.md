## Piano Fingering Generator Web App

面向 MusicXML / MXL 的钢琴指法自动生成 Web 应用。当前版本在浏览器端实现了多 Worker 并行 Dyna-Q 训练，并新增“基于置信度引导的局部动态规划精修”质量增强层，可在生成初始策略后对低置信度片段做局部 Viterbi 精修。

## Authors

- Author (English): `Jeffrey Zhou`
- 作者（中文）：`Jeffrey Zhou`
- 著者（日本語）：`Jeffrey Zhou`

## Language

- English summary: Browser-based piano fingering generation with Dyna-Q, ensemble variance analysis, and local dynamic-programming refinement.
- 中文摘要：基于浏览器端 Dyna-Q 强化学习、多 Worker 集成方差与局部动态规划精修的钢琴指法生成系统。
- 日本語要約：ブラウザ上で動作する Dyna-Q 学習、アンサンブル分散解析、局所動的計画精修を備えたピアノ運指生成システムです。

## 当前版本概览

- 前端框架：`Next.js 14` + `TypeScript` + `Tailwind CSS`
- 运行方式：核心计算全部在浏览器中完成，无需后端服务
- 训练方式：`Dyna-Q` + 优先级回放 + 多 Worker 并行训练
- 质量增强：基于 Q 表方差的风险检测 + 局部 `Viterbi` 动态规划精修
- 输入格式：`.musicxml` 与 `.mxl`
- 输出格式：带 `<fingering>` 标注的 `.musicxml`
- 缓存机制：`IndexedDB`
- 调试入口：本地开发地址 `http://localhost:3000`

## 历次改造文档

建议按以下顺序阅读，以了解本项目从 Julia 后端版到前端 Web 版、再到局部质量增强版的完整演进：

1. `原项目程序原理教学文档.md`
2. `项目改造方案3-Web前端化.md`
3. `项目改造方案4-Web前端化.md`
4. `局部指法质量增强改造方案01.md`

## 本次改造重点

### 1. 局部指法质量增强

- 新增 `frontend/src/lib/algorithm/localDPRefine.ts`
- 对多 Worker 训练后的 Q 表同时计算均值与方差
- 用方差 + 归一化奖励定位低置信度风险点
- 在局部窗口内运行带边界代价的 `Viterbi` 动态规划
- 采用“三层防御”筛选替换候选：
  - 超级收益豁免
  - 常规保守通道
  - 高风险高回报通道
- 使用“批量预计算 + 贪心无冲突替换”规避顺序依赖 Bug

### 2. 主流程接入

- `frontend/src/lib/algorithm/process.ts` 已接入：
  - Q 表集成分析
  - 初始策略提取
  - 局部 DP 精修
- 单线程 fallback 路径也会执行局部精修，不只限于多 Worker 模式

### 3. 稳定性修正

- 修复单手谱在 Worker 中被误判为无效的问题
- 修复 MusicXML 写回阶段原地修改指法数组的隐患
- 写回器增加 Node 环境下的 XML DOM fallback，便于自动化测试脚本复用

## 核心目录结构

```text
.
├── CompositionExamples/                 # 示例乐曲
├── frontend/                            # Vercel Root Directory
│   ├── src/
│   │   ├── app/                         # 页面入口
│   │   ├── components/                  # UI 组件
│   │   ├── lib/
│   │   │   ├── algorithm/
│   │   │   │   ├── dynaQ.ts
│   │   │   │   ├── localDPRefine.ts
│   │   │   │   ├── policy.ts
│   │   │   │   ├── process.ts
│   │   │   │   └── ...
│   │   │   ├── music/
│   │   │   ├── cache/
│   │   │   └── i18n.ts
│   │   └── workers/
│   │       ├── dynaQ.worker.ts
│   │       └── fingering.worker.ts
│   ├── scripts/
│   │   └── batch-e2e.mjs               # 6 首曲子自动化浏览器回归脚本（每首独立 browser context）
│   ├── next.config.mjs
│   ├── package.json
│   └── vercel.json
├── src.jl-backend/                      # Julia 原始参考实现
└── README.md
```

## 算法流程

```text
上传 MusicXML / MXL
        ↓
MusicXML 解析与左右手拆分
        ↓
主 Worker -> 分段处理
        ↓
Dyna-Q Worker 并行训练（1 / 2 / 4 个）
        ↓
Q 表均值 + 方差分析
        ↓
提取初始策略
        ↓
局部动态规划精修（Viterbi）
        ↓
回写 fingering 到 MusicXML
        ↓
下载结果文件
```

## 本地开发

### 环境要求

- `Node.js 20+`
- `npm 10+`
- Chrome 或 Microsoft Edge（用于自动化浏览器回归脚本）

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
cd frontend
npm run dev
```

打开：

```text
http://localhost:3000
```

## 自动化测试

### 1. 代码检查

```bash
cd frontend
npm run lint
npm run build
```

### 2. 浏览器端批量回归

先保持本地开发服务器运行，再另开终端执行：

```bash
cd frontend
npm run test:batch
```

默认会自动测试 `CompositionExamples` 中的 6 首代表乐曲：

1. `simple_test.musicxml`
2. `S1_Bach_G_Major.musicxml`
3. `S6_no_5.musicxml`
4. `Waltz.musicxml`
5. `S8_wedding.musicxml`
6. `S9_turkish_march.musicxml`

### 2.1 最近一次本地回归结果

最近一次人工复核后的自动化回归已覆盖上述 6 首乐曲，结果如下：

- `simple_test.musicxml`：通过，约 `2.5s`，`8` 个 `<fingering>`
- `S1_Bach_G_Major.musicxml`：通过，约 `4.8s`，`125` 个 `<fingering>`
- `S6_no_5.musicxml`：通过，约 `10.6s`，`262` 个 `<fingering>`
- `Waltz.musicxml`：通过，约 `25s` 量级，`212` 个 `<fingering>`
- `S8_wedding.musicxml`：通过，约 `25.8s`，`257` 个 `<fingering>`
- `S9_turkish_march.musicxml`：通过，约 `18.1s`，`259` 个 `<fingering>`

对应报告位于：

- `frontend/test-results/batch-first4-rerun/`
- `frontend/test-results/batch-warning-check/`

验证结论：

- 6 首乐曲均成功生成并下载带指法标注的 MusicXML
- `consoleErrors` 与 `pageErrors` 均为 `0`
- 指法默认 fallback 告警已改为按和弦规模去重，避免控制台被重复警告淹没
- `npm run lint` 与 `npm run build` 均通过

### 3. 自动化回归输出

脚本执行完成后会生成：

- `frontend/test-results/batch-e2e/summary.json`
- `frontend/test-results/batch-e2e/summary.md`
- `frontend/test-results/batch-e2e/downloads/`

其中会记录：

- 每首曲子的处理时长
- 下载文件路径
- `<fingering>` 标注数量
- 浏览器控制台错误 / 警告
- 页面运行时错误

说明：

- 当前脚本会为每首乐曲创建独立浏览器上下文，避免前一首曲目的 Worker、下载状态或页面内存影响下一首
- 如果你只想复测单首，可使用环境变量 `TEST_FILES` 指定文件名，例如 `S8_wedding.musicxml`

## 手动调试建议

### 本地调试链接

- `http://localhost:3000`

### 推荐检查项

1. 打开浏览器控制台
2. 上传 `.musicxml` 或 `.mxl`
3. 观察 Dyna-Q 训练日志与精修日志
4. 下载结果文件
5. 用 MuseScore / Finale / Sibelius 复核指法标注

### 清除缓存

页面内置了“清除缓存（调试用）”按钮，也可以在控制台执行：

```javascript
indexedDB.deleteDatabase('PianoFingeringDB')
```

## 部署说明

### Vercel

本项目已经按“`frontend` 作为 Root Directory”整理。

Vercel 推荐配置如下：

- Framework Preset：`Next.js`
- Root Directory：`frontend`
- Build Command：保持默认
- Output Directory：保持默认

注意事项：

- `vercel.json` 位于 `frontend/vercel.json`
- `frontend/vercel.json` 当前保持最小配置，仅包含 `{"framework":"nextjs"}`，与 `frontend` Root Directory 配套
- 不要在 Vercel 控制台里手写 `cd frontend && ...`
- 当前 `frontend/vercel.json` 采用最小必要配置，避免因多余策略导致部署或资源加载问题

### GitHub

- `.github/workflows/deploy.yml` 当前用于构建校验，不会真的自动部署
- CI 使用 `frontend/package-lock.json` 作为缓存依赖定位，构建入口也是 `frontend`
- 推送前建议至少执行一次：

```bash
cd frontend
npm run lint
npm run build
```

## 关键文件说明

- `frontend/src/lib/algorithm/dynaQ.ts`
  - TypeScript 版 Dyna-Q 求解器
- `frontend/src/lib/algorithm/localDPRefine.ts`
  - 集成方差分析与局部动态规划精修
- `frontend/src/lib/algorithm/process.ts`
  - 分段处理、并行训练、策略提取与精修接线
- `frontend/src/workers/dynaQ.worker.ts`
  - 单个训练 Worker
- `frontend/src/workers/fingering.worker.ts`
  - 文件处理与主流程 Worker
- `frontend/src/lib/music/parser.ts`
  - MusicXML 解析
- `frontend/src/lib/music/writer.ts`
  - 指法回写

## 已知边界

- 超长复杂乐谱的首次处理仍可能耗时较长
- 指法质量虽已增强，但仍建议对高难度片段做人工复核
- 浏览器端计算受设备 CPU、内存、线程数影响较大

## 致谢

- 原始研究项目：`PianoFingering.jl`
- 相关技术栈：`Next.js`、`TypeScript`、`xml2js`、`jszip`、`idb`

## License

本仓库沿用根目录 `LICENSE`。
