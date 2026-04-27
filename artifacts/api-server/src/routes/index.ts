import { Router, type IRouter } from "express";
import healthRouter from "./health";
import {
  handleClassifyFingerprint,
  handleClassifyFingerprintImage,
  handleGetModelInfo,
} from "./classify-fingerprint.js";
import { handleSaveFingerprintTrainingFeedback } from "./fingerprint-training-feedback.js";
import {
  handleStartTraining,
  handleGetTrainingStatus,
  handleGetTrainingLogs,
} from "./train-fingerprint-model.js";
import { handleSaveManualFingerprintAnnotations } from "./manual-fingerprint-annotations.js";
import {
  handleGetFingerprintDatasetImage,
  handleListFingerprintDatasetImages,
} from "./fingerprint-dataset-browser.js";
import {
  handleSendOtp,
  handleVerifyOtp,
  handleSmtpStatus,
  handleSendTest,
} from "./email-auth.js";

const router: IRouter = Router();

router.use(healthRouter);

// Email / Auth routes (ported from original server)
router.post("/email/send-otp", handleSendOtp);
router.get("/email/smtp-status", handleSmtpStatus);
router.post("/email/send-test", handleSendTest);
router.post("/auth/verify-otp", handleVerifyOtp);

// Fingerprint classification — frontend calls /classify/fingerprint[/image|/model]
router.post("/classify/fingerprint", handleClassifyFingerprint);
router.post("/classify/fingerprint/image", handleClassifyFingerprintImage);
router.get("/classify/fingerprint/model", handleGetModelInfo);

// Fingerprint training & annotation
router.post("/fingerprint/training-feedback", handleSaveFingerprintTrainingFeedback);
router.post("/fingerprint/manual-annotations", handleSaveManualFingerprintAnnotations);
router.post("/fingerprint/train", handleStartTraining);
router.get("/fingerprint/training-status", handleGetTrainingStatus);
router.get("/fingerprint/training-status/:trainingId", handleGetTrainingStatus);
router.get("/fingerprint/training-logs/:trainingId", handleGetTrainingLogs);

// Dataset browser — frontend calls flat paths with query param
router.get("/fingerprint/dataset-images", handleListFingerprintDatasetImages);
router.get("/fingerprint/dataset-image", handleGetFingerprintDatasetImage);

// Misc
router.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

export default router;
