const Stomp = require('stompjs');
// const SockJS = require('sockjs-client');
const WebSocketClient = require('websocket').w3cwebsocket;
const JSDLogger = require('jsd-utils/jsd-logger');


const logger = JSDLogger.logger;




/**
* WORKER (JavaScript Client)
*/
class Worker {
  constructor(serverUrl, port, queueName, user, pswd, problemData, workerInfo=null) {
    if(workerInfo) this.workerInfo = workerInfo;
    logger.debug("Worker = " + this.workerInfo);
    this.problemData = problemData;
    this.wsConnStr = 'ws://' + serverUrl + ':' + port + '/ws';
    logger.debug("Stomp URL = " + this.wsConnStr);
    this.user = user;
    this.pswd = pswd;
    this.queueName = queueName;
    let ws = new WebSocketClient(this.wsConnStr);
    this.client = Stomp.over(ws);
    this.client.debug = null;
    this.client.heartbeat.outgoing = 5000;//0;
    this.client.heartbeat.incoming = 5000;//0;
    this.client.reconnect_delay = 3000;

    this.queuesObjects = {};

    this.totalMsgs = 0;
  }

  async sendToQueue(msg, queueName) {
    logger.debug("MSG '" + JSON.stringify(msg).substring(0, 100) + "' queued on " + queueName);
    let sended = await this.client.send(queueName, {priority: 9}, msg);
    logger.debug("SENDED = " + sended);
  }

  async accumulatingReduce(decoded, self) {
    return new Promise((resolve, reject) => {
      let msgReceived = [];
      self.subscribe(decoded.queueName + "_maps_results_"+ decoded.reduceId, async (reduceMessage) => {
        if (reduceMessage.body) {
          // TODO Chequear si el mensaje recibido es para mi o no, o si es un mensaje antiguo, etc. 
          msgReceived.push(reduceMessage);
          logger.debug("total reduce received = " + msgReceived.length);
          if (msgReceived.length >= decoded.awaitId.length) { //TODO -> Esto es para probar
            resolve(msgReceived); //OUTER PROMISE
          }
          return true;
        } else {
          logger.error("ERROR: Wrong message received on reduceFn(decodedMsg) _maps_results_");
          reduceMessage.nack();
          resolve(null); //OUTER PROMISE
          throw new Error("ERROR: Wrong message received on reduceFn(decodedMsg) _maps_results_");
          //return false;
        }
      }, self, decoded.awaitId.length);  // TODO -> decoded.awaitId.length es el número de mensajes que se esperan (prefetch-count)
    });
  }

  async procMap(undecodedMsg, decoded, self) {
    let startDt = new Date().getTime();
    let mapResult = await self.problemData.mapFn(decoded, self.problemData);
    let endDt = new Date().getTime();
    logger.debug("mapResult = " + mapResult);
    let stats = {};
    stats.startDt = startDt;
    stats.endDt = endDt;
    stats.workerInfo = self.workerInfo;

    let msgResult = {};
    msgResult.procId = decoded.procId;
    msgResult.result = mapResult;
    msgResult.stats = stats;
    logger.debug("sendToQueue Map", msgResult, (decoded.queueName + "_maps_results_"+ decoded.reduceId));
    self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_maps_results_"+ decoded.reduceId);
    self.ack(undecodedMsg, self);
    return true;
  }

  async procReduce(undecodedMsg, decoded, self) {
    let receivedDt = new Date().getTime();
    let results = await self.accumulatingReduce(decoded, self);  
    let accumulatedReduce = results.map(x => JSON.parse(x.body));
    logger.debug("AFTER ACCUMULATING REDUCE accumulatedReduce = " + accumulatedReduce);
    logger.debug("self.problemData = " + self.problemData);
    let startDt = new Date().getTime();
    let reduceResult = await self.problemData.reduceFn(accumulatedReduce, decoded, self.problemData);
    let endDt = new Date().getTime();
    if (reduceResult) {
      logger.debug("reduceResult TRUE " + reduceResult);
      let stats = {};
      stats.receivedDt = receivedDt;
      stats.startDt = startDt;
      stats.endDt = endDt;
      stats.workerInfo = self.workerInfo;
      stats.mapStats = []
      // Rescatamos las estadísticas de los mappers
      for(let i=0; i < accumulatedReduce.length; i++){
        let tmp = {};
        tmp.procId = accumulatedReduce[i].procId;
        tmp.stats = accumulatedReduce[i].stats;
        stats.mapStats.push(JSON.stringify(tmp));
      }

      let msgResult = {}
      msgResult.procId = decoded.procId;
      msgResult.result = reduceResult;
      msgResult.stats = stats;

      //TODO -> De momento solo hay 1 reduce
      //self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_reduces_" + decoded.reduceId);	//TODO -> async? await?
      self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_reduces_results");	//TODO -> async? await?    

      /////////////TRANSACTION -->   
      logger.debug("Begin transaction of reducers");
      let tx = this.client.begin();
      let receipt = 'my-receipt' + new Date().getTime();
      let tran = { transaction: tx.id, receipt: receipt };
      self.ack(undecodedMsg, self, tran);
      results.map(x => self.ack(x, self, tran));
      //undecodedMsg.ack({ transaction: tx.id, receipt: receipt });
      //results.map(x => x.ack({ transaction: tx.id, receipt: receipt }));
      tx.commit();
      logger.debug("End transaction of reducers");
      //self.ack(undecodedMsg, self);
      //results.map(x => self.ack(x, self));
      /////////////
      self.unsubscribe(decoded.queueName + "_maps_results_"+ decoded.reduceId, self);
      return true;
    } else {
      logger.warn("WARNING: reduceResult FALSE " + reduceResult);
      /////////////TRANSACTION -->   
      logger.debug("Begin transaction of reducers");
      let tx = this.client.begin();
      let receipt = 'my-receipt' + new Date().getTime();
      self.nack(undecodedMsg, self, tran);
      results.map(x => self.nack(x, self, tran));
      //undecodedMsg.nack({ transaction: tx.id, receipt: receipt });
      //results.map(x => x.nack({ transaction: tx.id, receipt: receipt }));
      tx.commit();
      logger.debug("End transaction of reducers");
      self.unsubscribe(decoded.queueName + "_maps_results_"+ decoded.reduceId, self);
      //self.nack(undecodedMsg, self);
      //results.map(x => self.nack(x, self));
      /////////////
      return false;
    }	
  }

