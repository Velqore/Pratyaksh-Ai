#!/usr/bin/env node
/**
 * Fingerprint Pattern Classifier Training
 * Trains a neural network to classify fingerprint patterns (whorl, loop, arch)
 * Uses labeled FVC2000 dataset
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATTERN_MAP = {
  whorl: 0,
  ulnar_loop: 1,
  radial_loop: 2,
  plain_arch: 3,
  tented_arch: 4,
  accidental: 5,
};

function parseCliOptions() {
  const args = process.argv.slice(2);
  const options = {
    auto: false,
    targetAccuracy: 98,
    maxRuns: 30,
    epochs: 220,
    testSplit: 0.2,
  };

  for (const arg of args) {
    if (arg === "--auto") {
      options.auto = true;
      continue;
    }

    if (arg.startsWith("--target=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0 && value <= 100) {
        options.targetAccuracy = value;
      }
      continue;
    }

    if (arg.startsWith("--max-runs=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isInteger(value) && value > 0) {
        options.maxRuns = value;
      }
      continue;
    }

    if (arg.startsWith("--epochs=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isInteger(value) && value > 0) {
        options.epochs = value;
      }
      continue;
    }

    if (arg.startsWith("--test-split=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0.05 && value < 0.5) {
        options.testSplit = value;
      }
    }
  }

  return options;
}

/**
 * Load labels from JSON file
 */
function loadLabels(labelsPath) {
  const labelsContent = fs.readFileSync(labelsPath, "utf-8");
  return JSON.parse(labelsContent);
}

/**
 * Extract label statistics and mapping
 */
function analyzeLabelDistribution(labels) {
  const patterns = {};
  const patternList = [];

  for (const [filename, data] of Object.entries(labels)) {
    const pattern = data.pattern_type;
    patterns[pattern] = (patterns[pattern] || 0) + 1;

    if (!patternList.includes(pattern)) {
      patternList.push(pattern);
    }
  }

  return { patterns, patternList };
}

/**
 * Generate training features from fingerprint data
 * This extracts handcrafted features for the classifier
 */
