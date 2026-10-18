/**
 * player.js - Part 1: 전역 변수 설정 및 기본 내장 샘플 목록 자동 빌드 (home.tsx 로더 완벽 이식)
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // 1. [home.tsx 이식] 원본 프로젝트의 내장 샘플 목록 구성 (MUSIC_SAMPLES)
  // 서버에 실제로 존재하는 파일들이라면 사이트 접속 시 자동으로 내부 한글 제목을 긁어오게 됩니다.
  let currentPlaylist = [
    // IMS 샘플 포맷 목록
    { filename: "JAM-FIVE.IMS", url: "./JAM-FIVE.IMS", format: "IMS", title: "JAM-FIVE" },
    { filename: "JAM-NADI.IMS", url: "./JAM-NADI.IMS", format: "IMS", title: "JAM-NADI" },
    { filename: "MYSTERY-.IMS", url: "./MYSTERY-.IMS", format: "IMS", title: "MYSTERY-" },
    { filename: "SHC.IMS", url: "./SHC.IMS", format: "IMS", title: "SHC" },
    { filename: "COCKTAIL.IMS", url: "./COCKTAIL.IMS", format: "IMS", title: "COCKTAIL" },
    { filename: "SIM-FEEL.IMS", url: "./SIM-FEEL.IMS", format: "IMS", title: "SIM-FEEL" },

    // ROL 샘플 포맷 목록
    { filename: "VV.ROL", url: "./VV.ROL", format: "ROL", title: "VV" },
    { filename: "4JSTAMNT.ROL", url: "./4JSTAMNT.ROL", format: "ROL", title: "4JSTAMNT" },

    // VGM 고전 게임 사운드 에뮬레이터 목록
    { filename: "Feena.vgm", url: "./Feena.vgm", format: "VGM", title: "Feena (Ys I)" },
    { filename: "Final Battle.vgm", url: "./Final Battle.vgm", format: "VGM", title: "Final Battle" },

    // Tracker 클래식 마스터피스 목록
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

  const canvas = document.getElementById("visualizerCanvas");

  // 16채널 세그먼트 데이터 모델 초기화
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
    canv.style.width = "100%";
    canv.style.height = "100%";
    
    wrapper.appendChild(canv);
    spectrumContainer.appendChild(wrapper);
    
    canvasElements.push(canv);
  }

  // 2. [home.tsx 이식 핵심] 기본 서버 내장 샘플 파일들의 한글 조합형 원제목 자동 백그라운드 스캔 모듈
  async function autoScanDefaultPlaylistMetadata() {
    if (!window.ChipTuneTitleParser) return;
    
    statusBarText.innerText = "서버 내장 샘플 음원 메타데이터 동기화 중...";
    for (let track of currentPlaylist) {
      try {
        // HEAD 메서드로 파일 실제 존재 확인 후 바이너리 fetch 추출
        const check = await fetch(track.url, { method: 'HEAD' });
        if (check.ok) {
          const res = await fetch(track.url);
          const buf = await res.arrayBuffer();
          // 브라우저 내장 바이너리 디코더로 조합형 한글 타이틀 동적 전사 복원
          track.title = window.ChipTuneTitleParser.extractTitle(buf, track.filename);
        }
      } catch (e) {
        console.warn(`${track.filename} 샘플 자원을 서버에서 찾을 수 없습니다. (MIME/정적 자원 배치 점검 요망)`);
      }
    }
    statusBarText.innerText = "대기";
    renderPlaylist(); // 수정된 타이틀 목록을 UI 브라우저에 새로고침 반영
  }

  // 기존 파트 4 하단의 최초 실행 구문 스케줄에 autoScanDefaultPlaylistMetadata(); 를 기입해 줍니다.

//2
  /**
   * player.js - Part 2: 16채널 해상도 리사이저 및 플레이리스트 UI 렌더러 함수 정의
   */
  function resizeSpectrumCanvases() {
    const dpr = window.devicePixelRatio || 1;
    canvasContexts.length = 0;
    
    canvasElements.forEach((canv) => {
      const rect = canv.getBoundingClientRect();
      canv.width = rect.width * dpr;
      canv.height = rect.height * dpr;
      const ctx = canv.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      canvasContexts.push({ ctx, width: rect.width, height: rect.height });
    });
  }

  const mockLyrics = [
    "DOS CHIPTUNE PLAYER SYSTEM ONLINE",
    "WASM WebAudio 하드웨어 가속 합성 엔진 탑재",
    "실시간 스펙트럼 애널라이저 분석 루프 구동 성공",
    "도스박물관 뮤직 아카이브 보전 프로젝트"
  ];

  // 플레이리스트 렌더링 팩토리 함수
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
      div.addEventListener("click", () => {
        selectedIndex = idx;
        renderPlaylist();
      });
      div.addEventListener("dblclick", () => {
        selectedIndex = idx;
        playingIndex = idx;
        loadAndPlayTrack();
      });
      trackListContainer.appendChild(div);
    });
  }

  // 싱글 주파수 바 LED 그래픽 함수
  function renderSingleBar(barIndex) {
    const target = canvasContexts[barIndex];
    if (!target || !target.ctx || target.width === 0 || target.height === 0) return;

    const { ctx, width, height } = target;
    const segmentGap = 1;
    const segmentHeight = (height - segmentGap * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;
    const bar = barData[barIndex];

    ctx.fillStyle = colors.barBg;
    ctx.fillRect(0, 0, width, height);

    const peakSegIndex = Math.min(Math.floor((bar.peak * SEGMENT_COUNT) / 100), SEGMENT_COUNT - 1);

    for (let segIndex = 0; segIndex < SEGMENT_COUNT; segIndex++) {
      const threshold = ((segIndex + 1) / SEGMENT_COUNT) * 100;
      const isActive = bar.value >= threshold;
      const isPeak = segIndex === peakSegIndex;

      let color = colors.inactive;
      if (isPeak && bar.peak > 0) {
        color = colors.peak;
      } else if (isActive) {
        const ratio = segIndex / SEGMENT_COUNT;
        if (ratio >= 2 / 3) color = colors.high;
        else if (ratio >= 1 / 3) color = colors.mid;
        else color = colors.low;
      }

      const segY = (SEGMENT_COUNT - 1 - segIndex) * (segmentHeight + segmentGap);
      ctx.fillStyle = color;
      ctx.fillRect(0, segY, width, segmentHeight);
    }
  }

  function renderSpectrumLEDs() {
    for (let i = 0; i < BAR_COUNT; i++) {
      renderSingleBar(i);
    }
  }
//3
  /**
   * player.js - Part 3: 실시간 동기화 루프 엔진 및 비동기 음원/가사 디코딩 적재
   */

  // 30fps 고정 하드웨어 연산 타이머 애니메이션 루프 (피크 홀드 감쇄 가속도)
  let lastVisualizerTime = 0;
  const targetInterval = 1000 / 30;

  // [player.js 수정용] 초고속 30fps 무한 루프 내 전역 오디오 엔진 Null 참조 원천 차단 방어 코드
  function runVisualizerEngineLoop(timestamp) {
    requestAnimationFrame(runVisualizerEngineLoop);

    // 1. [핵심 안전장치] 전역 오디오 엔진 상자가 아예 존재하지 않는 극초반 로딩 단계라면 연산을 건너뜁니다.
    if (!window.TrackerAudioEngine) {
      return; 
    }

    if (timestamp - lastVisualizerTime < targetInterval) return;
    lastVisualizerTime = timestamp;

    const analyser = window.TrackerAudioEngine.getAnalyserNode();
    if (!analyser) {
      // 오디오가 정지 상태일 때 LED 바를 자연스럽게 아래로 떨어뜨리는 감쇄(Decay) 처리
      for (let i = 0; i < BAR_COUNT; i++) {
        const prev = barData[i];
        let value = Math.max(0, prev.value - VALUE_FALL_SPEED);
        let peak = prev.peak;
        let peakHoldTime = prev.peakHoldTime;
        let peakFallSpeed = prev.peakFallSpeed;

        if (peakHoldTime > 0) peakHoldTime--;
        else {
          peakFallSpeed += PEAK_FALL_ACCELERATION;
          peak = Math.max(0, peak - peakFallSpeed);
        }
        barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
      }
      renderSpectrumLEDs();
      return;
    }

    // 오디오 연주 중일 때의 고정 주파수 대역 분석 처리
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const skipBins = 2;
    const usableBins = bufferLength - skipBins;
    const binsPerBar = Math.floor(usableBins / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const startBin = skipBins + i * binsPerBar;
      const endBin = Math.min(startBin + binsPerBar, bufferLength);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) { sum += dataArray[j]; }
      const avg = sum / (endBin - startBin);
      const rawValue = Math.round((avg / 255) * 100);
      const prev = barData[i];

      let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - VALUE_FALL_SPEED);
      let peak = prev.peak;
      let peakHoldTime = prev.peakHoldTime;
      let peakFallSpeed = prev.peakFallSpeed;

      if (value >= peak) {
        peak = value; peakHoldTime = PEAK_HOLD_FRAMES; peakFallSpeed = 0;
      } else if (peakHoldTime > 0) {
        peakHoldTime--;
      } else {
        peakFallSpeed += PEAK_FALL_ACCELERATION;
        peak = Math.max(0, peak - peakFallSpeed);
      }

      barData[i] = { value, peak, peakHoldTime, peakFallSpeed };
    }

    renderSpectrumLEDs();
  }


  // 실시간 가사 및 위치 타이머 싱크 스케줄러 (진짜 .ISS 자막 동기화 추적 모듈 탑재)
  function runStateSyncLoop() {
    clearInterval(stateUpdateInterval);
    stateUpdateInterval = setInterval(() => {
      const audioState = window.TrackerAudioEngine.getPlaybackState();
      if (!audioState) return;

      const percentage = (audioState.currentPositionMs / audioState.totalDurationMs) * 100 || 0;
      progressFill.style.width = `${percentage}%`;
      progressText.innerText = `${formatTime(audioState.currentPositionMs)} / ${formatTime(audioState.totalDurationMs)}`;

      if (audioState.isPlaying) {
        if (currentIssData && currentIssData.records && currentIssData.records.length > 0) {
          const currentTick = Math.floor(audioState.currentPositionMs / 8); 
          let activeLine = 0;
          
          for (let i = 0; i < currentIssData.records.length; i++) {
            if (currentIssData.records[i].kasaTick <= currentTick) {
              activeLine = currentIssData.records[i].line;
            } else {
              break;
            }
          }
          
          const text = currentIssData.scripts[activeLine] || "";
          lyricsDisplay.innerHTML = `<div style="color: var(--color-cyan); font-weight: bold;">${text}</div>`;
        } else {
          const step = Math.floor((audioState.currentPositionMs / audioState.totalDurationMs) * mockLyrics.length);
          lyricsDisplay.innerHTML = `<div>${mockLyrics[step] || mockLyrics[mockLyrics.length - 1]}</div>`;
        }
      } else {
        lyricsDisplay.innerHTML = `<div class="lyrics-fallback">READY TO PLAY...</div>`;
      }
    }, 100);
  }

  // 음원 비동기 로드 및 구동 컨트롤러 (WASM 코어 통합 사운드 및 로컬 ISS 가사 연동)
  // [player.js 완전 방어형 교정본] 전역 엔진 Null/Undefined 참조 차단 및 자동 복원 적재 장치
  async function loadAndPlayTrack() {
    const track = currentPlaylist[playingIndex];
    if (!track) return;

    // 1. [핵심 안전장치] 엔진이 존재하지 않을 경우를 대비해 전역 윈도우 스코프 및 상위 컨텍스트에서 오디오 엔진 재검색
    const audioEngine = window.TrackerAudioEngine || (window.parent && window.parent.TrackerAudioEngine);
    
    if (!audioEngine || typeof audioEngine.loadTrack !== 'function') {
      console.warn("[오디오 코어 대기] TrackerAudioEngine이 아직 메모리에 완전히 적재되지 않았습니다. 0.5초 후 재시도합니다.");
      statusBarText.innerText = "오디오 합성 코어 엔진 연결 대기 중...";
      // 0.5초 후 자동으로 다시 실행되도록 타이밍 양보 스케줄러 가동
      setTimeout(loadAndPlayTrack, 500);
      return;
    }

    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.remove("hidden");

    statusBarText.innerText = `로딩 중... - ${track.title}`;
    
    try {
      let musicArrayBuffer;
      let bnkArrayBuffer = null;

      if (track.fileObject) {
        musicArrayBuffer = await track.fileObject.arrayBuffer();
      } else {
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
        } catch (e) { console.warn("STANDARD.BNK 악기 로드 실패", e); }
      }

      // [핵심 보정] 안전하게 확보된 복구 인스턴스(audioEngine)를 호출하여 락 현상 원천 타파
      await audioEngine.loadTrack(musicArrayBuffer, track.filename, bnkArrayBuffer);
      audioEngine.play();
      
      btnPlay.innerHTML = `<i data-lucide="pause"></i>`;
      btnStop.removeAttribute("disabled");
      btnPrev.removeAttribute("disabled");
      btnNext.removeAttribute("disabled");
      
      // 가사 데이터 가수 메타 정보 매핑 보완
      if (currentIssData && currentIssData.singer) {
        statusBarText.innerText = `재생중 - [가수: ${currentIssData.singer}] ${track.title}`;
      } else {
        statusBarText.innerText = `재생중 - ${track.title}`;
      }
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
      
      const scrollParent = trackListContainer.parentElement;
      if (scrollParent) {
        scrollParent.scrollTop = (playingIndex * ITEM_HEIGHT) - (scrollParent.clientHeight / 2) + (ITEM_HEIGHT / 2);
      }

      runStateSyncLoop();
      renderPlaylist();
    } catch (err) {
      console.error("[WASM 연주 파이프라인 오류]", err);
      statusBarText.innerText = `적재 실패: ${track.title} (엔진 규격을 점검하세요)`;
    } finally {
      if (overlay) overlay.classList.add("hidden");
    }
  }


