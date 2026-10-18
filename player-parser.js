/**
 * player-parser.js - Part 1: 고성능 조합형(Johab) 한글 및 아스키 복합 문자열 정밀 디코더
 * 특수문자, 공백 및 1바이트/2바이트 가변 오프셋 꼬임 현상을 완벽하게 교정했습니다.
 */

window.ChipTuneTitleParser = (function() {
  
  /**
   * 16비트 조합형 코드 한 글자를 정밀 분석하여 유니코드로 복원
   */
  function decodeJohabChar(code) {
    // 최상위 비트가 0이면 영문/아스키이므로 그대로 문자로 변환
    if ((code & 0x8000) === 0) {
      return String.fromCharCode(code & 0xFF);
    }

    // 채움 코드 또는 공백 영역 예외 방어 (조합형 공백 부근 락 버그 차단)
    if (code === 0xD931 || code === 0x3232 || (code & 0x7FFF) === 0) {
      return " ";
    }

    // 초성(비트 10~14), 중성(비트 5~9), 종성(비트 0~4) 5비트씩 정밀 추출
    const cho = (code >> 10) & 0x1F;
    const jung = (code >> 5) & 0x1F;
    const jong = code & 0x1F;

    // 상용 조합형 5비트 인덱스를 현대 유니코드 완성형 한글 인덱스로 매핑하는 표준 테이블
    const choMap = [-1,-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    const jungMap = [-1,-1, 0, 1, 2, 3, 4, -1, -1, 5, 6, 7, 8, 9, 10, -1, -1, 11, 12, 13, 14, 15, 16, -1, -1, 17, 18, 19, 20, 21, -1, -1];
    const jongMap = [ 0,-1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, -1, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, -1, -1];

    const cIdx = choMap[cho];
    const jIdx = jungMap[jung];
    const dIdx = jongMap[jong];

    // 매핑 테이블을 벗어나는 특수문자 또는 빈 자모 영역 방어 폴백
    if (cIdx === -1 || jIdx === -1 || dIdx === -1) {
      // 조합형 특수문자 부근(0xD900번대 계열) 폴백 문자로 흡수 처리
      if (cho === 0xD || cho === 0x1A) return "·";
      return ""; 
    }

    // 현대 한글 유니코드 공식 연산 연쇄 결합
    const uniCode = (cIdx * 21 * 28) + (jIdx * 28) + dIdx + 0xAC00;
    return String.fromCharCode(uniCode);
  }

  /**
   * 1바이트 아스키와 2바이트 한글이 혼용된 바이너리 바이트열을 가변 오프셋으로 정밀 전사
   */
  function decodeJohabString(uint8Array) {
    let result = "";
    let i = 0;
    
    while (i < uint8Array.length) {
      const b1 = uint8Array[i];
      if (b1 === 0) break; // 문자열 끝단 탈출

      // 최상위 비트(0x80)가 켜져 있으면 2바이트 한글/한자/특수 규격 문자열
      if (b1 & 0x80) {
        if (i + 1 >= uint8Array.length) break;
        const b2 = uint8Array[i + 1];
        
        // 2바이트 결합 연산
        const code = (b1 << 8) | b2;
        result += decodeJohabChar(code);
        i += 2; // 2바이트 전진
      } else {
        // 1바이트 일반 영문/숫자/기호 처리
        if (b1 >= 32 && b1 <= 126) {
          result += String.fromCharCode(b1);
        } else if (b1 === 32) {
          result += " ";
        }
        i += 1; // 1바이트 전진
      }
    }
    
    // 무분별한 널 문자와 고전 공백 데이터 찌꺼기 문자열 정돈 정리
    return result.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
  }

  function readAscii(u8Array, start, length) {
    let str = "";
    for (let i = start; i < start + length && i < u8Array.length; i++) {
      if (u8Array[i] === 0) break;
      if (u8Array[i] >= 32 && u8Array[i] <= 126) {
        str += String.fromCharCode(u8Array[i]);
      }
    }
    return str.trim();
  }

  function readUInt16LE(u8, offset) {
    return u8[offset] | (u8[offset + 1] << 8);
  }

  function readInt8(u8, offset) {
    const val = u8[offset];
    return val & 0x80 ? val - 256 : val;
  }
//2
  /**
   * player-parser.js - Part 2: 음원 원제목 획득 및 .ISS 파일 바이너리 구조 분해 마감 인터페이스
   */

  return {
    extractTitle(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      
      try {
        if (ext === '.ims') {
          if (u8.length < 36) return filename.replace(/\.[^.]+$/, '');
          // 오프셋 6번지부터 30바이트간 명시된 조합형 음원 정보 정밀 복원 가동
          const songNameBytes = u8.subarray(6, 36);
          const krTitle = decodeJohabString(songNameBytes);
          return krTitle || filename.replace(/\.[^.]+$/, '');
        } 
        else if (ext === '.mod') return readAscii(u8, 0, 20);
        else if (ext === '.s3m') return readAscii(u8, 0, 28);
        else if (ext === '.xm') return readAscii(u8, 17, 20);
        else if (ext === '.it') return readAscii(u8, 4, 26);
      } catch (e) { 
        console.error("바이너리 타이틀 획득 중 크래시:", e); 
      }
      return filename.replace(/\.[^.]+$/, '');
    },

    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 154) return null;

      let offset = 0;
      offset += 30; // Signature "IMPlay Song V2.0    " + Reserved 건너뛰기

      // 조합형 크레딧 문자열 복원 (작사, 작곡, 가수, 편집자)
      const writer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const composer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const singer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const editor = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;

      const recCount = readUInt16LE(u8, offset); offset += 2;
      const lineCount = readUInt16LE(u8, offset); offset += 2;

      // 틱 연동 자막 동기화 레코드 리스트 구조화
      const records = [];
      for (let i = 0; i < recCount; i++) {
        if (offset + 5 > u8.length) break;
        records.push({
          kasaTick: readUInt16LE(u8, offset),
          line: readInt8(u8, offset + 2),
          startX: readInt8(u8, offset + 3),
          widthX: readInt8(u8, offset + 4)
        });
        offset += 5;
      }

      // 개당 64바이트로 하드 코딩된 고전 조합형 한글 가사 줄 바이트 정밀 복원 추출
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
        if (offset + 64 > u8.length) break;
        const lineText = decodeJohabString(u8.subarray(offset, offset + 64));
        scripts.push(lineText);
        offset += 64;
      }

      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
