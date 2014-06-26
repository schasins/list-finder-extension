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
    contentString+="<div>"+_.escape(list[j])+"</div>";
  }
  $listDiv.html(contentString);
}

var whole_list = [];
var prev_list = [];

function showPartialList(list){
  if (_.isEqual(list,prev_list)){
    return;
  }
  whole_list = whole_list.concat(list);
  showList(whole_list);
  prev_list = list;
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

var next_button_data_collection_mode = false;
var next_button_data_collection_data = null;
var next_button_data_collection_item_limit = 100000;

function nextButtonDataCollectionModeOn(data){
  next_button_data_collection_mode = true;
  next_button_data_collection_data = data;
  nextButtonDataCollectionItemLimit = data["item_limit"];
}

function nextButtonDataCollectionModeOff(){
  next_button_data_collection_mode = false;
}

function nextButtonDataCollectionNotify(){
  if (next_button_data_collection_mode){
    if (whole_list.length < next_button_data_collection_item_limit){
      utilities.sendMessage ("mainpanel", "content", "nextButtonDataCollection", next_button_data_collection_data);
    }
    else {
      next_button_data_collection_mode = false;
    }
  }
}
