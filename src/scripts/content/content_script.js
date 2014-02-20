document.addEventListener('click', findList, false);

function findList(event){
	event.stopPropagation();
	event.preventDefault();
	var $target = $(event.target);
	var text = $target.text();
	
	//must pretend we didn't get this text from a click, but may have
	//observed it elsewhere (user spreadsheet, copied or typed in)
	//having only the text, try to guess the node
	
	var matchedNodes = $('*').filter(function(){ return $(this).text() === text;});
	matchedNodes.css('background-color', 'red');
}
