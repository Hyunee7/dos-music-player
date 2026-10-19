/**
 * player.js - Part 1: 전역 변수 설정 및 UI DOM 객체 캐싱
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // 시스템 기본 재생 목록 (home.tsx 로더 규격 완벽 반영)
  let currentPlaylist = [
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
  let currentIssData = null; // 실시간 파싱 완료된 진짜 카라오케 가사 보관함
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
//2
  /**
   * player.js - Part 2: 16채널 하드웨어 가속 LED 캔버스 분할 동적 생성 및 리사이저
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

  // 16채널 분할형 DOM 캔버스 동적 팩토리 빌드
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

  /**
   * player.js - [2/6 파트] 내부의 리사이저 함수 수정본
   * 고정된 작은 부모 크기의 안쪽 영역(패딩 제외)을 계산해 캔버스 깨짐과 진행바 오차를 보정합니다.
   */
  function resizeSpectrumCanvases() {
    const dpr = window.devicePixelRatio || 1;
    canvasContexts.length = 0;
    
    canvasElements.forEach((canv) => {
      const parent = canv.parentElement;
      if (!parent) return;

      // 부모 컨테이너(120px 높이)의 실제 렌더링 영역 크기 추출
      const rect = parent.getBoundingClientRect();
      const targetWidth = rect.width;
      const targetHeight = rect.height || 112; // 패딩을 감안한 안전 기본 높이 매핑

      // 고정 소형 물리 해상도 락(Lock) 주입
      canv.width = targetWidth * dpr;
      canv.height = targetHeight * dpr;
      
      const ctx = canv.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        // 컨텍스트 및 스케일 정보 정밀 캐싱 배정
        canvasContexts.push({ ctx, width: targetWidth, height: targetHeight });
      }
    });
  }

  const mockLyrics = [
    "DOS CHIPTUNE PLAYER SYSTEM ONLINE",
    "WASM WebAudio 하드웨어 가속 합성 엔진 탑재",
    "실시간 스펙트럼 애널라이저 분석 루프 구동 성공",
    "도스박물관 뮤직 아카이브 보전 프로젝트"
  ];

//3
  /**
   * player.js - Part 3: 플레이리스트 화면 정렬 및 30fps 피크 홀드 감쇄 렌더링 애니메이션
   */
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

