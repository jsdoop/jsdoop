import * as tf from '@tensorflow/tfjs';
import * as tfc from '@tensorflow/tfjs-core';
import * as tape from '@tensorflow/tfjs-core/dist/tape';
import * as util from '@tensorflow/tfjs-core/dist/util';
import * as gu from '@tensorflow/tfjs-layers/dist/utils/generic_utils';
import * as tftt from '@tensorflow/tfjs-layers/dist/engine/training_tensors';
import * as tfe from '@tensorflow/tfjs-layers/dist/engine/executor';


function ones(shape) {
  const values = util.makeOnesTypedArray(util.sizeFromShape(shape), 'float32');
  return tf.Tensor.make(shape, {values});
}

/*
export function getFilteredNodesXToY(tape, xs, y){
  // Forward pass to compute all the nodes and Tensors that are transitively a
  // function of x.
  const tensorsFromX= {};
  const nodesFromX= {};
  for (let i = 0; i < xs.length; i++) {
    tensorsFromX[xs[i].id] = true;
  }

  for (let i = 0; i < tape.length; i++) {
    const node = tape[i];
    const nodeInputs = node.inputs;
    for (const inputName in nodeInputs) {
      const input = nodeInputs[inputName];

      let anyInputFromX = false;
      for (let j = 0; j < xs.length; j++) {
        if (tensorsFromX[input.id]) {
          node.outputs.forEach(output => tensorsFromX[output.id] = true);
          anyInputFromX = true;
          nodesFromX[node.id] = true;
          break;
        }
      }

      if (anyInputFromX) {
        break;
      }
    }
  }

  // Backward pass to find all of the nodes and Tensors that lead to y.
  const tensorsLeadToY = {};
  tensorsLeadToY[y.id] = true;
  const nodesToY = {};

  for (let i = tape.length - 1; i >= 0; i--) {
    const node = tape[i];
    const nodeInputs = node.inputs;

    // If any of the outputs lead to y, mark all of the inputs as leading to y.
    for (let j = 0; j < node.outputs.length; j++) {
      if (tensorsLeadToY[node.outputs[j].id]) {
        for (const inputName in nodeInputs) {
          tensorsLeadToY[nodeInputs[inputName].id] = true;
          nodesToY[node.id] = true;
        }
        break;
      }
    }
  }
  console.log(tape);
  console.log(nodesFromX);
  console.log(nodesToY);
  // Return the paths that come from x and lead to y.
  const filteredTape= [];
  for (let i = 0; i < tape.length; i++) {
    const node = tape[i];

    if (nodesFromX[node.id] && nodesToY[node.id]) {
      // Prune the inputs from the node that aren't a function of x.
      const prunedInputs = {};
      for (const inputName in node.inputs) {
        const nodeInput = node.inputs[inputName];
        if (tensorsFromX[nodeInput.id]) {
          prunedInputs[inputName] = nodeInput;
        }
      }

      // Copy the node and overwrite inputsAndArgs to the pruned version.
      const prunedNode = Object.assign({}, node);
      prunedNode.inputs = prunedInputs;
      prunedNode.outputs = node.outputs;

      filteredTape.push(prunedNode);
    }
  }
  console.log(filteredTape);
  return filteredTape;
}*/


