# argv.js

Simple yet complete argv parser


## Motivation

I needed a new argv parser for a quick and dirty project I was working 
on and evaluating and selecting the proper existing parser and then 
learning its API, quirks and adapting the project architecture to it 
seemed to be more complicated, require more effort and far less fun 
than putting together a trivial parser myself in a couple of hours.  
This code is an evolution of that parser.


## Features

- Simple / well documented
- Supports both the _option_ (a-la `ls`) and _command_ (a-la `git`) paradigms
- Option expansion  
  `-abc` expands to `-a -b -c` if `-abc` is not defined
- Option/command value assignment  
  implicit `-a 123` (requires either _definition_ or manual handling) or 
  explicit `-a=123`
- Read option/command value defaults from environment variables
- Option/command value conversion
- Option/command value collection
- Multiple option prefix support (by default `-` and `+` are handled)
- Dynamic option/command handling
- Customizable error and stop condition handling
- Reasonable defaults:
  - Metadata read from `package.json`
  - `-help` &ndash; generate and print help
  - `-version` &ndash; print version
  - `-quiet` &ndash; suppress printing
  - `-` &ndash; stop argument processing
- Nestable  
  parsers can be nested as option/command handlers defining independent 
  nested contexts
- Option delegation  
  options not handled by the current nested parser will be automatically 
  delegated back to parent parser
