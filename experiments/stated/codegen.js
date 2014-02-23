
var debug = require('debug');
var lg = debug('vash:codegen');

var gens = {}

gens.VashProgram = function(node, opts, generate) {
  return node.body.map(generate).join('');
}

gens.VashExplicitExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  str = '(' + maybeHTMLEscape(node, opts, str) + ')';
  if (parentIsContent(node)) {
    str = bewrap(str);
  }
  return str;
}

gens.VashExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  if (parentIsContent(node)) {
    str = bewrap(maybeHTMLEscape(node, opts, str));
  }
  return str;
}

gens.VashMarkup = function(node, opts, generate) {
  var name = node.expression
    ? node.expression.values.map(generate).join('')
    : bcwrap(node.name);
  return ''
    + bcwrap('<')
    + name
    + bcwrap(node.attributes.length ? ' ' : '')
    + node.attributes.map(generate).join(bcwrap(' '))
    + (node.isVoid
      ? bcwrap(node.voidClosed ? ' />' : '>')
      : bcwrap('>')
        + node.values.map(generate).join('')
        + bcwrap('</')
        + name
        + bcwrap('>'))
}

gens.VashMarkupAttribute = function(node, opts, generate) {
  var quote = node.rightIsQuoted || '';
  quote = escapeMarkupContent(quote);
  return node.left.map(generate).join('')
    + (node.right.length || node.rightIsQuoted
      ?   bcwrap('=' + quote)
        + node.right.map(generate).join('')
        + bcwrap(quote)
      : '');
}

gens.VashBlock = function(node, opts, generate) {
  return node.head.map(generate).join('')
    + '{'
    + node.values.map(generate).join('')
    + '}'
    + node.tail.map(generate).join('');
}

gens.VashIndexExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  return '[' + str + ']';
}

gens.VashText = function(node, opts, generate) {
  return parentIsContent(node)
    ? bcwrap(escapeMarkupContent(node.value))
    : node.value;
}

var reQuote = /(['"])/g;
var reEscapedQuote = /\\+(["'])/g;
var reLineBreak = /\n/g;
var reHelpersName = /HELPERSNAME/g;
var reModelName = /MODELNAME/g;
var reOriginalMarkup = /ORIGINALMARKUP/g;

function escapeMarkupContent(str) {
  return str
    .replace(/(')/, '\\$1')
    .replace(reLineBreak, '\\n');
}

var BUFFER_HEAD = '\n__vbuffer.push(';
var BUFFER_TAIL = ');\n';

// buffer content wrap
function bcwrap(str) {
  return BUFFER_HEAD + '\'' + str + '\'' + BUFFER_TAIL;
}

// buffer expression wrap
function bewrap(str) {
  return BUFFER_HEAD + str + BUFFER_TAIL;
}

function parentIsContent(node) {
  return node.parent.type === 'VashMarkup'
    || node.parent.type === 'VashMarkupAttribute'
    || node.parent.type === 'VashProgram';
}

function maybeHTMLEscape(node, opts, str) {
  if (parentIsContent(node) && opts.htmlEscape) {
    return opts.helpersName + '.escape(' + str + ').toHtmlString()';
  } else {
    return str;
  }
}

function replaceDevTokens(str, opts){
  return str
    .replace( reHelpersName, opts.helpersName )
    .replace( reModelName, opts.modelName );
}

function head(opts){
  var str = ''
    + (opts.debug ? 'try { \n' : '')
    + 'var __vbuffer = HELPERSNAME.buffer; \n'
    + 'HELPERSNAME.options = __vopts; \n'
    + 'MODELNAME = MODELNAME || {}; \n'
    + (opts.useWith ? 'with( MODELNAME ){ \n' : '');

  str = replaceDevTokens(str, opts);
  return str;
}

function helperHead(opts){
  var str = ''
    + (options.debug ? 'try { \n' : '')
    + 'var __vbuffer = this.buffer; \n'
    + 'var MODELNAME = this.model; \n'
    + 'var HELPERSNAME = this; \n';

  str = this.replaceDevTokens(str);
  return str;
}

function tail(opts){
  var str = ''
    + (opts.simple
      ? 'return HELPERSNAME.buffer.join(""); \n'
      : ';(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, HELPERSNAME)); \n'
        + 'return (__vopts && __vopts.asContext) \n'
        + '  ? HELPERSNAME \n'
        + '  : HELPERSNAME.toString(); \n' )
    + (opts.useWith ? '} \n' : '')
    + (opts.debug ? '} catch( e ){ \n'
      + '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP" ); \n'
      + '} \n' : '');

  str = replaceDevTokens(str, opts)
    .replace(reOriginalMarkup, escapeForDebug(opts.source));

  return str;
}

 function helperTail(opts){
  var str = ''
    + (options.debug ? '} catch( e ){ \n'
      + '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP" ); \n'
      + '} \n' : '');

  str = replaceDevTokens(str)
    .replace(reOriginalMarkup, escapeForDebug(opts.source));

  return str;
}

function escapeForDebug( str ){
  return str
    .replace(reLineBreak, '!LB!')
    .replace(reQuote, '\\$1')
    .replace(reEscapedQuote, '\\$1')
}

// Not necessary, but provides faster execution when not in debug mode
// and looks nicer.
function condenseContent(str) {
  return str
    .replace(/'\);\n+__vbuffer.push\('/g, '')
    .replace(/\n+/g, '\n');
}

function generate(node, opts) {

  function gen(opts, node) {
    lg('Entering ' + node.type);
    var str = gens[node.type](node, opts, genChild);
    lg('Leaving ' + node.type);
    return str;

    function genChild(child) {
      if (!child.parent) child.parent = node;
      return gen(opts, child);
    }
  }

  var generated = gen(opts, node);

  var body;
  if(!opts.asHelper){
    body = head(opts) + generated + tail(opts);
  } else {
    body = helperHead(opts) + generated + helperTail(opts);
  }

  return condenseContent(body);
}

module.exports = generate;