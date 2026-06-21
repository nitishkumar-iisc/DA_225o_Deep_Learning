import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { predict, defaultWeights } from "@/lib/ml-model";
import { MLModel } from "@/types";

// GET /api/ml/predict
// Query params: recruiterId (optional), features (comma-separated list of 5 numbers)
// If recruiterId is provided, loads the org-level model weights; otherwise uses defaults.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const featuresParam = searchParams.get("features");
  const recruiterId = searchParams.get("recruiterId");

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

  let weights: number[];
  let bias: number;

  if (recruiterId) {
    const modelSnap = await adminDb.collection("mlModels").doc(recruiterId).get();
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
