/**********************************************************************
 * Author: S. Chasins
 * A program that demonstrates the use of my tiny domain selector
 * language, and also the use of my algorithm for synthesizing
 * domain selector programs from a small number of demonstrations, 
 * where a demonstration is an indication that a given node belongs
 * in or out of the target domain.
 * A user's click is taken as an indication that an unhighlighted
 * node belongs in the domain, or that a highlighted node does not
 * belong in the domain.  The program synthesizes a new, updated
 * selector program after each click.
**********************************************************************/

/**********************************************************************
 * Listeners and general set up
**********************************************************************/

var currentlyOn = false;

function setUp(){
  document.addEventListener('mouseover', outline, true);
  document.addEventListener('mouseout', unoutline, true);
  document.addEventListener('click', newNode, true);
  
  utilities.listenForMessage("background", "content", "currentlyOn", function(msg_co){currentlyOn = msg_co;});

  utilities.sendMessage("content", "background", "requestCurrentlyOn", "");
}

$(setUp);

/**********************************************************************
 * Color guide to show users the node they're about to select
**********************************************************************/

var stored_background_colors = {};
var stored_outlines = {};

function outline(event){
  if (!currentlyOn){return;}
  
  var $target = $(event.target);
  stored_background_colors[$target.html()] = $target.css('background-color');
  stored_outlines[$target.html()] = $target.css('outline');
  $target.css('background-color', '#FFA245');
  $target.css('outline', '#FFA245 1px solid');
}

function unoutline(event){
  if (!currentlyOn){return;}
  
  var $target = $(event.target);
  $target.css('background-color', stored_background_colors[$target.html()]);
  $target.css('outline', stored_outlines[$target.html()]);
}

/**********************************************************************
 * Interpreter for our tiny language of domain selectors
**********************************************************************/

/* Available features:
 * tag
 * class
 * left, bottom, right, top
 * font-size, font-family, font-style, font-weight, color
 * background-color
 * xpath
 * Additional processing:
 * excludeFirst
*/

var features = ["tag", "class", 
  "left", "bottom", "right", "top", 
  "font-size", "font-family", "font-style", "font-weight", "color", 
  "background-color", 
  "xpath"];

function getFeature(element, feature){
  if (feature == "xpath"){
    return xPathToXPathList(nodeToXPath(element));
  }
  else if (_.contains(["tag","class"],feature)){
    return element[feature+"Name"];
  }
  else if (_.contains(["top", "right", "bottom", "left"], feature)){
    var rect = element.getBoundingClientRect();
    return rect[feature];
  }
  else{
    var style = window.getComputedStyle(element, null);
    return style.getPropertyValue(feature);
  }
}

function featureOk(feature, value, acceptable_values){
  if (feature == "xpath"){
    return _.reduce(acceptable_values, function(acc, av){ return (acc || (xPathMatch(av, value))); }, false);
  }
  else if (feature == "class"){
    //class doesn't have to be same, just has to include the target class
    //TODO: Decide if that's really how we want it
    return _.reduce(acceptable_values, function(acc, av){ return (acc || (value.indexOf(av) > -1)); }, false);
  }
  else {
    return _.contains(acceptable_values,value);
  }
}

function interpretListSelector(feature_dict, exclude_first){
  var nodes = document.getElementsByTagName("*");
  var node_list = [];
  for (i=0;i<nodes.length;i++){
    var node = nodes[i];
    var node_ok = true;
    for (var feature in feature_dict){
      var value = getFeature(node,feature);
      var acceptable_values = feature_dict[feature];
      if (!featureOk(feature, value, acceptable_values)){
        node_ok = false;
        break;
      }
    }
    if (node_ok){
      node_list.push(node);
    }
  }
  if (exclude_first && node_list.length > 0){
    return node_list.slice(1,node_list.length);
  }
  return node_list;
}

/**********************************************************************
 * Generating domain selector from user clicks
**********************************************************************/

var positive_nodes = [];
var negative_nodes = [];
var currentSelector = null;
var currentSelectorNodes = [];

function newNode(event){
  if (!currentlyOn){
    console.log("returning: "+currentlyOn);
    return;
  }
  
  //dehighlight our old list
  highlight(currentSelectorNodes,"initial");
  
  event.stopPropagation();
  event.preventDefault();
  
  var target = event.target;
  //decide whether it's a positive or negative example based on whether
  //it's in the old list
  if (_.contains(currentSelectorNodes,target)){
    negative_nodes.push(target);
  }
  else{
    positive_nodes.push(target);
  }
  
  //synthesize a selector with our new information (node)
  synthesizeSelector();
  
  //highlight our new list and send it to the panel
  highlight(currentSelectorNodes,"#9EE4FF");
  var textList = _.map(currentSelectorNodes,function(a){return $(a).text();});
  utilities.sendMessage("content", "mainpanel", "lists", [textList]);
  
  //log the new stuff
  console.log(currentSelector);
  console.log(currentSelectorNodes);
}

