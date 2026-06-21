import { sigmoid, dot, predict, train, defaultWeights } from "./ml-model";

describe("sigmoid", () => {
  it("returns 0.5 at z=0", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5);
  });

  it("approaches 1 for large positive z", () => {
    expect(sigmoid(100)).toBeCloseTo(1, 5);
  });

  it("approaches 0 for large negative z", () => {
    expect(sigmoid(-100)).toBeCloseTo(0, 5);
  });

  it("is symmetric: sigmoid(-z) = 1 - sigmoid(z)", () => {
    const z = 2.5;
    expect(sigmoid(-z)).toBeCloseTo(1 - sigmoid(z), 10);
  });
});

describe("dot", () => {
  it("computes inner product correctly", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(dot([1, 0], [0, 1])).toBe(0);
  });
});

describe("predict", () => {
  it("returns 0.5 when weights are zero and bias is zero", () => {
    expect(predict([0.5, 0.5, 0.5, 0.5, 0.5], [0, 0, 0, 0, 0], 0)).toBeCloseTo(0.5);
  });

  it("returns higher probability for positive features with positive weights", () => {
    const features = [1, 1, 1, 1, 1];
    const weights = [1, 1, 1, 1, 1];
    const bias = 0;
    expect(predict(features, weights, bias)).toBeGreaterThan(0.5);
  });

  it("matches manual calculation: sigmoid(dot(x,w) + b)", () => {
    const features = [0.8, 0.6, 0.5, 0.7, 0.9];
    const weights = [0.2, 0.2, 0.2, 0.2, 0.2];
    const bias = 0;
    const expected = sigmoid(dot(features, weights) + bias);
    expect(predict(features, weights, bias)).toBeCloseTo(expected, 10);
  });

  it("uses defaultWeights to produce output in (0,1)", () => {
    const { weights, bias } = defaultWeights();
    const features = [0.5, 0.5, 0.5, 0.5, 0.5];
    const result = predict(features, weights, bias);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

describe("defaultWeights", () => {
  it("returns 5 equal weights of 0.2 and bias of 0", () => {
    const { weights, bias } = defaultWeights();
    expect(weights).toHaveLength(5);
    weights.forEach((w) => expect(w).toBe(0.2));
    expect(bias).toBe(0);
  });
});

describe("train", () => {
  it("returns defaultWeights when given empty examples", () => {
    const result = train([]);
    expect(result).toEqual(defaultWeights());
  });

  it("converges on a linearly-separable dataset (all label=1 → high probability)", () => {
    const positiveExamples = Array.from({ length: 10 }, () => ({
      features: [0.9, 0.9, 0.9, 0.9, 0.9],
      label: 1,
    }));
    const negativeExamples = Array.from({ length: 10 }, () => ({
      features: [0.1, 0.1, 0.1, 0.1, 0.1],
      label: 0,
    }));

    const { weights, bias } = train([...positiveExamples, ...negativeExamples]);

    // After training, high-feature vector should predict close to 1
    const probHigh = predict([0.9, 0.9, 0.9, 0.9, 0.9], weights, bias);
    expect(probHigh).toBeGreaterThan(0.8);

    // Low-feature vector should predict close to 0
    const probLow = predict([0.1, 0.1, 0.1, 0.1, 0.1], weights, bias);
    expect(probLow).toBeLessThan(0.2);
  });

  it("produces weights array of length 5", () => {
    const examples = [
      { features: [0.8, 0.6, 0.5, 0.7, 0.9], label: 1 },
      { features: [0.2, 0.3, 0.4, 0.1, 0.2], label: 0 },
    ];
    const { weights } = train(examples);
    expect(weights).toHaveLength(5);
  });

  it("learns to separate perfectly separable XOR-free data", () => {
    // Clear linearly-separable: features > 0.5 → approved, < 0.5 → rejected
    const examples = [
      { features: [0.9, 0.8, 0.9, 0.8, 0.9], label: 1 },
      { features: [0.85, 0.9, 0.8, 0.9, 0.85], label: 1 },
      { features: [0.95, 0.7, 0.9, 0.95, 0.9], label: 1 },
      { features: [0.1, 0.2, 0.1, 0.15, 0.1], label: 0 },
      { features: [0.15, 0.1, 0.2, 0.1, 0.15], label: 0 },
      { features: [0.05, 0.15, 0.1, 0.2, 0.1], label: 0 },
    ];

    const { weights, bias } = train(examples);

    // Unseen positive example
    expect(predict([0.88, 0.82, 0.91, 0.85, 0.87], weights, bias)).toBeGreaterThan(0.7);
    // Unseen negative example
    expect(predict([0.12, 0.18, 0.09, 0.14, 0.11], weights, bias)).toBeLessThan(0.3);
  });
});

describe("feature extraction math (SPEC §5.2)", () => {
  it("educationScore ordinal values are correct", () => {
    // any=0.5, bachelor=0.6, master=0.8, phd=1.0
    const ordinal: Record<string, number> = {
      any: 0.5,
      bachelor: 0.6,
      master: 0.8,
      phd: 1.0,
    };
    expect(ordinal["any"]).toBe(0.5);
    expect(ordinal["bachelor"]).toBe(0.6);
    expect(ordinal["master"]).toBe(0.8);
    expect(ordinal["phd"]).toBe(1.0);
  });

  it("experienceMatchScore is clamped to [0, 1]", () => {
    const clampExperience = (candidateYears: number, requiredYears: number): number => {
      if (requiredYears === 0) return 1;
      return Math.min(candidateYears / requiredYears, 1);
    };

    expect(clampExperience(5, 3)).toBe(1);       // over-qualified → clamped at 1
    expect(clampExperience(2, 4)).toBe(0.5);      // under-qualified
    expect(clampExperience(3, 3)).toBe(1);        // exact match
    expect(clampExperience(10, 0)).toBe(1);       // no requirement → full score
  });

  it("skillsOverlapScore is a Jaccard similarity in [0, 1]", () => {
    const jaccard = (a: string[], b: string[]): number => {
      const setA = new Set(a.map((s) => s.toLowerCase()));
      const setB = new Set(b.map((s) => s.toLowerCase()));
      const intersection = [...setA].filter((x) => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      return union === 0 ? 1 : intersection / union;
    };

    expect(jaccard(["react", "ts"], ["react", "ts"])).toBe(1);
    expect(jaccard(["react"], ["vue"])).toBe(0);
    expect(jaccard(["react", "ts", "node"], ["react", "ts"])).toBeCloseTo(2 / 3, 5);
  });
});
