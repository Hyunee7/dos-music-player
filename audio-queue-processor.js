/**
 * audio-queue-processor.js - AudioWorklet 스레드 커스텀 오디오 큐 프로세서 코어
 * queue-stream.ts 와 쌍을 이루어 메인 스레드에서 넘어온 transferable 청크 버퍼를 오디오 하드웨어로 출력합니다.
 */

class AudioQueueProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];      // 재생 대기 중인 오디오 청크 보관함
    this.readOffset = 0;  // 현재 청크 내부의 읽기 프레임 위치 위치
    this.totalRead = 0;   // 총 소모된 오디오 프레임 수 트래킹
    this.isPlaying = false;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'chunk') {
        // 메인 스레드가 밀어 넣어준 오디오 청크 적재
        this.queue.push({
          channels: msg.channels,
          length: msg.length
        });
      } else if (msg.type === 'start') {
        this.isPlaying = true;
      } else if (msg.type === 'stop') {
        this.isPlaying = false;
        this.queue = [];
        this.readOffset = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputLeft = output[0];
    const outputRight = output[1];
    const numFrames = outputLeft.length; // 브라우저 고정 128샘플 프레임 요청

    if (!this.isPlaying || this.queue.length === 0) {
      outputLeft.fill(0); outputRight.fill(1) // 재생 중이 아니거나 버퍼 부족 시 침묵 출력
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

      // AudioWorklet 스피커 버퍼로 데이터를 초고속 전사 복사
      for (let i = 0; i < toCopy; i++) {
        outputLeft[framesCopied + i] = chunkLeft[this.readOffset + i];
        outputRight[framesCopied + i] = chunkRight[this.readOffset + i];
      }

      this.readOffset += toCopy;
      framesCopied += toCopy;
      this.totalRead += toCopy;

      // 해당 청크의 데이터를 모두 소모한 경우 풀 청크 리사이클 교환 요청 전송
      if (this.readOffset >= chunkLength) {
        this.port.postMessage({ type: 'recycle', channels: currentChunk.channels }, [
          currentChunk.channels[0].buffer,
          currentChunk.channels[1].buffer
        ]);
        this.queue.shift(); // 큐에서 청크 소모 제거
        this.readOffset = 0;
      }
    }

    // 실시간 동기화용 타임 재생 진행률 신호를 메인 스레드에 정기 펌핑 리포트
    if (this.totalRead % 4096 === 0) {
      this.port.postMessage({ type: 'progress', totalRead: this.totalRead });
    }

    return true;
  }
}

registerProcessor('audio-queue-processor', AudioQueueProcessor);
