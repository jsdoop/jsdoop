const tf = require('@tensorflow/tfjs');

/**
*
*/
async function createLstmModel(lstmLayerSizes, sampleLen, charSetSize, learningRate = 0.1) {
  if (!Array.isArray(lstmLayerSizes)) {
    lstmLayerSizes = [lstmLayerSizes];
  }
  let model = tf.sequential();
  for (let i = 0; i < lstmLayerSizes.length; ++i) {
    const lstmLayerSize = lstmLayerSizes[i];
    model.add(tf.layers.lstm({
        units: lstmLayerSize,
        returnSequences: i < lstmLayerSizes.length - 1,
        inputShape: i === 0 ? [sampleLen, charSetSize] : undefined
    }));
  }
  model.add(tf.layers.dense({units: charSetSize, activation: 'softmax'}));
  model.summary();
  return model;
}

module.exports.createLstmModel = createLstmModel;



/**
*
*/
tf.Model.prototype.getPredLabels = function (x) {
  return tf.tidy(() => {
    // return this.model.predict(x, {batchSize: x.shape[0]});
    return this.model.predictOnBatch(x);
  });
}

tf.Model.prototype.getGradientsAndSaveActions = function (x, y) {
  // x.dataSync();
  // y.dataSync();
  const f = () => { 
    return tf.tidy(() => {
      const labels = this.getPredLabels(x);
      // labels.dataSync();
      return tf.losses.softmaxCrossEntropy(y, labels).asScalar();
    });
  }
/*  const {value, grads} = tf.variableGrads(f);
  console.log(grads);
  return {value, grads};*/
  return tf.variableGrads(f);
}


async function loadCustomModel(IOHandler) {
  //TODO validar que el modelo tiene la functión getGradientsAndSaveActions
  return tf.loadModel(IOHandler).catch(error => console.log("ERROR:" + error));
}

module.exports.loadCustomModel = loadCustomModel;
