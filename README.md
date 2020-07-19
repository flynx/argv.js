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
- Multiple option prefix support
- Reasonable defaults:
  - `-help` &ndash; generate and print help
  - `-version` &ndash; print version
  - `-` &ndash; stop argument processing
- Extensible:
  - Hooks for option value conversion
  - Hooks for dynamic option/command handling
  - Customizable error and stop condition handling

## Planned Features

- Run `<command>-<sub-command>` scripts
- Option grouping (???)



<!-- XXX ### Alternatives -->

## Contents
- [argv.js](#argvjs)
	- [Motivation](#motivation)
	- [Features](#features)
	- [Planned Features](#planned-features)
	- [Contents](#contents)
	- [Installation](#installation)
	- [Basic usage](#basic-usage)
	- [Configuration](#configuration)
		- [Option/command configuration](#optioncommand-configuration)
			- [`<option>.handler(..)`](#optionhandler)
			- [`<option>.doc`](#optiondoc)
			- [`<option>.priority`](#optionpriority)
			- [`<option>.arg`](#optionarg)
			- [`<option>.type`](#optiontype)
			- [`<option>.env`](#optionenv)
			- [`<option>.default`](#optiondefault)
			- [`<option>.required`](#optionrequired)
			- [`<option>.valueRequired`](#optionvaluerequired)
		- [Built-in options](#built-in-options)
			- [`-` / `--`](#ulli---liul)
			- [`-v` / `--version`](#-v----version)
			- [`-h` / `--help`](#-h----help)
				- [Value placeholders](#value-placeholders)
				- [Automatically defined values](#automatically-defined-values)
				- [`.doc`](#doc)
				- [`.usage`](#usage)
				- [`.version`](#version)
				- [`.license`](#license)
				- [`.examples`](#examples)
				- [`.footer`](#footer)
				- [More control over help...](#more-control-over-help)
		- [Nested parsers](#nested-parsers)
	- [Components and API](#components-and-api)
		- [`THEN`, `STOP` and `ERROR`](#then-stop-and-error)
		- [`Parser(..)`](#parser)
			- [`.then(..)`](#then)
			- [`.stop(..)`](#stop)
			- [`.error(..)`](#error)
			- [`.off(..)`](#off)
			- [`<parser>(..)`](#parser-1)
	- [Advanced parser API](#advanced-parser-api)
		- [`.print(..)` / `.printError(..)`](#print--printerror)
		- [`.handlerDefault(..)`](#handlerdefault)
		- [`.handleArgument(..)`](#handleargument)
		- [`.handleArgumentValue(..)`](#handleargumentvalue)
		- [`.handleErrorExit(..)`](#handleerrorexit)
		- [More...](#more)
	- [License](#license-1)


## Installation

```shell
$ npm install ig-argv
```

## Basic usage

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

Option definitions in a bit more detail

XXX make this a set of practical options and leave the attr explanation to later...
```javascript
var parser = argv.Parser({
		// doc sections...
		doc: 'Example script options',
		author: 'John Smith <j.smith@some-mail.com>',
		footer: 'Written by $AUTHOR ($VERSION / $LICENSE).',
		license: 'BSD-3-Clause',

		// alias, this tells the parser that '-b' is the same as '-basic'
		'-b': '-basic',
		// basic quick-n-dirty option...
		'-basic': function(opts, key, value){
			// ...
		},

		// basic value-getter option...
		'-value': {
			doc: 'Value option',
			arg: 'X | x',
		},

		// full option settings...
		'-f': '-full',
		'-full': {
			// option doc (optional)
			doc: 'Option help',

			// option value to be displayed in help (optional)
			// NOTE: "attr" is used as a key to set the value if .handler
			//		was not defined and is ingored in all other cases...
			arg: 'VALUE | attr',

			// value type handler (optional)
			type: 'int',

			// envioroment value (optional)
			env: 'VALUE',

			// default value (optional)
			default: 123,
			
			// required status (optional)
			required: false,

			// handler (optional)
			handler: function(opts, key, value){
				// ...
			},
		},

		// command...
		// NOTE: the only difference between an option and a command is
		//		the prefix ('-' vs. '@') that determines how it is parsed,
		//		otherwise they are identical and can alias each other...
		'@cmd', '@command',
		'@command': {
			// ...
		},

		// example command-option alias...
		'@help': '-help',

		// nested parser...
		'@nested': argv.Parser({
				// ...
			}).then(function(){
				// ...
			}),

		// ...
	})
```

This will create a parser that supports the folowing:
```shell
$ ./script.js --help 

$ ./script.js --value 321

$ ./script.js --value=321

$ ./script.js command

$ ./script.js nested -h

$ ./script.js -fb

```

## Configuration

```
Parser(<spec>)
	-> <parser>
```

The `<spec>` object is "merged" int the `<parser>` instance overriding 
or extending it's API/data.

The `<parser>` expects/handles the following data in the `<spec>` object:

- the configuration attributes and methods  
	This sections lists attributes and methods designed to be set/modified in
	`<spec>` passed to `Parser(..)`.

	Note that these attributes are the same attributes inherited by `<parser>`
	and are simply merged into the new instance created by `Parser(..)`, this 
	there are no restrictions on what attributes/methods can be overloaded in 
	this way but care must be taken when overloading elements that were not 
	designed to be overloaded.

- option/command definitions  
	The keys for these are prefixed either by `"-"` for options or by `"@"` 
	for commands and are either _objects_, _functions_ or _parser_ instances.

	The only difference between an _option_ and a _command_ is that the former 
	are passed to the _script_ with a `"-"` or `"--"` prefix (by default) and 
	the later are passed by name without prefixes. 

	In all other regards options and commands are the same.

- option/command aliases  
	An alias is an option/command key with a _string_ value.  
	That value _references_ a different option or command, i.e. is an 
	option/commnad name.

	Looping (referencing the original alias) or dead-end (referencing 
	non-existant options) aliases are ignored.


### Option/command configuration

#### `<option>.handler(..)`

Option handler.


```javascript
'-option': function(opts, key, value){
	// handle the option...
	// ...
},
```
or
```javascript
'-option': {
	handler: function(opts, key, value){
		// handle the option...
		// ...
	},
},
```

The handler gets called if the option is given or if it has a default
value but was not given.

`opts` contains the mutable list of arguments passed to the script
starting with but not including the current argument. If the handler
needs to handle it's own arguments it can modify this list in place and
the _parser_ will continue from that state.

One usecase for this would be and option handler that needs to handle
it's arguemnts on its own.

`key` is the actual normalized (`[<prefix-char>]<name-str>`)
option/command triggering the `.handler(..)`.

This can be useful to identify the actual option triggering the handler
when using aliases or if a single handler is used for multiple options, or
when it is needed to handle a specific prefix differently (a-la `find`).

`value` is the option value. A _value_ either ecplicitly passed (via
`=` syntax), implicitly parsed from the `argv` via the `<option>.arg`
definition or `undefined` otherwise.

A handler can return one of the `THEN`, `STOP` or `ERROR` to control
further parsing and/or execution.
(See: [`THEN`, `STOP` and `ERROR`](#then-stop-and-error) for more info.)


#### `<option>.doc`

Option/command documentation string used in `-help`.

#### `<option>.priority`

Option/command priority in the `-help`.

Can be a positive or negative number or `undefined`.

Ordering is as follows:
- options in decending positive `.priority`,
- options with undefined `.priority` in order of definition,
- options in decending negative `.priority`.

Note that options and commands are grouped separately.


#### `<option>.arg`

Option/command argument definition.

```
arg: '<arg-name>'
arg: '<arg-name> | <key>'
```

If defined and no explicit value is passed to the option comand (via `=`)
then the _parser_ will consume the directly next non-option if present in
`argv` as a value, passing it to the `<option>.type` handler, if defined,
then the `<option>.handler(..)`, if defined, or setting it to `<key>`
otherwise.

Sets the option/command arument name given in `-help` for the option
and the key where the value will be written.

The `<key>` is not used if `<option>.handler(..)` is defined.


#### `<option>.type`

Option/command argument type definition. 

The given type handler will be used to convert the option value before
it is passed to the handler or set to the given `<key>`.

Supported types:
- `"int"`
- `"float"`
- `"number"`
- `"string"`
- `"date"`

Type handlers are defined in `Parser.typeHandlers` or can be overwritten
by `<spec>.typeHandlers`.


#### `<option>.env`

Determines the environment variable to be used as the default value for
option/command, if set.

If this is set, the corresponding environment variable is non-zero and
`<option>.handler(..)` is defined, the handler will be called regardless
of weather the option was given by the user or not.


#### `<option>.default`

Sets the default value for option/command's value.

If this is set to a value other than `undefined` and
`<option>.handler(..)` is defined, the handler will be called regardless
of weather the option was given by the user or not.


#### `<option>.required`

Sets weather the _parser_ should complain/err if option/command is
not given.


#### `<option>.valueRequired`

Sets weather the _parser_ should complain/err if option/value value is
not given.



### Built-in options

#### `-` / `--`

Stop processing further options.

This can be used to terminate nested parsers or to stop option processing
in the root parser to handle the rest of the options in `.then(..)`,
for example.


#### `-v` / `--version`

This will output the value of `.version` and exit.


#### `-h` / `--help`

By default `-help` will output in the following format:
```
<usage>

<doc>

Options:
	<option-spec> <option-val>		
				- <option-doc>
				  (<opt-required>, <opt-default>, <opt-env>)
	...

Dynamic options:
	...

Commands:
	...

Examples:
	...

<footer>
```
All sections are optional and will not be rendered if they contain no data.


##### Value placeholders

All documentation strings can contain special placeholders that 
will get replaced with appropriate values when rendering help.

- `$SCRIPTNAME` replaced with the value of `.scriptName`,
- `$VERSION` replaced with `.version`,
- `$LICENSE` replaced with `.license`.

##### Automatically defined values

These values are set by the parser just before parsing starts:
- `.script` - full script path, usually this is the value of `argv[0]`,
- `.scriptName` - basename of the script,
- `.scriptPath` - path of the script.

These will be overwritten when the parser is called.

##### `.doc`
Script documentation.

    <spec>.doc = <string> | <function>

Default value: `undefined`

##### `.usage`
Basic usage hint.

    <spec>.usage = <string> | <function> | undefined

Default value: `"$SCRIPTNAME [OPTIONS]"`

##### `.version`
Version number.

    <spec>.usage = <string> | <function> | undefined

If this is not defined `-version` will print `"0.0.0"`.

Default value: `undefined`

##### `.license`
Short license information.

    <spec>.usage = <string> | <function> | undefined

Default value: `undefined`

##### `.examples`

    <spec>.usage = <string> | <list> | <function> | undefined

Example list format:

	[
		[<example-code>, <example-doc>, ...],
		...
	]

Default value: `undefined`

##### `.footer`
Aditional information.

    <spec>.footer = <string> | <function> | undefined

Default value: `undefined`


##### More control over help...

For more info on help formatting see `.help*` attributes in the [source](./argv.js).


### Nested parsers


## Components and API

### `THEN`, `STOP` and `ERROR`

Values that if returned by option/command handlers can control the parse flow.

- `THEN` &ndash; Stop parsing and call `.then(..)` callbacks.
- `STOP` &ndash; Stop parsing and call `.stop(..)` callbacks, 
  skipping `.then(..)`.
- `ERROR` &ndash; Stop parsing, call `.error(..)` callbacks and
  exit with an error.

### `Parser(..)` 

Construct a parser instance
```
Parser(<spec>)
	-> <parser>
```

See [`<parser>(..)`](#parser-1) for more info.

#### `.then(..)`

Add callback to `then` "event".
```
<parser>.then(<callback>)
	-> <parser>
```

```
callback(<unhandled>, <root-value>, <rest>)
	-> <obj>
```

`then` is triggered when parsing is done or stopped from an option
handler by returning `THEN`.

#### `.stop(..)`

Add callback to `stop` "event".
```
<parser>.stop(<callback>)
	-> <parser>
```

```
callback(<arg>, <rest>)
	-> <obj>
```

`stop` is triggered when a handler returns `STOP`.

#### `.error(..)`

Add callback to `error` "event".
```
<parser>.error(<callback>)
	-> <parser>
```

```
callback(<reason>, <arg>, <rest>)
	-> <obj>
```

`error` is triggered when a handler returns `ERROR`.


#### `.off(..)`

Remove callback from "event".
```
	<parser>.off(<event>, <callback>)
		-> <parser>
```

#### `<parser>(..)`

Execute the `parser` insatance.

Run the parser on `process.argv`
```
<parser>()
	-> <result>
```

Explicitly pass a list of arguments where `<argv>[0]` is treated as 
the script path.
```
<parser>(<argv>)
	-> <result>
```

Explicitly pass both a list of args and script path.
```
<parser>(<argv>, <main>)
	-> <result>
```

If `<main>` is present in `<argv>` all the arguments before it will 
be ignored, otherwise the whole list is processed as if `<main>` was 
its head.

## Advanced parser API

### `.print(..)` / `.printError(..)`

### `.handlerDefault(..)`

### `.handleArgument(..)`

### `.handleArgumentValue(..)`

### `.handleErrorExit(..)`

### More...

For more info see the [source](./argv.js).


## License

[BSD 3-Clause License](./LICENSE)

Copyright (c) 2016-2020, Alex A. Naanou,  
All rights reserved.


<!-- vim:set ts=4 sw=4 spell : -->
