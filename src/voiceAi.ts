type AssistantStatus = 'idle' | 'connecting' | 'active' | 'listening' | 'user-speaking' | 'speaking' | 'error';

type VoiceAiCallbacks = {
  onUserText?: (text: string) => void;
  onAssistantText?: (text: string) => void;
  onStopIntent?: () => number | void;
  onGreetingDone?: () => void;
  onResponseDone?: () => void;
  getToolDeclarations?: () => unknown[];
  onToolCall?: (name: string, args: Record<string, any>) => Promise<Record<string, any> | void> | Record<string, any> | void;
  silenceThreshold?: number;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
    GEMINI_LIVE_MODEL?: string;
  };
};

const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
const FALLBACK_MODELS = [
  'gemini-2.5-flash-preview-native-audio-dialog',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
];
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_BUFFER_SIZE = 1024;
const INPUT_CHUNK_MS = 100;
const INPUT_CHUNK_SAMPLES = Math.round(INPUT_SAMPLE_RATE * (INPUT_CHUNK_MS / 1000));
const MIN_OUTPUT_CHUNKS = 2;
const MAX_RECONNECTS = 3;
const RESPONSE_TIMEOUT_MS = 15000;
const MAX_AUDIO_QUEUE_SEC = 2.5;
const OUTPUT_START_LEAD_SEC = 0.05;
const SPEECH_RMS_THRESHOLD = 0.006;
const DEFAULT_SILENCE_THRESHOLD = 0.0085;
const BARGE_IN_RMS_THRESHOLD = 0.028;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 's',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
  ў: 'o',
};

