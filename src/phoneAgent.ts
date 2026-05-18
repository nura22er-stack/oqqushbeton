const CONFIG = {
  websocketUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/gemini-live`,
  model: 'gemini-2.5-flash-native-audio-latest',
  voice: 'Charon',
  inputRate: 16000,
  outputRate: 24000,
  micChunkSize: 2048,
  micGain: 1.65,
};

const PROMPT = `
Siz Oqqush Beton kompaniyasining professional virtual agentisiz.
Kompaniya nomi: Oqqush Beton.
Mahsulotlar: Qurilish uchun beton, armaturali beton konstruksiyalar, temir-beton ustunlar, plitalar.
Xizmatlar: Beton yetkazib berish, qurilish konsultatsiyasi.
Ish vaqti: Dushanba-Shanba 08:00-18:00.
Savollarga javob berishda pastdagi WEBSAYTDAN O'QILGAN BO'LIMLAR matnidan foydalaning.
Foydalanuvchi bo'lim nomini aytsa, aynan shu bo'lim haqida qisqa va tushunarli ma'lumot bering.
Saytda panel yoki bo'lim ochmang, sahifani boshqarmang, faqat ovoz orqali javob bering.
Ma'lumot saytda aniq yozilmagan bo'lsa, "Bu ma'lumot saytda aniq ko'rsatilmagan" deb ayting.
Faqat kompaniya haqida savollarga javob bering.
Boshqa mavzularda: "Bu mavzu bo'yicha sizga yordam bera olmayman, lekin beton va qurilish bo'yicha savollaringizga javob berishga tayyorman" deb ayting.
Har doim muloyim, professional va qisqa javob bering. Uzbek tilida gaplashing.
`.trim();

const SECTION_TITLES: Record<string, string> = {
  home: 'Bosh sahifa',
  about: 'Biz haqimizda',
  services: 'Xizmatlar',
  transport: 'Texnika',
  'products-section': 'Mahsulotlar',
  'concrete-mix': 'Beton qorishmalari',
  'high-performance-concrete': 'Yuqori mustahkam beton',
  'plitalar-section': 'Plitalar',
  'gisht-section': "G'isht mahsulotlari",
  laboratory: 'Laboratoriya',
  projects: 'Bajarilgan ishlar',
  footer: 'Aloqa',
};

export class PhoneAgentWidget {
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private inputContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private playbackTime = 0;
  private startedAt = 0;
  private timerId: number | null = null;
  private muted = false;
  private connected = false;
  private calling = false;
  private bound = false;
  private callToken = 0;
  private lastMicUiAt = 0;
  private websiteKnowledge = '';
  private ringingNodes = new Set<OscillatorNode>();
  private ringTimers = new Map<OscillatorNode, number>();
  private playbackSources = new Set<AudioBufferSourceNode>();
  private endingAfterFarewell = false;
  private farewellCloseTimer: number | null = null;

  init() {
    if (this.bound) return;
    this.bound = true;
    this.refreshWebsiteKnowledge();
    this.callButton()?.addEventListener('click', () => {
      if (this.calling) this.endCall();
      else void this.startCall();
    });
    this.el<HTMLButtonElement>('phone-hangup-btn')?.addEventListener('click', () => this.endCall());
    this.el<HTMLButtonElement>('phone-call-close')?.addEventListener('click', () => this.endCall());
    this.el<HTMLButtonElement>('phone-mute-btn')?.addEventListener('click', () => this.toggleMute());
  }

  private async startCall() {
    if (this.calling) return;
    const token = ++this.callToken;
    this.calling = true;
    this.muted = false;
    this.updateMuteUi();
    this.updateCallButtonUi();
    this.setStatus('Ulanmoqda...');
    this.setHint('Telefon chaqirilmoqda...');
    this.openOverlay();
    this.callButton()?.classList.add('is-ringing');

    try {
      this.audioContext ||= new ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext)();
      await this.audioContext.resume();
      await this.ringPattern();
      if (!this.calling || token !== this.callToken) return;
      this.callButton()?.classList.remove('is-ringing');
      this.setHint('Mikrofon ruxsatini bering va gapirishga tayyorlaning.');
      await this.connectLive();
      if (!this.calling || token !== this.callToken) this.endCall();
    } catch (error) {
      console.error('Phone agent error:', error);
      this.callButton()?.classList.remove('is-ringing');
      this.setStatus('Xatolik');
      this.setHint(error instanceof Error ? error.message : "Qo'ng'iroqni boshlashda xatolik yuz berdi.");
      this.calling = false;
      this.updateCallButtonUi();
    }
  }

  private async ringPattern() {
    await this.ringTone(450);
    if (!this.calling) return;
    await this.wait(120);
  }

  private ringTone(durationMs: number) {
    return new Promise<void>((resolve) => {
      if (!this.audioContext) return resolve();
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const now = this.audioContext.currentTime;
      const duration = durationMs / 1000;
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.08);
      gain.gain.setValueAtTime(0.24, now + duration - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.audioContext.destination);
      this.ringingNodes.add(osc);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        const timer = this.ringTimers.get(osc);
        if (timer) window.clearTimeout(timer);
        this.ringTimers.delete(osc);
        this.ringingNodes.delete(osc);
        resolve();
      };
      osc.start(now);
      const stopTimer = window.setTimeout(() => {
        try {
          osc.stop();
        } catch {
          finish();
        }
      }, durationMs + 80);
      this.ringTimers.set(osc, stopTimer);
      osc.onended = finish;
    });
  }

  private async connectLive() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: {ideal: 1},
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: {ideal: 48000},
        sampleSize: {ideal: 16},
      },
    });
    this.startMicStreamer();

    this.ws = new WebSocket(CONFIG.websocketUrl);
    this.ws.onopen = () => this.sendSetup();
    this.ws.onmessage = event => void this.handleMessage(event);
    this.ws.onerror = () => {
      this.setStatus('Xatolik');
      this.setHint('Gemini Live ulanishida xatolik yuz berdi.');
    };
    this.ws.onclose = () => {
      if (this.calling) this.endCall(false);
    };
  }

  private sendSetup() {
    const prompt = this.buildSystemPrompt();
    this.ws?.send(JSON.stringify({
      setup: {
        model: `models/${CONFIG.model}`,
        systemInstruction: {parts: [{text: prompt}]},
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: CONFIG.voice}}},
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    }));
  }

  private buildSystemPrompt() {
    return `${PROMPT}

WEBSAYTDAN O'QILGAN BO'LIMLAR:
${this.websiteKnowledge || this.collectWebsiteKnowledge()}`;
  }

  private refreshWebsiteKnowledge() {
    const refresh = () => {
      this.websiteKnowledge = this.collectWebsiteKnowledge();
    };
    const requestIdle = (window as Window & {requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number}).requestIdleCallback;
    if (typeof requestIdle === 'function') {
      requestIdle(refresh, {timeout: 1800});
      return;
    }
    window.setTimeout(refresh, 250);
  }

  private collectWebsiteKnowledge() {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('#app > section, #app > footer'));
    const knowledge = sections
      .map(section => {
        const title = this.sectionTitle(section);
        const text = this.trimText(this.normalizeText(section.textContent || ''), 2200);
        return text ? `### ${title}\n${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    return this.trimText(knowledge || 'Saytdan bo\'lim matnlari topilmadi.', 15000);
  }

  private sectionTitle(section: HTMLElement) {
    if (section.id && SECTION_TITLES[section.id]) return SECTION_TITLES[section.id];
    const heading = section.querySelector<HTMLElement>('h1, h2, h3');
    return this.normalizeText(heading?.textContent || "Sayt bo'limi") || "Sayt bo'limi";
  }

  private normalizeText(text: string) {
    const lines = text
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(line => line.length > 1);
    return lines.filter((line, index) => index === 0 || line !== lines[index - 1]).join('\n');
  }

  private trimText(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  }

  private async handleMessage(event: MessageEvent) {
    if (!this.calling) return;
    const raw = typeof event.data === 'string' ? event.data : await event.data.text();
    if (!this.calling) return;
    const message = JSON.parse(raw);
    const content = message.serverContent;

    if (message.setupComplete) {
      this.connected = true;
      this.startTimer();
      this.setStatus('Ulandi');
      this.setHint('Virtual agent salomlashmoqda...');
      this.sendGreeting();
      return;
    }

    if (content?.inputTranscription?.text) {
      this.setStatus('Tinglamoqda...');
      this.setHint(`Siz: ${content.inputTranscription.text}`);
      this.setMicActive(true);
      if (this.shouldEndByKeyword(content.inputTranscription.text)) {
        this.startFarewellAndClose();
        return;
      }
    }
    if (content?.outputTranscription?.text) {
      this.setStatus('Javob bermoqda...');
      this.setHint(`Agent: ${content.outputTranscription.text}`);
    }
    for (const part of content?.modelTurn?.parts || []) {
      const data = (part.inlineData || part.inline_data)?.data;
      if (data) {
        this.setStatus('Javob bermoqda...');
        this.startWaves();
        this.playPcm16(data);
      }
    }
    if (content?.turnComplete || content?.generationComplete) {
      this.setStatus('Tinglamoqda...');
      this.setMicActive(!this.muted);
      window.setTimeout(() => this.stopWaves(), 500);
      if (this.endingAfterFarewell) this.scheduleCloseAfterPlayback();
    }
  }

  private sendGreeting() {
    if (!this.calling) return;
    this.ws?.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{text: "Suhbatni aynan mana shu salomlashuv bilan boshlang: Assalamu aleykum! Men Oqqush Beton kompaniyasining virtual agentiman. Qanday yordam bera olaman?"}],
        }],
        turnComplete: true,
      },
    }));
  }

  private shouldEndByKeyword(text: string) {
    if (this.endingAfterFarewell) return false;
    const normalized = this.normalizeVoiceText(text);
    return /\b(rahmat|raxmat|rakhmat|tashakkur|toxta|tokhta|tuxta|tohtat|toxtang|stop)\b/.test(normalized);
  }

  private normalizeVoiceText(text: string) {
    return text
      .toLowerCase()
      .replace(/[\u2018\u2019`´]/g, "'")
      .replace(/o['\u02bb]?/g, 'o')
      .replace(/g['\u02bb]?/g, 'g')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private startFarewellAndClose() {
    if (!this.calling || this.endingAfterFarewell) return;
    this.endingAfterFarewell = true;
    this.muted = true;
    this.micStream?.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
    this.updateMuteUi();
    this.setStatus('Yakunlanmoqda...');
    this.setHint("Ho'p, yana savollaringiz bo'lsa, men shu yerdaman.");
    this.ws?.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{text: "Suhbatni aynan mana shu gap bilan yakunlang va boshqa hech narsa demang: Ho'p, yana savollaringiz bo'lsa, men shu yerdaman."}],
        }],
        turnComplete: true,
      },
    }));
    this.farewellCloseTimer = window.setTimeout(() => this.endCall(), 6500);
  }

  private scheduleCloseAfterPlayback() {
    if (!this.endingAfterFarewell) return;
    if (this.farewellCloseTimer) window.clearTimeout(this.farewellCloseTimer);
    const delay = Math.max(700, ((this.playbackTime - (this.audioContext?.currentTime || 0)) * 1000) + 450);
    this.farewellCloseTimer = window.setTimeout(() => this.endCall(), delay);
  }

  private startMediaRecorder() {
    if (!this.micStream || !('MediaRecorder' in window)) return;
    this.recorder = new MediaRecorder(this.micStream);
    this.recorder.ondataavailable = () => undefined;
    this.recorder.start(2500);
  }

  private startMicStreamer() {
    if (!this.micStream) return;
    this.inputContext = new ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext)({latencyHint: 'interactive'});
    this.source = this.inputContext.createMediaStreamSource(this.micStream);
    this.processor = this.inputContext.createScriptProcessor(CONFIG.micChunkSize, 1, 1);
    this.silentGain = this.inputContext.createGain();
    this.silentGain.gain.value = 0;
    this.processor.onaudioprocess = event => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected || this.muted) return;
      if (this.ws.bufferedAmount > 192 * 1024) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = this.resampleToPcm16(input, event.inputBuffer.sampleRate, CONFIG.inputRate);
      this.ws.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: this.arrayBufferToBase64(pcm16.buffer),
            mimeType: `audio/pcm;rate=${CONFIG.inputRate}`,
          },
        },
      }));
      this.updateMicUi(input);
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain).connect(this.inputContext.destination);
  }

  private playPcm16(base64Audio: string) {
    if (!this.audioContext || !this.calling) return;
    const bytes = this.base64ToUint8Array(base64Audio);
    const pcm = new Int16Array(bytes.buffer);
    const buffer = this.audioContext.createBuffer(1, pcm.length, CONFIG.outputRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    this.playbackSources.add(source);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.playbackSources.delete(source);
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
      if (this.calling && this.audioContext && this.audioContext.currentTime >= this.playbackTime - 0.08) this.stopWaves();
    };
    this.playbackTime = Math.max(this.playbackTime, this.audioContext.currentTime + 0.02);
    source.start(this.playbackTime);
    this.playbackTime += buffer.duration;
    source.onended = finish;
  }

  private toggleMute() {
    this.muted = !this.muted;
    this.micStream?.getAudioTracks().forEach(track => {
      track.enabled = !this.muted;
    });
    this.updateMuteUi();
    this.setStatus(this.muted ? "Mikrofon o'chirilgan" : 'Tinglamoqda...');
    this.setMicActive(!this.muted);
  }

  private endCall(closeSocket = true) {
    this.callToken += 1;
    this.calling = false;
    this.connected = false;
    this.endingAfterFarewell = false;
    if (this.farewellCloseTimer) window.clearTimeout(this.farewellCloseTimer);
    this.farewellCloseTimer = null;
    this.stopRinging();
    this.stopPlayback();
    this.callButton()?.classList.remove('is-ringing');
    this.updateCallButtonUi();
    this.closeOverlay();
    this.stopWaves();
    this.setMicActive(false);
    this.stopTimer();
    this.playbackTime = this.audioContext?.currentTime || 0;
    if (closeSocket && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({realtimeInput: {audioStreamEnd: true}}));
      this.ws.close(1000, 'Call ended');
    }
    this.ws = null;
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
    this.processor?.disconnect();
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor = null;
    this.silentGain?.disconnect();
    this.silentGain = null;
    this.source?.disconnect();
    this.source = null;
    void this.inputContext?.close();
    this.inputContext = null;
    this.micStream?.getTracks().forEach(track => track.stop());
    this.micStream = null;
  }

  private updateMuteUi() {
    const button = this.el<HTMLButtonElement>('phone-mute-btn');
    if (!button) return;
    button.textContent = this.muted ? 'Yoqish' : 'Mikrofon';
    button.classList.toggle('is-muted', this.muted);
  }

  private updateCallButtonUi() {
    const button = this.callButton();
    if (!button) return;
    button.classList.toggle('is-active', this.calling);
    button.setAttribute('aria-label', this.calling ? "AI qo'ng'irog'ini o'chirish" : "Oqqush Beton virtual agentiga qo'ng'iroq qilish");
  }

  private stopRinging() {
    for (const node of this.ringingNodes) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
  }

  private stopPlayback() {
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {
        // Already stopped or not started yet.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.playbackSources.clear();
    this.playbackTime = this.audioContext?.currentTime || 0;
  }

  private startTimer() {
    this.startedAt = Date.now();
    this.stopTimer();
    this.timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      const timer = this.el('phone-call-timer');
      if (timer) timer.textContent = `${minutes}:${seconds}`;
    }, 250);
  }

  private stopTimer() {
    if (this.timerId) window.clearInterval(this.timerId);
    this.timerId = null;
    const timer = this.el('phone-call-timer');
    if (timer) timer.textContent = '00:00';
  }

  private float32ToPcm16(input: Float32Array) {
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = this.cleanMicSample(input[i]);
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }

  private resampleToPcm16(input: Float32Array, sourceRate: number, targetRate: number) {
    if (!sourceRate || Math.abs(sourceRate - targetRate) < 1) return this.float32ToPcm16(input);
    const ratio = sourceRate / targetRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const pcm = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sourceIndex = i * ratio;
      const left = Math.floor(sourceIndex);
      const right = Math.min(left + 1, input.length - 1);
      const weight = sourceIndex - left;
      const sample = this.cleanMicSample(input[left] * (1 - weight) + input[right] * weight);
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }

  private cleanMicSample(value: number) {
    const boosted = Math.abs(value) < 0.003 ? 0 : value * CONFIG.micGain;
    return Math.max(-1, Math.min(1, boosted));
  }

  private audioLevel(samples: Float32Array) {
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
  }

  private updateMicUi(samples: Float32Array) {
    const now = performance.now();
    if (now - this.lastMicUiAt < 180) return;
    this.lastMicUiAt = now;
    this.setMicActive(this.audioLevel(samples) > 0.018);
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private openOverlay() {
    document.getElementById('chat-panel')?.classList.add('hidden');
    this.el('phone-call-overlay')?.classList.remove('hidden');
    this.el('phone-call-overlay')?.classList.add('flex');
  }

  private closeOverlay() {
    this.el('phone-call-overlay')?.classList.add('hidden');
    this.el('phone-call-overlay')?.classList.remove('flex');
  }

  private setStatus(text: string) {
    const status = this.el('phone-call-status');
    if (status) status.textContent = text;
  }

  private setHint(text: string) {
    const hint = this.el('phone-call-hint');
    if (hint) hint.textContent = text;
  }

  private startWaves() {
    this.el('phone-sound-waves')?.classList.add('is-active');
  }

  private stopWaves() {
    this.el('phone-sound-waves')?.classList.remove('is-active');
  }

  private setMicActive(active: boolean) {
    this.el('phone-mic-indicator')?.classList.toggle('is-active', active);
  }

  private callButton() {
    return this.el<HTMLButtonElement>('phone-call-btn');
  }

  private el<T extends HTMLElement = HTMLElement>(id: string) {
    return document.getElementById(id) as T | null;
  }

  private wait(ms: number) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }
}