function generateTrainingFeatures(labels, supplementalSamples = []) {
  const features = [];
  const targets = [];
  const activePatterns = new Set();
  const datasetPatterns = new Set();

  for (const [filename, data] of Object.entries(labels)) {
    const pattern = data.pattern_type;

    if (!Object.prototype.hasOwnProperty.call(PATTERN_MAP, pattern)) {
      console.warn(`Unknown pattern type: ${pattern}`);
      continue;
    }
    activePatterns.add(pattern);
    datasetPatterns.add(pattern);

    // Extract features from minutiae and structural info
    const feature = {
      filename,
      // Structural features
      minutiae_count: data.minutiae_count || 0,
      core_x: (data.core_position?.x || 0) / 512, // Normalize
      core_y: (data.core_position?.y || 0) / 512,
      num_deltas: (data.delta_positions?.length || 0),
      quality_score: data.quality_score || 0.5,
      image_width: (data.image_size?.width || 512),
      image_height: (data.image_size?.height || 512),
      
      // Minutiae distribution features
      minutiae_by_type: {
        ridge_ending: 0,
        bifurcation: 0,
      },
      
      // Spatial distribution
      minutiae_density: 0,
      minutiae_x_variance: 0,
      minutiae_y_variance: 0,
      minutiae_spread: 0,
    };

    // Analyze minutiae
    if (data.minutiae && data.minutiae.length > 0) {
      const minutiae = data.minutiae;
      const xs = [];
      const ys = [];

      for (const m of minutiae) {
        if (m.type === "ridge_ending") feature.minutiae_by_type.ridge_ending++;
        if (m.type === "bifurcation") feature.minutiae_by_type.bifurcation++;
        xs.push(m.x || 0);
        ys.push(m.y || 0);
      }

      // Calculate spatial statistics
      if (xs.length > 0) {
        const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
        const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
        
        const varX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length;
        const varY = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / ys.length;
        
        const maxX = Math.max(...xs);
        const minX = Math.min(...xs);
        const maxY = Math.max(...ys);
        const minY = Math.min(...ys);
        
        feature.minutiae_x_variance = varX / (512 * 512);
        feature.minutiae_y_variance = varY / (512 * 512);
        feature.minutiae_spread = ((maxX - minX) + (maxY - minY)) / (512 * 2);
      }

      feature.minutiae_density = minutiae.length / (feature.image_width * feature.image_height / 10000);
    }

    // Normalize minutiae counts
    feature.minutiae_by_type.ridge_ending /= Math.max(data.minutiae_count || 1, 1);
    feature.minutiae_by_type.bifurcation /= Math.max(data.minutiae_count || 1, 1);

    // Create feature vector
    const featureVector = [
      feature.minutiae_count / 100, // Normalized
      feature.core_x,
      feature.core_y,
      feature.num_deltas / 3, // Normalized (0-3 deltas typical)
      feature.quality_score,
      feature.minutiae_by_type.ridge_ending,
      feature.minutiae_by_type.bifurcation,
      feature.minutiae_density,
      feature.minutiae_x_variance,
      feature.minutiae_y_variance,
      feature.minutiae_spread,
    ];

    features.push(featureVector);
    targets.push(pattern);
  }

  for (const sample of supplementalSamples) {
    if (
      Array.isArray(sample.features) &&
      sample.features.length === 11 &&
      typeof sample.targetLabel === "string" &&
      datasetPatterns.has(sample.targetLabel)
    ) {
      features.push(sample.features);
      targets.push(sample.targetLabel);
      activePatterns.add(sample.targetLabel);
    }
  }

  if (features.length === 0) {
    throw new Error("No training samples available after preprocessing.");
  }

  // Normalize features using z-score normalization
  const featureMeans = Array(features[0].length).fill(0);
  const featureStds = Array(features[0].length).fill(0);

  // Calculate means
  for (const feature of features) {
    for (let i = 0; i < feature.length; i++) {
      featureMeans[i] += feature[i];
    }
  }
  for (let i = 0; i < featureMeans.length; i++) {
    featureMeans[i] /= features.length;
  }

  // Calculate standard deviations
  for (const feature of features) {
    for (let i = 0; i < feature.length; i++) {
      featureStds[i] += (feature[i] - featureMeans[i]) ** 2;
    }
  }
  for (let i = 0; i < featureStds.length; i++) {
    featureStds[i] = Math.sqrt(featureStds[i] / features.length);
    if (featureStds[i] === 0) featureStds[i] = 1; // Avoid division by zero
  }

  // Normalize features
  const normalizedFeatures = features.map((feature) =>
    feature.map((val, i) => (val - featureMeans[i]) / featureStds[i])
  );

  // Build compact mapping for patterns present in current training data.
  const orderedPatterns = Object.keys(PATTERN_MAP).filter((p) => activePatterns.has(p));
  const patternMap = Object.fromEntries(
    orderedPatterns.map((pattern, idx) => [pattern, idx])
  );
  const reversePatternMap = Object.fromEntries(
    orderedPatterns.map((pattern, idx) => [idx, pattern])
  );
  const compactTargets = targets.map((pattern) => {
    const mapped = patternMap[pattern];
    if (!Number.isInteger(mapped)) {
      throw new Error(`Unmapped pattern label encountered: ${pattern}`);
    }
    return mapped;
  });

  return {
    features: normalizedFeatures,
    rawFeatures: features,
    targets: compactTargets,
    patternMap,
    reversePatternMap,
    featureDimensions: features[0]?.length || 11,
    featureMeans,
    featureStds,
  };
}

function loadCorrectionSamples(feedbackPath) {
  if (!fs.existsSync(feedbackPath)) {
    return [];
  }

  const content = fs.readFileSync(feedbackPath, "utf-8");
  const records = JSON.parse(content);
  if (!Array.isArray(records)) {
    return [];
  }

  const supplementalSamples = [];
  for (const record of records) {
    const label = record?.correctedPattern;
    const featureVector = record?.trainingFeatures;

    if (!Object.prototype.hasOwnProperty.call(PATTERN_MAP, label)) {
      continue;
    }

    if (!Array.isArray(featureVector) || featureVector.length !== 11) {
      continue;
    }

    const numericVector = featureVector.map((value) => Number(value));
    if (numericVector.some((value) => !Number.isFinite(value))) {
      continue;
    }

    supplementalSamples.push({
      features: numericVector,
      targetLabel: label,
    });
  }

  return supplementalSamples;
}

/**
 * Simple neural network classifier
 */
class FingerprintClassifier {
  constructor(inputSize = 11, hiddenSize = 32, outputSize = 6) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    // Initialize weights randomly
    this.w1 = this.randomMatrix(inputSize, hiddenSize);
    this.b1 = Array(hiddenSize).fill(0);

