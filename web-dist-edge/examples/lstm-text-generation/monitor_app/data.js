const tf = require('@tensorflow/tfjs');

/**
 * 
 */
class TextDataset {
  /**
   * Constructor of TextData.
   *
   * @param {string} textString The training text data.
   * @param {number} sampleLen Length of each training example, i.e., the input
   *   sequence length expected by the LSTM model.
   * @param {number} sampleStep How many characters to skip when going from one
   *   example of the training data (in `textString`) to the next.
   */
  constructor(textString, sampleLen, sampleStep) {
    this.textString = textString;
    this.textLen = textString.length;
    this.sampleLen = sampleLen;
    this.sampleStep = sampleStep;

    this.getCharSet();
    this.convertAllTextToIndices();
    this.generateExampleBeginIndices();
  }

  getCharSet() {
    this.charSet = [];
    for (let i = 0; i < this.textLen; ++i) {
      if (this.charSet.indexOf(this.textString[i]) === -1) {
        this.charSet.push(this.textString[i]);
      }
    }
    this.charSetSize = this.charSet.length;
  }

  convertAllTextToIndices() {
    this.indices = new Uint16Array(this.textToIndices(this.textString));
  }

  textToIndices(text) {
    const indices = [];
    for (let i = 0; i < text.length; ++i) {
      indices.push(this.charSet.indexOf(text[i]));
    }
    return indices;
  }

  nextDataBatch(batchSize) {
    const xsBuffer = new tf.TensorBuffer([batchSize, this.sampleLen, this.charSetSize]);
    const ysBuffer  = new tf.TensorBuffer([batchSize, this.charSetSize]);
    for (let i = 0; i < batchSize; ++i) {
      const beginIndex = this.exampleBeginIndices[this.examplePosition % this.exampleBeginIndices.length];
      for (let j = 0; j < this.sampleLen; ++j) {
        xsBuffer.set(1, i, j, this.indices[beginIndex + j]);
      }
      ysBuffer.set(1, i, this.indices[beginIndex + this.sampleLen]);
      this.examplePosition++;
    }
    return [xsBuffer.toTensor(), ysBuffer.toTensor()];
  }

  getFromCharSet(index) {
    return this.charSet[index];
  }

  generateExampleBeginIndices() {
    // Prepare beginning indices of examples.
    this.exampleBeginIndices = [];
    for (let i = 0;
        i < this.textLen - this.sampleLen - 1;
        i += this.sampleStep) {
      this.exampleBeginIndices.push(i);
    }

    // Randomly shuffle the beginning indices.
    tf.util.shuffle(this.exampleBeginIndices);
    this.examplePosition = 0;
  }
}

module.exports.TextDataset = TextDataset;
