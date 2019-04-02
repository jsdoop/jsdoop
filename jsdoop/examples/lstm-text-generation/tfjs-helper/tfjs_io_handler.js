const request = require('request');
const fs = require('fs');
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

/**
* JS Tensorflow IOHandler implementation to get a model from a webdis server
*/
class NodeFileRequest {   
  constructor(path) {
    this.path = path;
  }

  async save(modelArtifacts) {
    let data = JSON.stringify([modelArtifacts.modelTopology, wdeUtils.ab2str(modelArtifacts.weightData), modelArtifacts.weightSpecs]);
    fs.writeFile(this.path, data, function(err) {
      if(err) {
        return console.log(err);
      }
      console.log("The file was saved!");
    }); 
  }

  async load() { 
    let self = this; 
    return new Promise(function(resolve, reject) {
      fs.readFile(self.path, function(err, data) {
        if (err) throw err;
        let jsonBody = JSON.parse(data);                
        let modelTopology = jsonBody[0];
        let weightData = wdeUtils.str2ab(jsonBody[1]);
        let weightSpecs = jsonBody[2];
        resolve({modelTopology, weightSpecs, weightData});        
      });	
    });	
  }
}


/**
*
*/
function nodeFileRequest(path) {
  return new NodeFileRequest(path);
}

module.exports.nodeFileRequest = nodeFileRequest;
