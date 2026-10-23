/**
 * audio-queue-processor.js - 크롬 기반 브라우저 읽기 전용 객체 충돌 수정 및 일시정지 보존 엔진 (최종 완결본)
 */

class AudioQueueProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];      // 재생 대기 중인 오디오 청크 보관함
    this.readOffset = 0;  // 현재 청크 내부의 읽기 프레임 위치
    this.totalRead = 0;   // 총 소모된 오디오 프레임 수
    this.isPlaying = false;
    
    this.basicTempo = 120;
    this.tickBeat = 24;
    this.sampleRate = 44100;
    this.accumulatedTick = 0; // 오차가 영구 청소된 진짜 하드웨어 절대 경과 틱
    
    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'chunk') {
        this.queue.push({
          channels: msg.channels,
          length: msg.length
        });
      } else if (msg.type === 'start') {
        this.isPlaying = true;
        this.port.postMessage({ type: 'ready_for_feed' });
      } else if (msg.type === 'stop') {
        // 일시정지 상태에서는 시계 축(accumulatedTick)을 보존합니다.
        this.isPlaying = false;
        this.queue.length = 0;
        this.readOffset = 0;
      } else if (msg.type === 'hard_reset') {
        // 완전히 정지하거나 트랙이 바뀔 때만 시계 초기화
        this.accumulatedTick = 0;
        this.queue.length = 0;
        this.readOffset = 0;
        this.isPlaying = false;
      } else if (msg.type === 'meta_sync') {
        this.basicTempo = msg.basicTempo || 120;
        this.tickBeat = msg.tickBeat || 24;
        this.sampleRate = msg.sampleRate || 44100;
        this.accumulatedTick = 0;
      } else if (msg.type === 'runtime_tempo_update') {
        if (msg.currentTempo && msg.currentTempo > 0) {
          this.basicTempo = msg.currentTempo;
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]; // 첫 번째 출력 버스 참조 추출
    if (!output || output.length === 0) return true;
    
    const outputLeft = output[0];
    const outputRight = output[1];
    
    // [TypeError 치유 핵심] 안전 규격 마스킹 처리
    // 읽기 전용 상태인 output 배열 자체에 fill(0)을 호출하는 구조적 실수를 지우고,
    // 오디오 다차원 채널 안쪽의 개별 Float32Array 알맹이 버퍼 레벨에 각각 정밀하게 음소거를 주입합니다.
    if (!outputLeft || !outputRight) return true;
    const numFrames = outputLeft.length; 

    if (!this.isPlaying || this.queue.length === 0) {
      outputLeft.fill(0); 
      outputRight.fill(0);
      return true;
    }

    let framesCopied = 0;
    while (framesCopied < numFrames && this.queue.length > 0) {
      const currentChunk = this.queue[0];
      const chunkLeft = currentChunk.channels[0];
      const chunkRight = currentChunk.channels[1];
      const chunkLength = currentChunk.length;

      const availableInChunk = chunkLength - this.readOffset;
      const neededFrames = numFrames - framesCopied;
      const toCopy = Math.min(availableInChunk, neededFrames);

      for (let i = 0; i < toCopy; i++) {
        outputLeft[framesCopied + i] = chunkLeft[this.readOffset + i];
        outputRight[framesCopied + i] = chunkRight[this.readOffset + i];
      }

      this.readOffset += toCopy;
      framesCopied += toCopy;
      this.totalRead += toCopy;

      const currentBpm = this.basicTempo || 120;
      const currentBeat = this.tickBeat || 24;
      const currentRate = this.sampleRate || 44100;

      const ticksPerSec = (currentBpm * currentBeat) / 60;
      const ticksPerSample = ticksPerSec / currentRate;
      
      if (!isNaN(ticksPerSample)) {
        this.accumulatedTick += toCopy * ticksPerSample;
      }

      if (this.readOffset >= chunkLength) {
        this.port.postMessage({ 
          type: 'recycle', 
          channels: currentChunk.channels,
          currentRealTick: this.accumulatedTick
        }, [
          currentChunk.channels[0].buffer,
          currentChunk.channels[1].buffer
        ]);
        this.queue.shift(); 
        this.readOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-queue-processor', AudioQueueProcessor);
