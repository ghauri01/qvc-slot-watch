// QVC Professional Monitor - WORKING VERSION with Logs and Clicks
let isMonitoring = false;
let monitorInterval = null;
let calendarClickInterval = null;
let checkCount = 0;
let foundCount = 0;
let settings = {
  soundEnabled: true,
  notifyEnabled: true,
  scrollEnabled: true,
  emails: []
};
let audio = null;
let alarmInterval = null;
let dateClicked = false;
let timeClicked = false;
let lastClickTime = Date.now();
let clickCounter = 0;

// Create professional panel
function createPanel() {
  // Remove existing panel if any
  const existingPanel = document.getElementById('qvc-pro-panel');
  if (existingPanel) existingPanel.remove();
  
  const newPanel = document.createElement('div');
  newPanel.id = 'qvc-pro-panel';
  newPanel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 380px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    padding: 16px;
    color: white;
    font-family: 'Segoe UI', system-ui, sans-serif;
    z-index: 999999;
    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    font-size: 12px;
  `;
  
  newPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 28px;">🇶🇦</span>
        <div>
          <span style="font-weight: 700; font-size: 16px; display: block;">QVC Pro Monitor</span>
          <span style="font-size: 10px; opacity: 0.6;">Working Version v7.0</span>
        </div>
      </div>
      <button id="closePanel" style="background: none; border: none; color: white; font-size: 22px; cursor: pointer; opacity: 0.6;">✕</button>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 12px;">
      <div id="statusDot" style="width: 14px; height: 14px; border-radius: 50%; background: #f59e0b;"></div>
      <span id="statusText" style="font-size: 13px; font-weight: 500; flex: 1;">IDLE - Ready</span>
      <span id="sessionTimer" style="font-family: monospace; background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 20px; font-size: 11px;">00:00</span>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
      <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #4facfe;" id="panelChecks">0</div>
        <div style="font-size: 9px; opacity: 0.6;">Date Scans</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #43e97b;" id="panelFound">0</div>
        <div style="font-size: 9px; opacity: 0.6;">Found</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #f39c12;" id="clickCount">0</div>
        <div style="font-size: 9px; opacity: 0.6;">Session Clicks</div>
      </div>
    </div>
    
    <div style="margin-bottom: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; color: #10b981;">🟢 Session Status</span>
        <span id="nextClick" style="font-size: 10px; color: #a0aec0;">Next click: 2m 0s</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 5px;">
        <span style="font-size: 10px; color: #a0aec0;">Last click:</span>
        <span id="lastClickTime" style="font-size: 10px; color: #f39c12;">Never</span>
      </div>
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 11px; opacity: 0.7;">📋 LIVE ACTIVITY LOG</span>
        <span id="logCount" style="font-size: 9px; opacity: 0.5;">0 events</span>
      </div>
      <div id="logContainer" style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 10px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 10px;"></div>
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
      <span style="display: flex; align-items: center; gap: 4px;"><span style="color: #43e97b;">●</span> Selectable</span>
      <span style="display: flex; align-items: center; gap: 4px;"><span style="color: #ff6b6b;">●</span> Unavailable</span>
      <span style="display: flex; align-items: center; gap: 4px;"><span style="color: #f39c12;">●</span> Session Click</span>
    </div>
  `;
  
  document.body.appendChild(newPanel);
  
  document.getElementById('closePanel').addEventListener('click', () => {
    newPanel.style.display = 'none';
  });
  
  return newPanel;
}

// Initialize panel
let panel = createPanel();

// Add initial log
addLog('✅ QVC Pro Monitor loaded - Ready to start', '#43e97b');

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startMonitoring') {
    settings = { ...settings, ...request.settings };
    if (request.settings.emails) {
      settings.emails = request.settings.emails;
    }
    startMonitoring();
    sendResponse({ success: true });
  }
  else if (request.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({ success: true });
  }
  else if (request.action === 'togglePanel') {
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
    sendResponse({ success: true });
  }
  return true;
});

