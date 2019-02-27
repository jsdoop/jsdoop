const request = require('request');


function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

class WebdisRequest {   
  constructor(path) {
    this.path = path;
  }
  async save(modelArtifacts) {
    // console.log(JSON.stringify(modelArtifacts.modelTopology));
    // console.log(ab2str(modelArtifacts.weightData));
    // console.log(JSON.stringify(modelArtifacts.weightSpecs));
    request.put(this.path).form(
       JSON.stringify([modelArtifacts.modelTopology, ab2str(modelArtifacts.weightData), modelArtifacts.weightSpecs])
    );
  }
  async load(){ 
    let self = this; 
    return new Promise(function(resolve, reject) {
      request.get(self.path, function(err, res, body) {
        let jsonBody = JSON.parse(body);
        jsonBody = JSON.parse(jsonBody.GET);                
        let modelTopology = jsonBody[0];
        let weightData = str2ab(jsonBody[1]);
        let weightSpecs = jsonBody[2];
        //console.log(modelTopology);
        //console.log(weightData);
        //console.log(weightSpecs);        
        resolve({modelTopology, weightSpecs, weightData}); 
      });	
    });	
  }
}

function webdisRequest(path) {
  return new WebdisRequest(path);
}

module.exports = {
    WebdisRequest,
    webdisRequest
};
