#!/bin/bash

cd ..

# Unlink
cd jsd-monitor
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink
cd ..

cd jsd-worker
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink
cd ..

cd jsd-utils
rm -r node_modules
cd jsd-db
rm -r node_modules
cd ..
cd jsd-logger
rm -r node_modules
cd ..
cd ..


cd examples/lstm-text-generation/tfjs-helper
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink

cd ..

cd data-server
rm -r node_modules
yarn unlink
cd ..

cd lstm-monitor-app
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink "jsd-monitor"
yarn unlink "tfjs-helper"
yarn unlink
cd ..

cd lstm-worker-app
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink "jsd-worker"
yarn unlink "tfjs-helper"
yarn unlink
cd ../../..



# Prepare and link
cd jsd-utils
yarn
yarn link
cd jsd-logger
yarn
yarn link
cd ..
cd jsd-db
yarn
yarn link
cd ..
cd ..

cd jsd-monitor
yarn
yarn link
yarn link "jsd-utils"
cd ..

cd jsd-worker
yarn
yarn link
yarn link "jsd-utils"
cd ..

cd examples/lstm-text-generation/tfjs-helper
yarn
yarn link
yarn link "jsd-utils"
cd ..


cd data-server
yarn
cd ..

cd lstm-monitor-app
yarn
yarn link "jsd-utils"
yarn link "jsd-monitor"
yarn link "tfjs-helper"
cd ..

cd lstm-worker-app
yarn
yarn link "jsd-utils"
yarn link "jsd-worker"
yarn link "tfjs-helper"
cd ../../..
