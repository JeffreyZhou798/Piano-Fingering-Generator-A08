'use client';

import { Clock, Activity } from 'lucide-react';
import type { Translations } from '@/lib/i18n';

interface ProcessingStatusProps {
  isProcessing: boolean;
  progress?: number;
  translations: Translations;
}

export function ProcessingStatus({ isProcessing, progress, translations: t }: ProcessingStatusProps) {
  if (!isProcessing) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <Activity className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
        
        <h3 className="text-xl font-semibold text-blue-900 mb-2">
          {t.processingTitle}
        </h3>
        
        <div className="flex items-center justify-center gap-2 text-blue-700 mb-4">
          <Clock className="w-4 h-4" />
          <p className="text-sm">
            {t.processingTime}
          </p>
        </div>

        {progress !== undefined && (
          <div className="mt-4">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-blue-600 mt-2">
              {t.progressLabel}: {progress.toFixed(0)}%
            </p>
          </div>
        )}

        <p className="text-xs text-blue-600 mt-4">
          {t.processingFirstTime}
        </p>
      </div>
    </div>
  );
}
