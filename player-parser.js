/**
 * player-parser.js - Part 1: 순수 비트 매핑 기반 상용 조합형 한글 표준 유니코드 변환 엔진
 * 브라우저 TextDecoder 엔진 의존성을 완전히 제거하여 인코딩 오류를 완벽히 청소했습니다.
 */

window.ChipTuneTitleParser = (function() {
  
  /**
   * 16비트 상용 조합형(5-5-5 비트 구조) 코드 데이터를 현대 유니코드 완성형 음절로 결합 치환
   */
  function decodeJohabChar(code) {
    // 1바이트 영문 및 일반 아스키 기호 처리
    if ((code & 0x8000) === 0) {
      return String.fromCharCode(code & 0xFF);
    }

    // 조합형 특수문자 공백 및 채움 데이터 찌꺼기 예외 방어
    if (code === 0xD931 || code === 0x3232 || (code & 0x7FFF) === 0) {
      return " ";
    }

    // 5비트씩 초성, 중성, 종성 비트 분해 (1v ccccc jjjjj ddddd)
    const cho = (code >> 10) & 0x1F;
    const jung = (code >> 5) & 0x1F;
    const jong = code & 0x1F;

    // 1. 초성 매핑 테이블: 조합형 비트값(0x02~0x14) -> 유니코드 초성 인덱스(0~18)
    const choTable = [
      -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
    ];

    // 2. 중성 매핑 테이블: 조합형 비트값(0x03~0x1E) -> 유니코드 중성 인덱(0~20)
    const jungTable = [
      -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, -1, -1, 8, 9, 10, 11, 12, 13, 14, -1, -1, 15, 16, 17, 18, 19, 20, 21, 22, -1, -1
    ];

    // 3. 종성 매핑 테이블: 조합형 비트값(0x02~0x1E) -> 유니코드 종성 인덱스(1~27)
    // 초성/중성만 있고 받침이 없는 글자는 종성 비트가 0x01(채움 코드)이 되므로 이 경우 0으로 강제 보정합니다.
    const jongTable = [
      -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, -1, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, -1, -1
    ];

    const cIdx = choTable[cho];
    const jIdx = jungTable[jung];
    const dIdx = (jong === 0x01 || jong === 0x00) ? 0 : jongTable[jong];

    // 규격 외 기호 및 예외 문자 방어 처리
    if (cIdx === -1 || jIdx === -1 || dIdx === -1) {
      if (cho === 0xD || cho === 0x1A) return "·"; 
      return "";
    }

    // 초성(19자) * 21 * 28 + 중성(21자) * 28 + 종성(28자) 한글 유니코드 합성 방정식 연산
    const uniCode = (cIdx * 21 * 28) + (jIdx * 28) + dIdx + 0xAC00;
    return String.fromCharCode(uniCode);
  }

  /**
   * 1바이트 아스키와 2바이트 조합형 글자가 가변으로 뒤섞인 바이트 스트림 정밀 디코더
   */
  function decodeJohabString(uint8Array) {
    let result = "";
    let i = 0;
    
    while (i < uint8Array.length) {
      const b1 = uint8Array[i];
      if (b1 === 0) break; // 문자열 끝 감지

      if (b1 & 0x80) {
        if (i + 1 >= uint8Array.length) break;
        const b2 = uint8Array[i + 1];
        
        // 2바이트를 결합해 16비트 조합형 코드로 스캔 연산
        const code = (b1 << 8) | b2;
        result += decodeJohabChar(code);
        i += 2; // 2바이트 한글 크기만큼 전진
      } else {
        // 1바이트 영문 및 기호 아스키 복원
        if (b1 >= 32 && b1 <= 126) {
          result += String.fromCharCode(b1);
        } else if (b1 === 32) {
          result += " ";
        }
        i += 1; // 1바이트 전진
      }
    }
    
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
//2
  /**
   * player-parser.js - Part 2: 외부 인터페이스 리턴 마감 개방
   */

  return {
    extractTitle(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      
      try {
        if (ext === '.ims') {
          if (u8.length < 36) return filename.replace(/\.[^.]+$/, '');
          // 오프셋 6번지부터 30바이트간 명시된 상용 조합형 문자 배열 디코딩
          const songNameBytes = u8.subarray(6, 36);
          return decodeJohabString(songNameBytes) || filename.replace(/\.[^.]+$/, '');
        } 
        else if (ext === '.mod') return readAscii(u8, 0, 20);
        else if (ext === '.s3m') return readAscii(u8, 0, 28);
        else if (ext === '.xm') return readAscii(u8, 17, 20);
        else if (ext === '.it') return readAscii(u8, 4, 26);
      } catch (e) { 
        console.error("바이너리 메타데이터 제목 변환 실패:", e); 
      }
      return filename.replace(/\.[^.]+$/, '');
    },

    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 154) return null;

      let offset = 30; // Signature 및 Reserved 데이터 스킵

      // .ISS 텍스트 메타데이터 정보 복원 디코딩
      const writer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const composer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const singer = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;
      const editor = decodeJohabString(u8.subarray(offset, offset + 30)); offset += 30;

      const recCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;
      const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;

      // 카라오케 시간 틱 싱크 레코드 전사
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

      // 개당 64바이트로 구성된 노래방 자막 줄 한글 변환 전사
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
        if (offset + 64 > u8.length) break;
        scripts.push(decodeJohabString(u8.subarray(offset, offset + 64)));
        offset += 64;
      }

      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
