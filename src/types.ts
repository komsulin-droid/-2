/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Decision {
  id: string;
  query: string;
  timestamp: number;
  analysis: AnalysisResult;
  outcome?: string; // User can add outcome later
}

export interface AnalysisResult {
  prosCons: {
    pros: string[];
    cons: string[];
  };
  comparison?: {
    headers: string[];
    rows: string[][];
  };
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  summary: string;
}
