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
//
var parser = 
exports.parser =
argv.Parser({
		// XXX can we go without this???
		splitOptions: false,

		'-help': undefined,

		'-*': undefined,
	})
	// XXX this works but we still need:
	// 		- threading back the results
	// 		- -help
	// XXX would also be interesting to be able to route to specific 
	// 		chained parsers...
	.then(argv.Parser({
		'-moo': { 
			handler: function(){
				console.log('MOO!!!') }},
	}))

// run the parser...
__filename == (require.main || {}).filename
	&& parser(process.argv)

// vim:set ts=4 sw=4 spell :
