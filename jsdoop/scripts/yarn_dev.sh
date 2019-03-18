#!/bin/bash

cd ..

# Just in case...
yarn unlink "jsd-utils"
yarn unlink "jsd-worker"
yarn unlink "jsd-monitor"
yarn unlink "tfjs-helper"

# Unlink
cd examples/lstm-text-generation/tfjs-helper
rm -r node_modules
yarn unlink "jsd-utils"

cd ..

cd lstm-monitor-app
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink "jsd-monitor"
yarn unlink "tfjs-helper"
cd ..

cd lstm-worker-app
rm -r node_modules
yarn unlink "jsd-utils"
yarn unlink "jsd-worker"
yarn unlink "tfjs-helper"
cd ../../..



# Prepare and link
cd jsd-monitor
yarn
yarn link
cd ..

cd jsd-utils
yarn
yarn link
cd ..

cd jsd-worker
yarn
yarn link
cd ..

cd examples/lstm-text-generation/tfjs-helper
yarn
yarn link
yarn link "jsd-utils"

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
