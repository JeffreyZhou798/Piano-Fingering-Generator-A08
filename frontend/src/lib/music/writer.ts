// MusicXML写入器 - 将指法结果写回MusicXML
import { FingeringResult } from '../algorithm/types';

type XmlDomTools = {
  DOMParserClass: typeof DOMParser;
  XMLSerializerClass: typeof XMLSerializer;
};

async function getXmlDomTools(): Promise<XmlDomTools> {
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    return {
      DOMParserClass: DOMParser,
      XMLSerializerClass: XMLSerializer
    };
  }

  const xmldom = await import('@xmldom/xmldom');
  return {
    DOMParserClass: xmldom.DOMParser as unknown as typeof DOMParser,
    XMLSerializerClass: xmldom.XMLSerializer as unknown as typeof XMLSerializer
  };
}

/**
 * 将指法结果添加到MusicXML内容中
 */
export async function addFingeringToMusicXML(
  originalXmlContent: string,
  fingeringResult: FingeringResult
): Promise<string> {
  console.log('addFingeringToMusicXML called with:', {
    rightHandCount: fingeringResult.rightHand?.length || 0,
    leftHandCount: fingeringResult.leftHand?.length || 0,
    rightHandSample: fingeringResult.rightHand?.slice(0, 3),
    leftHandSample: fingeringResult.leftHand?.slice(0, 3)
  });

  const { DOMParserClass, XMLSerializerClass } = await getXmlDomTools();
  const parser = new DOMParserClass();
  const xmlDoc = parser.parseFromString(originalXmlContent, 'text/xml');

  // 检查解析错误
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid MusicXML file');
  }

  // 获取所有part
  const parts = xmlDoc.querySelectorAll('part');
  
  console.log('MusicXML parts found:', parts.length);
  
  if (parts.length === 0) {
    throw new Error('No parts found in MusicXML');
  }

  // 处理右手（第一个part或高音部分）
  if (fingeringResult.rightHand && fingeringResult.rightHand.length > 0) {
    console.log('Adding right hand fingering to part 0');
    const rhPart = parts[0];
    addFingeringToPart(rhPart, [...fingeringResult.rightHand], 'right');
  }

  // 处理左手（第二个part或低音部分）
  if (fingeringResult.leftHand && fingeringResult.leftHand.length > 0) {
    const lhPartIndex = parts.length > 1 ? 1 : 0;
    console.log(`Adding left hand fingering to part ${lhPartIndex}`);
    const lhPart = parts[lhPartIndex];
    addFingeringToPart(lhPart, [...fingeringResult.leftHand], 'left');
  }

  // 序列化回XML字符串
  const serializer = new XMLSerializerClass();
  let xmlString = serializer.serializeToString(xmlDoc);

  // 添加XML声明（如果没有）
  if (!xmlString.startsWith('<?xml')) {
    xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
  }

  console.log('MusicXML with fingering generated successfully');

  return xmlString;
}

/**
 * 为part添加指法标注
 */