function backpropagateGradients(tensorAccumulatedGradientMap, filteredTape) {
  // Walk the tape backward and keep a map of Tensor to its gradient.
  for (let i = filteredTape.length - 1; i >= 0; i--) {
    console.log("i="+filteredTape[i].id + " "+filteredTape[i].name);
    const node = filteredTape[i];

    const dys = [];
    node.outputs.forEach(o => {
      const gradTensor = tensorAccumulatedGradientMap[o.id];
      if (gradTensor != null) {
        dys.push(gradTensor);
      } else {
        // This particular output is not in the back-propagation subgraph, so it
        // does not affect the final output, thus we put zeros for its dy.
        const dy = Tensor.make(
            o.shape, {values: util.makeZerosTypedArray(o.size, o.dtype)},
            o.dtype);
        dys.push(dy);
      }
    });
    console.log("A");
    if (node.gradient == null) {
      throw new Error(
          `Cannot compute gradient: gradient function not found ` +
          `for ${node.name}.`);
    }

    // Backprop dy through this node and accumulate gradients over the inputs.
    const inputGradients =
        // Grad functions of ops with single outputs expect a dy, while ops
        // with multiple outputs expect dys (array of dy).
        node.gradient(node.outputs.length === 1 ? dys[0] : dys);
    console.log("B");
    for (const inputName in node.inputs) {
      if (!(inputName in inputGradients)) {
        throw new Error(
            `Cannot backprop through input ${inputName}. ` +
            `Available gradients found: ${Object.keys(inputGradients)}.`);
      }

      // Call the gradient function.
      const dx = inputGradients[inputName]();
      if (dx.dtype !== 'float32') {
        throw new Error(
            `Error in gradient for op ${node.name}. The gradient of input ` +
            `${inputName} must have 'float32' dtype, but has '${dx.dtype}'`);
      }
      const x = node.inputs[inputName];
      if (!util.arraysEqual(dx.shape, x.shape)) {
        throw new Error(
            `Error in gradient for op ${node.name}. The gradient of input ` +
            `'${inputName}' has shape '${dx.shape}', which does not match ` +
            `the shape of the input '${x.shape}'`);
      }

      if (tensorAccumulatedGradientMap[x.id] == null) {
        tensorAccumulatedGradientMap[x.id] = dx;
      } else {
        const curGradient = tensorAccumulatedGradientMap[x.id];
        tensorAccumulatedGradientMap[x.id] = curGradient.add(dx);
        curGradient.dispose();
      }
    }
    console.log("C");
  }
}

async function loadCustomModel(handler) {
    // Alternativa 1
    tf.Model.prototype.getPredLabels = function (x) {
      return tf.tidy(() => {
        this.execute = function (a, b) {
          console.log("ESTAMOS ADENTRO");
          console.log(a);
          console.log(b);
        }
        console.log(this.model.execute);
        return this.model.predictOnBatch(x);
      });
    }
    tf.Model.prototype.getGradientsAndSaveActions = function (x, y) {
      x.dataSync();
      y.dataSync();
      const f = () => { 
        return tf.tidy(() => {
          const labels = this.getPredLabels(x);
          labels.dataSync();
          return tf.losses.softmaxCrossEntropy(y, labels).asScalar();
        });
      }
      return tf.variableGrads(f);
    }
    // Alternativa 2
    tf.Model.prototype.getGradsOnBatch = async function (x, y) {      
      x.dataSync();
      y.dataSync();
      const inputs  = x;
      const targets = y;
      const totalLossFunction = () => {
        const predicts = this.predictOnBatch(inputs);
        // const syncPred = tf.tensor2d( predicts.dataSync(), targets.shape);
        const totalLoss = tf.losses.softmaxCrossEntropy(targets, predicts).mean();        
        return totalLoss;
      }
      const variables = this.trainableWeights.map(param => param.read());
      // const {value, grads} = tf.ENV.engine.gradients.call(tf.ENV.engine, totalLossFunction, variables, null, true);
      const {value, grads} = tf.ENV.engine.tidy('gradients', () => {
          let value = totalLossFunction();
          // const filteredTape = getFilteredNodesXToY(tf.ENV.engine.activeTape, variables, value);
          const filteredTape = tape.getFilteredNodesXToY(tf.ENV.engine.activeTape, variables, value);
          console.log(filteredTape);
          let accumulatedGradientMap = {};
          accumulatedGradientMap[value.id] = ones(value.shape);
          console.log("ANTES");
          backpropagateGradients(accumulatedGradientMap, filteredTape);
          console.log("DESPUES");
          //tape.backpropagateGradients(accumulatedGradientMap, filteredTape);
          const grads = variables.map(x => accumulatedGradientMap[x.id]);
          return {value, grads}
        }, true);
      return {value, grads};
    }
        
    let model = await tf.loadModel(handler).catch(error => console.log(error));      
    return model;  
}

module.exports = {    
    loadCustomModel
};
