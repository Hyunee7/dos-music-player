/**
 * player-parser.js - Part 1: parse-iss.ts 명세 완벽 정치형 조합형 한글 복원 파서
 * Null 종단 버퍼 자르기 및 부호 있는 8비트 정수(Int8) 복원 공식 대입 완료
 */

window.ChipTuneTitleParser = (function() {
  
  /**
   * 90년대 DOS/PC통신용 상용 조합형 한글 완벽 복원 코어 엔진
   */
  function decodeJohab(bytes) {
    var result = "";
    var i = 0;

    while (i < bytes.length) {
      if (bytes[i] === 0) { 
        i++; 
        continue; 
      }
      
      // 최상위 비트(MSB)가 0이면 아스키(영문/숫자/기호) 처리
      if ((bytes[i] & 0x80) === 0) {
        result += String.fromCharCode(bytes[i]);
        i++;
      } else {
        // 조합형 한글 2바이트 정밀 스캔
        if (i + 1 < bytes.length) {
          var b1 = bytes[i];
          var b2 = bytes[i + 1];

          // 1. 초성 계산
          var chosung = ((b1 >> 2) & 0x1F) - 2;

          // 2. 중성 계산
          var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
          if (jungsung > 7 && jungsung < 16) {
            jungsung -= 5;
          } else if (jungsung > 15 && jungsung < 24) {
            jungsung -= 7;
          } else if (jungsung > 25) {
            jungsung -= 9;
          } else {
            jungsung -= 3;
          }

          // 3. 종성 계산
          var jongsung = (b2 & 0x1F) - 1;
          if (jongsung > 16) {
            jongsung -= 1;
          }

          if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
            // 4. 현대 한글 유니코드 가산 합성 공식
            var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032;
            result += String.fromCharCode(unicode);
          }
          i += 2; 
        } else {
          i++;
        }
      }
    }
    return result.trim();
  }

  /**
   * [백엔드 readNullTerminated 메커니즘 전사]
   * 지정된 고정폭 버퍼 안에서 최초의 널 문자(0) 위치를 탐색해 순수 알맹이만 잘라냅니다.
   */
  function readNullTerminated(u8Array, offset, maxLength) {
    const slice = u8Array.subarray(offset, offset + maxLength);
    const nullIndex = slice.indexOf(0);
    const finalBytes = nullIndex >= 0 ? slice.subarray(0, nullIndex) : slice;
    return decodeJohab(finalBytes);
  }

  /**
   * [백엔드 readInt8 메커니즘 전사]
   * 자바스크립트의 Unsigned 부호를 Signed 8비트 정수(-128 ~ 127) 공식으로 부호 역산합니다.
   */
  function readInt8(u8Value) {
    return u8Value & 0x80 ? u8Value - 256 : u8Value;
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
   * player-parser.js - Part 2: 외부 인터페이스 연동 마감 및 ISS 실시간 동기화 데이터 복원 개방
   */
  return {
    extractTitle(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      try {
        if (ext === '.ims') {
          if (u8.length < 36) return filename.replace(/\.[^.]+\$/, '');
          // 곡 제목 오프셋 6번지부터 30바이트: 정밀 Null 종단 커팅 디코딩
          const slice = u8.subarray(6, 6 + 30);
          const nullIdx = slice.indexOf(0);
          const actualTitleBytes = nullIdx >= 0 ? slice.subarray(0, nullIdx) : slice;
          return decodeJohab(actualTitleBytes) || filename.replace(/\.[^.]+\$/, '');
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
        console.error("[ISS 구조 에러] 파일 바이트 크기가 154바이트 헤더 기준치에 달하지 못합니다.");
        return null;
      }
      
      let offset = 30; // Signature "IMPlay Song V2.0    " (20바이트) + Reserved(10바이트) 오프셋 통과

      // [백엔드 데이터 완전 일치] 30바이트 고정 크기에서 Null 바이트를 정밀 추적해 발라냅니다.
      const writer = readNullTerminated(u8, offset, 30); offset += 30;
      const composer = readNullTerminated(u8, offset, 30); offset += 30;
      const singer = readNullTerminated(u8, offset, 30); offset += 30;
      const editor = readNullTerminated(u8, offset, 30); offset += 30;

      console.log(`%c[ISS 메타데이터] 가수: ${singer} / 작사: ${writer} / 작곡: ${composer}`, "color: #54ff54; font-weight: bold;");

      // 레코드 카운터 획득 (Little Endian uint16)
      const recCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
      const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;

      console.log(`[ISS 명세 사양] 싱크 레코드 개수: ${recCount}개 / 가사 라인 수: ${lineCount}줄`);

      // [치명적 꼬임 버그 완전 수정: 개당 5바이트 레코드 구조 분해]
      // 백엔드 명세의 'readInt8' 부호 복원 공식을 완벽 대입하여 음수 보정치 위치 왜곡을 완전히 잡았습니다.
      const records = [];
      for (let i = 0; i < recCount; i++) {
        if (offset + 5 > u8.length) break;
        
        const kasaTick = u8[offset] | (u8[offset + 1] << 8);
        const line = readInt8(u8[offset + 2]);
        const startX = readInt8(u8[offset + 3]);
        const widthX = readInt8(u8[offset + 4]);
        
        records.push({ kasaTick, line, startX, widthX });
        offset += 5; // 5바이트 고정 규격 동기 전진
      }

      console.log("%c------- [ISS 실시간 자막 디코딩 스캔 라인] -------", "color: #54ffff; font-weight: bold;");
      
      // 가사 스크립트 본문 파싱 (줄당 64바이트 고정 규격 적용 + Null 종단 보정)
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
        if (offset + 64 > u8.length) {
          console.warn(`[ISS 스캔 가이드] ${i}번째 줄에서 파일 끝단 임계치 도달로 인한 안전 종료`);
          break;
        }

        // 64바이트 버퍼 크기 안에서 순수 문장 문자열만 정밀 커팅 추출
        const lineText = readNullTerminated(u8, offset, 64);
        scripts.push(lineText);
        
        // 디코딩 완료 문장 실시간 브라우저 콘솔 리포트
        console.log(`[Line ${String(i).padStart(2, '0')}] ${lineText || "(공백 라인)"}`);
        
        offset += 64; 
      }
      console.log("%c------- [ISS 가사 디코딩 스캔 완수] -------", "color: #54ffff; font-weight: bold;");
      
      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
