/**
 * player-parser.js - IMS/ROL/VGM 하드웨어 사양별 전체 시간 무결성 디코더 마스터 엔진
 */
window.ChipTuneTitleParser = (function() {
  
  /**
   * 조합형한글(1361) 을 utf-8 로 변환하는 함수 [사용 X]
   */
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
  
  /**
   * 버퍼를 잘라서 한글변환 중계해주는 함수 [사용 x]
   */
  function readNullTerminated(u8Array, offset, maxLength) {
    const slice = u8Array.subarray(offset, offset + maxLength);
    const nullIndex = slice.indexOf(0);
    return decodeJohab(nullIndex >= 0 ? slice.subarray(0, nullIndex) : slice);
  }

  /**
   * 부호 있는 8비트 값 추출
   */
  function readInt8(u8Value) { return u8Value & 0x80 ? u8Value - 256 : u8Value; }

  /**
   * 곡 전체 트랙정보를 탐색하여 재생시간(누적tick)을 계산함
   * 
   */
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

  // 외부 반환용 함수
  return {
	/**
	 * IMS 파일 해더 파서
	 */
    parseImsHeader(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 70) return null;
      const view = new DataView(arrayBuffer);
      return {
        basicTempo: view.getUint16(60, true) || 120,
        tickBeat: u8[36] || 24,
        totalTick: view.getUint32(38, true) || 0,
        //title: readNullTerminated(u8, 6, 30)
        title: JohabDecoder.decode(arrayBuffer, 6, 30)  // 조합형한글 변환 모듈 변경
      };
    },

	/**
	 * ROL 파일 해더 파서
	 */
    parseRolHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      return {
        basicTempo: 120,
        tickBeat: 12,
        totalTick: calculateRolTotalTicks(u8),
        title: filename.substring(0, filename.lastIndexOf('.')) || filename
      };
    },

	/**
	 * VGM 파일 해더 파서
	 */
    // [버그 박멸 핵심 2] VGM 오리지널 샘플 해상도 헤더 독립 추출기 장착
    parseVgmHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 64) return { duration: 0, title: filename };
      const view = new DataView(arrayBuffer);
      
      // Offset 24 (0x18): VGM 고유의 총 샘플 수 (Total Samples, uint32 LE)
      const totalSamples = view.getUint32(24, true);
      // VGM 표준 클럭 주파수 레이트는 전 세계 공통 항상 44100Hz로 정형화 설계됨
      const duration = totalSamples / 44100;

	  // 제목찾기
      const gd3Offset = view.getUint32(0x14, true); // GD3 테그 위치
      //console.log(`gd3Offset [${gd3Offset}][${(0x14+gd3Offset).toString(16)}]`);
  
	  //const signature = gd3Offset?view.getUint32(0x14+gd3Offset, true):0;
	  const signature = gd3Offset?new TextDecoder('utf-8').decode(u8.subarray(0x14+gd3Offset,0x14+gd3Offset+4)):0;
      //console.log(`signature [${signature}]`);
