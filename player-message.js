    const errorMessage = document.getElementById("errorMessage");

    // =================================================================
    // 📟 [중앙 리스너] DOS 레트로 콘솔 로그 수신 및 타자기 처리 엔진
    // 📟 [완벽 직렬화 큐] DOS 레트로 콘솔 로그 수신 및 순차 타자기 드라이버
    // 📟 [완벽 직렬화 큐 + 타임스탬프 복원] DOS 레트로 콘솔 로그 엔진
    // =================================================================
    const logQueue = [];    // 들어오는 로그 메시지들을 순서대로 쌓아둘 큐 보관함
    let isProcessing = false; // 현재 타자기가 돌아가고 있는 중인지 나타내는 플래그

    window.addEventListener("dos-log", async (e) => {
        // 1. 이벤트가 들어오면 일단 대기열(Queue)에 무조건 적재합니다.
        logQueue.push(e.detail);
        // 2. 만약 타자기가 쉬고 있다면 대기열 처리 프로세스를 가동합니다.
        if (!isProcessing) {
            processLogQueue();
        }
    });

    /**
     * 대기열에 쌓인 로그를 단 하나씩 순서대로 꺼내어 타자기를 치는 코어 엔진
     * 대기열에서 로그를 꺼내 타임스탬프와 함께 순차 타이핑하는 코어
     */
    async function processLogQueue() {
        if (logQueue.length === 0 || !errorMessage) {
            isProcessing = false; // 더 이상 처리할 로그가 없으면 휴식 상태로 전환
            return;
        }

        isProcessing = true; // 타자기 가동 시작 (다른 로그들은 큐에서 대기)
        const { message, speed } = logQueue.shift(); // 맨 앞의 로그 꺼내기
        const speedMs = speed || 15; // 기본 타이핑 속도

        // 1. 기존에 맨 밑에서 깜빡이던 커서 라인이 있다면 고정 상태로 변경
        // 1. [커서 중복 방지] 새로 출력하기 전, 화면에 남아있는 기존 깜빡이 커서 태그만 완벽히 색출해 제거
        // [커서 중복 방지] 새로운 줄을 치기 전에 화면에 존재하는 기존 깜빡이 커서를 완벽히 청소
        const prevPrompt = document.getElementById("dosPromptLine");
        if (prevPrompt) {
            prevPrompt.removeAttribute("id");
            // 기존 깜빡이던 커서 태그 제거하고 순정 프롬프트만 남김
            // 타임스탬프나 본문 문구를 건드리지 않고, 오직 커서 스팬 태그만 정확하게 지웁니다.
            prevPrompt.innerHTML = prevPrompt.innerHTML.replace(/<span class="dos-blink">.*<\/span>/g, ""); 
        }

        // 2. 새 로그 줄 생성 및 콘솔 창에 부착
        // 2. ⏳ [시각 정보 복원] 현재 시각을 [07:29:45] 형태로 추출
        const now = new Date();
        const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;

        // 3. 새 로그 라인을 만들고 타임스탬프를 먼저 박아둡니다.
        // 새 로그 라인 엘리먼트 생성 및 추가
        const lineDiv = document.createElement("div");
        lineDiv.innerHTML = `<span style="color: #888; margin-right: 6px;">${timeStr}</span><span class="type-body"></span>`;
        errorMessage.appendChild(lineDiv);

        // 글자가 실제로 타이핑될 안쪽 스팬 서브 노드 추출
        const typeBodyEl = lineDiv.querySelector(".type-body");

        // 한 문장의 타이핑이 끝날 때까지 비동기 락(Lock) 가동
        // 한 문장의 타이핑이 완벽히 끝날 때까지 Promise로 흐름을 붙잡아 둡니다.
        await new Promise((resolve) => {
	        // 3. 비동기 타자기 출력 스트림 가동
            let i = 0;
            function type() {
                if (i < message.length) {
	                // HTML 태그가 들어왔을 때 통째로 전사하여 깨짐 방지
                    // HTML 태그 깨짐 방지 파싱
                    if (message[i] === '<') {
                        const tagEnd = message.indexOf('>', i);
                        if (tagEnd !== -1) {
                            typeBodyEl.innerHTML += message.substring(i, tagEnd + 1);
                            i = tagEnd + 1;
                        }
                    } else {
                        typeBodyEl.innerHTML += message[i];
                        i++;
                    }
                    errorMessage.scrollTop = errorMessage.scrollHeight;
                    setTimeout(type, speedMs);
                } else {
                    // 4. 출력이 완료되면 문장 끝에 깜빡이는 레트로 커서 장착
                    // 4. 출력이 완벽히 끝난 문장 바로 뒤에만 깜빡이는 단일 커서 부착
                    // 문장이 완벽하게 종료된 순간에만 딱 '단 한 개'의 커서를 부착합니다.
                    typeBodyEl.innerHTML += `<span class="dos-blink"> _</span>`;
                    lineDiv.id = "dosPromptLine";
                    errorMessage.scrollTop = errorMessage.scrollHeight;
                    resolve();  // 타이핑 완료 신호 방출
                }
            }
            type();
        });

        // 5. 큐에 남은 다음 메시지 처리를 위해 재귀 호출
        // 3. 한 문장이 완벽히 끝났으므로, 큐에 남은 다음 메시지를 처리하기 위해 재귀 호출합니다.
        processLogQueue();
    }

    /**
     * 📢 DOS 콘솔 로그 이벤트 발행 헬퍼 함수
     */
    function triggerDosLog(msg, customSpeed = 15) {
        const logEvent = new CustomEvent("dos-log", {
            detail: { message: msg, speed: customSpeed }
        });
        window.dispatchEvent(logEvent);
    }


	/**
     * 📟 DOS 레트로 타자기 효과 로그 프린터
     * 글자를 쪼개어 실시간으로 출력하고, 스크롤을 자동으로 최하단에 밀어 붙입니다.
	 * ---
	 * 사용안함 이벤트 처리
     */
    async function printDosTypewriter(message, speedMs = 15) {
        if (!errorMessage) return;
        
        // 1. 기존에 깜빡이던 커서 라인이 있다면 깔끔하게 지워줍니다.
        const prevPrompt = document.getElementById("dosPromptLine");
        if (prevPrompt) {
            prevPrompt.removeAttribute("id");
            prevPrompt.innerHTML = `C:\\MUSIC&gt;`;
        }

        // 2. 새로운 줄 생성 (텍스트가 한 글자씩 쌓일 공간)
        const lineDiv = document.createElement("div");
        errorMessage.appendChild(lineDiv);

        // 3. HTML 태그가 메시지에 포함되어 있다면 태그 단위를 보존하고, 일반 글자만 쪼랩 출력
        let i = 0;
        return new Promise((resolve) => {
            function type() {
                if (i < message.length) {
                    // HTML 태그 처리 (<로 시작해서 >로 끝나는 부분은 한 번에 출력)
                    if (message[i] === '<') {
                        const tagEnd = message.indexOf('>', i);
                        if (tagEnd !== -1) {
                            lineDiv.innerHTML += message.substring(i, tagEnd + 1);
                            i = tagEnd + 1;
                        }
                    } else {
                        // 일반 글자는 한 글자씩 추가
                        lineDiv.innerHTML += message[i];
                        i++;
                    }
                    
                    // 글자가 찍힐 때마다 DOS 창처럼 스크롤을 맨 아래로 동기화
                    errorMessage.scrollTop = errorMessage.scrollHeight;
                    setTimeout(type, speedMs); // 타이핑 속도 조절
                } else {
                    // 4. 문장이 끝나면 맨 뒤에 깜빡이는 커서 레이어 장착!
                    lineDiv.innerHTML += ` <span class="dos-blink">_</span>`;
                    lineDiv.id = "dosPromptLine";
                    errorMessage.scrollTop = errorMessage.scrollHeight;
                    resolve(); // 타이핑 완료 신호 반환
                }
            }
            type();
        });
    }

