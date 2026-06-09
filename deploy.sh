#!/bin/bash

# SelfSurgeon Deployment Script
# This script guides you through deploying the backend to Google Cloud Run
# and the frontend to Vercel.

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting SelfSurgeon Deployment Process...${NC}"

# 1. Backend Deployment (Google Cloud Run)
echo -e "\n--- Step 1: Backend Deployment (Cloud Run) ---"
echo "Ensure you have gcloud CLI installed and authenticated."

# Replace these variables as needed
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="selfsurgeon-backend"
REGION="us-central1"

echo "Building and pushing image using Google Cloud Build..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=$(grep GEMINI_API_KEY .env | cut -d '=' -f2),PROJECT_NAME=selfsurgeon-victim"

echo -e "${GREEN}✅ Backend deployed! Please copy the provided Cloud Run URL.${NC}"

# 2. Frontend Deployment (Vercel)
echo -e "\n--- Step 2: Frontend Deployment (Vercel) ---"
echo "1. Connect your GitHub repository to Vercel."
echo "2. Set the following environment variable in Vercel project settings:"
echo "   VITE_API_BASE_URL = [Your Cloud Run URL]"
echo "3. Configure build command: 'npm run build'"
echo "4. Configure output directory: 'dist'"

echo -e "\n${GREEN}🎉 Deployment steps completed!${NC}"