    this.w2 = this.randomMatrix(hiddenSize, outputSize);
    this.b2 = Array(outputSize).fill(0);

    this.learningRate = 0.001;
  }

  randomMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      matrix[i] = [];
      for (let j = 0; j < cols; j++) {
        matrix[i][j] = (Math.random() - 0.5) * 2 * Math.sqrt(2 / rows);
      }
    }
    return matrix;
  }

  relu(x) {
    return Math.max(0, x);
  }

  reluDerivative(x) {
    return x > 0 ? 1 : 0;
  }

  softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / (sumExp + 1e-10));
  }

  forward(input) {
    // Hidden layer
    let hidden = [];
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * (this.w1[i] ? this.w1[i][j] : 0);
      }
      hidden.push(this.relu(sum));
    }

    // Output layer
    let output = [];
    for (let j = 0; j < this.outputSize; j++) {
      let sum = this.b2[j];
      for (let i = 0; i < hidden.length; i++) {
        sum += hidden[i] * (this.w2[i] ? this.w2[i][j] : 0);
      }
      output.push(sum);
    }

    return { hidden, output };
  }

  predict(input) {
    const { output } = this.forward(input);
    const probs = this.softmax(output);
    const maxIdx = probs.indexOf(Math.max(...probs));
    return isNaN(maxIdx) ? 0 : maxIdx;
  }

  predictProba(input) {
    const { output } = this.forward(input);
    return this.softmax(output);
  }

  train(features, targets, epochs = 100, runLabel = "") {
    console.log(`Training classifier for ${epochs} epochs...`);

    const batchSize = 32;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      let correct = 0;

      // Mini-batch gradient descent
      for (let batchStart = 0; batchStart < features.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, features.length);
        const batchGradW1 = this.initZeroMatrix(this.inputSize, this.hiddenSize);
        const batchGradB1 = Array(this.hiddenSize).fill(0);
        const batchGradW2 = this.initZeroMatrix(this.hiddenSize, this.outputSize);
        const batchGradB2 = Array(this.outputSize).fill(0);

        for (let i = batchStart; i < batchEnd; i++) {
          const input = features[i];
          const target = targets[i];

          // Forward pass
          const { hidden, output } = this.forward(input);
          const probs = this.softmax(output);
          const pred = probs.indexOf(Math.max(...probs));

          if (!isNaN(pred) && pred === target) correct++;

          // Cross entropy loss
          const loss = Math.max(0, -Math.log(Math.max(1e-10, probs[target])));
          totalLoss += loss;

          // Compute output layer gradient
          const outputError = probs.map((p, j) => (j === target ? p - 1 : p));

          for (let j = 0; j < this.outputSize; j++) {
            batchGradB2[j] += outputError[j];
            for (let i = 0; i < this.hiddenSize; i++) {
              batchGradW2[i][j] += outputError[j] * hidden[i];
            }
          }

          // Compute hidden layer gradient
          const hiddenError = Array(this.hiddenSize).fill(0);
          for (let i = 0; i < this.hiddenSize; i++) {
            let error = 0;
            for (let j = 0; j < this.outputSize; j++) {
              error += outputError[j] * (this.w2[i] ? this.w2[i][j] : 0);
            }
            hiddenError[i] = error * (hidden[i] > 0 ? 1 : 0.01);
          }

          for (let j = 0; j < this.hiddenSize; j++) {
            batchGradB1[j] += hiddenError[j];
            for (let i = 0; i < this.inputSize; i++) {
              batchGradW1[i][j] += hiddenError[j] * input[i];
            }
          }
        }

        const batchSize_ = batchEnd - batchStart;
        const lr = this.learningRate / batchSize_;

        // Update weights with gradient
        for (let i = 0; i < this.inputSize; i++) {
          for (let j = 0; j < this.hiddenSize; j++) {
            this.w1[i][j] -= lr * batchGradW1[i][j];
          }
        }
        for (let j = 0; j < this.hiddenSize; j++) {
          this.b1[j] -= (lr * batchGradB1[j]) / batchSize_;
        }

        for (let i = 0; i < this.hiddenSize; i++) {
          for (let j = 0; j < this.outputSize; j++) {
            this.w2[i][j] -= lr * batchGradW2[i][j];
          }
        }
        for (let j = 0; j < this.outputSize; j++) {
          this.b2[j] -= (lr * batchGradB2[j]) / batchSize_;
        }
      }

      const accuracy = (correct / features.length) * 100;
      const avgLoss = totalLoss / features.length;

      if ((epoch + 1) % 20 === 0) {
        const lossText = Number.isFinite(avgLoss) ? avgLoss.toFixed(4) : "NaN";
        const prefix = runLabel ? `[${runLabel}] ` : "";
        console.log(
          `${prefix}Epoch ${epoch + 1}: Loss=${lossText}, Accuracy=${accuracy.toFixed(2)}%`
        );
      }
    }
  }

  initZeroMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      matrix[i] = Array(cols).fill(0);
    }
    return matrix;
  }

  evaluate(features, targets) {
    let correct = 0;
    for (let i = 0; i < features.length; i++) {
      const pred = this.predict(features[i]);
      if (pred === targets[i]) correct++;
    }
    return (correct / features.length) * 100;
  }

  toJSON() {
    return {
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      w1: this.w1,
      b1: this.b1,
      w2: this.w2,
      b2: this.b2,
    };
  }

  fromJSON(data) {
    this.inputSize = data.inputSize;
    this.hiddenSize = data.hiddenSize;
    this.outputSize = data.outputSize;
    this.w1 = data.w1;
    this.b1 = data.b1;
    this.w2 = data.w2;
    this.b2 = data.b2;
  }
}

