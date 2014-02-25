function setUp(){
  console.log("Setting up.");
  chrome.runtime.onMessage.addListener(function(msg, sender) {
    /* First, validate the message's structure */
    console.log(msg);
    console.log(sender);
    if (msg.from && (msg.from === "content")
            && msg.subject && (msg.subject = "lists")) {
        /* Enable the page-action for the requesting tab */
        showLists(msg.lists);
    }
  });
}

$(setUp);

function showLists(lists){
  var $tabs = $("#tabs");
  var $ul = $("ul");
  
  //clear out content from past clicks
  $tabs.empty();
  $tabs.append($ul);
  
  for (var i = 0; i<lists.length; i++){
    var list = lists[i];
    var newLI = $("<li><a href='#fragment-"+i+"'>List "+i+"</a></li>"); 
    console.log(newLI);
    $ul.append(newLI);
    var contentString = ""
    for (var j = 0; j<list.length; j++){
      contentString+="<div>"+list[j]+"</div>";
    }
    console.log(contentString);
    var newList = $("<div id='fragment-"+i+"'>"+contentString+"</div>");
    console.log(newList); 
    $tabs.append(newList);
  }
  $tabs.tabs();
}
