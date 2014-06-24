function setUp(){
  utilities.listenForMessage("content", "mainpanel", "list", showList);
  $(".radio").click(processButton);
  $("#run").click(processRun);
  document.forms["itemLimit"].addEventListener('submit', processItemLimit, false);
  $("#tabs").tabs();
  $("#radio").buttonset();
  $("button").button();
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

function processButton(event){
  var $target = $(event.target);
  var id = $target.attr('id');
  utilities.sendMessage("mainpanel", "content", "nextButtons", id);
}

function processItemLimit(event){
  var limit = document.forms["itemLimit"]["itemLimit"].value;
  utilities.sendMessage ("mainpanel", "content", "itemLimit", limit);
  return false;
}

function processRun(event){
  utilities.sendMessage("mainpanel", "content", "run", "");
}