  async procMessage(undecodedMsg, self) {
    logger.info("Message received (" + new Date().getTime() + ")" + undecodedMsg.body);
    const decoded = JSON.parse(undecodedMsg.body); 
    if( decoded.mapOrReduce == "map" ) {
      if(self.problemData.mapFn && typeof(self.problemData.mapFn) == 'function') {
        return await self.procMap(undecodedMsg, decoded, self);
      } else {
        logger.error("ERROR: Map function not found");
        self.nack(undecodedMsg, self);
        throw new Error("ERROR: Map function not found");
        return false;
      }
    } else if ( decoded.mapOrReduce == "reduce" ) {
      if(self.problemData.reduceFn && typeof(self.problemData.reduceFn) == 'function') {
        return await self.procReduce(undecodedMsg, decoded, self);      
      } else {
        logger.error("ERROR: Reduce function not found");
        self.nack(undecodedMsg, self);
        throw new Error();
        return false;
      }  
    } else {
      logger.error("ERROR: Task corrupted");
      self.nack(undecodedMsg, self);
      throw new Error("ERROR: Task corrupted");
    }  
  }

  receive(queueName, message, self) {
    self.totalMsgs++;
    logger.debug("\n\n-------------------------------------------------------");
    logger.debug("+++ MSG total = " + self.totalMsgs + " -> " + message.body);
    logger.debug("msg from queue = " + queueName);
    logger.debug("message.body = " + message.body);
  }

  ack(message, self, tran) {
    if (tran) message.ack(tran);
    else message.ack();
    logger.debug("INFO: Msg ack() -> " + message.body);
    self.totalMsgs--;
    logger.debug("--- MSG total = " + self.totalMsgs + " -> " + message.body);
  }

  nack(message, self, tran) {
    if (tran) message.nack(tran);
    else message.nack();
    logger.warn("WARNING: Msg nack() -> " + message.body);
    self.totalMsgs--;
    logger.debug("--- MSG total = " + self.totalMsgs + " -> " + message.body);
  }

  subscribe(queueName, mypromise, self, prefetch) {
    // prefetch-count limita el número de mensajes que se reciben de la cola. Sólo después
    // de hacer ACK, se vuelve a recibir un mensaje
    //let queueObject = this.client.subscribe(queueName, callback, {ack: 'client', 'prefetch-count': 1});
    if (prefetch === undefined) prefetch = 1;

    let queueObject = self.client.subscribe(queueName, async (message) => {
      self.receive(queueName, message, self);
      logger.debug("mypromise result = " + await mypromise(message, self));      
    }, {ack: 'client', 'prefetch-count': prefetch});
    logger.info("###################################");
    self.queuesObjects[queueName] = queueObject;
    logger.debug("Subscribing to " + queueName + " queueObject = " + JSON.stringify(queueObject) + " prefetch = " + prefetch);
  }

  unsubscribe(queueName, self) {
    let queueObject = self.queuesObjects[queueName];
    logger.debug("Unsubscribing from " + queueName + " queueObject = " + JSON.stringify(queueObject));
    queueObject.unsubscribe();
  }

  start() {
    logger.warn("Starting ...");
    let onConnect = () => {
      logger.warn("Connected ...");
      this.subscribe(this.queueName, this.procMessage, this);
    }
    let onError = (e) => {
      logger.error("ERROR: Error connecting to " + this.wsConnStr + " -> " + e);
      this.start();
    }
    let mycon = this.client.connect(this.user, this.pswd, onConnect, onError, '/');
  }
}

module.exports.Worker = Worker;