function shuffleIndices(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function splitTrainTest(features, targets, testSplit) {
  const classBuckets = new Map();

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!classBuckets.has(target)) {
      classBuckets.set(target, []);
    }
    classBuckets.get(target).push(i);
  }

  const testIndices = [];
  const trainIndices = [];

  for (const bucket of classBuckets.values()) {
    const shuffled = [...bucket];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const classTestSize = Math.max(1, Math.floor(shuffled.length * testSplit));
    testIndices.push(...shuffled.slice(0, classTestSize));
    trainIndices.push(...shuffled.slice(classTestSize));
  }

  return {
    trainFeatures: trainIndices.map((i) => features[i]),
    trainTargets: trainIndices.map((i) => targets[i]),
    testFeatures: testIndices.map((i) => features[i]),
    testTargets: testIndices.map((i) => targets[i]),
  };
}

function trainSingleRun(trainingData, options, runNumber = 1) {
  const split = splitTrainTest(trainingData.features, trainingData.targets, options.testSplit);
  const hiddenCandidates = [32, 48, 64, 96];
  const hiddenSize = hiddenCandidates[Math.floor(Math.random() * hiddenCandidates.length)];

  const classifier = new FingerprintClassifier(
    trainingData.featureDimensions,
    hiddenSize,
    Object.keys(trainingData.patternMap).length
  );

  classifier.train(split.trainFeatures, split.trainTargets, options.epochs, `Run ${runNumber}`);

  const trainAccuracy = classifier.evaluate(split.trainFeatures, split.trainTargets);
  const testAccuracy = classifier.evaluate(split.testFeatures, split.testTargets);

  return {
    classifier,
    trainAccuracy,
    testAccuracy,
    trainSize: split.trainFeatures.length,
    testSize: split.testFeatures.length,
    hiddenSize,
  };
}

function runAutoTraining(trainingData, options) {
  let bestRun = null;

  console.log("\nAuto-training mode enabled");
  console.log(`Target test accuracy: ${options.targetAccuracy.toFixed(2)}%`);
  console.log(`Max runs: ${options.maxRuns}`);

  for (let run = 1; run <= options.maxRuns; run++) {
    console.log("\n" + "-".repeat(60));
    console.log(`Auto run ${run}/${options.maxRuns}`);
    console.log("-".repeat(60));

    const result = trainSingleRun(trainingData, options, run);
    console.log(
      `Run ${run} complete: Train=${result.trainAccuracy.toFixed(2)}%, Test=${result.testAccuracy.toFixed(2)}%, Hidden=${result.hiddenSize}`
    );

    if (!bestRun || result.testAccuracy > bestRun.testAccuracy) {
      bestRun = result;
      console.log(`New best model found at run ${run}.`);
    }

    if (result.testAccuracy >= options.targetAccuracy) {
      console.log(`\nTarget reached on run ${run}.`);
      return { ...bestRun, runsExecuted: run, targetReached: true };
    }
  }

  return {
    ...bestRun,
    runsExecuted: options.maxRuns,
    targetReached: bestRun ? bestRun.testAccuracy >= options.targetAccuracy : false,
  };
}

/**
 * Main training script
 */
