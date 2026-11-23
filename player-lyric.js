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

	/**
	 * 가사 읽기
	 */
	async load(track){
		if (track.issFileObject) {
			this.issName = track.issFileObject.name; // 가사 파일명
			const issBuf = await track.issFileObject.arrayBuffer();
			if (window.ChipTuneTitleParser) this.currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
		} else if (!track.fileObject) {
			const lastDotIdx = track.url.lastIndexOf(".");
			const serverIssUrl =
				lastDotIdx === -1 ? track.url + ".ISS" : track.url.substring(0, lastDotIdx) + ".ISS";
			try {
				const issCheck = await fetch(serverIssUrl, { method: "HEAD" });
				if (issCheck.ok) {
					const issResponse = await fetch(serverIssUrl);
					const issBuf = await issResponse.arrayBuffer();
					if (window.ChipTuneTitleParser)
						this.currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
					this.issName = serverIssUrl.split('/').pop();
				}
			} catch (e) {}
		}
	},

	/**
	 * 틱 정보로 가사 라인과 하이라이트 부분 계산
	 */
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
	}
  }
})();
