const wde = require('jsd-worker');
const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;

const JSDDB = require('jsd-utils/jsd-db');


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


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/*********************************************************************************************************************/
/* Estructura de datos del problema
/* TODO: sacar de aquí
/*********************************************************************************************************************/
class TensorFlowData {
    constructor() {
      this.currentModelId = -1;
      this.currentModel = null;
  }

  async retryUntilLoadModel(modelUrl) {
	  logger.debug("Loading model -> " + modelUrl);
    /*
    let isReady = await getText(modelUrl + "_ok");
    while (isReady != "OK") {
		  logger.debug("Model not found -> " + modelUrl);
		  logger.debug("Retrying loading the model -> " + modelUrl);
		  await sleep(5000);
      isReady = await getText(modelUrl + "_ok");
      logger.debug("isReady = " + isReady);
    }
    let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(modelUrl));
    if (!model) {
      logger.debug("ERROR: Model could not be loaded.");
      throw new Error();
    }
    */
	  let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(modelUrl));
	  while (!model) {
		  logger.debug("Model not found -> " + modelUrl);
		  logger.debug("Retrying loading the model -> " + modelUrl);
		  model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(modelUrl));
	  }
    logger.debug("Loaded model -> " + modelUrl + " -> " + model);
	  return model;
  }


  async updateModel(decodedMsg, self) {
    let modelId = decodedMsg.payload.getModelUrl;
    modelId = modelId.substring(modelId.indexOf(taskName +"_model_id_") + (taskName +"_model_id_").length, modelId.length);
    if (self.currentModelId != modelId) {
      //self.currentModel = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(decodedMsg.payload.getModelUrl));
      logger.debug("Model is outdated. " + self.currentModelId + " < " + modelId);
      self.currentModel = await self.retryUntilLoadModel(decodedMsg.payload.getModelUrl);
      self.currentModelId = modelId;
      logger.debug("Model updated to " + self.currentModelId);
      self.currentModel.summary();   
      return true; 
   // } else if (self.currentModelId > modelId) {
   //   logger.debug("Error: It was received a map task from a previous model.");
   //   throw new Error();
    } else {
      logger.debug("Model is up to date.");
      return true;
      //OK
    }

  }

  /*********************************************************************************************************************/
  /* Map function
  /*********************************************************************************************************************/
  async mapFn(decodedMsg, self) {
    //TODO se están cogiendo todas las tareas y poniendo en segundo plano. Esto tiene el problema de que no hay límite,
    //pueden haber miles de tareas en segundo plano tal y como está implementado. Hay que poner que no coja nuevas tareas mientras 
    //se estén resolviendo N tareas.
    //TODO revisar que el modelo exista y espere
    logger.debug("Mapping");  
    // let model = await tfjsCustomModel.createLstmModel([5,5], 1024, dataset.charSet.length, learningRate = 0.1);

    await self.updateModel(decodedMsg, self);
    
    //TODO learning rate?
    // let optimizer = tf.train.rmsprop(0.1);
    self.currentModel.compile({optimizer: decodedMsg.payload.optimizer, loss: 'categoricalCrossentropy'});  
    const [xs, ys] = dataset.getDataBatch(decodedMsg.payload.batchSize, decodedMsg.payload.beginIndex);
    //TODO pass the loss as a parameter
    const {value, grads} = self.currentModel.getGradientsAndSaveActions(xs, ys);
    let result = {};
    result.value = value;
    //result.grads = grads;

	  let jsonGrads = {};
	  //let jsonGradShapes = {};
	  const tensorNames = Object.keys(grads);
	  tensorNames.forEach(tensorName => {
		  //logger.debug("### tensorNames[" + tensorName + "]" + grads[tensorName]);
		
      //jsonGradShapes[tensorName] = grads[tensorName].shape;  //No necesitamos el shape
		  jsonGrads[tensorName] = grads[tensorName].arraySync(); //grads[tensorName].flatten().arraySync();
		  //jsonGrads[tensorName] = tf.tensor(jsonGrads[tensorName]);
	  });
	  //logger.debug(".............................jsonGrads = " + JSON.stringify(jsonGrads));
	  //model.optimizer.applyGradients(jsonGrads);
    //result.shapes = jsonGradShapes;
    result.grads = jsonGrads;
    //TODO dispose!
    return result;
  }


  /*********************************************************************************************************************/
  /* Reduce function
  /*********************************************************************************************************************/
  async reduceFn(vectorToReduce, decodedMsg, self) {
    
    //TODO -> Es posible que sea necesario procesar los mensajes de 1 en 1 para que no haya varios procesos en segundo plano llamando
    // a reduceFn y a mapFn al mismo tiempo.
    logger.debug("Reducing");


    await self.updateModel(decodedMsg, self);

    ///////////////////////////////////////////////////TESTING
    logger.debug("### decodedMsg = " + decodedMsg);
    if (decodedMsg) {
      logger.debug("### decodedMsg.payload = " + decodedMsg);
      logger.debug("### decodedMsg.payload.putModelUrl = " + decodedMsg.payload.putModelUrl);
      logger.debug("### vectorToReduce = " + vectorToReduce);
      logger.debug("### vectorToReduce.length = " + vectorToReduce.length);
      logger.debug("### vectorToReduce[0].result.grads = " + vectorToReduce[0].result.grads);
    }
    ///////////////////////////////////////////////////TESTING

    if ((decodedMsg && decodedMsg.payload && decodedMsg.payload.putModelUrl) &&
       (vectorToReduce && vectorToReduce.length > 0 && vectorToReduce[0].result.grads)) {
        tf.tidy(() => {
          //let procId = vectorToReduce[0].procId.substring("mapper_".length, vectorToReduce[0].procId.length);
          //procId = procId.substring(0, procId.indexOf("_"));
          //logger.debug("PROC_ID = " + procId);
          let tensors = {};
          const tensorNames = Object.keys(vectorToReduce[0].result.grads);
          tensorNames.forEach(tensorName => {
            for (let i = 0; i < vectorToReduce.length; i++) {
              if (i == 0) tensors[tensorName] = [];
              tensors[tensorName].push(tf.tensor(vectorToReduce[i].result.grads[tensorName]));
            }
            tensors[tensorName] = tf.addN(tensors[tensorName]);
          });
          logger.debug("APPLYING TENSORS = " + JSON.stringify(tensors) + decodedMsg.payload.putModelUrl);
          self.currentModel.optimizer.applyGradients(tensors); 
        });
        logger.debug("MODEL = " + self.currentModel);
        logger.debug("saving model on " + decodedMsg.payload.putModelUrl);
        await JSDDB.setText('http://' + serverUrl + ':' + webdisPort + '/SET/' + taskName + "_current_model_id", self.currentModelId);
        await self.currentModel.save(tfjsIOHandler.webdisRequest(decodedMsg.payload.putModelUrl)).catch(error => logger.debug("ERROR SAVING MODEL " + error));
        //putText("OK", decodedMsg.payload.putModelUrl + "_ok");
        return true; //"TRUE reduce completed"
    } else {
      return false; //"FALSE reduce incompleted"
    }
    //logger.debug("reduceFn = " + JSON.stringify(reduceTask));

/*
            await self.currentModel.save(tfjsIOHandler.webdisRequest(decodedMsg.payload.putModelUrl)).catch(error => logger.debug("ERROR SAVING MODEL " + error));
            return true;
*/
    //return "Dummy reduce";
  }
}


(async () => {
  const sampleLen = 32; // 1024;
  const sampleStep = 8; // 256;
  const textUrl = 'http://' + serverUrl + ':' + webdisPort + '/GET/' + taskName + '_text';
  // logger.debug("loading text...");
  //let textString = await JSDDB.getText(textUrl);
  let textString = await JSDDB.getText(textUrl);  
  //logger.debug("textString = " + textString);
  
  dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
  logger.debug("waiting tasks ...");
  let problemData = new TensorFlowData();
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, problemData);
  worker.start();
})();