//4
  /**
   * player.js - Part 4: 드래그 앤 드롭 파일 스캐너 및 최종 인터페이스 이벤트 바인딩
   */

  // [안전장치 탑재] 코어 오디오 엔진 객체가 전역에 완전히 등록되었는지 검사 후 콜백 위임
  if (window.TrackerAudioEngine && typeof window.TrackerAudioEngine.setOnTrackEnd === 'function') {
    window.TrackerAudioEngine.setOnTrackEnd(() => {
      if (repeatMode === 'one') {
        loadAndPlayTrack();
      } else if (repeatMode === 'shuffle') {
        const rand = Math.floor(Math.random() * currentPlaylist.length);
        playingIndex = rand; selectedIndex = rand;
        loadAndPlayTrack();
      } else {
        if (playingIndex < currentPlaylist.length - 1) {
          playingIndex++; selectedIndex = playingIndex;
          loadAndPlayTrack();
        } else {
          window.TrackerAudioEngine.stop();
          btnPlay.innerHTML = `<i data-lucide="play"></i>`;
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      }
    });
  } else {
    console.warn("TrackerAudioEngine 사운드 코어가 아직 대기 중입니다. 플레이어 구동 후 이벤트를 재바인딩합니다.");
  }

  function setRepeatMode(mode, targetBtn) {
    repeatMode = mode;
    [repeatAll, repeatOne, repeatShuffle].forEach(b => b.classList.remove("dos-button-active"));
    targetBtn.classList.add("dos-button-active");
    window.TrackerAudioEngine.setLoopEnabled(mode === 'one');
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
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length > 0) {
      const allowedFiles = files.filter(f => /\.(mod|xm|s3m|it|ims|rol|vgm)\$/i.test(f.name));
      const issFiles = files.filter(f => /\.iss\$/i.test(f.name));
      
      const issMap = new Map(issFiles.map(f => [f.name.toLowerCase().replace(/\.iss\$/, ''), f]));

      if (allowedFiles.length > 0) {
        statusBarText.innerText = "로컬 바이너리 데이터 내부 및 가사 데이터 정보 동시 결합 중...";
        const scannedTracks = [];
        
        for (const file of allowedFiles) {
          const ext = file.name.split('.').pop().toUpperCase();
          const baseName = file.name.replace(/\.[^.]+\$/, '').toLowerCase();
          let parsedTitle = file.name.replace(/\.[^.]+\$/, '');
          
          try {
            const buf = await file.arrayBuffer();
            if (window.ChipTuneTitleParser) {
              parsedTitle = window.ChipTuneTitleParser.extractTitle(buf, file.name);
            }
          } catch (err) { console.warn(err); }

          const matchedIssFile = issMap.get(baseName);

          scannedTracks.push({ 
            filename: file.name, 
            format: ext, 
            title: parsedTitle, 
            fileObject: file,
            issFileObject: matchedIssFile || null
          });
        }
        
        currentPlaylist = scannedTracks;
        folderLabel.innerText = "사용자 트랙 보관함 로드 완료";
        document.getElementById("listTitle").innerText = "📁 로컬 미디어 보관함";
        selectedIndex = 0; playingIndex = 0;
        renderPlaylist();
        statusBarText.innerText = "대기 - 음원을 더블 클릭하면 연주가 시작됩니다.";
      }
    }
  });

  btnPlay.addEventListener("click", () => {
    if (currentPlaylist.length === 0) return;
    const audioState = window.TrackerAudioEngine.getPlaybackState();
    if (audioState && audioState.isPlaying) {
      window.TrackerAudioEngine.pause();
      btnPlay.innerHTML = `<i data-lucide="play"></i>`;
    } else {
      if (audioState && audioState.currentPositionMs > 0) {
        window.TrackerAudioEngine.play();
        btnPlay.innerHTML = `<i data-lucide="pause"></i>`;
      } else {
        loadAndPlayTrack();
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnStop.addEventListener("click", () => {
    window.TrackerAudioEngine.stop();
    btnPlay.innerHTML = `<i data-lucide="play"></i>`;
    progressFill.style.width = `0%`;
    progressText.innerText = `--:-- / --:--`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  btnNext.addEventListener("click", () => {
    if (playingIndex < currentPlaylist.length - 1) {
      playingIndex++; selectedIndex = playingIndex;
      loadAndPlayTrack();
    }
  });

  btnPrev.addEventListener("click", () => {
    if (playingIndex > 0) {
      playingIndex--; selectedIndex = playingIndex;
      loadAndPlayTrack();
    }
  });

  volumeSlider.addEventListener("input", (e) => {
    const val = e.target.value;
    sliderLabel.innerText = `볼륨`;
    document.getElementById("sliderValue").innerText = `${val}%`;
    window.TrackerAudioEngine.setMasterVolume(val);
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

  repeatAll.addEventListener("click", () => setRepeatMode('all', repeatAll));
  repeatOne.addEventListener("click", () => setRepeatMode('one', repeatOne));
  repeatShuffle.addEventListener("click", () => setRepeatMode('shuffle', repeatShuffle));

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // 시스템 구동 시작 선언 명시
  renderPlaylist();
  requestAnimationFrame(runVisualizerEngineLoop);
  setTimeout(resizeSpectrumCanvases, 200);
  autoScanDefaultPlaylistMetadata(); 
});