//	  const version = gd3Offset?view.getUint32(0x14+gd3Offset+4, true):0;
//      console.log(`version [${version}]`);
	  const majorVersion = gd3Offset?view.getUint16(0x14+gd3Offset+4, false):0;
	  const minorVersion = gd3Offset?view.getUint16(0x14+gd3Offset+6, false):0;
      //console.log(`Version [${majorVersion}.${minorVersion}]`);
	  
	  const gd3Length = gd3Offset?view.getUint32(0x14+gd3Offset+8, true):0;
      //console.log(`gd3Length [${gd3Length}]`);
	  
	  // 제목(영문) 추출
	  let startOffset = 0x14+gd3Offset+12;
	  let addOffset = 0;
	  let check = 0xffff;
	  do{
		check = view.getUint16(startOffset+addOffset);
		addOffset+=2;
		if(startOffset+addOffset >= u8.length) break;
		//console.log('addOffset',addOffset, check.toString(16))
	  }while(check); // 0x00 0x00 이면 문자열 끝
	  const titleEng = gd3Offset?new TextDecoder('utf-16le').decode(u8.subarray(startOffset,startOffset+addOffset)):'';
	  //console.log(`titleEng [${titleEng}]`);

	  // 제목{원문(일어?)} 추출
	  startOffset = startOffset+addOffset+2;
	  addOffset = 0;
	  check = 0xffff;
	  do{
		check = view.getUint16(startOffset+addOffset);
		addOffset+=2;
		if(startOffset+addOffset >= u8.length) break;
		//console.log('addOffset',addOffset, check.toString(16))
	  }while(check); // 0x00 0x00 이면 문자열 끝
	  const titleOrg = gd3Offset?new TextDecoder('utf-16le').decode(u8.subarray(startOffset,startOffset+addOffset)):'';
	  //console.log(`titleOrg [${titleOrg}]`);

	  // 게임명(영어) 추출
	  startOffset = startOffset+addOffset+2;
	  addOffset = 0;
	  check = 0xffff;
	  do{
		check = view.getUint16(startOffset+addOffset);
		addOffset+=2;
		if(startOffset+addOffset >= u8.length){console.log('중지'); break;}
		//console.log('addOffset',addOffset, check.toString(16))
	  }while(check); // 0x00 0x00 이면 문자열 끝
	  const gameEng = gd3Offset?new TextDecoder('utf-16le').decode(u8.subarray(startOffset,startOffset+addOffset)):'';
	  //console.log(`gameEng [${gameEng}]`);

	  // 게임명(원어) 추출
	  startOffset = startOffset+addOffset+2;
	  addOffset = 0;
	  check = 0xffff;
	  do{
		check = view.getUint16(startOffset+addOffset);
		addOffset+=2;
		if(startOffset+addOffset >= u8.length){console.log('중지'); break;}
		//console.log('addOffset',addOffset, check.toString(16))
	  }while(check); // 0x00 0x00 이면 문자열 끝
	  const gameOrg = gd3Offset?new TextDecoder('utf-16le').decode(u8.subarray(startOffset,startOffset+addOffset)):'';
	  //console.log(`gameOrg [${gameOrg}]`);

      return {
        duration: duration || 0,
		signature: signature, majorVersion: majorVersion, minorVersion: minorVersion,
		titleEng: titleEng, titleOrg: titleOrg, gameEng: gameEng, gameOrg: gameOrg,
        title: titleEng || (filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },

	/**
	 * SOP 파일 해더 파서
	 * check 들은 0 이어야 함. 0 아니면 오염된 파일. 
	 */
	 parseSopHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 76) return { title: filename };
      const view = new DataView(arrayBuffer);
	  // 76 바이트 해더 정보들
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,7)); // sopepos
	  const majorVersion = view.getUint8(7);
	  const minorVersion = view.getUint8(8);
	  const versionCheck = view.getUint8(9); // check
	  const fileName = new TextDecoder('utf-8').decode(u8.subarray(10,10+13));
	  //const fileName = JohabDecoder.decode(arrayBuffer, 10, 13);
	  const title = JohabDecoder.decode(arrayBuffer, 23, 31);  // 곡명
	  //const comment = JohabDecoder.decode(arrayBuffer, 7+2+13+31, 13);
	  const percussive = view.getUint8(54); // 타아기모드 여부
	  const checkPercussive = view.getUint8(55); // check
	  const tickBeat = view.getUint8(56); // 비트당 틱 수
	  const checkTickBeat = view.getUint8(57); // check
	  const beatMeasure = view.getUint8(58); // 마디당 비트 수 -> check 용 0 이면 SOP 아님
	  const basicTempo = view.getUint8(59) || 120; // BPM
	  const comment = JohabDecoder.decode(arrayBuffer, 60, 13);
	  const nTracks  = view.getUint8(73); // 채널모드(들)
	  const nInsts  = view.getUint8(74); // 악기수
	  const check = view.getUint8(75); // check
	  
	  const header = {
		signature : signature, majorVersion:majorVersion, minorVersion:minorVersion,
		versionCheck:versionCheck, fileName:fileName, title:title, percussive:percussive,
		checkPercussive:checkPercussive, tickBeat:tickBeat, checkTickBeat:checkTickBeat,
		beatMeasure:beatMeasure, basicTempo:basicTempo, comment:comment, nTracks:nTracks,
		nInsts:nInsts, check:check
	  }
