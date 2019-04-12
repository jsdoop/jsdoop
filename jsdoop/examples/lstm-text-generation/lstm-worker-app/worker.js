const wde = require('jsd-worker');
const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const JSDLogger = require('jsd-utils/jsd-logger');
const JSDDB = require('jsd-utils/jsd-db');


const logger = JSDLogger.logger;
//logger.verbosity = 5;


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const local = true;
const taskName = 'lstm_text_generation';
const queueName = taskName + '_queue';
let serverUrl;
let port = 15674;
let user = 'worker';
let pswd = 'mypassword';
let webdisPort = 7379;
if(local) {
  serverUrl = 'localhost';
  user = 'guest';
  pswd = 'guest';
  webdisPort = 3001;
} else {
  serverUrl = 'mallba3.lcc.uma.es';
}

let dataset;


/*********************************************************************************************************************/
/* Estructura de datos del problema
/* TODO: sacar de aquí
/*********************************************************************************************************************/
class TensorFlowData {
    constructor() {
      this.currentModelId = -1;
      this.currentModel = null;
  }

  async updateModel(decodedMsg, self) {
    let modelId = decodedMsg.payload.getModelUrl;
    modelId = modelId.substring(modelId.indexOf(taskName +"_model_id_") + (taskName +"_model_id_").length, modelId.length);
    if (self.currentModelId != modelId) {
      logger.debug("Model is outdated. " + self.currentModelId + " < " + modelId);
      //self.currentModel = await self.retryUntilLoadModel(decodedMsg.payload.getModelUrl);
      self.currentModel = await tf.loadLayersModel(tfjsIOHandler.webdisRequest(decodedMsg.payload.getModelUrl));
      self.currentModelId = modelId;
      logger.debug("Model updated to " + self.currentModelId);
      self.currentModel.summary();
      return true; 
    } else {
      logger.debug("Model is up to date.");
      return true;
    }

  }

  /*********************************************************************************************************************/
  /* Map function
  /*********************************************************************************************************************/
  async mapFn(decodedMsg, self) {
    logger.info("Map start (" + new Date().getTime()+")");
    await self.updateModel(decodedMsg, self);
    self.currentModel.compile({optimizer: decodedMsg.payload.optimizer, loss: 'categoricalCrossentropy'});  
    const [xs, ys] = dataset.getDataBatch(decodedMsg.payload.batchSize, decodedMsg.payload.beginIndex);
    const {value, grads} = self.currentModel.getGradientsAndSaveActions(xs, ys);
    let result = {};
    result.value = value;
    let jsonGrads = {};
    const tensorNames = Object.keys(grads);
    logger.debug("Tensors -> " + tensorNames);
    const patt = /_[0-9]*$/i;
    tensorNames.forEach(tensorName => {
      let newTensorName = tensorName;
      // Actualizamos el nombre del tensor para evitar problemas del nombre autogenerado por TF
      let matched = tensorName.match(patt);
      if(matched) newTensorName = tensorName.substring(0, tensorName.indexOf(matched));
      logger.debug(tensorName + " -> " + newTensorName);
      jsonGrads[newTensorName] = grads[tensorName].arraySync(); //grads[tensorName].flatten().arraySync();                  
    });
    result.grads = jsonGrads;
    xs.dispose();
    ys.dispose();
    tensorNames.forEach(tensorName => grads[tensorName].dispose() );
    logger.info("Map end (" + new Date().getTime()+")");
    return result;
  }


  /*********************************************************************************************************************/
  /* Reduce function
  /*********************************************************************************************************************/
  async reduceFn(vectorToReduce, decodedMsg, self) {
    logger.info("Reduce start (" + new Date().getTime()+")");
    await self.updateModel(decodedMsg, self);
    self.currentModel.compile({optimizer: decodedMsg.payload.optimizer, loss: 'categoricalCrossentropy'}); 
    //TESTING
    logger.debug("### decodedMsg = " + decodedMsg);
    if (decodedMsg) {
      logger.debug("### decodedMsg.payload = " + decodedMsg);
      logger.debug("### decodedMsg.payload.putModelUrl = " + decodedMsg.payload.putModelUrl);
      logger.debug("### vectorToReduce = " + vectorToReduce);
      logger.debug("### vectorToReduce.length = " + vectorToReduce.length);
      logger.debug("### vectorToReduce[0].result.grads = " + vectorToReduce[0].result.grads);
    }
    //TESTING
    if ((decodedMsg && decodedMsg.payload && decodedMsg.payload.putModelUrl) &&
      (vectorToReduce && vectorToReduce.length > 0 && vectorToReduce[0].result.grads)) {
        tf.tidy(() => {
          let tensors = {};
          const tensorNames = Object.keys(vectorToReduce[0].result.grads);
          tensorNames.forEach(tensorName => {
            for (let i = 0; i < vectorToReduce.length; i++) {
              if (i == 0) tensors[tensorName] = [];
              logger.debug("tensorName" + tensorName);
              logger.debug("i" + i); 
              logger.debug(Object.keys(vectorToReduce[i].result.grads));
              tensors[tensorName].push(tf.tensor(vectorToReduce[i].result.grads[tensorName]));
            }
            tensors[tensorName] = tf.addN(tensors[tensorName]);
          });
          logger.debug("APPLYING TENSORS = " + JSON.stringify(tensors) + decodedMsg.payload.putModelUrl);
          self.currentModel.optimizer.applyGradients(tensors); 
        });
        logger.debug("MODEL = " + self.currentModel);
        logger.debug("saving model on " + decodedMsg.payload.putModelUrl);
        let savedModel = false;
        while (!savedModel) {
          try {
            await self.currentModel.save(tfjsIOHandler.webdisRequest(decodedMsg.payload.putModelUrl));
            savedModel = true;
          } catch (e) {
            logger.error("Error saving model: " + e + " " + decodedMsg.payload.putModelUrl);
          }
          //await self.currentModel.save(tfjsIOHandler.webdisRequest(decodedMsg.payload.putModelUrl)).catch(error => 
          //  logger.debug("ERROR SAVING MODEL " + error); 
          //);
        }
        logger.info("Reduce end (" + new Date().getTime()+")");
        return true; //"TRUE reduce completed"
    } else {
      logger.info("Reduce end (" + new Date().getTime()+")");
      return false; //"FALSE reduce incompleted"
    }
  }
}


(async () => {
  let workerInfo = null;
  if(process.argv.slice(2)[0]) {
    workerInfo = process.argv.slice(2)[0];
    logger.setId(workerInfo);
  } else {
    workerInfo = new Date().getTime().toString();
  }
  if(typeof navigator !== 'undefined') {
    workerInfo += " @ " + navigator.userAgent
  } else {
    workerInfo += " @ node";
  }
  const sampleLen = 40; // 1024;
  const sampleStep = 3; // 256;
  const textUrl = 'http://' + serverUrl + ':' + webdisPort + '/GET/' + taskName + '_text';
  let textString = await JSDDB.getText(textUrl);  
  dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
  logger.debug("waiting tasks ...");
  let problemData = new TensorFlowData();
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, problemData, workerInfo);
  worker.start();
})();