function synthesizeSelector(){
  //initialize empty feature dict
  var feature_dict = {};
  for (var i = 0; i < features.length; i++){
    feature_dict[features[i]] = [];
  }
  //add all positive nodes' values into the feature dict
  for (var i = 0; i < positive_nodes.length; i++){
    var node = positive_nodes[i];
    for (var j = 0; j < features.length; j++){
      var feature = features[j];
      var value = getFeature(node,feature);
      feature_dict[feature].push(value);
    }
  }
  
  //where a feature has more then 3 values, it's too much
  //also need to handle xpath differently, merging to xpaths with *s
  var filtered_feature_dict = {};
  for (var feature in feature_dict){
    var values = _.uniq(feature_dict[feature]);
    if (feature == "xpath"){
      filtered_feature_dict[feature] = xPathReduction(values);
    }
    if (values.length <= 3 && values.length != positive_nodes.length){
        filtered_feature_dict[feature] = values;
    }
  }
  
  var nodes = interpretListSelector(filtered_feature_dict, false);
  
  //now handle negative examples
  var exclude_first = false;
  for (var i = 0; i < nodes.length ; i++){
    var node = nodes[i];
    if (_.contains(negative_nodes, node)){
      if (i == 0){
        exclude_first = true;
      }
    }
  }
  
  //update our globals that track the current selector and list
  currentSelectorNodes = interpretListSelector(filtered_feature_dict, exclude_first);
  currentSelector = {"dict": filtered_feature_dict, "exclude_first": exclude_first};
}

/**********************************************************************
 * Helper functions for making and handling xpath lists
 * (my easier to manipulate representation of xpaths)
**********************************************************************/

function xPathToXPathList(xpath){
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
      xpathList.push({"nodeName": nodeName, "index": index, "iterable": false});
    }
  }
  return xpathList;
}

function xPathMatch(xPathWithWildcards,xPath){
  if (xPathWithWildcards.length != xPath.length){
    return false;
  }
  for (var i = 0; i < xPathWithWildcards.length; i++){
    var targetNode = xPathWithWildcards[i];
    var node = xPath[i];
    if (targetNode.nodeName != node.nodeName){
      return false;
    }
    if (targetNode.iterable == false && targetNode.index != node.index){
      return false;
    }
  }
  return true;
}

function xPathMerge(xPathWithWildcards, xPath){
  if (xPathWithWildcards.length != xPath.length){
    return false;
  }
  for (var i = 0; i < xPathWithWildcards.length; i++){
    var targetNode = xPathWithWildcards[i];
    var node = xPath[i];
    if (targetNode.nodeName != node.nodeName){
      return false;
    }
    if (targetNode.iterable == false && targetNode.index != node.index){
      targetNode.iterable = true;
    }
  }
  return true;
}

function xPathReduction(xpath_list){
  if (xpath_list.length < 2){
    return xpath_list;
  }
  var xPathsWithWildcards = [];
  xPathsWithWildcards.push(xpath_list[0]);
  for (var i = 1; i < xpath_list.length; i++){
    var new_xpath = xpath_list[i];
    var success = false;
    for (var j = 0; j < xPathsWithWildcards.length; j++){
      var candidate_match = xPathsWithWildcards[j];
      success = xPathMerge(candidate_match, new_xpath);
      //in case of success, xPathsWithWildcards will now contain the
      //updated, merged xpath
      if (success){
        break;
      }
    }
    if (!success){
      //since couldn't match the new xpath with existing xpaths, add it
      xPathsWithWildcards.push(new_xpath);
    }
  }
  return xPathsWithWildcards;
}

function xPathToString(xpath_list){
  var str = "";
  for (var i = 0; i < xpath_list.length; i++){
    var node = xpath_list[i];
    str += node.nodeName;
    if (node.iterable){
      str += "[*]/";
    }
    else {
      str += "["+node.index+"]/";
    }
  }
  return str;
}

/**********************************************************************
 * Helper functions
**********************************************************************/

function highlight(nodeList,color){
  for (var i = 0; i < nodeList.length ; i++){
    var $node = $(nodeList[i]);
    stored_background_colors[$node.html()] = color;
  }
  $(nodeList).css('background-color', color);
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


