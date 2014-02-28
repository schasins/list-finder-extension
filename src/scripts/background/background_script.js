//open mainpanel

var currentlyOn = false;

(function() {
  var panelWindow = undefined;

  function openMainPanel(hide) {
    // check if panel is already open
    if (typeof panelWindow == 'undefined' || panelWindow.closed) {

      chrome.windows.create({
		  url: chrome.extension.getURL('pages/mainpanel.html'), 
          width: 500, height: 800, left: 0, top: 0, 
          focused: true,
          type: 'panel'
          }, 
          function(winInfo) {panelWindow = winInfo;}
      );
    } else {
      chrome.windows.update(panelWindow.id, {focused: true});
    }
  }

  chrome.browserAction.onClicked.addListener(function(tab) {
    if (!currentlyOn){
      openMainPanel();
    }
    currentlyOn = !currentlyOn;
    console.log("currently on: "+currentlyOn);
    sendCurrentlyOn();
  });
  
  function sendCurrentlyOn(){
    chrome.tabs.getSelected(null, function(tab) {
      chrome.tabs.sendRequest(tab.id, {from: 'background', subject: 'currentlyOn', currentlyOn: currentlyOn});
    });
  }
  
  chrome.runtime.onMessage.addListener(function(msg, sender) {
    console.log(msg);
    if (msg.from && (msg.from === "content")
            && msg.subject && (msg.subject === "currentlyOnRequest")) {
        sendCurrentlyOn();
    }
  });

  chrome.windows.onRemoved.addListener(function(winId) {
    if (typeof panelWindow == 'object' && panelWindow.id == winId) {
      panelWindow = undefined;
    }
  });

  //openMainPanel();
  
  
})();

