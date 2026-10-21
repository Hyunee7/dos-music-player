/**
 * audio-queue-processor.js - 부팅 시그널 피드백이 장착된 하드웨어 가속 프로세서 완결본
 */

class AudioQueueProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];      // 재생 대기 중인 오디오 청크 보관함
    this.readOffset = 0;  // 현재 청크 내부의 읽기 프레임 위치
    this.totalRead = 0;   // 총 소모된 오디오 프레임 수
    this.isPlaying = false;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'chunk') {
        this.queue.push({
          channels: msg.channels,
          length: msg.length
        });
      } else if (msg.type === 'start') {
        this.isPlaying = true;
        // [멈춤 현상 해결 핵심 1] 노드가 확실하게 부팅되어 재생 상태로 진입했음을 
        // 메인 스레드에 즉시 알려 첫 청크 적재 타이밍의 꼬임을 원천 차단합니다.
        this.port.postMessage({ type: 'ready_for_feed' });
      } else if (msg.type === 'stop') {
        this.isPlaying = false;
        this.queue = [];
        this.readOffset = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]; 
    if (!output || output.length === 0) return true;
    
    const outputLeft = output[0];
    const outputRight = output[1];
    
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

      if (this.readOffset >= chunkLength) {
        this.port.postMessage({ type: 'recycle', channels: currentChunk.channels }, [
          currentChunk.channels[0].buffer,
          currentChunk.channels[1].buffer
        ]);
        this.queue.shift(); 
        this.readOffset = 0;
      }
    }

    if (this.totalRead % 4096 === 0) {
      this.port.postMessage({ type: 'progress', totalRead: this.totalRead });
    }

    return true;
  }
}

registerProcessor('audio-queue-processor', AudioQueueProcessor);
