import { BaseAgent } from './base-agent.js';
import { Pinecone } from '@pinecone-database/pinecone';

/**
 * VectorSearchAgent - Semantic search and RAG over session history
 * Uses Pinecone for vector storage and Claude for embeddings/generation
 */
export class VectorSearchAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'vector-search-agent',
      name: 'Vector Search Agent',
      role: 'semantic-search',
      ...config
    });

    this.pineconeApiKey = config.pineconeApiKey || process.env.PINECONE_API_KEY;
    this.indexName = config.pineconeIndexName || 'dungeons-sessions';
    this.namespace = config.namespace || 'default';
    
    this.initializePinecone();
  }

  /**
   * Initialize Pinecone client and index
   */
  async initializePinecone() {
    try {
      this.pinecone = new Pinecone({
        apiKey: this.pineconeApiKey
      });

      this.index = this.pinecone.index(this.indexName);
      
      console.log('✅ Vector Search Agent: Pinecone connected');
    } catch (error) {
      console.error('❌ Vector Search Agent: Failed to connect to Pinecone:', error.message);
      this.handleError(error);
    }
  }

  /**
   * Main execution handler
   */
  async execute(input) {
    const { operation, ...params } = input;

    this.setState('running');

    try {
      let result;

      switch (operation) {
        case 'index-session':
          result = await this.indexSession(params);
          break;
        case 'search':
          result = await this.searchSessions(params);
          break;
        case 'query':
          result = await this.queryWithRAG(params);
          break;
        case 'delete-session':
          result = await this.deleteSession(params);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      this.setState('completed');
      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Generate embedding for text using Claude
   * Note: Claude doesn't have native embeddings, so we use a hybrid approach:
   * 1. Extract key semantic features with Claude
   * 2. Use simple embedding (or integrate with OpenAI embeddings API)
   */
  async generateEmbedding(text) {
    // For production, use a dedicated embedding model like:
    // - OpenAI's text-embedding-3-small
    // - Cohere embed-english-v3.0
    // - Sentence Transformers
    
    // This is a placeholder that uses Claude to extract semantic features
    // and creates a simple embedding
    const prompt = `Extract the 10 most important semantic concepts from this D&D session summary. Focus on:
- Key events (combat, exploration, dialogue)
- Characters and NPCs mentioned
- Items and loot
- Locations
- Plot developments

Summary: "${text.substring(0, 2000)}"

Return ONLY a JSON array of concept strings: ["concept1", "concept2", ...]`;

    const response = await this.callClaude([
      { role: 'user', content: prompt }
    ], {
      max_tokens: 500,
      temperature: 0.3
    });

    const conceptsMatch = response.content[0].text.match(/\[[\s\S]*?\]/);
    const concepts = conceptsMatch ? JSON.parse(conceptsMatch[0]) : [];

    // Create a simple 1536-dimensional embedding (matching OpenAI's dimension)
    // In production, replace this with proper embedding model
    const embedding = this.createSimpleEmbedding(concepts, text);
    
    return embedding;
  }

  /**
   * Create a simple embedding from concepts (placeholder)
   * In production, use a proper embedding model
   */
  createSimpleEmbedding(concepts, text) {
    const dimension = 1536;
    const embedding = new Array(dimension).fill(0);
    
    // Simple hash-based embedding (for demo purposes)
    // Replace with proper embedding model in production
    const combined = concepts.join(' ').toLowerCase();
    
    for (let i = 0; i < combined.length; i++) {
      const charCode = combined.charCodeAt(i);
      const idx = charCode % dimension;
      embedding[idx] += Math.sin(charCode * 0.01) * 0.1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  /**
   * Index a session summary in Pinecone
   */
  async indexSession(params) {
    const { sessionId, summary, metadata = {} } = params;

    this.log('info', `Indexing session ${sessionId}`);

    try {
      // Create searchable text from summary
      const searchableText = this.createSearchableText(summary);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(searchableText);

      // Prepare metadata
      const vectorMetadata = {
        sessionId,
        date: metadata.date || new Date().toISOString(),
        players: metadata.players || [],
        eventCount: metadata.eventCount || 0,
        tldr: summary.groupSummary?.tldr || '',
        keyEvents: JSON.stringify(summary.groupSummary?.key_events || []),
        topLoot: JSON.stringify(summary.groupSummary?.top_loot || []),
        searchableText: searchableText.substring(0, 1000), // Store snippet for reference
        type: 'session'
      };

      // Upsert to Pinecone
      await this.index.namespace(this.namespace).upsert([
        {
          id: sessionId,
          values: embedding,
          metadata: vectorMetadata
        }
      ]);

      this.log('info', `Session ${sessionId} indexed successfully`);
      
      this.emit('sessionIndexed', { sessionId, metadata: vectorMetadata });

      return {
        success: true,
        sessionId,
        indexed: true
      };

    } catch (error) {
      this.log('error', `Failed to index session ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Create searchable text from session summary
   */
  createSearchableText(summary) {
    const parts = [];

    if (summary.groupSummary) {
      if (summary.groupSummary.tldr) {
        parts.push(summary.groupSummary.tldr);
      }
      if (summary.groupSummary.message_text) {
        parts.push(summary.groupSummary.message_text);
      }
      if (summary.groupSummary.key_events) {
        parts.push(summary.groupSummary.key_events.join(' '));
      }
      if (summary.groupSummary.top_loot) {
        parts.push(summary.groupSummary.top_loot.join(' '));
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Search sessions by semantic similarity
   */
  async searchSessions(params) {
  const { query, topK = 5, filter = {} } = params;

  this.log('info', `Searching for: "${query}"`);

  try {
    const queryEmbedding = await this.generateEmbedding(query);

    // Build Pinecone filter
    let pineconeFilter = undefined;
    if (Object.keys(filter).length > 0) {
      pineconeFilter = filter;
    }

    const searchResults = await this.index.namespace(this.namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: pineconeFilter // Pass filter to Pinecone
    });

    const results = searchResults.matches.map(match => ({
      sessionId: match.id,
      score: match.score,
      metadata: match.metadata
    }));

    this.log('info', `Found ${results.length} relevant sessions`);

    return {
      query,
      results,
      count: results.length
    };
  } catch (error) {
    this.log('error', 'Search failed', error);
    throw error;
  }
}

  /**
   * Query with RAG (Retrieval-Augmented Generation)
   */
  async queryWithRAG(params) {
  const { query, topK = 3, conversationHistory = [], filter = {} } = params;

  this.log('info', `RAG query: "${query}"`);

  try {
    // Pass filter through
    const searchResults = await this.searchSessions({ query, topK, filter });

    if (searchResults.results.length === 0) {
      return {
        query,
        answer: "I couldn't find any relevant sessions in your history.",
        sources: [],
        confidence: 0
      };
    }

    const context = this.buildContextFromResults(searchResults.results);
    const answer = await this.generateAnswerWithContext(query, context, conversationHistory);

    return {
      query,
      answer: answer.text,
      sources: searchResults.results.map(r => ({
        sessionId: r.sessionId,
        score: r.score,
        date: r.metadata.date,
        tldr: r.metadata.tldr,
        relevantEvents: this.extractRelevantEvents(r.metadata, query)
      })),
      confidence: searchResults.results[0]?.score || 0,
      retrievalCount: searchResults.results.length
    };
  } catch (error) {
    this.log('error', 'RAG query failed', error);
    throw error;
  }
}

  /**
   * Build context string from search results
   */
  buildContextFromResults(results) {
    const contextParts = results.map((result, idx) => {
      const metadata = result.metadata;
      
      return `## Session ${idx + 1} (${metadata.date?.split('T')[0] || 'Unknown date'})
**Summary**: ${metadata.tldr || 'No summary available'}
**Key Events**: ${metadata.keyEvents ? JSON.parse(metadata.keyEvents).join(', ') : 'None'}
**Loot**: ${metadata.topLoot ? JSON.parse(metadata.topLoot).join(', ') : 'None'}
**Details**: ${metadata.searchableText || ''}
**Relevance Score**: ${result.score.toFixed(3)}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Generate answer using Claude with retrieved context
   */
async generateAnswerWithContext(query, context, conversationHistory) {
    const systemPrompt = `You are an AI assistant helping Dungeon Masters and players recall details from their D&D campaign sessions. You have access to session summaries from their past games.

Your role:
- Answer questions about past sessions using the provided context
- Be specific and cite which session(s) contain the information
- If the context doesn't contain the answer, say so clearly
- Use D&D terminology and maintain an engaging, storytelling tone
- Keep answers concise but informative`;

    const userPrompt = `Based on the following session summaries, answer this question:

**Question**: ${query}

**Relevant Session Context**:
${context}

Please provide a clear, engaging answer based on the information above. Reference specific sessions when mentioning events.`;

    // Build messages array, ensuring all messages have valid content
    const messages = [];
    
    // Add conversation history (filter out any invalid messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        if (msg.role && msg.content && typeof msg.content === 'string' && msg.content.trim()) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }
    
    // Add current query
    messages.push({ role: 'user', content: userPrompt });

    const response = await this.callClaude(messages, {
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt
    });

    return {
      text: response.content[0].text,
      usage: response.usage
    };
  }

  /**
   * Extract relevant events from metadata based on query
   */
  extractRelevantEvents(metadata, query) {
    const queryLower = query.toLowerCase();
    const events = metadata.keyEvents ? JSON.parse(metadata.keyEvents) : [];
    
    // Simple relevance check
    const relevantEvents = events.filter(event => {
      const eventLower = event.toLowerCase();
      const queryWords = queryLower.split(' ');
      return queryWords.some(word => word.length > 3 && eventLower.includes(word));
    });

    return relevantEvents.slice(0, 3); // Return top 3 relevant events
  }

  /**
   * Delete a session from the vector database
   */
  async deleteSession(params) {
    const { sessionId } = params;

    this.log('info', `Deleting session ${sessionId} from vector database`);

    try {
      await this.index.namespace(this.namespace).deleteOne(sessionId);

      this.log('info', `Session ${sessionId} deleted successfully`);

      return {
        success: true,
        sessionId,
        deleted: true
      };

    } catch (error) {
      this.log('error', `Failed to delete session ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Get index stats
   */
  async getStats() {
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      this.log('error', 'Failed to get index stats', error);
      throw error;
    }
  }

  /**
   * Batch index multiple sessions
   */
  async batchIndexSessions(sessions) {
    this.log('info', `Batch indexing ${sessions.length} sessions`);

    const results = [];

    for (const session of sessions) {
      try {
        const result = await this.indexSession(session);
        results.push({ sessionId: session.sessionId, success: true });
      } catch (error) {
        this.log('error', `Failed to index session ${session.sessionId}`, error);
        results.push({ sessionId: session.sessionId, success: false, error: error.message });
      }
    }

    return {
      total: sessions.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}