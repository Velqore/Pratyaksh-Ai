/**
 * Dolphin AI Chat Service - Frontend Client
 * Connects to the backend Dolphin AI chat endpoints for real-time forensic assistance
 */

export interface DolphinChatRequest {
  message: string;
  evidenceType?: 'fingerprint' | 'cyber' | 'document';
  analysisResults?: any;
  caseId?: string;
  conversationHistory?: ChatMessage[];
  expertWitnessMode?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DolphinChatResponse {
  success: boolean;
  data?: {
    message: string;
    confidence: number;
    processingTime: number;
    model: string;
    timestamp: string;
    caseContext?: any;
    usage?: any;
    expertWitnessMode: boolean;
    error?: string;
  };
  error?: string;
}

export interface DolphinStatusResponse {
  success: boolean;
  data?: {
    dolphinAI: {
      available: boolean;
      model: string;
      error?: string;
      enabled: boolean;
      ollamaUrl: string;
    };
    system: {
      environment: string;
      timestamp: string;
      uptime: number;
    };
    configuration: {
      model: string;
      timeout: string;
      baseUrl: string;
      enabled: boolean;
    };
  };
  error?: string;
}

class DolphinChatService {
  private baseUrl: string;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    // Use the same port as our Pratyaksh server
    this.baseUrl = window.location.origin;
  }

  /**
   * Send a message to Dolphin AI for forensic analysis assistance
   */
  async sendMessage(request: DolphinChatRequest): Promise<DolphinChatResponse> {
    try {
      console.log('🐬 Sending message to Dolphin AI:', request.message);

      const response = await fetch(`${this.baseUrl}/api/chat/forensic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.message,
          evidenceType: request.evidenceType,
          analysisResults: request.analysisResults,
          caseId: request.caseId,
          conversationHistory: this.conversationHistory,
          expertWitnessMode: request.expertWitnessMode || false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: DolphinChatResponse = await response.json();

      // Update conversation history for context
      if (result.success && result.data) {
        this.conversationHistory.push(
          { role: 'user', content: request.message },
          { role: 'assistant', content: result.data.message }
        );

        // Keep conversation history manageable (last 10 exchanges)
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-20);
        }
      }

      console.log('✅ Dolphin AI response received:', result.data?.confidence);
      return result;

    } catch (error) {
      console.error('❌ Dolphin AI request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Dolphin AI'
      };
    }
  }

  /**
   * Send message with evidence analysis context
   */
  async sendMessageWithAnalysis(
    message: string,
    analysisResult: any,
    evidenceType: 'fingerprint' | 'cyber' | 'document'
  ): Promise<DolphinChatResponse> {
    return this.sendMessage({
      message,
      evidenceType,
      analysisResults: analysisResult.analysis,
      caseId: analysisResult.caseId
    });
  }

  /**
   * Get enhanced analysis with AI commentary
   */
  async getEnhancedAnalysis(
    message: string,
    analysisResult: any,
    evidenceType: 'fingerprint' | 'cyber' | 'document'
  ): Promise<DolphinChatResponse> {
    try {
      console.log('🔬 Requesting enhanced analysis from Dolphin AI');

      const response = await fetch(`${this.baseUrl}/api/chat/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          analysisResult: analysisResult.analysis,
          evidenceType,
          caseId: analysisResult.caseId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: DolphinChatResponse = await response.json();
      console.log('✅ Enhanced analysis received');
      return result;

    } catch (error) {
      console.error('❌ Enhanced analysis request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get enhanced analysis'
      };
    }
  }

  /**
   * Check Dolphin AI system status
   */
  async getStatus(): Promise<DolphinStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: DolphinStatusResponse = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Status check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check status'
      };
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
  }

  /**
   * Get current conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Test AI connectivity
   */
  async testConnection(): Promise<DolphinChatResponse> {
    return this.sendMessage({
      message: 'Hello, please confirm you are working correctly for forensic analysis assistance.'
    });
  }
}

// Export singleton instance
export const dolphinChatService = new DolphinChatService();