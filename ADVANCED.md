# argv.js advanced topics

This file will cover the usage, contents and configuration topics in more detail.


## Basics

For basics see [README.md](./README.md)


## Contents
- [argv.js advanced topics](#argvjs-advanced-topics)
	- [Basics](#basics)
	- [Contents](#contents)
	- [Configuration](#configuration)
		- [Option/command configuration](#optioncommand-configuration)
			- [`<option>.handler(..)`](#optionhandler)
			- [`<option>.doc`](#optiondoc)
			- [`<option>.priority`](#optionpriority)
			- [`<option>.arg`](#optionarg)
			- [`<option>.type`](#optiontype)
			- [`<option>.collect`](#optioncollect)
			- [`<option>.env`](#optionenv)
			- [`<option>.default`](#optiondefault)
			- [`<option>.required`](#optionrequired)
			- [`<option>.valueRequired`](#optionvaluerequired)
		- [Built-in options](#built-in-options)
			- [Disabling or redefining a built-in option](#disabling-or-redefining-a-built-in-option)
			- [`-` / `--`](#-----)
			- [`-*` / `@*`](#---)
			- [`-v` / `--version`](#-v----version)
			- [`-q` / `--quiet`](#-q----quiet)
			- [`-h` / `--help`](#-h----help)
				- [Value placeholders](#value-placeholders)
				- [Automatically defined values](#automatically-defined-values)
				- [`<parser>.doc`](#parserdoc)
				- [`<parser>.usage`](#parserusage)
				- [`<parser>.packageJson`](#parserpackagejson)
				- [`<parser>.version`](#parserversion)
				- [`<parser>.author`](#parserauthor)
				- [`<parser>.license`](#parserlicense)
				- [`<parser>.examples`](#parserexamples)
				- [`<parser>.footer`](#parserfooter)
				- [More control over help...](#more-control-over-help)
		- [Nested parsers](#nested-parsers)
	- [Components and API](#components-and-api)
		- [`THEN` / `STOP`](#then--stop)
		- [`ParserError(..)`](#parsererror)
		- [`Parser(..)`](#parser)
			- [`<parser>.then(..)`](#parserthen)
			- [`<parser>.stop(..)`](#parserstop)
			- [`<parser>.error(..)`](#parsererror-1)
			- [`<parser>.off(..)`](#parseroff)
			- [`<parser>(..)`](#parser-1)
	- [Advanced parser API](#advanced-parser-api)
		- [`<parser>.print(..)` / `<parser>.printError(..)`](#parserprint--parserprinterror)
		- [`<parser>.handlerDefault(..)`](#parserhandlerdefault)
		- [`<parser>.handleArgumentValue(..)`](#parserhandleargumentvalue)
		- [`<parser>.handleErrorExit(..)`](#parserhandleerrorexit)
		- [`<parser>.handle(..)`](#parserhandle)
		- [`<parser>.setHandlerValue(..)`](#parsersethandlervalue)
	- [External utilities](#external-utilities)
		- [`normalizeIndent(..)` / `normalizeTextIndent(..)`](#normalizeindent--normalizetextindent)
	- [More...](#more)


## Configuration

```
Parser(<spec>)
	-> <parser>
```

The `<spec>` object is "merged" into the `<parser>` instance overriding 
or extending it's API/data.

The `<parser>` expects/handles the following data in the `<spec>` object:

- the configuration attributes and methods  
	Attributes and methods used to configure, modify, extend or overload 
	parser functionality.

	Note that these attributes are the same attributes inherited by `<parser>`
	and are simply merged into the new instance created by `Parser(..)`, thus 
	there are no restrictions on what attributes/methods can be overloaded 
	or extended in this way, but care must be taken when overloading elements 
	that were not designed to be overloaded.

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
	option/command name.

	Looping (referencing the original alias) or dead-end (referencing 
	non-existent options) aliases are ignored.


### Option/command configuration

#### `<option>.handler(..)`

Option handler.


```javascript
'-option': {
	handler: function(opts, key, value){
		// handle the option...
		// ...
	},
},
```
or a shorthand:
```javascript
'-option': function(opts, key, value){
	// handle the option...
	// ...
},
```

The handler gets called if the option is given or if it was not explicitly 
given but has a default value set.

`opts` contains the mutable list of arguments passed to the script
starting just after the currently handled option/command. If the handler
needs to handle it's own arguments it can modify this list in place and
the _parser_ will continue from the resulting state.

One use-case for this would be and option handler that needs to handle
it's arguments in a custom manner, for example for handling multiple 
arguments.

`key` is the actual normalized (`[<prefix-char>]<name-str>`)
option/command triggering the `.handler(..)`.

This can be useful to identify the actual option triggering the handler
when using aliases, if a single handler is used for multiple options, or
when it is needed to handle a specific prefix differently (a-la `find`'s 
syntax with `+option` and `-option` having different semantics).

`value` gets the value passed to the option. 

A _value_ can be passed either explicitly passed (via `=` syntax), 
implicitly parsed from the `argv` via the `<option>.arg` definition or 
is `undefined` otherwise.

A handler can return one of the `THEN`, `STOP` or `ParserError` instance 
to control further parsing and/or execution.
(See: [`THEN` / `STOP`](#then-stop) for more info.)


#### `<option>.doc`

Option/command documentation string used in `-help`.
```
doc: <string> | <array-of-strings>,
```

If an array of strings is given each string will be printed on a separate 
line.

If this is set to `false` the option will be hidden from `-help`.


#### `<option>.priority`

Option/command priority in the `-help`.

Can be a positive or negative number or `undefined`.

Ordering is as follows:
- options in descending positive `.priority`,
- options with undefined `.priority` in order of definition,
- options in descending negative `.priority`.

Note that options and commands are grouped separately.

The built-in options `-help`, `-version` and `-quiet` have a priority 
of `99` so that they appear the the top of the `-help` list.

Any option defining `.required` and not defining an explicit `.priority` 
will be sorted via `<parser>.requiredOptionPriority` (`80` by default).


#### `<option>.arg`

Option/command argument definition.

```
arg: '<arg-name>'
arg: '<arg-name> | <key>'
```

If defined and no explicit value is passed to the option command (via `=`)
then the _parser_ will consume the directly next non-option if present in
`argv` as a value, passing it to the `<option>.type` handler, if defined,
then the `<option>.handler(..)`, if defined, or setting it to `<key>`
otherwise.

Sets the option/command argument name given in `-help` for the option
and the key where the value will be written.

The `<key>` is not used if `<option>.handler(..)` is defined.


#### `<option>.type`

Option/command argument type definition. 

The given type handler will be used to convert the option value before
it is passed to the handler or set to the given `<key>`.

Supported types:
- `"string"` (default behavior)
- `"bool"`
- `"int"`
- `"float"`
- `"number"`
- `"date"` &ndash; expects a `new Date(..)` compatible date string
- `"list"` &ndash; expects a `","`-separated value, split and written as 
	an `Array` object

Type handlers are defined in `Parser.typeHandlers` or can be overwritten
by `<spec>.typeHandlers`.

If not set values are written as strings. 

Defining a new global type handler:
```javascript
// check if a value is email-compatible...
argv.Parser.typeHandlers.email = function(value, ...options){
	if(!/[a-zA-Z][a-zA-Z.-]*@[a-zA-Z.-]+/.test(value)){
		throw new TypeRrror('email: format error:', value) }
	return value }
```

Defining a local to parser instance type handler:
```javascript
var parser = new Parser({
	// Note that inheriting from the global type handlers is required 
	// only if one needs to use the global types, otherwise just setting
	// a bare object is enough...
	typeHandlers: Object.assign(Object.create(Parser.typeHandlers), {
		email: function(value, ...options){
			// ...
		},
		// ...
	}),

	// ...
})
```


#### `<option>.collect`

Option value collection mode.

The given handler will be used to _collect_ values passed to multiple 
occurrences of the option and write the result to `<key>`.

Supported collection modes:
- `"list"` &ndash; group values into an `Array` object
- `"set"` &ndash; group values into a `Set` object
- `"string"` &ndash; concatenate values into a string.  
  This also supports an optional separator, for example `"string|\t"` will 
  collect values into a string joining them with a tab (i.e. `"\t"`).  
  Default separator is: `" "`
- `"toggle"` &ndash; toggle option value (bool).  
  Note that the actual value assigned to an option is ignored here and can
  be omitted.

Type handlers are defined in `Parser.valueCollectors` or can be overwritten
by `<spec>.valueCollectors`.

`<option>.collect` can be used in conjunction with `<option>.type` to both 
convert and collect values.

If not set, each subsequent option will overwrite the previously set value.

Defining a global value collector:
```javascript
// '+' prefixed flags will add values to set while '-' prefixed flag will 
// remove value from set...
argv.Parser.valueCollectors.Set = function(value, current, key){ 
	current = current || new Set()
	return key[0] != '-' ?
		current.add(value) 
		: (cur.delete(value), current) }
```

Defining handlers local to a parser instance handler is the same as for 
[type handlers](#optiontype) above.


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

Note that this also _implicitly_ prioritizes the option, for more info see:
[`<option>.priority`](#optionpriority).


#### `<option>.valueRequired`

Sets weather the _parser_ should complain/err if option/value value is
not given.



### Built-in options

#### Disabling or redefining a built-in option

To disable a built-in option simply assign `undefined`, `false` or `null` to it.
```javascript
		// disable help...
		'-help': undefined,
```

Redefining or extending options is done by either shadowing it completely or by overloading it partially.
```javascript
		// redefine and option...
		'-version': {
			doc: 'an alternative version',
			handler: function(){
				console.log('1.2.3') 
				return argv.STOP } },

		// extend...
		'-quiet': Object.assign(
			Object.create(argv.Parser.prototype['-quiet']),
			{
				// hide -quiet from -help
				doc: false,
			}),
```


#### `-` / `--`

Stop processing further options.

This can be used to terminate nested parsers or to stop option processing
in the root parser to handle the rest of the options in `<parser>.then(..)`,
for example.


#### `-*` / `@*`

Handle options/commands for which no definition is found.

By default `-*` will print an "unhandled option/command" error and terminate.

By default `@*` is an alias to `-*`.


#### `-v` / `--version`

This will output the value of `.version` and exit.


#### `-q` / `--quiet`

This will turn quiet mode on.

In quiet mode [`<parser>.print(..)`](#parserprint--parserprinterror) will 
not print anything.

Passing [`--help`](#-h----help) or [`--version`](#-v----version) will 
disable quiet mode and print normally.

Note that this will only set `<parser>.quiet` to `true` and disable output
of [`<parser>.print(..)`](#parserprint--parserprinterror), any user code 
needs to either also use [`<parser>.print(..)`](#parserprint--parserprinterror) 
for output (not always practical) or respect `<parser>.quiet`.


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
- `.scriptName` - base name of the script,
- `.scriptPath` - path of the script.

These will be overwritten when the parser is called.


##### `<parser>.doc`
Script documentation.

    <spec>.doc = <string> | <function>

Default value: `undefined`


##### `<parser>.usage`
Basic usage hint.

    <spec>.usage = <string> | <function> | undefined

Default value: `"$SCRIPTNAME [OPTIONS]"`


##### `<parser>.packageJson`

The path to the metadata JSON file.

    <spec>.packageJson = <string> | <function> | undefined

If not set `package.json` will be searched for in the same directory as the 
main script.

Default value: `undefined`.

##### `<parser>.version`

Version number.

    <spec>.usage = <string> | <function> | undefined

If this is not defined it will be read from the project metadata, if none is 
found `"0.0.0"` will be printed by `-version`.

Default value: `undefined`


##### `<parser>.author`

Author name/contacts.

    <spec>.author = <string> | <function> | undefined

If not set project metadata is used, if found.

Default value: `undefined`

##### `<parser>.license`

Short license information.

    <spec>.usage = <string> | <function> | undefined

If not set project metadata is used, if found.

Default value: `undefined`


##### `<parser>.examples`

    <spec>.usage = <string> | <list> | <function> | undefined

Example list format:

	[
		[<example-code>, <example-doc>, ...],
		...
	]

Default value: `undefined`


##### `<parser>.footer`

Additional information.

    <spec>.footer = <string> | <function> | undefined

Default value: `undefined`


##### More control over help...

For more info on help formatting see `<parser>.help*` attributes in the [source](./argv.js).


### Nested parsers

An option/command handler can be a _parser instance_.

From the point of view of the _nested parser_ nothing is different &ndash; 
it gets passed the remaining list of arguments and handles it on it's own.

The _containing parser_ treats the nested parser just like any normal 
handler with it's attributes and API.

Note that if the _nested parser_ consumes the rest of the arguments,
the _containing parser_ is left with an empty list and it will stop 
parsing and return normally.

A way to explicitly stop the _nested parser_ processing at a specific 
point in the argument list is to pass it a `-` argument at that point.

For example:
```shell_session
$ script -a nested -b -c - -x -y -z
```

Here `script` will handle `-a` then delegate to `nested` which in turn
will consume `-b`, `-c` and on `-` return, rest of the arguments are 
again handled by `script`.

This is similar to the way programming languages handle passing arguments 
to functions, for example in [Lisp](https://en.wikipedia.org/wiki/Common_Lisp) 
this is similar to:
```lisp
(script a (nested b c) x y z)
```

And in _C-like-call-syntax_ languages like 
[C](https://en.wikipedia.org/wiki/C_(programming_language))/[Python](https://python.org)/JavaScript/... 
this would (a bit less cleanly) be:
```javascript
script(a, nested(b, c), x, y, z)
```

The difference here is that `nested` has control over what it handles, and
depending on its definition, can either override the default `-` option as 
well as stop handling arguments at any point it chooses (similar to _words_ 
in stack languages like [Fort](https://en.wikipedia.org/wiki/Forth_(programming_language)) 
or [Factor](https://factorcode.org/)).

<!-- 
XXX split ./lang.js from ./test.js...

See [lang.js](./lang.js) for more fun with argv and programming languages ;)
-->



## Components and API

### `THEN` / `STOP`

Values that if returned by option/command handlers can control the parse flow.

- `THEN` &ndash; Stop parsing and call `<parser>.then(..)` callbacks.
- `STOP` &ndash; Stop parsing and call `<parser>.stop(..)` callbacks, 
  skipping `<parser>.then(..)`.


`THEN` is useful when we want to stop option processing and trigger the 
post-parse stage (i.e. calling `<parser>.then(..)`) for example to pass 
the rest of the options to some other command.

`STOP` is used for options like `-help` when no post-parsing is needed.


### `ParserError(..)` 

A base error constructor. 

If an instance of `ParserError` is _thrown_ by the handler:
- parsing is stopped, 
- the error is reported via [`<parser>.printError(..)`](#parserprint--parserprinterror),
- [`<parsing>.error(..)`](#parsererror-1) is called, 
- the parser will exit with an error ([`<parser>.handleErrorExit(..)`](#parserhandleerrorexit)).

`ParserError` can also be _returned_ form the handler, this has almost the 
same effect as throwing it but the error will _not_ be automatically reported.

The following error constructors are also defined:
- `ParserTypeError(..)`
- `ParserValueError(..)`


### `Parser(..)` 

Construct a parser instance
```
Parser(<spec>)
	-> <parser>
```

See [`<parser>(..)`](#parser-1) for more info.


#### `<parser>.then(..)`

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


#### `<parser>.stop(..)`

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


#### `<parser>.error(..)`

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


#### `<parser>.off(..)`

Remove callback from "event".
```
	<parser>.off(<event>, <callback>)
		-> <parser>
```


#### `<parser>(..)`

Execute the `parser` instance.

Run the parser on `process.argv` implicitly:
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

Explicitly pass both a list of arguments and script path.
```
<parser>(<argv>, <main>)
	-> <result>
```

If `<main>` is present in `<argv>` all the arguments before it will 
be ignored, otherwise the whole list is processed as if `<main>` was 
its head.



## Advanced parser API

### `<parser>.print(..)` / `<parser>.printError(..)`

Handle how `<parser>` prints things.

`<parser>.print(..)` and `<parser>.printError(..)` are very similar but handle different 
cases, similar to `console.log(..)` and `console.error(..)`
```
<parser>.print(...)
	-> <parser>

<parser>.printError(...)
	-> <parser>
<parser>.printError(<error>, ...)
	-> <error>
```

Both support callback binding:
```
<parser>.print(<func>)
	-> <parser>

<parser>.printError(<func>)
	-> <parser>
```

Both `<parser>.print(..)` and `<parser>.printError(..)` can safely be 
overloaded if the callback feature is not going to be used by the user 
&ndash; the print callbacks are not used internally.  

For full callback API see: `extra.afterCallback(..)` in [argv.js](./argv.js).


### `<parser>.handlerDefault(..)`

Called when `<option>.handler(..)` is not defined.

By default this sets option values on the _parsed_ object.


### `<parser>.handleArgumentValue(..)`

Handle argument value conversion.

By default this handles the `<option>.type` mechanics.

If this is set to `false` values will be set as-is.


### `<parser>.handleErrorExit(..)`

Handle exit on error.

By default this will call process.exit(1) for the _root parser_ and does 
nothing for _nested parsers_.

If set to `false` the _parser_ will simply return like any normal function.


### `<parser>.handle(..)`

Manually trigger `<arg>` handling.
```
<parser>.handle(<arg>, <rest>, <key>, <value>)
	-> <res>
```

This is intended to be used for delegating handling from one handler to 
another. Note that this does not handle errors or other protocols handled
by `<parser>(..)`, this only calls the `<arg>` handler (or if it was not 
defined the _default handler_) so it is not recommended for this to be 
called from outside an option handler method/function.

This is not intended for overloading.


### `<parser>.setHandlerValue(..)`

Set handler value manually, this uses `<handler>.arg` and if not set `<key>` to 
write `<value>` on the _parsed_ object.
```
<parser>.setHandlerValue(<handler>, <key>, <value>)
	-> <parser>
```

This is useful when extending `argv.js`, for client code values can be set 
directly.

This is not intended for overloading.

## External utilities

### `normalizeIndent(..)` / `normalizeTextIndent(..)`

`argv.js` uses and exposes [`object.js`](https://github.com/flynx/object.js)' 
text normalization functions for convenient text/code formatting, see [original documentation](https://github.com/flynx/object.js#normalizeindent--normalizetextindent) for more info.


## More...

For more info see the [source](./argv.js).


<!-- vim:set ts=4 sw=4 spell : -->
