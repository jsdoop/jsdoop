#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const wde = require('jsd-monitor');

const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;

const JSDDB = require('jsd-utils/jsd-db');
const fs = require("fs");


const request = require('request');
async function getText(url){
  // read text from URL location
  console.log(url)
  return new Promise(function(resolve, reject) {
    request.get(url, function(err, res, content) {
      if (content) {
        console.log(content)
        try {
          let jsonBody = JSON.parse(content);
          resolve(jsonBody.GET);
        } catch (e) {
          logger.error(e);
          resolve("");
        }
      } else {
        console.log("error")
        resolve("");
      }

	//resolve(content);
    });	
  });	
}


/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//STATS
let idJob = new Date().getTime();



//TODO poner esto en un fichero de configuración
const local = true;
const taskName = 'lstm_text_generation';
const queueName = taskName + '_queue';
let amqpConnOptions = {};
let webdisPort = 7379;
if(local) {
  //connStr = wde.getAmqpConnectionStr('localhost');
  webdisPort = 3001;
  amqpConnOptions.server = 'localhost';
  amqpConnOptions.port = null;
  modelUrl = 'http://localhost:' + webdisPort;
  amqpConnOptions.user = 'guest';
  amqpConnOptions.pswd = 'guest';
} else {
  //connStr = wde.getAmqpConnectionStr('mallba3.lcc.uma.es', port=null, user='worker', pswd='mypassword');
  amqpConnOptions.server = 'mallba3.lcc.uma.es';
  amqpConnOptions.port = null;
  amqpConnOptions.user = 'worker';
  amqpConnOptions.pswd = 'mypassword';
  modelUrl = 'http://mallba3.lcc.uma.es:' + webdisPort;
}


/*********************************************************************************************************************/
/* Obtenemos el texto de entrenamiento
/*********************************************************************************************************************/

let numMaps; //GLOBAL (stats)
let accumReduce; //GLOBAL (stats)

