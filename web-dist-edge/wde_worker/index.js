//const stw = require('../libs/stompws.js');
const Stomp = require('stompjs');
const SockJS = require('sockjs-client');
const request = require('request');

/**
* WORKER (JavaScript Client)
*/
class Worker {
  constructor(serverUrl, port, queueName, user, pswd, mapFn, reduceFn) {
    this.mapFn = mapFn;
    this.reduceFn = reduceFn;
    this.wsConnStr = 'http://' + serverUrl + ':' + port + '/stomp';
    this.user = user;
    this.pswd = pswd;
    this.queueName = queueName;
    let ws = new SockJS(this.wsConnStr);
    this.client = Stomp.over(ws);
    this.client.heartbeat.outgoing = 0;
    this.client.heartbeat.incoming = 0;
  }

  sendToQueue(msg, queueName) {
    //TODO poner el mensaje en la cola
    console.log("Mensaje '" + JSON.stringify(msg) + "' encolado en " + queueName);
  }

  procMessage(msg, self) {
    const decoded = JSON.parse(msg); 
    if( decoded.mapOrReduce == "map" ) {
      if(self.mapFn && typeof(self.mapFn) == 'function') {
        let mapResult = self.mapFn(decoded);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = mapResult;
        self.sendToQueue(msgResult, decoded.queueName + "_maps");
      } else {
        console.log("Map function not found");
      }
    } else if ( decoded.mapOrReduce == "reduce" ) {
      if(self.reduceFn && typeof(self.reduceFn) == 'function') {
        //TODO gestionar la espera, i.e., ocultamos al usuario el
        // bloqueo a la espera de que las tareas en "await" hayan acabado,
        // e incluir los resultados de las tareas
        let reduceResult = self.reduceFn(decoded);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = reduceResult;
        self.sendToQueue(msgResult, decoded.queueName + "_reduces");
      } else {
        console.log("Reduce function not found");
      }
    } else {
      console.log("Error, task corrupted");
    }  
  }

  start() {
    let self = this;
    let onConnect = () => {
      let sub = this.client.subscribe(self.queueName, function(message) {
        self.procMessage(message.body, self);
      });
    }
    let onError = () => {
      console.log("Error connecting to " + self.wsConnStr);
    }
    this.client.connect(this.user, this.pswd, onConnect, onError, '/');
  }
}

module.exports.Worker = Worker;
