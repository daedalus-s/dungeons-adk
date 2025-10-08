import { BaseAgent } from './base-agent.js';
import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';
import axios from 'axios';

/**
 * OCRAgent - Stat sheet digitization with confidence scoring
 */
export class OCRAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'ocr-agent',
      name: 'OCR Agent',
      role: 'document-parsing',
      ...config
    });

    this.visionClient = new vision.ImageAnnotatorClient({
      keyFilename: config.googleCredentials
    });

    this.mcpServer = config.mcpOcrServer;

    // D&D 5e stat sheet field patterns
    this.fieldPatterns = {
      character_name: /(?:character\s+name|name)[:\s]*([A-Za-z\s]+)/i,
      class: /(?:class)[:\s]*([A-Za-z\s]+)/i,
      level: /(?:level)[:\s]*(\d+)/i,
      race: /(?:race)[:\s]*([A-Za-z\s]+)/i,
      background: /(?:background)[:\s]*([A-Za-z\s]+)/i,
      alignment: /(?:alignment)[:\s]*([A-Za-z\s]+)/i,
      experience_points: /(?:experience\s+points|xp)[:\s]*(\d+)/i,

      // Ability Scores
      strength: /(?:strength|str)[:\s]*(\d+)/i,
      dexterity: /(?:dexterity|dex)[:\s]*(\d+)/i,
      constitution: /(?:constitution|con)[:\s]*(\d+)/i,
      intelligence: /(?:intelligence|int)[:\s]*(\d+)/i,
      wisdom: /(?:wisdom|wis)[:\s]*(\d+)/i,
      charisma: /(?:charisma|cha)[:\s]*(\d+)/i,

      // Combat Stats
      armor_class: /(?:armor\s+class|ac)[:\s]*(\d+)/i,
      initiative: /(?:initiative)[:\s]*([+-]?\d+)/i,
      speed: /(?:speed)[:\s]*(\d+)/i,
      hit_points_max: /(?:hit\s+points\s+maximum|max\s+hp)[:\s]*(\d+)/i,
      current_hit_points: /(?:current\s+hit\s+points|hp)[:\s]*(\d+)/i,

      // Skills (partial list)
      proficiency_bonus: /(?:proficiency\s+bonus)[:\s]*([+-]?\d+)/i,
    };
  }

  /**
   * Main execution: OCR and parse stat sheet
   */
  async execute(input) {
    const { imageUri, playerId } = input;

    this.setState('running', { playerId });
    this.log('info', `OCR processing for player ${playerId}`);

    try {
      // Try MCP server first
      let ocrText;
      let confidence;

      const mcpAvailable = await this.checkMCPServer();
      if (mcpAvailable) {
        const mcpResult = await this.ocrViaMCP(imageUri);
        ocrText = mcpResult.text;
        confidence = mcpResult.confidence;
      } else {
        // Fallback to Google Vision
        const visionResult = await this.ocrViaGoogleVision(imageUri);
        ocrText = visionResult.text;
        confidence = visionResult.confidence;
      }

      // Parse fields from OCR text
      const parsedFields = this.parseStatSheet(ocrText);

      // Validate and calculate confidence scores
      const validatedFields = this.validateFields(parsedFields);

      // Use Claude to enhance parsing if confidence is low
      if (validatedFields.overallConfidence < 0.7) {
        const enhancedFields = await this.enhanceWithClaude(ocrText, validatedFields);
        validatedFields.fields = { ...validatedFields.fields, ...enhancedFields };
      }

      const result = {
        playerId,
        imageUri,
        rawText: ocrText,
        parsedFields: validatedFields.fields,
        confidenceScores: validatedFields.confidenceScores,
        overallConfidence: validatedFields.overallConfidence,
        needsReview: validatedFields.overallConfidence < 0.8,
        timestamp: new Date()
      };

      this.setState('completed', { confidence: validatedFields.overallConfidence });
      this.emit('ocrComplete', result);

      return result;

    } catch (error) {
      this.handleError(error, { playerId, imageUri });
      throw error;
    }
  }

  /**
   * Check MCP OCR server
   */
  async checkMCPServer() {
    try {
      const response = await axios.get(`${this.mcpServer}/health`, { timeout: 2000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * OCR via MCP server
   */
  async ocrViaMCP(imageUri) {
    const response = await axios.post(`${this.mcpServer}/ocr`, {
      imageUri,
      language: 'eng',
      ocrEngine: 'tesseract'
    }, {
      timeout: 60000
    });

    return response.data;
  }

  /**
   * OCR via Google Cloud Vision
   */
  async ocrViaGoogleVision(imageUri) {
    const [result] = await this.visionClient.textDetection(imageUri);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error('No text detected in image');
    }

    return {
      text: detections[0].description,
      confidence: detections[0].confidence || 0.5
    };
  }

  /**
   * Parse stat sheet using regex patterns
   */
  parseStatSheet(text) {
    const fields = {};

    Object.entries(this.fieldPatterns).forEach(([fieldName, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        fields[fieldName] = match[1].trim();
      }
    });

    // Calculate ability modifiers
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(ability => {
      if (fields[ability]) {
        const score = parseInt(fields[ability]);
        fields[`${ability}_modifier`] = Math.floor((score - 10) / 2);
      }
    });

    return fields;
  }

  /**
   * Validate parsed fields and calculate confidence
   */
  validateFields(fields) {
    const confidenceScores = {};
    let totalConfidence = 0;
    let fieldCount = 0;

    // Required fields
    const requiredFields = ['character_name', 'class', 'level', 'race'];

    requiredFields.forEach(field => {
      if (fields[field]) {
        confidenceScores[field] = 0.9; // High confidence if found
        totalConfidence += 0.9;
      } else {
        confidenceScores[field] = 0.0;
      }
      fieldCount++;
    });

    // Ability scores validation
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(ability => {
      if (fields[ability]) {
        const score = parseInt(fields[ability]);
        // D&D scores are typically 3-20
        const isValid = score >= 3 && score <= 20;
        confidenceScores[ability] = isValid ? 0.95 : 0.5;
        totalConfidence += confidenceScores[ability];
        fieldCount++;
      }
    });

    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    return {
      fields,
      confidenceScores,
      overallConfidence
    };
  }

  /**
   * Enhance parsing with Claude for low-confidence results
   */
  async enhanceWithClaude(ocrText, currentFields) {
    const prompt = `You are parsing a D&D 5th Edition character sheet from OCR text. The OCR quality is imperfect.

OCR Text:
${ocrText}

Current parsed fields:
${JSON.stringify(currentFields.fields, null, 2)}

Please extract any missing or incorrect fields. Focus on:
- Character Name
- Class and Level
- Race and Background
- Ability Scores (STR, DEX, CON, INT, WIS, CHA)
- Armor Class, Initiative, Speed
- Hit Points (max and current)
- Proficiency Bonus

Return ONLY a JSON object with the corrected/additional fields:
{
  "character_name": "name",
  "class": "class",
  "level": number,
  ...
}`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 1500,
      temperature: 0.2
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Claude enhancement', { error: error.message });
    }

    return {};
  }

  /**
   * Fallback OCR using Tesseract.js (client-side capable)
   */
  async ocrWithTesseract(imageBuffer) {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: m => this.log('debug', 'Tesseract progress', m)
    });

    return {
      text: data.text,
      confidence: data.confidence / 100
    };
  }
}
