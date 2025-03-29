// Embeddable script for Chatty Voice-First AI Portal
(function(w, d, s, o) {
  // Default options
  const defaults = {
    buttonText: 'Talk to Chatty',
    position: 'bottom-right',
    theme: 'dark',
    serverUrl: 'https://3000-iftjw8vt7txltdc13l1ra-4bee712f.manus.computer',
    primaryColor: '#4f46e5'
  };
  
  // Merge options
  const options = Object.assign({}, defaults, o || {});
  
  // Create styles
  const style = d.createElement('style');
  style.innerHTML = `
    .chatty-widget {
      position: fixed;
      z-index: 9999;
    }
    
    .chatty-widget.bottom-right {
      bottom: 20px;
      right: 20px;
    }
    
    .chatty-widget.bottom-left {
      bottom: 20px;
      left: 20px;
    }
    
    .chatty-widget.bottom-center {
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
    }
    
    .chatty-button {
      padding: 12px 20px;
      border-radius: 50px;
      background-color: ${options.primaryColor};
      color: white;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      transition: all 0.3s ease;
    }
    
    .chatty-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
    }
    
    .chatty-button i {
      margin-right: 8px;
    }
    
    .chatty-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    }
    
    .chatty-modal.active {
      display: flex;
    }
    
    .chatty-modal-content {
      width: 90%;
      max-width: 400px;
      max-height: 90vh;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }
    
    @media (max-width: 480px) {
      .chatty-modal-content {
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
    }
  `;
  d.head.appendChild(style);
  
  // Create widget container
  const widget = d.createElement('div');
  widget.className = `chatty-widget ${options.position}`;
  
  // Create button
  const button = d.createElement('div');
  button.className = 'chatty-button';
  button.innerHTML = `<i class="fas fa-microphone"></i><span>${options.buttonText}</span>`;
  widget.appendChild(button);
  
  // Create modal
  const modal = d.createElement('div');
  modal.className = 'chatty-modal';
  modal.innerHTML = `
    <div class="chatty-modal-content">
      <iframe 
        src="${options.serverUrl}/embeddable.html?theme=${options.theme}&color=${encodeURIComponent(options.primaryColor)}" 
        frameborder="0" 
        style="width: 100%; height: 100%; min-height: 500px;"
      ></iframe>
    </div>
  `;
  
  // Add to document
  d.body.appendChild(widget);
  d.body.appendChild(modal);
  
  // Add event listeners
  button.addEventListener('click', function() {
    modal.classList.add('active');
  });
  
  // Add Font Awesome if not already loaded
  if (!d.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = d.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    d.head.appendChild(fontAwesome);
  }
  
  // Add message listener for iframe communication
  w.addEventListener('message', function(event) {
    if (event.data === 'chatty-close') {
      modal.classList.remove('active');
    }
  });
  
})(window, document, 'script', window.chattyOptions || {});
