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
   * @param {boolean} wordSet true = wordSet false = charSet.
   */
  constructor(textString, sampleLen, sampleStep, wordSet) {
    this.textString = textString;
    this.textLen = textString.length;
    this.sampleLen = sampleLen;
    this.sampleStep = sampleStep;

    if (wordSet) {
      this.getWordSet(textString);
    } else {
      this.getCharSet(textString);      
    }
    
  }
  //TODO -> Se pueden obtener los indices en un 2º metodo aunque para el ejemplo es
  //suficiente. Igual con exampleBeginIndices.
  getWordSet(textString) {
    this.charSet = [];
    this.indices = [];
    this.words = textString.split(" ");
    console.log("TOTAL WORDS "+this.words.length);
    for (let i = 0; i < this.words.length; ++i) {
      if (this.charSet.indexOf(this.words[i]) === -1) {
        this.charSet.push(this.words[i]);
      }
      this.indices.push(this.charSet.indexOf(this.words[i]));
    }
    this.indices = new Uint16Array(this.indices);
    console.log("TOTAL INDICES "+this.indices.length);   
    
    //    this.generateExampleBeginIndices();
    // Prepare beginning indices of examples.
    this.exampleBeginIndices = [];
    for (let i = 0;
        i < this.words.length - this.sampleLen - 1;
        i += this.sampleStep) {
      this.exampleBeginIndices.push(i);
    }    
  }

  //TODO -> Se pueden obtener los indices en un 2º metodo aunque para el ejemplo es
  //suficiente. Igual con exampleBeginIndices.
  getCharSet(textString) {
    this.charSet = [];
    this.indices = [];
    for (let i = 0; i < this.textString.length; ++i) {
      if (this.charSet.indexOf(this.textString[i]) === -1) {
        this.charSet.push(this.textString[i]);
      }
      this.indices.push(this.charSet.indexOf(this.textString[i]));
    }
    this.indices = new Uint16Array(this.indices);  

    //    this.generateExampleBeginIndices();
    // Prepare beginning indices of examples.
    this.exampleBeginIndices = [];
    for (let i = 0;
        i < this.textString.length - this.sampleLen - 1;
        i += this.sampleStep) {
      this.exampleBeginIndices.push(i);
    }       
  }


  getDataBatch(batchSize, batchIndex) {
    const xsBuffer = new tf.TensorBuffer([batchSize, this.sampleLen, this.charSet.length]);
    const ysBuffer  = new tf.TensorBuffer([batchSize, this.charSet.length]);
    for (let i = 0; i < batchSize; ++i) {
      const beginIndex = this.exampleBeginIndices[batchIndex % this.exampleBeginIndices.length];
      for (let j = 0; j < this.sampleLen; ++j) {
        xsBuffer.set(1, i, j, this.indices[beginIndex + j]);
      }
      ysBuffer.set(1, i, this.indices[beginIndex + this.sampleLen]);
    }
    return [xsBuffer.toTensor(), ysBuffer.toTensor()];
  }

  getFromCharSet(index) {
    return this.charSet[index];
  }

  shuffleBeginIndices() {
    // Randomly shuffle the beginning indices.
    tf.util.shuffle(this.exampleBeginIndices);
  }
  
}

module.exports.TextDataset = TextDataset;
