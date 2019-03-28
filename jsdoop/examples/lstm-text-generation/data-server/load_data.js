const JSDDB = require('jsd-utils/jsd-db');

const remote = true;
let host = 'localhost';
let port = 7379;
const taskName = 'condor_lstm_text_generation';
let taskTextUrl =  taskName + '_text'
let dataSetName = "el_quijote_full_trimmed.txt";

if(remote) { 
  host = 'http://mallba3.lcc.uma.es';
}


  var fs = require('fs');
  fs.readFile(dataSetName, 'utf8', function(err, dataset) {
    if (err) throw err;
    (async () => {
      await JSDDB.setText(host + ":" + port + '/SET/' + taskTextUrl, dataset);
      console.log(dataset);
    })();
  });

