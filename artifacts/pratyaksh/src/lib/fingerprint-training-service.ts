/**
 * Fingerprint Model Training Service
 * Client-side service for monitoring and triggering model retraining
 */

export interface TrainingStatus {
  id: string;
  startTime: string;
  status: "queued" | "in-progress" | "completed" | "failed";
  progress: number;
  message: string;
  logsPath?: string;
  error?: string;
  modelPath?: string;
  accuracy?: {
    train: number;
    test: number;
  };
  endTime?: string;
}

class FingerprintTrainingService {
  private baseUrl = "/api/fingerprint";
  private statusPollInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Array<(status: TrainingStatus) => void> = [];

  /**
   * Start a new training session
   */
  async startTraining(): Promise<{
    success: boolean;
    trainingId?: string;
    statusUrl?: string;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to start training",
      };
    }
  }

  /**
   * Get training status by ID
   */
  async getTrainingStatus(trainingId?: string): Promise<{
    success: boolean;
    data?: TrainingStatus | { records: TrainingStatus[]; currentTraining: string | null };
    message?: string;
  }> {
    try {
      const url = trainingId
        ? `${this.baseUrl}/training-status/${trainingId}`
        : `${this.baseUrl}/training-status`;

      const response = await fetch(url);
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get training status",
      };
    }
  }

  /**
   * Get training logs
   */
  async getTrainingLogs(trainingId: string): Promise<{
    success: boolean;
    data?: {
      trainingId: string;
      logs: string;
    };
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/training-logs/${trainingId}`);
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get training logs",
      };
    }
  }

  /**
   * Subscribe to training status updates
   */
  onStatusUpdate(callback: (status: TrainingStatus) => void): () => void {
    this.statusCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Start polling for training status
   */
  startPolling(trainingId: string, intervalMs: number = 2000): void {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
    }

    this.statusPollInterval = setInterval(async () => {
      const result = await this.getTrainingStatus(trainingId);

      if (result.success && result.data && "status" in result.data) {
        const status = result.data as TrainingStatus;
        this.statusCallbacks.forEach((cb) => cb(status));

        // Stop polling when training completes or fails
        if (
          status.status === "completed" ||
          status.status === "failed"
        ) {
          this.stopPolling();
        }
      }
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
  }
}

export const fingerprintTrainingService = new FingerprintTrainingService();
