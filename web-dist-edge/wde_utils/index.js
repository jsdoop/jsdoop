/**
*
*/
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

module.exports.ab2str = ab2str;

/**
*
*/
function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}


module.exports.str2ab = str2ab;
