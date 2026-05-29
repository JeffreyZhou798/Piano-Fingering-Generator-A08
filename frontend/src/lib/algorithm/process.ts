// 主处理逻辑 - 翻译自 src/process.jl
import { Note, Hand, Fingering, Part, FingeringResult, FingeringResultEntry, ProgressCallback, WorkerConfig } from './types';
import { DynaQSolver } from './dynaQ';
import { analyzeEnsemble, localDPRefineSync } from './localDPRefine';
import { extractPolicyFromQTable } from './policy';

/**
 * 检测设备并返回Worker数量
 */
function getWorkerCount(): number {
  // 检测是否为移动设备
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // 获取CPU核心数
  const cores = navigator.hardwareConcurrency || 4;
  
  // 移动设备统一使用单线程
  if (isMobile) return 1;
  
  // 根据核心数决定Worker数量
  if (cores >= 8) return 4;  // 高端PC
  if (cores >= 4) return 2;  // 中端PC
  return 1;  // 低端PC
}

/**
 * 创建Worker配置
 */
function createWorkerConfigs(workerCount: number): WorkerConfig[] {
  const episodesPerWorker = Math.floor(10000 / workerCount); // 总共10000轮
  
  return Array.from({ length: workerCount }, (_, i) => ({
    seed: Date.now() + i * 1000,
    episodes: episodesPerWorker,
    planningSteps: 10,
    learningRate: 0.99,
    explorationRate: 0.8
  }));
}

/**
 * 并行训练（使用Web Workers）
 */
async function parallelTrain(
  notes: Note[][],
  hand: Hand,
  part: Part,
  progressCallback?: ProgressCallback
): Promise<Fingering[]> {
  // 检测Worker数量
  const workerCount = getWorkerCount();
  console.log(`Using ${workerCount} worker(s) for parallel training`);

  // 如果只有1个Worker，直接使用单线程
  if (workerCount === 1) {
    const solver = new DynaQSolver({
      nEpisodes: 10000, // 与原Julia实现一致
      maxEpisodeLength: 100,
      learningRate: 0.99,
      explorationRate: 0.8,
      planningSteps: 10,
      randomSeed: Date.now()
    });

    const initialPolicy = solver.solve(hand, notes, part, (episode, total) => {
      if (progressCallback) {
        progressCallback((episode / total) * 100);
      }
    });

    const { policy, stats } = localDPRefineSync(notes, hand, part, initialPolicy, new Map());
    console.log('Local refinement stats (single-thread):', stats);
    return policy;
  }

  // 多Worker并行训练
  const workerConfigs = createWorkerConfigs(workerCount);
  
  // 创建Workers
  const workerPromises = workerConfigs.map((config, index) => {
    return new Promise<Map<string, number>>((resolve, reject) => {
      let worker: Worker | null = null;
      let useFallback = false;

      try {
        // 尝试创建真正的Web Worker
        worker = new Worker(
          new URL('../../workers/dynaQ.worker.ts', import.meta.url),
          { type: 'module' }
        );

        console.log(`Worker ${index + 1}/${workerCount} created successfully`);

        // 设置消息监听
        worker.onmessage = (e: MessageEvent) => {
          const { type, qTable, error, progress } = e.data;

          if (type === 'complete') {
            console.log(`Worker ${index + 1} completed training`);
            if (worker) worker.terminate();
            
            // 将数组转换回Map
            const qTableMap = new Map<string, number>(qTable || []);
            resolve(qTableMap);
            
          } else if (type === 'error') {
            console.error(`Worker ${index + 1} error:`, error);
            if (worker) worker.terminate();
            reject(new Error(error));
            
          } else if (type === 'progress' && progressCallback) {
            // 计算总体进度
            const overallProgress = ((index + (progress || 0) / 100) / workerCount) * 100;
            progressCallback(overallProgress);
          }
        };

        // 设置错误监听
        worker.onerror = (err: ErrorEvent) => {
          console.error(`Worker ${index + 1} error event:`, err.message);
          if (worker) worker.terminate();
          reject(new Error(err.message));
        };

        // 发送训练任务
        worker.postMessage({
          type: 'train',
          notes,
          hand,
          part,
          config
        });

      } catch (err) {
        // Worker创建失败，使用单线程fallback
        console.warn(`Worker ${index + 1} creation failed, using single-threaded fallback:`, err);
        useFallback = true;
      }

      // 单线程fallback
      if (useFallback) {
        const solver = new DynaQSolver({
          nEpisodes: config.episodes,
          maxEpisodeLength: 100,
          learningRate: config.learningRate,
          explorationRate: config.explorationRate,
          planningSteps: config.planningSteps,
          randomSeed: config.seed
        });

        try {
          solver.solve(hand, notes, part, (episode, total) => {
            if (progressCallback) {
              const overallProgress = ((index + episode / total) / workerCount) * 100;
              progressCallback(overallProgress);
            }
          });

          const qTable = solver.getQTable();
          resolve(qTable);
        } catch (error) {
          reject(error);
        }
      }
    });
  });

  // 等待所有Workers完成
  const qTables = await Promise.all(workerPromises);

  // 合并Q表并计算方差
  console.log(`Merging ${qTables.length} Q-tables and calculating ensemble variance...`);
  const { avgQTable, varianceQTable } = analyzeEnsemble(qTables);

  // 提取初始策略
  const initialPolicy = extractPolicyFromQTable(avgQTable, hand, notes, part);

  // 同步执行局部动态规划精修
  const { policy, stats } = localDPRefineSync(notes, hand, part, initialPolicy, varianceQTable);
  console.log('Local refinement stats:', stats);

  return policy;
}

