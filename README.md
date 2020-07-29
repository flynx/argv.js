# argv.js

Simple argv parser


## Motivation

I needed a new argv parser for a quick and dirty project I was working 
on and evaluating and selecting the proper existing parser and then 
learning its API, quirks and adapting the architecture to it seemed 
to be more complicated, require more effort and far less fun than 
putting together a trivial parser myself in a couple of hours.  
This code is an evolution of that parser.


## Features

- Simple
- Supports both the _option_ (a-la `ls`) and _command_ (a-la `git`) paradigms
- Nestable  
  parsers can be nested as option/command handlers defining independent 
  nested contexts
- Option expansion  
  `-abc` expands to `-a -b -c` if `-abc` is not defined
- Option/command value passing  
  implicit `-a 123` (requires definition or manual handling) or explicit 
  `-a=123`
- Environment variable option/command value defaults
- Option/command value conversion
- Option/command value collection
- Multiple option prefix support
- Reasonable defaults:
  - `-help` &ndash; generate and print help
  - `-version` &ndash; print version
  - `-quiet` &ndash; suppress printing
  - `-` &ndash; stop argument processing
- Extensible:
  - Hooks for dynamic option/command handling
  - Customizable error and stop condition handling


## Planned Features

- Run `<command>-<sub-command>` scripts
- Option doc grouping (???)



<!-- XXX ### Alternatives -->

