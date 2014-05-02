var currentlyOn = false;

//a list of lists of node lists
//each item is a list of node lists with the same text equivalent
var nodeLists = null;
var currHighlightedIndex = 0;

function setUp(){
  document.addEventListener('click', findListsWithEvent, true);
  
  utilities.listenForMessage("background", "content", "currentlyOn", function(msg_co){currentlyOn = msg_co;});
  utilities.listenForMessage("mainpanel", "content", "processText", findLists);
  utilities.listenForMessage("mainpanel", "content", "listsIndex", highlightIndex);

  utilities.sendMessage("content", "background", "requestCurrentlyOn", "");
}

$(setUp);

function findListsWithEvent(event){
  if (!currentlyOn){
    console.log("returning: "+currentlyOn);
    return;
  }
  
  event.stopPropagation();
  event.preventDefault();
  var $target = $(event.target);
  var text = $target.text();
  findLists(text);
}

function findLists(text){

  //must pretend we didn't get this text from a click, but may have
  //observed it elsewhere (user spreadsheet, copied or typed in)
  //having only the text, try to guess the node
  
  var matchedNodes = $('*').filter(function(){ return $(this).text() === text;});
  matchedNodes.css('outline', 'solid red');
  var possibleLists = [];
  for (var i = 0; i<matchedNodes.length; i++){
    var newLists = findList(matchedNodes[i]);
    //keep in mind that we may have both div and a div's a or something
    //so we may get different matchedNodes turning up same lists.  check
    possibleLists = possibleLists.concat(newLists);
  }
  
  console.log("possibleLists --- all lists we've generated");
  console.log(possibleLists);
  
  //global nodeLists so that if we get messages from mainpanel, can highlight the relevant list
  nodeLists = [];
  textLists = [];
  for (var i in possibleLists){
    var possibleList = possibleLists[i];
    var textList = _.map(possibleList,function(a){return $(a).text();});
    var index = indexOfArrayInArrayOfArrays(textList, textLists);
    if (index == -1){
      textLists.push(textList);
      nodeLists.push([possibleList]);
    }
    else{
      nodeLists[index].push(possibleList);
    }
  }
  
  //for now highlight the first text list's node lists
  if (nodeLists.length > 0){
    highlightIndex(0);
  }
  
  console.log("final nodeLists");
  console.log(nodeLists);
  
  utilities.sendMessage("content", "mainpanel", "lists", textLists);
}

function highlightIndex(index){
  highlight(nodeLists[currHighlightedIndex],"initial");
  highlight(nodeLists[index],"blue");
  currHighlightedIndex = index;
}

function highlight(nodeLists,color){
  for (var i in nodeLists){
    var nodeList = nodeLists[i];
    $(nodeList).css('background-color', color);
  }
}

//the ideal interface, accepting a set of positive examples, set of neg
function getCandidateDomains(positiveNodes, negativeNodes){
  var node = null;
  if (positiveNodes.length > 0){
    node = positiveNodes[0];
  }
  return findList(node);
}

function findList(node){
  if (node == null){
    return [];
  }
  var xpath = nodeToXPath(node);
  //console.log(xpath);
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
        possibleLists.push(listNodes);
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
  var newLists = findItemsUsefulIterations(xpathList);
  possibleLists = possibleLists.concat(newLists);
  
  //all the above nodes were retrieved based on having similar xpaths
  //now let's use other attributes
  //font size, color, x coord, y coord, font family.  what else?
  var newLists = findItemsVisualFeatures(possibleLists);
  possibleLists = possibleLists.concat(newLists);
  
  newLists = findItemsClass(possibleLists);
  possibleLists = possibleLists.concat(newLists);

  return possibleLists;
}

function findItemsClass(priorLists){
  var class_lists = [];
  for (var i in priorLists){
    var list = priorLists[i];
    class_lists = class_lists.concat(findItemsClassOneList(list));
  }
  return class_lists;
}

function findItemsClassOneList(list){
  var class_lists = [];
  for (var i = 0; i<list.length; i++){
    var item = list[i];
    var classes = item.className.match(/\S+/g);
    if (classes === null){
      classes = [];
    }
    class_lists.push(classes);
  }
  var shared_classes = _.intersection.apply(_,class_lists);
  if (shared_classes.length < 1){
    return;
  }
  var new_lists = getElementsWithClasses(shared_classes, list);
  return new_lists;
}

function getElementsWithClasses(classes, original_list){
  var new_lists = [];
  first_shared_parent = $(original_list[0]).parents().filter(
    function() { 
      var potential_parent = this;
      return _.reduce(original_list.slice(1,original_list.length),
        function(acc,elem){return (acc && $.contains(potential_parent, elem));},true);}).first();
  var selector = "."+classes.join(".");
  var new_list = first_shared_parent.find(selector);
  new_lists.push(new_list);
  var parents = first_shared_parent.parents();
  var new_list_length = 0;
  for (var i = 0; i<parents.length; i++){
    var parent = $(parents[i]);
      var new_list = parent.find(selector);
      if (new_list.length > new_list_length){
        console.log("New class-based list.");
        console.log(selector);
        console.log(new_list);
        new_lists.push(new_list);
        new_list_length = new_list.length;
      }
  }
  return new_lists;
}

