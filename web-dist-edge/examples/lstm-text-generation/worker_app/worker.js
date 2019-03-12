const wde = require('web-dist-edge-worker');
const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const local = false;
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
/* Map function
/*********************************************************************************************************************/
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryUntilLoadModel(modelUrl) {
	console.log("Loading model -> " + modelUrl);
	let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(modelUrl));
	while (!model) {
		console.log("Model not found -> " + modelUrl);
		console.log("Retrying loading the model -> " + modelUrl);
		await sleep(5000);
		model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(modelUrl));
	}
        console.log("Loaded model -> " + modelUrl + " -> " + model);
	return model;
}

async function mapFn(decodedMsg) {
  //TODO se están cogiendo todas las tareas y poniendo en segundo plano. Esto tiene el problema de que no hay límite,
  //pueden haber miles de tareas en segundo plano tal y como está implementado. Hay que poner que no coja nuevas tareas mientras 
  //se estén resolviendo N tareas.
  //TODO revisar que el modelo exista y espere
  console.log("Mapping");  
  // let model = await tfjsCustomModel.createLstmModel([5,5], 1024, dataset.charSet.length, learningRate = 0.1);

  let modelId = decodedMsg.payload.getModelUrl;
  modelId = modelId.substring(modelId.indexOf(taskName +"_model_id_") + (taskName +"_model_id_").length, modelId.length);

  //console.log("decodedMsg.payload.getModelUrl = " + decodedMsg.payload.getModelUrl);
  //console.log("this.currentModelId = " + this.currentModelId);
  //console.log("modelId = " + modelId);
  if (this.currentModelId < modelId) {
    //this.currentModel = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(decodedMsg.payload.getModelUrl));
    console.log("Model is outdated. " + this.currentModelId + " < " + modelId);
    this.currentModel = await retryUntilLoadModel(decodedMsg.payload.getModelUrl);
    this.currentModelId = modelId;
    console.log("Model updated to " + this.currentModelId);
    this.currentModel.summary();    
  } else if (this.currentModelId > modelId) {
    console.log("Error: It was received a map task from a previous model.");
    exit(-1);
  } else {
    console.log("Model is up to date.");
    //OK
  }


  //TODO learning rate?
  // let optimizer = tf.train.rmsprop(0.1);
  this.currentModel.compile({optimizer: decodedMsg.payload.optimizer, loss: 'categoricalCrossentropy'});  
  const [xs, ys] = dataset.getDataBatch(decodedMsg.payload.batchSize, decodedMsg.payload.beginIndex);
  //TODO pass the loss as a parameter
  const {value, grads} = this.currentModel.getGradientsAndSaveActions(xs, ys);
  result = {};
  result.value = value;
  //result.grads = grads;

	let jsonGrads = {};
	const tensorNames = Object.keys(grads);
	tensorNames.forEach(tensorName => {
		//console.log("### tensorNames[" + tensorName + "]" + grads[tensorName]);
		jsonGrads[tensorName] = grads[tensorName].arraySync();
		//jsonGrads[tensorName] = tf.tensor(jsonGrads[tensorName]);
	});
	//console.log(".............................jsonGrads = " + JSON.stringify(jsonGrads));
	//model.optimizer.applyGradients(jsonGrads);

  result.grads = jsonGrads;
  //TODO dispose!
  return result;
}


/*********************************************************************************************************************/
/* Reduce function
/*********************************************************************************************************************/

async function reduceFn(decodedMsg) {
  //TODO -> Es posible que sea necesario procesar los mensajes de 1 en 1 para que no haya varios procesos en segundo plano llamando
  // a reduceFn y a mapFn al mismo tiempo.
  console.log("Reducing");/*
  return new Promise((resolve, reject) => {
	  console.log("Reducing (inside promise)");
	  let totalReceived = 0;
	  console.log("subscribing to " + decodedMsg.queueName + "_maps");
	  this.subscribe(decodedMsg.queueName + "_maps", async (message) => {
		if (message.body) {
			console.log("message.body = " + JSON.stringify(message.body));
			const decoded = message.body;//JSON.parse(message.body); 
			console.log(totalReceived + " *************** RECEIVED REDUCE " + message.body);
			console.log(totalReceived + " *************** RECEIVED REDUCE " + decoded);
			totalReceived++;
			console.log("total reduce received = " + totalReceived);
			if (totalReceived >= 10) { //TODO -> Esto es para probar
				resolve("ALL REDUCE COMPLETED");
			}
		} else {
			console.error("ERROR: Wronge message received on reduceFn(decodedMsg) _maps");
			exit(-1);
		}

	  });	
	  //TODO: implement reducer
	  //return "Dummy reduce";
  }); */ 
  return "Dummy reduce";
}


/*********************************************************************************************************************/
/* Init worker
/*********************************************************************************************************************/

function getText(url){
    // read text from URL locations
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.mode = 'no-cors';
    request.overrideMimeType('text/plain;');
    request.send(null);
    request.onreadystatechange =  () => {
      if (request.readyState === 4 && request.status === 200) {
        let jsonBody = JSON.parse(request.responseText);
        resolve(jsonBody.GET);
	//resolve(request.responseText);
      }
    }
  });
}

(async () => {
  const sampleLen = 32; // 1024;
  const sampleStep = 8; // 256;
  const textUrl = 'http://' + serverUrl + ':' + webdisPort + '/GET/' + taskName + '_text';
  // console.log("loading text...");
  let textString = await getText(textUrl);
  //console.log("textString = " + textString);
  
  dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
  console.log("waiting tasks ...");
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, mapFn, reduceFn);
  worker.start();
})();
