#!/bin/bash

# Copy the code
cp -r ../lstm-text-generation/* .
# Then, we update the test configuration (worker and monitor)
# TODO update params in a config file (now the parameters are hard coded)
# Get the dependencies
cd data-server
yarn
cd ..
cd tfjs-helper
yarn
cd ..
cd lstm-worker-app
yarn
cd ..
cd lstm-monitor-app
yarn
cd ..
# And zip the code
zip -r lstm-worker-app.zip lstm-worker-app/

# Load the dataset
cd data-server
node load_data.js
cd ..

# First, we have to enqueue some tasks
NUMBER_OF_MAP_TASKS=12800
MAP_BATCH_SIZE_TO_REDUCE=16
cd lstm-monitor-app
node startMonitor.js $NUMBER_OF_MAP_TASKS $MAP_BATCH_SIZE_TO_REDUCE
cd ..

# TODO transfer the code to the HT-Concor master node,
# and submit the task 'condor_submit worker.sub'.
# scp lstm-worker-app.zip user@condor.server.com:

# TODO once the task has ended, clean up the mess!
node data-server/download_data.js
# TODO Do you want to move the resutls to another folder?
# TODO clear queues
# e.g., using RabbitMQ v. 3.5
# rabbitmqctl stop_app
# rabbitmqctl reset
# rabbitmqctl start_app
# rabbitmqctl add_user worker mypassword
# rabbitmqctl set_permissions -p / worker ".*" ".*" ".*"


