// Main JavaScript for Chatty Voice-First AI Portal Website

document.addEventListener('DOMContentLoaded', function() {
  // Initialize variables
  const serverUrl = 'https://api.chatty-ai-portal.com'; // Will be replaced with actual deployment URL
  let chattyClient = null;
  
  // DOM Elements - Main Page
  const tryButton = document.getElementById('try-chatty');
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const transcript = document.getElementById('transcript');
  
  // DOM Elements - Modal
  const chattyModal = document.getElementById('chatty-modal');
  const closeModal = document.querySelector('.close-modal');
  const modalStartButton = document.getElementById('modal-start-button');
  const modalStopButton = document.getElementById('modal-stop-button');
  const modalStatusIndicator = document.getElementById('modal-status-indicator');
  const modalStatusText = document.getElementById('modal-status-text');
  const modalTranscript = document.getElementById('modal-transcript');
  
  // Initialize Chatty Client
  async function initializeChatty() {
    if (chattyClient) {
      chattyClient.dispose();
    }
    
    chattyClient = new ChattyClient();
    
    try {
      // For demo page
      if (transcript) {
        await chattyClient.initialize(serverUrl, statusText, statusIndicator, transcript);
      } 
      // For modal
      else if (modalTranscript) {
        await chattyClient.initialize(serverUrl, modalStatusText, modalStatusIndicator, modalTranscript);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Chatty:', error);
      return false;
    }
  }
  
  // Start Chatty Session
  async function startChatty() {
    if (!chattyClient) {
      const initialized = await initializeChatty();
      if (!initialized) return;
    }
    
    try {
      await chattyClient.startSession();
      
      // Update UI
      if (startButton) startButton.disabled = true;
      if (stopButton) stopButton.disabled = false;
      if (modalStartButton) modalStartButton.disabled = true;
      if (modalStopButton) modalStopButton.disabled = false;
    } catch (error) {
      console.error('Failed to start Chatty session:', error);
    }
  }
  
  // Stop Chatty Session
  function stopChatty() {
    if (!chattyClient) return;
    
    chattyClient.endSession();
    
    // Update UI
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
    if (modalStartButton) modalStartButton.disabled = false;
    if (modalStopButton) modalStopButton.disabled = true;
  }
  
  // Show Modal
  function showModal() {
    chattyModal.classList.add('active');
    
    // Initialize Chatty in modal
    initializeChatty();
  }
  
  // Hide Modal
  function hideModal() {
    chattyModal.classList.remove('active');
    
    // Stop Chatty session if active
    if (chattyClient) {
      chattyClient.endSession();
      chattyClient.dispose();
      chattyClient = null;
    }
    
    // Reset UI
    if (modalStartButton) modalStartButton.disabled = false;
    if (modalStopButton) modalStopButton.disabled = true;
    if (modalTranscript) modalTranscript.innerHTML = '';
  }
  
  // Event Listeners - Main Page
  if (tryButton) {
    tryButton.addEventListener('click', showModal);
  }
  
  if (startButton) {
    startButton.addEventListener('click', startChatty);
  }
  
  if (stopButton) {
    stopButton.addEventListener('click', stopChatty);
  }
  
  // Event Listeners - Modal
  if (closeModal) {
    closeModal.addEventListener('click', hideModal);
  }
  
  if (modalStartButton) {
    modalStartButton.addEventListener('click', startChatty);
  }
  
  if (modalStopButton) {
    modalStopButton.addEventListener('click', stopChatty);
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === chattyModal) {
      hideModal();
    }
  });
  
  // Handle keyboard events
  document.addEventListener('keydown', function(event) {
    // Close modal on Escape key
    if (event.key === 'Escape' && chattyModal.classList.contains('active')) {
      hideModal();
    }
  });
  
  // Initialize for demo page if we're on that page
  if (startButton && stopButton && transcript) {
    initializeChatty();
  }
});
