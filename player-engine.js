/**
 * player-engine.js - Part 1: 하드웨어 절대 틱(Absolute Tick) 동기화 파이프라인 구성
 */

window.TrackerAudioEngine = (function() {
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
  
  // [칼싱크 핵심 공유 변수]
  let currentHardwareAbsoluteTick = 0;

  const ADPLUG_ONLY_EXTENSIONS = [
    '.ims', '.rol', '.vgm', '.vgz', '.cmf', '.dro', '.raw', '.laa',
    '.imf', '.a2m', '.adl', '.amd', '.bam', '.cff', '.d00', '.dfm',
    '.dmo', '.dtm', '.got', '.hsc', '.hsp', '.hsq', '.jbm', '.ksm',
    '.lds', '.m', '.mad', '.mdi', '.mid', '.mkj', '.msc', '.mtk',
    '.mtr', '.mus', '.pis', '.plx', '.rad', '.rix', '.sa2', '.sat',
    '.sci', '.sdb', '.sng', '.sop', '.sqx', '.xad', '.xms', '.xsm',
    '.ha2', '.agd'
  ];

  async function initContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    SAMPLE_RATE = audioCtx.sampleRate;

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
        await audioCtx.audioWorklet.addModule('./audio-queue-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-queue-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });

        outputQueueNode = workletNode;
        outputQueueNode.connect(gainNode);

        queueWriter = {
          node: workletNode,
          write: function(fillCallback) {
            if (!isPlaying) return;

            const leftData = new Float32Array(CHUNK_FRAMES);
            const rightData = new Float32Array(CHUNK_FRAMES);
            
            const segment = {
              frameCount: CHUNK_FRAMES,
              set: function(frameIdx, channelIdx, value) {
                if (channelIdx === 0) leftData[frameIdx] = value;
                else rightData[frameIdx] = value;
              }
            };

            const written = fillCallback(segment);
            if (written > 0 && isPlaying) {
              workletNode.port.postMessage({
                type: 'chunk',
                channels: [leftData, rightData],
                length: written
              }, [leftData.buffer, rightData.buffer]);
            }
          }
        };

        workletNode.port.postMessage({ type: 'start' });
        
        workletNode.port.onmessage = (e) => {
          if (e.data.type === 'ready_for_feed' && isPlaying) {
            if (window.triggerBufferWriteFeedGlobal) {
              window.triggerBufferWriteFeedGlobal();
              window.triggerBufferWriteFeedGlobal();
            }
          }
          else if (e.data.type === 'recycle' && isPlaying) {
            // [오차 0% 절대 하드웨어 틱 수령]
            // 오디오 사운드카드가 재생을 완수하고 넘겨준 한 치의 타임라인 오차도 없는 진짜 경과 틱 수치를 영접합니다.
            if (e.data.currentRealTick !== undefined) {
              currentHardwareAbsoluteTick = e.data.currentRealTick;
            }
            if (window.triggerBufferWriteFeedGlobal) window.triggerBufferWriteFeedGlobal();
          }
        };
      } catch (err) { console.error("AudioWorklet 컴파일 에러:", err); }
    }
  }

  function detectEngineType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ADPLUG_ONLY_EXTENSIONS.includes(ext) ? 'adplug' : 'libopenmpt';
  }

  async function ensureEngineReady(type) {
    if (type === 'libopenmpt' && !openmptModuleInstance) {
      const factory = window.libopenmpt || libopenmpt;
      const res = factory(); openmptModuleInstance = (res instanceof Promise) ? await res : res;
    } 
    else if (type === 'adplug' && !adplugModuleInstance) {
      const factory = window.AdPlugModule || AdPlugModule;
      if (!factory) throw new Error("AdPlugModule 스크립트가 로드되지 않았습니다.");
      const cachedModule = window.Module; window.Module = undefined;
      const res = typeof factory === 'function' ? factory() : factory;
      let rawModule = (res instanceof Promise) ? await res : res;
      let retries = 0;
      while (retries < 40) {
        const target = rawModule || window.Module || (typeof Module !== 'undefined' ? Module : null);
        if (target && typeof target._emu_init === 'function' && target.HEAPU8 && typeof target._emu_get_audio_buffer_length === 'function') {
          adplugModuleInstance = target; break;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); retries++;
      }
      if (cachedModule) window.Module = cachedModule;
      if (!adplugModuleInstance) throw new Error("AdPlug WASM 컴파일 지연 타임아웃");
    }
  }
  /**
   * player-engine.js - Part 2: 절대 하드웨어 틱 공유 인터페이스 외장 개방 및 제어 구조 마감
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
    
    // [글로벌 절대 하드웨어 틱 인터페이스 노출 개방] player.js 가 긁어다가 바로 자막 매핑에 투사합니다.
    get currentHardwareAbsoluteTick() { return currentHardwareAbsoluteTick; },

    set totalSamplesSent(val) { totalSamplesSent = val; },
    get totalSamplesSent() { return totalSamplesSent; },

    setOnTrackEnd(callback) { onTrackEndCallback = callback; },

    async loadTrack(musicArrayBuffer, filename, bnkArrayBuffer = null) {
      await initContext();
      const type = detectEngineType(filename);
      await ensureEngineReady(type);
      this.unload();

      currentEngineType = type;
      const u8Array = new Uint8Array(musicArrayBuffer);
      const fileSize = u8Array.length;

      let bTempo = 120;
      let tBeat = 24;

      if (type === 'libopenmpt') {
        wasmInputBufferPtr = openmptModuleInstance._malloc(fileSize);
        openmptModuleInstance.HEAPU8.set(u8Array, wasmInputBufferPtr);
        loadedModulePtr = openmptModuleInstance._openmpt_module_create_from_memory(wasmInputBufferPtr, fileSize, 0, 0, 0);
        if (!loadedModulePtr) throw new Error("OpenMPT 적재 실패");
        durationSeconds = openmptModuleInstance._openmpt_module_get_duration_seconds(loadedModulePtr);
      } 
      else if (type === 'adplug') {
        const result = adplugModuleInstance._emu_init(SAMPLE_RATE);
        if (result !== 0) throw new Error(`AdPlug 초기화 실패: ${result}`);
        loadedModulePtr = 1;

        if (bnkArrayBuffer) {
          const bnkU8 = new Uint8Array(bnkArrayBuffer); const bnkSize = bnkU8.length;
          const bnkPtr = adplugModuleInstance._malloc(bnkSize); adplugModuleInstance.HEAPU8.set(bnkU8, bnkPtr);
          const bnkNamePtr = adplugModuleInstance._malloc(13); adplugModuleInstance.stringToUTF8("STANDARD.BNK", bnkNamePtr, 13);
          adplugModuleInstance._emu_add_file(bnkNamePtr, bnkPtr, bnkSize);
          adplugModuleInstance._free(bnkNamePtr); adplugModuleInstance._free(bnkPtr);
        }

        wasmInputBufferPtr = adplugModuleInstance._malloc(fileSize);
        adplugModuleInstance.HEAPU8.set(u8Array, wasmInputBufferPtr);
        const fileNamePtr = adplugModuleInstance._malloc(filename.length + 1);
        adplugModuleInstance.stringToUTF8(filename, fileNamePtr, filename.length + 1);
        const loadResult = adplugModuleInstance._emu_load_file(fileNamePtr, wasmInputBufferPtr, fileSize);
        adplugModuleInstance._free(fileNamePtr);
        if (loadResult !== 0) { adplugModuleInstance._emu_teardown(); loadedModulePtr = null; throw new Error("AdPlug 적재 실패"); }

        durationSeconds = adplugModuleInstance._emu_get_max_position() / 1000;
        totalSamplesSent = 0;
        
        if (window.ChipTuneTitleParser) {
          const info = window.ChipTuneTitleParser.parseImsHeader(musicArrayBuffer);
          if (info) { bTempo = info.basicTempo; tBeat = info.tickBeat; }
        }
      }

      currentHardwareAbsoluteTick = 0;
      
      // 하드웨어 스레드로 최초 규격 동기화 사양 전달
      if (outputQueueNode) {
        outputQueueNode.port.postMessage({ 
          type: 'meta_sync', 
          basicTempo: bTempo, 
          tickBeat: tBeat, 
          sampleRate: SAMPLE_RATE 
        });
      }

      isPlaying = true;
      if (outputQueueNode) {
        outputQueueNode.port.postMessage({ type: 'stop' });
        outputQueueNode.port.postMessage({ type: 'start' });
      }
    },

    play() { 
      if (loadedModulePtr) {
        isPlaying = true;
        if (outputQueueNode) outputQueueNode.port.postMessage({ type: 'start' });
      }
    },
    pause() { 
      isPlaying = false;
      if (outputQueueNode) outputQueueNode.port.postMessage({ type: 'stop' });
    },
    stop() {
      isPlaying = false;
      currentHardwareAbsoluteTick = 0;
      if (outputQueueNode) outputQueueNode.port.postMessage({ type: 'stop' });
      if (loadedModulePtr) {
        if (currentEngineType === 'libopenmpt') openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0);
        else if (currentEngineType === 'adplug') adplugModuleInstance._emu_rewind();
        totalSamplesSent = 0;
      }
    },

    unload() {
      this.stop();
      if (currentEngineType === 'libopenmpt' && openmptModuleInstance) {
        if (loadedModulePtr) openmptModuleInstance._openmpt_module_destroy(loadedModulePtr);
        if (wasmInputBufferPtr) openmptModuleInstance._free(wasmInputBufferPtr);
      } else if (currentEngineType === 'adplug' && adplugModuleInstance) {
        if (loadedModulePtr) adplugModuleInstance._emu_teardown();
        if (wasmInputBufferPtr) adplugModuleInstance._free(wasmInputBufferPtr);
      }
      loadedModulePtr = null; wasmInputBufferPtr = 0; durationSeconds = 0; currentEngineType = null;
    },

    setMasterVolume(vol) { if (gainNode) gainNode.gain.value = vol / 100; },
    setLoopEnabled(enabled) { loopEnabled = enabled; if (currentEngineType === 'adplug' && adplugModuleInstance) adplugModuleInstance._emu_set_loop_enabled(enabled ? 1 : 0); },
    getAnalyserNode() { return analyserNode; },

    getPlaybackState() {
      if (!loadedModulePtr) return null;
      let currentTimeMs = 0;
      if (currentEngineType === 'libopenmpt') {
        currentTimeMs = (totalSamplesSent / SAMPLE_RATE) * 1000;
      } else if (currentEngineType === 'adplug') {
        currentTimeMs = adplugModuleInstance._emu_get_current_position();
      }
      return { isPlaying: isPlaying, currentPositionMs: currentTimeMs, totalDurationMs: durationSeconds * 1000 };
    }
  };
})();