/**
 * 分段范围计算
 */
function splitedRange(notes: Note[][], hand: Hand): number[][] {
  const ranges: number[][] = [];
  let start = 0;
  const maxSegmentSize = 50; // 每段最多50个音符组

  while (start < notes.length) {
    const end = Math.min(start + maxSegmentSize, notes.length);
    ranges.push([start, end]);
    start = end;
  }

  return ranges;
}

/**
 * 带进度追踪的分段处理
 */
function runSplitWithProgress(
  notes: Note[][],
  hand: Hand,
  readRange: number[][],
  totalSegments: number,
  completedSegments: { value: number },
  progressCallback?: ProgressCallback
): Promise<Fingering[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const resultFingering: Fingering[] = new Array(notes.length);

      for (let index = 0; index < readRange.length; index++) {
        const [start, end] = readRange[index];
        const rangeLen = readRange.length;

        // 确定部分类型
        let part: Part;
        if (rangeLen === 1) {
          part = Part.WholePart;
        } else if (index === 0) {
          part = Part.FirstPart;
        } else if (index === rangeLen - 1) {
          part = Part.LastPart;
        } else {
          part = Part.MiddlePart;
        }

        // 使用并行训练
        const segmentNotes = notes.slice(start, end);
        const policy = await parallelTrain(segmentNotes, hand, part, (segmentProgress) => {
          // 计算总体进度
          const baseProgress = (completedSegments.value / totalSegments) * 100;
          const segmentWeight = (1 / totalSegments) * 100;
          const totalProgress = baseProgress + (segmentProgress / 100) * segmentWeight;
          
          if (progressCallback) {
            progressCallback(totalProgress);
          }
        });

        // 保存结果
        for (let i = 0; i < policy.length; i++) {
          resultFingering[start + i] = policy[i];
        }

        console.log(`Completed: part ${index + 1}/${rangeLen}, length ${segmentNotes.length}`);

        // 更新进度
        completedSegments.value += 1;
        const progressPct = (completedSegments.value / totalSegments) * 100;

        if (progressCallback) {
          try {
            progressCallback(progressPct);
          } catch (e) {
            console.warn('Progress callback failed:', e);
          }
        }
      }

      console.log('runSplitWithProgress result:', {
        isArray: Array.isArray(resultFingering),
        length: resultFingering.length,
        firstItem: resultFingering[0],
        lastItem: resultFingering[resultFingering.length - 1]
      });

      resolve(resultFingering);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 主指法生成函数
 */
export async function generateFingering(
  notesRh: Note[][],
  notesLh: Note[][],
  progressCallback?: ProgressCallback
): Promise<FingeringResult> {
  console.log('generateFingering called with:', {
    rhLength: notesRh.length,
    lhLength: notesLh.length
  });

  // 处理空手的情况
  if (notesRh.length === 0 && notesLh.length === 0) {
    console.warn('Both hands are empty!');
    return { rightHand: [], leftHand: [] };
  }

  // 计算总分段数
  const readRangeRh = notesRh.length > 0 ? splitedRange(notesRh, Hand.RightHand) : [];
  const readRangeLh = notesLh.length > 0 ? splitedRange(notesLh, Hand.LeftHand) : [];
  const totalSegments = readRangeRh.length + readRangeLh.length;
  const completedSegments = { value: 0 };

  let rhResult: Fingering[] = [];
  let lhResult: Fingering[] = [];

  if (notesRh.length > 0) {
    console.log('Right hand processing started...');
    rhResult = await runSplitWithProgress(
      notesRh,
      Hand.RightHand,
      readRangeRh,
      totalSegments,
      completedSegments,
      progressCallback
    );
  } else {
    console.log('Right hand is empty, skipping...');
  }

  if (notesLh.length > 0) {
    console.log('Left hand processing started...');
    lhResult = await runSplitWithProgress(
      notesLh,
      Hand.LeftHand,
      readRangeLh,
      totalSegments,
      completedSegments,
      progressCallback
    );
  } else {
    console.log('Left hand is empty, skipping...');
  }

  // 转换为输出格式
  const result = {
    rightHand: rhResult.length > 0 ? convertToFingeringEntries(rhResult) : [],
    leftHand: lhResult.length > 0 ? convertToFingeringEntries(lhResult) : []
  };

  console.log('generateFingering result:', {
    rhCount: result.rightHand.length,
    lhCount: result.leftHand.length
  });

  return result;
}

/**
 * 转换为指法条目格式
 */
function convertToFingeringEntries(
  fingerings: Fingering[]
): FingeringResultEntry[] {
  console.log('convertToFingeringEntries called with:', {
    isArray: Array.isArray(fingerings),
    length: fingerings?.length,
    type: typeof fingerings
  });

  if (!Array.isArray(fingerings)) {
    console.error('fingerings is not an array!', fingerings);
    throw new Error(`fingerings must be an array, got ${typeof fingerings}`);
  }

  const entries: FingeringResultEntry[] = [];
  let globalPosition = 0;

  for (let i = 0; i < fingerings.length; i++) {
    const fingering = fingerings[i];
    
    console.log(`Processing fingering ${i}:`, {
      isArray: Array.isArray(fingering),
      length: fingering?.length,
      type: typeof fingering,
      content: fingering
    });

    // 防御性检查：确保fingering是数组
    if (!Array.isArray(fingering)) {
      console.error(`Invalid fingering at index ${i} (not an array):`, fingering);
      continue;
    }

    // 按pitch排序，确保顺序正确
    const sortedFingering = [...fingering].sort((a, b) => a.pitch - b.pitch);

    for (let j = 0; j < sortedFingering.length; j++) {
      const entry = sortedFingering[j];
      
      // 防御性检查：确保entry有必需的属性
      if (!entry || typeof entry.pitch !== 'number' || typeof entry.finger !== 'number') {
        console.error(`Invalid fingering entry at [${i}][${j}]:`, entry);
        continue;
      }

      entries.push({
        pitch: entry.pitch,
        finger: entry.finger,
        position: globalPosition
      });
      globalPosition++;
    }
  }

  console.log('convertToFingeringEntries result:', {
    entriesCount: entries.length,
    firstFew: entries.slice(0, 5),
    lastFew: entries.slice(-5)
  });

  return entries;
}
