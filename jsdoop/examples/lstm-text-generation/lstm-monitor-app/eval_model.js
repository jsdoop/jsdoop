const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const JSDLogger = require('jsd-utils/jsd-logger');
const JSDDB = require('jsd-utils/jsd-db');


const logger = JSDLogger.logger;

/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const local = false;
const taskName = 'condor_lstm_text_generation';
const queueName = taskName + '_queue';
let serverUrl;
let webdisPort = 7379;
if(local) {
  serverUrl = 'localhost';
  webdisPort = 3001;
} else {
  serverUrl = 'mallba3.lcc.uma.es';
}


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/


(async () => {
  let modelPath = process.argv.slice(2)[0];
  logger.debug(modelPath);
  const sampleLen = 40; 
  const sampleStep = 3;
  const numValSamples = 200;

  const textUrl = 'http://' + serverUrl + ':' + webdisPort + '/GET/' + taskName + '_text';
  let textString = await JSDDB.getText(textUrl);

  let dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
  let model = await tfjsCustomModel.loadCustomModel(tfjsIOHandler.nodeFileRequest(modelPath));
  // model.summary();
  let [xs, ys] = dataset.getDataBatch(numValSamples,0);
  let labels = model.predictOnBatch(xs);
  let loss = tf.losses.softmaxCrossEntropy(ys, labels).asScalar();
  logger.debug(loss);
})();
