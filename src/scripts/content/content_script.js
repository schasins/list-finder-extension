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
  var xpathList = [];
  for (var i = 0; i<xpath.length; i++){
    var char = xpath[i];
    if (char == "[") {
      var start = i;
      var end = start + 1;
      while (xpath[end] != "]") {
	end += 1;
      }
      var prefix = xpath.slice(0,start); //don't include brackets
      var suffix = xpath.slice(end+1,xpath.length); //don't include brackets
      var slashIndex = prefix.lastIndexOf("/")
      var nodeName = prefix.slice(slashIndex+1,prefix.length);
      var index = xpath.slice(start+1,end);
      var listNodes = findItems(prefix,suffix);
      if (listNodes){
	xpathList.push({"nodeName": nodeName, "index": index, "iterable": true});
	var listTexts = _.map(listNodes,function(a){return $(a).text();});
	possibleLists.push(listTexts);
      }
      else{
	xpathList.push({"nodeName": nodeName, "index": index, "iterable": false});
      }
    }
  }
  
  //the list that can iterate over multiple parts of the xpath
  //captures, for instance, all items in all menus instead of 
  //2nd in each menu or all in one menu
  //or both vertically and horizontally in a table, as Google sub-results
  var listNodes = findItemsUsefulIterations(xpathList);
  if (listNodes){
    var listTexts = _.map(listNodes,function(a){return $(a).text();});
    possibleLists.push(listTexts);
  }
  
  console.log(possibleLists);
  return possibleLists;
}

function findItemsUsefulIterations(xpathList){
  console.log(xpathList);
  var listNodes = findItemsUsefulIterationsRecurse("HTML", xpathList); //TODO: change this to reflect page case?
  if (listNodes.length > 1){
    console.log(listNodes);
    for (var i = 0; i<listNodes.length; i++){
      var listNode = listNodes[i];
      $(listNode).css('background-color', 'blue');
    }
    return listNodes;
  }
}

function findItemsUsefulIterationsRecurse(prefix,suffixList){
  for (var i = 0; i<suffixList.length; i++){
    suffixItem = suffixList[i];
    if (suffixItem["iterable"]){
      //processing
      var truncatedSuffixList = suffixList.slice(i+1,suffixList.length);
      console.log(prefix);
      var nodes = xPathToNodes(prefix);
      console.log(nodes);
      var node = nodes[0];
      if (!node){
	//sometimes even though the original sibling has a given child,
	//this one might not
	//example, 5 menus, one of which doesn't have any items
	//the other menus may all have ul child
	//the empty one does not.  should just skip
	//can't descend this branch of the tree since node doesn't exist
	return [];
      }
      var targetName = suffixItem["nodeName"].toLowerCase();
      var children = node.childNodes;
      var count = 0;
      var foundNodes = [];
      for (var i = 0; i<children.length; i++){
	var child = children[i];
	var name = child.nodeName;
	if (targetName === name.toLowerCase()){
	  count += 1;
	  var newFoundNodes = findItemsUsefulIterationsRecurse(prefix+"/"+targetName+"["+count+"]",truncatedSuffixList);
	  foundNodes = foundNodes.concat(newFoundNodes);
	}
      }
      return foundNodes;
    }
    else{
      prefix = prefix+"/"+suffixItem["nodeName"]+"["+suffixItem["index"]+"]";
    }
  }
  
  //if we made it through the for loop, there must not have been any
  //new recursion points, so we're at the end of the xpath
  //go ahead and get this xpath's node
  var newListNodes = xPathToNodes(prefix);
  var newListNode = newListNodes[0];
  if (newListNode){
    return[newListNode];
  }
  return [];
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
    console.log('xPath throws error when evaluated', xpath);
  }
  return [];
}