(async () => {
  //TODO batchSize, sampleLen y sampleStep debieran ser configurables
  const batchSize = 8;
  const sampleLen = 40; //32; // 1024
  const sampleStep = 3; //8; // 256
  //const textUrl = 'http://mallba3.lcc.uma.es/jamorell/deeplearning/dataset/el_quijote.txt'
  const textUrl = modelUrl + '/GET/' + taskName + '_text';
  const lstmLayerSizes = [50,50];


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

  console.log(textUrl)
  const textString = await JSDDB.getString(textUrl).catch((err)=>{console.log(err)});  

  const dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
  console.log(dataset)

  
  // Generación del payload específico para los mappers
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;    
    payload.beginIndex = dataset.getNextBeginIndex();
    payload.batchSize = batchSize;
    payload.optimizer = 'rmsprop';
    return payload;
  }
  
  // Generación del payload específico para los reducers
  reducePayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.optimizer = 'rmsprop';
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;
    let setId = reduceIx + 1;
    payload.putModelUrl = modelUrl + "/SET/" + taskName +"_model_id_" + setId;
    return payload;
  }  
  
  /*********************************************************************************************************************/
  /* Parámetros de la tarea (i.e., node enqueue_task.js <numMaps> <accumReduce>)
  /*   numMaps
  /*   accumReduce
  /*********************************************************************************************************************/
  
  numMaps = parseInt(process.argv.slice(2)[0]);
  accumReduce = parseInt(process.argv.slice(2)[1]);
  if(isNaN(numMaps) || numMaps == null) {
    numMaps = 10;
  }
  if(isNaN(accumReduce) || accumReduce == null) {
    accumReduce = 3;
  }
  if(accumReduce > numMaps) {
    accumReduce = numMaps;
  }
  logger.debug("Name=" + taskName + ", numMaps=" + numMaps + ", accumReduce=" + accumReduce);
  
  // Finalmente encolamos las tareas
  let conn, ch;  
  [conn, ch] = await wde.wdeConnect(amqpConnOptions);

  //Catching signals and exceptions
  process.on('uncaughtException', function (err) {
    logger.error(err.stack);
    logger.error("Node NOT Exiting...");
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received.');
    ch.close();
    conn.close();
    logger.debug("DISCONNECTED CORRECTLY");
    process.exit(0);
  });
  process.on('SIGINT', () => {
    logger.info('SIGINT signal received.');
    ch.close();
    conn.close();
    logger.debug("DISCONNECTED CORRECTLY");
    process.exit(0);
  });


  //PURGING QUEUES
  let lastRemovedQueue = 1;
  try {
    await ch.purgeQueue(queueName);
    //await ch.deleteQueue(queueName);
    await ch.purgeQueue(queueName + "_reduces_results");
    //await ch.deleteQueue(queueName + "_reduces_results");
    for (let i = 1; i <= 99999999; i++) {
      await ch.purgeQueue(queueName + "_maps_results_" + i);
      //await ch.deleteQueue(queueName + "_maps_results_" + i);
      ////let deleted = await ch.deleteQueue(queueName + "_maps_results_" + i);
      ////console.log("Deleted queue " + i + " -> " + JSON.stringify(deleted));
      lastRemovedQueue++;
    }
  } catch (e) {
    try {
      ch.close();
      conn.close();
    } catch(ee){
      try {
        conn.close();
      } catch(ee){
        //NOTHING
      }
    }
    [conn, ch] = await wde.wdeConnect(amqpConnOptions);
  }


  //DOWNLOADING MODELS AND REMOVING MODELS
  const modelGetBaseUrl = modelUrl + '/GET/' + taskName + '_model_id';
  const modelSetBaseUrl = modelUrl + '/SET/' + taskName + '_model_id';
   logger.debug("lastRemovedQueue " + lastRemovedQueue);

  let modelFolder = "./models_" + taskName;
  let modelFolderId = 1;
  while (fs.existsSync(modelFolder + "_" + modelFolderId)) { 
    modelFolderId++;
  }
  modelFolder += "_" + modelFolderId;
  fs.mkdirSync(modelFolder);
  for(let i=1; i <= lastRemovedQueue; i++) {
     //logger.debug("lastRemovedQueue " + i + " " + lastRemovedQueue);
    let textString = await JSDDB.getText(modelGetBaseUrl + '_' + i);
    if(textString == null) break;
    fs.writeFile(modelFolder + "/" + taskName + "_model_id_" + i + ".json", textString, function(err, data) {
      if (err) logger.error(err);
      //logger.debug("Model id " + i + " saved");
    });
    await JSDDB.setText(modelSetBaseUrl + '_' + i, "");
  }  

  //REMOVING MODELS
  //for (let i = 0; i <= lastRemovedQueue; i++) {
  //  console.log("reseting " + modelUrl + "/SET/" + taskName +"_model_id_" + i);
  //  await JSDDB.setText(modelUrl + "/SET/" + taskName +"_model_id_", "");
  //}



  //SAVING STATS -
  const textAllMsgs = await JSDDB.getText(modelUrl + '/GET/' + taskName + "_all_msgs"); 
  if (textAllMsgs) {
    fs.writeFile(modelFolder + "/" + taskName + "_model_results.json", textAllMsgs, function(err, data) {
      if (err) logger.error(err);
      //logger.debug("Model id " + i + " saved");
    });
  }



  //REMOVING STATS -> //TODO -> Save stats to HD
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats_date", "");
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats", "");
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats_summary", "");

  //LOADING MODEL
  let model = await tfjsCustomModel.createLstmModel(lstmLayerSizes, sampleLen, dataset.charSet.length);
  let urlSavedModel = modelUrl + "/SET/" + taskName +"_model_id_" + 1;
  await model.save(tfjsIOHandler.webdisRequest(urlSavedModel)).catch(error => logger.error(error));

  //ch.prefetch(1); 
  await wde.enqueueTask(ch, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  ch.assertQueue(queueName + "_reduces_results");
  await wde.consumer(ch, queueName + "_reduces_results", calculateStats );
})();
















