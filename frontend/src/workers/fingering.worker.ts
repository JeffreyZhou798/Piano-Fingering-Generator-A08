// Web Worker for fingering generation
import { parseMusicXML, validateNotes } from '../lib/music/parser';
import { generateFingering } from '../lib/algorithm/process';
import { FingeringResult } from '../lib/algorithm/types';

export interface WorkerRequest {
  type: 'generate';
  xmlContent: string;
  fileName: string;
}

export interface WorkerResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  result?: FingeringResult;
  error?: string;
}

// Worker消息处理
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, xmlContent, fileName } = event.data;

  if (type === 'generate') {
    try {
      // 解析MusicXML
      postMessage({ type: 'progress', progress: 10 } as WorkerResponse);
      
      const { rightHand, leftHand } = await parseMusicXML(xmlContent);

      console.log('Parsed notes:', {
        rightHandGroups: rightHand.length,
        leftHandGroups: leftHand.length,
        rightHandTotal: rightHand.reduce((sum, group) => sum + group.length, 0),
        leftHandTotal: leftHand.reduce((sum, group) => sum + group.length, 0)
      });

      // 验证音符；允许单手为空，由主流程自行跳过
      const rightHandValid = rightHand.length === 0 || validateNotes(rightHand);
      const leftHandValid = leftHand.length === 0 || validateNotes(leftHand);
      if (!rightHandValid || !leftHandValid) {
        throw new Error('Invalid notes data');
      }

      postMessage({ type: 'progress', progress: 20 } as WorkerResponse);

      // 生成指法
      console.log('Starting fingering generation...');
      const result = await generateFingering(rightHand, leftHand, (progress) => {
        // 将算法进度映射到20-100%
        const mappedProgress = 20 + (progress * 0.8);
        postMessage({ type: 'progress', progress: mappedProgress } as WorkerResponse);
      });

      console.log('Fingering generation complete:', {
        rightHandEntries: result?.rightHand?.length || 0,
        leftHandEntries: result?.leftHand?.length || 0
      });

      // 完成
      postMessage({ 
        type: 'complete', 
        result,
        progress: 100 
      } as WorkerResponse);

    } catch (error) {
      console.error('Worker error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      } as WorkerResponse);
    }
  }
};

export {};
