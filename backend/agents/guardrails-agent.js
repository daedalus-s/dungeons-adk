import { BaseAgent } from './base-agent.js';

/**
 * GuardrailsAgent - Privacy, PII scrubbing, profanity filtering, compliance
 */
export class GuardrailsAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'guardrails-agent',
      name: 'Guardrails Agent',
      role: 'security-compliance',
      ...config
    });

    // PII patterns
    this.piiPatterns = {
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      address: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir)\b/gi
    };

    // Rate limits
    this.rateLimits = {
      groupme_messages: { max: 50, window: 3600000 }, // 50 per hour
      sheets_writes: { max: 100, window: 3600000 }, // 100 per hour
      api_calls: { max: 1000, window: 3600000 } // 1000 per hour
    };

    this.rateLimitCounters = new Map();
  }

  /**
   * Main execution: apply guardrails
   */
  async execute(input) {
    const { transcript, events, summaries, action } = input;

    this.setState('running');

    try {
      const results = {
        piiDetected: false,
        piiRedacted: false,
        profanityDetected: false,
        rateLimitOk: true,
        violations: []
      };

      // Check transcript if provided
      if (transcript) {
        const transcriptCheck = await this.checkTranscript(transcript);
        Object.assign(results, transcriptCheck);
      }

      // Check events if provided
      if (events) {
        const eventsCheck = await this.checkEvents(events);
        results.violations.push(...eventsCheck.violations);
      }

      // Check summaries if provided
      if (summaries) {
        const summariesCheck = await this.checkSummaries(summaries);
        Object.assign(results, summariesCheck);
      }

      // Check rate limits if action specified
      if (action) {
        const rateLimitCheck = this.checkRateLimit(action);
        results.rateLimitOk = rateLimitCheck.allowed;
        if (!rateLimitCheck.allowed) {
          results.violations.push({
            type: 'rate_limit_exceeded',
            action,
            limit: rateLimitCheck.limit,
            current: rateLimitCheck.current
          });
        }
      }

      this.setState('completed');
      this.emit('guardrailsChecked', results);

      return results;

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Check transcript for violations
   */
  async checkTranscript(transcript) {
    const text = typeof transcript === 'string' ? transcript : transcript.text;

    const piiDetections = this.detectPII(text);
    const profanity = await this.detectProfanity(text);

    return {
      piiDetected: piiDetections.detected,
      piiRedacted: piiDetections.redactedText !== text,
      profanityDetected: profanity.detected,
      redactedText: piiDetections.redactedText,
      piiTypes: piiDetections.types,
      profanityWords: profanity.words
    };
  }

  /**
   * Detect and redact PII
   */
  detectPII(text) {
    let redactedText = text;
    const detectedTypes = [];

    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        detectedTypes.push({
          type,
          count: matches.length,
          examples: matches.slice(0, 2) // Keep first 2 for logging
        });

        // Redact
        redactedText = redactedText.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
      }
    });

    const detected = detectedTypes.length > 0;

    if (detected) {
      this.log('warn', 'PII detected and redacted', { types: detectedTypes });
      this.emit('piiDetected', { types: detectedTypes });
    }

    return {
      detected,
      types: detectedTypes,
      redactedText
    };
  }

  /**
   * Detect profanity using Claude
   */
  async detectProfanity(text) {
    // Simple keyword-based check first
    const profanityKeywords = ['fuck', 'shit', 'damn', 'bitch', 'ass', 'hell'];
    const foundWords = profanityKeywords.filter(word =>
      text.toLowerCase().includes(word)
    );

    // In a D&D context, some profanity is in-character and acceptable
    // Use Claude to determine if it's problematic
    if (foundWords.length > 0) {
      const analysis = await this.analyzeProfanityContext(text, foundWords);
      return {
        detected: analysis.isProblematic,
        words: analysis.isProblematic ? foundWords : [],
        context: analysis.context
      };
    }

    return { detected: false, words: [] };
  }

  /**
   * Analyze profanity context with Claude
   */
  async analyzeProfanityContext(text, words) {
    const prompt = `Analyze if the following text contains problematic profanity or is just in-character D&D dialogue.

Text: "${text}"

Detected words: ${words.join(', ')}

Is this:
A) Problematic/excessive profanity that should be flagged
B) In-character D&D dialogue that's acceptable

Return JSON:
{
  "isProblematic": boolean,
  "context": "brief explanation"
}`;

    try {
      const response = await this.callClaude([
        {
          role: 'user',
          content: prompt
        }
      ], {
        max_tokens: 200,
        temperature: 0.3
      });

      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.log('warn', 'Profanity analysis failed', { error: error.message });
    }

    // Default to flagging if analysis fails
    return { isProblematic: true, context: 'analysis_failed' };
  }

  /**
   * Check events for violations
   */
  async checkEvents(events) {
    const violations = [];

    events.forEach(event => {
      // Check for excessive violence or inappropriate content
      if (event.type === 'combat' && event.metadata) {
        if (event.metadata.damage > 100) {
          violations.push({
            type: 'excessive_damage',
            event: event.id,
            damage: event.metadata.damage
          });
        }
      }

      // Check event descriptions for PII
      const piiCheck = this.detectPII(event.action || '');
      if (piiCheck.detected) {
        violations.push({
          type: 'pii_in_event',
          event: event.id,
          piiTypes: piiCheck.types
        });
      }
    });

    return { violations };
  }

  /**
   * Check summaries for PII and inappropriate content
   */
  async checkSummaries(summaries) {
    const results = {
      groupSummaryClean: true,
      playerSummariesClean: true,
      redactedSummaries: {}
    };

    // Check group summary
    if (summaries.groupSummary) {
      const check = await this.checkTranscript(summaries.groupSummary.message_text);
      results.groupSummaryClean = !check.piiDetected && !check.profanityDetected;

      if (!results.groupSummaryClean) {
        results.redactedSummaries.group = {
          ...summaries.groupSummary,
          message_text: check.redactedText
        };
      }
    }

    // Check player summaries
    if (summaries.playerSummaries) {
      for (const playerSummary of summaries.playerSummaries) {
        const check = await this.checkTranscript(playerSummary.message_text);
        if (check.piiDetected || check.profanityDetected) {
          results.playerSummariesClean = false;
          results.redactedSummaries[playerSummary.player_id] = {
            ...playerSummary,
            message_text: check.redactedText
          };
        }
      }
    }

    return results;
  }

  /**
   * Check rate limits
   */
  checkRateLimit(action) {
    const limit = this.rateLimits[action];
    if (!limit) {
      return { allowed: true };
    }

    const now = Date.now();
    const key = `${action}-${Math.floor(now / limit.window)}`;

    if (!this.rateLimitCounters.has(key)) {
      this.rateLimitCounters.set(key, 0);
    }

    const current = this.rateLimitCounters.get(key);

    if (current >= limit.max) {
      this.log('warn', 'Rate limit exceeded', { action, current, limit: limit.max });
      return {
        allowed: false,
        current,
        limit: limit.max,
        resetAt: (Math.floor(now / limit.window) + 1) * limit.window
      };
    }

    this.rateLimitCounters.set(key, current + 1);
    return { allowed: true, current: current + 1, limit: limit.max };
  }

  /**
   * Validate consent
   */
  async validateConsent(sessionId, participants) {
    // Check if all participants have given consent
    const missingConsent = [];

    for (const participant of participants) {
      const hasConsent = await this.checkConsent(sessionId, participant.id);
      if (!hasConsent) {
        missingConsent.push(participant);
      }
    }

    if (missingConsent.length > 0) {
      this.emit('consentMissing', { sessionId, participants: missingConsent });
      return {
        valid: false,
        missingConsent
      };
    }

    return { valid: true };
  }

  /**
   * Check consent for a participant (stub - would check database)
   */
  async checkConsent(sessionId, participantId) {
    // This would query the database
    // For now, return true
    return true;
  }

  /**
   * Audit log
   */
  async auditLog(action, metadata) {
    const logEntry = {
      timestamp: new Date(),
      action,
      metadata,
      agent: 'guardrails'
    };

    this.emit('auditLog', logEntry);
    console.log('[AUDIT]', JSON.stringify(logEntry));
  }
}
