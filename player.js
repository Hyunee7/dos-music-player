/**
 * player.js - Part 1: 전역 컨텍스트 캐싱 및 순정 ./folder 경로형 미디어 마스터 목록 선언 (순정 원복)
 */
//const DEBUG = true; 
const DEBUG = false; 
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof lucide !== "undefined") lucide.createIcons();

    // .IMS, .ROL, .VGM, .MOD, .XM, .S3M 전 포맷 규격이 결합된 총 14곡의 순정 보관함 목록
    let currentPlaylist = [
        { filename: "COM-COOL.IMS", url: "./folder/COM-COOL.IMS", format: "IMS", title: "COM-COOL" },
        { filename: "COM-CHIC.IMS", url: "./folder/COM-CHIC.IMS", format: "IMS", title: "COM-CHIC" },
        { filename: "COM-PAGI.IMS", url: "./folder/COM-PAGI.IMS", format: "IMS", title: "COM-PAGI" },
        { filename: "COM-ROO3.IMS", url: "./folder/COM-ROO3.IMS", format: "IMS", title: "COM-ROO3" },
        { filename: "HUB-MOSQ.IMS", url: "./folder/HUB-MOSQ.IMS", format: "IMS", title: "HUB-MOSQ" },
        { filename: "JAM-FIVE.IMS", url: "./folder/JAM-FIVE.IMS", format: "IMS", title: "JAM-FIVE" },
        { filename: "JAM-NADI.IMS", url: "./folder/JAM-NADI.IMS", format: "IMS", title: "JAM-NADI" },
        { filename: "JMSTOMMY.IMS", url: "./folder/JMSTOMMY.IMS", format: "IMS", title: "JMSTOMMY" }, /* 가사 테스트용 */
        { filename: "TS-DEUX4.IMS", url: "./folder/TS-DEUX4.IMS", format: "IMS", title: "TS-DEUX4" }, /* 가사 테스트용 */
        { filename: "MM-BANK.IMS", url: "./folder/MM-BANK.IMS", format: "IMS", title: "MM-BANK" },
        { filename: "MM-PRO.IMS", url: "./folder/MM-PRO.IMS", format: "IMS", title: "MM-PRO" },
        { filename: "MYSTERY-.IMS", url: "./folder/MYSTERY-.IMS", format: "IMS", title: "MYSTERY-" },
        { filename: "SHC.IMS", url: "./folder/SHC.IMS", format: "IMS", title: "SHC" },
        { filename: "COCKTAIL.IMS", url: "./folder/COCKTAIL.IMS", format: "IMS", title: "COCKTAIL" },
        { filename: "SIM-FEEL.IMS", url: "./folder/SIM-FEEL.IMS", format: "IMS", title: "SIM-FEEL" },
        { filename: "100MEET.IMS", url: "./folder/100MEET.IMS", format: "IMS", title: "100MEET" },
        { filename: "VV.ROL", url: "./folder/VV.ROL", format: "ROL", title: "VV" },
        { filename: "4JSTAMNT.ROL", url: "./folder/4JSTAMNT.ROL", format: "ROL", title: "4JSTAMNT" },
        { filename: "Feena.vgm", url: "./folder/Feena.vgm", format: "VGM", title: "Feena (Ys I)" },
        { filename: "Final Battle.vgm", url: "./folder/Final Battle.vgm", format: "VGM", title: "Final Battle" },
        { filename: "GENIUS-X.S3M", url: "./folder/GENIUS-X.S3M", format: "S3M", title: "GENIUS-X" },
        { filename: "skyrider.s3m", url: "./folder/skyrider.s3m", format: "S3M", title: "Skyrider" },
        { filename: "B-BOYM~2.MOD", url: "./folder/B-BOYM~2.MOD", format: "MOD", title: "B-BOYM~2" },
        { filename: "space_debris.mod", url: "./folder/space_debris.mod", format: "MOD", title: "Space Debris" },
        {
            filename: "unreeeal_superhero_3.xm",
            url: "./folder/unreeeal_superhero_3.xm",
            format: "XM",
            title: "Unreal Superhero 3",
        },
    ];

    let playingIndex = 0;
    let selectedIndex = 0;
    let repeatMode = "all";
    let stateUpdateInterval = null;
    let currentIssData = null;
    const ITEM_HEIGHT = 28;

    // DOM 제어 노드 객체 캐싱
    const trackListContainer = document.getElementById("musicTrackList");
    const btnPlay = document.getElementById("btnPlay");
    const btnStop = document.getElementById("btnStop");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const statusBarText = document.getElementById("statusBarText");
    const volumeSlider = document.getElementById("volumeSlider");
    const sliderLabel = document.getElementById("sliderLabel");
    const lyricsDisplay = document.getElementById("lyricsDisplay");
    const dropZone = document.getElementById("dropZone");
    const folderLabel = document.getElementById("folderLabel");

    const repeatAll = document.getElementById("repeatAll");
    const repeatOne = document.getElementById("repeatOne");
    const repeatShuffle = document.getElementById("repeatShuffle");
    const helpBtn = document.getElementById("helpBtn");
    const closeDialogBtn = document.getElementById("closeDialogBtn");
    const formatDialog = document.getElementById("formatDialog");
    const formatDialogBackdrop = document.getElementById("formatDialogBackdrop");
    const btnMute = document.getElementById("btnMute");
    let isMuted = false;
    let lastVolume = 70;

    const canvas = document.getElementById("visualizerCanvas");
    /**
     * player.js - Part 2: 현재 연주 중인 트랙(dos-list-item-playing) 실시간 반전 점등식 플레이리스트 렌더러 (순정)
     */
    //////스펙트럼.초기화.시작//////
    const MASTER_BAR_COUNT = 16;
    const MASTER_SEGMENT_COUNT = 40;
    const MASTER_PEAK_HOLD_FRAMES = 15;
    const MASTER_PEAK_FALL_ACCELERATION = 0.3;
    const MASTER_VALUE_FALL_SPEED = 4;
    const masterBarData = Array.from({ length: MASTER_BAR_COUNT }, () => ({
        value: 0,
        peak: 0,
        peakHoldTime: 0,
        peakFallSpeed: 0,
    }));
	/*
    const masterColors = {
        inactive: "#1a1a26",
        low: "#00a800",
        mid: "#a8a800",
        high: "#7b1818",
        peak: "#54ffff",
        barBg: "#000000",
    };
	*/
    const masterColors = {
        inactive: "#1a1a26",
        low: "#4a5568",
        mid: "#6b7a8f",
        high: "#8fa0b8",
        peak: "#aaaaaa",
        barBg: "#000000",
    };

	// 컨테이너에 16개 스팩트럼바 캔버스를 그림
    const spectrumContainer = document.getElementById("spectrumContainer");
    const canvasElements = [];
    const canvasContexts = [];
    for (let i = 0; i < MASTER_BAR_COUNT; i++) {
        const wrapper = document.createElement("div");
        wrapper.className = "spectrum-bar-segment-wrapper";
        const canv = document.createElement("canvas");
        canv.style.width = "100%";
        canv.style.height = "100%";
        wrapper.appendChild(canv);
        spectrumContainer.appendChild(wrapper);
        canvasElements.push(canv);
    }

	// 화면크기가 바뀌면 다시그림
    function resizeSpectrumCanvases() {
        const dpr = window.devicePixelRatio || 1;
        canvasContexts.length = 0;
        canvasElements.forEach((canv) => {
            const parent = canv.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            canv.width = rect.width * dpr;
            canv.height = (rect.height || 112) * dpr;
            const ctx = canv.getContext("2d");
            if (ctx) {
                ctx.scale(dpr, dpr);
                canvasContexts.push({ ctx, width: rect.width, height: rect.height || 112 });
            }
        });
    }
    //////스펙트럼.초기화.끝//////

    function renderPlaylist() {
        trackListContainer.innerHTML = "";
        const totalHeight = currentPlaylist.length * ITEM_HEIGHT;
        trackListContainer.style.height = `${totalHeight}px`;
        currentPlaylist.forEach((track, idx) => {
            const div = document.createElement("div");
            div.className = `dos-list-item ${idx === selectedIndex ? "dos-list-item-selected" : ""}`;

            // 🎯 [연주 표시 핵심 주입선]
            // 현재 음악 카드가 소리 렌더링 출력을 기동하고 있으면서 내 플레이리스트 인덱스 번호가 일치할 때
            // 연주 중 표시 전용 특수 복고풍 반전 CSS 클래스명('dos-list-item-playing')을 실시간 강제 골인시킵니다!
            if (
                idx === playingIndex &&
                window.TrackerAudioEngine &&
                window.TrackerAudioEngine.getPlaybackState()?.isPlaying
            ) {
                div.classList.add("dos-list-item-playing");
            }

            div.style.height = `${ITEM_HEIGHT}px`;
            div.setAttribute("draggable", "true");
            div.setAttribute("data-index", idx);
            const badge = `<span class="dos-badge">${track.format}</span>`;
            const titleSpan = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; pointer-events:none;">${track.title}</span>`;
            div.innerHTML = `${badge}${titleSpan}`;

            div.addEventListener("click", () => {
                selectedIndex = idx;
                //playingIndex = idx;
				const audioEngine = window.TrackerAudioEngine;
				const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
				if (audioState && audioState.currentPositionMs > 0) { // 일시정지 가 아니면 연주할 곡으로 선택함
				}else{
					playingIndex = idx;
				}
                renderPlaylist();
            });
            div.addEventListener("dblclick", () => {
                selectedIndex = idx;
                playingIndex = idx;
                loadAndPlayTrack();
            });

            div.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", idx);
                div.style.opacity = "0.4";
                div.classList.add("dos-dragging");
            });
            div.addEventListener("dragend", () => {
                div.style.opacity = "1";
                div.classList.remove("dos-dragging");
                document.querySelectorAll(".dos-list-item").forEach((item) => item.classList.remove("dos-drag-over"));
            });
            div.addEventListener("dragover", (e) => {
                e.preventDefault();
                div.classList.add("dos-drag-over");
            });
            div.addEventListener("dragleave", () => {
                div.classList.remove("dos-drag-over");
            });
            div.addEventListener("drop", (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                const toIndex = idx;
                if (!isNaN(fromIndex) && fromIndex !== toIndex) handlePlaylistReorder(fromIndex, toIndex);
            });

            div.addEventListener(
                "touchstart",
                (e) => {
                    window.dosTouchDragStartIndex = idx;
                    div.classList.add("dos-dragging");
                },
                { passive: true }
            );
            div.addEventListener(
                "touchmove",
                (e) => {
                    const touch = e.touches;
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                    const listItem = targetElement ? targetElement.closest(".dos-list-item") : null;
                    document
                        .querySelectorAll(".dos-list-item")
                        .forEach((item) => item.classList.remove("dos-drag-over"));
                    if (listItem) listItem.classList.add("dos-drag-over");
                },
                { passive: true }
            );
            div.addEventListener("touchend", (e) => {
                const touch = e.changedTouches;
                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                const listItem = targetElement ? targetElement.closest(".dos-list-item") : null;
                div.classList.remove("dos-dragging");
                document.querySelectorAll(".dos-list-item").forEach((item) => item.classList.remove("dos-drag-over"));
                if (listItem) {
                    const toIndex = parseInt(listItem.getAttribute("data-index"), 10);
                    const fromIndex = window.dosTouchDragStartIndex;
                    if (fromIndex !== undefined && !isNaN(toIndex) && fromIndex !== toIndex)
                        handlePlaylistReorder(fromIndex, toIndex);
                }
                window.dosTouchDragStartIndex = undefined;
            });
            trackListContainer.appendChild(div);
        });
    }

    /**
     * player.js - Part 3: 상위 스코프 상수를 참조하는 30fps 주파수 스펙트럼 애널라이저 루프 및 오디오 피더
     */
    /**
     * 16채널 LED 기둥을 사각형 격자로 직접 주사해 그리는 코어
     * 주파수 진폭 값의 크기에 따라 색상 수식 조건절(녹색 ➡️ 황색 ➡️ 피크 스카이블루 LED 빔)을 실시간으로 판별하면서, 격자 gap 공간 분할 수식에 맞춰 사각형 블록(fillRect)으로 화면에 직접 출력 주사합니다.
     */
    function renderSingleBar(barIndex) {
        const target = canvasContexts[barIndex];
        if (!target || !target.ctx || target.width === 0 || target.height === 0) return;
        const { ctx, width, height } = target;
        const segmentGap = 1;

        // 40개 도트 LED 세그먼트의 높이를 화면 해상도에 맞춰 기하학 배율 계산
        const segmentHeight = (height - segmentGap * (MASTER_SEGMENT_COUNT - 1)) / MASTER_SEGMENT_COUNT;
        const bar = masterBarData[barIndex];

        ctx.fillStyle = masterColors.barBg;
        ctx.fillRect(0, 0, width, height);
        const peakSegIndex = Math.min(Math.floor((bar.peak * MASTER_SEGMENT_COUNT) / 100), MASTER_SEGMENT_COUNT - 1);

        // 🎯 [실시간 16채널 스펙트럼 드로우 최종 주사 지점]
        // 40층으로 구성된 고전 가라오케 LED 타워 기둥을 밑바닥부터 천장까지 격자형 격막 구조로 쌓아 올리며 주사합니다!
        for (let segIndex = 0; segIndex < MASTER_SEGMENT_COUNT; segIndex++) {
            const threshold = ((segIndex + 1) / MASTER_SEGMENT_COUNT) * 100;
            const isActive = bar.value >= threshold;
            const isPeak = segIndex === peakSegIndex;
            let color = masterColors.inactive; // 소리 안 나는 기본 베이스 소등 색상 (#1a1a26)
            if (isPeak && bar.peak > 0)
                color = masterColors.peak; // 맨 꼭대기 순간 고정 하늘색 피크 LED (#54ffff)
            else if (isActive) {
                const ratio = segIndex / MASTER_SEGMENT_COUNT;
                // 3층 타워 배율에 맞춰 하단은 녹색, 중/상단은 황색 고광도 네온 불빛 반전 매핑
                if (ratio >= 2 / 3) color = masterColors.high;
                else if (ratio >= 1 / 3) color = masterColors.mid;
                else color = masterColors.low;
            }
            const segY = (MASTER_SEGMENT_COUNT - 1 - segIndex) * (segmentHeight + segmentGap);
            ctx.fillStyle = color;

            // 픽셀 사각형 플래시 메모리 전사 단행!
            ctx.fillRect(0, segY, width, segmentHeight);
        }
    }

    function renderSpectrumLEDs() {
        for (let i = 0; i < MASTER_BAR_COUNT; i++) renderSingleBar(i);
    }
    let lastVisualizerTime = 0;
    const targetInterval = 1000 / 30;

    /**
     * 실시간 주파수 가로채기
     */
    function runVisualizerEngineLoop(timestamp) {
        requestAnimationFrame(runVisualizerEngineLoop);
        if (!window.TrackerAudioEngine) return;
        if (timestamp - lastVisualizerTime < targetInterval) return;
        lastVisualizerTime = timestamp;
        const analyser = window.TrackerAudioEngine.getAnalyserNode();
        if (!analyser) {
            // 가용 주파수 스펙트럼 대역을 16개 대역폭으로 정밀 쪼개어 masterBarData 버퍼 배열에 주입
            for (let i = 0; i < MASTER_BAR_COUNT; i++) {
                const prev = masterBarData[i];
                let value = Math.max(0, prev.value - MASTER_VALUE_FALL_SPEED);
                let peak = prev.peak;
                let peakHoldTime = prev.peakHoldTime;
                let peakFallSpeed = prev.peakFallSpeed;
                if (peakHoldTime > 0) peakHoldTime--;
                else {
                    peakFallSpeed += MASTER_PEAK_FALL_ACCELERATION;
                    peak = Math.max(0, peak - peakFallSpeed);
                }
                masterBarData[i] = { value, peak, peakHoldTime, peakFallSpeed };
            }
            // 🎯 [드로잉 명령 하강 하달] 가공된 데이터 버퍼를 바탕으로 화면 그리기 함수 강제 호출!
            renderSpectrumLEDs();
            return;
        }
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        // WASM 오디오 스레드가 공출해 낸 원본 주파수 데이터 분해 수령
        analyser.getByteFrequencyData(dataArray);
        const skipBins = 2;
        const usableBins = bufferLength - skipBins;
        const binsPerBar = Math.floor(usableBins / MASTER_BAR_COUNT);

        // 가용 주파수 스펙트럼 대역을 16개 대역폭으로 정밀 쪼개어 masterBarData 버퍼 배열에 주입
        for (let i = 0; i < MASTER_BAR_COUNT; i++) {
            // 주파수 평균치 산출 및 하강 감쇠 속도 계산
            const startBin = skipBins + i * binsPerBar;
            const endBin = Math.min(startBin + binsPerBar, bufferLength);
            let sum = 0;
            for (let j = startBin; j < endBin; j++) sum += dataArray[j];
            const avg = sum / (endBin - startBin);
            const rawValue = Math.round((avg / 255) * 100);
            const prev = masterBarData[i];
            let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - MASTER_VALUE_FALL_SPEED);
            let peak = prev.peak;
            let peakHoldTime = prev.peakHoldTime;
            let peakFallSpeed = prev.peakFallSpeed;
            if (value >= peak) {
                peak = value;
                peakHoldTime = MASTER_PEAK_HOLD_FRAMES;
                peakFallSpeed = 0;
            } else if (peakHoldTime > 0) {
                peakHoldTime--;
            } else {
                peakFallSpeed += MASTER_PEAK_FALL_ACCELERATION;
                peak = Math.max(0, peak - peakFallSpeed);
            }
            masterBarData[i] = { value, peak, peakHoldTime, peakFallSpeed };
        }
        // 🎯 [드로잉 명령 하강 하달] 가공된 데이터 버퍼를 바탕으로 화면 그리기 함수 강제 호출!
        renderSpectrumLEDs();
    }

    function triggerBufferWriteFeed() {
        const audioEngine = window.TrackerAudioEngine;
        if (!audioEngine || !audioEngine.getPlaybackState) return;
        const state = audioEngine.getPlaybackState();
        if (!state || !state.isPlaying) return;

        const currentEngineType = window.TrackerAudioEngine.currentEngineType || "adplug";
        const openmptModuleInstance = window.TrackerAudioEngine.openmptModuleInstance;
        const adplugModuleInstance = window.TrackerAudioEngine.adplugModuleInstance;
        const loadedModulePtr = window.TrackerAudioEngine.loadedModulePtr;
        const queueWriter = window.TrackerAudioEngine.queueWriter;
        const SAMPLE_RATE = window.TrackerAudioEngine.SAMPLE_RATE || 44100;
        if (!loadedModulePtr || !queueWriter) return;

        queueWriter.write((segment) => {
            let framesRendered = segment.frameCount;
            let trackFinished = false;

            if (currentEngineType === "libopenmpt" && openmptModuleInstance) {
                const bytesPerSample = 4;
                let leftBufferPtr = window.TrackerAudioEngine.leftBufferPtr || 0;
                let rightBufferPtr = window.TrackerAudioEngine.rightBufferPtr || 0;
                if (!leftBufferPtr) {
                    leftBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample);
                    rightBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample);
                    window.TrackerAudioEngine.leftBufferPtr = leftBufferPtr;
                    window.TrackerAudioEngine.rightBufferPtr = rightBufferPtr;
                }
                const count = openmptModuleInstance._openmpt_module_read_float_stereo(
                    loadedModulePtr,
                    SAMPLE_RATE,
                    framesRendered,
                    leftBufferPtr,
                    rightBufferPtr
                );
                if (count <= 0) {
                    trackFinished = true;
                    framesRendered = 0;
                } else {
                    framesRendered = count;
                    const wasmLeft = new Float32Array(
                        openmptModuleInstance.HEAPF32.buffer,
                        leftBufferPtr,
                        framesRendered
                    );
                    const wasmRight = new Float32Array(
                        openmptModuleInstance.HEAPF32.buffer,
                        rightBufferPtr,
                        framesRendered
                    );
                    for (let i = 0; i < framesRendered; i++) {
                        segment.set(i, 0, wasmLeft[i]);
                        segment.set(i, 1, wasmRight[i]);
                    }
                    window.TrackerAudioEngine.totalSamplesSent =
                        (window.TrackerAudioEngine.totalSamplesSent || 0) + framesRendered;
                }
            } else if (currentEngineType === "adplug" && adplugModuleInstance) {
                const scale = 1 / 32768.0;
                const finished = adplugModuleInstance._emu_compute_audio_samples() !== 0;
                if (finished) trackFinished = true;
                window["adplug"] = adplugModuleInstance;
                const bufferPtr = adplugModuleInstance._emu_get_audio_buffer();
                const bufferLength = adplugModuleInstance._emu_get_audio_buffer_length();
                const numSamples = bufferLength / 2;
                const renderCount = Math.min(framesRendered, numSamples / 2);

                const runtimeShortHeap = new Int16Array(adplugModuleInstance.HEAP16.buffer, bufferPtr, numSamples);
                for (let i = 0; i < renderCount; i++) {
                    segment.set(i, 0, runtimeShortHeap[i * 2] * scale);
                    segment.set(i, 1, runtimeShortHeap[i * 2 + 1] * scale);
                }
                framesRendered = renderCount;
                window.TrackerAudioEngine.totalSamplesSent =
                    (window.TrackerAudioEngine.totalSamplesSent || 0) + renderCount;
            }
            if (trackFinished) {
                if (window.TrackerAudioEngine.loopEnabled) {
                    if (currentEngineType === "libopenmpt")
                        openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0);
                    else if (currentEngineType === "adplug") adplugModuleInstance._emu_rewind();
                    window.TrackerAudioEngine.totalSamplesSent = 0;
                } else {
                    if (window.TrackerAudioEngine && typeof window.TrackerAudioEngine.stop === "function") {
                        window.TrackerAudioEngine.stop();
                    }
                    const cb = window.TrackerAudioEngine.onTrackEndCallback;
                    if (cb) {
                        console.log("%c[트랙 연산 끝] 연속 재생 작동 개시", "color: #54ff54; font-weight: bold;");
                        setTimeout(() => cb(), 20);
                    }
                }
            }
            return framesRendered;
        });
    }
    window.triggerBufferWriteFeedGlobal = triggerBufferWriteFeed;
    /**
     * player.js - Part 4-A: 순정 상태 맥박 보존 및 WASM 코어 원본 시간 축 직결형 가사/시간 동기화 마스터 루프
     */
    function runStateSyncLoop() {
        clearInterval(stateUpdateInterval);
        stateUpdateInterval = setInterval(() => {
            const audioEngine = window.TrackerAudioEngine;
            const audioState = audioEngine ? audioEngine.getPlaybackState() : null;

            if (!audioState || !currentIssData || (audioState.currentPositionMs === 0 && !audioState.isPlaying)) {
                const tempoElement = document.getElementById("tempoDisplayValue");
                if (tempoElement) tempoElement.innerText = "---";
                lyricsDisplay.innerHTML = `가사 음슴`;
                if (audioState) {
					const totalMs = audioState.totalDurationMs || audioEngine.adplugModuleInstance._emu_get_max_position();
                    const progressPercent = (audioState.currentPositionMs / totalMs) * 100 || 0;
                    progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
                    progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(totalMs)}`;

                    const liveBpm =
                        audioEngine && audioEngine.currentRuntimeTempo
                            ? Math.round(audioEngine.currentRuntimeTempo)
                            : 120;
                    const tempoElement = document.getElementById("tempoDisplayValue");
                    if (tempoElement) tempoElement.innerText = String(liveBpm).padStart(3, "0");
                }
                return;
            }

            const currentMs = audioState.currentPositionMs || 0;

            // [해결 1] 재생 상태 오버라이드 대신 드로우 프레임 내부에서 코어의 진짜 가변 전체 시간을 동적 확보합니다!
            let totalMs = audioState.totalDurationMs || 0;
            if (
                audioEngine.currentEngineType === "libopenmpt" &&
                audioEngine.loadedModulePtr &&
                audioEngine.openmptModuleInstance
            ) {
                totalMs =
                    audioEngine.openmptModuleInstance._openmpt_module_get_duration_seconds(
                        audioEngine.loadedModulePtr
                    ) * 1000;
            } else if (
                audioEngine.currentEngineType === "adplug" &&
                audioEngine.adplugModuleInstance &&
                typeof audioEngine.adplugModuleInstance._emu_get_max_position === "function"
            ) {
                totalMs = audioEngine.adplugModuleInstance._emu_get_max_position();
            }
            if (totalMs <= 0) totalMs = 1;

            const progressPercent = (currentMs / totalMs) * 100 || 0;
            progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
            progressText.innerText = `${formatTime(currentMs)} / ${formatTime(totalMs)}`;

            const liveBpm =
                audioEngine && audioEngine.currentRuntimeTempo ? Math.round(audioEngine.currentRuntimeTempo) : 120;
            const tempoElement = document.getElementById("tempoDisplayValue");
            if (tempoElement) tempoElement.innerText = String(liveBpm).padStart(3, "0");

            let rawHardwareTick = 0;
            const adplugInstance = window.TrackerAudioEngine?.adplugModuleInstance;
            if (
                window.TrackerAudioEngine?.currentEngineType === "adplug" &&
                adplugInstance &&
                typeof adplugInstance._emu_get_current_tick === "function"
            ) {
                rawHardwareTick = adplugInstance._emu_get_current_tick();
            } else {
                const currentPlaylistTrack = currentPlaylist[playingIndex];
                const bTempo =
                    currentPlaylistTrack && currentPlaylistTrack.basicTempo ? currentPlaylistTrack.basicTempo : 120;
                const tBeat =
                    currentPlaylistTrack && currentPlaylistTrack.tickBeat ? currentPlaylistTrack.tickBeat : 24;
                rawHardwareTick = (currentMs / 1000) * ((bTempo * tBeat) / 60);
            }

            const adjustedTick = rawHardwareTick / 8 ; // 가사정보 참조용 Tick

            let left = 0;
            let right = currentIssData.records.length - 1;
            let resultIndex = -1;
            while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                if (currentIssData.records[mid].kasaTick <= adjustedTick) {
                    resultIndex = mid;
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
            if (resultIndex >= 0) {
                const currentRecord = currentIssData.records[resultIndex];
                const rawLine = currentIssData.scripts[currentRecord.line] || "";
                const currentLine = rawLine.trimEnd();
//                const currentLine = rawLine;
//console.log(rawHardwareTick,adjustedTick,resultIndex,rawLine)
                let nextLine = "";
                if (resultIndex < currentIssData.records.length - 1) {
                    for (let i = resultIndex + 1; i < currentIssData.records.length; i++) {
                        if (currentIssData.records[i].line !== currentRecord.line) {
                            const rawNext = currentIssData.scripts[currentIssData.records[i].line] || "";
                            nextLine = rawNext.trimEnd();
                            break;
                        }
                    }
                }
                let bytePos = 0;
                let charPos = 0;
                const startX = currentRecord.startX;
                const widthX = currentRecord.widthX;
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
				lyricsDisplay.innerHTML = `
				  <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%; text-align: center;">
					<div style="font-weight: 500; text-align: center; width: 100%; word-break: break-all; line-height: 1.4;">
					  <span style="color: var(--lyrics-highlight); font-weight: bold; display: inline;">${currentLine.substring(0, highlightEnd)}</span><span style="color: var(--lyrics-normal); display: inline;">${currentLine.substring(highlightEnd)}</span>
					</div>
					<div style="font-size: 13px; color: var(--lyrics-normal); opacity: 0.4; min-height: 18px; margin-top: 6px; text-align: center; width: 100%;">${nextLine}</div>
				  </div>`;
            }
        }, 80);
    }

    /**
     * player.js - Part 4-B: 시동 버퍼 체인 간섭이 원천 제거된 무결점 트랙 릴레이 적재 및 철도 탐색기
     */
    async function loadAndPlayTrack() {
        const track = currentPlaylist[playingIndex];
        if (!track) return;
        const audioEngine = window.TrackerAudioEngine;
        if (!audioEngine) {
            setTimeout(loadAndPlayTrack, 300);
            return;
        }
        const overlay = document.getElementById("loadingOverlay");
        if (overlay) overlay.classList.remove("hidden");
        statusBarText.innerText = `로딩 중... - ${track.title}`;

        try {
            let musicArrayBuffer;
            let bnkArrayBuffer = null;
            currentIssData = null;
            if (track.fileObject) musicArrayBuffer = await track.fileObject.arrayBuffer();
            else {
                const response = await fetch(track.url);
                if (!response.ok) throw new Error("음원 자원 호출 실패");
                musicArrayBuffer = await response.arrayBuffer();
            }

            const ext = track.filename.toLowerCase().substring(track.filename.lastIndexOf("."));
            if ([".ims", ".rol"].includes(ext)) {
                try {
                    const lastDotIdx = track.filename.lastIndexOf(".");
                    const targetBnkName =
                        lastDotIdx === -1 ? track.filename + ".BNK" : track.filename.substring(0, lastDotIdx) + ".BNK";

                    if (window.uploadedBnkMap && window.uploadedBnkMap.has(targetBnkName.toLowerCase())) {
                        console.log(
                            `%c[로컬 드롭 뱅크] %c악기 뱅크(${targetBnkName}) 선점 도킹 완료`,
                            "color: #54ff54; font-weight:bold;"
                        );
                        const localBnkFile = window.uploadedBnkMap.get(targetBnkName.toLowerCase());
                        bnkArrayBuffer = await localBnkFile.arrayBuffer();
                    } else if (window.uploadedBnkMap && window.uploadedBnkMap.has("standard.bnk")) {
                        console.log(`%c[공유 뱅크] %c로컬 STANDARD.BNK 매핑 완료`, "color: #54ffff; font-weight:bold;");
                        const localStdBnk = window.uploadedBnkMap.get("standard.bnk");
                        bnkArrayBuffer = await localStdBnk.arrayBuffer();
                    } else {
                        let primaryBnkPath = track.fileObject ? `./${targetBnkName}` : `./folder/${targetBnkName}`;
                        let secondaryBnkPath = track.fileObject ? "./STANDARD.BNK" : "./folder/STANDARD.BNK";
                        let bnkLoaded = false;
                        try {
                            const primaryCheck = await fetch(primaryBnkPath, { method: "HEAD" });
                            if (primaryCheck.ok) {
                                const bnkResponse = await fetch(primaryBnkPath);
                                if (bnkResponse.ok) {
                                    bnkArrayBuffer = await bnkResponse.arrayBuffer();
                                    bnkLoaded = true;
                                }
                            }
                        } catch (e) {}
                        if (!bnkLoaded) {
                            const secondaryCheck = await fetch(secondaryBnkPath, { method: "HEAD" });
                            if (secondaryCheck.ok) {
                                const bnkResponse = await fetch(secondaryBnkPath);
                                if (bnkResponse.ok) bnkArrayBuffer = await bnkResponse.arrayBuffer();
                            }
                        }
                    }
                } catch (e) {
                    console.warn("뱅크 예외:", e);
                }

                if (track.issFileObject) {
                    const issBuf = await track.issFileObject.arrayBuffer();
                    if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
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
                                currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
                        }
                    } catch (e) {}
                }
window['iss']=currentIssData;
            }

            // [해결 2] 오디오 워크렛 스레드의 다음 트랙 연주 종료 확인 핸들러를 순정 규격 그대로 유지하여 시동 잠금 해제!
            audioEngine.setOnTrackEnd(() => {
                console.log(
                    "%c[오토 주크박스] 현재 트랙 연주 종료 확인 -> 다음 트랙 바통 인계 작동",
                    "color: #54ff54; font-weight: bold;"
                );
                if (repeatMode === "one") {
                    loadAndPlayTrack();
                } else if (repeatMode === "shuffle") {
                    const rand = Math.floor(Math.random() * currentPlaylist.length);
                    playingIndex = rand;
                    selectedIndex = rand;
                    loadAndPlayTrack();
                } else {
                    if (playingIndex < currentPlaylist.length - 1) {
                        playingIndex++;
                        selectedIndex = playingIndex;
                        loadAndPlayTrack();
                    } else {
                        playingIndex = 0;
                        selectedIndex = 0;
                        loadAndPlayTrack();
                    }
                }
            });

            // 기존 오디오 엔진 인스턴스의 런타임 하이재킹 방식 함수 오염을 완전히 지우고, 엔진 고유의 순정 적재 체인을 독립 기동시킵니다.
            await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer);
            audioEngine.play();
            btnPlay.innerHTML = `<svg xmlns="http://w3.org" viewBox="0 0 24 24" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
            btnStop.removeAttribute("disabled");
            btnPrev.removeAttribute("disabled");
            btnNext.removeAttribute("disabled");
            statusBarText.innerText =
                currentIssData && currentIssData.singer
                    ? `재생중 - [가수: ${currentIssData.singer}] ${track.title}`
                    : `재생중 - ${track.title}`;
            if (typeof lucide !== "undefined") lucide.createIcons();

            const scrollParent = trackListContainer.parentElement;
            if (scrollParent) {
                scrollParent.scrollTop = playingIndex * ITEM_HEIGHT - scrollParent.clientHeight / 2 + ITEM_HEIGHT / 2;
            }
            runStateSyncLoop(); // 상태 체크 루프 시작
            renderPlaylist();
        } catch (err) {
            console.error(err);
            statusBarText.innerText = `적재 실패: ${track.title}`;
        } finally {
            if (overlay) overlay.classList.add("hidden");
        }
    }

    const progressBarContainer = document.getElementById("progressBarContainer");
    const targetRail = progressBarContainer?.querySelector(".dos-progress-bar-border") || progressBarContainer;
    if (targetRail) {
        targetRail.addEventListener("click", (e) => {
            const audioEngine = window.TrackerAudioEngine;
            if (!audioEngine) return;
            const playbackState = audioEngine.getPlaybackState();
            if (!playbackState || !playbackState.totalDurationMs) return;
            const rect = targetRail.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const widthRatio = Math.max(0, Math.min(1, clickX / rect.width));
            const targetMs = widthRatio * playbackState.totalDurationMs;
            if (typeof audioEngine.seekTo === "function") audioEngine.seekTo(targetMs);
        });
    }

    /**
     * player.js - Part 4-C: 폴더 재귀 스캔 및 개별 다중 파일 드롭 로드가 동시 완치된 최종 마감부
     * 드롭존에 개별 파일 다중 셀렉트 투하 시에도 한 치의 누락 없이 로컬 데이터베이스 스왑을 이뤄냅니다.
     */
    if (typeof targetRail !== "undefined" || window.progressBarContainer) {
        const finalRail =
            document.getElementById("progressBarContainer")?.querySelector(".dos-progress-bar-border") ||
            document.getElementById("progressBarContainer");
        if (finalRail) {
            finalRail.addEventListener("click", (e) => {
                const audioEngine = window.TrackerAudioEngine;
                if (!audioEngine) return;
                const playbackState = audioEngine.getPlaybackState();
                if (!playbackState || !playbackState.totalDurationMs) return;
                const rect = finalRail.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const widthRatio = Math.max(0, Math.min(1, clickX / rect.width));
                const targetMs = widthRatio * playbackState.totalDurationMs;
                if (typeof audioEngine.seekTo === "function") audioEngine.seekTo(targetMs);
            });
        }
    }

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = "var(--bg-select)";
    });
    dropZone.addEventListener("dragleave", () => {
        dropZone.style.backgroundColor = "var(--bg-main)";
    });
    dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = "var(--bg-main)";

        // 🎯 [다중 개별 파일 및 폴더 동시 탐색 하이브리드 드라이버 가동]
        const items = e.dataTransfer.items;
        const filesList = e.dataTransfer.files;
        if ((!items || items.length === 0) && (!filesList || filesList.length === 0)) {
            statusBarText.innerText = "드롭 데이터 유효 안함";
            return;
        }

        statusBarText.innerText = "디렉토리 및 개별 자원 구조 정밀 스캔 중...";
        const allFiles = [];

        // 폴더 내부를 하위 노드까지 파고드는 비동기 재귀 엔진
        async function traverseFileTree(item, depth = 0) {
            if (item.isFile) {
                return new Promise((resolve) => {
                    item.file((file) => {
                        allFiles.push(file);
                        resolve();
                    });
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const readEntriesBatch = () => {
                    return new Promise((resolveBatch) => {
                        dirReader.readEntries(async (entries) => {
                            if (entries.length === 0) {
                                resolveBatch();
                                return;
                            }
                            for (const entry of entries) await traverseFileTree(entry, depth + 1);
                            await readEntriesBatch();
                            resolveBatch();
                        });
                    });
                };
                await readEntriesBatch();
            }
        }

        // 1순위: Entry 구조 가용 시 (폴더 드롭 또는 고급 브라우저 대응)
        if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) {
                    await traverseFileTree(entry);
                }
            }
        }
        // 2순위: 단순 파일 뭉치 드롭 가용 시 (바탕화면 개별 파일 다중 셀렉트 대응 리턴 바이패스)
        if (allFiles.length === 0 && filesList && filesList.length > 0) {
            for (let i = 0; i < filesList.length; i++) {
                allFiles.push(filesList[i]);
            }
        }

        if (allFiles.length > 0) {
            const allowedFiles = allFiles.filter((f) => /\.(mod|xm|s3m|it|ims|rol|vgm|mid)$/i.test(f.name));
            const issFiles = allFiles.filter((f) => /\.iss$/i.test(f.name));
            const issMap = new Map(issFiles.map((f) => [f.name.toLowerCase().replace(/\.iss$/, ""), f]));

            const bnkFiles = allFiles.filter((f) => /\.bnk$/i.test(f.name));
            window.uploadedBnkMap = new Map(bnkFiles.map((f) => [f.name.toLowerCase(), f]));

            if (allowedFiles.length > 0) {
                const scannedTracks = [];
                for (const file of allowedFiles) {
                    const ext = file.name.split(".").pop().toUpperCase();
                    const lastDotIdx = file.name.lastIndexOf(".");
                    const baseName =
                        lastDotIdx === -1 ? file.name.toLowerCase() : file.name.substring(0, lastDotIdx).toLowerCase();
                    let parsedTitle = lastDotIdx === -1 ? file.name : file.name.substring(0, lastDotIdx);
                    let bTempo = 120;
                    let tBeat = 24;
                    try {
                        const buf = await file.arrayBuffer();
						console.log(file.name)
                        if (window.ChipTuneTitleParser) {
                            parsedTitle = window.ChipTuneTitleParser.extractTitle(buf, file.name);
                            const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf);
                            if (imsInfo) {
                                bTempo = imsInfo.basicTempo;
                                tBeat = imsInfo.tickBeat;
                            }
                        }
                    } catch (err) {
                        console.warn(err);
                    }
                    const matchedIssFile = issMap.get(baseName);
                    scannedTracks.push({
                        filename: file.name,
                        format: ext,
                        title: parsedTitle,
                        fileObject: file,
                        issFileObject: matchedIssFile || null,
                        basicTempo: bTempo,
                        tickBeat: tBeat,
                    });
                }
                currentPlaylist = scannedTracks;
                folderLabel.innerText = "사용자 다중 파일 보관함 적재 완료";
                document.getElementById("listTitle").innerText = "📁 로컬 파일 보관함";
                selectedIndex = 0;
                playingIndex = 0;
                renderPlaylist();
                statusBarText.innerText = "대기";
            } else {
                statusBarText.innerText = "chiptune 포맷 파일이 없습니다.";
            }
        } else {
            statusBarText.innerText = "파일 로드 실패";
        }
    });

    function handlePlaylistReorder(fromIndex, toIndex) {
        const movedItem = currentPlaylist[fromIndex];
        currentPlaylist.splice(fromIndex, 1);
        currentPlaylist.splice(toIndex, 0, movedItem);
        if (playingIndex === fromIndex) playingIndex = toIndex;
        else if (fromIndex < playingIndex && toIndex >= playingIndex) playingIndex--;
        else if (fromIndex > playingIndex && toIndex <= playingIndex) playingIndex++;
        if (selectedIndex === fromIndex) selectedIndex = toIndex;
        else if (fromIndex < selectedIndex && toIndex >= selectedIndex) selectedIndex--;
        else if (fromIndex > selectedIndex && toIndex <= selectedIndex) selectedIndex++;
        renderPlaylist();
        statusBarText.innerText = "트랙 정렬 배치 완료";
    }

    btnPlay.addEventListener("click", () => { // 재생/일시정지
        if (currentPlaylist.length === 0) return;
        const audioEngine = window.TrackerAudioEngine;
        const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
        if (audioState && audioState.isPlaying) { // 일시정지
            if (audioEngine.queueWriter && audioEngine.queueWriter.node) {
                audioEngine.queueWriter.node.port.postMessage({ type: "stop" });
            }
            audioEngine.pause();
            btnPlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play" aria-hidden="true" data-darkreader-inline-stroke="" style="--darkreader-inline-stroke: currentColor;"><rect x="1" y="4" width="4" height="16" rx="1"></rect><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg>`;
	        const track = currentPlaylist[playingIndex];
			statusBarText.innerText = `일시정지 - ${track.title}`;
	        clearInterval(stateUpdateInterval); // 상태 체크 루프 중지
        } else {                                  // 일시정지 후 이어재생
            if (audioState && audioState.currentPositionMs > 0) {
                if (audioEngine.queueWriter && audioEngine.queueWriter.node) {
                    audioEngine.queueWriter.node.port.postMessage({ type: "start" });
                }
                audioEngine.play();
                btnPlay.innerHTML = `<svg xmlns="http://w3.org" viewBox="0 0 24 24" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
                if (typeof window.triggerBufferWriteFeedGlobal === "function") {
                    window.triggerBufferWriteFeedGlobal();
                }
				const track = currentPlaylist[playingIndex];
				statusBarText.innerText = `재생중 - ${track.title}`;
				runStateSyncLoop(); // 상태 체크 루프 시작
            } else loadAndPlayTrack();
        }
        if (typeof lucide !== "undefined") lucide.createIcons();
    });

    btnStop.addEventListener("click", () => { // 정지
        if (window.TrackerAudioEngine) {
            window.TrackerAudioEngine.stop();
            if (window.TrackerAudioEngine.queueWriter && window.TrackerAudioEngine.queueWriter.node) {
                window.TrackerAudioEngine.queueWriter.node.port.postMessage({ type: "hard_reset" });
            }
        }
        btnPlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play" aria-hidden="true" data-darkreader-inline-stroke="" style="--darkreader-inline-stroke: currentColor;"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg>`;
        progressFill.style.width = `0%`;
        progressText.innerText = `--:-- / --:--`;
        if (typeof lucide !== "undefined") lucide.createIcons();
		statusBarText.innerText = `재생중지`;
        clearInterval(stateUpdateInterval); // 상태 체크 루프 중지

    });
    btnNext.addEventListener("click", () => {
        if (playingIndex < currentPlaylist.length - 1) {
            playingIndex++;
            selectedIndex = playingIndex;
            loadAndPlayTrack();
        }
    });
    btnPrev.addEventListener("click", () => {
        if (playingIndex > 0) {
            playingIndex--;
            selectedIndex = playingIndex;
            loadAndPlayTrack();
        }
    });
    volumeSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        sliderLabel.innerText = `볼륨`;
        document.getElementById("sliderValue").innerText = `${val}%`;
        if (window.TrackerAudioEngine) window.TrackerAudioEngine.setMasterVolume(val);
    });
    btnMute.addEventListener("click", () => {
        const audioEngine = window.TrackerAudioEngine;
        isMuted = !isMuted;
        if (isMuted) {
            lastVolume = parseInt(volumeSlider.value, 10) || 70;
            volumeSlider.value = 0;
            document.getElementById("sliderValue").innerText = `0%`;
            btnMute.classList.add("muted-active");
            btnMute.innerText = "🔇";
            if (audioEngine) audioEngine.setMasterVolume(0);
        } else {
            const targetVol = lastVolume > 0 ? lastVolume : 50;
            volumeSlider.value = targetVol;
            document.getElementById("sliderValue").innerText = `${targetVol}%`;
            btnMute.classList.remove("muted-active");
            btnMute.innerText = "🔊";
            if (audioEngine) audioEngine.setMasterVolume(targetVol);
        }
    });

    helpBtn.addEventListener("click", () => {
        formatDialog.classList.remove("hidden");
        formatDialogBackdrop.classList.remove("hidden");
    });
    const closeDialog = () => {
        formatDialog.classList.add("hidden");
        formatDialogBackdrop.classList.add("hidden");
    };
    closeDialogBtn.addEventListener("click", closeDialog);
    formatDialogBackdrop.addEventListener("click", closeDialog);
    window.addEventListener("resize", () => {
        resizeSpectrumCanvases();
        renderSpectrumLEDs();
    });

  function setRepeatMode(mode, targetBtn) {
    repeatMode = mode; [repeatAll, repeatOne, repeatShuffle].forEach(b => b.classList.remove("dos-button-active"));
    targetBtn.classList.add("dos-button-active");
    if (window.TrackerAudioEngine) window.TrackerAudioEngine.setLoopEnabled(mode === 'one');
  }
    repeatAll.addEventListener("click", () => setRepeatMode("all", repeatAll));
    repeatOne.addEventListener("click", () => setRepeatMode("one", repeatOne));
    repeatShuffle.addEventListener("click", () => setRepeatMode("shuffle", repeatShuffle));

    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    async function autoScanDefaultPlaylistMetadata() {
        if (!window.ChipTuneTitleParser) return;
        statusBarText.innerText = "샘플 음원 메타데이터 동기화 중...";
        for (let track of currentPlaylist) {
            try {
                const check = await fetch(track.url, { method: "HEAD" });
                if (check.ok) {
                    const res = await fetch(track.url);
                    const buf = await res.arrayBuffer();
                    track.title = window.ChipTuneTitleParser.extractTitle(buf, track.filename);
                    const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf);
                    if (imsInfo) {
                        track.basicTempo = imsInfo.basicTempo;
                        track.tickBeat = imsInfo.tickBeat;
                    }
                }
            } catch (e) {}
        }
        statusBarText.innerText = "대기";
        renderPlaylist();
    }
    renderPlaylist();
    resizeSpectrumCanvases();
    requestAnimationFrame(runVisualizerEngineLoop);
    autoScanDefaultPlaylistMetadata();
});
