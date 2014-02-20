//open mainpanel
console.log("test");
(function() {
  console.log("mainpanel stuff");
  var panelWindow = undefined;

  function openMainPanel(hide) {
    // check if panel is already open
    if (typeof panelWindow == 'undefined' || panelWindow.closed) {

      chrome.windows.create({url: chrome.extension.getURL(
          'pages/mainpanel.html'), width: 500, height: 800, focused: true,
          type: 'panel'}, function(winInfo) {
        panelWindow = winInfo;
      });
    } else {
      chrome.windows.update(panelWindow.id, {focused: true});
    }
  }

  chrome.browserAction.onClicked.addListener(function(tab) {
    openMainPanel();
  });

  chrome.windows.onRemoved.addListener(function(winId) {
    if (typeof panelWindow == 'object' && panelWindow.id == winId) {
      panelWindow = undefined;
    }
  });

  openMainPanel();
})();
