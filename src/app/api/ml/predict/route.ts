import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { predict, defaultWeights } from "@/lib/ml-model";
import { MLModel } from "@/types";

// GET /api/ml/predict — utility endpoint; returns predicted probability for a feature vector
// Query params: jobId (optional), features (comma-separated list of 5 numbers)
// If jobId is provided, loads trained weights from Firestore; otherwise uses defaults.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const featuresParam = searchParams.get("features");
  const jobId = searchParams.get("jobId");

  if (!featuresParam) {
    return NextResponse.json(
      { error: "features query param is required (5 comma-separated numbers)" },
      { status: 400 }
    );
  }

  const features = featuresParam.split(",").map(Number);
  if (features.length !== 5 || features.some(isNaN)) {
    return NextResponse.json(
      { error: "features must be exactly 5 comma-separated numeric values" },
      { status: 400 }
    );
  }

  // Load model weights from Firestore or fall back to defaults
  let weights: number[];
  let bias: number;

  if (jobId) {
    const modelSnap = await adminDb.collection("mlModels").doc(jobId).get();
    if (modelSnap.exists) {
      const model = modelSnap.data() as MLModel;
      weights = model.weights;
      bias = model.bias;
    } else {
      const defaults = defaultWeights();
      weights = defaults.weights;
      bias = defaults.bias;
    }
  } else {
    const defaults = defaultWeights();
    weights = defaults.weights;
    bias = defaults.bias;
  }

  const probability = predict(features, weights, bias);
  const fitScore = Math.round(probability * 100);

  return NextResponse.json({ probability, fitScore, weights, bias }, { status: 200 });
}
