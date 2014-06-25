function setUp(){
  utilities.listenForMessage("content", "mainpanel", "list", showList);
  utilities.listenForMessage("content", "mainpanel", "partialList", showPartialList);
  utilities.listenForMessage("content", "mainpanel", "nextButtonDataCollectionModeOn", nextButtonDataCollectionModeOn);
  utilities.listenForMessage("content", "mainpanel", "requestNextButtonDataCollection", nextButtonDataCollectionNotify);
  utilities.listenForMessage("content", "mainpanel", "nextButtonDataCollectionModeOff", nextButtonDataCollectionModeOff);
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

var whole_list = [];
var prev_list = [];

function showPartialList(list){
  if (arraysEqual(list,prev_list)){
    return;
  }
  whole_list = whole_list.concat(list);
  showList(whole_list);
  prev_list = list;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
  whole_list = [];
  utilities.sendMessage("mainpanel", "content", "run", "");
}

var nextButtonDataCollectionMode = false;
var nextButtonDataCollectionData = null;
var nextButtonDataCollectionItemLimit = 1000;

function nextButtonDataCollectionModeOn(data){
  nextButtonDataCollectionMode = true;
  nextButtonDataCollectionData = data;
  nextButtonDataCollectionItemLimit = data["item_limit"];
}

function nextButtonDataCollectionModeOff(){
  nextButtonDataCollectionMode = false;
}

function nextButtonDataCollectionNotify(){
  if (nextButtonDataCollectionMode){
    if (whole_list.length < nextButtonDataCollectionItemLimit){
      utilities.sendMessage ("mainpanel", "content", "nextButtonDataCollection", nextButtonDataCollectionData);
    }
    else {
      nextButtonDataCollectionMode = false;
    }
  }
}