//	  console.log('SOP Header', header);
	  return header;
	 },

	/**
	 * MOD 파일 해더 파서
	 */
    parseModHeader(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 20) return null;
      const view = new DataView(arrayBuffer);
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,4)); // 
	  const title = new TextDecoder('utf-8').decode(u8.subarray(0,20));
	  //console.log(`MOD title [${title}]`);
      return {
        //title: new TextDecoder('utf-8').decode(u8.subarray(0,20))
        title: title
      };
    },

	/**
	 * MID 파일 해더 파서
	 */
    parseMidHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 20) return null; // 
      const view = new DataView(arrayBuffer);

	  // 제목(영문) 추출
	  let startOffset = 0;
	  let addOffset = 0;
	  let check = 0xffff;
	  do{
//		check = view.getUint16(startOffset+addOffset);
		check = view.getUint16(startOffset+addOffset, false);
		addOffset++;
		if(startOffset+addOffset >= u8.length) break;
		//console.log('addOffset',addOffset, check.toString(16))
	  }while(check!=0xff03); // 0xff 0x03 이면 제목시작
	  const length = view.getUint8(addOffset+1); // 제목 길이
	  //console.log('length',length);
	  // 제목 추출
	  //const title = new TextDecoder('utf-8').decode(u8.subarray(addOffset+1+1,addOffset+1+1+length));
	  const title = new TextDecoder('iso-8859-1').decode(u8.subarray(addOffset+1+1,addOffset+1+1+length));
	  //const title = JohabDecoder.decode(arrayBuffer, addOffset+1+1, length);
	  //console.log('title',title);
	  
	  //console.log(`MOD title [${title}]`);
      return {
        //title: new TextDecoder('utf-8').decode(u8.subarray(0,20))
        title: title||(filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },

	/**
	 * MSC 파일 해더 파서
	 */
    parseMscHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 28) return null; // 28~32 바이트
      const view = new DataView(arrayBuffer);
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,16)); // 0
	  //console.log(`MSC signature [${signature}]`);
	  const version = view.getUint16(16, true);
	  //console.log(`MSC version [${version}]`);
	  const desc = new TextDecoder('iso-8859-1').decode(u8.subarray(18,18+64)); // 0
	  //console.log(`MSC desc [${desc}]`);
	  const timer = view.getUint16(82, true);
	  //console.log(`MSC timer [${timer}]`);
	  const nrBlock = view.getUint16(84, true);
	  //console.log(`MSC nrBlock [${nrBlock}]`);
	  const blockLength = view.getUint16(86, true);
	  //console.log(`MSC blockLength [${blockLength}]`);
	  const title = filename.substring(0, filename.lastIndexOf('.')) || filename;
      return {
		signature: signature, version: version, desc: desc, timer: timer, nrBlock: nrBlock,
		blockLength: blockLength, title: title
      };
    },

	/**
	 * DTM 파일 해더 파서
	 */
    parseDtmHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 55) return null; // 
      const view = new DataView(arrayBuffer);
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,12)); // 0
	  //console.log(`DTM signature [${signature}]`);
	  const version = view.getUint8(12); // 
	  //console.log(`DTM version [${version}]`);
	  const title = new TextDecoder('utf-8').decode(u8.subarray(13,13+20)); // 
	  //console.log(`DTM title [${title}]`);
	  const author = new TextDecoder('utf-8').decode(u8.subarray(33,33+20)); // 
	  //console.log(`DTM author [${author}]`);
	  const numpat = view.getUint8(53); // 
	  //console.log(`DTM numpat [${numpat}]`);
	  const numinst = view.getUint8(54); // 
	  //console.log(`DTM numinst [${numinst}]`);
	  // Descript 영역 추출
	  let pos = 55;
	  let buf = [];
	  for(var i=0; i<16; i++){ // 16라인
		const bufstr_length  = view.getUint8(pos++); // 한줄 길이
		//console.log(`DTM bufstr_length  [${bufstr_length }]`);
//		if(bufstr_length){
			const bufstr = new TextDecoder('utf-8').decode(u8.subarray(pos,pos+bufstr_length)); // 한줄추출
			//console.log(`DTM bufstr [${bufstr}]`);
			buf.push(bufstr);
//		}
		pos+=bufstr_length;
	  }
	  //console.log(`DTM buf  [${buf }]`);
	  //console.log('DTM buf',buf);
 
      return {
		signature: signature, version: version, author: author, numpat: numpat,
		numinst: numinst, desc:buf,
		title: title || (filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },
	
	// DMO 파일은 decrypt -> unpack 후 S3M 형식으로 해더를 읽는다.


	/**
	 * XAD 파일 해더 파서
	 */
    parseXadHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 80) return null; // 
      const view = new DataView(arrayBuffer);
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,4)); // XAD!
	  //console.log(`XAD signature [${signature}]`);
	  const title = new TextDecoder('utf-8').decode(u8.subarray(4,4+36)); // 
	  //console.log(`XAD title [${title}]`);
	  const author = new TextDecoder('utf-8').decode(u8.subarray(40,40+36)); // 
	  //console.log(`XAD author [${author}]`);
	  const fmt = view.getUint16(76,true); // 
	  //console.log(`XAD format [${fmt}]`);
	  const speed = view.getUint8(78); // 
	  //console.log(`XAD speed [${speed}]`);
	  const reserved_a = view.getUint8(79); // 예약
	  //console.log(`XAD reserved_a [${reserved_a}]`);

      return {
		signature: signature, author: author, 
		fmt: fmt, speed: speed, reserved_a: reserved_a,
		title: title || (filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },

	/**
	 * RAW 파일 해더 파서 - 사용않음
	 */
    parseRawHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 80) return null; // 
      const view = new DataView(arrayBuffer);
	  const signature = new TextDecoder('utf-8').decode(u8.subarray(0,8)); // RAWADATA
	  console.log(`RAW signature [${signature}]`);
	  const clock = view.getUint16(8,true); // clock speed
	  console.log(`RAW clock [${clock}]`);

      return {
		signature: signature, author: author, 
		fmt: fmt, speed: speed, reserved_a: reserved_a,
		title: title || (filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },

	/**
	 * S3M 파일 해더 파서
	 */
    parseS3mHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 28) return null;
      const view = new DataView(arrayBuffer);
	  //const title = new TextDecoder('utf-8').decode(u8.subarray(0,28));
	  const title = JohabDecoder.decode(arrayBuffer, 0, 28);
	  //console.log(`S3M title [${title.trim()}]`);
      return {
        //title: new TextDecoder('utf-8').decode(u8.subarray(0,28))
        title: title||(filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },

	/**
	 * XM 파일 해더 파서
	 */
    parseXmHeader(arrayBuffer, filename) {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8.length < 58) return null;
      const view = new DataView(arrayBuffer);
	  //const title = new TextDecoder('utf-8').decode(u8.subarray(0,28));
	  const title = JohabDecoder.decode(arrayBuffer, 0x11, 20);
	  //console.log(`XM title [${title.trim()}]`);
      return {
        //title: new TextDecoder('utf-8').decode(u8.subarray(0,28))
        title: title.trim()||(filename.substring(0, filename.lastIndexOf('.')) || filename)
      };
    },


	 extractHeader(arrayBuffer, filename){
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (ext === '.ims') return this.parseImsHeader(arrayBuffer);
      if (ext === '.dtm') return this.parseDtmHeader(arrayBuffer, filename);
      if (ext === '.mid') return this.parseMidHeader(arrayBuffer);
      if (ext === '.mod') return this.parseModHeader(arrayBuffer);
      if (ext === '.msc') return this.parseMscHeader(arrayBuffer, filename);
      if (ext === '.rol') return this.parseRolHeader(arrayBuffer, filename);
      if (ext === '.s3m') return this.parseS3mHeader(arrayBuffer, filename);
      if (ext === '.sop') return this.parseSopHeader(arrayBuffer, filename);
      if (ext === '.xad') return this.parseXadHeader(arrayBuffer, filename);
      if (ext === '.xm' ) return this.parseXmHeader(arrayBuffer, filename);
      if (ext === '.vgm' || ext === '.vgz') return this.parseVgmHeader(arrayBuffer, filename);
	  return {title:filename};
	 },

	/**
	 * 파일별 해더 파서, 파일명에 사용할수없는 코드 제거
	 */
    extractTitle(arrayBuffer, filename) {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (ext === '.ims') return this.parseImsHeader(arrayBuffer)?.title || filename;
      if (ext === '.dtm') return this.parseDtmHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.mid') return this.parseMidHeader(arrayBuffer)?.title || filename;
      if (ext === '.mod') return this.parseModHeader(arrayBuffer)?.title || filename;
      if (ext === '.msc') return this.parseMscHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.rol') return this.parseRolHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.s3m') return this.parseS3mHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.sop') return this.parseSopHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.vgm' || ext === '.vgz') return this.parseVgmHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.xad') return this.parseXadHeader(arrayBuffer, filename)?.title || filename;
      if (ext === '.xm') return this.parseXmHeader(arrayBuffer, filename)?.title || filename;
      return filename.replace(/\.[^.]+(?=\?|\$)/, '');
    },

	/**
	 * ISS 파일 파서
	 */
    parseISSFile(arrayBuffer) {
      const u8 = new Uint8Array(arrayBuffer); if (u8.length < 154) return null;
      let offset = 30; // ISS 파일 사인정보 스킵
	  // 해더정보
	  const writer    = readNullTerminated(u8, offset, 30); offset += 30; // 작사
	  const composer  = readNullTerminated(u8, offset, 30); offset += 30; // 작곡
	  const singer    = readNullTerminated(u8, offset, 30); offset += 30; // 가수
	  const editor    = readNullTerminated(u8, offset, 30); offset += 30; // 편곡
      const recCount  = u8[offset] | (u8[offset + 1] << 8); offset += 2;  // 총레코드수(tick에 따른 가사진행 정보)
	  const lineCount = u8[offset] | (u8[offset + 1] << 8); offset += 2;  // 총가사라인수
	  // 레코드정보
	  const records = [];
      for (let i = 0; i < recCount; i++) {
		if (offset + 5 > u8.length) break;
		const kasaTick = u8[offset] | (u8[offset + 1] << 8); // 틱값. 후위 2바이트 정수
	    //const line = readInt8(u8[offset + 2]);
	    const line = u8[offset + 2]; // 가사라인. 부호 없는 값 이어야 함.
	    const startX = readInt8(u8[offset + 3]); // 현재 진행 가사 시작지점
	    const widthX = readInt8(u8[offset + 4]); // 현재 진행 가사 글자수
		records.push({ kasaTick, line, startX, widthX }); // 레코드정보 추가
		offset += 5; // 다음 offset 으로 이동
	  } 
	  // 가사정보
      const scripts = [];
      for (let i = 0; i < lineCount; i++) {
		if (offset + 64 > u8.length) break;
		// 한줄 가사
		//const lineText = readNullTerminated(u8, offset, 64);
		const lineText = JohabDecoder.decode(arrayBuffer, offset, 64); // 조합형한글 변환 모듈 변경
		scripts.push(lineText); // 가사정보 추가
		offset += 64; // 다음 offset 으로 이동
	  }
	  
window['iss']={ writer, composer, singer, editor, records, scripts }; // 디버그
	  // ISS 정보 반환
      return { writer, composer, singer, editor, records, scripts };
    }
  };
})();
