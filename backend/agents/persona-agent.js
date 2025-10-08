import { BaseAgent } from './base-agent.js';
import vision from '@google-cloud/vision';
import axios from 'axios';

/**
 * PersonaAgent - Character persona/avatar generation from images
 */
export class PersonaAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'persona-agent',
      name: 'Persona Agent',
      role: 'character-visualization',
      ...config
    });

    this.visionClient = new vision.ImageAnnotatorClient({
      keyFilename: config.googleCredentials
    });

    this.mcpServer = config.mcpVisionServer;
  }

  /**
   * Main execution: generate persona from character image
   */
  async execute(input) {
    const { imageUri, playerId, characterName, userPrompt } = input;

    this.setState('running', { playerId, characterName });
    this.log('info', `Generating persona for ${characterName}`);

    try {
      // Analyze image with Vision API
      const imageAnalysis = await this.analyzeImage(imageUri);

      // Generate persona descriptors with Claude
      const personaDescriptors = await this.generatePersonaDescriptors(
        imageAnalysis,
        characterName,
        userPrompt
      );

      // Generate stylized avatar prompt
      const avatarPrompt = await this.generateAvatarPrompt(personaDescriptors);

      // If MCP has image generation, create avatar
      let avatarUri = null;
      const mcpAvailable = await this.checkMCPServer();
      if (mcpAvailable) {
        avatarUri = await this.generateAvatarViaMCP(avatarPrompt);
      }

      const result = {
        playerId,
        characterName,
        imageUri,
        imageAnalysis,
        personaDescriptors,
        avatarPrompt,
        avatarUri,
        timestamp: new Date()
      };

      this.setState('completed');
      this.emit('personaGenerated', result);

      return result;

    } catch (error) {
      this.handleError(error, { playerId, characterName });
      throw error;
    }
  }

  /**
   * Analyze image with Google Cloud Vision
   */
  async analyzeImage(imageUri) {
    const [labelResult] = await this.visionClient.labelDetection(imageUri);
    const [faceResult] = await this.visionClient.faceDetection(imageUri);
    const [colorResult] = await this.visionClient.imageProperties(imageUri);
    const [objectResult] = await this.visionClient.objectLocalization(imageUri);

    const labels = labelResult.labelAnnotations || [];
    const faces = faceResult.faceAnnotations || [];
    const colors = colorResult.imagePropertiesAnnotation?.dominantColors?.colors || [];
    const objects = objectResult.localizedObjectAnnotations || [];

    return {
      labels: labels.map(l => ({
        description: l.description,
        score: l.score
      })),
      faces: faces.map(f => ({
        joy: f.joyLikelihood,
        sorrow: f.sorrowLikelihood,
        anger: f.angerLikelihood,
        headwear: f.headwearLikelihood
      })),
      dominantColors: colors.slice(0, 5).map(c => ({
        color: c.color,
        score: c.score,
        pixelFraction: c.pixelFraction
      })),
      objects: objects.map(o => ({
        name: o.name,
        score: o.score
      }))
    };
  }

  /**
   * Generate persona descriptors using Claude
   */
  async generatePersonaDescriptors(imageAnalysis, characterName, userPrompt) {
    const prompt = `You are creating a D&D character persona based on an image analysis.

Character Name: ${characterName}
User Prompt: ${userPrompt || 'Create a fantasy character persona'}

Image Analysis:
- Detected Labels: ${imageAnalysis.labels.map(l => l.description).join(', ')}
- Detected Objects: ${imageAnalysis.objects.map(o => o.name).join(', ')}
- Dominant Colors: ${imageAnalysis.dominantColors.map(c => `RGB(${c.color.red},${c.color.green},${c.color.blue})`).join(', ')}
- Facial Expressions: ${JSON.stringify(imageAnalysis.faces[0] || {})}

Create a rich persona with:
1. Physical Appearance (height, build, distinctive features)
2. Clothing & Equipment (armor, weapons, accessories)
3. Personality Traits (3-5 traits based on visual cues)
4. Background Hints (suggested backstory elements)
5. Notable Quirks (unique characteristics)

Return JSON:
{
  "appearance": {
    "physical": "detailed description",
    "clothing": "outfit description",
    "distinctive_features": ["feature1", "feature2"]
  },
  "personality": {
    "traits": ["trait1", "trait2", "trait3"],
    "demeanor": "overall demeanor",
    "voice": "suggested voice/speech pattern"
  },
  "background_hints": ["hint1", "hint2"],
  "quirks": ["quirk1", "quirk2"],
  "color_palette": ["color1", "color2", "color3"],
  "one_sentence_summary": "Brief character essence"
}`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 2000,
      temperature: 0.7
    });

    return this.parseClaudeResponse(response.content[0].text);
  }

  /**
   * Generate avatar creation prompt
   */
  async generateAvatarPrompt(personaDescriptors) {
    const prompt = `Create a detailed image generation prompt for a D&D character avatar based on this persona:

${JSON.stringify(personaDescriptors, null, 2)}

Generate a concise prompt (100 words max) suitable for DALL-E or Stable Diffusion that captures:
- Physical appearance
- Clothing/equipment
- Art style (fantasy illustration, digital art)
- Mood/atmosphere
- Color palette

Return ONLY the prompt text, nothing else.`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 500,
      temperature: 0.6
    });

    return response.content[0].text.trim();
  }

  /**
   * Check MCP vision server
   */
  async checkMCPServer() {
    try {
      const response = await axios.get(`${this.mcpServer}/health`, { timeout: 2000 });
      return response.status === 200 && response.data.capabilities?.includes('image-generation');
    } catch {
      return false;
    }
  }

  /**
   * Generate avatar via MCP server (if it supports image generation)
   */
  async generateAvatarViaMCP(prompt) {
    try {
      const response = await axios.post(`${this.mcpServer}/generate`, {
        prompt,
        style: 'fantasy-illustration',
        width: 512,
        height: 512
      }, {
        timeout: 60000
      });

      return response.data.imageUri;
    } catch (error) {
      this.log('warn', 'Avatar generation failed', { error: error.message });
      return null;
    }
  }

  /**
   * Parse Claude JSON response
   */
  parseClaudeResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      this.log('warn', 'Failed to parse response', { text, error: error.message });
      return {};
    }
  }

  /**
   * Update persona with additional context
   */
  async updatePersona(personaId, additionalContext) {
    // Retrieve existing persona
    const existingPersona = this.getContext(`persona-${personaId}`);

    const prompt = `Update this D&D character persona with new information:

Existing Persona:
${JSON.stringify(existingPersona, null, 2)}

New Information:
${additionalContext}

Return the updated persona in the same JSON format, incorporating the new details.`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 2000,
      temperature: 0.5
    });

    const updatedPersona = this.parseClaudeResponse(response.content[0].text);
    this.setContext(`persona-${personaId}`, updatedPersona);

    return updatedPersona;
  }
}
