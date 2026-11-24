/**
 * player-lyric.js - 가사(ISS) 관련 모듈 모음
 */
window.Lyric = (function() {
  // 외부 반환용 함수
  return {
	currentIssData : null,
	resultIndex : -1,
	issName : "",
	currentRecord : {},

    meta : { writer: "", composer: "", singer: "", editor: "" },
    lyrics : [], // 🎯 [구조 교정]: 이제 단순 바이트 맵이 아니라, 완성된 { tick, line, textRuns } 프리렌더링 데이터가 담깁니다.
    currentIndex : -1,
    lineBytes : [], // 바이트 단위 정밀 역산을 위한 버퍼 리스트
    scripts : [], // 전체 가사 버퍼

	/**
	 * 가사 읽기
	 */
	async load(track){
		if (track.issFileObject) {
			this.issName = track.issFileObject.name; // 가사 파일명
			const issBuf = await track.issFileObject.arrayBuffer();
			//if (window.ChipTuneTitleParser) this.currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
            this.parse(issBuf); // 2026-10-30 금
            this.currentIssData = 1; // 이전버전 호환용
		} else if (!track.fileObject) {
			const lastDotIdx = track.url.lastIndexOf(".");
			const serverIssUrl =
				lastDotIdx === -1 ? track.url + ".ISS" : track.url.substring(0, lastDotIdx) + ".ISS";
			try {
				const issCheck = await fetch(serverIssUrl, { method: "HEAD" });
				if (issCheck.ok) {
					const issResponse = await fetch(serverIssUrl);
					const issBuf = await issResponse.arrayBuffer();
//					if (window.ChipTuneTitleParser)
//						this.currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
                    this.parse(issBuf); // 2026-10-30 금
                    this.currentIssData = 1; // 이전버전 호환용
					this.issName = serverIssUrl.split('/').pop();
				}
			} catch (e) {}
		}
	},

	/**
	 * 틱 정보로 가사 라인과 하이라이트 부분 계산 - 구버전(폐기)
	 * /
	update(adjustedTick){
		let left = 0;
		let right = this.currentIssData.records.length - 1;
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			if (this.currentIssData.records[mid].kasaTick <= adjustedTick) {
				this.resultIndex = mid;
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}
		if (this.resultIndex >= 0) {
			this.currentRecord = this.currentIssData.records[this.resultIndex];
			const rawLine = this.currentIssData.scripts[this.currentRecord.line] || "";
			const currentLine = rawLine.trimEnd();
			let nextLine = "";
			if (this.resultIndex < this.currentIssData.records.length - 1) {
				for (let i = this.resultIndex + 1; i < this.currentIssData.records.length; i++) {
					if (this.currentIssData.records[i].line !== this.currentRecord.line) {
						const rawNext = this.currentIssData.scripts[this.currentIssData.records[i].line] || "";
						nextLine = rawNext.trimEnd();
						break;
					}
				}
			}
			let bytePos = 0;
			let charPos = 0;
			const startX = this.currentRecord.startX;
			const widthX = this.currentRecord.widthX;
			while (bytePos < startX && charPos < currentLine.length) {
				bytePos += currentLine.charCodeAt(charPos) > 127 ? 2 : 1;
				charPos++;
			}
			bytePos = 0;
			while (bytePos < widthX && charPos < currentLine.length) {
				bytePos += currentLine.charCodeAt(charPos) > 127 ? 2 : 1;
				charPos++;
			}
			const highlightEnd = charPos; 
			return {currentLine: currentLine, highlightEnd: highlightEnd, nextLine: nextLine};
		} else {
			return {currentLine:this.resultIndex, highlightEnd:0, nextLine:0};
		}
	},
    /**/

    // iss 파싱 (바이트 기반 하이라이트 인터벌 사전 실시간 추출 구조화)
    parse(arrayBuffer) {
      this.lyrics = [];
      this.currentIndex = -1;
      this.lineBytes = [];
      this.scripts = [];
    
      const u8Array = new Uint8Array(arrayBuffer);
      if (u8Array.length < 154) return []; // 비정상 iss 파일
    
      // 헤더 구조에서 V2 판단 (IMPlay Song V 문자열 포함 여부 검증)
      let headEnd = 0;
      while (headEnd < 154 && u8Array[headEnd] !== 0) headEnd++;
      const v2 = String.fromCharCode(...u8Array.subarray(0, headEnd)).includes("IMPlay Song V");
    
      let offset = 150; 
    
      // 메타데이터 정보 추출
      this.meta.writer   = JohabDecoder.decode(arrayBuffer,  30,  30).trim(); // 작사
      this.meta.composer = JohabDecoder.decode(arrayBuffer,  60,  30).trim(); // 작곡
      this.meta.singer   = JohabDecoder.decode(arrayBuffer,  90, 120).trim(); // 가수
      this.meta.editor   = JohabDecoder.decode(arrayBuffer, 120, 150).trim(); // ISS 제작
console.log(this.meta);
    
      // 제어 레코드 수
      const recCount  = u8Array[offset] | (u8Array[offset + 1] << 8);    offset += 2;
      // 가사 라인 수
      const lineCount = u8Array[offset] | (u8Array[offset + 1] << 8);    offset += 2;
    
      // 1. 🎯 제어 레코드(큐) 추출 및 시간 동기화 규격 교정
      const rawRecords = [];
      let due = 0; // 틱 버퍼 (보정된 값 저장)
      for (let i = 0; i < recCount; i++) {
        const stored = u8Array[offset] | (u8Array[offset + 1] << 8); // 틱값
        const line   = u8Array[offset + 2]; // 가사라인
        const startX = u8Array[offset + 3]; // 하이라이트 시작지점
        const widthX = u8Array[offset + 4]; // 하이라이트 끝지점
    
        // 🎯 V2 파일은 그대로 쓰고, 구버전 파일은 * 10 / 8 (비트시프트 정수연산)을 적용합니다.
        const tick8 = v2 ? stored : ((stored * 10) >> 3) & 0xffff;
        //due = Math.max(due, tick8 * 8); // 시간이 역행하지 않도록 누적 상한 가드
        due = Math.max(due, tick8); // 시간이 역행하지 않도록 누적 상한 가드만 적용
        //due = Math.max(due, stored); // 시간이 거꾸로 흐르지 않게 상한 가드만 유지
    
        rawRecords.push({ tick: due, line, startX, widthX });
        offset += 5; // 제어 레코드 길이
      }
    
      // 가사 라인 추출
      // 🎯 [순정 고정폭 버퍼 복원]: trim()이나 replace()를 전면 차단하여 연속된 내부 공백 레이아웃을 완벽 보존합니다.
      // 2. 🎯 가사 라인 오리지널 바이트 버퍼 통째로 보존
      for (let i = 0; i < lineCount; i++) {
        // 파일이 급격히 끝났을 때를 대비하여 남은 데이터의 최대 한계 오프셋을 안전하게 역산
        const availableLen = Math.min(64, u8Array.length - offset);
        if (availableLen <= 0) break; // 더 이상 읽을 데이터가 없으면 가드 탈출
    
        const scriptBytes = u8Array.subarray(offset, offset + availableLen);
        let end = 0;
        while (end < availableLen && scriptBytes[end] !== 0) end++;
    
        // 🎯 [핵심]: 문자열로 변환해두지 않고, 순수한 원본 바이너리 바이트 상태 그대로 저장합니다.
        this.lineBytes.push(scriptBytes.slice(0, end));
        this.scripts.push(JohabDecoder.decode(arrayBuffer, offset, 64)); // 전체 가사 출력용.
    
        offset += 64;
      }
    
      // 🎯 [완치 포인트 1]: 이전 좌표 조건부 누적 연산 매커니즘 가동
      // [바이트 구간 누적 처리용 임시 저장소]
      let currentLine = -1;
      let reach = 0;
      let activeRuns = [];
      const intermediateLyrics = [];
    
      // 4. 🎯 제어 레코드 와 가사라인을 매핑 [바이트 좌표 1:1 직결 매핑]
      rawRecords.forEach((rec) => {
        if (rec.line >= 0 && rec.line < this.lineBytes.length) {
          // 줄 번호가 바뀌었거나, 현재 시작 좌표(startX)가 이전 도달 범위(reach)보다 작아지면 누적 리셋!
          if (rec.line !== currentLine || rec.startX < reach) {
            currentLine = rec.line;
            activeRuns = [];
            reach = 0;
          }
    
          // 해당 틱 타이밍에 켜져야 하는 시작 바이트와 끝 바이트의 절대 오프셋 계산
          const fromByte = rec.startX;
          const toByte = rec.startX + rec.widthX;
          reach = toByte;
    
          // 새로운 영역 구간을 겹치지 않게 sorted 결합 누적
          activeRuns = this._addRun(activeRuns, fromByte, toByte);
    
          // 🎯 AdPlugPlayer 코어 틱과 1:1 매칭
          intermediateLyrics.push({
            tick: rec.tick,  // 🎯 순수한 바이너리 원본 틱 바인딩
            line: rec.line,
            // 각 시점마다 독립적으로 누적 보존된 바이트 맵 조각 리스트 복사
            runs: activeRuns.map(r => [...r])
          });
        }
      });
    
      // 틱 수 순서대로 정렬
      // 🎯 [완치 포인트 2]: 고속 랩 구간 명령어 유실 방지를 위해 기존의 임의 중복 제거(filter) 로직 전면 폐기
      // 타임라인 시간 축 정렬
      intermediateLyrics.sort((a, b) => a.tick - b.tick);
    
      // 🎯 🔥 [핵심 추가]: 곡을 틀기 전, 모든 가사 프레임의 한글 조각 빌드를 미리 수행합니다!
      const finalRenderedLyrics = [];
      const interLen = intermediateLyrics.length;
    
      for (let i = 0; i < interLen; i++) {
        const currentLyric = intermediateLyrics[i];
        const rawBytes = this.lineBytes[currentLyric.line] ?? new Uint8Array(0);
        
        // 🎯 [완치 포인트 2]: 현재 틱에 활성화되어 켜져야 하는 누적 바이트 구간 정보 수령
        // 100ms 타이밍 사이에서 선형 보간 처리를 미세하게 쪼갤 필요 없이 기저 상태 빌드
        let runsToRender = currentLyric.runs;
    
        // 🎯 [완치 포인트 3]: 한글 2바이트 및 특수문자 잘림 방지 (글자 경계선 강제 정렬 기술)
        // 칠해진 영역(lit)과 안 칠해진 영역을 글자 단위로 완벽하게 복원 매핑하여 텍스트 토큰 배열로 빌드
        // 조합형 텍스트 토큰 미리 조립 수행
        const textRuns = [];
        const byteLength = rawBytes.length;
        let byteIdx = 0;
    
        const buffer = rawBytes.buffer;
        const byteOffset = rawBytes.byteOffset;
    
        // 룩업 테이블 빌드 속도 향상
        const runFlags = new Uint8Array(byteLength + 1);
        const runCount = runsToRender.length;
        for (let r = 0; r < runCount; r++) {
          const rStart = Math.max(0, runsToRender[r][0]);
          const rEnd = Math.min(runFlags.length, runsToRender[r][1]);
          for (let b = rStart; b < rEnd; b++) {
            runFlags[b] = 1;
          }
        }
    
        while (byteIdx < byteLength) {
          const start = byteIdx;
          // 현재 바이트가 ASCII인지 고전 2바이트 조합형 글자/특수문자인지 엄격히 스캔 판정
          if (rawBytes[byteIdx] < 0x80) byteIdx += 1;
          else byteIdx += 2;
          const end = byteIdx;
    
          // 이 온전한 한 글자가 불이 켜진 누적 바이트 구간(activeRuns) 내부에 속하는지 대조 판별
          const isLit = runFlags[start] === 1;
          const charText = JohabDecoder.decode(buffer, byteOffset + start, end - start);
    
          // 동일한 상태(불 켜짐 여부)를 가진 인접한 문자들을 하나로 묶어 결합 성능 최적화
          const lastRunIdx = textRuns.length - 1;
          if (lastRunIdx >= 0 && textRuns[lastRunIdx].lit === isLit) {
            textRuns[lastRunIdx].text += charText;
          } else {
            textRuns.push({ text: charText, lit: isLit });
          }
        }
    
        // 완전히 가공된 가사 스냅샷 최종 확정 보관
        finalRenderedLyrics.push({
          tick: currentLyric.tick,
          line: currentLyric.line,
          textRuns: textRuns
        });
      }
    
      this.lyrics = finalRenderedLyrics;
      return this.lyrics;
    },
    
    // 기존의 구간(구간 배열, runs)에 새로운 구간(from, to)을 겹치지 않게 병합(Merge)하여 추가
    // 만약 기존에 [[10, 20], [30, 40]]이라는 두 구간(runs)이 있다고 가정해 봅시다.
    // 여기에 새로운 구간 _addRun(runs, 15, 35)를 추가하면 어떻게 될까요?
    // • [10, 20]은 [15, 35]와 겹칩니다. \(\rightarrow \) [10, 35]로 합쳐집니다.
    // • [30, 40]도 [10, 35]와 겹칩니다. \(\rightarrow \) 최종적으로 [10, 40]이 됩니다.
    // • 결과는 겹치는 부분이 모두 사라진 [[10, 40]]이 됩니다.
    _addRun(runs, from, to) {
      const merged = []; // 1. 결과를 담을 빈 배열을 생성합니다.
      // 2. 기존에 있던 구간들([a, b])을 하나씩 순회(Loop)합니다.
      for (const [a, b] of runs) {
        // 3. 기존 구간과 새 구간이 '전혀 겹치지 않는' 경우입니다.
        // b < from : 기존 구간의 끝(b)이 새 구간의 시작(from)보다 먼저 끝남
        // a > to   : 기존 구간의 시작(a)이 새 구간의 끝(to)보다 뒤에 시작함
        if (b < from || a > to) merged.push([a, b]); // 겹치지 않으므로 기존 구간을 그대로 결과에 넣습니다.
        // 4. 기존 구간과 새 구간이 '일부라도 겹치는' 경우입니다.
        else {
          // 두 구간을 아우르는 가장 최소 시작점과 가장 최대 끝점을 구합니다.
          // 이를 통해 새 구간(from, to)의 범위가 점점 확장됩니다.
          from = Math.min(from, a); to = Math.max(to, b);
        }
      }
      // 5. 루프가 끝나면, 최종적으로 확장된(혹은 겹치는 게 없어서 그대로인) 
      // 새 구간 [from, to]를 결과 배열에 추가합니다.
      merged.push([from, to]);
      // 6. 모든 구간이 잘 합쳐졌지만 순서가 뒤죽박죽일 수 있으므로,
      // 각 구간의 시작점(x[0], y[0])을 기준으로 오름차순 정렬하여 반환합니다.
      return merged.sort((x, y) => x[0] - y[0]);
    },
    
    /**
     * 일시정지 해제나 뒤로가기/앞으로가기(Seek) 시에도 싱크가 실시간 맞도록 설계
     * 실시간 동적 자막 서칭 및 렌더링에 적합한 데이터 구조 스냅샷 리포트
     * 🎯 [실시간 바이트 슬라이싱 보간 검색 엔진]
     * 자바스크립트의 문자열 길이 한계를 우회하고 파일 오리지널 바이트 스케일 위에서 직접 자막 연산
     * 🎯 [한글 깨짐 가드 + 실시간 바이트 결합 추적 검색 엔진]
     * 🎯 [초고속 연산 및 가비지 컬렉션 최소화 가드 버전 검색 엔진]
     * 바이트 매핑 구조 최적화 및 Johab 디코더 호출 최소화로 CPU 부하 전면 해소
     * 🎯 [초고속 연산 프리레이터 패스 스루 엔진]
     * 미리 빌드된 메모리 상의 텍스트 구조를 인덱스 대조만으로 즉시 리턴 (CPU 점유율 0%에 수렴)
     */
    update(currentTick) {
      if (this.lyrics.length === 0) return null;
      
      // 1. 현재 타임라인 틱에 위치한(걸치거나 지나간) 자막 레코드(현재 상태) 찾기
      let activeIndex = -1;
      const len = this.lyrics.length;
      
      // 타임라인 서칭 (이 연산마저 더 줄이고 싶다면 이진 탐색을 쓸 수 있으나, 선형도 충분히 빠름)
      for (let i = 0; i < len; i++) {
        if (currentTick >= this.lyrics[i].tick) {
          activeIndex = i;
        } else {
          break;
        }
      }
    
      // 가사가 아직 시작되지 않은 초반 대기 상태
      if (activeIndex < 0) {
        return { line: 0, textRuns: [{ text: "                          🎵 (간주 중)", lit: false }] };
      }
    
      this.currentIndex = activeIndex;
      const currentLyric = this.lyrics[activeIndex];
      this.resultIndex = currentLyric.line; // 전체가사 창 매핑용

      // 다음 가사
      let nextLine = "";
      if(activeIndex>=0){
          for(var i=activeIndex+1; i<this.lyrics.length; i++){
              if(currentLyric.line != this.lyrics[i].line){
                  nextLine = this.scripts[this.lyrics[i].line];
                  break;
              }
          }
      }
      // 🎯 이미 빌드가 완료된 객체를 그대로 포워딩만 해줍니다. 디코딩/루프 연산이 전혀 없습니다.
      return {
        line: currentLyric.line,
        textRuns: currentLyric.textRuns, // 🎯 app.js가 바로 루프 돌며 출력할 수 있는 조각 배열 전달
        nextLine: nextLine
      };
    },

    // 재설정
    reset() {
      this.lineBytes = []; // 가사배열
      this.lyrics = []; // 교정된 가사진행 레코드정보
  	this.scripts = []; // 가사라인(전체가사 출력용)
      this.currentIndex = -1; // 가사 배열 위치
      this.is_ims_loaded = false; // ims 적재 여부
      this.is_bnk_loaded = false; // bnk 적재 여부
    }
  }

})();
