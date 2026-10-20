/**
 * player-parser.js - Part 1: GitHub 표준 KSX1001 산술 이식형 상용 조합형 한글 디코더
 * 중성 비트 교차 결합 및 오프셋 다차원 분기 수식을 완벽히 복원하여 글자 왜곡을 박멸했습니다.
 */

window.ChipTuneTitleParser = (function() {
  
  /**
   * 90년대 DOS/PC통신용 조합형 한글 바이트 배열 디코더 엔진 (무결성 이식 완수)
   */
  function decodeJohab(bytes) {
    var result = "";
    var i = 0;

    while (i < bytes.length) {
      if (bytes[i] === 0) { 
        i++; 
        continue; 
      }
      
      // 최상위 비트(MSB)가 0이면 아스키(영문/숫자/제어문자) 처리
      if ((bytes[i] & 0x80) === 0) {
        result += String.fromCharCode(bytes[i]);
        i++;
      } else {
        // 조합형 한글 2바이트 조건부 정밀 해독
        if (i + 1 < bytes.length) {
          var b1 = bytes[i];
          var b2 = bytes[i + 1];

          // 1. 초성 계산: 상위 바이트에서 5비트 추출 후 오프셋 보정
          var chosung = ((b1 >> 2) & 0x1F) - 2;

          // 2. 중성 계산: 상위 바이트 하위 2비트 + 하위 바이트 상위 3비트 조합
          var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
          
          // 중성 코드 영역별 변환 오프셋 분기 적용 (C# 공식 무결성 이식)
          if (jungsung > 7 && jungsung < 16) {
            jungsung -= 5;
          } else if (jungsung > 15 && jungsung < 24) {
            jungsung -= 7;
          } else if (jungsung > 25) {
            jungsung -= 9;
          } else {
            jungsung -= 3;
          }

          // 3. 종성 계산: 하위 바이트 하위 5비트 추출 후 오프셋 보정
          var jongsung = (b2 & 0x1F) - 1;
          if (jongsung > 16) {
            jongsung -= 1;
          }

          // 범위 유효성 체크 방어 코드
          if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
            // 4. 현대 한글 유니코드 공식 결합 (초성 * 588 + 중성 * 28 + 종성 + 44032)
            var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032;
            result += String.fromCharCode(unicode);
          }
          i += 2; // 2바이트 소모 완료
        } else {
          i++;
        }
      }
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  function readAscii(u8Array, start, length) {
    let str = "";
    for (let i = start; i < start + length && i < u8Array.length; i++) {
      if (u8Array[i] === 0) break;
      if (u8Array[i] >= 32 && u8Array[i] <= 126) str += String.fromCharCode(u8Array[i]);
    }
    return str.trim();
  }
  /**
   * player-parser.js - Part 2: 곡 제목 분석 및 .ISS 파일 바이트 라인 해독 인터페이스
   */
  return {
    extractTitle(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      try {
        if (ext === '.ims') {
          if (u8.length < 36) return filename.replace(/\.[^.]+\$/, '');
          return decodeJohab(u8.subarray(6, 36)) || filename.replace(/\.[^.]+\$/, '');
        } 
        else if (ext === '.mod') return readAscii(u8, 0, 20);
        else if (ext === '.s3m') return readAscii(u8, 0, 28);
        else if (ext === '.xm') return readAscii(u8, 17, 20);
        else if (ext === '.it') return readAscii(u8, 4, 26);
      } catch (e) { console.error(e); }
      return filename.replace(/\.[^.]+\$/, '');
    },

    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 154) {
        console.error("[ISS 분석 오류] 파일의 헤더 규격 크기가 미달되었습니다.");
        return null;
      }
      let offset = 30; // 시그니처 패스

      const writer = decodeJohab(u8.subarray(offset, offset + 30)); offset += 30;
      const composer = decodeJohab(u8.subarray(offset, offset + 30)); offset += 30;
      const singer = decodeJohab(u8.subarray(offset, offset + 30)); offset += 30;
      const editor = decodeJohab(u8.subarray(offset, offset + 30)); offset += 30;

      console.log(`%c[ISS 크레딧 복원] 가수: ${singer} / 작사: ${writer} / 작곡: ${composer}`, "color: #54ffff; font-weight: bold;");

      const recCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
      const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;

      const records = [];
      for (let i = 0; i < recCount; i++) {
        if (offset + 5 > u8.length) break;
        const kasaTick = u8[offset] | (u8[offset + 1] << 8);
        const line = u8[offset + 2] & 0x80 ? u8[offset + 2] - 256 : u8[offset + 2];
        const startX = u8[offset + 3] & 0x80 ? u8[offset + 3] - 256 : u8[offset + 3];
        const widthX = u8[offset + 4] & 0x80 ? u8[offset + 4] - 256 : u8[offset + 4];
        records.push({ kasaTick, line, startX, widthX });
        offset += 5;
      }

      console.log("------- [ISS 실시간 자막 디코딩 스캔 라인] -------");
	  console.log(lineCount, offset+64, '>',u8.length)
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
        if (offset + 64 > u8.length) break;
        const lineText = decodeJohab(u8.subarray(offset, offset + 64));
        scripts.push(lineText);
        
        // 브라우저 개발자 도구(F12) 콘솔창에 변환 완료 문장 실시간 기록 출력
        console.log(`[라인 ${String(i).padStart(2, '0')}] ${lineText || "(공백 줄)"}`);
        
        offset += 64;
      }
      console.log("------- [ISS 가사 복원 스캔 완수] -------");
      
      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
