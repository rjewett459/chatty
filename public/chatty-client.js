// Enhanced client implementation with OpenAI Realtime API integration
// Replaces socket.io audio with Realtime WebSocket voice interactions

class ChattyClient {
  constructor() {
    this.realtimeSocket = null;
    this.audioContext = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.sessionId = null;
    this.apiKey = null;
    this.transcript = [];
    this.audioQueue = [];
    this.audioPlayer = null;
  }

  async initialize(apiKey) {
    this.apiKey = apiKey;
    this.setupAudio();
    await this.connectToOpenAIRealtime();
  }

  setupAudio() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.audioPlayer = new Audio();
    this.audioPlayer.autoplay = true;
    this.audioPlayer.addEventListener("ended", () => {
      this.isSpeaking = false;
      if (this.audioQueue.length > 0) this.playAudio(this.audioQueue.shift());
    });
  }

  async connectToOpenAIRealtime() {
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
    this.realtimeSocket = new WebSocket(url, ["realtime.v1"]);

    this.realtimeSocket.onopen = () => {
      console.log("✅ Connected to OpenAI Realtime API");
      this.startListening();
    };

    this.realtimeSocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("📨 Realtime message received:", message);

      if (message.type === "response.audio.delta") {
        const audioData = message.delta;
        if (audioData) {
          const audioBlob = this.base64ToBlob(audioData);
          const url = URL.createObjectURL(audioBlob);
          this.playAudio(url);
        } else {
          console.warn("⚠️ Audio delta received but empty");
        }
      } else {
        console.log("📝 Non-audio message:", message);
      }
    };

    this.realtimeSocket.onerror = (err) => {
      console.error("Realtime Socket error:", err);
    };
  }

  base64ToBlob(base64, mime = "audio/mpeg") {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  playAudio(audioUrl) {
    if (this.isSpeaking) {
      this.audioQueue.push(audioUrl);
    } else {
      this.audioPlayer.src = audioUrl;
      this.audioPlayer.play();
      this.isSpeaking = true;
    }
  }

  async startListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus"
    });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(",")[1];
          this.sendAudioToOpenAI(base64);
        };
        reader.readAsDataURL(event.data);
      }
    };

    this.mediaRecorder.start(100);
    this.isListening = true;
  }

  sendAudioToOpenAI(base64Audio) {
    if (this.realtimeSocket && this.realtimeSocket.readyState === WebSocket.OPEN) {
      this.realtimeSocket.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64Audio,
        })
      );

      this.realtimeSocket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      this.realtimeSocket.send(
        JSON.stringify({
          type: "response.create",
          options: {
            response_type: "audio",
            voice: "nova",
            interrupt: true
          }
        })
      );
    }
  }

  stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.isListening = false;
  }

  dispose() {
    this.stopListening();
    if (this.realtimeSocket) this.realtimeSocket.close();
    if (this.audioContext) this.audioContext.close();
    this.audioQueue = [];
    this.sessionId = null;
  }
}

window.ChattyClient = ChattyClient;

