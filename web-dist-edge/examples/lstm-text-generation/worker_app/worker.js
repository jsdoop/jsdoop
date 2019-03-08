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
  console.log("Mapping");  
  let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.webdisRequest(decodedMsg.payload.getModelUrl));
  model.summary();
  const [xs, ys] = dataset.getDataBatch(decodedMsg.payload.batchSize, decodedMsg.payload.beginIndex);
  const [value, grads] = model.getGradientsAndSaveActions(xs, ys);
  result = {};
  result.value = value;
  result.grads = grads;
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
    // read text from URL location
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            var type = request.getResponseHeader('Content-Type');
            if (type.indexOf("text") !== 1) {
                return request.responseText;
            }
        }
    }
}

(async () => {
  const sampleLen = 1024;
  const sampleStep = 256;
  const textUrl = 'http://mallba3.lcc.uma.es/jamorell/deeplearning/dataset/el_quijote.txt';
  let textString = getText(url);
  
  dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);

  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, mapFn, reduceFn);
  worker.start();
})();
