/**
 * player-engine.js 음악파일을 재생 모듈에 적재 하거나 해제하는 엔진
 */

window.TrackerAudioEngine = (function () {
    let SAMPLE_RATE = 44100;
    const CHUNK_FRAMES = 4096;

    let audioCtx = null;
    let gainNode = null;
    let analyserNode = null;

    let outputQueueNode = null;
    let queueWriter = null;

    let currentEngineType = null;
    let openmptModuleInstance = null;
    let adplugModuleInstance = null;

    let loadedModulePtr = null;
    let isPlaying = false;
    let loopEnabled = false;
    let onTrackEndCallback = null;

    let wasmInputBufferPtr = 0;
    let leftBufferPtr = 0;
    let rightBufferPtr = 0;

    let durationSeconds = 0;
    let totalSamplesSent = 0;

    let currentRuntimeTempo = 120;
    let tickBeat = 24;
    let currentHardwareAbsoluteTick = 0;

    const ADPLUG_ONLY_EXTENSIONS = [ // adplug 지원 확장명
      '.ims', '.rol', '.vgm', '.vgz', '.cmf', '.dro', '.raw', '.laa',
      '.imf', '.a2m', '.adl', '.amd', '.bam', '.cff', '.d00', '.dfm',
      '.dmo', '.dtm', '.got', '.hsc', '.hsp', '.hsq', '.jbm', '.ksm',
      '.lds', '.m'  , '.mad', '.mdi', '.mid', '.mkj', '.msc', '.mtk',
      '.mtr', '.mus', '.pis', '.plx', '.rad', '.rix', '.sa2', '.sat',
      '.sci', '.sdb', '.sng', '.sop', '.sqx', '.xad', '.xms', '.xsm',
      '.ha2', '.agd'
    ];

    const LIBOPENMPT_EXTENSIONS = [ // 트래커 지원 확장명.
      // Most common tracker formats
      '.mod', '.xm', '.it', '.s3m', '.mptm',
      // Other tracker formats
      '.stm', '.mtm', '.far', '.669', '.okt', '.ult', '.med',
      '.ptm', '.mdl', '.dmf', '.dsm', '.amf', '.ams', '.dbm',
      '.mo3', '.umx', '.j2b', '.gdm', '.sfx', '.wow',
    ];
	
	const ADD_EXTENSIONS = [ // 추가 확장명 adplug 용
		".a2t", ".bmf"
	];


    /**
     * 모듈 초기화
     */
    async function initContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === "suspended") await audioCtx.resume();
        SAMPLE_RATE = audioCtx.sampleRate;

		// 볼륨 설정
        if (!gainNode) {
            gainNode = audioCtx.createGain();
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 256;
            analyserNode.smoothingTimeConstant = 0.8;
            gainNode.connect(analyserNode);
            analyserNode.connect(audioCtx.destination);
        }

        if (!outputQueueNode) {
            try {
                await audioCtx.audioWorklet.addModule("./audio-queue-processor.js");
                const workletNode = new AudioWorkletNode(audioCtx, "audio-queue-processor", {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [2],
                });

                outputQueueNode = workletNode;
                outputQueueNode.connect(gainNode);

                queueWriter = {
                    node: workletNode,
                    write: function (fillCallback) {
                        if (!isPlaying) return;

                        const leftData = new Float32Array(CHUNK_FRAMES);
                        const rightData = new Float32Array(CHUNK_FRAMES);

                        const segment = {
                            frameCount: CHUNK_FRAMES,
                            set: function (frameIdx, channelIdx, value) {
                                if (channelIdx === 0) leftData[frameIdx] = value;
                                else rightData[frameIdx] = value;
                            },
                        };

                        const written = fillCallback(segment);
                        if (written > 0 && isPlaying) {
                            workletNode.port.postMessage(
                                {
                                    type: "chunk",
                                    channels: [leftData, rightData],
                                    length: written,
                                },
                                [leftData.buffer, rightData.buffer]
                            );
                        }
                    },
                };

                workletNode.port.postMessage({ type: "start" });

                workletNode.port.onmessage = (e) => {
                    if (e.data.type === "ready_for_feed" && isPlaying) {
                        if (window.triggerBufferWriteFeedGlobal) {
                            window.triggerBufferWriteFeedGlobal();
                            window.triggerBufferWriteFeedGlobal();
                        }
                    } else if (e.data.type === "recycle" && isPlaying) {
                        if (e.data.currentRealTick !== undefined) {
                            currentHardwareAbsoluteTick = e.data.currentRealTick;
                        }
                        if (window.triggerBufferWriteFeedGlobal) window.triggerBufferWriteFeedGlobal();
                    }
                };
            } catch (err) {
                console.error("AudioWorklet 컴파일 에러:", err);
            }
        } // if (!outputQueueNode) {
    }

    /**
     * 지원하는 모듈 선택
     */
    function detectEngineType(filename, musicArrayBuffer={}) {
        let ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        //return ADPLUG_ONLY_EXTENSIONS.includes(ext) ? "adplug" : "libopenmpt";

		// imf 파일의 경우 두가지 포멧이 존재하므로
		// adlib용 signature 정보를 확인한다.
		if(ext=='.imf'){
			const u8Array = new Uint8Array(musicArrayBuffer);
			//let isAdlibIMF = true;
			let ADLIB = [65, 68, 76, 73, 66];
			for(var i=0; i<5; i++){
				if(u8Array[i]!=ADLIB[i]){
					//isAdlibIMF=false;
					ext = '.mod'; // libopenmpt 확장명을 강제 세팅함. 
					break;
				}
			} 
		}

		return ADPLUG_ONLY_EXTENSIONS.includes(ext) ? "adplug" :
				LIBOPENMPT_EXTENSIONS.includes(ext) ? "libopenmpt" : ADD_EXTENSIONS.includes(ext) ? "adplug" : null
    }

	/**
	 * 엔진 준비 wasm 로드
	 */
    async function ensureEngineReady(type) {
        if (type === "libopenmpt" && !openmptModuleInstance) {
            const factory = window.libopenmpt || libopenmpt;
            const res = factory();
            openmptModuleInstance = res instanceof Promise ? await res : res;
        } else if (type === "adplug" && !adplugModuleInstance) {
            const factory = window.AdPlugModule || AdPlugModule;
            if (!factory) throw new Error("AdPlugModule 스크립트가 로드되지 않았습니다.");
            statusBarText.innerText = "AdLib 하드웨어 WASM 에뮬레이터 초기화 중...";
            const cachedModule = window.Module;
            window.Module = undefined;
            const res = typeof factory === "function" ? factory() : factory;
            let rawModule = res instanceof Promise ? await res : res;
            let retries = 0;
            while (retries < 40) {
                const target = rawModule || window.Module || (typeof Module !== "undefined" ? Module : null);
                if (
                    target &&
                    typeof target._emu_init === "function" &&
                    target.HEAPU8 &&
                    typeof target._emu_get_audio_buffer_length === "function"
                ) {
                    adplugModuleInstance = target;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
                retries++;
            }
            if (cachedModule) window.Module = cachedModule;
            if (!adplugModuleInstance) throw new Error("AdPlug WASM 컴파일 지연 타임아웃");
            statusBarText.innerText = "대기";
        }
    }

	// it,mtm,s3m 등 재생시간 구하기 - 걍 고쳐짐??? 그래서 방치함.
	// libopenmpt.js it,mtm,s3m 등 _openmpt_module_get_duration_seconds() 가 안될때 전체시간 구하는 방법 샘플 파라미터 정보
	// Sample 1
	// 사용 예시
	//	const exactDuration = getExactDuration(modPtr, 44100);
	//	console.log("정확한 전체 시간(초):", exactDuration);
	//const exactDuration = getExactDuration(audioEngine.loadedModulePtr, audioEngine.SAMPLE_RATE);
	function getExactDuration(modPtr, sampleRate) {
        const audioEngine = window.TrackerAudioEngine;
        if (!audioEngine) {
			console.log('모듈 적재 실패!');
		}
		const openmptModuleInstance = audioEngine.openmptModuleInstance;
		
		// 임시로 데이터를 받아낼 버퍼 생성 (렌더링 속도를 위해 4096개 정도 크기 지정)
		const bufferSize = 4096;
		const leftBuffer = openmptModuleInstance._malloc(bufferSize * 4);
		const rightBuffer = openmptModuleInstance._malloc(bufferSize * 4);
		
		let totalSamplesRendered = 0;
		let readSamples = 0;

		// 곡이 끝날 때까지(리턴 값이 0이 될 때까지) 초고속으로 읽기
		while ((readSamples = openmptModuleInstance._openmpt_module_read_float_stereo(modPtr, sampleRate, bufferSize, leftBuffer, rightBuffer)) > 0) {
			totalSamplesRendered += readSamples;
			
			// 무한 루프 방지 안전장치 (예: 30분 분량 이상 처리되면 중단)
			if (totalSamplesRendered > sampleRate * 1800) { 
				break;
			}
		}

		// 메모리 해제
		openmptModuleInstance._free(leftBuffer);
		openmptModuleInstance._free(rightBuffer);

		// 사용 후 모듈 위치를 다시 처음(0초)으로 되돌려놓아야 정상 재생이 가능합니다.
		openmptModuleInstance._openmpt_module_set_position_seconds(modPtr, 0.0);

		// 총 샘플 수를 샘플 레이트(Hz)로 나누어 정확한 전체 초(seconds)를 구합니다.
		return totalSamplesRendered / sampleRate;
	}
	// Sample 2
	/*
	// 1. 현재 진행 상태(위치)를 백업합니다.
	var c_order = _openmpt_module_get_current_order(mod_ptr);
	var c_row = _openmpt_module_get_current_row(mod_ptr);

	// 2. 곡의 맨 처음으로 이동합니다.
	_openmpt_module_set_position_seconds(mod_ptr, 0);

	// 3. 아주 작은 단위(예: 1초 또는 10초)로 끝까지 점프하며 누적 시간을 구합니다.
	var total_seconds = 0;
	var step = 10.0; // 10초씩 건너뛰기

	while (true) {
		var current_pos = _openmpt_module_get_position_seconds(mod_ptr);
		
		// 다음 위치로 강제 이동 시도
		_openmpt_module_set_position_seconds(mod_ptr, current_pos + step);
		
		// 이동 후의 위치를 다시 확인
		var next_pos = _openmpt_module_get_position_seconds(mod_ptr);
		
		// 더 이상 시간이 늘어나지 않는다면 곡의 끝에 도달한 것입니다.
		if (next_pos <= current_pos) {
			total_seconds = current_pos;
			break;
		}
	}

	// 4. 측정이 끝난 후 원래 재생 중이던 위치로 복구합니다.
	_openmpt_module_set_position_order_row(mod_ptr, c_order, c_row);

	console.log("정확한 전체 시간(초):", total_seconds);
	*/


    /**
     * WASM 에뮬레이터 코어 레지스터 음표 가로채기(Note Intercept) 직결 엔진
     * 유령 API와 Analyser 편법을 완전히 걷어내고, 실제 악보의 미디 신호를 실시간 방출합니다.
     */
    return {
        get audioCtx() { return audioCtx; },
        get queueWriter() { return queueWriter; },
        get currentEngineType() { return currentEngineType; },
        get openmptModuleInstance() { return openmptModuleInstance; },
        get adplugModuleInstance() { return adplugModuleInstance; },
        get loadedModulePtr() { return loadedModulePtr; },
        get SAMPLE_RATE() { return SAMPLE_RATE; },
        get loopEnabled() { return loopEnabled; },
        get onTrackEndCallback() { return onTrackEndCallback; },
        get currentRuntimeTempo() { return currentRuntimeTempo; },
        set totalSamplesSent(val) { totalSamplesSent = val; },
        get totalSamplesSent() { return totalSamplesSent; },
        get currentHardwareAbsoluteTick() { return currentHardwareAbsoluteTick; },

        get detectEngineType() { return detectEngineType; }, // 확장명으로 연주엔진 선택

        setOnTrackEnd(callback) { onTrackEndCallback = callback; },

		// 재생 중간지점 탐색
        seekTo(targetTimeMs) {
            if (!loadedModulePtr) return;
            const targetSeconds = targetTimeMs / 1000;

            if (currentEngineType === "libopenmpt" && openmptModuleInstance) {
                openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, targetSeconds);
            } else if (currentEngineType === "adplug" && adplugModuleInstance) {
                if (typeof adplugModuleInstance._emu_rewind === "function") {
                    adplugModuleInstance._emu_rewind();
                    const currentBpm = currentRuntimeTempo || 120;
                    const currentBeat = tickBeat || 24;
                    const ticksPerSec = (currentBpm * currentBeat) / 60;
                    const targetTick = targetSeconds * ticksPerSec;

                    let currentTick = 0;
                    let safetyCounter = 0;
                    while (currentTick < targetTick && safetyCounter < 4000) {
                        adplugModuleInstance._emu_compute_audio_samples();
                        if (this.isActiveRol) {
                            currentTick += 0.5;
                        } else if (typeof adplugModuleInstance._emu_get_current_position === "function") {
                            currentTick = (adplugModuleInstance._emu_get_current_position() / 1000) * ticksPerSec;
                        } else {
                            currentTick += 1;
                        }
                        safetyCounter++;
                    }
                }
            }

            if (outputQueueNode && queueWriter && queueWriter.node) {
                outputQueueNode.port.postMessage({ type: "stop" });
                const currentBpm = currentRuntimeTempo || 120;
                const currentBeat = tickBeat || 24;
                const ticksPerSec = (currentBpm * currentBeat) / 60;

                outputQueueNode.port.postMessage({
                    type: "meta_sync",
                    basicTempo: currentBpm,
                    tickBeat: currentBeat,
                    sampleRate: SAMPLE_RATE,
                });
                currentHardwareAbsoluteTick = targetSeconds * ticksPerSec;
                outputQueueNode.port.postMessage({ type: "start" });
            }
            totalSamplesSent = targetSeconds * SAMPLE_RATE;
            if (window.triggerBufferWriteFeedGlobal && isPlaying) {
                window.triggerBufferWriteFeedGlobal();
                window.triggerBufferWriteFeedGlobal();
            }
        }, // seekTo(targetTimeMs) {

		// 음악파일 버퍼를 재생모듈에 적재
        async loadTrack(musicArrayBuffer, filename, bnkArrayBuffer = null) {
//window.arrayBuffer = musicArrayBuffer; // 디버그용
            await initContext();
            const type = detectEngineType(filename, musicArrayBuffer);
            await ensureEngineReady(type);
            this.unload();

            currentEngineType = type;
            const u8Array = new Uint8Array(musicArrayBuffer);
window.u8Array = u8Array; // 디버그용
            const fileSize = u8Array.length;
            let bTempo = 120;
            let tBeat = 24;

            const lowerName = filename.toLowerCase();
            const isRolFile = lowerName.endsWith(".rol");
            const isSopFile = lowerName.endsWith(".sop"); // 2026-10-09 금 add
            const isVgmFile = lowerName.endsWith(".vgm") || lowerName.endsWith(".vgz");
            this.isActiveRol = isRolFile;

            if (type === "libopenmpt" && openmptModuleInstance) {
                wasmInputBufferPtr = openmptModuleInstance._malloc(fileSize);
                openmptModuleInstance.HEAPU8.set(u8Array, wasmInputBufferPtr);
                loadedModulePtr = openmptModuleInstance._openmpt_module_create_from_memory(
                    wasmInputBufferPtr,
                    fileSize,
                    0,
                    0,
                    0
                );
                if (!loadedModulePtr) throw new Error("OpenMPT 적재 실패");
                durationSeconds = openmptModuleInstance._openmpt_module_get_duration_seconds(loadedModulePtr);
                currentRuntimeTempo = 120;
                tickBeat = 24;
            } else if (type === "adplug" && adplugModuleInstance) {
                const result = adplugModuleInstance._emu_init(SAMPLE_RATE);
                if (result !== 0) throw new Error(`AdPlug 초기화 실패: ${result}`);
                loadedModulePtr = 1;

                if (bnkArrayBuffer) { // 악기 뱅크 버퍼에 적재
                    const bnkU8 = new Uint8Array(bnkArrayBuffer);
                    const bnkSize = bnkU8.length;
                    const bnkPtr = adplugModuleInstance._malloc(bnkSize);
                    adplugModuleInstance.HEAPU8.set(bnkU8, bnkPtr);
                    const bnkNamePtr = adplugModuleInstance._malloc(13);
                    adplugModuleInstance.stringToUTF8("STANDARD.BNK", bnkNamePtr, 13);
                    adplugModuleInstance._emu_add_file(bnkNamePtr, bnkPtr, bnkSize);
                    adplugModuleInstance._free(bnkNamePtr);
                    adplugModuleInstance._free(bnkPtr);
                }

                wasmInputBufferPtr = adplugModuleInstance._malloc(fileSize);
                adplugModuleInstance.HEAPU8.set(u8Array, wasmInputBufferPtr);
                const fileNamePtr = adplugModuleInstance._malloc(filename.length + 1);
                adplugModuleInstance.stringToUTF8(filename, fileNamePtr, filename.length + 1);
                const loadResult = adplugModuleInstance._emu_load_file(fileNamePtr, wasmInputBufferPtr, fileSize);
                adplugModuleInstance._free(fileNamePtr);
                if (loadResult !== 0) {
                    adplugModuleInstance._emu_teardown();
                    loadedModulePtr = null;
                    throw new Error("AdPlug 적재 실패");
                }

                if (window.ChipTuneTitleParser) {
                    if (isRolFile) {
                        const info = window.ChipTuneTitleParser.parseRolHeader(musicArrayBuffer, filename);
                        if (info) {
                            bTempo = info.basicTempo;
                            tBeat = info.tickBeat;
                            durationSeconds = info.totalTick / ((bTempo * tBeat) / 60);
                        }
                    } else if (isVgmFile) {
                        const info = window.ChipTuneTitleParser.parseVgmHeader(musicArrayBuffer, filename);
                        durationSeconds = info.duration;
                        bTempo = 120;
                        tBeat = 24;
                    } else if (isSopFile) {
                        const info = window.ChipTuneTitleParser.parseSopHeader(musicArrayBuffer, filename);
                        durationSeconds = adplugModuleInstance._emu_get_max_position();
                        bTempo = info.basicTempo;
                        tBeat = info.tickBeat;
                    } else {
                        const info = window.ChipTuneTitleParser.parseImsHeader(musicArrayBuffer);
                        if (info) {
                            bTempo = info.basicTempo;
                            tBeat = info.tickBeat;
                            durationSeconds = info.totalTick / ((bTempo * tBeat) / 60);
                        }
                    }
                }
                currentRuntimeTempo = bTempo;
//console.log('currentRuntimeTempo1',currentRuntimeTempo)
                tickBeat = tBeat;
                totalSamplesSent = 0;
            }

            currentHardwareAbsoluteTick = 0;
            if (outputQueueNode) {
                outputQueueNode.port.postMessage({
                    type: "meta_sync",
                    basicTempo: bTempo,
                    tickBeat: tBeat,
                    sampleRate: SAMPLE_RATE,
                });
            }
            isPlaying = true;
            if (outputQueueNode) {
                outputQueueNode.port.postMessage({ type: "stop" });
                outputQueueNode.port.postMessage({ type: "start" });
            }
        }, // async loadTrack(musicArrayBuffer, filename, bnkArrayBuffer = null) {

		// 재생
        play() {
            if (loadedModulePtr) {
                isPlaying = true;
                if (outputQueueNode) outputQueueNode.port.postMessage({ type: "start" });
            }
        },
		// 일시 정지
        pause() {
            isPlaying = false;
            if (outputQueueNode) outputQueueNode.port.postMessage({ type: "stop" });
        },
		// 재생 중지
        stop() {
            isPlaying = false;
            currentHardwareAbsoluteTick = 0;
            if (outputQueueNode) outputQueueNode.port.postMessage({ type: "stop" });
            if (loadedModulePtr) {
                if (currentEngineType === "libopenmpt")
                    openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0);
                else if (currentEngineType === "adplug") adplugModuleInstance._emu_rewind();
                totalSamplesSent = 0;
            }
        },
		// 모듈에 적재된 곡 해제
        unload() {
            this.stop();
            if (currentEngineType === "libopenmpt" && openmptModuleInstance) {
                if (loadedModulePtr) openmptModuleInstance._openmpt_module_destroy(loadedModulePtr);
                if (wasmInputBufferPtr) openmptModuleInstance._free(wasmInputBufferPtr);
            } else if (currentEngineType === "adplug" && adplugModuleInstance) {
                if (loadedModulePtr) adplugModuleInstance._emu_teardown();
                if (wasmInputBufferPtr) adplugModuleInstance._free(wasmInputBufferPtr);
            }
            loadedModulePtr = null;
            wasmInputBufferPtr = 0;
            durationSeconds = 0;
            currentEngineType = null;
        },

        // 볼륨설정
        setMasterVolume(vol) {
            if (gainNode) gainNode.gain.value = vol / 100;
        },
		// 반복설정
        setLoopEnabled(enabled) {
            loopEnabled = enabled;
            if (currentEngineType === "adplug" && adplugModuleInstance)
                adplugModuleInstance._emu_set_loop_enabled(enabled ? 1 : 0);
        },
		// 
        getAnalyserNode() {
            return analyserNode;
        },
		/**
		 * 재생상태 추출
		 * 반환값
		 *   재생여부,재생시간,전체시간
		 */
        getPlaybackState() {
            if (!loadedModulePtr) return null;
            let currentTimeMs = 0;
            if (currentEngineType === "libopenmpt") {
                currentTimeMs = (totalSamplesSent / SAMPLE_RATE) * 1000;
            } else if (currentEngineType === "adplug") {
                if (this.isActiveRol) {
                    const ticksPerSec = ((currentRuntimeTempo || 120) * (tickBeat || 12)) / 60;
                    currentTimeMs = ticksPerSec > 0 ? (currentHardwareAbsoluteTick / ticksPerSec) * 1000 : 0;
                } else {
                    currentTimeMs = adplugModuleInstance._emu_get_current_position();
                }
            }
            return { isPlaying: isPlaying, currentPositionMs: currentTimeMs, totalDurationMs: durationSeconds * 1000 };
        },
    };
})();
