import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendDir, '..');
const runName = process.env.TEST_RUN_NAME || 'batch-e2e';
const outputDir = path.join(frontendDir, 'test-results', runName);
const downloadDir = path.join(outputDir, 'downloads');
const summaryPath = path.join(outputDir, 'summary.json');
const reportPath = path.join(outputDir, 'summary.md');
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 600000);

const browserCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

const allTestFiles = [
  'simple_test.musicxml',
  'S1_Bach_G_Major.musicxml',
  'S6_no_5.musicxml',
  'Waltz.musicxml',
  'S8_wedding.musicxml',
  'S9_turkish_march.musicxml'
].map(fileName => ({
  fileName,
  filePath: path.join(projectRoot, 'CompositionExamples', fileName)
}));

const selectedFileNames = process.env.TEST_FILES
  ? process.env.TEST_FILES.split(',').map(name => name.trim()).filter(Boolean)
  : null;

const testFiles = selectedFileNames
  ? allTestFiles.filter(file => selectedFileNames.includes(file.fileName))
  : allTestFiles;

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function resolveBrowserExecutable() {
  for (const candidate of browserCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue searching.
    }
  }

  throw new Error('No supported Chromium-based browser was found. Install Chrome or Microsoft Edge first.');
}

async function clearCache(page) {
  await page.evaluate(async () => {
    localStorage.removeItem('piano-fingering-lang');
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('PianoFingeringDB');
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error('Failed to delete IndexedDB cache'));
      request.onblocked = () => resolve(true);
    });
  });
}

function createLogBucket(fileName) {
  return {
    fileName,
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    consoleInfo: []
  };
}

function countFingerings(xmlContent) {
  const matches = xmlContent.match(/<fingering>/g);
  return matches ? matches.length : 0;
}

async function writeReport(summary) {
  const lines = [
    '# Batch E2E Summary',
    '',
    `- Base URL: ${summary.baseUrl}`,
    `- Browser: ${summary.browser}`,
    `- Total files: ${summary.results.length}`,
    `- Generated at: ${summary.generatedAt}`,
    ''
  ];

  for (const result of summary.results) {
    lines.push(`## ${result.fileName}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- DurationMs: ${result.durationMs}`);
    lines.push(`- DownloadedFile: ${result.downloadedFile || 'N/A'}`);
    lines.push(`- FingeringCount: ${result.fingeringCount ?? 'N/A'}`);
    lines.push(`- ConsoleErrors: ${result.consoleErrors.length}`);
    lines.push(`- PageErrors: ${result.pageErrors.length}`);
    lines.push(`- ConsoleWarnings: ${result.consoleWarnings.length}`);
    if (result.failureReason) {
      lines.push(`- FailureReason: ${result.failureReason}`);
    }
    lines.push('');
  }

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
}

async function run() {
  await ensureDir(downloadDir);
  const executablePath = await resolveBrowserExecutable();
  const summary = {
    baseUrl,
    browser: executablePath,
    generatedAt: new Date().toISOString(),
    results: []
  };

  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  try {
    for (const testFile of testFiles) {
      const bucket = createLogBucket(testFile.fileName);
      const startTime = Date.now();
      const context = await browser.newContext({
        acceptDownloads: true
      });
      const page = await context.newPage();

      const consoleHandler = message => {
        const text = message.text();
        if (message.type() === 'error') {
          bucket.consoleErrors.push(text);
        } else if (message.type() === 'warning') {
          bucket.consoleWarnings.push(text);
        } else {
          bucket.consoleInfo.push(text);
        }
      };
      const pageErrorHandler = error => {
        bucket.pageErrors.push(error.message);
      };

      page.on('console', consoleHandler);
      page.on('pageerror', pageErrorHandler);

      try {
        console.log(`\n=== Testing ${testFile.fileName} ===`);
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: timeoutMs });
        await clearCache(page);
        await page.reload({ waitUntil: 'networkidle', timeout: timeoutMs });

        await page.setInputFiles('#file-upload', testFile.filePath);

        const successLocator = page.getByText(/Fingering Generated!|指法生成完成！|運指生成完了！/);
        const errorSelector = '.bg-red-50';

        const completion = successLocator.waitFor({ timeout: timeoutMs }).then(() => 'complete');
        const failure = page.waitForSelector(errorSelector, { timeout: timeoutMs }).then(() => 'error');
        const state = await Promise.race([completion, failure]);

        if (state === 'error') {
          const errorText = await page.locator(errorSelector).textContent();
          throw new Error(errorText?.trim() || 'Unknown page error');
        }

        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
        await page.getByRole('button', {
          name: /Download MusicXML File|下载 MusicXML 文件|MusicXML ファイルをダウンロード/
        }).click();
        const download = await downloadPromise;
        const suggestedName = download.suggestedFilename();
        const downloadPath = path.join(downloadDir, suggestedName);
        await download.saveAs(downloadPath);

        const xmlContent = await fs.readFile(downloadPath, 'utf8');
        const fingeringCount = countFingerings(xmlContent);
        if (fingeringCount === 0) {
          throw new Error('Downloaded MusicXML does not contain any fingering annotations');
        }

        summary.results.push({
          fileName: testFile.fileName,
          status: bucket.consoleErrors.length > 0 || bucket.pageErrors.length > 0 ? 'warning' : 'passed',
          durationMs: Date.now() - startTime,
          downloadedFile: downloadPath,
          fingeringCount,
          consoleErrors: bucket.consoleErrors,
          consoleWarnings: bucket.consoleWarnings,
          pageErrors: bucket.pageErrors
        });

      } catch (error) {
        summary.results.push({
          fileName: testFile.fileName,
          status: 'failed',
          durationMs: Date.now() - startTime,
          downloadedFile: null,
          fingeringCount: null,
          consoleErrors: bucket.consoleErrors,
          consoleWarnings: bucket.consoleWarnings,
          pageErrors: bucket.pageErrors,
          failureReason: error instanceof Error ? error.message : String(error)
        });
      } finally {
        page.off('console', consoleHandler);
        page.off('pageerror', pageErrorHandler);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  await writeReport(summary);

  const failed = summary.results.filter(result => result.status === 'failed');
  const warned = summary.results.filter(result => result.status === 'warning');
  const passed = summary.results.filter(result => result.status === 'passed');

  console.log('\n=== Batch E2E Summary ===');
  console.log(`Results saved to: ${summaryPath}`);
  console.log(`Markdown report: ${reportPath}`);
  console.log(`Passed/Warning/Failed: ${passed.length}/${warned.length}/${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
