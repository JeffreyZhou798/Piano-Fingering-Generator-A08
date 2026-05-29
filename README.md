# 🎹 Piano Fingering Generator Web Application – Enhanced Edition 4.0

A web-based piano fingering generation system powered by **complete Dyna-Q reinforcement learning algorithm**. Upload MusicXML files and get AI-generated fingering suggestions - **runs entirely in your browser!**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#中文) | [日本語](#日本語)

---

## 🎵 Live Demo

**Try It Now**: 
[https://piano-fingering-generator-a08.vercel.app/](https://piano-fingering-generator-a08.vercel.app/) 
[https://hawkyijdd-pianofingering08-51bwv014b.maozi.io/](https://hawkyijdd-pianofingering08-51bwv014b.maozi.io/)

---

- Live Demo: `https://piano-fingering-generator-a08.vercel.app/` `https://hawkyijdd-pianofingering08-51bwv014b.maozi.io/`
- Repository: `https://github.com/JeffreyZhou798/Piano-Fingering-Generator-A08`
- Author: `Jeffrey Zhou`

---

## English

### Overview

Piano Fingering Generator is a browser-based application that analyzes piano scores and generates fingering annotations automatically. Users can upload a `MusicXML` or `MXL` score, let the system compute fingerings entirely on the client side, and download a new `MusicXML` file containing `<fingering>` annotations.

The app is designed for piano learners, teachers, researchers, and developers who want a practical fingering-generation tool without installing a backend service. All major computation runs in the browser, which keeps usage simple and helps protect uploaded musical data.

### Highlights

- Browser-first workflow with no required backend service
- Automatic fingering generation for piano scores in `MusicXML` and `MXL`
- Downloadable annotated `MusicXML` output with embedded fingering marks
- Multi-language experience for English, Chinese, and Japanese users
- IndexedDB caching for faster repeated processing on the same device
- Suitable for practice support, score review, and music education scenarios

### Technology Highlights

- `Dyna-Q` reinforcement learning drives the core fingering policy search
- Parallel `Web Workers` adapt to `4-core / 2-core / 1-core` devices automatically
- Dual-layer progressive `Web Workers` strategy improves robustness across different browser and runtime conditions
- Confidence-Guided Local Dynamic Programming Refinement improves uncertain local passages after the initial policy is generated
- Ensemble mean and variance analysis identifies low-confidence segments from multiple worker outputs
- Local `Viterbi` dynamic programming refines short windows with boundary-aware scoring
- Hamming-distance based path comparison controls excessive local replacement
- Three-layer defensive replacement strategy balances stability and improvement

### Pipeline Architecture

```text
Input MusicXML / MXL
        |
        v
Score parsing and hand separation
        |
        v
Main processing worker
        |
        v
Adaptive parallel Dyna-Q training
(4 workers / 2 workers / 1 worker)
        |
        v
Ensemble Q-table aggregation
(mean + variance)
        |
        v
Initial fingering policy extraction
        |
        v
Confidence-Guided Local Dynamic
Programming Refinement
        |
        v
Boundary-aware Viterbi optimization
for risky local windows
        |
        v
Three-layer defensive replacement
        |
        v
Write fingering annotations back to MusicXML
        |
        v
Download annotated score
```

### How To Use

1. Open the live app.
2. Upload a `MusicXML` or `MXL` piano score.
3. Wait for parsing, training, and local refinement to complete.
4. Review the result summary on the page.
5. Download the generated `MusicXML` file with fingering annotations.

### Input And Output

- Input: `MusicXML (.musicxml)` and compressed `MXL (.mxl)`
- Output: annotated `MusicXML` with embedded `<fingering>` tags

### Local Development

#### Requirements

- `Node.js 20+`
- `npm 10+`

#### Install

```bash
cd frontend
npm install
```

#### Run

```bash
cd frontend
npm run dev
```

Default local address:

```text
http://localhost:3000
```

If you want to use a custom port:

```bash
cd frontend
npx next dev -p 3001
```

### Deployment

This project can be deployed on `Vercel` as a standard `Next.js` application.

### Notes

- Very large or highly complex scores may take longer on their first run
- Processing speed depends on CPU performance, memory, and available browser threads
- The generated fingering is designed to be useful and practical, but difficult passages should still be reviewed by musicians or teachers

---

## 中文

### 项目简介

Piano Fingering Generator 是一个运行在浏览器中的钢琴指法自动生成应用。用户上传 `MusicXML` 或 `MXL` 乐谱后，系统会在本地浏览器内完成解析、训练、局部精修与指法写回，并生成带有 `<fingering>` 标注的新 `MusicXML` 文件供下载。

本项目适合钢琴学习者、教师、音乐教育研究者以及对自动指法生成感兴趣的开发者使用。核心计算在浏览器端完成，不需要额外部署后端服务，使用门槛低，也更利于保护用户上传的乐谱数据。

### 功能亮点

- 支持 `MusicXML` 与 `MXL` 钢琴乐谱上传
- 自动生成钢琴左右手指法
- 输出可下载、可继续编辑的带指法 `MusicXML`
- 支持英文、中文、日文界面
- 采用本地 `IndexedDB` 缓存，重复处理更快
- 适用于练习辅助、教学参考、乐谱复核等场景

### 技术亮点

- 以 `Dyna-Q` 强化学习作为核心指法策略搜索算法
- 使用并行 `Web Workers`，可根据设备自动适配 `4核 / 2核 / 1核`
- 采用双层渐进式 `Web Workers` 策略，提高不同浏览器与运行环境下的可用性
- 使用“基于置信度引导的局部动态规划精修算法”对高风险片段进行二次优化
- 通过多 Worker 输出的 Q 表均值与方差分析定位低置信度片段
- 在局部窗口内使用带边界约束的 `Viterbi` 动态规划进行精修
- 通过基于汉明距离的路径差异控制避免过度替换
- 通过三层防御替换策略在稳定性与收益之间取得平衡

### 整体 Pipeline 架构图

```text
输入 MusicXML / MXL
        |
        v
乐谱解析与左右手拆分
        |
        v
主处理 Worker
        |
        v
自适应并行 Dyna-Q 训练
（4 Worker / 2 Worker / 1 Worker）
        |
        v
集成 Q 表分析
（均值 + 方差）
        |
        v
提取初始指法策略
        |
        v
基于置信度引导的局部动态规划精修
        |
        v
对高风险窗口执行带边界代价的
Viterbi 局部优化
        |
        v
三层防御替换策略
        |
        v
将指法写回 MusicXML
        |
        v
下载带指法标注的乐谱
```

### 使用方式

1. 打开在线试用链接。
2. 上传 `MusicXML` 或 `MXL` 钢琴乐谱。
3. 等待系统完成解析、训练与局部精修。
4. 在页面查看结果统计信息。
5. 下载带指法标注的 `MusicXML` 文件。

### 输入与输出

- 输入格式：`MusicXML (.musicxml)`、`MXL (.mxl)`
- 输出格式：带 `<fingering>` 标注的 `MusicXML`

### 本地运行

#### 环境要求

- `Node.js 20+`
- `npm 10+`

#### 安装依赖

```bash
cd frontend
npm install
```

#### 启动开发服务

```bash
cd frontend
npm run dev
```

默认本地地址：

```text
http://localhost:3000
```

如需指定端口：

```bash
cd frontend
npx next dev -p 3001
```

### 部署说明

本项目可以作为标准 `Next.js` 应用部署到 `Vercel`。

### 使用说明

- 首次处理超长或高复杂度乐谱时，耗时可能更长
- 处理速度与设备 CPU、内存、浏览器线程数有关
- 自动生成的指法可作为高质量参考，但高难度片段仍建议教师或演奏者人工复核

---

## 日本語

### 概要

Piano Fingering Generator は、ブラウザ上で動作するピアノ運指自動生成アプリです。`MusicXML` または `MXL` の楽譜をアップロードすると、解析、学習、局所精修、運指の書き戻しまでをブラウザ内で実行し、`<fingering>` 注釈付きの新しい `MusicXML` をダウンロードできます。

このアプリは、ピアノ学習者、教師、音楽教育研究者、そして自動運指生成に関心のある開発者に適しています。主要な計算はブラウザ側で完結するため、追加のバックエンドを必要とせず、使いやすく、アップロードした楽譜データの保護にも役立ちます。

### 主な特徴

- `MusicXML` と `MXL` のピアノ譜面に対応
- 左手・右手の運指を自動生成
- `<fingering>` 注釈付き `MusicXML` をダウンロード可能
- 英語、中国語、日本語の多言語対応
- `IndexedDB` キャッシュにより同一端末での再処理を高速化
- 練習支援、授業補助、譜面確認などに活用可能

### 技術ハイライト

- 中核アルゴリズムとして `Dyna-Q` 強化学習を採用
- 並列 `Web Workers` がデバイスに応じて `4コア / 2コア / 1コア` に自動適応
- 二層の段階的 `Web Workers` 戦略により、さまざまなブラウザ環境での安定性を向上
- 「信頼度誘導型局所動的計画精修アルゴリズム」により、不確実な局所区間を追加最適化
- 複数 Worker の Q テーブル平均値と分散を用いて低信頼度区間を検出
- 局所ウィンドウでは境界条件を考慮した `Viterbi` 動的計画法で最適化
- ハミング距離に基づく経路差分評価で過度な置換を抑制
- 三層防御の置換戦略で安定性と改善効果を両立

### 全体 Pipeline アーキテクチャ

```text
MusicXML / MXL を入力
        |
        v
譜面解析と左右手の分離
        |
        v
メイン処理 Worker
        |
        v
適応型並列 Dyna-Q 学習
（4 Worker / 2 Worker / 1 Worker）
        |
        v
アンサンブル Q テーブル解析
（平均 + 分散）
        |
        v
初期運指方策の抽出
        |
        v
信頼度誘導型局所動的計画精修
        |
        v
高リスク局所区間に対する
境界考慮型 Viterbi 最適化
        |
        v
三層防御の置換戦略
        |
        v
MusicXML へ運指を書き戻し
        |
        v
運指付き譜面をダウンロード
```

### 使い方

1. オンライン試用リンクを開きます。
2. `MusicXML` または `MXL` のピアノ譜面をアップロードします。
3. 解析、学習、局所精修の完了を待ちます。
4. ページ上で結果の概要を確認します。
5. 運指付き `MusicXML` をダウンロードします。

### 入出力

- 入力形式: `MusicXML (.musicxml)`、`MXL (.mxl)`
- 出力形式: `<fingering>` 注釈付き `MusicXML`

### ローカル実行

#### 必要環境

- `Node.js 20+`
- `npm 10+`

#### 依存関係のインストール

```bash
cd frontend
npm install
```

#### 開発サーバー起動

```bash
cd frontend
npm run dev
```

既定のローカル URL:

```text
http://localhost:3000
```

ポートを指定する場合:

```bash
cd frontend
npx next dev -p 3001
```

### デプロイ

このプロジェクトは標準的な `Next.js` アプリとして `Vercel` にデプロイできます。

### 注意事項

- 長大または複雑な譜面は初回処理に時間がかかる場合があります
- 処理速度は CPU、メモリ、ブラウザの利用可能スレッド数に依存します
- 自動生成された運指は実用的な参考情報ですが、難所は演奏者や指導者による確認を推奨します

## License

MIT License - See [LICENSE](../LICENSE) for details.

---



## ⚠️ Copyright Notice

© 2026 Jeffrey Zhou. All rights reserved.

This repository and its contents are protected by copyright law.  
No part of this project may be copied, reproduced, modified, or distributed without prior written permission from the author.

Commercial use is strictly prohibited.


*Built with ❤️ for music education*
