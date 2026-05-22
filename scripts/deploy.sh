#!/bin/bash

echo "Starting full deployment..."

bash scripts/deploy-server.sh
bash scripts/deploy-client.sh

echo "Deployment completed!"