function addFingeringToPart(
  part: Element,
  fingerings: Array<{ pitch: number; finger: number; position: number }>,
  hand: string
): void {
  console.log(`addFingeringToPart for ${hand} hand:`, {
    fingeringsCount: fingerings.length,
    firstFew: fingerings.slice(0, 5)
  });

  // 确定目标staff编号：右手=1，左手=2
  const targetStaff = hand === 'right' ? '1' : '2';

  // 获取所有measure
  const measures = part.querySelectorAll('measure');
  
  let fingeringIndex = 0;
  let notesProcessed = 0;
  let fingeringsAdded = 0;
  let notesSkipped = 0;
  let tieSkipped = 0;
  
  for (const measure of Array.from(measures)) {
    // 获取measure中的所有note
    const notes = measure.querySelectorAll('note');
    
    for (const note of Array.from(notes)) {
      // 跳过休止符
      if (note.querySelector('rest')) {
        continue;
      }

      // 检查staff编号 - 只处理对应手的音符
      const staffElement = note.querySelector('staff');
      const noteStaff = staffElement?.textContent || '1';
      
      if (noteStaff !== targetStaff) {
        notesSkipped++;
        continue; // 跳过不属于当前手的音符
      }

      // 跳过连音线的后续音符（tie stop和continue）
      const ties = note.querySelectorAll('tie');
      let shouldSkip = false;
      for (const tie of Array.from(ties)) {
        const tieType = tie.getAttribute('type');
        if (tieType === 'stop' || tieType === 'continue') {
          shouldSkip = true;
          tieSkipped++;
          break;
        }
      }
      if (shouldSkip) {
        continue;
      }

      // 获取音高
      const pitchElement = note.querySelector('pitch');
      if (!pitchElement) {
        continue;
      }

      const step = pitchElement.querySelector('step')?.textContent || '';
      const octave = parseInt(pitchElement.querySelector('octave')?.textContent || '0');
      const alter = parseInt(pitchElement.querySelector('alter')?.textContent || '0');

      // 计算MIDI音高
      const midiPitch = calculateMidiPitch(step, octave, alter);
      notesProcessed++;

      // 查找对应的指法
      if (fingeringIndex < fingerings.length) {
        const fingering = fingerings[fingeringIndex];
        
        // 匹配音高（允许一定误差）
        if (Math.abs(fingering.pitch - midiPitch) <= 1) {
          // 添加指法标注
          addFingeringToNote(note, fingering.finger);
          fingeringIndex++;
          fingeringsAdded++;
        } else {
          // 尝试在接下来的几个指法中查找匹配（处理和弦顺序问题）
          let found = false;
          const lookAhead = Math.min(10, fingerings.length - fingeringIndex);
          
          for (let offset = 1; offset < lookAhead; offset++) {
            const nextFingering = fingerings[fingeringIndex + offset];
            if (Math.abs(nextFingering.pitch - midiPitch) <= 1) {
              // 找到匹配
              addFingeringToNote(note, nextFingering.finger);
              fingeringsAdded++;
              found = true;
              
              // 标记这个指法已使用（通过移除）
              fingerings.splice(fingeringIndex + offset, 1);
              break;
            }
          }
          
          if (!found) {
            console.warn(`${hand} hand: No fingering match for pitch ${midiPitch} at note ${notesProcessed} (expected ${fingering.pitch})`);
            // 仍然使用当前指法，避免跳过
            addFingeringToNote(note, fingering.finger);
            fingeringIndex++;
            fingeringsAdded++;
          }
        }
      } else {
        console.warn(`${hand} hand: Ran out of fingerings at note ${notesProcessed} (pitch ${midiPitch})`);
        // 使用默认指法
        addFingeringToNote(note, 3); // 默认使用中指
        fingeringsAdded++;
      }
    }
  }

  console.log(`${hand} hand: processed ${notesProcessed} notes (skipped ${notesSkipped} from other staff, ${tieSkipped} tied), added ${fingeringsAdded} fingerings`);
  
  if (fingeringsAdded < notesProcessed) {
    console.warn(`${hand} hand: ${notesProcessed - fingeringsAdded} notes did not get fingerings`);
  }
  
  if (fingeringIndex < fingerings.length) {
    console.warn(`${hand} hand: ${fingerings.length - fingeringIndex} fingerings were not used (total ${fingerings.length}, used ${fingeringIndex})`);
  }
}

/**
 * 为note添加指法标注
 */
function addFingeringToNote(note: Element, finger: number): void {
  const doc = note.ownerDocument;
  if (!doc) return;

  // 查找或创建notations元素
  let notations = note.querySelector('notations');
  if (!notations) {
    notations = doc.createElement('notations');
    note.appendChild(notations);
  }

  // 查找或创建technical元素
  let technical = notations.querySelector('technical');
  if (!technical) {
    technical = doc.createElement('technical');
    notations.appendChild(technical);
  }

  // 创建fingering元素
  const fingeringElement = doc.createElement('fingering');
  fingeringElement.textContent = finger.toString();
  technical.appendChild(fingeringElement);
}

/**
 * 计算MIDI音高
 */
function calculateMidiPitch(step: string, octave: number, alter: number = 0): number {
  const stepValues: { [key: string]: number } = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
  };

  const baseNote = stepValues[step] || 0;
  return (octave + 1) * 12 + baseNote + alter;
}

/**
 * 将MusicXML字符串转换为Blob（用于下载）
 */
export function createMusicXMLBlob(xmlContent: string): Blob {
  return new Blob([xmlContent], { type: 'application/vnd.recordare.musicxml+xml' });
}