/*
① 곡 로딩 시작 지점 (loadAndPlayTrack 최상단)
    async function loadAndPlayTrack() {
        const track = currentPlaylist[playingIndex];
        if (!track) return;

        // 📟 타자기 감성 시동
        if (errorMessage) {
            errorMessage.classList.remove('hidden');
            // 문장이 주르륵 찍힐 때까지 동기적으로 기다렸다가 연산을 이어갑니다.
            await printDosTypewriter(`C:\\MUSIC&gt; LOAD "${track.filename}" ...`, 20);
        }



② 악기 뱅크 판별 지점 및 가사 분석 지점
        if (window.uploadedBnkMap && window.uploadedBnkMap.has(targetBnkName.toLowerCase())) {
            await printDosTypewriter(`[BANK] LOCAL MAP DIRECT: "${targetBnkName}" LOCKED.`);
        } else if (window.uploadedBnkMap && window.uploadedBnkMap.has("standard.bnk")) {
            await printDosTypewriter(`[BANK] SHARE MAP ACTIVE: "STANDARD.BNK" LOADED.`);
        }



③ 최종 오디오 재생 엔진 스타트 지점 (audioEngine.play() 바로 아래)
            await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer);
            audioEngine.play();  // 재생시작
            
            // 📟 시스템 가동 상태를 순차적으로 타이핑 연출
            const currentEngine = window.TrackerAudioEngine.currentEngineType || "UNKNOWN";
            await printDosTypewriter(`[SYSTEM] ENGINE TYPE "${currentEngine.toUpperCase()}" INITIALIZED.`, 10);
            await printDosTypewriter(`[AUDIO] NOW PLAYING: "${track.title}" (BPM: ${bTempo} / TICK: ${tBeat})`, 15);


④ 정지 버튼(btnStop)을 눌렀을 때
    btnStop.addEventListener("click", async () => {
        // ... (기존 정지 로직) ...
        await printDosTypewriter(`[AUDIO] PLAYBACK HALTED BY USER. CORE SUSPENDED.`, 15);
    });
*/

	// 도스식 로그출력 - 거의 사용않던 에러메시지창을 재활용함.
	//errorMessage.classList.remove('hidden');
	function printDosLog(message) {
		//const consoleEl = document.getElementById("dosLogConsole");
		const consoleEl = document.getElementById("errorMessage");
		if (!consoleEl) return;

		const line = document.createElement("div");
		// DOS 감성을 위해 현재 시각을 [07:29:45] 형태로 앞에 붙여줍니다.
		const now = new Date();
		const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
		
		line.innerHTML = `<span style="color: #888;">${timeStr}</span> <span style="color: #54ff54;">${message}</span>`;
		consoleEl.appendChild(line);

		// 🎯 [자동 스크롤] 새로운 로그가 오면 DOS 창처럼 위로 주르륵 올라가도록 스크롤 최하단 이동
		consoleEl.scrollTop = consoleEl.scrollHeight;
	}