function findItemsVisualFeatures(priorLists){
  var visual_lists = [];
  for (var i in priorLists){
    var list = priorLists[i];
    visual_lists = visual_lists.concat(findItemsVisualFeaturesOneList(list));
  }
  return visual_lists;
}

function findItemsVisualFeaturesOneList(list){
  var visual_features = [];
  for (var i = 0; i<list.length; i++){
    var item = list[i];
    var item_features = {
      "original_list": list,
      "tag": item.tagName,
      "top": getFeature(item, "top"), 
      "right": getFeature(item, "right"), 
      "bottom": getFeature(item, "bottom"), 
      "left": getFeature(item, "left"), 
      "height": getFeature(item, "height"),
      "width": getFeature(item, "width"),
      "font-size": getFeature(item, "font-size"),
      "font-family": getFeature(item, "font-family"),
      "font-style": getFeature(item, "font-style"),
      "font-weight": getFeature(item, "font-weight"),
      "color": getFeature(item, "color"),
      "background-color": getFeature(item, "background-color")};
    visual_features.push(item_features);
  }
  
  var new_lists = [];
  
  //font-family may be a good way to limit
  filter_features = ["font-family","color"];
  filter_features_to_use = {};
  for (var i = 0; i< filter_features.length; i++){
    var feature = filter_features[i];
    ffs = _.map(visual_features, function(feature_list){return feature_list[feature];});
    unique_ffs = _.uniq(ffs);
    if (unique_ffs.length == 1){
      filter_features_to_use[feature] = unique_ffs[0];
    }
  }
  
  single_feature_sufficient_features = ["top", "right", "bottom", "left"];
  for (var i = 0; i< single_feature_sufficient_features.length ; i++){
    var feature = single_feature_sufficient_features[i];
    fs = _.map(visual_features, function(feature_list){return feature_list[feature];});
    unique_fs = _.uniq(fs);
    if (unique_fs.length <= 3){
      new_lists.push(getElementsWith(feature,unique_fs, filter_features_to_use));
    }
  }
  
  console.log("visual features lists");
  console.log(new_lists);
  return new_lists;
}

function getFeature(element, feature){
  if (_.contains(["top", "right", "bottom", "left"],feature)){
    var rect = element.getBoundingClientRect();
    return rect[feature];
  }
  else{
    var style = window.getComputedStyle(element, null);
    return style.getPropertyValue(feature);
  }
}

function getElementsWith(feature, feature_value_list, filter_features){
  console.log("New visual features-based list.");
  console.log(feature+": "+feature_value_list);
  var nodes = document.getElementsByTagName("*");
  var node_list = [];
  for (i=0;i<nodes.length;i++){
    var node = nodes[i];
    var value = getFeature(node,feature);
    if (_.contains(feature_value_list, value)){
      var matched = true;
      for (var feat in filter_features){
        if (getFeature(node, feat) != filter_features[feat]){
          matched = false;
        }
      }
      if (matched){
        node_list.push(node);
      }
    }
  }
  console.log(node_list);
  return node_list;
}

function findItemsUsefulIterations(xpathList){
  //console.log(xpathList);
  var indexes = [];
  for (var i in xpathList){
    var item = xpathList[i];
    if (item["iterable"]){
      indexes.push(i);
    }
  }
  
  var subsets = combine(indexes,2);
  
  var nodeLists = [];
  for (var i in subsets){
    var subset = subsets[i];
    for (var j in indexes){
      var index = indexes[j];
      var item = xpathList[index];
      if (subset.indexOf(index) > -1){ //if subset contains index
	item["iterable"] = true;
      }
      else{
	item["iterable"] = false;
      }
    }
    var listNodes = findItemsUsefulIterationsRecurse("HTML", xpathList); //TODO: change this to reflect page case?
    if (listNodes.length > 1){
      nodeLists.push(listNodes);
    }
  }
  return nodeLists;
}

function findItemsUsefulIterationsRecurse(prefix,suffixList){
  for (var i = 0; i<suffixList.length; i++){
    suffixItem = suffixList[i];
    if (suffixItem["iterable"]){
      //processing
      var truncatedSuffixList = suffixList.slice(i+1,suffixList.length);
      //console.log(prefix);
      var nodes = xPathToNodes(prefix);
      //console.log(nodes);
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
  //console.log("******************************");
  //console.log(prefix+"[*]"+suffix);
  var slashIndex = prefix.lastIndexOf("/")
  var parentXpath = prefix.slice(0,slashIndex);
  var nodes = xPathToNodes(parentXpath);
  
  var node = nodes[0];
  
  var targetName = prefix.slice(slashIndex+1,prefix.length).toLowerCase();
  var listNodes = [];
  var children = node.childNodes;
  //console.log(children);
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
    return listNodes;
  }
}

/*** HELPER FUNCTIONS ***/

var combine = function(a, min) {
    var fn = function(n, src, got, all) {
        if (n == 0) {
            if (got.length > 0) {
                all[all.length] = got;
            }
            return;
        }
        for (var j = 0; j < src.length; j++) {
            fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        }
        return;
    }
    var all = [];
    for (var i = min; i < a.length; i++) {
        fn(i, a, [], all);
    }
    all.push(a);
    return all;
}

function indexOfArrayInArrayOfArrays(array,arrayOfArrays){
  for (var i = 0; i< arrayOfArrays.length; i++){
    var currArray = arrayOfArrays[i];
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
      return i;
    }
  }
  return -1;
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
