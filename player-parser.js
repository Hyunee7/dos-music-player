/**
 * player-parser.js - IMS 가변 템포 헤더 파서 및 ISS 무결성 디코더 엔진
 */

window.ChipTuneTitleParser = (function() {
  
  /**
   * GitHub 표준 KSX1001 산술 이식형 상용 조합형 한글 복원 코어
   */
  function decodeJohab(bytes) {
    var result = "";
    var i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0) { i++; continue; }
      if ((bytes[i] & 0x80) === 0) {
        result += String.fromCharCode(bytes[i]);
        i++;
      } else {
        if (i + 1 < bytes.length) {
          var b1 = bytes[i]; var b2 = bytes[i + 1];
          var chosung = ((b1 >> 2) & 0x1F) - 2;
          var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
          if (jungsung > 7 && jungsung < 16) jungsung -= 5;
          else if (jungsung > 15 && jungsung < 24) jungsung -= 7;
          else if (jungsung > 25) jungsung -= 9;
          else jungsung -= 3;
          var jongsung = (b2 & 0x1F) - 1;
          if (jongsung > 16) jongsung -= 1;
          if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
            var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032;
            result += String.fromCharCode(unicode);
          }
          i += 2;
        } else { i++; }
      }
    }
    return result.trim();
  }

  function readNullTerminated(u8Array, offset, maxLength) {
    const slice = u8Array.subarray(offset, offset + maxLength);
    const nullIndex = slice.indexOf(0);
    return decodeJohab(nullIndex >= 0 ? slice.subarray(0, nullIndex) : slice);
  }

  function readInt8(u8Value) {
    return u8Value & 0x80 ? u8Value - 256 : u8Value;
  }

  return {
    // [최종 진화] IMS 70바이트 하드웨어 구조체 필드 정밀 디코딩 연산 가동
    parseImsHeader(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 70) return null;
      
      const view = new DataView(arrayBuffer);
      
      // 구조체 정밀 오프셋 수치 분해
      const nTickBeat = u8[36]; // Offset 36: 박자당 틱 수
      const nBasicTempo = view.getUint16(60, true); // Offset 60-61: 기본 속도(Tempo, Little Endian)
      
      // 조합형 타이틀 스캔 복원
      const titleSlice = u8.subarray(6, 6 + 30);
      const nullIdx = titleSlice.indexOf(0);
      const cleanedBytes = nullIdx >= 0 ? titleSlice.subarray(0, nullIdx) : titleSlice;
      const parsedTitle = decodeJohab(cleanedBytes);

      console.log(`%c[IMS 헤더 분석] 곡명: ${parsedTitle} / 기본 템포: ${nBasicTempo} / 박자당 틱수: ${nTickBeat}`, "color: #54ffff; font-weight: bold;");
      
      return {
        basicTempo: nBasicTempo || 120,
        tickBeat: nTickBeat || 24,
        title: parsedTitle
      };
    },

    extractTitle(arrayBuffer, filename) {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (ext === '.ims') {
        const info = this.parseImsHeader(arrayBuffer);
        return info ? info.title : filename.replace(/\.[^.]+(?=\?|\$)/, '');
      }
      return filename.replace(/\.[^.]+(?=\?|\$)/, '');
    },

    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 154) return null;
      
      let offset = 30;
      const writer = readNullTerminated(u8, offset, 30); offset += 30;
      const composer = readNullTerminated(u8, offset, 30); offset += 30;
      const singer = readNullTerminated(u8, offset, 30); offset += 30;
      const editor = readNullTerminated(u8, offset, 30); offset += 30;

      const recCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
      const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;

      const records = [];
      for (let i = 0; i < recCount; i++) {
        if (offset + 5 > u8.length) break;
        const kasaTick = u8[offset] | (u8[offset + 1] << 8);
        const line = readInt8(u8[offset + 2]);
        const startX = readInt8(u8[offset + 3]);
        const widthX = readInt8(u8[offset + 4]);
        records.push({ kasaTick, line, startX, widthX });
        offset += 5;
      }

      console.log("------- [ISS 실시간 자막 디코딩 스캔 라인] -------");
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
        if (offset + 64 > u8.length) break;
        const lineText = readNullTerminated(u8, offset, 64);
        scripts.push(lineText);
        console.log(`[Line ${String(i).padStart(2, '0')}] ${lineText || "(공백 라인)"}`);
        offset += 64;
      }
      console.log("------- [ISS 가사 디코딩 스캔 완수] -------");
      
      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
