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
if(local) {
  serverUrl = 'localhost';
  user = 'guest';
  pswd = 'guest';
} else {
  serverUrl = 'mallba3.lcc.uma.es';
}

let dataset;

/*********************************************************************************************************************/
/* Map function
/*********************************************************************************************************************/

async function mapFn(decodedMsg) {
  //TODO revisar que el modelo exista y espere
  console.log("Mapping");  
  // let model = await tfjsCustomModel.createLstmModel([5,5], 1024, dataset.charSet.length, learningRate = 0.1);
  let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(decodedMsg.payload.getModelUrl));
  model.summary();
  //TODO learning rate?
  // let optimizer = tf.train.rmsprop(0.1);
  model.compile({optimizer: decodedMsg.payload.optimizer, loss: 'categoricalCrossentropy'});  
  const [xs, ys] = dataset.getDataBatch(decodedMsg.payload.batchSize, decodedMsg.payload.beginIndex);
  //TODO pass the loss as a parameter
  const {value, grads} = model.getGradientsAndSaveActions(xs, ys);
  result = {};
  result.value = value;
  result.grads = grads;
  console.log(grads);
  //TODO dispose!
  return result;
}


/*********************************************************************************************************************/
/* Reduce function
/*********************************************************************************************************************/

async function reduceFn(decodedMsg) {
  console.log("Reducing");
  //TODO: implement reducer
  return "Dummy reduce";
}


/*********************************************************************************************************************/
/* Init worker
/*********************************************************************************************************************/

function getText(url){
    // read text from URL locations
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.mode = 'no-cors';
    request.overrideMimeType('text/json;');
    request.send(null);
    request.onreadystatechange = function () {
      if (request.readyState === 4 && request.status === 200) {
        let jsonBody = JSON.parse(request.responseText);
        resolve(jsonBody.GET);
      }
    }
  });
}

(async () => {
  const sampleLen = 32; // 1024;
  const sampleStep = 8; // 256;
  const textUrl = 'http://' + serverUrl + ':7379/GET/' + taskName + '_text';
  let textString = await getText(textUrl);
  
  dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);

  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, mapFn, reduceFn);
  worker.start();
})();
