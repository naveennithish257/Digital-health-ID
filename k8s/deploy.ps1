# PowerShell Deployment Script for MedVault Kubernetes Cluster
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MedVault Kubernetes Deployment Script   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check kubectl availability
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: kubectl is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "1️⃣ Creating namespace..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot/namespace.yaml"

Write-Host "2️⃣ Applying ConfigMap and Secrets..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot/configmap.yaml"
kubectl apply -f "$PSScriptRoot/secret.yaml"

Write-Host "3️⃣ Deploying application pods..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot/deployment.yaml"

Write-Host "4️⃣ Exposing service..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot/service.yaml"

Write-Host "5️⃣ Configuring autoscaler (HPA)..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot/hpa.yaml"

Write-Host "6️⃣ Checking rollout status..." -ForegroundColor Yellow
kubectl rollout status deployment/medvault-api -n medvault --timeout=120s

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "------------------------------------------"
kubectl get pods,svc,hpa -n medvault
