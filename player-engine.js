/**
 * player-engine.js - Part 1: AudioWorklet 가속 큐 스트림 노드 및 WASM 초기화 루틴 (최종 완결 교정본)
 */

window.TrackerAudioEngine = (function() {
  let SAMPLE_RATE = 44100;
  const CHUNK_FRAMES = 4096; // queue-stream.ts 고정 기본 버퍼 프레임 규격

  let audioCtx = null;
  let gainNode = null;
  let analyserNode = null;
  
  // queue-stream.ts 에서 복원 이식한 커스텀 스트리밍 큐 노드 인프라
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

  const ADPLUG_ONLY_EXTENSIONS = [
    '.ims', '.rol', '.vgm', '.vgz', '.cmf', '.dro', '.raw', '.laa',
    '.imf', '.a2m', '.adl', '.amd', '.bam', '.cff', '.d00', '.dfm',
    '.dmo', '.dtm', '.got', '.hsc', '.hsp', '.hsq', '.jbm', '.ksm',
    '.lds', '.m', '.mad', '.mdi', '.mid', '.mkj', '.msc', '.mtk',
    '.mtr', '.mus', '.pis', '.plx', '.rad', '.rix', '.sa2', '.sat',
    '.sci', '.sdb', '.sng', '.sop', '.sqx', '.xad', '.xms', '.xsm',
    '.ha2', '.agd'
  ];

  /**
   * AudioWorklet 모듈 등록 및 전역 컨텍스트 구성
   */
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
      
      // 애널라이저와 메인 오디오 가속 채널 결합
      gainNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination);
    }

    // [문법 보정 완료] 유실되어 깨졌던 outputChannelCount 배열 선언부를 [channelCount]로 완벽 교정했습니다.
    if (!outputQueueNode) {
      try {
        await audioCtx.audioWorklet.addModule('./audio-queue-processor.js');
        
        // 2채널(스테레오) 출력을 하드웨어 스레드 노드로 매핑 설정
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-queue-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });

        outputQueueNode = workletNode;
        outputQueueNode.connect(gainNode);

        // transferable Float32Array 전사 청크 풀 클래스 모방 장착
        queueWriter = {
          node: workletNode,
          write: function(fillCallback) {
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
            if (written > 0) {
              workletNode.port.postMessage({
                type: 'chunk',
                channels: [leftData, rightData],
                length: written
              }, [leftData.buffer, rightData.buffer]);
            }
          }
        };

        // 가속 워크렛 채널 개방 시작 신호 송신
        workletNode.port.postMessage({ type: 'start' });
        
        // 워크렛에서 올라오는 리사이클 신호 추적 핸들러 부착
        workletNode.port.onmessage = (e) => {
          if (e.data.type === 'recycle' && isPlaying) {
            triggerBufferWriteFeed();
          }
        };
      } catch (err) {
        console.error("AudioWorklet 가속 장치 컴파일 붕괴:", err);
      }
    }
  }

  function detectEngineType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ADPLUG_ONLY_EXTENSIONS.includes(ext) ? 'adplug' : 'libopenmpt';
  }

  async function ensureEngineReady(type) {
    if (type === 'libopenmpt' && !openmptModuleInstance) {
      const factory = window.libopenmpt || libopenmpt;
      if (!factory) throw new Error("libopenmpt 스크립트가 누락되었습니다.");
      
      const cachedModule = window.Module;
      window.Module = undefined; 
      
      const res = factory();
      openmptModuleInstance = (res instanceof Promise) ? await res : res;
      if (cachedModule) window.Module = cachedModule;
    } 
    
    else if (type === 'adplug' && !adplugModuleInstance) {
      const factory = window.AdPlugModule || AdPlugModule;
      if (!factory) throw new Error("AdPlugModule 스크립트가 로드되지 않았습니다.");
      
      statusBarText.innerText = "AdLib 하드웨어 WASM 에뮬레이터 컴파일 가동...";
      const cachedModule = window.Module;
      window.Module = undefined;

      const res = typeof factory === 'function' ? factory() : factory;
      let rawModule = (res instanceof Promise) ? await res : res;

      let retries = 0;
      while (retries < 40) {
        const target = rawModule || window.Module || (typeof Module !== 'undefined' ? Module : null);
        if (target && typeof target._emu_init === 'function' && target.HEAPU8 && typeof target._emu_get_audio_buffer_length === 'function') {
          adplugModuleInstance = target;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); 
        retries++;
      }

      if (cachedModule) window.Module = cachedModule;
      if (!adplugModuleInstance) throw new Error("AdPlug WASM 컴파일 지연 타임아웃");
      statusBarText.innerText = "대기";
    }
  }