function startMonitoring() {
  stopMonitoring();
  
  isMonitoring = true;
  checkCount = 0;
  foundCount = 0;
  dateClicked = false;
  timeClicked = false;
  clickCounter = 0;
  lastClickTime = Date.now();
  
  updateStatus('active', 'MONITORING - Active');
  addLog('🚀 ===== MONITORING STARTED =====', '#4facfe');
  addLog('🔄 Clicking page every 2 minutes to keep session alive', '#f39c12');
  addLog(`📧 Email recipients: ${settings.emails.length || 0}`, '#a8dadc');
  
  // Start scanning for dates (every second)
  checkForAvailableDates();
  monitorInterval = setInterval(checkForAvailableDates, 1000);
  
  // CRITICAL: Click on page every 2 minutes to keep session alive
  performSessionClick(); // Click immediately
  calendarClickInterval = setInterval(performSessionClick, 120000); // 120000ms = 2 minutes
  
  // Start timer display
  startTimerDisplay();
  
  chrome.runtime.sendMessage({
    action: 'statusChange',
    status: 'monitoring',
    message: 'Scanning every second...'
  });
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  if (calendarClickInterval) {
    clearInterval(calendarClickInterval);
    calendarClickInterval = null;
  }
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isMonitoring = false;
  stopAlarm();
  
  updateStatus('idle', 'IDLE - Stopped');
  addLog('🛑 ===== MONITORING STOPPED =====', '#ff6b6b');
  
  chrome.runtime.sendMessage({
    action: 'statusChange',
    status: 'idle',
    message: 'Monitoring stopped'
  });
}

// ===== CRITICAL: Click on page to keep session alive =====
function performSessionClick() {
  if (!isMonitoring || dateClicked) return;
  
  clickCounter++;
  lastClickTime = Date.now();
  
  // Update counters
  document.getElementById('clickCount').textContent = clickCounter;
  
  // Update last click time
  const lastClickEl = document.getElementById('lastClickTime');
  if (lastClickEl) {
    const now = new Date();
    lastClickEl.textContent = now.toLocaleTimeString();
  }
  
  // Try to find calendar and click on a date
  const calendar = findCalendar();
  
  if (calendar) {
    // Find all date cells
    const dateCells = calendar.querySelectorAll('td');
    let clicked = false;
    
    // Try to click on a date cell (skip first few which might be headers)
    for (let i = 7; i < dateCells.length; i++) {
      const cell = dateCells[i];
      const text = cell.textContent.trim();
      
      if (/^\d+$/.test(text)) {
        // Click on this date cell
        cell.click();
        addLog(`🖱️ Session click #${clickCounter} - Clicked on date ${text}`, '#f39c12');
        clicked = true;
        break;
      }
    }
    
    // If no date cells found, click on the calendar itself
    if (!clicked) {
      calendar.click();
      addLog(`🖱️ Session click #${clickCounter} - Clicked on calendar`, '#f39c12');
    }
  } else {
    // If no calendar found, click on page header
    const headers = document.querySelectorAll('h1, h2, h3, .header, .title');
    if (headers.length > 0) {
      headers[0].click();
      addLog(`🖱️ Session click #${clickCounter} - Clicked on header`, '#f39c12');
    } else {
      // Last resort - click on body
      document.body.click();
      addLog(`🖱️ Session click #${clickCounter} - Clicked on page`, '#f39c12');
    }
  }
  
  // Send silent fetch request as backup
  try {
    fetch(window.location.href, { 
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'include'
    }).catch(() => {});
  } catch (e) {}
}

let timerInterval = null;

function startTimerDisplay() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (!isMonitoring) return;
    
    // Update session timer
    const sessionTimer = document.getElementById('sessionTimer');
    if (sessionTimer) {
      const seconds = Math.floor((Date.now() - lastClickTime) / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      sessionTimer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      
      // Color code based on time since last click
      if (minutes >= 2) {
        sessionTimer.style.background = '#ff6b6b'; // Red - should have clicked
      } else if (minutes >= 1) {
        sessionTimer.style.background = '#f39c12'; // Orange - due soon
      } else {
        sessionTimer.style.background = '#10b981'; // Green - good
      }
    }
    
    // Update next click display
    const nextClickEl = document.getElementById('nextClick');
    if (nextClickEl) {
      const secondsSinceLastClick = Math.floor((Date.now() - lastClickTime) / 1000);
      const secondsUntilNext = Math.max(0, 120 - secondsSinceLastClick);
      const minutesUntilNext = Math.floor(secondsUntilNext / 60);
      const remainingSeconds = secondsUntilNext % 60;
      nextClickEl.textContent = `Next click: ${minutesUntilNext}m ${remainingSeconds}s`;
    }
  }, 1000);
}

function checkForAvailableDates() {
  if (!isMonitoring || dateClicked) return;
  
  checkCount++;
  document.getElementById('panelChecks').textContent = checkCount;
  
  chrome.runtime.sendMessage({
    action: 'updateStats',
    checkCount: checkCount,
    foundCount: foundCount
  });
  
  // Show scan status every 10 scans
  if (checkCount % 10 === 0) {
    addLog(`🔍 Scan #${checkCount} - Checking calendar...`, '#95a5a6');
  }
  
  // Find calendar
  const calendar = findCalendar();
  if (!calendar) {
    if (checkCount % 30 === 0) {
      addLog('⏳ No calendar found yet - waiting...', '#95a5a6');
    }
    return;
  }
  
  // Find selectable dates (BLACK numbers only)
  const selectableDates = findSelectableDates(calendar);
  
  if (selectableDates.length > 0) {
    handleSelectableDates(selectableDates);
  }
}

