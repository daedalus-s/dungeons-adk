import { useState, useRef, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Paper, Stack, Chip, CircularProgress, Alert, Divider,
  Accordion, AccordionSummary, AccordionDetails, IconButton, Tooltip
} from '@mui/material';
import {
  Search, Send, History, Clear, ExpandMore, Link as LinkIcon,
  ContentCopy, CheckCircle
} from '@mui/icons-material';
import { api } from '../services/api';

export default function QueryInterface() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  const inputRef = useRef(null);

  // Example queries
  const exampleQueries = [
    "What happened the last time the group faced the lizard clan?",
    "When did we find the magic healing potion?",
    "What treasure did we get in the goblin cave?",
    "Tell me about the last combat encounter with orcs",
    "What did Aragorn accomplish in recent sessions?",
    "What gold and items did we acquire last month?"
  ];

  const handleSubmitQuery = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Submitting query:', query);
      console.log('📚 Conversation history length:', conversationHistory.length);

      const response = await api.queryWithRAG(query, 3, conversationHistory);

      console.log('✅ Response received:', response);

      // Check if response has data
      if (!response || !response.data) {
        throw new Error('No response data received');
      }

      const data = response.data;

      // Validate response structure
      if (!data.answer) {
        console.warn('⚠️  Response missing answer field:', data);
        throw new Error('Invalid response format: missing answer');
      }

      console.log('📊 Answer:', data.answer);
      console.log('📊 Sources:', data.sources?.length || 0);
      console.log('📊 Confidence:', data.confidence);

      setResult(data);
      
      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: query },
        { role: 'assistant', content: data.answer }
      ]);

      // Keep only last 5 exchanges to manage token usage
      if (conversationHistory.length > 10) {
        setConversationHistory(prev => prev.slice(-10));
      }

    } catch (err) {
      console.error('❌ Query failed:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to process query';
      if (err.response?.status === 503) {
        errorMessage = 'Vector search is not configured. Please set up Pinecone in your environment.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery) => {
    setQuery(exampleQuery);
    inputRef.current?.focus();
  };

  const handleClearConversation = () => {
    setConversationHistory([]);
    setResult(null);
    setQuery('');
  };

  const handleCopyAnswer = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitQuery();
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            🔍 Campaign Query
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ask questions about your past D&D sessions using natural language
          </Typography>
        </Box>
        {conversationHistory.length > 0 && (
          <Button
            startIcon={<Clear />}
            onClick={handleClearConversation}
            variant="outlined"
            size="small"
          >
            Clear History
          </Button>
        )}
      </Stack>

      {/* Query Input Card */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              inputRef={inputRef}
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              placeholder="Ask anything about your campaign... (e.g., 'What happened when we fought the dragon?')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Press Enter to send • Shift+Enter for new line
              </Typography>
              
              <Button
                variant="contained"
                endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
                onClick={handleSubmitQuery}
                disabled={!query.trim() || loading}
                sx={{
                  background: 'linear-gradient(45deg, #6200ee 30%, #9c27b0 90%)',
                  minWidth: 120
                }}
              >
                {loading ? 'Searching...' : 'Ask'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Example Queries */}
      {conversationHistory.length === 0 && !result && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History /> Try these example queries
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {exampleQueries.map((example, idx) => (
                <Chip
                  key={idx}
                  label={example}
                  onClick={() => handleExampleClick(example)}
                  variant="outlined"
                  sx={{ mb: 1, cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results Display */}
      {result && result.answer && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📜 Answer
            </Typography>

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                  {result.answer}
                </Typography>
                <Tooltip title={copiedIndex === 'answer' ? 'Copied!' : 'Copy answer'}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopyAnswer(result.answer, 'answer')}
                    sx={{ ml: 1 }}
                  >
                    {copiedIndex === 'answer' ? <CheckCircle color="success" /> : <ContentCopy />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>

            {/* Confidence Score */}
            {result.confidence !== null && result.confidence !== undefined && !isNaN(result.confidence) && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Chip
                  label={`Confidence: ${(result.confidence * 100).toFixed(1)}%`}
                  color={result.confidence > 0.7 ? 'success' : result.confidence > 0.5 ? 'warning' : 'default'}
                  size="small"
                />
                <Chip
                  label={`${result.sources?.length || 0} relevant sessions`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Source Sessions */}
            {result.sources && result.sources.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  📚 Source Sessions
                </Typography>
                
                <Stack spacing={1}>
                  {result.sources.map((source, idx) => (
                    <Accordion key={idx} variant="outlined">
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            Session {source.sessionId?.slice(-8) || 'Unknown'} - {source.date ? new Date(source.date).toLocaleDateString() : 'No date'}
                          </Typography>
                          <Chip
                            label={`${(source.score * 100).toFixed(0)}% match`}
                            size="small"
                            color={source.score > 0.7 ? 'success' : 'default'}
                          />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Summary
                          </Typography>
                          <Typography variant="body2" paragraph>
                            {source.tldr || 'No summary available'}
                          </Typography>

                          {source.relevantEvents && source.relevantEvents.length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                Relevant Events
                              </Typography>
                              <Stack spacing={0.5}>
                                {source.relevantEvents.map((event, eventIdx) => (
                                  <Typography key={eventIdx} variant="body2">
                                    • {event}
                                  </Typography>
                                ))}
                              </Stack>
                            </>
                          )}

                          <Button
                            size="small"
                            startIcon={<LinkIcon />}
                            href={`/dashboard`}
                            sx={{ mt: 1, alignSelf: 'flex-start' }}
                          >
                            View Full Session
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversation History */}
      {conversationHistory.length > 2 && (
        <Card variant="outlined" sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              💬 Conversation History ({conversationHistory.length / 2} exchanges)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The AI remembers your recent questions for context
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}