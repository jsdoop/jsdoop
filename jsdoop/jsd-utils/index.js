//https://nodejs.org/api/util.html#util_textencoder_encode_input

//https://github.com/inexorabletash/text-encoding

//const { TextEncoder, TextDecoder } = require('util');  

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
process.versions.node != null;

const util = require('util');

let decoder;
let encoder;

/**
if(isNode) {
  decoder = new util.TextDecoder('utf8');
  //encoder = new util.TextEncoder();
} else if (isBrowser) {
  decoder = new TextDecoder('utf8');
  //encoder = new TextEncoder();
}
encoder = new TextEncoder('utf8');
**/


/**
*
*/
function ab2str(buf) {
 console.log("TOTAL SIZE = " + String.fromCharCode.apply(null, new Uint32Array(buf)).length);
  return String.fromCharCode.apply(null, new Uint32Array(buf));
 // return decoder.decode(buf);
}
module.exports.ab2str = ab2str;

/**
*
*/
function str2ab(str) {
  var buf = new ArrayBuffer(str.length*4); // 2 bytes for each char
  var bufView = new Uint32Array(buf);
  for (var i=0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
  //return encoder.encode(str);
}
module.exports.str2ab = str2ab;
