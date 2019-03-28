const JSDDB = require('jsd-utils/jsd-db');
const fs = require("fs");

const remote = true;
let host = 'localhost';
let port = 7379;
const taskName = 'condor_lstm_text_generation';
const maxModelId = 1000 / 10 + 1;

if(remote) { 
  host = 'http://mallba3.lcc.uma.es';
}

(async () => {
  const modelGetBaseUrl = host + ":" + port + '/GET/' + taskName + '_model_id';
  const modelSetBaseUrl = host + ":" + port + '/SET/' + taskName + '_model_id';
  for(let i=1; i <= maxModelId; i++) {
    let textString = await JSDDB.getText(modelGetBaseUrl + '_' + i);
    if(textString == null) break;
    fs.writeFile(taskName + "_model_id_" + i + ".json", textString, function(err, data) {
      if (err) console.log(err);
      console.log("Model id " + i + " saved");
    });
    await JSDDB.setText(modelSetBaseUrl + '_' + i, null);
  }  
})();