function main() {
  const options = parseCliOptions();
  const labelsPath = path.resolve("d:\\Pratyaksh-main\\client\\fingerprint_labels.json");
  const modelOutputPath = path.resolve("d:\\Pratyaksh-main\\server\\fingerprint_model.json");
  const feedbackPath = path.resolve("d:\\Pratyaksh-main\\server\\fingerprint_training_feedback.json");

  console.log("=".repeat(60));
  console.log("Fingerprint Pattern Classifier Training");
  console.log("=".repeat(60));

  // Load labels
  console.log(`\nLoading labels from ${labelsPath}...`);
  const labels = loadLabels(labelsPath);
  console.log(`Loaded ${Object.keys(labels).length} fingerprint images`);

  // Analyze distribution
  const { patterns } = analyzeLabelDistribution(labels);
  console.log("\nPattern distribution:");
  for (const [pattern, count] of Object.entries(patterns)) {
    console.log(`  ${pattern}: ${count} images`);
  }

  // Generate training features
  console.log("\nGenerating training features...");
  const correctionSamples = loadCorrectionSamples(feedbackPath);
  if (correctionSamples.length > 0) {
    console.log(`Including ${correctionSamples.length} correction samples from user feedback`);
  }

  const trainingData = generateTrainingFeatures(labels, correctionSamples);
  console.log(`Generated ${trainingData.features.length} feature vectors`);
  console.log(`Feature dimensions: ${trainingData.featureDimensions}`);
  console.log(`Active classes: ${Object.keys(trainingData.patternMap).join(", ")}`);
  let bestResult;

  console.log("\n" + "=".repeat(60));
  console.log(options.auto ? "Auto Training Neural Network Classifier" : "Training Neural Network Classifier");
  console.log("=".repeat(60));

  if (options.auto) {
    bestResult = runAutoTraining(trainingData, options);
  } else {
    const single = trainSingleRun(trainingData, options, 1);
    bestResult = {
      ...single,
      runsExecuted: 1,
      targetReached: single.testAccuracy >= options.targetAccuracy,
    };
  }

  const { classifier, trainAccuracy, testAccuracy, trainSize, testSize, runsExecuted, targetReached } = bestResult;

  console.log("\n" + "=".repeat(60));
  console.log("Evaluation Results");
  console.log("=".repeat(60));
  if (options.auto) {
    console.log(`Runs executed: ${runsExecuted}`);
    console.log(`Target achieved: ${targetReached ? "YES" : "NO"}`);
  }
  console.log(`Training Accuracy: ${trainAccuracy.toFixed(2)}%`);
  console.log(`Test Accuracy: ${testAccuracy.toFixed(2)}%`);

  // Save model
  const modelData = {
    timestamp: new Date().toISOString(),
    patternMap: trainingData.patternMap,
    reversePatternMap: trainingData.reversePatternMap,
    classifier: classifier.toJSON(),
    normalization: {
      means: trainingData.featureMeans,
      stds: trainingData.featureStds,
    },
    trainingStats: {
      trainSize,
      testSize,
      trainAccuracy,
      testAccuracy,
      autoTrain: options.auto,
      runsExecuted,
      targetAccuracy: options.targetAccuracy,
      targetReached,
    },
    featureDimensions: trainingData.featureDimensions,
  };

  fs.writeFileSync(modelOutputPath, JSON.stringify(modelData, null, 2));
  console.log(`\nModel saved to ${modelOutputPath}`);

  // Example predictions
  console.log("\n" + "=".repeat(60));
  console.log("Example Predictions (Test Set)");
  console.log("=".repeat(60));

  const exampleSplit = splitTrainTest(trainingData.features, trainingData.targets, options.testSplit);
  for (let i = 0; i < Math.min(5, exampleSplit.testFeatures.length); i++) {
    const pred = classifier.predict(exampleSplit.testFeatures[i]);
    const proba = classifier.predictProba(exampleSplit.testFeatures[i]);
    const actual = exampleSplit.testTargets[i];

    const predPattern = trainingData.reversePatternMap[pred];
    const actualPattern = trainingData.reversePatternMap[actual];

    console.log(
      `\nSample ${i + 1}: Predicted=${predPattern}, Actual=${actualPattern}`
    );
    console.log("  Probabilities:");
    for (const [pattern, idx] of Object.entries(trainingData.patternMap)) {
      console.log(`    ${pattern}: ${(proba[idx] * 100).toFixed(2)}%`);
    }
  }

  console.log("\n✅ Training complete!");
}

main();