const cleanUzbekText = (text: string) => text
  .toLowerCase()
  .replace(/[а-яёқғҳўъь]/gi, char => CYRILLIC_TO_LATIN[char.toLowerCase()] ?? '')
  .replace(/[‘’`´ʻʼ]/g, "'")
  .replace(/g'/g, 'g')
  .replace(/o'/g, 'o')
  .replace(/\b(one|two|three|four|five|six|seven|eight|nine|zero|ten)\b/g, ' ')
  .replace(/[^a-z0-9\s']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getRms = (input: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
  return Math.sqrt(sum / Math.max(1, input.length));
};

const downsampleAudio = (input: Float32Array, inputRate: number) => {
  if (inputRate === INPUT_SAMPLE_RATE) return input;

  const ratio = inputRate / INPUT_SAMPLE_RATE;
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < output.length; i += 1) {
    const sourceIndex = Math.min(input.length - 1, Math.floor(i * ratio));
    output[i] = input[sourceIndex] || 0;
  }
  return output;
};

const prepareAudio = (input: Float32Array, inputRate: number) => {
  const audio = downsampleAudio(input, inputRate);
  const rms = getRms(audio);
  if (rms < 0.002 || rms > 0.06) return audio;

  const gain = Math.min(2.6, Math.max(1, 0.03 / rms));
  if (gain <= 1.05) return audio;

  const boosted = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i += 1) boosted[i] = Math.max(-1, Math.min(1, audio[i] * gain));
  return boosted;
};

const pcm16ToBase64 = (input: Float32Array) => {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  let binary = '';
  const batchSize = 0x8000;
  for (let i = 0; i < bytes.length; i += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + batchSize));
  }
  return btoa(binary);
};

const base64ToPcm16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  const pcm = new Int16Array(bytes.length / 2);
  for (let i = 0; i < pcm.length; i += 1) pcm[i] = view.getInt16(i * 2, true);
  return pcm;
};

const readPath = (input: any, paths: string[][]) => {
  for (const path of paths) {
    let value = input;
    for (const key of path) value = value?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

export class VoiceAiAssistant {
  private apiKey: string;
  private model: string;
  private modelCandidates: string[] = [];
  private modelIndex = 0;
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private inputGainNode: GainNode | null = null;
  private muteNode: GainNode | null = null;
  private micBuffer: number[] = [];
  private audioQueue: AudioBuffer[] = [];
  private activeSources: AudioBufferSourceNode[] = [];
  private scheduledAudioTime = 0;
  private startId = 0;
  private isActive = false;
  private isConnecting = false;
  private manualStop = false;
  private setupComplete = false;
  private reconnectAttempts = 0;
  private responseTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private delayedStopTimer: number | null = null;
  private microphonePromise: Promise<void> | null = null;
  private queueStartTimer: number | null = null;
  private visualizerInterval: number | null = null;
  private lastUserTranscript = '';
  private lastAiText = '';
  private lastAiCleanText = '';
  private lastStateAt = 0;
  private greeted = false;
  private awaitingGreeting = false;
  private greetingTurnComplete = false;
  private playbackToken = 0;
  private currentContext = '';
  private silenceCounter = 0;
  private closeAfterFarewell = false;
  private farewellAudioStarted = false;
  private closeAfterFarewellTimer: number | null = null;
  private recognition: BrowserSpeechRecognition | null = null;
  private recognitionRestartTimer: number | null = null;
  private localSpeechUtterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private onStatusChange: (status: AssistantStatus) => void,
    private onVoiceCommand?: (text: string) => boolean,
    private callbacks: VoiceAiCallbacks = {},
    apiKey = process.env.GEMINI_API_KEY || '',
  ) {
    this.apiKey = apiKey;
    this.model = this.cleanModelName(process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL);
    this.modelCandidates = Array.from(new Set([this.model, ...FALLBACK_MODELS.map(model => this.cleanModelName(model))]));
  }

  get active() {
    return this.isActive;
  }

  toggle(context: string) {
    if (this.isActive || this.isConnecting) this.stop();
    else void this.start(context);
  }

  sendTextInstruction(text: string) {
    if (!this.isActive) return;
    if (!this.setupComplete || this.ws?.readyState !== WebSocket.OPEN) {
      this.updateTranscript('Gemini Live hali ulanmagan. Lokal zaxira ovoz ishlayapti.');
      this.speakLocal(this.extractSpeakableText(text), () => this.callbacks.onResponseDone?.());
      return;
    }
    this.sendJson({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{text}],
        }],
        turnComplete: true,
      },
    });
    this.armResponseTimer();
  }

  async start(context: string) {
    if (this.isActive) return;
    if (this.isConnecting) this.resetRuntimeState(true);

    const startId = ++this.startId;
    this.resetRuntimeState(true);
    this.currentContext = context;
    this.isActive = true;
    this.isConnecting = true;
    this.manualStop = false;
    this.setupComplete = false;
    this.reconnectAttempts = 0;
    this.modelIndex = 0;
    this.greeted = false;
    this.awaitingGreeting = false;
    this.greetingTurnComplete = false;
    this.closeAfterFarewell = false;
    this.farewellAudioStarted = false;
    if (this.closeAfterFarewellTimer) window.clearTimeout(this.closeAfterFarewellTimer);
    this.closeAfterFarewellTimer = null;
    if (this.delayedStopTimer) window.clearTimeout(this.delayedStopTimer);
    this.delayedStopTimer = null;
    this.playbackToken += 1;
    this.lastUserTranscript = '';
    this.lastAiText = '';
    this.lastAiCleanText = '';
    this.micBuffer = [];
    this.microphonePromise = null;

    this.setLiveState('connecting', 'Assalomu aleykum...');
    this.updateTranscript('Qo\'ng\'iroq ochilmoqda...');
    this.startVisualizer();

    if (!this.apiKey) {
      this.updateTranscript('Gemini API key topilmadi. Lokal ovozli boshqaruv ishlayapti.');
      this.isConnecting = false;
      this.setupComplete = false;
      this.sendLocalGreeting();
      await this.prepareMicrophone(startId);
      this.startBrowserRecognition();
      return;
    }

    try {
      this.outputContext = new AudioContext({sampleRate: OUTPUT_SAMPLE_RATE, latencyHint: 'interactive'});
      this.inputContext = new AudioContext({latencyHint: 'interactive'});
      await Promise.all([this.outputContext.resume(), this.inputContext.resume()]);

      if (!this.isActive || startId !== this.startId) return;
      this.microphonePromise = this.prepareMicrophone(startId);
      this.startBrowserRecognition();
      this.connectSocket(startId);
    } catch (error) {
      if (!this.isActive || startId !== this.startId) return;
      console.error('Gemini Live start error:', error);
      this.updateTranscript(error instanceof Error ? this.limit(error.message) : 'Gemini Live ulanmagan. Lokal boshqaruv ishlayapti.');
      this.isConnecting = false;
      await this.prepareMicrophone(startId);
      this.startBrowserRecognition();
    }
  }

  stop() {
    this.manualStop = true;
    this.startId += 1;
    this.isActive = false;
    this.isConnecting = false;
    this.setupComplete = false;
    this.awaitingGreeting = false;
    this.greetingTurnComplete = false;
    this.closeAfterFarewell = false;
    this.farewellAudioStarted = false;
    if (this.closeAfterFarewellTimer) window.clearTimeout(this.closeAfterFarewellTimer);
    this.closeAfterFarewellTimer = null;
    if (this.delayedStopTimer) window.clearTimeout(this.delayedStopTimer);
    this.delayedStopTimer = null;
    this.resetRuntimeState(true);
    this.microphonePromise = null;
    this.stopBrowserRecognition();
    this.stopLocalSpeech();
    this.stopVisualizer();
    this.onStatusChange('idle');
    this.setLiveState('idle', 'System Ready');
    this.updateTranscript('Hali nutq aniqlanmadi.');
  }

  private connectSocket(startId: number) {
    if (!this.isActive || startId !== this.startId) return;

    this.closeSocket();
    this.setupComplete = false;
    this.isConnecting = true;
    this.setLiveState('connecting', this.reconnectAttempts ? 'Qayta ulanmoqda...' : 'Gemini Live ulanmoqda...');

    const url = `${LIVE_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (!this.isActive || startId !== this.startId || this.ws !== ws) return;
      const toolDeclarations = this.callbacks.getToolDeclarations?.() || [];
      const setup: Record<string, any> = {
          model: this.modelPath(),
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {voiceName: 'Aoede'},
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
            turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
              endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
              prefixPaddingMs: 0,
              silenceDurationMs: 25,
            },
          },
          systemInstruction: {
            parts: [{text: this.buildSystemInstruction()}],
          },
        };
      if (toolDeclarations.length) setup.tools = [{functionDeclarations: toolDeclarations}];
      this.sendJson({setup});
    };

    ws.onmessage = event => {
      if (!this.isActive || startId !== this.startId || this.ws !== ws) return;
      void this.handleSocketMessage(event.data);
    };

    ws.onerror = event => {
      console.error('Gemini Live WebSocket error:', event);
      if (!this.isActive || startId !== this.startId || this.ws !== ws) return;
      this.updateTranscript('WebSocket xatoligi. Qayta ulanmoqda...');
    };

    ws.onclose = event => {
      if (!this.isActive || this.manualStop || startId !== this.startId || this.ws !== ws) return;
      console.warn('Gemini Live WebSocket closed:', event.code, event.reason);
      if (!this.setupComplete && this.tryFallbackModel(event.reason || `WebSocket yopildi: ${event.code}`)) return;
      this.setupComplete = false;
      this.stopMicrophoneStream(false);
      this.reconnect(startId, event.reason || 'Ulanish uzildi.');
    };
  }

  private async handleSocketMessage(raw: string | ArrayBuffer | Blob) {
    let text = '';

    if (typeof raw === 'string') text = raw;
    else if (raw instanceof Blob) text = await raw.text();
    else if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(raw);
    if (!text) return;

    let message: any;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }

    const error = message.error || message.errorMessage;
    if (error) {
      const text = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      if (!this.setupComplete && this.tryFallbackModel(text)) return;
      this.showError(this.limit(text));
      return;
    }

    if (message.setupComplete || message.setup_complete) {
      this.setupComplete = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.setLiveState('speaking', 'Gemini salomlashmoqda...');
      this.updateTranscript('Gemini Live ulandi. Salomlashuv yuborildi.');
      this.sendGreeting();
      return;
    }

    const toolCall = message.toolCall || message.tool_call;
    if (toolCall) {
      await this.handleToolCall(toolCall);
      return;
    }

    const serverContent = message.serverContent || message.server_content;
    if (!serverContent) return;

    if (serverContent.interrupted) {
      this.stopQueuedAudio();
      if (this.awaitingGreeting) this.finishGreeting();
      else this.setLiveState('listening', 'Tinglayapman...');
    }

    const inputText = readPath(serverContent, [
      ['inputTranscription', 'text'],
      ['input_transcription', 'text'],
    ]);
    if (inputText) this.handleUserTranscript(String(inputText));

    const outputText = readPath(serverContent, [
      ['outputTranscription', 'text'],
      ['output_transcription', 'text'],
    ]);
    if (outputText) this.handleAiTranscript(String(outputText));

    const parts = readPath(serverContent, [
      ['modelTurn', 'parts'],
      ['model_turn', 'parts'],
    ]) || [];

    for (const part of parts) {
      const inlineData = part.inlineData || part.inline_data;
      const audioData = inlineData?.data || part.data;
      if (!audioData) continue;
      this.clearResponseTimer();
      this.setLiveState('speaking', 'AI gapiryapti...');
      this.enqueueAudio(String(audioData));
    }

    if (serverContent.turnComplete || serverContent.turn_complete) {
      this.clearResponseTimer();
      if (this.awaitingGreeting) {
      this.greetingTurnComplete = true;
        if (!this.hasPendingAudio()) this.finishGreeting();
        return;
      }
      if (this.isActive && !this.hasPendingAudio()) {
        if (this.closeAfterFarewell) {
          if (this.farewellAudioStarted) this.scheduleStop(350);
          return;
        }
        this.setLiveState('listening', 'Tinglayapman...');
        this.callbacks.onResponseDone?.();
      }
    }
  }

  private async handleToolCall(toolCall: any) {
    const calls = toolCall.functionCalls || toolCall.function_calls || [];
    const responses = [];

    for (const call of calls) {
      const name = call.name;
      if (!name) continue;
      const args = call.args || {};
      let response: Record<string, any> = {result: 'ok'};

      try {
        response = {
          ...response,
          ...((await this.callbacks.onToolCall?.(name, args)) || {}),
        };
      } catch (error) {
        response = {
          result: 'error',
          error: error instanceof Error ? error.message : 'Tool bajarilmadi',
        };
      }

      responses.push({
        id: call.id,
        name,
        response,
      });
    }

    if (!responses.length) return;
    this.sendJson({
      toolResponse: {
        functionResponses: responses,
      },
    });
  }

  private async startMicrophoneStream() {
    if (!this.inputContext || !this.mediaStream || this.processorNode || this.workletNode || !this.setupComplete) return;

    this.sourceNode = this.inputContext.createMediaStreamSource(this.mediaStream);
    this.compressorNode = this.inputContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -20;
    this.compressorNode.knee.value = 0;
    this.compressorNode.ratio.value = 20;
    this.compressorNode.attack.value = 0.001;
    this.compressorNode.release.value = 0.1;

    this.inputGainNode = this.inputContext.createGain();
    this.inputGainNode.gain.value = 1;
    this.processorNode = this.inputContext.createScriptProcessor(INPUT_BUFFER_SIZE, 1, 1);
    this.muteNode = this.inputContext.createGain();
    this.muteNode.gain.value = 0;

    try {
      await this.inputContext.audioWorklet.addModule('/worklets/pcm-processor.js');
      if (!this.isActive || !this.setupComplete || !this.inputContext || !this.mediaStream || !this.sourceNode) return;
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
      this.workletNode = new AudioWorkletNode(this.inputContext, 'pcm-processor');
      this.workletNode.port.onmessage = event => {
        if (!this.inputContext) return;
        this.handleInputSamples(event.data as Float32Array, this.inputContext.sampleRate);
      };

      this.sourceNode.connect(this.compressorNode);
      this.compressorNode.connect(this.inputGainNode);
      this.inputGainNode.connect(this.workletNode);
      this.workletNode.connect(this.muteNode);
      this.muteNode.connect(this.inputContext.destination);
      return;
    } catch (error) {
      console.warn('AudioWorklet unavailable, falling back to ScriptProcessor:', error);
    }

    this.processorNode.onaudioprocess = event => {
      if (!this.inputContext) return;
      this.handleInputSamples(event.inputBuffer.getChannelData(0), this.inputContext.sampleRate);
    };

    this.sourceNode.connect(this.compressorNode);
    this.compressorNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.processorNode);
    this.processorNode.connect(this.muteNode);
    this.muteNode.connect(this.inputContext.destination);
  }

  private handleInputSamples(samples: Float32Array, sampleRate: number) {
    if (!this.isActive || !this.setupComplete || this.ws?.readyState !== WebSocket.OPEN) return;

    const rawRms = getRms(downsampleAudio(samples, sampleRate));
    const prepared = prepareAudio(samples, sampleRate);
    const rms = getRms(prepared);

    if (this.isAudioPlaying()) {
      if (rawRms < BARGE_IN_RMS_THRESHOLD) return;
      this.stopQueuedAudio();
      this.setLiveState('user-speaking', 'Siz gapiryapsiz...');
    }

    const silenceThreshold = this.callbacks.silenceThreshold ?? DEFAULT_SILENCE_THRESHOLD;
    if (rms < silenceThreshold) {
      this.silenceCounter += 1;
      if (this.silenceCounter > 2) return;
    } else {
      this.silenceCounter = 0;
    }

    const now = performance.now();
    if (rms > SPEECH_RMS_THRESHOLD && now - this.lastStateAt > 40) {
      this.lastStateAt = now;
      this.setLiveState('user-speaking', 'Siz gapiryapsiz...');
    }

    for (let i = 0; i < prepared.length; i += 1) this.micBuffer.push(prepared[i]);
    while (this.micBuffer.length >= INPUT_CHUNK_SAMPLES) {
      const chunk = Float32Array.from(this.micBuffer.splice(0, INPUT_CHUNK_SAMPLES));
      this.sendAudioChunk(chunk, rms > silenceThreshold);
    }
  }

  private async prepareMicrophone(startId: number) {
    try {
      this.mediaStream = await this.requestMicrophoneStream();

      if (!this.isActive || startId !== this.startId) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    } catch (error) {
      if (!this.isActive || startId !== this.startId) return;
      console.error('Gemini Live microphone error:', error);
      this.showError(error instanceof Error ? this.limit(error.message) : 'Mikrofon ruxsatida xatolik.');
    }
  }

  private async requestMicrophoneStream() {
    const preferred: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    };

    try {
      return await navigator.mediaDevices.getUserMedia(preferred);
    } catch (error) {
      console.warn('Preferred microphone constraints failed, retrying with basic audio:', error);
      return navigator.mediaDevices.getUserMedia({audio: true});
    }
  }

  private stopMicrophoneStream(stopTracks: boolean) {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.compressorNode?.disconnect();
    this.inputGainNode?.disconnect();
    this.muteNode?.disconnect();
    this.sourceNode?.disconnect();
    this.workletNode = null;
    this.compressorNode = null;
    this.inputGainNode = null;
    this.muteNode = null;
    this.sourceNode = null;
    this.micBuffer = [];
    this.silenceCounter = 0;

    if (stopTracks) {
      this.mediaStream?.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
      void this.inputContext?.close();
      this.inputContext = null;
    }
  }

  private sendAudioChunk(chunk: Float32Array, hasSpeech: boolean) {
    this.sendJson({
      realtimeInput: {
        mediaChunks: [{
          mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          data: pcm16ToBase64(chunk),
        }],
      },
    });

    if (hasSpeech) this.armResponseTimer();
  }

  private enqueueAudio(base64Audio: string) {
    if (!this.outputContext) return;
    void this.outputContext.resume();

    const pcm = base64ToPcm16(base64Audio);
    const audioBuffer = this.outputContext.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 0x8000;

    this.audioQueue.push(audioBuffer);
    if (this.closeAfterFarewell) this.farewellAudioStarted = true;
    this.trimAudioQueue();

    if (this.audioQueue.length >= MIN_OUTPUT_CHUNKS) this.playNextAudio();
    else if (!this.queueStartTimer) this.queueStartTimer = window.setTimeout(() => this.playNextAudio(), 30);
  }

  private playNextAudio() {
    if (!this.outputContext || this.audioQueue.length === 0) return;
    if (this.queueStartTimer) {
      window.clearTimeout(this.queueStartTimer);
      this.queueStartTimer = null;
    }

    const token = this.playbackToken;
    const now = this.outputContext.currentTime;
    if (this.scheduledAudioTime < now + OUTPUT_START_LEAD_SEC) {
      this.scheduledAudioTime = now + OUTPUT_START_LEAD_SEC;
    }

    while (this.audioQueue.length > 0) {
      const audioBuffer = this.audioQueue.shift();
      if (!audioBuffer) return;

      const source = this.outputContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputContext.destination);
      this.activeSources.push(source);

      source.onended = () => {
        if (token !== this.playbackToken) return;
        this.activeSources = this.activeSources.filter(item => item !== source);
        if (this.hasPendingAudio()) return;
        if (this.awaitingGreeting && this.greetingTurnComplete) this.finishGreeting();
        else if (this.closeAfterFarewell) this.scheduleStop(350);
        else if (this.isActive) {
          this.setLiveState('listening', 'Tinglayapman...');
          this.callbacks.onResponseDone?.();
        }
      };

      source.start(this.scheduledAudioTime);
      this.scheduledAudioTime += audioBuffer.duration;
    }
  }

  private trimAudioQueue() {
    const scheduledBacklog = Math.max(0, this.scheduledAudioTime - (this.outputContext?.currentTime || 0));
    let total = scheduledBacklog;
    for (const buffer of this.audioQueue) total += buffer.duration;
    while (total > MAX_AUDIO_QUEUE_SEC && this.audioQueue.length > MIN_OUTPUT_CHUNKS) {
      const removed = this.audioQueue.shift();
      total -= removed?.duration || 0;
    }
  }

  private stopQueuedAudio() {
    if (this.queueStartTimer) window.clearTimeout(this.queueStartTimer);
    this.queueStartTimer = null;
    this.playbackToken += 1;
    this.audioQueue = [];
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch {
        // Source may already be stopped by the browser.
      }
    });
    this.activeSources = [];
    this.scheduledAudioTime = this.outputContext?.currentTime || 0;
  }

  private stopAudio() {
    this.stopQueuedAudio();
    void this.outputContext?.close();
    this.outputContext = null;
  }

  private sendGreeting() {
    if (this.greeted) return;
    this.greeted = true;
    this.awaitingGreeting = true;
    this.greetingTurnComplete = false;
    const greeting = 'Assalomu aleykum, men Oqqush Beton kompaniyasining virtual agentiman. Qanday yordam bera olaman?';
    this.updateSubText(greeting);
    if (this.setupComplete && this.ws?.readyState === WebSocket.OPEN) {
      this.sendJson({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{
              text: `Birinchi javob sifatida aynan shu gapni audio qilib ayt, boshqa hech narsa qo'shma: "${greeting}"`,
            }],
          }],
          turnComplete: true,
        },
      });
      this.armResponseTimer();
      window.setTimeout(() => {
        if (this.isActive && this.awaitingGreeting && !this.hasPendingAudio()) this.finishGreeting();
      }, 4200);
      return;
    }

    this.sendLocalGreeting();
  }

  private sendLocalGreeting() {
    if (this.greeted && !this.awaitingGreeting) return;
    this.greeted = true;
    this.awaitingGreeting = true;
    this.greetingTurnComplete = false;
    const greeting = 'Assalomu aleykum, men Oqqush Beton kompaniyasining virtual agentiman. Qanday yordam bera olaman?';
    this.updateSubText(greeting);
    this.speakLocal(greeting, () => this.finishGreeting());
    window.setTimeout(() => {
      if (this.isActive && this.awaitingGreeting) this.finishGreeting();
    }, 1600);
  }

  private finishGreeting() {
    if (!this.awaitingGreeting) return;
    this.awaitingGreeting = false;
    this.greetingTurnComplete = false;
    this.clearResponseTimer();
    this.setLiveState('listening', 'Tinglayapman...');
    this.updateTranscript('Endi gapiring, men eshityapman.');
    this.callbacks.onGreetingDone?.();
    if (this.mediaStream) this.startMicrophoneStream();
    else {
      this.updateTranscript('Mikrofon tayyorlanmoqda...');
      void this.microphonePromise?.then(() => {
        if (this.isActive && this.setupComplete) {
          this.updateTranscript('Endi gapiring, men eshityapman.');
          this.startMicrophoneStream();
        }
      });
    }
  }

  private sendJson(payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private reconnect(startId: number, reason: string) {
    if (!this.isActive || this.manualStop || startId !== this.startId) return;

    if (this.reconnectAttempts >= MAX_RECONNECTS) {
      this.showError(`Gemini Live ulanmayapti: ${this.limit(reason)}`);
      return;
    }

    this.reconnectAttempts += 1;
    this.clearResponseTimer();
    const delay = 450 * this.reconnectAttempts;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isActive && !this.manualStop && startId === this.startId) this.connectSocket(startId);
    }, delay);
  }

  private cleanModelName(model: string) {
    return model.replace(/^models\//, '').trim();
  }

  private modelPath() {
    const model = this.modelCandidates[this.modelIndex] || this.model || DEFAULT_MODEL;
    return `models/${this.cleanModelName(model)}`;
  }

  private tryFallbackModel(reason: string) {
    if (this.modelIndex >= this.modelCandidates.length - 1) return false;
    this.modelIndex += 1;
    this.clearResponseTimer();
    this.setupComplete = false;
    this.stopMicrophoneStream(false);
    this.stopQueuedAudio();
    this.updateTranscript(`Live modeli almashtirilmoqda: ${this.modelCandidates[this.modelIndex]}`);
    this.closeSocket();
    window.setTimeout(() => {
      if (this.isActive && !this.manualStop) this.connectSocket(this.startId);
    }, 250);
    console.warn('Gemini Live model fallback:', reason, '->', this.modelCandidates[this.modelIndex]);
    return true;
  }

  private armResponseTimer() {
    this.clearResponseTimer();
    this.responseTimer = window.setTimeout(() => {
      if (!this.isActive || this.manualStop) return;
      this.updateTranscript('Javob kechikyapti. Live qayta ulanmoqda...');
      this.stopQueuedAudio();
      this.setupComplete = false;
      this.awaitingGreeting = false;
      this.greetingTurnComplete = false;
      this.stopMicrophoneStream(false);
      this.reconnect(this.startId, 'Javob vaqtida kelmadi.');
      this.closeSocket();
    }, RESPONSE_TIMEOUT_MS);
  }

  private clearResponseTimer() {
    if (this.responseTimer) window.clearTimeout(this.responseTimer);
    this.responseTimer = null;
  }

  private resetRuntimeState(closeContexts: boolean) {
    this.clearResponseTimer();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.queueStartTimer) window.clearTimeout(this.queueStartTimer);
    this.queueStartTimer = null;
    if (this.delayedStopTimer) window.clearTimeout(this.delayedStopTimer);
    this.delayedStopTimer = null;
    this.closeSocket();
    this.stopBrowserRecognition();
    this.stopLocalSpeech();
    this.stopMicrophoneStream(closeContexts);
    this.stopAudio();
    this.audioQueue = [];
    this.activeSources = [];
    this.micBuffer = [];
    this.scheduledAudioTime = 0;
    this.setupComplete = false;
  }

  private scheduleStop(delay: number) {
    if (this.delayedStopTimer) window.clearTimeout(this.delayedStopTimer);
    this.delayedStopTimer = window.setTimeout(() => {
      this.delayedStopTimer = null;
      if (this.isActive) this.stop();
    }, delay);
  }

  private closeSocket() {
    const socket = this.ws;
    this.ws = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  }

  private startBrowserRecognition() {
    if (this.recognition || !this.isActive) return;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.updateTranscript('Brauzer speech recognition qo\'llamaydi. Gemini transcript kutilmoqda.');
      return;
    }

    const recognition = new SpeechRecognitionCtor() as BrowserSpeechRecognition;
    recognition.lang = 'uz-UZ';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 2;
    recognition.onresult = event => {
      const results = Array.from(event.results || []) as any[];
      const latest = results[results.length - 1];
      const transcript = latest?.[0]?.transcript;
      if (transcript) this.handleUserTranscript(String(transcript));
    };
    recognition.onerror = () => {
      this.updateStateLabel(this.isActive ? 'listening' : 'idle');
    };
    recognition.onend = () => {
      this.recognition = null;
      if (!this.isActive || this.manualStop) return;
      if (this.recognitionRestartTimer) window.clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = window.setTimeout(() => {
        this.recognitionRestartTimer = null;
        this.startBrowserRecognition();
      }, 250);
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch {
      this.recognition = null;
    }
  }

  private stopBrowserRecognition() {
    if (this.recognitionRestartTimer) window.clearTimeout(this.recognitionRestartTimer);
    this.recognitionRestartTimer = null;
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.abort?.();
      recognition.stop();
    } catch {
      // Browser recognition may already be stopped.
    }
  }

  private handleUserTranscript(rawText: string) {
    const text = cleanUzbekText(rawText);
    if (!text || text === this.lastUserTranscript) return;
    this.lastUserTranscript = text;
    this.updateTranscript(this.limit(text));

    if (this.hasStopIntent(text)) {
      this.requestGracefulStop();
      return;
    }

    if (this.isAudioPlaying()) this.stopQueuedAudio();

    if (this.onVoiceCommand?.(text)) {
      this.setLiveState('listening', 'Bo\'lim ochildi. Tinglayapman...');
    }
    this.callbacks.onUserText?.(text);
  }

  private handleAiTranscript(rawText: string) {
    const text = rawText.trim();
    if (!text || text === this.lastAiText) return;
    this.lastAiText = text;
    this.updateSubText(this.limit(text));
    if (this.awaitingGreeting) return;

    const clean = cleanUzbekText(text) || text.toLowerCase();
    const previous = this.lastAiCleanText;
    this.lastAiCleanText = clean;

    const panelMatch = text.match(/^PANEL:\s*(.+)/i);
    if (panelMatch) {
      this.callbacks.onAssistantText?.(clean);
      return;
    }

    const delta = previous && clean.startsWith(previous)
      ? clean.slice(previous.length).trim()
      : clean;
    if (delta) this.callbacks.onAssistantText?.(delta);
  }

  private hasStopIntent(text: string) {
    return [
      'toxta',
      'toxtat',
      'toxtang',
      'bas',
      'yetarli',
      'boldi',
      'bo ldi',
      'rahmat',
      'raxmat',
      'yop',
      'ochir',
    ].some(phrase => text.includes(phrase));
  }

  private requestGracefulStop() {
    if (this.closeAfterFarewell) return;
    this.closeAfterFarewell = true;
    const farewellDelay = Math.max(0, this.callbacks.onStopIntent?.() || 0);
    this.clearResponseTimer();
    this.stopQueuedAudio();
    this.stopMicrophoneStream(false);
    this.setLiveState('speaking', 'Yopilmoqda...');
    this.updateSubText('Hop, yana savollaringiz bo\'lsa men shu yerdaman.');

    window.setTimeout(() => {
      if (!this.isActive || !this.closeAfterFarewell) return;
      this.speakLocal('Hop, yana savollaringiz bo\'lsa men shu yerdaman.', () => this.scheduleStop(250));
    }, farewellDelay);
    this.closeAfterFarewellTimer = window.setTimeout(() => {
      if (this.isActive && this.closeAfterFarewell) this.stop();
    }, 5000 + farewellDelay);
  }

  private hasPendingAudio() {
    return this.audioQueue.length > 0 || this.isAudioPlaying();
  }

  private isAudioPlaying() {
    return this.activeSources.length > 0 || (this.outputContext ? this.scheduledAudioTime > this.outputContext.currentTime + 0.02 : false);
  }

  private speakLocal(text: string, onDone?: () => void) {
    const clean = this.extractSpeakableText(text);
    if (!clean) {
      onDone?.();
      return;
    }
    this.stopQueuedAudio();
    this.setLiveState('speaking', 'AI gapiryapti...');
    this.updateSubText(this.limit(clean));

    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      window.setTimeout(() => {
        if (this.isActive) this.setLiveState('listening', 'Tinglayapman...');
        onDone?.();
      }, Math.min(2500, Math.max(800, clean.length * 45)));
      return;
    }

    this.stopLocalSpeech();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'uz-UZ';
    utterance.rate = 1.05;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    utterance.onend = () => {
      if (this.localSpeechUtterance !== utterance) return;
      this.localSpeechUtterance = null;
      if (this.isActive && !this.closeAfterFarewell) this.setLiveState('listening', 'Tinglayapman...');
      onDone?.();
    };
    utterance.onerror = () => {
      if (this.localSpeechUtterance === utterance) this.localSpeechUtterance = null;
      if (this.isActive && !this.closeAfterFarewell) this.setLiveState('listening', 'Tinglayapman...');
      onDone?.();
    };
    this.localSpeechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  private stopLocalSpeech() {
    this.localSpeechUtterance = null;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Speech synthesis may be unavailable in some browsers.
      }
    }
  }

  private extractSpeakableText(text: string) {
    return text
      .replace(/^[\s\S]*?(PANEL:\s*)/i, '$1')
      .replace(/Aynan shu gapni ayting va boshqa hech narsa qo'shmang:\s*/i, '')
      .replace(/Faqat quyidagi sayt paneli ma'lumotini o'qing[\s\S]*?\n\n/i, '')
      .replace(/Faqat quyidagi Oqqush Beton sayt panel ma'lumotlarini o'qing[\s\S]*?\n\n/i, '')
      .replace(/\bMA'LUMOT\s+\d+:\s*/gi, '')
      .replace(/^\d+\.\s*/gm, '')
      .replace(/\[CMD:[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);
  }

  private buildSystemInstruction() {
    return `Siz Oqqush Beton kompaniyasining ovozli virtual yordamchisisiz.

QOIDA 1 — FAQAT FUNCTION CHAQIRISH:
Foydalanuvchi biror bo'lim yoki panel haqida so'rasa — DARHOL tegishli functionni chaqir.
Hech qachon functiondan oldin yoki o'rniga matnli javob berma.
Function response ichidagi "content" maydonidagi matnni o'qi, boshqa narsa qo'shma.

QOIDA 2 — PANELLAR TARTIBI:
- Avval bolim_ochish → keyin panel_och
- Bir panel ma'lumotini to'liq o'qi → keyin panel_yop → keyin keyingi panelga o't
- panel_yop chaqirmasdan boshqa panel_ochga o'tma

QOIDA 3 — MATN O'QISH TARTIBI:
panel_och response ichida:
  content: "PANEL: <nomi>\nma'lumot 1\nma'lumot 2..."
Bu contentni aynan shu tartibda o'qi:
  1. Avval "PANEL: <nomi>" qismini ayt (panel nomini to'liq ayt)
  2. Keyin ma'lumotlarni ketma-ket ayt
  3. Tugagach panel_yop chaqir

QOIDA 4 — CHALKASHMASLIK:
- bo'lim va panel — ikki xil narsa
- bo'lim = saytdagi katta sekciya (masalan "Texnika", "Mahsulotlar")
- panel = bo'lim ichidagi bitta element (masalan "Beton nasos", "M200 beton")
- Bo'lim ID tanlashda faqat foydalanuvchi aytgan kalit so'zga mos ID ni tanla.
- "Aloqa" uchun contact/footer, "Mahsulotlar" uchun mahsulotlar/products-section, "Laboratoriya" uchun laboratoriya/laboratory, "Bajarilgan ishlar" uchun bajarilgan-ishlar/projects, "Xizmatlar" uchun services, "Biz haqimizda" uchun about, "Texnika" uchun texnika/transport.
- Hech qachon bo'lim noma'lum bo'lsa avtomatik Texnika bo'limini tanlama.

QOIDA 5 — SAYTDAN TASHQARIGA CHIQMA:
- Faqat function response'dagi content'ni o'qi
- Narx, muddat, kafolat, texnik raqam qo'shma — agar contentda yo'q bo'lsa
- "Bu ma'lumot bizda ko'rsatilmagan" de va to'xta

QOIDA 6 — SALOMLASHUV:
Birinchi replikang AYNAN shu bo'lsin, o'zgartirma:
"Assalomu aleykum, men Oqqush Beton kompaniyasining virtual agentiman. Qanday yordam bera olaman?"

QOIDA 7 — QISQA BO'L:
Har bir panel uchun 2-4 gap. Keraksiz so'z qo'shma.
Foydalanuvchi "to'xtat" yoki "yetarli" desa — darhol to'xta.

SAYT KONTEKSTI:
${this.currentContext}`;
  }

  private showError(text: string) {
    this.updateTranscript(text);
    this.manualStop = true;
    this.isActive = false;
    this.isConnecting = false;
    this.setupComplete = false;
    this.clearResponseTimer();
    this.closeSocket();
    this.stopMicrophoneStream(true);
    this.stopAudio();
    this.stopVisualizer();
    this.onStatusChange('error');
    this.updateStateLabel('error');
    this.updateSubText('Xatolik yuz berdi');
  }

  private setLiveState(status: AssistantStatus, text: string) {
    this.onStatusChange(status);
    this.updateSubText(text);
    this.updateStateLabel(status);
  }

  private updateSubText(text: string) {
    const el = document.getElementById('ai-sub-text');
    if (el) el.textContent = text;
  }

  private updateTranscript(text: string) {
    const el = document.getElementById('ai-user-transcript');
    if (el) el.textContent = text;
  }

  private updateStateLabel(status: AssistantStatus) {
    const label = document.getElementById('ai-state-label');
    const dot = document.getElementById('ai-state-dot');
    if (!label || !dot) return;

    const states: Record<AssistantStatus, {label: string; color: string}> = {
      idle: {label: 'Ochiq emas', color: 'bg-white/40'},
      connecting: {label: 'Ulanmoqda', color: 'bg-yellow-300'},
      active: {label: 'Faol', color: 'bg-cyan-300'},
      listening: {label: 'Tinglayapman', color: 'bg-cyan-300'},
      'user-speaking': {label: 'Siz gapiryapsiz', color: 'bg-green-300'},
      speaking: {label: 'AI gapiryapti', color: 'bg-blue-300'},
      error: {label: 'Xatolik', color: 'bg-red-400'},
    };

    const state = states[status];
    label.textContent = state.label;
    dot.className = `size-2 ${state.color} rounded-full animate-pulse`;
  }

  private startVisualizer() {
    if (this.visualizerInterval) return;
    const bars = document.querySelectorAll('#ai-visualizer div');
    this.visualizerInterval = window.setInterval(() => {
      bars.forEach((bar) => {
        (bar as HTMLElement).style.height = `${Math.floor(Math.random() * 24) + 8}px`;
      });
    }, 160);
  }

  private stopVisualizer() {
    if (this.visualizerInterval) window.clearInterval(this.visualizerInterval);
    this.visualizerInterval = null;
    document.querySelectorAll('#ai-visualizer div').forEach((bar, index) => {
      (bar as HTMLElement).style.height = `${[8, 16, 24, 16, 8][index] || 8}px`;
    });
  }

  private limit(text: string) {
    return text.length > 280 ? text.slice(0, 280) : text;
  }
}
