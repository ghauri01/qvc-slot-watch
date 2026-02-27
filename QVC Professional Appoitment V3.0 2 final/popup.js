document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const elements = {
    statusBadge: document.getElementById('statusBadge'),
    statusMessage: document.getElementById('statusMessage'),
    checkCount: document.getElementById('checkCount'),
    foundCount: document.getElementById('foundCount'),
    uptime: document.getElementById('uptime'),
    sessionTimer: document.getElementById('sessionTimer'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    panelBtn: document.getElementById('panelBtn'),
    soundToggle: document.getElementById('soundToggle'),
    notifyToggle: document.getElementById('notifyToggle'),
    scrollToggle: document.getElementById('scrollToggle'),
    emailContainer: document.getElementById('emailContainer'),
    addEmailBtn: document.getElementById('addEmailBtn')
  };

  let isMonitoring = false;
  let checkCounter = 0;
  let foundCounter = 0;
  let startTime = null;
  let uptimeInterval = null;
  let sessionInterval = null;
  let emails = [''];

  // Load saved settings
  chrome.storage.local.get([
    'soundEnabled', 'notifyEnabled', 'scrollEnabled', 'emails',
    'checkCount', 'foundCount', 'isMonitoring', 'startTime'
  ], function(result) {
    // Set toggles
    if (result.soundEnabled === false) elements.soundToggle.classList.remove('active');
    if (result.notifyEnabled === false) elements.notifyToggle.classList.remove('active');
    if (result.scrollEnabled === false) elements.scrollToggle.classList.remove('active');
    
    // Set emails
    if (result.emails && result.emails.length > 0) {
      emails = result.emails;
    }
    renderEmailInputs();
    
    // Set counters
    checkCounter = result.checkCount || 0;
    foundCounter = result.foundCount || 0;
    elements.checkCount.textContent = checkCounter;
    elements.foundCount.textContent = foundCounter;
    
    // Set monitoring state
    isMonitoring = result.isMonitoring || false;
    if (isMonitoring) {
      startTime = result.startTime || Date.now();
      elements.statusBadge.textContent = 'MONITORING';
      elements.statusBadge.className = 'status-badge monitoring';
      elements.statusMessage.textContent = 'Scanning every second...';
      elements.startBtn.disabled = true;
      elements.stopBtn.disabled = false;
      startUptime();
      startSessionTimer();
    }
  });

  function renderEmailInputs() {
    elements.emailContainer.innerHTML = '';
    
    emails.forEach((email, index) => {
      const emailRow = document.createElement('div');
      emailRow.className = 'email-row';
      
      const input = document.createElement('input');
      input.type = 'email';
      input.className = 'email-input';
      input.placeholder = `Email address ${index + 1}`;
      input.value = email || '';
      
      input.addEventListener('input', function() {
        emails[index] = this.value;
      });
      
      input.addEventListener('blur', function() {
        saveEmails();
      });
      
      emailRow.appendChild(input);
      
      if (emails.length > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-email';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', function() {
          emails.splice(index, 1);
          renderEmailInputs();
          saveEmails();
        });
        emailRow.appendChild(removeBtn);
      }
      
      elements.emailContainer.appendChild(emailRow);
    });
  }

  function saveEmails() {
    // Filter out empty emails
    const validEmails = emails.filter(email => email.trim() !== '');
    chrome.storage.local.set({ emails: validEmails });
  }

  elements.addEmailBtn.addEventListener('click', function() {
    emails.push('');
    renderEmailInputs();
  });

  // Toggle handlers
  elements.soundToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    chrome.storage.local.set({ soundEnabled: this.classList.contains('active') });
  });

  elements.notifyToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    chrome.storage.local.set({ notifyEnabled: this.classList.contains('active') });
    if (this.classList.contains('active') && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  });

  elements.scrollToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    chrome.storage.local.set({ scrollEnabled: this.classList.contains('active') });
  });

  // Start button
  elements.startBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0].url.includes('qatarvisacenter.com')) {
        elements.statusMessage.textContent = '❌ Please go to Qatar Visa Center website';
        elements.statusMessage.style.color = '#ef4444';
        setTimeout(() => {
          elements.statusMessage.textContent = 'Ready to start monitoring for appointments';
          elements.statusMessage.style.color = '';
        }, 3000);
        return;
      }

      // Filter out empty emails
      const validEmails = emails.filter(email => email.trim() !== '');
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startMonitoring',
        settings: {
          soundEnabled: elements.soundToggle.classList.contains('active'),
          notifyEnabled: elements.notifyToggle.classList.contains('active'),
          scrollEnabled: elements.scrollToggle.classList.contains('active'),
          emails: validEmails
        }
      });

      isMonitoring = true;
      startTime = Date.now();
      
      elements.statusBadge.textContent = 'MONITORING';
      elements.statusBadge.className = 'status-badge monitoring';
      elements.statusMessage.textContent = 'Scanning every second...';
      elements.startBtn.disabled = true;
      elements.stopBtn.disabled = false;
      
      chrome.storage.local.set({ 
        isMonitoring: true, 
        startTime: startTime,
        emails: validEmails 
      });
      
      startUptime();
      startSessionTimer();
    });
  });

  // Stop button
  elements.stopBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopMonitoring' });

      isMonitoring = false;
      
      elements.statusBadge.textContent = 'IDLE';
      elements.statusBadge.className = 'status-badge idle';
      elements.statusMessage.textContent = 'Monitoring stopped';
      elements.startBtn.disabled = false;
      elements.stopBtn.disabled = true;
      
      chrome.storage.local.set({ isMonitoring: false });
      
      stopUptime();
      stopSessionTimer();
    });
  });

  // Panel button
  elements.panelBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'togglePanel' });
    });
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === 'updateStats') {
      checkCounter = request.checkCount;
      foundCounter = request.foundCount;
      elements.checkCount.textContent = checkCounter;
      elements.foundCount.textContent = foundCounter;
      chrome.storage.local.set({ checkCount: checkCounter, foundCount: foundCounter });
    }
    
    if (request.action === 'statusChange') {
      elements.statusMessage.textContent = request.message;
      
      if (request.status === 'found') {
        elements.statusBadge.textContent = 'FOUND!';
        elements.statusBadge.className = 'status-badge found';
        foundCounter++;
        elements.foundCount.textContent = foundCounter;
      }
    }
  });

  function startUptime() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    
    uptimeInterval = setInterval(() => {
      if (startTime && isMonitoring) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        elements.uptime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  function stopUptime() {
    if (uptimeInterval) {
      clearInterval(uptimeInterval);
      uptimeInterval = null;
    }
    elements.uptime.textContent = '00:00';
  }

  function startSessionTimer() {
    if (sessionInterval) clearInterval(sessionInterval);
    
    let lastActivity = Date.now();
    
    sessionInterval = setInterval(() => {
      if (isMonitoring) {
        const elapsed = Math.floor((Date.now() - lastActivity) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        elements.sessionTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color based on time
        if (minutes >= 10) {
          elements.sessionTimer.style.color = '#ef4444';
        } else if (minutes >= 5) {
          elements.sessionTimer.style.color = '#f59e0b';
        } else {
          elements.sessionTimer.style.color = '#a0aec0';
        }
      } else {
        elements.sessionTimer.textContent = '00:00';
      }
    }, 1000);
  }

  function stopSessionTimer() {
    if (sessionInterval) {
      clearInterval(sessionInterval);
      sessionInterval = null;
    }
    elements.sessionTimer.textContent = '00:00';
    elements.sessionTimer.style.color = '#a0aec0';
  }

  // Request notification permission
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
});