function findCalendar() {
  const tables = document.querySelectorAll('table');
  
  for (let table of tables) {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) continue;
    
    // Check for day headers (S, M, T, W, T, F, S)
    const firstRow = rows[0];
    const headers = firstRow.querySelectorAll('th, td');
    
    let headerCount = 0;
    const dayPattern = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    headers.forEach((cell, index) => {
      if (index < dayPattern.length && cell.textContent.trim() === dayPattern[index]) {
        headerCount++;
      }
    });
    
    if (headerCount >= 3) {
      return table;
    }
  }
  
  return null;
}

function findSelectableDates(calendar) {
  const cells = calendar.querySelectorAll('td');
  const selectableDates = [];
  
  cells.forEach(cell => {
    const text = cell.textContent.trim();
    
    if (/^\d+$/.test(text)) {
      const num = parseInt(text);
      if (num >= 1 && num <= 31) {
        
        const style = window.getComputedStyle(cell);
        const color = style.color;
        
        // Check if date is UNAVAILABLE
        const isWeekend = cell.classList.contains('weekend');
        const isHoliday = cell.classList.contains('holiday');
        const isDisabled = cell.classList.contains('disabled');
        
        // Check if color is BLACK (selectable)
        const isBlackColor = 
          color.includes('0, 0, 0') ||
          color === 'rgb(0, 0, 0)';
        
        // Date is selectable ONLY if it's black and not disabled
        if (isBlackColor && !isWeekend && !isHoliday && !isDisabled) {
          selectableDates.push(cell);
        }
      }
    }
  });
  
  // Sort by date number (earliest first)
  selectableDates.sort((a, b) => parseInt(a.textContent) - parseInt(b.textContent));
  
  return selectableDates;
}

function handleSelectableDates(dates) {
  foundCount++;
  dateClicked = true;
  
  document.getElementById('panelFound').textContent = foundCount;
  updateStatus('found', '🎯 DATES AVAILABLE!');
  
  addLog('🎯🎯🎯 ===== SELECTABLE DATES FOUND ===== 🎯🎯🎯', '#ff6b6b');
  addLog(`🔥 Found ${dates.length} selectable dates!`, '#ffd700');
  
  dates.forEach((date, index) => {
    addLog(`   ✅ Date ${index + 1}: ${date.textContent}`, '#43e97b');
  });
  
  // Select the earliest date
  const selectedDate = dates[0];
  addLog(`✅ Selected date: ${selectedDate.textContent}`, '#43e97b');
  
  // Highlight the selected date
  selectedDate.style.backgroundColor = '#ffeb3b';
  selectedDate.style.border = '4px solid #f39c12';
  selectedDate.style.fontWeight = 'bold';
  selectedDate.style.animation = 'pulse 0.5s infinite';
  
  if (settings.scrollEnabled) {
    selectedDate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    addLog('📜 Scrolled to date', '#4facfe');
  }
  
  // PLAY ALARM MP3
  if (settings.soundEnabled) {
    playAlarmMP3();
    addLog('🔊🔊 PLAYING ALARM - DATES AVAILABLE!', '#ff6b6b');
  }
  
  // Send notifications
  if (settings.notifyEnabled) {
    chrome.runtime.sendMessage({ 
      action: 'appointmentFound',
      emails: settings.emails,
      date: selectedDate.textContent
    });
    
    if (Notification.permission === 'granted') {
      new Notification('🎯 QVC APPOINTMENT AVAILABLE!', {
        body: `Date ${selectedDate.textContent} is selectable!`,
        icon: 'icon128.png',
        requireInteraction: true
      });
    }
    
    addLog(`📧 Email alert for ${settings.emails.length} recipient(s)`, '#4facfe');
  }
  
  chrome.runtime.sendMessage({
    action: 'statusChange',
    status: 'found',
    message: `✅ Date ${selectedDate.textContent} available!`
  });
  
  // Click the selected date
  setTimeout(() => {
    addLog(`👆 Clicking date ${selectedDate.textContent}...`, '#43e97b');
    selectedDate.click();
    
    // Wait for time slots
    setTimeout(() => {
      findAndSelectTimeSlot();
    }, 3000);
  }, 2000);
}

