class ChattyClient {
  constructor() {
    this.socket = null;
    this.audioContext = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.sessionId = null;
    this.audioQueue = [];
    this.audioPlayer = null;
  }

  async initialize() {
    this.setupAudio();
    this.connectToSocketServer();
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

  connectToSocketServer() {
    this.socket = io(); // assumes same host as page

    this.socket.on("connect", () => {
      console.log("✅ Connected to Chatty Server");
      this.socket.emit("create_session", {});
    });

    this.socket.on("session_created", ({ sessionId }) => {
      this.sessionId = sessionId;
      console.log("🎉 Session started:", sessionId);
      this.startListening();
    });

    this.socket.on("realtime_message", ({ sessionId, data }) => {
      if (data.type === "transcript") {
        console.log("📝 Transcript:", data.data);
        const transcriptBox = document.getElementById("transcript");
        if (transcriptBox) {
          transcriptBox.innerHTML += `<div>${data.data}</div>`;
        }
      }

      if (data.type === "audio") {
        this.playAudio(data.data); // already full base64 data URL
      }
    });

    this.socket.on("session_error", (err) => {
      console.error("❌ Session error:", err);
    });
  }

  async startListening() {
    try {
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
            this.sendAudioToServer(base64);
          };
          reader.readAsDataURL(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isListening = true;
      console.log("🎤 Microphone streaming started");

    } catch (err) {
      console.error("🚫 Microphone access error:", err);
    }
  }

  sendAudioToServer(base64Audio) {
    if (!this.socket || !this.sessionId) return;
    this.socket.emit("send_audio", {
      sessionId: this.sessionId,
      audio: base64Audio
    });
  }

  playAudio(base64AudioUrl) {
    if (this.isSpeaking) {
      this.audioQueue.push(base64AudioUrl);
    } else {
      this.audioPlayer.src = base64AudioUrl;
      this.audioPlayer.play();
      console.log("📦 Playing audio of length:", base64AudioUrl.length); // Log it here
      this.isSpeaking = true;
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
    if (this.socket) {
      this.socket.emit("end_session", { sessionId: this.sessionId });
      this.socket.disconnect();
    }
    if (this.audioContext) this.audioContext.close();
    this.audioQueue = [];
    this.sessionId = null;
  }
}

window.ChattyClient = ChattyClient;

