// src/lib/i18n.ts - 国际化配置

export type Language = 'zh' | 'en' | 'ja';

export interface Translations {
  // Header
  title: string;
  subtitle: string;
  
  // File Uploader
  uploadTitle: string;
  uploadDescription: string;
  uploadHint: string;
  dragHere: string;
  
  // Errors
  errorFileType: string;
  errorFileSize: string;
  
  // Processing
  processingTitle: string;
  processingTime: string;
  processingFirstTime: string;
  progressLabel: string;
  
  // Result
  resultTitle: string;
  resultDescription: string;
  downloadButton: string;
  downloadingButton: string;
  resultHint: string;
  
  // Common
  loading: string;
  error: string;
  retry: string;
}

export const translations: Record<Language, Translations> = {
  zh: {
    // Header
    title: '🎹 钢琴指法自动生成器',
    subtitle: '上传您的 MusicXML 乐谱，自动生成指法标注',
    
    // File Uploader
    uploadTitle: '上传 MusicXML 文件',
    uploadDescription: '拖拽文件到此处或点击上传',
    uploadHint: '支持 .musicxml 和 .mxl 格式，最大 10MB',
    dragHere: '拖拽文件到此处',
    
    // Errors
    errorFileType: '仅支持 .musicxml 和 .mxl 格式文件',
    errorFileSize: '文件大小不能超过 10MB',
    
    // Processing
    processingTitle: '正在处理您的乐谱...',
    processingTime: '这可能需要 3-5 分钟，请耐心等待',
    processingFirstTime: '💡 首次请求可能需要额外 30-60 秒唤醒服务',
    progressLabel: '进度',
    
    // Result
    resultTitle: '处理完成！',
    resultDescription: '指法已自动生成并标注到您的乐谱中。点击下方按钮下载结果文件。',
    downloadButton: '下载结果文件',
    downloadingButton: '下载中...',
    resultHint: '💡 文件将保存为 .musicxml 格式，可在任何音乐记谱软件中打开',
    
    // Common
    loading: '加载中...',
    error: '错误',
    retry: '重试',
  },
  
  en: {
    // Header
    title: '🎹 Piano Fingering Generator',
    subtitle: 'Upload your MusicXML score and get automatic fingering annotations',
    
    // File Uploader
    uploadTitle: 'Upload MusicXML File',
    uploadDescription: 'Drag and drop file here or click to upload',
    uploadHint: 'Supports .musicxml and .mxl formats, max 10MB',
    dragHere: 'Drop file here',
    
    // Errors
    errorFileType: 'Only .musicxml and .mxl formats are supported',
    errorFileSize: 'File size cannot exceed 10MB',
    
    // Processing
    processingTitle: 'Processing your score...',
    processingTime: 'This may take 3-5 minutes, please be patient',
    processingFirstTime: '💡 First request may need extra 30-60 seconds to wake up the service',
    progressLabel: 'Progress',
    
    // Result
    resultTitle: 'Processing Complete!',
    resultDescription: 'Fingering has been automatically generated and annotated to your score. Click the button below to download the result.',
    downloadButton: 'Download Result',
    downloadingButton: 'Downloading...',
    resultHint: '💡 File will be saved as .musicxml format, can be opened in any music notation software',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
  },
  
  ja: {
    // Header
    title: '🎹 ピアノ運指自動生成器',
    subtitle: 'MusicXML楽譜をアップロードして、自動的に運指を生成',
    
    // File Uploader
    uploadTitle: 'MusicXMLファイルをアップロード',
    uploadDescription: 'ファイルをドラッグ＆ドロップまたはクリックしてアップロード',
    uploadHint: '.musicxmlと.mxl形式をサポート、最大10MB',
    dragHere: 'ここにファイルをドロップ',
    
    // Errors
    errorFileType: '.musicxmlと.mxl形式のみサポートしています',
    errorFileSize: 'ファイルサイズは10MBを超えることはできません',
    
    // Processing
    processingTitle: '楽譜を処理中...',
    processingTime: '3〜5分かかる場合があります。お待ちください',
    processingFirstTime: '💡 初回リクエストはサービスの起動に30〜60秒かかる場合があります',
    progressLabel: '進捗',
    
    // Result
    resultTitle: '処理完了！',
    resultDescription: '運指が自動的に生成され、楽譜に注釈されました。下のボタンをクリックして結果ファイルをダウンロードしてください。',
    downloadButton: '結果をダウンロード',
    downloadingButton: 'ダウンロード中...',
    resultHint: '💡 ファイルは.musicxml形式で保存され、任意の楽譜作成ソフトウェアで開くことができます',
    
    // Common
    loading: '読み込み中...',
    error: 'エラー',
    retry: '再試行',
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.en; // 默认英文
}
