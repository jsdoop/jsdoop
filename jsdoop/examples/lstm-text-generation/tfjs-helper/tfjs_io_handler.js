const request = require('request');

const wdeUtils = require('jsd-utils');


/**
* JS Tensorflow IOHandler implementation to get a model from a webdis server
*/
class WebdisRequest {   
  constructor(path) {
    this.path = path;
  }

  async save(modelArtifacts) {
    request.put(this.path).form(
       JSON.stringify([modelArtifacts.modelTopology, wdeUtils.ab2str(modelArtifacts.weightData), modelArtifacts.weightSpecs])
    );
  }

  async load() { 
    let self = this; 
    return new Promise(function(resolve, reject) {
      request.get(self.path, function(err, res, body) {
        if (body) {
          try {
            console.log("WebdisRequest.load() body = " + body);
            let jsonBody = JSON.parse(body);
            jsonBody = JSON.parse(jsonBody.GET);                
            let modelTopology = jsonBody[0];
            let weightData = wdeUtils.str2ab(jsonBody[1]);
            let weightSpecs = jsonBody[2];
            resolve({modelTopology, weightSpecs, weightData});           
          } catch (e) {
            //console.error("ERROR: " + e);
            resolve(body);
          }
        } else {
          console.log("WebdisRequest.load() body is empty");	
          resolve(null);
        }
      });	
    });	
  }
}


/**
*
*/
function webdisRequest(path) {
  return new WebdisRequest(path);
}

module.exports.webdisRequest = webdisRequest;
