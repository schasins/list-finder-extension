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

var currently_on = false;

function setUp(){
  document.addEventListener('mouseover', outline, true);
  document.addEventListener('mouseout', unoutline, true);
  document.addEventListener('click', newNode, true);
  
  utilities.listenForMessage("background", "content", "currentlyOn", function(msg_co){currently_on = msg_co;});
  utilities.listenForMessage("mainpanel", "content", "nextButtons", handleNextButtons);
  utilities.listenForMessage("mainpanel", "content", "itemLimit", handleItemLimit);
  utilities.listenForMessage("mainpanel", "content", "run", wholeList);
  utilities.listenForMessage("mainpanel", "content", "nextButtonDataCollection", nextButtonDataCollection);

  utilities.sendMessage("content", "background", "requestCurrentlyOn", "");
  utilities.sendMessage("content", "mainpanel", "requestNextButtonDataCollection", "");
}

$(setUp);

/**********************************************************************
 * Color guide to show users the node they're about to select
**********************************************************************/

var stored_background_colors = {};
var stored_outlines = {};

function outline(event){
  if (!currently_on){return;}
  
  var $target = $(event.target);
  stored_background_colors[$target.html()] = $target.css('background-color');
  stored_outlines[$target.html()] = $target.css('outline');
  $target.css('background-color', '#FFA245');
  $target.css('outline', '#FFA245 1px solid');
}

function unoutline(event){
  if (!currently_on){return;}
  
  var $target = $(event.target);
  $target.css('background-color', stored_background_colors[$target.html()]);
  $target.css('outline', stored_outlines[$target.html()]);
}

/**********************************************************************
 * Domain-specific functionality
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

var all_features = ["tag", "class", 
  "left", "bottom", "right", "top", "width", "height",
  "font-size", "font-family", "font-style", "font-weight", "color",
  "background-color", 
  "preceding-text",
  "xpath"];

function getFeature(element, feature){
  if (feature == "xpath"){
    return xPathToXPathList(nodeToXPath(element));
  }
  else if (feature == "preceding-text"){
    return $(element).prev().text();
  }
  else if (_.contains(["tag","class"],feature)){
    return element[feature+"Name"];
  }
  else if (_.contains(["top", "right", "bottom", "left", "width", "height"], feature)){
    var rect = element.getBoundingClientRect();
    return rect[feature];
  }
  else{
    var style = window.getComputedStyle(element, null);
    return style.getPropertyValue(feature);
  }
}

function featureMatch(feature, value, acceptable_values){
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

function collapseValues(feature, values){
  if (feature == "xpath"){
    return xPathReduction(values);
  }
  return _.uniq(values);
}

function getAllCandidates(){
  return document.getElementsByTagName("*");
}

/**********************************************************************
 * Domain-independent interpreter
**********************************************************************/

function interpretListSelector(feature_dict, exclude_first){
  var candidates = getAllCandidates();
  var list = [];
  for (i=0;i<candidates.length;i++){
    var candidate = candidates[i];
    var candidate_ok = true;
    for (var feature in feature_dict){
      var value = getFeature(candidate,feature);
      var acceptable_values = feature_dict[feature]["values"];
      var pos = feature_dict[feature]["pos"];
      var candidate_feature_match = featureMatch(feature, value, acceptable_values);
      if ((pos && !candidate_feature_match) || (!pos && candidate_feature_match)){
        candidate_ok = false;
        break;
      }
    }
    if (candidate_ok){
      list.push(candidate);
    }
  }
  if (exclude_first && list.length > 0){
    return list.slice(1,list.length);
  }
  return list;
}

/**********************************************************************
 * User interface
**********************************************************************/

var positive_nodes = [];
var negative_nodes = [];
var current_selector = null;
var current_selector_nodes = [];
var first_click = true;
var likeliest_sibling = null;

function newNode(event){
  if (!currently_on){
    return;
  }
  
  //dehighlight our old list
  highlight(current_selector_nodes,"initial");
  
  event.stopPropagation();
  event.preventDefault();
  
  var target = event.target;
  //decide whether it's a positive or negative example based on whether
  //it's in the old list
  if (_.contains(current_selector_nodes,target)){
    negative_nodes.push(target);
    //if this node was in positive_nodes, remove it
    positive_nodes = _.without(positive_nodes,target);
    //if this was our first negative node, remove the likeliest sibling
    positive_nodes = _.without(positive_nodes,likeliest_sibling);
  }
  else{
    positive_nodes.push(target);
    //if this node was in negative_nodes, remove it
    negative_nodes = _.without(negative_nodes,target);
  }
  
  //if this is the first click on the page, (so only one pos example)
  //try to make a guess about what the list will be
  //do this by adding a second likely list member to positive examples
  if (first_click){
    likeliest_sibling = findSibling(positive_nodes[0]);
    if (likeliest_sibling != null){
      positive_nodes.push(likeliest_sibling);
    }
    first_click = false;
  }
  
  //synthesize a selector with our new information (node)
  synthesizeSelector();
  
  //highlight our new list and send it to the panel
  highlight(current_selector_nodes,"#9EE4FF");
  var textList = _.map(current_selector_nodes,function(a){return $(a).text();});
  utilities.sendMessage("content", "mainpanel", "list", textList);
  
  //log the new stuff
  console.log(current_selector);
  console.log(current_selector_nodes);
}

