#!/usr/bin/env node

var argv = require('../argv')

// XXX chaining parsers...
// 		what we need:
// 			- go through all the argv and handle specific args...
// 			- handle the rest of the args...
// 		ways to implement this:
// 			- parser chaining (external)
// 				- define a parser with -* and @* undefined
// 				- .then(..) calls the next parser on the unprocessed args
// 			  ...modular but not sure how to document this...
// 			- parser chaining (internal)
// 				- root parser has -* and @* undefined
// 				- .then(..) calls a special command/arg/group that parser 
// 					the rest of the args...
// 					...this can be implemented as a special method/command
// 					something like .next(..) or .handleRest(..)
// 			- .chain(<parser>)
// XXX might be a good idea to flip this around and instead of 
// 		chaining after do a pre-parse....
var parser = 
exports.parser =
argv.Parser({

		'-x': {
			handler: function(){
				console.log('### high priority option') }},

		// setup...
		// XXX can we go without this???
		splitOptions: false,
		// pass help through to the chained parser...
		'-help': undefined,
		// let all the unknown options pass through...
		'-*': undefined,
	})
	// XXX this works but we still need:
	// 		- threading back the results
	// XXX would also be interesting to be able to route to specific 
	// 		chained parsers...
	.then(argv.Parser({
		// used for documentation...
		//
		// this is handled in the root parser and will never get reached 
		// here...
		'-x': {
			doc: [
				'high priority option',
				'this will get processed before',
				'any other options']},
	}))


var parser2 =
exports.parser2 =
argv.Parser.chain({
	'-a': {
		doc: [
			'high priority option',
			'this will get processed before',
			'any other options'],
		handler: function(){
			console.log('### high priority option') }},
},{
	'-b': {
		doc: 'medium priority option',
		handler: function(){
			console.log('### normal priority option') }},
},{
	'-c': {
		doc: 'normal priority option',
		handler: function(){
			console.log('### normal priority option') }},
})



// run the parser...
__filename == (require.main || {}).filename
	&& parser2()


// vim:set ts=4 sw=4 spell :
