const request = require('request');
const fs = require('fs');
const wdeUtils = require('jsd-utils');

const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;

/**
* JS Tensorflow IOHandler implementation to get a model from a webdis server
*/
class WebdisRequest {   
  constructor(path) {
    this.path = path;
  }

  async retrySave(url, form) {
    return new Promise( (resolve, reject) => {
      logger.debug("SAVING ...");
      request.put({url : url, 
      form: form}, 
      function(err, httpResponse, body){ 
        logger.debug("SAVING ... err = " + err);
        logger.debug("SAVING ... httpResponse = " + (httpResponse ? true : false));
        logger.debug("SAVING ... body = " + (body ? true : false));
        if (err) resolve(false);
        else resolve(true);
      })
    });
  }

  async save(modelArtifacts) {
    //request.put(this.path).form(
    //   JSON.stringify([modelArtifacts.modelTopology, wdeUtils.ab2str(modelArtifacts.weightData), modelArtifacts.weightSpecs])
    //);
    logger.debug("Trying to save ... " + this.path);
    let form;
    let weightDataAb2;
    let formCreated = false;
    while (!formCreated) {
      try {
       logger.debug("Trying to save ... BEFORE");        
        //TRYING THIS TO SOLVE BUG ... ERROR: Error creating form (saving model): RangeError: Maximum call stack size exceeded
        /**
            console.log("A " + modelArtifacts.weightData);
            var buf = new ArrayBuffer(modelArtifacts.weightData.length*2); // 2 bytes for each char
            console.log("B");
            var bufView = new Uint16Array(buf);
            console.log("C " + modelArtifacts.weightData.length);
            for (var i=0, strLen = modelArtifacts.weightData.length; i < strLen; i++) {
              bufView[i] = str.charCodeAt(i);
            }
              console.log("D");
              weightDataAb2 = buf;
                            console.log("E");
        **/
        //
       logger.debug("Trying to save ... BEFORE " + modelArtifacts.weightData); 
       weightDataAb2 = wdeUtils.ab2str(modelArtifacts.weightData);
       logger.debug("Trying to save ... weightDataAb2 = " + (weightDataAb2 ? true : false));
       form = JSON.stringify([modelArtifacts.modelTopology, weightDataAb2, modelArtifacts.weightSpecs]);
       logger.debug("Trying to save ... form = " + (form ? true : false));
       formCreated = true;
      } catch (e) {
        logger.error("Error creating form (saving model): " + e);
      }
    }
    let saved = await this.retrySave(this.path, form);
    while (!saved) {
      logger.warn("Error saving. Retrying!!");
      saved = await this.retrySave(this.path, form);
    }
  }

  async tryToLoad() {
    let self = this; 
    return new Promise(function(resolve, reject) {
      request.get(self.path, function(err, res, body) {
        if (body) {
          try {
            let jsonBody = JSON.parse(body);
            jsonBody = JSON.parse(jsonBody.GET);               
            let modelTopology = jsonBody[0];
            let weightData = wdeUtils.str2ab(jsonBody[1]);
            let weightSpecs = jsonBody[2];
            resolve({modelTopology, weightSpecs, weightData});           
          } catch (e) {
            //console.error("ERROR: " + e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });	
    });	
  }


  async load() { 
    let self = this; 
    return new Promise(async (resolve, reject) => {
      let model;
      logger.debug("Loading model IO Handler");
      model = await self.tryToLoad();
      while (!model) {
        logger.debug("Model not found -> " + self.path);
        logger.debug("Retrying loading the model -> " + self.path);
        model = await self.tryToLoad();
      }
      resolve(model);
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
