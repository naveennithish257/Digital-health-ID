#!/bin/bash
set -e

echo "=========================================="
echo "  MedVault Kubernetes Deployment Script   "
echo "=========================================="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "1️⃣ Applying Namespace..."
kubectl apply -f "$SCRIPT_DIR/namespace.yaml"

echo "2️⃣ Applying ConfigMap & Secrets..."
kubectl apply -f "$SCRIPT_DIR/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/secret.yaml"

echo "3️⃣ Deploying Application..."
kubectl apply -f "$SCRIPT_DIR/deployment.yaml"

echo "4️⃣ Exposing Service..."
kubectl apply -f "$SCRIPT_DIR/service.yaml"

echo "5️⃣ Applying Horizontal Pod Autoscaler..."
kubectl apply -f "$SCRIPT_DIR/hpa.yaml"

echo "6️⃣ Awaiting Rollout..."
kubectl rollout status deployment/medvault-api -n medvault --timeout=120s

echo "✅ Deployment completed successfully!"
kubectl get pods,svc,hpa -n medvault
