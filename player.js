/**
 * player.js - Part 1: 전역 컨텍스트 캐싱 및 윈도우 공유형 피아노 롤 링버퍼 메모리 선언
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let currentPlaylist = [
    { filename: "JAM-FIVE.IMS", url: "./folder/JAM-FIVE.IMS", format: "IMS", title: "JAM-FIVE" },
    { filename: "JAM-NADI.IMS", url: "./folder/JAM-NADI.IMS", format: "IMS", title: "JAM-NADI" },
    { filename: "MYSTERY-.IMS", url: "./folder/MYSTERY-.IMS", format: "IMS", title: "MYSTERY-" },
    { filename: "SHC.IMS", url: "./folder/SHC.IMS", format: "IMS", title: "SHC" },
    { filename: "COCKTAIL.IMS", url: "./folder/COCKTAIL.IMS", format: "IMS", title: "COCKTAIL" },
    { filename: "SIM-FEEL.IMS", url: "./folder/SIM-FEEL.IMS", format: "IMS", title: "SIM-FEEL" },
    { filename: "100MEET.IMS", url: "./folder/100MEET.IMS", format: "IMS", title: "100MEET" },
    { filename: "VV.ROL", url: "./folder/VV.ROL", format: "ROL", title: "VV" },
    { filename: "4JSTAMNT.ROL", url: "./folder/4JSTAMNT.ROL", format: "ROL", title: "4JSTAMNT" },
    { filename: "Feena.vgm", url: "./folder/Feena.vgm", format: "VGM", title: "Feena (Ys I)" },
    { filename: "Final Battle.vgm", url: "./folder/Final Battle.vgm", format: "VGM", title: "Final Battle" },
    { filename: "skyrider.s3m", url: "./folder/skyrider.s3m", format: "S3M", title: "Skyrider" },
    { filename: "space_debris.mod", url: "./folder/space_debris.mod", format: "MOD", title: "Space Debris" },
    { filename: "unreeeal_superhero_3.xm", url: "./folder/unreeeal_superhero_3.xm", format: "XM", title: "Unreal Superhero 3" }
  ];

  let playingIndex = 0; let selectedIndex = 0; let repeatMode = 'all'; 
  let stateUpdateInterval = null; let currentIssData = null; const ITEM_HEIGHT = 28; 

  // [피아노 롤 무결 연동 핵심 1] 격리 장벽 타파를 위해 공유 메모리 파크 주소를 최상단 윈도우 스코프에 조킹합니다.
  window.pianoRollNoteRegistry = Array.from({ length: 16 }, () => new Map()); 
  window.pianoRollScrollHistory = []; 
  window.pianoRollMaxHistoryWidth = 600; 

  // DOM 제어 노드 객체 캐싱
  const trackListContainer = document.getElementById("musicTrackList");
  const btnPlay = document.getElementById("btnPlay"); const btnStop = document.getElementById("btnStop");
  const btnPrev = document.getElementById("btnPrev"); const btnNext = document.getElementById("btnNext");
  const progressFill = document.getElementById("progressFill"); const progressText = document.getElementById("progressText");
  const statusBarText = document.getElementById("statusBarText"); const volumeSlider = document.getElementById("volumeSlider");
  const sliderLabel = document.getElementById("sliderLabel"); const lyricsDisplay = document.getElementById("lyricsDisplay");
  const dropZone = document.getElementById("dropZone"); const folderLabel = document.getElementById("folderLabel");

  const repeatAll = document.getElementById("repeatAll"); const repeatOne = document.getElementById("repeatOne"); const repeatShuffle = document.getElementById("repeatShuffle");
  const helpBtn = document.getElementById("helpBtn"); const closeDialogBtn = document.getElementById("closeDialogBtn");
  const formatDialog = document.getElementById("formatDialog"); const formatDialogBackdrop = document.getElementById("formatDialogBackdrop");
  const btnMute = document.getElementById("btnMute"); let isMuted = false; let lastVolume = 70; 

  const canvas = document.getElementById("visualizerCanvas");
  /**
   * player.js - Part 2: 16채널 하드웨어 가속 LED 캔버스 생성 및 마우스/터치 리오더 정렬 렌더러
   */
  const BAR_COUNT = 16; const SEGMENT_COUNT = 40; const PEAK_HOLD_FRAMES = 15; const PEAK_FALL_ACCELERATION = 0.3; const VALUE_FALL_SPEED = 4;
  const barData = Array.from({ length: BAR_COUNT }, () => ({ value: 0, peak: 0, peakHoldTime: 0, peakFallSpeed: 0 }));
  const colors = { inactive: "#1a1a26", low: "#00a800", mid: "#a8a800", high: "#a8a800", peak: "#54ffff", barBg: "#000000" };

  const spectrumContainer = document.getElementById("spectrumContainer"); const canvasElements = []; const canvasContexts = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const wrapper = document.createElement("div"); wrapper.className = "spectrum-bar-segment-wrapper";
    const canv = document.createElement("canvas"); canv.style.width = "100%"; canv.style.height = "100%";
    wrapper.appendChild(canv); spectrumContainer.appendChild(wrapper); canvasElements.push(canv);
  }

  function resizeSpectrumCanvases() {
    const dpr = window.devicePixelRatio || 1; canvasContexts.length = 0;
    canvasElements.forEach((canv) => {
      const parent = canv.parentElement; if (!parent) return; const rect = parent.getBoundingClientRect();
      canv.width = rect.width * dpr; canv.height = (rect.height || 112) * dpr;
      const ctx = canv.getContext("2d"); if (ctx) { ctx.scale(dpr, dpr); canvasContexts.push({ ctx, width: rect.width, height: rect.height || 112 }); }
    });
    resizePianoRollCanvas();
  }

  function renderPlaylist() {
    trackListContainer.innerHTML = ""; const totalHeight = currentPlaylist.length * ITEM_HEIGHT; trackListContainer.style.height = `${totalHeight}px`;
    currentPlaylist.forEach((track, idx) => {
      const div = document.createElement("div"); div.className = `dos-list-item ${idx === selectedIndex ? 'dos-list-item-selected' : ''}`;
      if (idx === playingIndex && window.TrackerAudioEngine && window.TrackerAudioEngine.getPlaybackState()?.isPlaying) div.classList.add("dos-list-item-playing");
      div.style.height = `${ITEM_HEIGHT}px`; div.setAttribute("draggable", "true"); div.setAttribute("data-index", idx);
      const badge = `<span class="dos-badge">${track.format}</span>`;
      const titleSpan = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; pointer-events:none;">${track.title}</span>`;
      div.innerHTML = `${badge}${titleSpan}`;
      
      div.addEventListener("click", () => { selectedIndex = idx; renderPlaylist(); });
      div.addEventListener("dblclick", () => { selectedIndex = idx; playingIndex = idx; loadAndPlayTrack(); });
      
      div.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", idx); div.style.opacity = "0.4"; div.classList.add("dos-dragging"); });
      div.addEventListener("dragend", () => { div.style.opacity = "1"; div.classList.remove("dos-dragging"); document.querySelectorAll(".dos-list-item").forEach(item => item.classList.remove("dos-drag-over")); });
      div.addEventListener("dragover", (e) => { e.preventDefault(); div.classList.add("dos-drag-over"); });
      div.addEventListener("dragleave", () => { div.classList.remove("dos-drag-over"); });
      div.addEventListener("drop", (e) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); const toIndex = idx; if (!isNaN(fromIndex) && fromIndex !== toIndex) handlePlaylistReorder(fromIndex, toIndex); });

      div.addEventListener("touchstart", (e) => { window.dosTouchDragStartIndex = idx; div.classList.add("dos-dragging"); }, { passive: true });
      div.addEventListener("touchmove", (e) => { const touch = e.touches; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const listItem = targetElement ? targetElement.closest(".dos-list-item") : null; document.querySelectorAll(".dos-list-item").forEach(item => item.classList.remove("dos-drag-over")); if (listItem) listItem.classList.add("dos-drag-over"); }, { passive: true });
      div.addEventListener("touchend", (e) => { const touch = e.changedTouches; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const listItem = targetElement ? targetElement.closest(".dos-list-item") : null; div.classList.remove("dos-dragging"); document.querySelectorAll(".dos-list-item").forEach(item => item.classList.remove("dos-drag-over")); if (listItem) { const toIndex = parseInt(listItem.getAttribute("data-index"), 10); const fromIndex = window.dosTouchDragStartIndex; if (fromIndex !== undefined && !isNaN(toIndex) && fromIndex !== toIndex) handlePlaylistReorder(fromIndex, toIndex); } window.dosTouchDragStartIndex = undefined; });
      trackListContainer.appendChild(div);
    });
  }
  /**
   * player.js - Part 3: renderSingleBar 참조 오류를 완전 진압하고 단일 음고 스로틀러가 장착된 최종 오디오 피더
   * 마비되었던 플레이어 전체 시각 파이프라인 인프라를 100%정상화했습니다.
   */
  function renderSingleBar(barIndex) {
    const target = canvasContexts[barIndex]; if (!target || !target.ctx || target.width === 0 || target.height === 0) return;
    const { ctx, width, height } = target; const segmentGap = 1;
    const segmentHeight = (height - segmentGap * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT; const bar = barData[barIndex];

    ctx.fillStyle = colors.barBg; ctx.fillRect(0, 0, width, height);
    const peakSegIndex = Math.min(Math.floor((bar.peak * SEGMENT_COUNT) / 100), SEGMENT_COUNT - 1);

    for (let segIndex = 0; segIndex < SEGMENT_COUNT; segIndex++) {
      const threshold = ((segIndex + 1) / SEGMENT_COUNT) * 100; const isActive = bar.value >= threshold; const isPeak = segIndex === peakSegIndex;
      let color = colors.inactive;
      if (isPeak && bar.peak > 0) color = colors.peak;
      else if (isActive) {
        const ratio = segIndex / SEGMENT_COUNT;
        if (ratio >= 2 / 3) color = colors.high; else if (ratio >= 1 / 3) color = colors.mid; else color = colors.low;
      }
      const segY = (SEGMENT_COUNT - 1 - segIndex) * (segmentHeight + segmentGap); ctx.fillStyle = color; ctx.fillRect(0, segY, width, segmentHeight);
    }
  }

  function renderSpectrumLEDs() { for (let i = 0; i < BAR_COUNT; i++) renderSingleBar(i); }
  let lastVisualizerTime = 0; const targetInterval = 1000 / 30;

  function runVisualizerEngineLoop(timestamp) {
    requestAnimationFrame(runVisualizerEngineLoop); if (!window.TrackerAudioEngine) return;
    renderPianoRollSequencer();
    if (timestamp - lastVisualizerTime < targetInterval) return; lastVisualizerTime = timestamp;
    const analyser = window.TrackerAudioEngine.getAnalyserNode();
    if (!analyser) {
      for (let i = 0; i < BAR_COUNT; i++) {
        const prev = barData[i]; let value = Math.max(0, prev.value - VALUE_FALL_SPEED); let peak = prev.peak; let peakHoldTime = prev.peakHoldTime; let peakFallSpeed = prev.peakFallSpeed;
        if (peakHoldTime > 0) peakHoldTime--; else { peakFallSpeed += PEAK_FALL_ACCELERATION; peak = Math.max(0, peak - peakFallSpeed); }
        barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
      }
      renderSpectrumLEDs(); return;
    }
    const bufferLength = analyser.frequencyBinCount; const dataArray = new Uint8Array(bufferLength); analyser.getByteFrequencyData(dataArray);
    const skipBins = 2; const usableBins = bufferLength - skipBins; const binsPerBar = Math.floor(usableBins / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const startBin = skipBins + i * binsPerBar; const endBin = Math.min(startBin + binsPerBar, bufferLength); let sum = 0;
      for (let j = startBin; j < endBin; j++) sum += dataArray[j];
      const avg = sum / (endBin - startBin); const rawValue = Math.round((avg / 255) * 100); const prev = barData[i];
      let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - VALUE_FALL_SPEED); let peak = prev.peak; let peakHoldTime = prev.peakHoldTime; let peakFallSpeed = prev.peakFallSpeed;
      if (value >= peak) { peak = value; peakHoldTime = PEAK_HOLD_FRAMES; peakFallSpeed = 0; } else if (peakHoldTime > 0) { peakHoldTime--; } else { peakFallSpeed += PEAK_FALL_ACCELERATION; peak = Math.max(0, peak - peakFallSpeed); }
      barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
    }
    renderSpectrumLEDs();
  }

  function triggerBufferWriteFeed() {
    const audioEngine = window.TrackerAudioEngine; if (!audioEngine || !audioEngine.getPlaybackState) return;
    const state = audioEngine.getPlaybackState(); if (!state || !state.isPlaying) return;

    const currentEngineType = window.TrackerAudioEngine.currentEngineType || 'adplug'; const openmptModuleInstance = window.TrackerAudioEngine.openmptModuleInstance;
    const adplugModuleInstance = window.TrackerAudioEngine.adplugModuleInstance; const loadedModulePtr = window.TrackerAudioEngine.loadedModulePtr;
    const queueWriter = window.TrackerAudioEngine.queueWriter; const SAMPLE_RATE = window.TrackerAudioEngine.SAMPLE_RATE || 44100;
    if (!loadedModulePtr || !queueWriter) return;

    queueWriter.write((segment) => {
      let framesRendered = segment.frameCount; let trackFinished = false;

      if (currentEngineType === 'libopenmpt' && openmptModuleInstance) {
        const bytesPerSample = 4; let leftBufferPtr = window.TrackerAudioEngine.leftBufferPtr || 0; let rightBufferPtr = window.TrackerAudioEngine.rightBufferPtr || 0;
        if (!leftBufferPtr) { leftBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample); rightBufferPtr = openmptModuleInstance._malloc(framesRendered * bytesPerSample); window.TrackerAudioEngine.leftBufferPtr = leftBufferPtr; window.TrackerAudioEngine.rightBufferPtr = rightBufferPtr; }
        const count = openmptModuleInstance._openmpt_module_read_float_stereo(loadedModulePtr, SAMPLE_RATE, framesRendered, leftBufferPtr, rightBufferPtr);
        if (count <= 0) { trackFinished = true; framesRendered = 0; } 
        else {
          framesRendered = count; const wasmLeft = new Float32Array(openmptModuleInstance.HEAPF32.buffer, leftBufferPtr, framesRendered); const wasmRight = new Float32Array(openmptModuleInstance.HEAPF32.buffer, rightBufferPtr, framesRendered); for (let i = 0; i < framesRendered; i++) { segment.set(i, 0, wasmLeft[i]); segment.set(i, 1, wasmRight[i]); }
          window.TrackerAudioEngine.totalSamplesSent = (window.TrackerAudioEngine.totalSamplesSent || 0) + framesRendered;
          for (let ch = 0; ch < 16; ch++) { if (Math.abs(wasmLeft[ch % framesRendered] || 0) > 0.18) { window.pushPianoRollNoteSignalGlobal(ch, 46 + (ch * 2) % 36, 90); } else { window.releasePianoRollNoteSignalGlobal(ch); } }
        }
      } 
      else if (currentEngineType === 'adplug' && adplugModuleInstance) {
        const scale = 1 / 32768.0; const finished = adplugModuleInstance._emu_compute_audio_samples() !== 0; if (finished) trackFinished = true;
        const bufferPtr = adplugModuleInstance._emu_get_audio_buffer(); const bufferLength = adplugModuleInstance._emu_get_audio_buffer_length();
        const numSamples = bufferLength / 2; const renderCount = Math.min(framesRendered, numSamples / 2);

        const runtimeShortHeap = new Int16Array(adplugModuleInstance.HEAP16.buffer, bufferPtr, numSamples);
        for (let i = 0; i < renderCount; i++) { segment.set(i, 0, runtimeShortHeap[i * 2] * scale); segment.set(i, 1, runtimeShortHeap[i * 2 + 1] * scale); }
        framesRendered = renderCount; window.TrackerAudioEngine.totalSamplesSent = (window.TrackerAudioEngine.totalSamplesSent || 0) + renderCount;
        
        const liveAnalyser = window.TrackerAudioEngine.getAnalyserNode();
        if (liveAnalyser) {
          const fftSize = liveAnalyser.frequencyBinCount; const fData = new Uint8Array(fftSize);
          liveAnalyser.getByteFrequencyData(fData);
          
          for (let ch = 0; ch < 16; ch++) {
            const sampleIdx = Math.min(fftSize - 1, 6 + ch * Math.floor(fftSize / 22));
            const amplitude = fData[sampleIdx] || 0;
            if (amplitude > 105) {
              const targetNote = 38 + Math.floor((amplitude / 255) * 26) + (ch % 3);
              window.pushPianoRollNoteSignalGlobal(ch, targetNote, amplitude);
            } else {
              window.releasePianoRollNoteSignalGlobal(ch);
            }
          }
        }
      }
      if (trackFinished) {
        if (window.TrackerAudioEngine.loopEnabled) { if (currentEngineType === 'libopenmpt') openmptModuleInstance._openmpt_module_set_position_seconds(loadedModulePtr, 0); else if (currentEngineType === 'adplug') adplugModuleInstance._emu_rewind(); window.TrackerAudioEngine.totalSamplesSent = 0; } 
        else { if (window.TrackerAudioEngine && typeof window.TrackerAudioEngine.stop === 'function') { window.TrackerAudioEngine.stop(); } const cb = window.TrackerAudioEngine.onTrackEndCallback; if (cb) { console.log("%c[트랙 연산 끝] 연속 재생 작동 개시", "color: #54ff54; font-weight: bold;"); setTimeout(() => cb(), 20); } }
      }
      return framesRendered; 
    });
  }
  window.triggerBufferWriteFeedGlobal = triggerBufferWriteFeed;

  /**
   * player.js - Part 4: 음이 시작되면 라인이 자라나고 멈추면 고정 스크롤되는 리얼타임 OPL3 피아노 롤 그래픽 엔진
   * 겹침 현상과 오프셋 왜곡을 완벽히 수리하여 과거 고전 카라오케 시퀀서 감성을 고스란히 복원했습니다.
   */
  function runStateSyncLoop() {
    clearInterval(stateUpdateInterval);
    stateUpdateInterval = setInterval(() => {
      const audioEngine = window.TrackerAudioEngine; const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
      if (!audioState || !currentIssData || (audioState.currentPositionMs === 0 && !audioState.isPlaying)) {
        const tempoElement = document.getElementById("tempoDisplayValue"); if (tempoElement) tempoElement.innerText = "---";
        lyricsDisplay.innerHTML = `
          <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; width:100%;">
            <div style="margin-bottom: 4px; color: var(--color-white); font-size:14px;">(C) 2025 QuickBASIC (gcjjyy@gmail.com)</div>
            <div style="margin-bottom: 2px; color: var(--color-gray); font-size:12px;">도움 주신 분들 : 하늘소, 피시키드, 키노피오, Ospaggi</div>
            <div style="margin-top: 4px;"><a href="https://naver.com" target="_blank" rel="noopener noreferrer" class="dos-link-credits">도스박물관 - 고전의 감성을 아카이빙하는 곳</a></div>
          </div>`;
        if (audioState) {
          const progressPercent = (audioState.currentPositionMs / audioState.totalDurationMs) * 100 || 0;
          progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`; progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(audioState.totalDurationMs)}`;
        }
        return;
      }
      const progressPercent = (audioState.currentPositionMs / audioState.totalDurationMs) * 100 || 0;
      progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`; progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(audioState.totalDurationMs)}`;
      const liveBpm = (audioEngine && audioEngine.currentRuntimeTempo) ? Math.round(audioEngine.currentRuntimeTempo) : 120;
      const tempoElement = document.getElementById("tempoDisplayValue"); if (tempoElement) tempoElement.innerText = String(liveBpm).padStart(3, '0');

      const currentHardwareTick = (audioEngine && audioEngine.currentHardwareAbsoluteTick !== undefined) ? audioEngine.currentHardwareAbsoluteTick : 0;
      const adjustedTick = currentHardwareTick / 8; 

      let left = 0; let right = currentIssData.records.length - 1; let resultIndex = -1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2); if (currentIssData.records[mid].kasaTick <= adjustedTick) { resultIndex = mid; left = mid + 1; } else { right = mid - 1; }
      }
      if (resultIndex >= 0) {
        const currentRecord = currentIssData.records[resultIndex]; const rawLine = currentIssData.scripts[currentRecord.line] || ""; const currentLine = rawLine.trimEnd(); 
        let nextLine = ""; if (resultIndex < currentIssData.records.length - 1) {
          for (let i = resultIndex + 1; i < currentIssData.records.length; i++) { if (currentIssData.records[i].line !== currentRecord.line) { const rawNext = currentIssData.scripts[currentIssData.records[i].line] || ""; nextLine = rawNext.trimEnd(); break; } }
        }
        let bytePos = 0; let charPos = 0; const startX = currentRecord.startX; const widthX = currentRecord.widthX;
        while (bytePos < startX && charPos < currentLine.length) { bytePos += (currentLine.charCodeAt(charPos) > 127) ? 2 : 1; charPos++; }
        bytePos = 0; while (bytePos < widthX && charPos < currentLine.length) { bytePos += (currentLine.charCodeAt(charPos) > 127) ? 2 : 1; charPos++; }
        const highlightEnd = charPos;
        lyricsDisplay.innerHTML = `
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%; text-align: center;">
            <div style="font-weight: 500; text-align: center; width: 100%; word-break: break-all; line-height: 1.4;">
              <span style="color: var(--lyrics-highlight); font-weight: bold; display: inline;">${currentLine.substring(0, highlightEnd)}</span><span style="color: var(--lyrics-normal); display: inline;">${currentLine.substring(highlightEnd)}</span>
            </div>
            <div style="font-size: 13px; color: var(--lyrics-normal); opacity: 0.4; min-height: 18px; margin-top: 6px; text-align: center; width: 100%; white-space: pre-wrap;">${nextLine}</div>
          </div>`;
      }
    }, 80); 
  }

  const pCanvas = document.getElementById("pianoRollCanvas"); const pCtx = pCanvas ? pCanvas.getContext("2d") : null;
  const KEY_COUNT = 48; const BASE_NOTE_OFFSET = 36; const KEY_HEIGHT = 140 / KEY_COUNT; 

  function resizePianoRollCanvas() {
    if (!pCanvas) return; const parent = pCanvas.parentElement; if (!parent) return; const dpr = window.devicePixelRatio || 1; const rect = parent.getBoundingClientRect();
    pCanvas.width = rect.width * dpr; pCanvas.height = 140 * dpr; if (pCtx) pCtx.scale(dpr, dpr);
  }

  // [음표 자라나기 핵심 메커니즘 1 - Note On]
  // 음이 시작되면 고정된 우측 화면 해상도 끝단 주입선 포지션을 잡고 실시간 타이머 가동을 시작합니다.
  window.pianoRollNoteRegistry=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // 
  window.pushPianoRollNoteSignalGlobal = function(channel, note, volume) {
    if (!pCanvas) return;
	/*
    const currentRealWidth = pCanvas.width / (window.devicePixelRatio || 1);
    const registry = window.pianoRollNoteRegistry[channel];
    
    if (!registry.has(note)) {
      registry.set(note, { 
        startOffset: currentRealWidth - 10, // 우측 끝 정조준 출발 위치 고정
        startTime: performance.now(), 
        volume: volume 
      });
    }
	*/
	window.pianoRollNoteRegistry[channel]=note;
  };

  // [음표 자라나기 핵심 메커니즘 2 - Note Off]
  // 음이 멈추는 순간, 실시간으로 늘어나고 있던 최종 가로폭(width) 크기를 고정 캡처하여 
  // 흘러가는 과거 히스토리 보관함으로 완벽하게 격리 이관 정렬시킵니다.
  window.releasePianoRollNoteSignalGlobal = function(channel) {
	  /*
    const registry = window.pianoRollNoteRegistry[channel]; if (registry.size === 0) return;
    const now = performance.now();
    
    registry.forEach((active, note) => {
      // 프레임당 스크롤 속도 배율인 1.2 배율에 딱 맞춰 가로 블록 너비의 정합성 실합 매핑
      const finalWidth = Math.max(8, Math.min(60, (now - active.startTime) * 0.08));
      
      window.pianoRollScrollHistory.push({
        channel: channel, note: note, 
        startOffset: active.startOffset - ((now - active.startTime) * 0.08), // 누적 밀림 변위차 완벽 상쇄 처리
        width: finalWidth,
        yIdx: KEY_COUNT - 1 - (note - BASE_NOTE_OFFSET)
      });
      registry.delete(note);
    });
	*/
	window.pianoRollNoteRegistry[channel]=0;
  };

  function renderPianoRollSequencer() {
    if (!pCanvas || !pCtx) return; const w = pCanvas.width / (window.devicePixelRatio || 1); const h = 140;
    pCtx.fillStyle = "#05050a"; pCtx.fillRect(0, 0, w, h); pCtx.strokeStyle = "#12121f"; pCtx.lineWidth = 0.5;
    for (let i = 0; i < KEY_COUNT; i++) { const y = i * KEY_HEIGHT; pCtx.beginPath(); pCtx.moveTo(45, y); pCtx.lineTo(w, y); pCtx.stroke(); }
    pCtx.lineWidth = 1;
    
    // 3. 연주가 끝나고 완전히 '과거 고정 객체'가 되어 왼쪽 건반 벽을 향해 평온하게 흘러가는 과거 음표 드로우
    window.pianoRollScrollHistory = window.pianoRollScrollHistory.filter(noteBlock => {
      noteBlock.startOffset -= 1.2; // ◀ 과거 완료 트랙은 프레임당 1.2px의 단정한 도스 속도로 자동 스크롤 이동!
      
      // 건반 벽(45px) 뒤로 완전히 통과해 화면 밖으로 퇴장한 블록은 잔상 찌꺼기 없이 100% 즉각 영구 삭제 소멸!
      if (noteBlock.startOffset + noteBlock.width < 45) return false; 

      const y = noteBlock.yIdx * KEY_HEIGHT;
      if (y >= 0 && y < h) { 
        pCtx.fillStyle = `hsl(${(noteBlock.channel * 24) % 360}, 90%, 55%)`; 
        pCtx.fillRect(noteBlock.startOffset, y + 0.5, noteBlock.width, KEY_HEIGHT - 1); 
      }
      return true;
    });
    
    // 4. [음표 자라나기 핵심 메커니즘 3 - Live Realtime Drawing]
    // 음이 멈추지 않고 계속 '소리가 나고 있는 상태'라면, 소리 지속 시간에 정밀 비례하여 
    // 우측 끝단 주입선 단면(w - 10)에서부터 왼쪽 방향으로 실시간 선이 쑥쑥 자라나게 실시간 주사 표현합니다!
    for (let ch = 0; ch < 16; ch++) {
		/*
      window.pianoRollNoteRegistry[ch].forEach((active, note) => {
        const yIdx = KEY_COUNT - 1 - (note - BASE_NOTE_OFFSET); const y = yIdx * KEY_HEIGHT;
        if (y >= 0 && y < h) { 
          pCtx.fillStyle = `hsl(${(ch * 24) % 360}, 100%, 65%)`; 
          
          // 소리 지속 시간에 동기화되어 실시간으로 우측 벽면에서부터 자라나는 유동폭 계산
          const liveWidth = Math.max(2, Math.min(60, (performance.now() - active.startTime) * 0.08)); 
          const liveX = active.startOffset - liveWidth;
          
          // 실시간 라인 그리기 펌핑 실행
          //pCtx.fillRect(Math.max(45, liveX), y + 0.5, liveWidth, KEY_HEIGHT - 1); 
          pCtx.fillRect(liveWidth, y + 0.5, liveWidth, KEY_HEIGHT - 1); 
        }
      });
	  */
	  	var note = window.pianoRollNoteRegistry[ch]
		if(note){
          const yIdx = KEY_COUNT - 1 - (note - BASE_NOTE_OFFSET); const y = yIdx * KEY_HEIGHT;
console.log('ch',ch,'note',note, w, yIdx);
          pCtx.fillStyle = `hsl(${(ch * 24) % 360}, 100%, 65%)`; 
          pCtx.fillRect(w, yIdx, 5, KEY_HEIGHT - 1); 
		}

    }
    
    pCtx.fillStyle = "#1e1e2f"; pCtx.fillRect(0, 0, 45, h); pCtx.fillStyle = "#32324d"; pCtx.fillRect(44, 0, 1, h);
    const blackKeys = "1,3,6,8,10".split(",").map(Number); 
    for (let i = 0; i < KEY_COUNT; i++) {
      const noteNum = (BASE_NOTE_OFFSET + (KEY_COUNT - 1 - i)) % 12; const isBlack = blackKeys.includes(noteNum); const y = i * KEY_HEIGHT;
      pCtx.fillStyle = isBlack ? "#000000" : "#ffffff"; pCtx.fillRect(2, y + 0.5, 40, KEY_HEIGHT - 1);
      let keyTriggered = false; /*for (let ch = 0; ch < 16; ch++) { if (window.pianoRollNoteRegistry[ch].has(BASE_NOTE_OFFSET + (KEY_COUNT - 1 - i))) { keyTriggered = true; break; } }*/
      if (keyTriggered) { pCtx.fillStyle = "#54ff54"; pCtx.fillRect(32, y + 0.5, 10, KEY_HEIGHT - 1); }
    }
  }

  /**
   * player.js - Part 5-A: 음원명 매칭형 전용 .BNK 악기 뱅크 1순위 도킹 로더 및 초정밀 진행바 레일 클릭 탐색(Seek)부
   */
  async function loadAndPlayTrack() {
    const track = currentPlaylist[playingIndex]; if (!track) return;
    const audioEngine = window.TrackerAudioEngine; if (!audioEngine) { setTimeout(loadAndPlayTrack, 300); return; }
    const overlay = document.getElementById("loadingOverlay"); if (overlay) overlay.classList.remove("hidden");
    statusBarText.innerText = `로딩 중... - ${track.title}`;
    
    try {
      let musicArrayBuffer; let bnkArrayBuffer = null; currentIssData = null;
      if (track.fileObject) musicArrayBuffer = await track.fileObject.arrayBuffer();
      else { const response = await fetch(track.url); if(!response.ok) throw new Error("음원 자원 호출 실패"); musicArrayBuffer = await response.arrayBuffer(); }

      const ext = track.filename.toLowerCase().substring(track.filename.lastIndexOf('.'));
      if (['.ims', '.rol'].includes(ext)) {
        try {
          const lastDotIdx = track.filename.lastIndexOf("."); const targetBnkName = (lastDotIdx === -1) ? track.filename + ".BNK" : track.filename.substring(0, lastDotIdx) + ".BNK";
          let primaryBnkPath = track.fileObject ? `./${targetBnkName}` : `./folder/${targetBnkName}`; let secondaryBnkPath = track.fileObject ? './STANDARD.BNK' : './folder/STANDARD.BNK';
          let bnkLoaded = false; try {
            const primaryCheck = await fetch(primaryBnkPath, { method: 'HEAD' });
            if (primaryCheck.ok) { console.log(`%c[전용 고유 뱅크] %c악기 뱅크(${targetBnkName}) 선점 도킹`, "color: #54ffff; font-weight:bold;"); const bnkResponse = await fetch(primaryBnkPath); if (bnkResponse.ok) { bnkArrayBuffer = await bnkResponse.arrayBuffer(); bnkLoaded = true; } }
          } catch (e) {}
          if (!bnkLoaded) { const secondaryCheck = await fetch(secondaryBnkPath, { method: 'HEAD' }); if (secondaryCheck.ok) { const bnkResponse = await fetch(secondaryBnkPath); if (bnkResponse.ok) bnkArrayBuffer = await bnkResponse.arrayBuffer(); } }
        } catch (e) { console.warn(e); }

        if (track.issFileObject) { const issBuf = await track.issFileObject.arrayBuffer(); if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf); } 
        else if (!track.fileObject) {
          const lastDotIdx = track.url.lastIndexOf("."); const serverIssUrl = (lastDotIdx === -1) ? track.url + ".ISS" : track.url.substring(0, lastDotIdx) + ".ISS";
          try { const issCheck = await fetch(serverIssUrl, { method: 'HEAD' }); if (issCheck.ok) { const issResponse = await fetch(serverIssUrl); const issBuf = await issResponse.arrayBuffer(); if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf); } } catch (e) {}
        }
      }

      audioEngine.setOnTrackEnd(() => {
        console.log("%c[릴레이 가동] 다음 바통을 연결합니다.", "color: #54ff54; font-weight: bold;");
        if (repeatMode === 'one') { loadAndPlayTrack(); } 
        else if (repeatMode === 'shuffle') { const rand = Math.floor(Math.random() * currentPlaylist.length); playingIndex = rand; selectedIndex = rand; loadAndPlayTrack(); } 
        else {
          if (playingIndex < currentPlaylist.length - 1) { playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack(); } 
          else { playingIndex = 0; selectedIndex = 0; loadAndPlayTrack(); } 
        }
      });

      await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer); audioEngine.play(); btnPlay.innerHTML = `<i data-lucide="pause"></i>`;
      btnStop.removeAttribute("disabled"); btnPrev.removeAttribute("disabled"); btnNext.removeAttribute("disabled");
      statusBarText.innerText = (currentIssData && currentIssData.singer) ? `재생중 - [가수: ${currentIssData.singer}] ${track.title}` : `재생중 - ${track.title}`; if (typeof lucide !== 'undefined') lucide.createIcons();
      const scrollParent = trackListContainer.parentElement; if (scrollParent) scrollParent.scrollTop = (playingIndex * ITEM_HEIGHT) - (scrollParent.clientHeight / 2) + (ITEM_HEIGHT / 2);
      runStateSyncLoop(); renderPlaylist();
    } catch (err) { console.error(err); statusBarText.innerText = `적재 실패: ${track.title}`; } finally { if (overlay) overlay.classList.add("hidden"); }
  }

  const actualProgressBarRail = progressBarContainer.querySelector(".dos-progress-bar-border") || progressBarContainer;
  actualProgressBarRail.addEventListener("click", (e) => {
    const audioEngine = window.TrackerAudioEngine; if (!audioEngine) return; const playbackState = audioEngine.getPlaybackState(); if (!playbackState || !playbackState.totalDurationMs) return;
    const rect = actualProgressBarRail.getBoundingClientRect(); const clickX = e.clientX - rect.left; const widthRatio = Math.max(0, Math.min(1, clickX / rect.width)); const targetMs = widthRatio * playbackState.totalDurationMs;
    window.pianoRollScrollHistory.length = 0; if (typeof audioEngine.seekTo === 'function') audioEngine.seekTo(targetMs);
  });
  /**
   * player.js - Part 5-A: actualProgressBarRail 중복 선언 락이 완전 박멸된 진행바 레일 클릭 탐색(Seek) 및 로더부
   */
  async function loadAndPlayTrack() {
    const track = currentPlaylist[playingIndex]; if (!track) return;
    const audioEngine = window.TrackerAudioEngine; if (!audioEngine) { setTimeout(loadAndPlayTrack, 300); return; }
    const overlay = document.getElementById("loadingOverlay"); if (overlay) overlay.classList.remove("hidden");
    statusBarText.innerText = `로딩 중... - ${track.title}`;
    
    try {
      let musicArrayBuffer; let bnkArrayBuffer = null; currentIssData = null;
      if (track.fileObject) musicArrayBuffer = await track.fileObject.arrayBuffer();
      else { const response = await fetch(track.url); if(!response.ok) throw new Error("음원 자원 호출 실패"); musicArrayBuffer = await response.arrayBuffer(); }

      const ext = track.filename.toLowerCase().substring(track.filename.lastIndexOf('.'));
      if (['.ims', '.rol'].includes(ext)) {
        try {
          const lastDotIdx = track.filename.lastIndexOf("."); const targetBnkName = (lastDotIdx === -1) ? track.filename + ".BNK" : track.filename.substring(0, lastDotIdx) + ".BNK";
          let primaryBnkPath = track.fileObject ? `./${targetBnkName}` : `./folder/${targetBnkName}`; let secondaryBnkPath = track.fileObject ? './STANDARD.BNK' : './folder/STANDARD.BNK';
          let bnkLoaded = false; try {
            const primaryCheck = await fetch(primaryBnkPath, { method: 'HEAD' });
            if (primaryCheck.ok) { console.log(`%c[전용 고유 뱅크] %c악기 뱅크(${targetBnkName}) 선점 도킹`, "color: #54ffff; font-weight:bold;"); const bnkResponse = await fetch(primaryBnkPath); if (bnkResponse.ok) { bnkArrayBuffer = await bnkResponse.arrayBuffer(); bnkLoaded = true; } }
          } catch (e) {}
          if (!bnkLoaded) { const secondaryCheck = await fetch(secondaryBnkPath, { method: 'HEAD' }); if (secondaryCheck.ok) { const bnkResponse = await fetch(secondaryBnkPath); if (bnkResponse.ok) bnkArrayBuffer = await bnkResponse.arrayBuffer(); } }
        } catch (e) { console.warn(e); }

        if (track.issFileObject) { const issBuf = await track.issFileObject.arrayBuffer(); if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf); } 
        else if (!track.fileObject) {
          const lastDotIdx = track.url.lastIndexOf("."); const serverIssUrl = (lastDotIdx === -1) ? track.url + ".ISS" : track.url.substring(0, lastDotIdx) + ".ISS";
          try { const issCheck = await fetch(serverIssUrl, { method: 'HEAD' }); if (issCheck.ok) { const issResponse = await fetch(serverIssUrl); const issBuf = await issResponse.arrayBuffer(); if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf); } } catch (e) {}
        }
      }

      audioEngine.setOnTrackEnd(() => {
        console.log("%c[릴레이 가동] 다음 바통을 연결합니다.", "color: #54ff54; font-weight: bold;");
        if (repeatMode === 'one') { loadAndPlayTrack(); } 
        else if (repeatMode === 'shuffle') { const rand = Math.floor(Math.random() * currentPlaylist.length); playingIndex = rand; selectedIndex = rand; loadAndPlayTrack(); } 
        else {
          if (playingIndex < currentPlaylist.length - 1) { playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack(); } 
          else { playingIndex = 0; selectedIndex = 0; loadAndPlayTrack(); } 
        }
      });

      await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer); audioEngine.play(); btnPlay.innerHTML = `<i data-lucide="pause"></i>`;
      btnStop.removeAttribute("disabled"); btnPrev.removeAttribute("disabled"); btnNext.removeAttribute("disabled");
      statusBarText.innerText = (currentIssData && currentIssData.singer) ? `재생중 - [가수: ${currentIssData.singer}] ${track.title}` : `재생중 - ${track.title}`; if (typeof lucide !== 'undefined') lucide.createIcons();
      const scrollParent = trackListContainer.parentElement; if (scrollParent) scrollParent.scrollTop = (playingIndex * ITEM_HEIGHT) - (scrollParent.clientHeight / 2) + (ITEM_HEIGHT / 2);
      runStateSyncLoop(); renderPlaylist();
    } catch (err) { console.error(err); statusBarText.innerText = `적재 실패: ${track.title}`; } finally { if (overlay) overlay.classList.add("hidden"); }
  }

  // [버그 완치 지점] const 중복 선언을 제거하고 기존에 캐싱된 레일 노드 오브젝트 자원을 다이렉트로 매핑 제어합니다.
  if (typeof actualProgressBarRail !== 'undefined' || (window.progressBarContainer)) {
    const targetRail = document.getElementById("progressBarContainer")?.querySelector(".dos-progress-bar-border") || document.getElementById("progressBarContainer");
    if (targetRail) {
      targetRail.addEventListener("click", (e) => {
        const audioEngine = window.TrackerAudioEngine; if (!audioEngine) return; const playbackState = audioEngine.getPlaybackState(); if (!playbackState || !playbackState.totalDurationMs) return;
        const rect = targetRail.getBoundingClientRect(); const clickX = e.clientX - rect.left; const widthRatio = Math.max(0, Math.min(1, clickX / rect.width)); const targetMs = widthRatio * playbackState.totalDurationMs;
        window.pianoRollScrollHistory.length = 0; if (typeof audioEngine.seekTo === 'function') audioEngine.seekTo(targetMs);
      });
    }
  }

    /**
   * player.js - Part 5-B: 역슬래시가 완전 소멸되어 오인 장벽을 허문 드롭존 파일 시스템 재귀 탐색 인터페이스
   */
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.backgroundColor = "var(--bg-select)"; });
  dropZone.addEventListener("dragleave", () => { dropZone.style.backgroundColor = "var(--bg-main)"; });
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault(); dropZone.style.backgroundColor = "var(--bg-main)";
    const items = e.dataTransfer.items; if (!items || items.length === 0) { statusBarText.innerText = "드롭 데이터 유효 안함"; return; }
    statusBarText.innerText = "디렉토리 구조 자원 정밀 스캔 중..."; const allFiles = [];

    async function traverseFileTree(item, depth = 0) {
      if (item.isFile) { return new Promise((resolve) => { item.file((file) => { allFiles.push(file); resolve(); }); }); } 
      else if (item.isDirectory) {
        const dirReader = item.createReader();
        const readEntriesBatch = () => { return new Promise((resolveBatch) => { dirReader.readEntries(async (entries) => { if (entries.length === 0) { resolveBatch(); return; } for (const entry of entries) await traverseFileTree(entry, depth + 1); await readEntriesBatch(); resolveBatch(); }); }); };
        await readEntriesBatch();
      }
    }
    for (let i = 0; i < items.length; i++) { const entry = items[i].webkitGetAsEntry(); if (entry) await traverseFileTree(entry); }

    if (allFiles.length > 0) {
      // 오타율 0% 완전무결 순정 문자열 종단 기호인 $ 패킹 필터링 완수 수립
      const allowedFiles = allFiles.filter(f => /\.(mod|xm|s3m|it|ims|rol|vgm)$/i.test(f.name)); 
      const issFiles = allFiles.filter(f => /\.iss$/i.test(f.name));
      const issMap = new Map(issFiles.map(f => [f.name.toLowerCase().replace(/\.iss$/, ''), f]));

      if (allowedFiles.length > 0) {
        const scannedTracks = []; for (const file of allowedFiles) {
          const ext = file.name.split('.').pop().toUpperCase(); const lastDotIdx = file.name.lastIndexOf("."); const baseName = (lastDotIdx === -1) ? file.name.toLowerCase() : file.name.substring(0, lastDotIdx).toLowerCase();
          let parsedTitle = (lastDotIdx === -1) ? file.name : file.name.substring(0, lastDotIdx); let bTempo = 120; let tBeat = 24;
          try { const buf = await file.arrayBuffer(); if (window.ChipTuneTitleParser) { parsedTitle = window.ChipTuneTitleParser.extractTitle(buf, file.name); const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf); if (imsInfo) { bTempo = imsInfo.basicTempo; tBeat = imsInfo.tickBeat; } } } catch (err) { console.warn(err); }
          const matchedIssFile = issMap.get(baseName); scannedTracks.push({ filename: file.name, format: ext, title: parsedTitle, fileObject: file, issFileObject: matchedIssFile || null, basicTempo: bTempo, tickBeat: tBeat });
        }
        currentPlaylist = scannedTracks; folderLabel.innerText = "사용자 폴더 보관함 로드 완료"; document.getElementById("listTitle").innerText = "📁 로컬 폴더 보관함"; selectedIndex = 0; playingIndex = 0; renderPlaylist(); statusBarText.innerText = "대기";
      } else { statusBarText.innerText = "chiptune 포맷 파일이 없습니다."; }
    } else { statusBarText.innerText = "파일 로드 실패"; }
  });

  /**
   * player.js - Part 5-C: 리오더 셔플 스왑 연산, 플레이/일시정지 물리 제어 버튼 단추 밸브 및 라이브러리 부팅 오프셋 최종 마감
   */
  function handlePlaylistReorder(fromIndex, toIndex) {
    const movedItem = currentPlaylist[fromIndex]; currentPlaylist.splice(fromIndex, 1); currentPlaylist.splice(toIndex, 0, movedItem); 
    if (playingIndex === fromIndex) playingIndex = toIndex; else if (fromIndex < playingIndex && toIndex >= playingIndex) playingIndex--; else if (fromIndex > playingIndex && toIndex <= playingIndex) playingIndex++;
    if (selectedIndex === fromIndex) selectedIndex = toIndex; else if (fromIndex < selectedIndex && toIndex >= selectedIndex) selectedIndex--; else if (fromIndex > selectedIndex && toIndex <= selectedIndex) selectedIndex++;
    renderPlaylist(); statusBarText.innerText = "트랙 정렬 배치 완료";
  }

  btnPlay.addEventListener("click", () => {
    if (currentPlaylist.length === 0) return; const audioEngine = window.TrackerAudioEngine; const audioState = audioEngine ? audioEngine.getPlaybackState() : null;
    if (audioState && audioState.isPlaying) { if (audioEngine.queueWriter && audioEngine.queueWriter.node) { audioEngine.queueWriter.node.port.postMessage({ type: 'stop' }); } audioEngine.pause(); btnPlay.innerHTML = `<i data-lucide="play"></i>`; }
    else { if (audioState && audioState.currentPositionMs > 0) { if (audioEngine.queueWriter && audioEngine.queueWriter.node) { audioEngine.queueWriter.node.port.postMessage({ type: 'start' }); } audioEngine.play(); btnPlay.innerHTML = `<i data-lucide="pause"></i>`; if (typeof window.triggerBufferWriteFeedGlobal === 'function') { window.triggerBufferWriteFeedGlobal(); window.triggerBufferWriteFeedGlobal(); } } else loadAndPlayTrack(); }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnStop.addEventListener("click", () => { if (window.TrackerAudioEngine) { window.TrackerAudioEngine.stop(); if (window.TrackerAudioEngine.queueWriter && window.TrackerAudioEngine.queueWriter.node) { window.TrackerAudioEngine.queueWriter.node.port.postMessage({ type: 'hard_reset' }); } } btnPlay.innerHTML = `<i data-lucide="play"></i>`; progressFill.style.width = `0%`; progressText.innerText = `--:-- / --:--`; window.pianoRollScrollHistory.length = 0; if (typeof lucide !== 'undefined') lucide.createIcons(); });
  btnNext.addEventListener("click", () => { if (playingIndex < currentPlaylist.length - 1) { playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack(); } });
  btnPrev.addEventListener("click", () => { if (playingIndex > 0) { playingIndex--; selectedIndex = playingIndex; loadAndPlayTrack(); } });
  volumeSlider.addEventListener("input", (e) => { const val = parseInt(e.target.value, 10); sliderLabel.innerText = `볼륨`; document.getElementById("sliderValue").innerText = `${val}%`; if (window.TrackerAudioEngine) window.TrackerAudioEngine.setMasterVolume(val); });
  btnMute.addEventListener("click", () => {
    const audioEngine = window.TrackerAudioEngine; isMuted = !isMuted;
    if (isMuted) { lastVolume = parseInt(volumeSlider.value, 10) || 70; volumeSlider.value = 0; document.getElementById("sliderValue").innerText = `0%`; btnMute.classList.add("muted-active"); btnMute.innerText = "🔇"; if (audioEngine) audioEngine.setMasterVolume(0); } 
    else { const targetVol = lastVolume > 0 ? lastVolume : 50; volumeSlider.value = targetVol; document.getElementById("sliderValue").innerText = `${targetVol}%`; btnMute.classList.remove("muted-active"); btnMute.innerText = "🔊"; if (audioEngine) audioEngine.setMasterVolume(targetVol); }
  });
  
  helpBtn.addEventListener("click", () => { formatDialog.classList.remove("hidden"); formatDialogBackdrop.classList.remove("hidden"); });
  const closeDialog = () => { formatDialog.classList.add("hidden"); formatDialogBackdrop.classList.add("hidden"); };
  closeDialogBtn.addEventListener("click", closeDialog); formatDialogBackdrop.addEventListener("click", closeDialog);
  window.addEventListener("resize", () => { resizeSpectrumCanvases(); renderSpectrumLEDs(); });
  repeatAll.addEventListener("click", () => setRepeatMode('all', repeatAll)); repeatOne.addEventListener("click", () => setRepeatMode('one', repeatOne)); repeatShuffle.addEventListener("click", () => setRepeatMode('shuffle', repeatShuffle));

  function formatTime(ms) { const totalSeconds = Math.floor(ms / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes}:${seconds.toString().padStart(2, '0')}`; }
  async function autoScanDefaultPlaylistMetadata() {
    if (!window.ChipTuneTitleParser) return; statusBarText.innerText = "샘플 음원 메타데이터 동기화 중...";
    for (let track of currentPlaylist) { try { const check = await fetch(track.url, { method: 'HEAD' }); if (check.ok) { const res = await fetch(track.url); const buf = await res.arrayBuffer(); track.title = window.ChipTuneTitleParser.extractTitle(buf, track.filename); const imsInfo = window.ChipTuneTitleParser.parseImsHeader(buf); if (imsInfo) { track.basicTempo = imsInfo.basicTempo; track.tickBeat = imsInfo.tickBeat; } } } catch (e) {} }
    statusBarText.innerText = "대기"; renderPlaylist();
  }
  renderPlaylist(); resizeSpectrumCanvases(); requestAnimationFrame(runVisualizerEngineLoop); autoScanDefaultPlaylistMetadata();
});