/*********************************************************************************************************************/
/* STATS
/*********************************************************************************************************************/
let allMsgs = [];
let stats = {};
let statsInterval = {};
let statsSummary = {};
let lastSaveStatsTime = 0;
const saveStatsInterval = 3000;

//let timeStampNTaskSolvedInLastInterval = [];//new Date().getTime();

let initTimeToSolveTasksInLastInterval = null;//mappers and reducers;
let totalTimeToSolveTasksInLastInterval = null;
let nMapsSolvedInLastInterval = 0;//mappers;
let nReducersSolvedInLastInterval = 0;//reducers;
let workersInLastInterval = {};

let taskSolvedInterval = 5;
let taskSolvedPerSecond = 0;


async function saveStats(){
  lastSaveStatsTime = new Date().getTime();
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_all_msgs", JSON.stringify(stats));
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats_date", "" + statsSummary.timeStamp);
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats", JSON.stringify(stats));
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_stats_summary", JSON.stringify(statsSummary));
}

function addStats(taskJSON){
   //console.log("-------------------------------\n");
   //console.log("taskJSON", JSON.stringify(taskJSON), "\n");
  let taskStats = taskJSON.stats;
   //console.log("taskStats", JSON.stringify(taskStats));

  workersInLastInterval[taskStats.workerInfo] = true; //STATS_INTERVAL

  if (!stats[taskStats.workerInfo]) {
    stats[taskStats.workerInfo] = {}; 
    stats[taskStats.workerInfo].mappers = [];
    stats[taskStats.workerInfo].reducers = [];
  }
  if (!statsInterval[taskStats.workerInfo]) {
    statsInterval[taskStats.workerInfo] = {}; 
    statsInterval[taskStats.workerInfo].mappers = [];
    statsInterval[taskStats.workerInfo].reducers = [];
  }

  let toAdd = {"procId" : taskJSON.procId, "receivedDt" : taskStats.receivedDt, "startDt" : taskStats.startDt, "endDt" : taskStats.endDt};

  let procType = taskJSON.procId.substring(0, taskJSON.procId.indexOf("_"));
  logger.debug("procType = " + procType);




  if (procType === "reducer") {
    nReducersSolvedInLastInterval++; //STATS_INTERVAL
    logger.debug("----------ADDING REDUCER " + nReducersSolvedInLastInterval);

    stats[taskStats.workerInfo].reducers.push(toAdd);    
    statsInterval[taskStats.workerInfo].reducers.push(toAdd);  
    for (let i = 0; i < taskStats.mapStats.length; i++) {
      addStats(JSON.parse(taskStats.mapStats[i]))
    }
  } else if (procType === "mapper") {
    logger.debug("----------ADDING MAPPER " + nMapsSolvedInLastInterval);

    nMapsSolvedInLastInterval++; //STATS_INTERVAL

    stats[taskStats.workerInfo].mappers.push(toAdd); 
    statsInterval[taskStats.workerInfo].mappers.push(toAdd); 
  }  
}

function standardDeviation(values, avg){ 
  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  
  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  var avg = sum / data.length;
  return avg;
}

