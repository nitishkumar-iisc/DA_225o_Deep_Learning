// Logistic regression from scratch — no external ML library (SPEC §7.1)

// sigmoid(z) = 1 / (1 + e^(-z))
export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

// dot(a, b) = Σ a[i] * b[i]
export function dot(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

// predict(x, w, b) = sigmoid(dot(x, w) + b)
export function predict(features: number[], weights: number[], bias: number): number {
  return sigmoid(dot(features, weights) + bias);
}

// Binary cross-entropy loss: −(1/N) Σ [y*log(p) + (1-y)*log(1-p)]
function binaryCrossEntropy(
  examples: { features: number[]; label: number }[],
  weights: number[],
  bias: number
): number {
  const n = examples.length;
  let loss = 0;
  for (const { features, label } of examples) {
    const p = predict(features, weights, bias);
    // clamp to avoid log(0)
    const pClamped = Math.min(Math.max(p, 1e-15), 1 - 1e-15);
    loss -= label * Math.log(pClamped) + (1 - label) * Math.log(1 - pClamped);
  }
  return loss / n;
}

// Gradient descent — lr=0.1, up to 1000 iterations, early-stop if |Δloss| < 1e-6 (SPEC §7.2)
export function train(
  examples: { features: number[]; label: number }[]
): { weights: number[]; bias: number } {
  if (examples.length === 0) return defaultWeights();

  const nFeatures = examples[0].features.length;
  const lr = 0.1;
  const maxIter = 1000;
  const convergenceDelta = 1e-6;

  let weights = new Array<number>(nFeatures).fill(0);
  let bias = 0;
  let prevLoss = Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    // Compute gradients: ∂L/∂w_j = (1/N) Σ (p_i - y_i) * x_ij
    //                    ∂L/∂b   = (1/N) Σ (p_i - y_i)
    const gradW = new Array<number>(nFeatures).fill(0);
    let gradB = 0;

    for (const { features, label } of examples) {
      const error = predict(features, weights, bias) - label;
      for (let j = 0; j < nFeatures; j++) {
        gradW[j] += error * features[j];
      }
      gradB += error;
    }

    const n = examples.length;
    for (let j = 0; j < nFeatures; j++) {
      weights[j] -= lr * (gradW[j] / n);
    }
    bias -= lr * (gradB / n);

    const loss = binaryCrossEntropy(examples, weights, bias);
    if (Math.abs(prevLoss - loss) < convergenceDelta) break;
    prevLoss = loss;
  }

  return { weights, bias };
}

// Default weights used when a job has fewer than 5 reviewed applications (SPEC §7.2, §5.3)
// Equal weights [0.2, 0.2, 0.2, 0.2, 0.2] — effectively averages the five feature scores
export function defaultWeights(): { weights: number[]; bias: number } {
  return { weights: [0.2, 0.2, 0.2, 0.2, 0.2], bias: 0 };
}