function findSibling(node){
  var xpath_list = xPathToXPathList(nodeToXPath(node));
  for (var i = (xpath_list.length - 1); i >= 0; i--){
    var index = parseInt(xpath_list[i]["index"]);
    xpath_list[i]["index"] = index + 1;
    var xpath_string = xPathToString(xpath_list);
    var nodes = xPathToNodes(xpath_string);
    if (nodes.length > 0) { return nodes[0]; }
    if (index > 0){
      xpath_list[i]["index"] = index - 1;
      xpath_string = xPathToString(xpath_list);
      nodes = xPathToNodes(xpath_string);
      if (nodes.length > 0) { return nodes[0]; }
    }
    xpath_list[i]["index"] = index;
  }
  return null;
}

var almost_all_features = _.without(all_features, "xpath");

function synthesizeSelector(features){
  if(typeof(features)==='undefined') {features = ["tag", "xpath"];}
  
  var feature_dict = featureDict(features, positive_nodes);
  if (feature_dict.hasOwnProperty("xpath") && feature_dict["xpath"].length > 3 && features !== almost_all_features){
    //xpath alone can't handle our positive nodes
    return synthesizeSelector(almost_all_features);
  }
  //if (feature_dict.hasOwnProperty("tag") && feature_dict["tag"].length > 1 && features !== all_features){
  //  return synthesizeSelector(all_features);
  //}
  var nodes = interpretListSelector(feature_dict, false);
  
  //now handle negative examples
  var exclude_first = false;
  for (var i = 0; i < nodes.length ; i++){
    var node = nodes[i];
    if (_.contains(negative_nodes, node)){
      if (i == 0){
        exclude_first = true;
      }
      else if (features !== almost_all_features) {
        //xpaths weren't enough to exclude nodes we need to exclude
        return synthesizeSelector(almost_all_features);
      }
      else {
        //we're using all our features, and still haven't excluded
        //the ones we want to exclude.  what do we do?  TODO
      }
    }
  }
  
  //update our globals that track the current selector and list
  current_selector_nodes = interpretListSelector(feature_dict, exclude_first);
  current_selector = {"dict": feature_dict, "exclude_first": exclude_first};
}

function featureDict(features, positive_nodes){
  //initialize empty feature dict
  var feature_dict = {};
  for (var i = 0; i < features.length; i++){
    feature_dict[features[i]] = {"values":[],"pos":true};
  }
  //add all positive nodes' values into the feature dict
  for (var i = 0; i < positive_nodes.length; i++){
    var node = positive_nodes[i];
    for (var j = 0; j < features.length; j++){
      var feature = features[j];
      var value = getFeature(node,feature);
      feature_dict[feature]["values"].push(value);
    }
  }
  
  //where a feature has more then 3 values, it's too much
  //also need to handle xpath differently, merging to xpaths with *s
  var filtered_feature_dict = {};
  for (var feature in feature_dict){
    var values = collapseValues(feature, feature_dict[feature]["values"]);
    if (feature == "xpath" || (values.length <= 3 && values.length != positive_nodes.length && values.length != (positive_nodes.length - 1))){
      filtered_feature_dict[feature] = {"values":values,"pos":true};
    }
  }
  return filtered_feature_dict;
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
      //in case of success, candidate_match will now contain the
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
  //add the HTML back to the beginning, remove the trailing slash
  return "HTML/"+str.slice(0,str.length-1);
}

/**********************************************************************
 * Handle next buttons
**********************************************************************/

var next_button_type = null;
var next_or_more_button = null;
var next_or_more_button_tag = "";
var next_or_more_button_text = "";
var next_or_more_button_id = "";
var next_or_more_button_xpath = "";
var item_limit = 100000;

function handleNextButtons(message_contents){
  next_button_type = message_contents;
  if (message_contents === "next_button" || message_contents === "more_button"){
    //prevent synthesis from running the next time anything is clicked
    //and process that click instead as the 'next button'
    console.log("waiting for next button click");
    document.removeEventListener('click', newNode, true);
    document.addEventListener('click', clickedNextButton, true);
  }
  else {
    //message_contents was scroll_for_more, nothing to do
  }
}

function clickedNextButton(event){
  event.stopPropagation();
  event.preventDefault();
  next_or_more_button = $(event.target);
  next_or_more_button_tag = next_or_more_button.prop("tagName");
  next_or_more_button_text = next_or_more_button.text();
  next_or_more_button_id = next_or_more_button.attr("id");
  next_or_more_button_xpath = nodeToXPath(event.target);
  //go back to the normal click processing
  console.log("clicked next button");
  document.removeEventListener('click', clickedNextButton, true);
  document.addEventListener('click', newNode, true);
}

function handleItemLimit(limit){
  item_limit = parseInt(limit);
}

/**********************************************************************
 * Retrieve the whole list
**********************************************************************/

