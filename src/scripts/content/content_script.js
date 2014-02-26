var currentlyOn = false;

function setUp(){
  console.log("Setting up.");
  
  document.addEventListener('click', findLists, false);

  chrome.extension.onRequest.addListener(function(msg, sender) {
    console.log(msg);
    if (msg.from && (msg.from === "background")
            && msg.subject && (msg.subject = "currentlyOn")) {
        currentlyOn = msg.currentlyOn;
    }
  });
  
  chrome.runtime.sendMessage({
	from: "content",
	subject: "requestCurrentlyOn"
  });
}

$(setUp);


function findLists(event){
  if (!currentlyOn){
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  var $target = $(event.target);
  var text = $target.text();
  
  //must pretend we didn't get this text from a click, but may have
  //observed it elsewhere (user spreadsheet, copied or typed in)
  //having only the text, try to guess the node
  
  var matchedNodes = $('*').filter(function(){ return $(this).text() === text;});
  matchedNodes.css('background-color', 'red');
  var possibleLists = [];
  for (var i = 0; i<matchedNodes.length; i++){
    var newLists = findList(matchedNodes[i]);
    //keep in mind that we may have both div and a div's a or something
    //so we may get different matchedNodes turning up same lists.  check
    for (var j = 0; j<newLists.length; j++){
      var newList = newLists[j];
      if (arrayNotInArrayOfArrays(newList,possibleLists)){
	possibleLists.push(newList);
      }
    }
  }
  chrome.runtime.sendMessage({
    from: "content",
    subject: "lists",
    lists: possibleLists
  });
}

function findList(node){
  var xpath = nodeToXPath(node);
  console.log(xpath);
  var possibleLists = [];
  for (var i = 0; i<xpath.length; i++){
    var char = xpath[i];
    if (isNumber(char)) {
      var j = i + 1; // xpath.slice(i,j) is just char i
      while (isNumber(xpath.slice(i,j+1))) {
	j += 1;
      }
      // + and - 1 below to get rid of the brackets
      var listNodes = findItems(xpath.slice(0,i-1),xpath.slice(j+1,xpath.length));
      if (listNodes){
	var listTexts = _.map(listNodes,function(a){return $(a).text();});
	possibleLists.push(listTexts);
      }
    }
  }
  console.log(possibleLists);
  return possibleLists;
}

function findItems(prefix,suffix){
  console.log("******************************");
  console.log(prefix+"[*]"+suffix);
  var slashIndex = prefix.lastIndexOf("/")
  var parentXpath = prefix.slice(0,slashIndex);
  var nodes = xPathToNodes(parentXpath);
  
  var node = nodes[0];
  
  var targetName = prefix.slice(slashIndex+1,prefix.length).toLowerCase();
  var listNodes = [];
  var children = node.childNodes;
  console.log(children);
  var count = 0;
  for (var i = 0; i<children.length; i++){
    var child = children[i];
    var name = child.nodeName;
    if (targetName === name.toLowerCase()){
      count += 1;
      var newListNodes = xPathToNodes(prefix+"["+count+"]"+suffix);
      var newListNode = newListNodes[0];
      if (newListNode){
	listNodes.push(newListNode);
      }
    }
  }
  if (listNodes.length > 1){
    console.log(listNodes);
    for (var i = 0; i<listNodes.length; i++){
      var listNode = listNodes[i];
      $(listNode).css('background-color', 'blue');
    }
    return listNodes;
  }
}

/*** HELPER FUNCTIONS ***/

function arrayNotInArrayOfArrays(array,listOfArrays){
  for (var i = 0; i< listOfArrays.length; i++){
    var currArray = listOfArrays[i];
    if (currArray.length != array.length){
      continue;
    }
    var matched = true;
    for (var j = 0; j<currArray.length; j++){
      if (array[j] != currArray[j]){
	matched = false;
	break;
      }
    }
    if (matched){
      return false;
    }
  }
  return true;
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function nodeToXPath(element) {
  //  we want the full path, not one that uses the id since ids can change
  //  if (element.id !== '')
  //    return 'id("' + element.id + '")';
  if (element.tagName.toLowerCase() === 'html'){
    return element.tagName;
  }

  // if there is no parent node then this element has been disconnected
  // from the root of the DOM tree
  if (!element.parentNode){
    return '';
  }

  var ix = 0;
  var siblings = element.parentNode.childNodes;
  for (var i = 0, ii = siblings.length; i < ii; i++) {
    var sibling = siblings[i];
    if (sibling === element){
      return nodeToXPath(element.parentNode) + '/' + element.tagName +
	     '[' + (ix + 1) + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName){
      ix++;
    }
  }
}

function xPathToNodes(xpath) {
  try {
    var q = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE,
                              null);
    var results = [];

    var next = q.iterateNext();
    while (next) {
      results.push(next);
      next = q.iterateNext();
    }
    return results;
  } catch (e) {
    getLog('misc').error('xPath throws error when evaluated', xpath);
  }
  return [];
}