//4
  /**
   * player.js - Part 4: 진행바 오차 보정 및 노래방 카라오케 전광판 실시간 한글 흐름 매핑 루프
   */
  function runStateSyncLoop() {
    clearInterval(stateUpdateInterval);
    stateUpdateInterval = setInterval(() => {
      const audioState = window.TrackerAudioEngine ? window.TrackerAudioEngine.getPlaybackState() : null;
      
      if (!audioState || !audioState.isPlaying || !currentIssData) {
        lyricsDisplay.innerHTML = `
          <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%;">
            <div style="margin-bottom: 6px; color: var(--color-white);">(C) 2025 QuickBASIC (gcjjyy@gmail.com)</div>
            <div style="margin-bottom: 2px; color: var(--color-gray); font-size:13px;">도움 주신 분들 : 하늘소, 피시키드, 키노피오, Ospaggi</div>
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

      const currentTick = Math.floor((audioState.currentPositionMs / 1000) * 70);
      const adjustedTick = Math.floor(currentTick / 8); 

      let left = 0; let right = currentIssData.records.length - 1; let resultIndex = -1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (currentIssData.records[mid].kasaTick <= adjustedTick) { resultIndex = mid; left = mid + 1; }
        else { right = mid - 1; }
      }

      if (resultIndex >= 0) {
        const currentRecord = currentIssData.records[resultIndex];
        const currentLine = currentIssData.scripts[currentRecord.line] || "";

        let nextLine = "";
        if (resultIndex < currentIssData.records.length - 1) {
          for (let i = resultIndex + 1; i < currentIssData.records.length; i++) {
            if (currentIssData.records[i].line !== currentRecord.line) {
              nextLine = currentIssData.scripts[currentIssData.records[i].line] || ""; break;
            }
          }
        }

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

        lyricsDisplay.innerHTML = `
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width:100%;">
            <div class="karaoke-text-line" style="margin-bottom: 6px;">
              <span style="color: var(--lyrics-highlight);">${currentLine.substring(0, highlightEnd)}</span>
              <span style="color: var(--lyrics-normal);">${currentLine.substring(highlightEnd)}</span>
            </div>
            <div style="font-size: 14px; color: var(--lyrics-normal); opacity: 0.5; min-height: 20px;">${nextLine}</div>
          </div>`;
      }
    }, 80); 
  }

//5
  /**
   * player.js - Part 5: 비동기 방식의 WASM 음원 전사 적재 및 악기 뱅크, .ISS 가사 파일 결합 로더
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
        const response = await fetch(track.url);
        if(!response.ok) throw new Error("음원 자원 호출 실패");
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
          const issBuf = await track.issFileObject.arrayBuffer();
          if (window.ChipTuneTitleParser) currentIssData = window.ChipTuneTitleParser.parseISSFile(issBuf);
        }
      }

      await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer);
      audioEngine.play();
      btnPlay.innerHTML = `<i data-lucide="pause"></i>`;
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

//6
  /**
   * player.js - Part 6: 복합 드래그 앤 드롭 결합 장치, 미디어 제어 버튼 바인딩 및 자동 기저 스캔 가동
   */
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
        statusBarText.innerText = "로컬 바이너리 및 가사 정보 매핑 중..."; const scannedTracks = [];
        for (const file of allowedFiles) {
          const ext = file.name.split('.').pop().toUpperCase(); const baseName = file.name.replace(/\.[^.]+\$/, '').toLowerCase();
          let parsedTitle = file.name.replace(/\.[^.]+\$/, '');
          try {
            const buf = await file.arrayBuffer();
            if (window.ChipTuneTitleParser) parsedTitle = window.ChipTuneTitleParser.extractTitle(buf, file.name);
          } catch (err) { console.warn(err); }
          const matchedIssFile = issMap.get(baseName);
          scannedTracks.push({ filename: file.name, format: ext, title: parsedTitle, fileObject: file, issFileObject: matchedIssFile || null });
        }
        currentPlaylist = scannedTracks; folderLabel.innerText = "사용자 트랙 보관함 로드 완료";
        document.getElementById("listTitle").innerText = "📁 로컬 미디어 보관함";
        selectedIndex = 0; playingIndex = 0; renderPlaylist(); statusBarText.innerText = "대기";
      }
    }
  });

  btnPlay.addEventListener("click", () => {
    if (currentPlaylist.length === 0) return;
    const audioState = window.TrackerAudioEngine ? window.TrackerAudioEngine.getPlaybackState() : null;
    if (audioState && audioState.isPlaying) { window.TrackerAudioEngine.pause(); btnPlay.innerHTML = `<i data-lucide="play"></i>`; }
    else {
      if (audioState && audioState.currentPositionMs > 0) { window.TrackerAudioEngine.play(); btnPlay.innerHTML = `<i data-lucide="pause"></i>`; }
      else loadAndPlayTrack();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnStop.addEventListener("click", () => {
    if (window.TrackerAudioEngine) window.TrackerAudioEngine.stop();
    btnPlay.innerHTML = `<i data-lucide="play"></i>`; progressFill.style.width = `0%`; progressText.innerText = `--:-- / --:--`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnNext.addEventListener("click", () => { if (playingIndex < currentPlaylist.length - 1) { playingIndex++; selectedIndex = playingIndex; loadAndPlayTrack(); } });
  btnPrev.addEventListener("click", () => { if (playingIndex > 0) { playingIndex--; selectedIndex = playingIndex; loadAndPlayTrack(); } });
  volumeSlider.addEventListener("input", (e) => { const val = e.target.value; sliderLabel.innerText = `볼륨`; document.getElementById("sliderValue").innerText = `${val}%`; if (window.TrackerAudioEngine) window.TrackerAudioEngine.setMasterVolume(val); });

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
        }
      } catch (e) { console.warn(e); }
    }
    statusBarText.innerText = "대기"; renderPlaylist();
  }

  renderPlaylist();
  
  // 고정 사이즈 레이아웃이 적용되었으므로 지연 없이 즉시 크기를 맞추어 진행바 싱크를 확보합니다.
  resizeSpectrumCanvases(); 
  
  requestAnimationFrame(runVisualizerEngineLoop);
  autoScanDefaultPlaylistMetadata();
});