## Contents
- [argv.js](#argvjs)
	- [Motivation](#motivation)
	- [Features](#features)
	- [Planned Features](#planned-features)
	- [Contents](#contents)
	- [Installation](#installation)
	- [Basics](#basics)
		- [Configuring help](#configuring-help)
		- [Basic options](#basic-options)
		- [Commands](#commands)
		- [Active options/commands](#active-optionscommands)
		- [Nested parsers](#nested-parsers)
		- [Stopping](#stopping)
		- [Error reporting](#error-reporting)
		- [Calling the script](#calling-the-script)
	- [In detail](#in-detail)
	- [More...](#more)
	- [License](#license)


## Installation

```shell
$ npm install ig-argv
```

## Basics

Create a script and make it runnable
```shell
$ touch script.js
$ chmod +x script.js
```

Now for the code
```javascript
#!/usr/bin/env node

// compatible with both node's and RequireJS' require(..)
var argv = require('ig-argv')

var parser = argv.Parser({
		// option definitions...
		// ...
	})
	.then(function(){
		// things to do after the options are handled...
		// ...
	})

// run the parser...
__filename == require.main
	&& parser(process.argv)
```

This will already create a script that can respond to `-help` and freinds.

```shell
$ ./script.js --help 
```

Let us populate the option definitions splitting the job into sections...


### Configuring help

```javascript
var parser = argv.Parser({
	// doc sections...
	varsion: '0.0.1',
	doc: 'Example script options',
	author: 'John Smith <j.smith@some-mail.com>',
	footer: 'Written by $AUTHOR ($VERSION / $LICENSE).',
	license: 'BSD-3-Clause',
```


### Basic options

These, if encountered, simply assign a value to an attribute on the parsed object.

If no value is given `true` is assigned to indicate that the option/command is 
present in the command-line.

```javascript
	'-bool': {
		doc: 'if given set .bool to true' },


	// option with a value...
	'-value': {
		doc: 'set .x to X',

		// 'X' (VALUE) is used for -help while 'x' (key) is where the 
		// value will be written...
		arg: 'X | x',

		// the value is optional by default but we can make it required...
		valueRequired: true,
	},


	// setup an alias -r -> -required
	'-r': '-required',

	// a required option...
	'-required': {
		doc: 'set .required_option_given to true'

		// NOTE: we can omit the VALUE part to not require a value...
		// NOTE: of no attr is specified in arg option name is used.
		arg: '| required_option_given',

		required: true,

		// keep this near the top of the options list in -help...
		priority: 80,
	},


	'-int': {
		doc: 'pass an integer value',

		// NOTE: if not key is given the VALUE name is used as a key, so the 
		// 		value here is assigned to .INT...
		arg: 'INT',

		// convert the input value to int...
		type: 'int',
	},
	

	'-default': {
		doc: 'option with default value',
		arg: 'VALUE | default',

		default: 'some value',
	},


	'-home': {
		doc: 'set home path',
		arg: 'HOME | home',

		// get the default value from the environment variable $HOME...
		env: 'HOME',
	},

	
	// collecting values...
	'-p': '-push',
	'-push': {
		doc: 'push elements to a .list',
		arg: 'ELEM | list',

		// this will add each argument to a -push option to a list...
		collect: 'list',
	},
```


### Commands

The only difference between an _option_ and a _command_ is the prefix (`"-"` vs. `"@"`) 
that determines how it is parsed, otherwise they are identical and everything 
above applies here too.

```javascript
	'@command': {
		// ...
	},

	// Since options and commands are identical, aliases from one to the 
	// other work as expected...
	'-c': '@command',
```


### Active options/commands 

These define `.handler`s which are executed when the option is encountered 
by the parser
```javascript
	'-active': {
		doc: 'basic active option',
		handler: function(args, key, value){
			// ...
		} },
```

And for quick-n-dirty hacking stuff together, a shorthand (_not for production use_):
```javascript
	'-s': '-shorthand-active',
	'-shorthand-active': function(args, key, value){
		// ...
	},
```


### Nested parsers

An options/command handler can also be a full fledged parser.

```javascript
	'@nested': argv.Parser({
			// ...
		}).then(function(){
			// ...
		}),
```

This can be useful when there is a need to define a sub-context with it's own 
options and settings but it does not need to be isolated into a separate 
external command.

When a nested parser is started it will consume subsequent arguments until it 
exits, then the parent parser will pick up where it left.

Externally it is treated in exactly the same way as a normal _function_ handler, 
essentially, the parent parser does not know the difference between the two.

For more detail see the [Nested parsers](./ADVANCED.md#nested-parsers) section 
in detailed docs.


### Stopping

To stop option processing either return `STOP` or `THEN` from the handler.

- `THEN` is the normal case, stop processing and trigger [`<parser>.then(..)`](./ADVANCED.md#parserthen):
	```javascript
		'-then': { 
			handler: function(){
				return argv.THEN } },
	```

- `STOP` will stop processing and trigger [`<parser>.stop(..)`](./ADVANCED.md#parserstop):
	```javascript
		'-stop': { 
			handler: function(){
				return argv.STOP } },
	```


### Error reporting

There are three ways to stop and/or report errors:

- Simply `throw` a `ParserError(..)` instance:
	```javascript
		'-error': {
			handler: function(){
				throw argv.ParserError('something went wrong.') } },
	```
	Here processing will stop and the error will be reported automatically
	before [`<parser>.error(..)`](./ADVANCED.md#parsererror-1) is triggered.

- _Silently_ `return` a `ParserError(..)` instance:
	```javascript
		'-silent-error': {
			handler: function(){
				return argv.ParserError('something went wrong.') } },
	```
	This will _not_ report the error but will stop processing and trigger 
	[`<parser>.error(..)`](./ADVANCED.md#parsererror-1), so the user can either 
	recover from or report the issue manually.

- For a critical error simply `throw` any other JavaScript error/exception:
	```javascript
		'-critical-error': {
			handler: function(){
				throw 'something went really wrong.' } },

	// and to close things off ;)
	})
	```

Note that [`<parser>.then(..)`](./ADVANCED.md#parserthen) will not be triggered 
in any of these cases.

Also see: [`<parser>.printError(..)`](./ADVANCED.md#parserprint--parserprinterror)


### Calling the script

This will create a parser that supports the following:
```shell
$ ./script.js --help 

$ ./script.js --value 321

$ ./script.js --value=321

$ ./script.js command

$ ./script.js nested -h

$ ./script.js -fb

```

## In detail

For a more detailed set of docs see [ADVANCED.md](./ADVANCED.md)


## More...

For more info see the [source](./argv.js).


## License

[BSD 3-Clause License](./LICENSE)

Copyright (c) 2016-2020, Alex A. Naanou,  
All rights reserved.


<!-- vim:set ts=4 sw=4 spell : -->
