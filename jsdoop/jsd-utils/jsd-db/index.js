const request = require('request');

async function getText(url){
  // read text from URL location
  return new Promise(function(resolve, reject) {
    request.get(url, function(err, res, content) {
      let jsonBody = JSON.parse(content);
      resolve(jsonBody.GET);
	//resolve(content);
    });	
  });	
}
module.exports.getText = getText;

async function setText(url, text){
  return new Promise(function(resolve, reject) {
    request.put({url: url, form: ""+text, headers: {'Content-Type': 'text/plain' }}, 
    (err, httpResponse, body) => {
      resolve(body);
    });
  });	  
}
module.exports.setText = setText;