function findAndSelectTimeSlot() {
  if (timeClicked) return;
  
  addLog('⏰ Looking for available time slots...', '#4facfe');
  
  const timeElements = document.querySelectorAll('button, div, span');
  const availableTimes = [];
  
  timeElements.forEach(el => {
    const text = el.textContent.trim();
    if (text.match(/^\d{1,2}:\d{2}$/)) {
      const isUnavailable = 
        el.classList.contains('unavailable') || 
        el.classList.contains('disabled') ||
        el.disabled;
      
      if (!isUnavailable) {
        availableTimes.push(el);
      }
    }
  });
  
  if (availableTimes.length > 0) {
    timeClicked = true;
    
    addLog(`⏰ Found ${availableTimes.length} available time slots!`, '#43e97b');
    
    // Select first time
    const selectedTime = availableTimes[0];
    addLog(`✅ Selected time: ${selectedTime.textContent}`, '#43e97b');
    
    selectedTime.style.backgroundColor = '#10b981';
    selectedTime.style.color = 'white';
    selectedTime.style.fontWeight = 'bold';
    
    setTimeout(() => {
      addLog(`👆 Clicking time slot ${selectedTime.textContent}...`, '#43e97b');
      selectedTime.click();
      
      setTimeout(() => {
        clickSubmitButton();
      }, 2000);
    }, 1000);
    
  } else {
    addLog('⏳ No time slots yet - waiting...', '#95a5a6');
    setTimeout(findAndSelectTimeSlot, 2000);
  }
}

function clickSubmitButton() {
  addLog('🔍 Looking for Submit button...', '#4facfe');
  
  const buttons = document.querySelectorAll('button');
  let submitButton = null;
  
  buttons.forEach(btn => {
    const text = btn.textContent.trim().toLowerCase();
    if (text === 'next' || text.includes('next') || text === 'submit') {
      submitButton = btn;
    }
  });
  
  if (submitButton) {
    addLog('✅ Clicking Submit button', '#43e97b');
    submitButton.click();
    
    showSuccessMessage();
    
    setTimeout(() => {
      stopMonitoring();
      addLog('✨✨✨ APPOINTMENT BOOKED! ✨✨✨', '#ffd700');
    }, 2000);
    
  } else {
    addLog('⚠️ Submit button not found - retrying...', '#f39c12');
    setTimeout(clickSubmitButton, 1000);
  }
}

function playAlarmMP3() {
  stopAlarm();
  
  try {
    const audioUrl = chrome.runtime.getURL('alarm.mp3');
    audio = new Audio(audioUrl);
    audio.loop = true;
    audio.volume = 1.0;
    
    audio.play().catch(e => {
      console.log('MP3 failed, using fallback');
      playFallbackAlarm();
    });
    
    addLog('🎵 Playing alarm.mp3', '#ff6b6b');
    
  } catch (e) {
    playFallbackAlarm();
  }
}

function playFallbackAlarm() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    function playBeep() {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.5;
      osc.start();
      osc.stop(audioContext.currentTime + 0.2);
    }
    
    playBeep();
    alarmInterval = setInterval(playBeep, 1000);
    
  } catch (e) {}
}

function stopAlarm() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
  }
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

function showSuccessMessage() {
  const success = document.createElement('div');
  success.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px 60px;
    border-radius: 20px;
    z-index: 1000000;
    font-size: 28px;
    font-weight: bold;
    text-align: center;
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
    border: 4px solid white;
    animation: popIn 0.5s ease;
  `;
  
  success.innerHTML = `✅ APPOINTMENT BOOKED!`;
  document.body.appendChild(success);
  
  setTimeout(() => success.remove(), 5000);
}

function addLog(message, color = '#ffffff') {
  const logContainer = document.getElementById('logContainer');
  const logCount = document.getElementById('logCount');
  
  if (!logContainer) return;
  
  const entry = document.createElement('div');
  entry.style.cssText = `
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 10px;
    animation: fadeIn 0.2s ease;
    color: ${color};
    white-space: pre-wrap;
    word-break: break-word;
  `;
  
  const time = new Date().toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  entry.innerHTML = `<span style="color: #7f8c8d;">[${time}]</span> ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // Update log count
  if (logCount) {
    logCount.textContent = `${logContainer.children.length} events`;
  }
  
  // Keep last 50 logs
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

function updateStatus(type, text) {
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  if (dot && statusText) {
    const colors = {
      idle: '#f59e0b',
      active: '#10b981',
      found: '#ef4444'
    };
    
    dot.style.background = colors[type] || colors.idle;
    statusText.textContent = text;
  }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(5px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes popIn {
    0% { transform: translate(-50%, -50%) scale(0); }
    70% { transform: translate(-50%, -50%) scale(1.1); }
    100% { transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(style);

// Request notification permission
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Listen for auto-start trigger from Playwright automation
window.addEventListener('qvc-auto-start', () => {
  console.log('QVC Pro Monitor: Auto-start triggered by automation');
  if (!isMonitoring) {
    startMonitoring();
  }
});

console.log('QVC Pro Monitor loaded - Working Version v7.0');