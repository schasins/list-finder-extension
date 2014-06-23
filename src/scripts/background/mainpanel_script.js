function setUp(){
  utilities.listenForMessage("content", "mainpanel", "list", showList);
  document.forms["text"].addEventListener('submit', processForm, false);
  $("#tabs").tabs();
}

$(setUp);

function showList(list){
  var $listDiv = $("#list");
  var contentString = ""
  for (var j = 0; j<list.length; j++){
    contentString+="<div>"+list[j]+"</div>";
  }
  $listDiv.html(contentString);
}

function sendListMessage(event){
  var target = event.target;
  var index = $(target).data("index");
  utilities.sendMessage ("mainpanel", "content", "listsIndex", index);
}

function processForm(){
  var text = document.forms["text"]["text"].value;
  utilities.sendMessage ("mainpanel", "content", "processText", text);
  event.returnValue=false;
  return false;
}