- Extensible and self-applicable


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
  - [Basics and quick start](#basics-and-quick-start)
  - [Options in more detail](#options-in-more-detail)
    - [Help and metadata](#help-and-metadata)
    - [Basic options](#basic-options)
    - [Commands](#commands)
    - [Active options/commands](#active-optionscommands)
    - [Pattern options](#pattern-options)
    - [Nested parsers](#nested-parsers)
    - [Stopping](#stopping)
    - [Error reporting](#error-reporting)
    - [Before parsing begins](#before-parsing-begins)
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
	- arguments are handled in order of occurrence,
	- argument handlers (defined in `<spec>`) are called while parsing,
	- then/stop/error `<callback>`'s are called after the `<parser>` is done,
	- everything is run in the _context_ of the `<parsed>` object so any
	  data set on it is accessible after parsing is done for further
	  reference.

Note that the `<parser>` is fully reusable and on each call will produce
a new `<parsed>` object.

The `<parsed>` object has the `<parser>` as its `.__proto__`.



## Basics and quick start

To install:
```shell_session
$ npm install --save ig-argv
```

Create a [bare.js](./examples/bare.js) script and make it runnable
```shell_session
$ touch bare.js
$ chmod +x bare.js
```

Now for the code
```javascript
#!/usr/bin/env node

var argv = require('ig-argv')

var parser = 
exports.parser = 
	argv.Parser({
			// option definitions...
			...
		})
		.then(function(){
			// things to do after the options are handled...
			...
		})

// run the parser...
__filename == (require.main || {}).filename
	&& parser()
```

This script already knows how to respond to `-help` and friends.

```shell_session
$ ./bare.js --help 
Usage: bare.js [OPTIONS]

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show bare.js verion and exit
        -q,  --quiet            - quiet mode
        -                       - stop processing arguments after this point

Written by John Smith <j.smith@some-mail.com>
Varsion: 0.0.1 / License: BSD-3-Clause
```

## Options in more detail

Start by creating an [`options.js`](./examples/options.js) script...
```shell_session
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

Now let us populate the option definitions, splitting the job into sections...


### Help and metadata

Basic script description
```javascript
	doc: 'Example script options',
```

Note that `argv.js` exposes [object.js](https://github.com/flynx/object.js)'s 
[`normalizeIndent(..)` / `normalizeTextIndent(..)`](https://github.com/flynx/object.js#normalizeindent--normalizetextindent) for convenient text/code formatting.

Metadata:
```javascript
	// to make things consistent we'll take the version from package.json
	version: require('./package.json').version,

	author: 'John Smith <j.smith@some-mail.com>',
	license: 'BSD-3-Clause',
```

If not set, `.version`, `.author` and `.license` are acquired from `package.json` 
located at the same path as the main script. To explicitly set the path of the 
JSON file from which metadata is read set 
[`<parser>.packageJson`](./ADVANCED.md#parserpackagejson).

These basic bits of metadata can be referenced in other `-help` sections, 
for example:
```javascript
	footer: 'Written by: $AUTHOR\nVersion: $VERSION / License: $LICENSE',
```


If nested parsers are defined the default `-h` and `--help` will behave differently,
the former will print the normal help while `--help` will also print help for each
of the nested parsers/commands.

To disable this behavior set `'extendedHelp'` to `false`:
```javascript
	argv.Parser({
			...

			extendedHelp: false,

			...
		})
```

To explicitly separate `-h` and `--help` either define custom handlers or
alias `--help` directly to `extendedHelp`:
```javascript
	argv.Parser({
			...

			'-help': 'extendedHelp',

			...
		})
```

### Basic options

These, if encountered, simply assign a value to an attribute on the parsed object. 
This attribute's name is defined by the option name (without the prefix) or by 
setting [`<option>.arg`](#optionarg)'s `<key>`.  

Any option/command can be passed a value, either explicitly (e.g. `-opt=123`) or 
implicitly by first setting [`<option>.arg`](#optionarg)'s `<arg-name>` component 
and and then passing `-opt 123`.  

Option/command values can be set on the command-line as well as via 
[`<option>.env`](./ADVANCED.md#optionenv) and/or 
[`<option>.default`](./ADVANCED.md#optiondefault).

If option is given but no value is set, `undefined` is assigned to option 
attribute on the parsed object to indicate that the option/command is present 
in the command-line.  

Note that repeating a basic option/command will overwrite the previous occurrences'
value unless `.collect` is set (see `-push` example below).

Note that in the general case option order in the command-line is not critical, 
but option context can matter (see: [Active options/commands](#active-optionscommands) and [Nested parsers](#nested-parsers))

```javascript
	'-flag': {
		doc: 'if given, set .flag' },


	// option with a value...
	'-value': {
		doc: [
			'set .x to X',
			'NOTE: .doc can be multiple lines'],

		// 'X' (i.e. VALUE) is used to indicate the option value in -help 
		// while 'x' (key) is the attribute where the value will be written...
		//
		// NOTE: if no .arg is set option attribute name is used.
		//
		// See the first example in "Calling the script" section below for output.
		arg: 'X | x',

		// the value is optional by default but we can make it required...
		valueRequired: true,
	},


	// setup an alias -r -> -required
	//
	// NOTE: aliases are used only for referencing, all naming is done via the 
	//		actual option/command name.
	'-r': '-required',

	// a required option...
	'-required': {
		doc: 'set .required_option_given to true',

		// NOTE: we can omit the VALUE part to not require a value...
		// NOTE: of no attr is specified in arg option name is used.
		arg: '| required_option_given',

		default: true,

		// NOTE: by default required options/commands are sorted above normal
		//		options but bellow -help/-version/-quiet/...
		//		(by default at priority 80)
		required: true,
	},


	'-i': {
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
		arg: 'PATH | home_path',

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

For more info on available `.type` and `.collect` handlers see: 
[`<option>.type`](#optiontype) and [`<option>.collect`](#optioncollect)
respectively.



### Commands

The only difference between an _option_ and a _command_ is the prefix (`"-"` vs. `"@"`) 
that determines how it is parsed, otherwise they are identical and everything 
above applies here too.

```javascript
	'@command': {
		...
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
			...
		} },
```

And for quick-n-dirty hacking stuff together, a shorthand (_not for production use_):
```javascript
	'-s': '-shorthand-active',
	'-shorthand-active': function(args, key, value){
		...
	},
```

The `.handler(..)` will get called if the option is present in the command-line,
if either `.default` is not `undefined` or if `.env` and its environment
variable are defined, or any combination of the above. And vice-versa, if none 
of the above conditions are met the `.handler(..)` will not be called.

Option's `.handler(..)` only sees the `args` that follow it in the command line, 
thus anything it may expect/get from the arguments must follow it (in the manner 
it expects), `argv.js` poses no restrictions on full or partial manual handling
of arguments by options/commands.



### Pattern options

Pattern option/command keys enable partial input key matching.
```javascript
    '-prefix-*': {
        doc: 'Pattern option',
        handler: function(rest, key){
            ...
        } },
```

The above code will match any _unhandled_ input option starting with 
`-prefix-`/`--prefix-` and push the explicitly `false` value back to the option 
queue.

A pattern option/command is any option with a key containing `"*"`.



### Nested parsers

An options/command handler can also be a full fledged parser.

```javascript
	'@nested': argv.Parser({
			...
		}).then(function(){
			...
		}),

	// and for fun, import the bare parser...
	'@bare': require('./bare').parser,
```

This can be useful when there is a need to define a sub-context with it's own 
options and settings but it does not need to be isolated into a separate 
external command.

When a nested parser is started it will consume subsequent arguments until it 
exits, then the parent parser will pick up where it left.

When a nested parser encounters an unknown option/command it will stop and 
the option will be delegated to the parent parser. This can be disabled by
setting `<parser>.delegateUnknownToParent` to `false`.

Externally it is treated in exactly the same way as a normal _function_ handler, 
essentially, the parent parser does not know the difference between the two.

As with [Active options/commands](#active-optionscommands) the nested 
parser (essentially an active option itself) only sees the arguments that 
follow it in the command-line and may have arbitrary expectations of them.

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

	`STOP` is needed in cases where we want to stop the parser and not trigger 
	it's main functionality (i.e. [`<parser>.then(..)`](./ADVANCED.md#parserthen)),
	for example this is needed when printing `-help` and related tasks like 
	listing commands and other script interface documentation/introspection.


### Error reporting

There are three ways to stop and/or report errors:

- Simply `throw` argv's `ParserError(..)` instance:
	```javascript
		'-error': {
			handler: function(){
				throw argv.ParserError('something went wrong.') } },
	```
	Here processing will stop and the error will be reported automatically
	before [`<parser>.error(..)`](./ADVANCED.md#parsererror-1) is triggered.

- _Silently_ `return` argv's `ParserError(..)` instance:
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

### Before parsing begins

The `<parser>` can notify the user if any arguments were passed or not before the parsing starts:

- [`<parser>.onArgs(..)`](./ADVANCED.md#parseronargs) triggered when one or 
  more arguments were passed
  ```javascript
  .onArgs(function(args){
	  console.log('### input arguments:', args) })
  ```

- [`<parser>.onNoArgs(..)`](./ADVANCED.md#parseronnoargs) triggered when no 
  arguments were passed
  ```javascript
  .onNoArgs(function(args){
	  console.log('### no arguments passed.') })
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

- [`<parser>.error(..)`](./ADVANCED.md#parsererror) when an error is detected
	```javascript
	.error(function(reason, arg, rest){
		console.log(`### something went wrong when parsing ${arg}.`) })
	```


### Calling the script

This will create a parser that supports the following:
```shell_session
$ ./options.js --help 
Usage: options.js -r [OPTIONS]

Example script options

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show options.js verion and exit
        -q,  --quiet            - quiet mode
        -r,  --required         - set .required_option_given to true
                                  (required)
             --default=VALUE    - option with default value
                                  (default: some value)
             --flag             - if given set .flag
             --value=X          - set .x to X
			 					  NOTE: .doc can be multiple lines
                                  (required value)
        -i=INT                  - pass an integer value
             --home=PATH        - set home path
                                  (env: $HOME)
        -p,  --push=ELEM        - push elements to a .list
        -c                      - command
             --active           - basic active option
        -s,  --shorthand-active - shorthand-active
             --prefix-*         - Pattern option
             --then             - then
             --stop             - stop
             --error            - error
             --silent-error     - silent-error
             --critical-error   - critical-error
        -                       - stop processing arguments after this point

Commands:
        command                 - command
        nested                  - nested
                                  (more: .. nested -h)
        bare                    - bare
                                  (more: .. bare -h)

Written by John Smith <j.smith@some-mail.com>
Varsion: 0.0.1 / License: BSD-3-Clause
### stopped at --help.
```

Required argument handling
```shell_session
$ ./options.js
options.js: ParserError: required but missing: -required
### something went wrong when parsing -required.  
```

```shell_session
$ ./options.js -r
### finished normally.
Parser {
  ...
  required_option_given: true,
  ...
  default: 'some value',
  home_path: '...'
}
```
Notice the default values are set in the output above (output partially truncated
for brevity).

Passing values implicitly
```shell_session
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
```shell_session
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
```shell_session
$ ./script.js nested -h
Usage: options.js nested [OPTIONS]

Options:
        -h,  --help             - print this message and exit
        -v,  --version          - show options.js nested verion and exit
        -q,  --quiet            - quiet mode
        -                       - stop processing arguments after this point

Written by John Smith <j.smith@some-mail.com>
Varsion: 0.0.1 / License: BSD-3-Clause
### stopped at nested.
```

```shell_session
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
```shell_session
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
