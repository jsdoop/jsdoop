#!/bin/bash

# First, we have to enqueue some tasks
NUMBER_OF_MAP_TASKS=1
MAP_BATCH_SIZE_TO_REDUCE=1
cd monitor_app
yarn
node startMonitor.js $NUMBER_OF_MAP_TASKS $MAP_BATCH_SIZE_TO_REDUCE
cd ..

# Then, we run the worker code
# But first, we have to get the code ready wo work
WORKER_TIME_SECONDS=10*60
cd worker_app
yarn
# node worker.js $WORKER_TIME_SECONDS
cd ..
# Second, we zip the code
zip -r worker_app.zip worker_app/
# TODO transfer the code to the HT-Concor master node,
# and submit the task 'condor_submit worker.sub'.
