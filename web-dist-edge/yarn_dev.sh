#!/bin/bash

# Just in case...
yarn unlink "web-dist-edge-utils"
yarn unlink "web-dist-edge-worker"
yarn unlink "web-dist-edge-monitor"

yarn unlink "tfjs_helper"

# Prepare and link
cd wde_monitor
yarn
yarn link
cd ..

cd wde_utils
yarn
yarn link
cd ..

cd wde_worker
yarn
yarn link
cd ..

cd examples/lstm-text-generation/tfjs_helper
yarn
yarn link
yarn link "web-dist-edge-utils"
yarn link "web-dist-edge-worker"
yarn link "web-dist-edge-monitor"
cd ..

cd monitor_app
yarn
yarn link "web-dist-edge-utils"
yarn link "web-dist-edge-worker"
yarn link "web-dist-edge-monitor"
yarn link "tfjs_helper"
cd ..

cd worker_app
yarn
yarn link "web-dist-edge-utils"
yarn link "web-dist-edge-worker"
yarn link "web-dist-edge-monitor"
yarn link "tfjs_helper"
cd ../../..
