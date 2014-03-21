function setUp(){
  utilities.listenForMessage("content", "mainpanel", "lists", showLists);
  document.forms["text"].addEventListener('submit', processForm, false);
}

$(setUp);

function showLists(lists){
  var $tabsDiv = $("#tabs");
  //clear out content from past clicks
  $tabsDiv.empty();
  
  
  var $div = $("<div></div>");
  var $ul = $("<ul></ul>");
  
  $tabsDiv.append($div);
  $div.append($ul);
  
  for (var i = 0; i<lists.length; i++){
    var list = lists[i];
    var newLI = $("<li><a href='#fragment-"+i+"' data-type='listSelector' data-index='"+i+"'>List "+i+"</a></li>"); 
    console.log(newLI);
    $ul.append(newLI);
    var contentString = ""
    for (var j = 0; j<list.length; j++){
      contentString+="<div>"+list[j]+"</div>";
    }
    console.log(contentString);
    var newList = $("<div id='fragment-"+i+"'>"+contentString+"</div>");
    console.log(newList); 
    $div.append(newList);
  }
  $div.tabs();
  setUpListeners();
}

function setUpListeners(){
  $as = $('[data-type="listSelector"]');
  $as.click(sendListMessage);
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