//2
  /**
   * player-engine.js - Part 2: AudioWorklet 전용 실시간 링 버퍼 피더 및 인터페이스 마감
   */

  function triggerBufferWriteFeed() {
    if (!isPlaying || !loadedModulePtr || !queueWriter) return;

    queueWriter.write((segment) => {
      let framesRendered = segment.frameCount;
      let trackFinished = false;

      if (currentEngineType === 'libopenmpt') {
        const bytesPerSample = 4;
        if (!leftBufferPtr) {
          leftBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample);
          rightBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample);
        }

        const count = openmptModuleInstance._openmpt_module_read_float_stereo(
          loadedModulePtr, SAMPLE_RATE, framesRendered, leftBufferPtr, rightBufferPtr
        );

        if (count <= 0) {
          trackFinished = true;
          framesRendered = 0;
        } else {
          framesRendered = count;
          const wasmLeft = new Float32Array(openmptModuleInstance.HEAPF32.buffer, leftBufferPtr, framesRendered);
          const wasmRight = new Float32Array(openmptModuleInstance.HEAPF32.buffer, rightBufferPtr, framesRendered);
          
          for (let i = 0; i < framesRendered; i++) {
            segment.set(i, 0, wasmLeft[i]);
            segment.set(i, 1, wasmRight[i]);
          }
        }
      } 
      else if (currentEngineType === 'adplug') {
        const scale = 1 / 32768.0;
        const finished = adplugModuleInstance._emu_compute_audio_samples() !== 0;
        if (finished) trackFinished = true;

        const bufferPtr = adplugModuleInstance._emu_get_audio_buffer();
        const bufferLength = adplugModuleInstance._emu_get_audio_buffer_length();
        const numSamples = bufferLength / 2; 
        const renderCount = Math.min(framesRendered, numSamples / 2);

        const runtimeShortHeap = new Int16Array(adplugModuleInstance.HEAP16.buffer, bufferPtr, numSamples);

        // [문법 보정 완료] 닫히지 않고 열려있던 오른쪽 채널의 소괄호 짝을 정상 조립했습니다.
        for (let i = 0; i < renderCount; i++) {
          segment.set(i, 0, runtimeShortHeap[i * 2] * scale);
          segment.set(i, 1, runtimeShortHeap[i * 2 + 1] * scale);
        }
        framesRendered = renderCount;
        totalSamplesSent += renderCount;
      }

      if (trackFinished) {
        if (loopEnabled) {
          if (currentEngineType === 'libopenmpt') openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0);
          else if (currentEngineType === 'adplug') adplugModuleInstance._emu_rewind();
          totalSamplesSent = 0;
        } else {
          isPlaying = false;
          if (onTrackEndCallback) setTimeout(() => onTrackEndCallback(), 0);
        }
      }

      return framesRendered; 
    });
  }

  return {
    setOnTrackEnd(callback) { onTrackEndCallback = callback; },

    async loadTrack(musicArrayBuffer, filename, bnkArrayBuffer = null) {
      await initContext();
      const type = detectEngineType(filename);
      await ensureEngineReady(type);
      this.unload();

      currentEngineType = type;
      const u8Array = new Uint8Array(musicArrayBuffer);
      const fileSize = u8Array.length;

      if (type === 'libopenmpt') {
        wasmInputBufferPtr = openmptModuleInstance._malloc(fileSize);
        openmptModuleInstance.HEAPU8.set(u8Array, wasmInputBufferPtr);
        
        loadedModulePtr = openmptModuleInstance._openmpt_module_create_from_memory(wasmInputBufferPtr, fileSize, 0, 0, 0);
        if (!loadedModulePtr) throw new Error("OpenMPT 적재 실패");

        durationSeconds = openmptModuleInstance._openmpt_module_get_duration_seconds(loadedModulePtr);
      } 
      else if (type === 'adplug') {
        const result = adplugModuleInstance._emu_init(SAMPLE_RATE);
        if (result !== 0) {
          throw new Error(`AdPlug 에뮬레이터 초기화 실패 (에러코드: ${result})`);
        }
        
        loadedModulePtr = 1; 

        if (bnkArrayBuffer) {
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
          throw new Error(`AdPlug 파일 디코딩 마운트 실패 (에러코드: ${loadResult})`);
        }

        durationSeconds = adplugModuleInstance._emu_get_max_position() / 1000;
        totalSamplesSent = 0;
      }

      isPlaying = true;
      triggerBufferWriteFeed();
      triggerBufferWriteFeed(); 
    },

    play() { 
      if (loadedModulePtr) {
        isPlaying = true;
        if (outputQueueNode) outputQueueNode.port.postMessage({ type: 'start' });
        triggerBufferWriteFeed();
      }
    },
    
    pause() { 
      isPlaying = false;
      if (outputQueueNode) outputQueueNode.port.postMessage({ type: 'stop' });
    },
    
    stop() {
      isPlaying = false;
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
        if (leftBufferPtr) { openmptModuleInstance._free(leftBufferPtr); leftBufferPtr = null; }
        if (rightBufferPtr) { openmptModuleInstance._free(rightBufferPtr); rightBufferPtr = null; }
      } else if (currentEngineType === 'adplug' && adplugModuleInstance) {
        if (loadedModulePtr) adplugModuleInstance._emu_teardown();
        if (wasmInputBufferPtr) adplugModuleInstance._free(wasmInputBufferPtr);
      }
      loadedModulePtr = null; wasmInputBufferPtr = 0; durationSeconds = 0; currentEngineType = null;
    },

    setMasterVolume(vol) {
      if (gainNode) gainNode.gain.value = vol / 100;
    },
    
    setLoopEnabled(enabled) { 
      loopEnabled = enabled; 
      if (currentEngineType === 'adplug' && adplugModuleInstance) {
        adplugModuleInstance._emu_set_loop_enabled(enabled ? 1 : 0);
      }
    },
    
    getAnalyserNode() { return analyserNode; },

    getPlaybackState() {
      if (!loadedModulePtr) return null;
      let currentTimeMs = 0;
      if (currentEngineType === 'libopenmpt') {
        if (!outputQueueNode) return null;
        currentTimeMs = adplugModuleInstance ? (totalSamplesSent / SAMPLE_RATE) * 1000 : 0; 
      } else if (currentEngineType === 'adplug') {
        currentTimeMs = adplugModuleInstance._emu_get_current_position();
      }
      return { isPlaying: isPlaying, currentPositionMs: currentTimeMs, totalDurationMs: durationSeconds * 1000 };
    }
  };
})();
