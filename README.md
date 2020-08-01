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


### Planned

- Run `<command>-<sub-command>` scripts
- Option doc grouping (???)



<!-- XXX ### Alternatives -->

## Contents
- [argv.js](#argvjs)
	- [Motivation](#motivation)
	- [Features](#features)
		- [Planned](#planned)
	- [Contents](#contents)
	- [Architecture](#architecture)
	- [Installation](#installation)
	- [Basics](#basics)
	- [Options in more detail](#options-in-more-detail)
		- [Help and metadata](#help-and-metadata)
		- [Basic options](#basic-options)
		- [Commands](#commands)
		- [Active options/commands](#active-optionscommands)
		- [Nested parsers](#nested-parsers)
		- [Stopping](#stopping)
		- [Error reporting](#error-reporting)
		- [Handling the result](#handling-the-result)
		- [Calling the script](#calling-the-script)
	- [Advanced docs](#advanced-docs)
	- [License](#license)


## Architecture

This module provides the following workflow:

```
Parser(..) -> <parser>(..) -> <parsed>
```

- define/declare a parser (parse grammar)
	```
	Parser(<spec>)
		-> <parser>
	```

- define post-parse callbacks (optional)
	```
	<parser>
		.then(<callback>)
		.stop(<callback>)
		.error(<callback>)
	```

- parse 
	```
	<parser>(...)
		-> <parsed>
	```
	- option handlers (defined in `<spec>`) are called while parsing,
	- then/stop/error `<callback>`'s are called after the `<parser>` is done,
	- everything is run in the _context_ of the `<parsed>` object so any
	  data set on it is accessible after parsing is done for further
	  reference.

Note that the `<parser>` is fully reusable and on each call will produce
a new `<parsed>` object.

The `<parsed>` object has the `<parser>` as its `.__proto__`.



## Installation

```shell
$ npm install ig-argv
```

## Basics

Create a [bare.js](./examples/bare.js) script and make it runnable
```shell
$ touch bare.js
$ chmod +x bare.js
```

Now for the code
```javascript
#!/usr/bin/env node

// compatible with both node's and RequireJS' require(..)
var argv = require('ig-argv')

var parser = 
exports.parser = 
	argv.Parser({
			// option definitions...
			// ...
		})
		.then(function(){
			// things to do after the options are handled...
			// ...
		})

// run the parser...
__filename == (require.main || {}).filename
	&& parser()
```

This script already knows how to respond to `-help` and friends.

```shell
$ ./bare.js --help 
Usage: bare.js [OPTIONS]

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show bare.js verion and exit
        -q,  --quiet            - quiet mode
        -                       - stop processing arguments after this point
```

## Options in more detail

Start by creating an [`options.js`](./examples/options.js) script...
```shell
$ touch options.js
$ chmod +x options.js
```

...and a parser:
```javascript
#!/usr/bin/env node

// compatible with both node's and RequireJS' require(..)
var argv = require('ig-argv')

var parser = argv.Parser({
```

Now let us populate the option definitions splitting the job into sections.


### Help and metadata

Basic script description
```javascript
	doc: 'Example script options',
```
	
Metadata:
```javascript
	// to make things consistent we'll take the version from package.json
	version: require('./package.json').version,

	author: 'John Smith <j.smith@some-mail.com>',
	license: 'BSD-3-Clause',
```

These basic bits of metadata can be referenced in other `-help` sections, 
for example:
```javascript
	footer: 'Written by $AUTHOR ($VERSION / $LICENSE).',
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
		doc: 'set .required_option_given to true',

		// NOTE: we can omit the VALUE part to not require a value...
		// NOTE: of no attr is specified in arg option name is used.
		arg: '| required_option_given',

		// NOTE: by default required options/commands are sorted above normal
		//		options but bellow -help/-version/-quiet/...
		//		(by default at priority 80)
		required: true,
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

		// keep this near the top of the options list in -help...
		priority: 80,
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

	// and for fun, import the bare parser...
	'@bare': require('./bare').parser,
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
	```

Note that [`<parser>.then(..)`](./ADVANCED.md#parserthen) will not be triggered 
in any of these cases.

Also see: [`<parser>.printError(..)`](./ADVANCED.md#parserprint--parserprinterror)

And to close things off for the `<spec>` ;)
```javascript
})
```

### Handling the result

The `<parser>` will call different sets of callbacks on different stop conditions:

- [`<parser>.then(..)`](./ADVANCED.md#parserthen) for normal exit
	```javascript
	.then(function(unhandled, root_value, rest){
		console.log('### finished normally.')
		console.log(this) })
	```

- [`<parser>.stop(..)`](./ADVANCED.md#parserstop) when parser is stopped
	```javascript
	.stop(function(arg, rest){
		console.log(`### stopped at ${arg}.`) })
	```

- [`<parser>.stop(..)`](./ADVANCED.md#parserstop) when an error is detected
	```javascript
	.error(function(reason, arg, rest){
		console.log(`### something went wrong when parsing ${arg}.`) })
	```


### Calling the script

This will create a parser that supports the following:
```shell
$ ./options.js --help 
Usage: options.js [OPTIONS]

Example script options

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show options.js verion and exit
        -q,  --quiet            - quiet mode
        -r,  --required         - set .required_option_given to true
                                  (Required)
             --default=VALUE    - option with default value
                                  (Default: some value)
             --bool             - if given set .bool to true
             --value=X          - set .x to X
             --int=INT          - pass an integer value
             --home=HOME        - set home path
                                  (Env: $HOME)
        -p,  --push=ELEM        - push elements to a .list
        -c                      - command
             --active           - basic active option
        -s,  --shorthand-active - shorthand-active
             --then             - then
             --stop             - stop
             --error            - error
             --silent-error     - silent-error
             --critical-error   - critical-error
        -                       - stop processing arguments after this point

Commands:
        command                 - command
        nested                  - nested
		bare					- bare

Written by John Smith <j.smith@some-mail.com> (2.8.1 / BSD-3-Clause).
### stopped at --help.
```

Required argument handling
```shell
$ ./options.js
options.js: ParserError: required but missing: -required
### something went wrong when parsing -required.  
```

```shell
$ ./options.js -r
### finished normally.
Parser {
  ...
  required_option_given: true,
  ...
  default: 'some value',
  home: '...'
}
```
Notice the default values are set in the output above (output partially truncated
for brevity).

Passing values implicitly
```shell
$ ./script.js -r --value 321
### finished normally.
Parser {
  ...
  required_option_given: true,
  x: '321',
  ...
}
```

Passing values explicitly
```shell
$ ./script.js -r --value=321
### finished normally.
Parser {
  ...
  required_option_given: true,
  x: '321',
  ...
}
```

Call a nested parser
```shell
$ ./script.js nested -h
Usage: options.js nested [OPTIONS]

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show options.js nested verion and exit
        -q,  --quiet            - quiet mode
        -                       - stop processing arguments after this point
### stopped at nested.
```

```shell
$ ./script.js -r bare
### finished normally.
Parser {
  ...
  required_option_given: true,
  bare: Parser {
    rest: [],
    argv: [],
    nested: true,
    script: 'options.js bare',
    scriptName: 'options.js bare',
    scriptPath: '',
    unhandled: []
  },
  ...
}
```

Split options and pass value to the last one
```shell
$ ./options.js -rsc=321
### finished normally.
Parser {
  ...
  required_option_given: true,
  command: '321',
  ...
}
```

## Advanced docs

For a more detailed set of docs see [ADVANCED.md](./ADVANCED.md).

For even more detail see the [source](./argv.js)...


## License

[BSD 3-Clause License](./LICENSE)

Copyright (c) 2016-2020, Alex A. Naanou,  
All rights reserved.


<!-- vim:set ts=4 sw=4 spell : -->