var whole_list = [];
var steps_since_progress = 0;
var whole_list_length = 0;

function useCurrentSelector(){
    highlight(current_selector_nodes,"initial");
    current_selector_nodes = interpretListSelector(current_selector["dict"], current_selector["exclude_first"]);
    highlight(current_selector_nodes,"#9EE4FF");
    list = _.map(current_selector_nodes,function(a){return $(a).text();});
    return list;
}

function wholeListHelper(get_more_items_func,send_message_func){
  if (whole_list.length < item_limit && steps_since_progress <= 5){
    get_more_items_func();
    whole_list = useCurrentSelector();
    send_message_func(whole_list);
    steps_since_progress ++;
    if (whole_list.length > whole_list_length){
      steps_since_progress = 0;
      whole_list_length = whole_list.length;
    }
    setTimeout(wholeList,500);
  }
}

function wholeList(){
  console.log("in wholeList");
  var send_full = function(list){utilities.sendMessage("content", "mainpanel", "list", list);};
  var send_partial = function(list){utilities.sendMessage("content", "mainpanel", "partialList", list);};
  var get_more_items = function(){var button = findButton(); if (button !== null){document.removeEventListener('click', newNode, true); button.click(); document.addEventListener('click', newNode, true);}};
    
  console.log(next_button_type);
  if (next_button_type === null){
    var list = useCurrentSelector();
    send_full(list);
  }
  else if (next_button_type === "scroll_for_more"){
    var get_more_items = function(){window.scrollBy(0,1000);};
    wholeListHelper(get_more_items,send_full);
  }
  else if (next_button_type === "more_button"){
    var get_more_items = function(){var button = findButton(); if (button !== null){document.removeEventListener('click', newNode, true); button.click(); document.addEventListener('click', newNode, true);}};
    wholeListHelper(get_more_items,send_full);
  }
  else if (next_button_type === "next_button"){
    var data = {"current_selector":current_selector, 
                "next_or_more_button_tag": next_or_more_button_tag,
                "next_or_more_button_text": next_or_more_button_text,
                "next_or_more_button_id": next_or_more_button_id,
                "next_or_more_button_xpath": next_or_more_button_xpath,
                "item_limit": item_limit};
    utilities.sendMessage("content", "mainpanel", "nextButtonDataCollectionModeOn", data);
    //TODO:make sure we don't send the same list multiple times
    wholeListOnePage();
  }
}

function nextButtonDataCollection(data){
  current_selector = data["current_selector"];
  next_or_more_button_tag = data["next_or_more_button_tag"];
  next_or_more_button_text = data["next_or_more_button_text"];
  next_or_more_button_id = data["next_or_more_button_id"];
  next_or_more_button_xpath = data["next_or_more_button_xpath"];
  item_limit = data["item_limit"];
  wholeListOnePage();
}

function wholeListOnePage(){
  //this will only be called when we need to get part of the whole list
  var send_partial = function(list){utilities.sendMessage("content", "mainpanel", "partialList", list);};
  var list = useCurrentSelector();
  send_partial(list);
  var button = findButton();
  if (button !== null){
    document.removeEventListener('click', newNode, true);
    button.click();
  }
  else{
    //should let the mainpanel know that we're going to have to stop
    //since we couldn't find a button
    utilities.sendMessage("content", "mainpanel", "nextButtonDataCollectionModeOff", "");
  }
  //in case we're in an AJAX next button case, let's check with the
  //mainpanel to see if we should keep going
  setTimeout(function(){utilities.sendMessage("content", "mainpanel", "requestNextButtonDataCollection", "");},500);
}

function findButton(){
  var button = null;
  var candidate_buttons = $(next_or_more_button_tag).filter(function(){ return $(this).text() === next_or_more_button_text;})
  //hope there's only one button
  if (candidate_buttons.length === 1){
    button = candidate_buttons[0];
  }
  else{
    //if not and demo button had id, try using the id
    if (next_or_more_button_id !== undefined && next_or_more_button_id !== ""){
      console.log("trying id");
      button = $("#"+next_or_more_button_id);
    }
    else{
      //see which candidate has the right text and closest xpath
      var min_distance = 999999;
      var min_candidate = null;
      for (var i=0; i<candidate_buttons.length; i++){
        candidate_xpath = nodeToXPath(candidate_buttons[i]);
        var distance = levenshteinDistance(candidate_xpath,next_or_more_button_xpath);
        if (distance<min_distance){
          min_distance = distance;
          min_candidate = candidate_buttons[i];
        }
      }
      if (min_candidate === null){
        console.log("couldn't find an appropriate 'more' button");
        console.log(next_or_more_button_tag, next_or_more_button_id, next_or_more_button_text, next_or_more_button_xpath);
      }
      button = min_candidate;
    }
  }
  return button;
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

function levenshteinDistance (a, b) {
  if(a.length === 0) return b.length; 
  if(b.length === 0) return a.length; 
 
  var matrix = [];
 
  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }
 
  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }
 
  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }
 
  return matrix[b.length][a.length];
};

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
    console.log(e);
  }
  return [];
}


