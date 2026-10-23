/**
 * player.js - Part 1: 전역 변수 설정 및 종합 Chiptune 샘플 미디어 라이브러리 목록 선언
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // home.tsx 명세와 부합하는 전체 내장 샘플 미디어 라이브러리 데이터 아카이브
  let currentPlaylist = [
    { filename: "100MEET.IMS", url: "./100MEET.IMS", format: "IMS", title: "100MEET" },
    { filename: "JAM-FIVE.IMS", url: "./JAM-FIVE.IMS", format: "IMS", title: "JAM-FIVE" },
    { filename: "JAM-NADI.IMS", url: "./JAM-NADI.IMS", format: "IMS", title: "JAM-NADI" },
    { filename: "MYSTERY-.IMS", url: "./MYSTERY-.IMS", format: "IMS", title: "MYSTERY-" },
    { filename: "SHC.IMS", url: "./SHC.IMS", format: "IMS", title: "SHC" },
    { filename: "COCKTAIL.IMS", url: "./COCKTAIL.IMS", format: "IMS", title: "COCKTAIL" },
    { filename: "SIM-FEEL.IMS", url: "./SIM-FEEL.IMS", format: "IMS", title: "SIM-FEEL" },
    { filename: "VV.ROL", url: "./VV.ROL", format: "ROL", title: "VV" },
    { filename: "4JSTAMNT.ROL", url: "./4JSTAMNT.ROL", format: "ROL", title: "4JSTAMNT" },
    { filename: "Feena.vgm", url: "./Feena.vgm", format: "VGM", title: "Feena (Ys I)" },
    { filename: "Final Battle.vgm", url: "./Final Battle.vgm", format: "VGM", title: "Final Battle" },
    { filename: "skyrider.s3m", url: "./skyrider.s3m", format: "S3M", title: "Skyrider" },
    { filename: "space_debris.mod", url: "./space_debris.mod", format: "MOD", title: "Space Debris" },
    { filename: "unreeeal_superhero_3.xm", url: "./unreeeal_superhero_3.xm", format: "XM", title: "Unreal Superhero 3" }
  ];

  let playingIndex = 0;
  let selectedIndex = 0;
  let repeatMode = 'all'; 
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
   * player.js - Part 2: 16채널 하드웨어 가속 LED 캔버스 구조화 및 정밀 고정 소형 해상도 추적
   */
  const BAR_COUNT = 16;
  const SEGMENT_COUNT = 40;
  const PEAK_HOLD_FRAMES = 15;
  const PEAK_FALL_ACCELERATION = 0.3;
  const VALUE_FALL_SPEED = 4;

  const barData = Array.from({ length: BAR_COUNT }, () => ({
    value: 0, peak: 0, peakHoldTime: 0, peakFallSpeed: 0
  }));

  const colors = {
    inactive: "#1a1a26", low: "#00a800", mid: "#a8a800", high: "#a80000", peak: "#54ffff", barBg: "#000000"
  };

  const spectrumContainer = document.getElementById("spectrumContainer");
  const canvasElements = [];
  const canvasContexts = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "spectrum-bar-segment-wrapper";
    const canv = document.createElement("canvas");
    canv.style.width = "100%"; canv.style.height = "100%";
    wrapper.appendChild(canv);
    spectrumContainer.appendChild(wrapper);
    canvasElements.push(canv);
  }

  function resizeSpectrumCanvases() {
    const dpr = window.devicePixelRatio || 1;
    canvasContexts.length = 0;
    canvasElements.forEach((canv) => {
      const parent = canv.parentElement; if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canv.width = rect.width * dpr; canv.height = (rect.height || 112) * dpr;
      const ctx = canv.getContext("2d");
      if (ctx) { ctx.scale(dpr, dpr); canvasContexts.push({ ctx, width: rect.width, height: rect.height || 112 }); }
    });
  }

  const mockLyrics = [
    "DOS CHIPTUNE PLAYER SYSTEM ONLINE",
    "WASM WebAudio 하드웨어 가속 합성 엔진 탑재",
    "실시간 스펙트럼 애널라이저 분석 루프 구동 성공",
    "도스박물관 뮤직 아카이브 보전 프로젝트"
  ];

  function renderPlaylist() {
    trackListContainer.innerHTML = "";
    const totalHeight = currentPlaylist.length * ITEM_HEIGHT;
    trackListContainer.style.height = `${totalHeight}px`;

    currentPlaylist.forEach((track, idx) => {
      const div = document.createElement("div");
      div.className = `dos-list-item ${idx === selectedIndex ? 'dos-list-item-selected' : ''}`;
      div.style.height = `${ITEM_HEIGHT}px`;
      const badge = `<span class="dos-badge">${track.format}</span>`;
      const titleSpan = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${track.title}</span>`;
      div.innerHTML = `${badge}${titleSpan}`;
      div.addEventListener("click", () => { selectedIndex = idx; renderPlaylist(); });
      div.addEventListener("dblclick", () => { selectedIndex = idx; playingIndex = idx; loadAndPlayTrack(); });
      trackListContainer.appendChild(div);
    });
  }
  /**
   * player.js - Part 3: 30fps 고정 비주얼라이저 분석기 및 하드웨어 가속 오디오 실시간 피더 링크
   */
  function renderSingleBar(barIndex) {
    const target = canvasContexts[barIndex];
    if (!target || !target.ctx || target.width === 0 || target.height === 0) return;
    const { ctx, width, height } = target;
    const segmentGap = 1;
    const segmentHeight = (height - segmentGap * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;
    const bar = barData[barIndex];

    ctx.fillStyle = colors.barBg; ctx.fillRect(0, 0, width, height);
    const peakSegIndex = Math.min(Math.floor((bar.peak * SEGMENT_COUNT) / 100), SEGMENT_COUNT - 1);

    for (let segIndex = 0; segIndex < SEGMENT_COUNT; segIndex++) {
      const threshold = ((segIndex + 1) / SEGMENT_COUNT) * 100;
      const isActive = bar.value >= threshold;
      const isPeak = segIndex === peakSegIndex;
      let color = colors.inactive;
      if (isPeak && bar.peak > 0) color = colors.peak;
      else if (isActive) {
        const ratio = segIndex / SEGMENT_COUNT;
        if (ratio >= 2 / 3) color = colors.high;
        else if (ratio >= 1 / 3) color = colors.mid;
        else color = colors.low;
      }
      const segY = (SEGMENT_COUNT - 1 - segIndex) * (segmentHeight + segmentGap);
      ctx.fillStyle = color; ctx.fillRect(0, segY, width, segmentHeight);
    }
  }

  function renderSpectrumLEDs() {
    for (let i = 0; i < BAR_COUNT; i++) renderSingleBar(i);
  }

  let lastVisualizerTime = 0;
  const targetInterval = 1000 / 30;

  function runVisualizerEngineLoop(timestamp) {
    requestAnimationFrame(runVisualizerEngineLoop);
    if (!window.TrackerAudioEngine) return;
    if (timestamp - lastVisualizerTime < targetInterval) return;
    lastVisualizerTime = timestamp;

    const analyser = window.TrackerAudioEngine.getAnalyserNode();
    if (!analyser) {
      for (let i = 0; i < BAR_COUNT; i++) {
        const prev = barData[i];
        let value = Math.max(0, prev.value - VALUE_FALL_SPEED);
        let peak = prev.peak; let peakHoldTime = prev.peakHoldTime; let peakFallSpeed = prev.peakFallSpeed;
        if (peakHoldTime > 0) peakHoldTime--;
        else { peakFallSpeed += PEAK_FALL_ACCELERATION; peak = Math.max(0, peak - peakFallSpeed); }
        barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
      }
      renderSpectrumLEDs(); return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    const skipBins = 2; const usableBins = bufferLength - skipBins; const binsPerBar = Math.floor(usableBins / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const startBin = skipBins + i * binsPerBar;
      const endBin = Math.min(startBin + binsPerBar, bufferLength);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) sum += dataArray[j];
      const avg = sum / (endBin - startBin);
      const rawValue = Math.round((avg / 255) * 100);
      const prev = barData[i];

      let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - VALUE_FALL_SPEED);
      let peak = prev.peak; let peakHoldTime = prev.peakHoldTime; let peakFallSpeed = prev.peakFallSpeed;

      if (value >= peak) { peak = value; peakHoldTime = PEAK_HOLD_FRAMES; peakFallSpeed = 0; }
      else if (peakHoldTime > 0) { peakHoldTime--; }
      else { peakFallSpeed += PEAK_FALL_ACCELERATION; peak = Math.max(0, peak - peakFallSpeed); }
      barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
    }
    renderSpectrumLEDs();
  }

  function triggerBufferWriteFeed() {
    const audioEngine = window.TrackerAudioEngine;
    if (!audioEngine || !audioEngine.getPlaybackState) return;
    const state = audioEngine.getPlaybackState();
    if (!state || !state.isPlaying) return;

    const currentEngineType = window.TrackerAudioEngine.currentEngineType || 'adplug'; 
    const openmptModuleInstance = window.TrackerAudioEngine.openmptModuleInstance;
    const adplugModuleInstance = window.TrackerAudioEngine.adplugModuleInstance;
    const loadedModulePtr = window.TrackerAudioEngine.loadedModulePtr;
    const queueWriter = window.TrackerAudioEngine.queueWriter;
    const SAMPLE_RATE = window.TrackerAudioEngine.SAMPLE_RATE || 44100;

    if (!loadedModulePtr || !queueWriter) return;

    queueWriter.write((segment) => {
      let framesRendered = segment.frameCount;
      let trackFinished = false;

      if (currentEngineType === 'libopenmpt' && openmptModuleInstance) {
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
          loadedModulePtr, SAMPLE_RATE, framesRendered, leftBufferPtr, rightBufferPtr
        );

        if (count <= 0) { trackFinished = true; framesRendered = 0; } 
        else {
          framesRendered = count;
          const wasmLeft = new Float32Array(openmptModuleInstance.HEAPF32.buffer, leftBufferPtr, framesRendered);
          const wasmRight = new Float32Array(openmptModuleInstance.HEAPF32.buffer, rightBufferPtr, framesRendered);
          for (let i = 0; i < framesRendered; i++) { segment.set(i, 0, wasmLeft[i]); segment.set(i, 1, wasmRight[i]); }
        }
      } 
      else if (currentEngineType === 'adplug' && adplugModuleInstance) {
        const scale = 1 / 32768.0;
        const finished = adplugModuleInstance._emu_compute_audio_samples() !== 0;
        if (finished) trackFinished = true;

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
        window.TrackerAudioEngine.totalSamplesSent = (window.TrackerAudioEngine.totalSamplesSent || 0) + renderCount;

        // [0xF0 런타임 가변 템포 피드백 인터페이스 결합 완수]
        // 오디 코어가 악보 데이터를 해독하며 유동적으로 가변시킨 진짜 실시간 BPM 값을 
        // 하드웨어 가속 스레드(AudioWorklet) 포트로 즉각 실시간 무선 포스트 메시지 전송합니다!
        if (adplugModuleInstance && typeof adplugModuleInstance._emu_get_current_tempo === 'function') {
          const liveTempo = adplugModuleInstance._emu_get_current_tempo();
          if (liveTempo > 0 && queueWriter && queueWriter.node) {
            queueWriter.node.port.postMessage({ type: 'runtime_tempo_update', currentTempo: liveTempo });
          }
        }
      }

      if (trackFinished) {
        if (window.TrackerAudioEngine.loopEnabled) {
          if (currentEngineType === 'libopenmpt') openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0);
          else if (currentEngineType === 'adplug') adplugModuleInstance._emu_rewind();
          window.TrackerAudioEngine.totalSamplesSent = 0;
        } else {
          window.TrackerAudioEngine.pause();
          const cb = window.TrackerAudioEngine.onTrackEndCallback;
          if (cb) setTimeout(() => cb(), 0);
        }
      }
      return framesRendered; 
    });
  }
  window.triggerBufferWriteFeedGlobal = triggerBufferWriteFeed;
  /**
   * player.js - Part 4: 기존 substring 문자열 자르기 원상복구 및 가사 흔들림 완전 정비 싱크 루프
   * 출력 위치 오류를 완벽히 치료하고 단단하게 고정된 복고풍 전광판 텍스트 레이아웃을 구축했습니다.
   */
  function runStateSyncLoop() {
    clearInterval(stateUpdateInterval);
    stateUpdateInterval = setInterval(() => {
      const audioEngine = window.TrackerAudioEngine;
      const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
      
      if (!audioState || !audioState.isPlaying || !currentIssData) {
        const tempoElement = document.getElementById("tempoDisplayValue");
        if (tempoElement) tempoElement.innerText = "---";

        lyricsDisplay.innerHTML = `
          <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; width:100%;">
            <div style="margin-bottom: 4px; color: var(--color-white); font-size:14px;">(C) 2025 QuickBASIC (gcjjyy@gmail.com)</div>
            <div style="margin-bottom: 2px; color: var(--color-gray); font-size:12px;">도움 주신 분들 : 하늘소, 피시키드, 키노피오, Ospaggi</div>
            <div style="margin-top: 4px;"><a href="https://naver.com" target="_blank" rel="noopener noreferrer" class="dos-link-credits">도스박물관 - 고전의 감성을 아카이빙하는 곳</a></div>
          </div>`;
        if (audioState) {
          const progressPercent = (audioState.currentPositionMs / audioState.totalDurationMs) * 100 || 0;
          progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
          progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(audioState.totalDurationMs)}`;
        }
        return;
      }

      const progressPercent = (audioState.currentPositionMs / audioState.totalDurationMs) * 100 || 0;
      progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
      progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(audioState.totalDurationMs)}`;

      const liveBpm = (audioEngine && audioEngine.currentRuntimeTempo) ? Math.round(audioEngine.currentRuntimeTempo) : 120;
      const tempoElement = document.getElementById("tempoDisplayValue");
      if (tempoElement) tempoElement.innerText = String(liveBpm).padStart(3, '0');

      const currentHardwareTick = (audioEngine && audioEngine.currentHardwareAbsoluteTick !== undefined) 
        ? audioEngine.currentHardwareAbsoluteTick 
        : 0;
      
      const adjustedTick = currentHardwareTick / 8; 

      let left = 0; let right = currentIssData.records.length - 1; let resultIndex = -1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (currentIssData.records[mid].kasaTick <= adjustedTick) { 
          resultIndex = mid; left = mid + 1; 
        } else { 
          right = mid - 1; 
        }
      }

      if (resultIndex >= 0) {
        const currentRecord = currentIssData.records[resultIndex];
        
        // [원상복구 및 공백 완전 진압] 도스 패딩 공백찌꺼기를 완벽히 거두어내고 순수 알맹이 본문만 스캔합니다.
        const rawLine = currentIssData.scripts[currentRecord.line] || "";
        const currentLine = rawLine.trimEnd(); 

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

        // 안정적인 기존의 자바스크립트 가위질(substring) 분할 수식으로 완전 원상복구
        let bytePos = 0; let charPos = 0;
        const startX = currentRecord.startX; const widthX = currentRecord.widthX;

        while (bytePos < startX && charPos < currentLine.length) {
          bytePos += (currentLine.charCodeAt(charPos) > 127) ? 2 : 1; charPos++;
        }
        
        bytePos = 0;
        while (bytePos < widthX && charPos < currentLine.length) {
          bytePos += (currentLine.charCodeAt(charPos) > 127) ? 2 : 1; charPos++;
        }
        const highlightEnd = charPos;

        // [좌우 흔들림 치료 핵심] 
        // 1. 기존의 가장 또렷하게 가사가 잘 나오던 substring 출력 구조를 100% 복원했습니다.
        // 2. 글자 마진 차이로 전체 줄이 파닥거리던 현상은 컨테이너 전체에 고정 문자폭 속성(font-family: monospace)을 
        //    강제 주입하고 tabular 자릿수를 정렬하여 텍스트 분할 배치 시 좌우 정렬선이 요동치는 버그를 철저히 박멸했습니다.
        lyricsDisplay.innerHTML = `
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%; font-family: monospace; letter-spacing: 0.2px;">
            <!-- 활성화 가사 줄 (정위치 고정폭 정렬형 복원) -->
            <div class="karaoke-text-line" style="font-size: 16px; font-weight: 500; white-space: pre; text-align: center; font-family: monospace;">
              <span style="color: var(--lyrics-highlight); font-weight: bold;">${currentLine.substring(0, highlightEnd)}</span>
              <span style="color: var(--lyrics-normal);">${currentLine.substring(highlightEnd)}</span>
            </div>
            
            <!-- 다음 가사 예고 줄 -->
            <div style="font-size: 13px; color: var(--lyrics-normal); opacity: 0.4; min-height: 18px; margin-top: 6px; font-family: monospace; white-space: pre; text-align: center;">${nextLine}</div>
          </div>`;
      }
    }, 80); 
  }


  /**
   * player.js - Part 5: getMatchingLyricUrl 문자열 기반 가사 fetch 및 로컬 파일 드롭존 스캔 디코더
   */
  async function loadAndPlayTrack() {
    const track = currentPlaylist[playingIndex]; if (!track) return;
    const audioEngine = window.TrackerAudioEngine;
    if (!audioEngine) { setTimeout(loadAndPlayTrack, 300); return; }

    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.remove("hidden");
    statusBarText.innerText = `로딩 중... - ${track.title}`;
    
    try {
      let musicArrayBuffer; let bnkArrayBuffer = null; currentIssData = null;

      if (track.fileObject) musicArrayBuffer = await track.fileObject.arrayBuffer();
      else {
        const response = await fetch(track.url); if(!response.ok) throw new Error("음원 자원 호출 실패");
        musicArrayBuffer = await response.arrayBuffer();
      }

      const ext = track.filename.toLowerCase().substring(track.filename.lastIndexOf('.'));
      if (['.ims', '.rol'].includes(ext)) {
        try {
          const bnkCheck = await fetch('./STANDARD.BNK', { method: 'HEAD' });
          if (bnkCheck.ok) {
            const bnkResponse = await fetch('./STANDARD.BNK');
            if (bnkResponse.ok) bnkArrayBuffer = await bnkResponse.arrayBuffer();
          }
        } catch (e) { console.warn(e); }

        if (track.issFileObject) {
          console.log("%c[가사 분석 개시] %c로컬 자막 데이터를 해독합니다.", "color: #54ff54; font-weight: bold;", "color: default;");
          const issBuf = await track.issFileObject.arrayBuffer();
          if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
        } else if (!track.fileObject) {
          // getMatchingLyricUrl 문자열 기반 마침표 기준 슬라이싱 연산 완수
          const lastDotIdx = track.url.lastIndexOf(".");
          const serverIssUrl = (lastDotIdx === -1) ? track.url + ".ISS" : track.url.substring(0, lastDotIdx) + ".ISS";
          try {
            const issCheck = await fetch(serverIssUrl, { method: 'HEAD' });
            if (issCheck.ok) {
              const issResponse = await fetch(serverIssUrl);
              const issBuf = await issResponse.arrayBuffer();
              if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
            }
          } catch (e) { console.warn("서버 정적 가사 파일 없음:", serverIssUrl); }
        }
      }

      audioEngine.setOnTrackEnd(() => {
        if (repeatMode === 'one') { loadAndPlayTrack(); } 
        else if (repeatMode === 'shuffle') {
          const rand = Math.floor(Math.random() * currentPlaylist.length);
          playingIndex = rand; selectedIndex = rand; loadAndPlayTrack();
        } else {
          if (playingIndex < currentPlaylist.length - 1) {
            playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack();
          } else {
            audioEngine.stop(); btnPlay.innerHTML = `<i data-lucide="play"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }
        }
      });

      await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer);
      audioEngine.play();
      btnPlay.innerHTML = `<svg xmlns="http://w3.org" viewBox="0 0 24 24" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
  <rect x="6" y="4" width="4" height="16" rx="1"></rect>
  <rect x="14" y="4" width="4" height="16" rx="1"></rect>
</svg><i data-lucide="pause"></i>`;
      btnStop.removeAttribute("disabled"); btnPrev.removeAttribute("disabled"); btnNext.removeAttribute("disabled");
      statusBarText.innerText = (currentIssData && currentIssData.singer) ? `재생중 - [가수: ${currentIssData.singer}] ${track.title}` : `재생중 - ${track.title}`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      
      const scrollParent = trackListContainer.parentElement;
      if (scrollParent) scrollParent.scrollTop = (playingIndex * ITEM_HEIGHT) - (scrollParent.clientHeight / 2) + (ITEM_HEIGHT / 2);

      runStateSyncLoop(); renderPlaylist();
    } catch (err) { console.error(err); statusBarText.innerText = `적재 실패: ${track.title}`; }
    finally { if (overlay) overlay.classList.add("hidden"); }
  }

  function setRepeatMode(mode, targetBtn) {
    repeatMode = mode; [repeatAll, repeatOne, repeatShuffle].forEach(b => b.classList.remove("dos-button-active"));
    targetBtn.classList.add("dos-button-active");
    if (window.TrackerAudioEngine) window.TrackerAudioEngine.setLoopEnabled(mode === 'one');
  }

  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.backgroundColor = "var(--bg-select)"; });
  dropZone.addEventListener("dragleave", () => { dropZone.style.backgroundColor = "var(--bg-main)"; });
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault(); dropZone.style.backgroundColor = "var(--bg-main)";
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const allowedFiles = files.filter(f => /\.(mod|xm|s3m|it|ims|rol|vgm)\$/i.test(f.name));
      const issFiles = files.filter(f => /\.iss\$/i.test(f.name));
      const issMap = new Map(issFiles.map(f => [f.name.toLowerCase().replace(/\.iss\$/, ''), f]));

      if (allowedFiles.length > 0) {
        statusBarText.innerText = "로컬 바이너리 및 가사 정보 정밀 도킹 매핑 중..."; const scannedTracks = [];
        for (const file of allowedFiles) {
          const ext = file.name.split('.').pop().toUpperCase(); const baseName = file.name.replace(/\.[^.]+\$/, '').toLowerCase();
          let parsedTitle = file.name.replace(/\.[^.]+\$/, '');
          let bTempo = 120; let tBeat = 24;
          try {
            const buf = await file.arrayBuffer();
            if (window.ChipTuneTitleParser) {
              parsedTitle = window.ChipTuneTitleParser.extractTitle(buf, file.name);
              const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf);
              if (imsInfo) { bTempo = imsInfo.basicTempo; tBeat = imsInfo.tickBeat; }
            }
          } catch (err) { console.warn(err); }
          const matchedIssFile = issMap.get(baseName);
          scannedTracks.push({ filename: file.name, format: ext, title: parsedTitle, fileObject: file, issFileObject: matchedIssFile || null, basicTempo: bTempo, tickBeat: tBeat });
        }
        currentPlaylist = scannedTracks; folderLabel.innerText = "사용자 트랙 보관함 로드 완료";
        document.getElementById("listTitle").innerText = "📁 로컬 미디어 보관함";
        selectedIndex = 0; playingIndex = 0; renderPlaylist(); statusBarText.innerText = "대기";
      }
    }
  });
  /**
   * player.js - Part 6: 미디어 제어판 조작 장치, 메모리형 음소거 마감 인터페이스 및 자동 메타 스캔 최종 구동부
   */
  btnPlay.addEventListener("click", () => {
    if (currentPlaylist.length === 0) return;
    const audioEngine = window.TrackerAudioEngine;
    const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
    if (audioState && audioState.isPlaying) { 
      if (audioEngine.queueWriter && audioEngine.queueWriter.node) {
        audioEngine.queueWriter.node.port.postMessage({ type: 'stop' });
      }
      audioEngine.pause(); btnPlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play" aria-hidden="true" data-darkreader-inline-stroke="" style="--darkreader-inline-stroke: currentColor;"><rect x="1" y="4" width="4" height="16" rx="1"></rect><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg><i data-lucide="play"></i>`; 
    }
    else {
      if (audioState && audioState.currentPositionMs > 0) { 
        if (audioEngine.queueWriter && audioEngine.queueWriter.node) {
          audioEngine.queueWriter.node.port.postMessage({ type: 'start' });
        }
        audioEngine.play(); btnPlay.innerHTML = `<svg xmlns="http://w3.org" viewBox="0 0 24 24" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
  <rect x="6" y="4" width="4" height="16" rx="1"></rect>
  <rect x="14" y="4" width="4" height="16" rx="1"></rect>
</svg><i data-lucide="pause"></i>`; 
        if (typeof window.triggerBufferWriteFeedGlobal === 'function') {
          window.triggerBufferWriteFeedGlobal(); window.triggerBufferWriteFeedGlobal();
        }
      }
      else loadAndPlayTrack();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnStop.addEventListener("click", () => {
    if (window.TrackerAudioEngine) {
      window.TrackerAudioEngine.stop();
      // [일시정지 초기화 해결 핵심 2]
      // 정지(Stop) 버튼을 명시적으로 눌렀을 때만 하드웨어 프로세서 포트로 'hard_reset' 신호를 보내 
      // 시계 축을 0으로 완벽히 리셋 배정합니다. 이로써 일시정지(Pause) 시 자막이 튕기던 원인이 완전히 청소됩니다.
      if (window.TrackerAudioEngine.queueWriter && window.TrackerAudioEngine.queueWriter.node) {
        window.TrackerAudioEngine.queueWriter.node.port.postMessage({ type: 'hard_reset' });
      }
    }
    btnPlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play" aria-hidden="true" data-darkreader-inline-stroke="" style="--darkreader-inline-stroke: currentColor;"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg><i data-lucide="play"></i>`; progressFill.style.width = `0%`; progressText.innerText = `--:-- / --:--`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnNext.addEventListener("click", () => { if (playingIndex < currentPlaylist.length - 1) { playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack(); } });
  btnPrev.addEventListener("click", () => { if (playingIndex > 0) { playingIndex--; selectedIndex = playingIndex; loadAndPlayTrack(); } });

  // [음소거 및 메모리형 슬라이더 연동 제어 마감]
  volumeSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10); sliderLabel.innerText = `볼륨`; document.getElementById("sliderValue").innerText = `${val}%`;
    if (val > 0) { isMuted = false; btnMute.classList.remove("muted-active"); btnMute.innerText = "🔊"; lastVolume = val; } 
    else { isMuted = true; btnMute.classList.add("muted-active"); btnMute.innerText = "🔇"; }
    if (window.TrackerAudioEngine) window.TrackerAudioEngine.setMasterVolume(val);
  });

  btnMute.addEventListener("click", () => {
    const audioEngine = window.TrackerAudioEngine; isMuted = !isMuted;
    if (isMuted) {
      lastVolume = parseInt(volumeSlider.value, 10) || 70; volumeSlider.value = 0; document.getElementById("sliderValue").innerText = `0%`;
      btnMute.classList.add("muted-active"); btnMute.innerText = "🔇";
      if (audioEngine) audioEngine.setMasterVolume(0);
    } else {
      const targetVol = lastVolume > 0 ? lastVolume : 50; volumeSlider.value = targetVol; document.getElementById("sliderValue").innerText = `${targetVol}%`;
      btnMute.classList.remove("muted-active"); btnMute.innerText = "🔊";
      if (audioEngine) audioEngine.setMasterVolume(targetVol);
    }
  });

  helpBtn.addEventListener("click", () => { formatDialog.classList.remove("hidden"); formatDialogBackdrop.classList.remove("hidden"); });
  const closeDialog = () => { formatDialog.classList.add("hidden"); formatDialogBackdrop.classList.add("hidden"); };
  closeDialogBtn.addEventListener("click", closeDialog); formatDialogBackdrop.addEventListener("click", closeDialog);

  window.addEventListener("resize", () => { resizeSpectrumCanvases(); renderSpectrumLEDs(); });
  repeatAll.addEventListener("click", () => setRepeatMode('all', repeatAll)); repeatOne.addEventListener("click", () => setRepeatMode('one', repeatOne)); repeatShuffle.addEventListener("click", () => setRepeatMode('shuffle', repeatShuffle));

  function formatTime(ms) { const totalSeconds = Math.floor(ms / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes}:${seconds.toString().padStart(2, '0')}`; }

  async function autoScanDefaultPlaylistMetadata() {
    if (!window.ChipTuneTitleParser) return;
    statusBarText.innerText = "서버 내장 샘플 음원 메타데이터 동기화 중...";
    for (let track of currentPlaylist) {
      try {
        const check = await fetch(track.url, { method: 'HEAD' });
        if (check.ok) {
          const res = await fetch(track.url); const buf = await res.arrayBuffer();
          track.title = window.ChipTuneTitleParser.extractTitle(buf, track.filename);
          const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf);
          if (imsInfo) { track.basicTempo = imsInfo.basicTempo; track.tickBeat = imsInfo.tickBeat; }
        }
      } catch (e) { console.warn(e); }
    }
    statusBarText.innerText = "대기"; renderPlaylist();
  }

  renderPlaylist(); resizeSpectrumCanvases(); requestAnimationFrame(runVisualizerEngineLoop); autoScanDefaultPlaylistMetadata();
});