function showStats() {

  let mappersTime = [];
  let mappersProcTime = [];

  let reducersTime = [];
  let reducersProcTime = [];

  let totalTimeMappers = 0;
  let totalProcTimeMappers = 0;

  let totalTimeReducers = 0;
  let totalProcTimeReducers = 0;

  
  let totalTimeTasks = 0;
  let totalProcTimeTasks = 0;

  for (var key in statsInterval){
      var workerId = key;

      for (let i = 0; i < statsInterval[workerId].mappers.length; i++) {
        mappersTime.push(statsInterval[workerId].mappers[i].endDt - statsInterval[workerId].mappers[i].receivedDt); 
        mappersProcTime.push(statsInterval[workerId].mappers[i].endDt - statsInterval[workerId].mappers[i].startDt);   
        totalTimeMappers += statsInterval[workerId].mappers[i].endDt - statsInterval[workerId].mappers[i].receivedDt;  
        totalProcTimeMappers += statsInterval[workerId].mappers[i].endDt - statsInterval[workerId].mappers[i].startDt;  
      }

      for (let i = 0; i < statsInterval[workerId].reducers.length; i++) {
        reducersTime.push(statsInterval[workerId].reducers[i].endDt - statsInterval[workerId].reducers[i].receivedDt); 
        reducersProcTime.push(statsInterval[workerId].reducers[i].endDt - statsInterval[workerId].reducers[i].startDt);   
        totalTimeReducers += statsInterval[workerId].reducers[i].endDt - statsInterval[workerId].reducers[i].receivedDt;  
        totalProcTimeReducers += statsInterval[workerId].reducers[i].endDt - statsInterval[workerId].reducers[i].startDt;  
      };
  }

  totalTimeTasks = totalTimeMappers + totalTimeReducers;
  totalProcTimeTasks = totalProcTimeMappers + totalProcTimeReducers;
  let tasksTime = mappersTime.concat(reducersTime);
  let tasksProcTime = mappersProcTime.concat(reducersProcTime);

  let avgTimeTasks = (totalTimeTasks / tasksTime.length);
  let sdTimeTasks = standardDeviation(tasksTime, avgTimeTasks);
  let avgProcTimeTasks = (totalProcTimeTasks / tasksProcTime.length);
  let sdProcTimeTasks = standardDeviation(tasksProcTime, avgProcTimeTasks);

  let avgTimeMappers = (totalTimeMappers / mappersTime.length);
  let sdTimeMappers = standardDeviation(mappersTime, avgTimeMappers);
  let avgTimeReducers = (totalTimeReducers / reducersTime.length);
  let sdTimeReducers = standardDeviation(reducersTime, avgTimeReducers);


  let avgProcTimeMappers = (totalProcTimeMappers / mappersProcTime.length);
  let sdProcTimeMappers = standardDeviation(mappersProcTime, avgProcTimeMappers);
  let avgProcTimeReducers = (totalProcTimeReducers / reducersProcTime.length);
  let sdProcTimeReducers = standardDeviation(reducersProcTime, avgProcTimeReducers);

  statsSummary = {};
  statsSummary.idJob = idJob;
  statsSummary.mappers = {};
  statsSummary.mappers.totalTime = totalTimeMappers.toFixed(2);
  statsSummary.mappers.avgTime = avgTimeMappers.toFixed(2);
  statsSummary.mappers.sdTime = sdTimeMappers.toFixed(2);
  statsSummary.mappers.maxTime = Math.max.apply(null, mappersTime).toFixed(2);
  statsSummary.mappers.minTime = Math.min.apply(null, mappersTime).toFixed(2);

  statsSummary.mappers.totalProcTime = totalProcTimeMappers.toFixed(2);
  statsSummary.mappers.avgProcTime = avgProcTimeMappers.toFixed(2);
  statsSummary.mappers.sdProcTime = sdProcTimeMappers.toFixed(2);
  statsSummary.mappers.maxProcTime = Math.max.apply(null, mappersProcTime).toFixed(2);
  statsSummary.mappers.minProcTime = Math.min.apply(null, mappersProcTime).toFixed(2);

  statsSummary.reducers = {};
  statsSummary.reducers.totalTime = totalTimeReducers.toFixed(2);
  statsSummary.reducers.avgTime = avgTimeReducers.toFixed(2);
  statsSummary.reducers.sdTime = sdTimeReducers.toFixed(2);
  statsSummary.reducers.maxTime = Math.max.apply(null, reducersTime).toFixed(2);
  statsSummary.reducers.minTime = Math.min.apply(null, reducersTime).toFixed(2);

  statsSummary.reducers.totalProcTime = totalProcTimeReducers.toFixed(2);
  statsSummary.reducers.avgProcTime = avgProcTimeReducers.toFixed(2);
  statsSummary.reducers.sdProcTime = sdProcTimeReducers.toFixed(2);
  statsSummary.reducers.maxProcTime = Math.max.apply(null, reducersProcTime).toFixed(2);
  statsSummary.reducers.minProcTime = Math.min.apply(null, reducersProcTime).toFixed(2);

  statsSummary.tasks = {};
  statsSummary.tasks.totalTime = totalTimeTasks.toFixed(2);
  statsSummary.tasks.avgTime = avgTimeTasks.toFixed(2);
  statsSummary.tasks.sdTime = sdTimeTasks.toFixed(2);
  statsSummary.tasks.maxTime = Math.max.apply(null, tasksTime).toFixed(2);
  statsSummary.tasks.minTime = Math.min.apply(null, tasksTime).toFixed(2);

  statsSummary.tasks.totalProcTime = totalProcTimeTasks.toFixed(2);
  statsSummary.tasks.avgProcTime = avgProcTimeTasks.toFixed(2);
  statsSummary.tasks.sdProcTime = sdProcTimeTasks.toFixed(2);
  statsSummary.tasks.maxProcTime = Math.max.apply(null, tasksProcTime).toFixed(2);
  statsSummary.tasks.minProcTime = Math.min.apply(null, tasksProcTime).toFixed(2);

  statsSummary.totalTasksSolved = tasksProcTime.length;

  statsSummary.totalTasksToSolve = numMaps + (numMaps / accumReduce) + ( (numMaps % accumReduce > 0 ? 1 : 0) );      
  statsSummary.percentageCompleted = (statsSummary.totalTasksSolved / statsSummary.totalTasksToSolve) * 100;
  statsSummary.percentageCompleted =   statsSummary.percentageCompleted.toFixed(2)

  statsSummary.timeStamp = new Date().getTime();

  if( totalTimeToSolveTasksInLastInterval > 1000) {
    statsSummary.taskSolvedPerSecond = (nMapsSolvedInLastInterval + nReducersSolvedInLastInterval) / (totalTimeToSolveTasksInLastInterval / 1000);
    statsSummary.taskSolvedPerSecond = statsSummary.taskSolvedPerSecond.toFixed(2);
  } else {
    statsSummary.taskSolvedPerSecond = 0;
  }
  statsSummary.nWorkers = Object.keys(workersInLastInterval).length;
  nMapsSolvedInLastInterval = 0;
  nReducersSolvedInLastInterval = 0;
  workersInLastInterval = {}; //STATS_INTERVAL 

  logger.debug("zzstats = " + JSON.stringify(stats));
  logger.debug("zzstatsSummary = " + JSON.stringify(statsSummary));
  logger.debug("zzstatsInterval = " + JSON.stringify(statsInterval));
  statsInterval = {};//STATS_INTERVAL
}


async function calculateStats(msg) {
  try {
    if (initTimeToSolveTasksInLastInterval == null) initTimeToSolveTasksInLastInterval = new Date().getTime();

    //console.log("statsMSG = " + msg);
    let taskJSON = JSON.parse(msg);
    allMsgs.push(taskJSON);
    //console.log("taskJSON = " + taskJSON);
    addStats(taskJSON);
    //console.log(JSON.stringify(stats));  


    
    if (new Date().getTime() > lastSaveStatsTime + saveStatsInterval) {
      logger.debug("UPDATING " + (lastSaveStatsTime + saveStatsInterval));
      let finalTime = new Date().getTime();
      totalTimeToSolveTasksInLastInterval = finalTime - initTimeToSolveTasksInLastInterval;
      initTimeToSolveTasksInLastInterval = finalTime;

      showStats();

      saveStats();
    }
    return true;
  } catch (e) {
    logger.error(e);
    return false;
  }
}


