/**
 * player-parser.js - IMS/ROL/VGM 하드웨어 사양별 전체 시간 무결성 디코더 마스터 엔진
 */
window.ChipTuneTitleParser = (function() {
  
  function decodeJohab(bytes) {
	/**/
    var result = ""; var i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0) { i++; continue; }
      if ((bytes[i] & 0x80) === 0) { result += String.fromCharCode(bytes[i]); i++; } 
      else {
        if (i + 1 < bytes.length) {
          var b1 = bytes[i]; var b2 = bytes[i + 1];
          var chosung = ((b1 >> 2) & 0x1F) - 2;
          var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
          if (jungsung > 7 && jungsung < 16) jungsung -= 5;
          else if (jungsung > 15 && jungsung < 24) jungsung -= 7;
          else if (jungsung > 25) jungsung -= 9; else jungsung -= 3;
          var jongsung = (b2 & 0x1F) - 1; if (jongsung > 16) jongsung -= 1;
          if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
            var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032; result += String.fromCharCode(unicode);
          }
          i += 2;
        } else { i++; }
      }
    }
    return result.trim();
	/** /
    // 1. 디코더 인스턴스 생성 (상용 조합형 한글 규격인 'johab' 지정)
    // 만약 일반 완성형 한글 텍스트라면 'euc-kr'을 사용합니다.
	console.log('bytes',bytes)
    const decoder = new TextDecoder('johab');
	console.log('decoder.decode(bytes)',decoder.decode(bytes))
	return decoder.decode(bytes);
	*/
  }
  
  

  function readNullTerminated(u8Array, offset, maxLength) {
    const slice = u8Array.subarray(offset, offset + maxLength);
    const nullIndex = slice.indexOf(0);
    return decodeJohab(nullIndex >= 0 ? slice.subarray(0, nullIndex) : slice);
  }

  function readInt8(u8Value) { return u8Value & 0x80 ? u8Value - 256 : u8Value; }

  // [버그 박멸 핵심 1] ROL 파일 음표 누적 바이트 리더 오정렬 완벽 스정
  function calculateRolTotalTicks(u8) {
    if (u8.length < 32) return 0;
    const totalTracks = u8[28] | (u8[29] << 8);
    let offset = 32; 
    if (u8.length < offset + (totalTracks * 2)) return 0;
    
    const trackOffsets = [];
    for (let t = 0; t < totalTracks; t++) {
      trackOffsets.push(u8[offset] | (u8[offset + 1] << 8));
      offset += 2;
    }

    let maxTrackTicks = 0;
    for (let t = 0; t < totalTracks; t++) {
      let tPtr = trackOffsets[t];
      if (tPtr >= u8.length) continue;

      let currentTrackTicks = 0;
      let safetyCounter = 0;

      while (tPtr < u8.length && safetyCounter < 30000) {
        const cmd = u8[tPtr];
        const eventType = cmd & 0x0F; 
        
        if (eventType === 0x00) { 
          tPtr += 3;
        } else if (eventType === 0x01) {
          if (tPtr + 1 < u8.length) currentTrackTicks += u8[tPtr + 1];
          tPtr += 2;
        } else if (eventType === 0x02) {
          break;
        } else {
          tPtr++; 
        }
        safetyCounter++;
      }
      if (currentTrackTicks > maxTrackTicks) maxTrackTicks = currentTrackTicks;
    }
    return maxTrackTicks;
  }

  return {
    parseImsHeader(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 70) return null;
      const view = new DataView(arrayBuffer);
      return {
        basicTempo: view.getUint16(60, true) || 120,
        tickBeat: u8[36] || 24,
        totalTick: view.getUint32(38, true) || 0,
//        title: readNullTerminated(u8, 6, 30)
        title: JohabDecoder.decode(arrayBuffer, 6, 30)  // 조합형한글 변환 모듈 변경
      };
    },

    parseRolHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      return {
        basicTempo: 120,
        tickBeat: 12,
        totalTick: calculateRolTotalTicks(u8),
        title: filename.substring(0, filename.lastIndexOf('.')) || filename
      };
    },

    // [버그 박멸 핵심 2] VGM 오리지널 샘플 해상도 헤더 독립 추출기 장착
    parseVgmHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 64) return { duration: 0, title: filename };
      const view = new DataView(arrayBuffer);
      
      // Offset 24 (0x18): VGM 고유의 총 샘플 수 (Total Samples, uint32 LE)
      const totalSamples = view.getUint32(24, true);
      // VGM 표준 클럭 주파수 레이트는 전 세계 공통 항상 44100Hz로 정형화 설계됨
      const duration = totalSamples / 44100;
      
      return {
        duration: duration || 0,
        title: filename.substring(0, filename.lastIndexOf('.')) || filename
      };
    },

    extractTitle(arrayBuffer, filename) {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (ext === '.ims') return this.parseImsHeader(arrayBuffer)?.title || filename;
      if (ext === '.rol') return this.parseRolHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.vgm' || ext === '.vgz') return this.parseVgmHeader(arrayBuffer, filename)?.title || filename;
      return filename.replace(/\.[^.]+(?=\?|\$)/, '');
    },

    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer); if (u8.length < 154) return null;
      let offset = 30; // ISS 파일 사인정보 스킵
	  const writer = readNullTerminated(u8, offset, 30); offset += 30;
	  const composer = readNullTerminated(u8, offset, 30); offset += 30;
	  const singer = readNullTerminated(u8, offset, 30); offset += 30;
	  const editor = readNullTerminated(u8, offset, 30); offset += 30;
      const recCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
	  const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
      const records = [];
      for (let i = 0; i < recCount; i++) { if (offset + 5 > u8.length) break;
	  const kasaTick = u8[offset] | (u8[offset + 1] << 8);
	  const line = readInt8(u8[offset + 2]);
	  const startX = readInt8(u8[offset + 3]);
	  const widthX = readInt8(u8[offset + 4]); records.push({ kasaTick, line, startX, widthX }); offset += 5; }
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
		if (offset + 64 > u8.length) break;
		//const lineText = readNullTerminated(u8, offset, 64);
		const lineText = JohabDecoder.decode(arrayBuffer, offset, 64); // 조합형한글 변환 모듈 변경
		scripts.push(lineText); offset += 64; 
	  }
	  
      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
