chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'appointmentFound') {
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '🎯 QVC APPOINTMENT AVAILABLE!',
      message: `Date ${request.date || ''} found! Notifying ${request.emails?.length || 0} email(s)`,
      priority: 2
    });
    
    // Log emails (in real implementation, you'd send to your email service)
    if (request.emails && request.emails.length > 0) {
      console.log('Sending email alerts to:', request.emails);
      // Here you would integrate with an email service
    }
  }
  
  if (request.action === 'bookingConfirmed') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '✅ APPOINTMENT BOOKED!',
      message: `Successfully booked! Notification sent to ${request.emails?.length || 0} email(s)`,
      priority: 2
    });
  }
  
  sendResponse({ received: true });
});

console.log('QVC Monitor background service started');