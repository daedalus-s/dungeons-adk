@'
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Button, Card, Text, FAB, Chip, ActivityIndicator } from 'react-native-paper';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../services/api';

export default function SessionScreen() {
  const {
    sessionId,
    isRecording,
    isPaused,
    events,
    transcript,
    recordingDuration,
    startSession,
    pauseRecording,
    resumeRecording,
    stopSession,
    addEvent,
    appendTranscript,
    incrementDuration,
    clearSession
  } = useSessionStore();

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    // Request permissions on mount
    requestPermissions();
  }, []);

  useEffect(() => {
    let interval;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        incrementDuration();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const { status } = await audioRecorder.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await audioRecorder.requestPermissionsAsync();
          setHasPermission(newStatus === 'granted');
        } else {
          setHasPermission(true);
        }
      } else {
        // iOS
        const { status } = await audioRecorder.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await audioRecorder.requestPermissionsAsync();
          setHasPermission(newStatus === 'granted');
        } else {
          setHasPermission(true);
        }
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasPermission(false);
    }
  };

  const handleStartSession = async () => {
    try {
      // Check permissions
      if (!hasPermission) {
        await requestPermissions();
        if (!hasPermission) {
          Alert.alert('Permission Denied', 'Microphone access is required');
          return;
        }
      }

      // Create session on backend
      const response = await api.createSession(['player_test'], 'dm_1');
      startSession(response.data.sessionId);

      // Start recording
      await audioRecorder.record();

      Alert.alert('Session Started! 🎲', 'Recording your D&D session. Tap "Process" to transcribe.');

    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert('Error', 'Failed to start session: ' + error.message);
    }
  };

  const processAudioChunk = async () => {
    if (!audioRecorder.isRecording) {
      Alert.alert('Not Recording', 'Please start a session first');
      return;
    }

    try {
      setIsProcessing(true);

      // Stop recording and get URI
      const uri = await audioRecorder.stop();

      if (!uri) {
        Alert.alert('Error', 'No audio recorded');
        return;
      }

      console.log('Audio recorded at:', uri);

      // Upload and transcribe
      const response = await api.uploadAudio(sessionId, { uri }, chunkCount);

      console.log('Server response:', response.data);

      // Add transcript
      if (response.data.transcript?.text) {
        appendTranscript(response.data.transcript.text);
        Alert.alert('Transcribed! 📝', response.data.transcript.text);
      } else {
        Alert.alert('No Speech Detected', 'Try speaking louder or closer to the microphone');
      }

      // Add events
      if (response.data.events && response.data.events.length > 0) {
        response.data.events.forEach(event => addEvent(event));
        Alert.alert('Events Found! ⚔️', `Detected ${response.data.events.length} events`);
      }

      setChunkCount(prev => prev + 1);

      // Start new recording
      await audioRecorder.record();

    } catch (error) {
      console.error('Failed to process chunk:', error);
      Alert.alert('Error', 'Failed to process audio: ' + error.message);
      
      // Try to restart recording
      try {
        if (!audioRecorder.isRecording) {
          await audioRecorder.record();
        }
      } catch (e) {
        console.error('Failed to restart recording:', e);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    try {
      // Stop recording if active
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }

      setIsProcessing(true);

      // End session on backend
      await api.endSession(sessionId);

      Alert.alert(
        'Session Complete! 🎉', 
        'Your D&D session has been processed. Summaries are pending DM approval.',
        [{ text: 'OK', onPress: () => clearSession() }]
      );

    } catch (error) {
      console.error('Failed to end session:', error);
      Alert.alert('Error', 'Failed to end session: ' + error.message);
    } finally {
      setIsProcessing(false);
      setChunkCount(0);
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium">🎲 D&D Session Recorder</Text>
            
            {!hasPermission && (
              <Text style={styles.warning}>
                ⚠️ Microphone permission required. Tap "Start Session" to grant access.
              </Text>
            )}
            
            {!isRecording && hasPermission && (
              <Text style={styles.instructions}>
                Tap "Start Session" to begin recording. Then tap "Process" periodically to transcribe and extract events.
              </Text>
            )}
            
            {isRecording && (
              <>
                <View style={styles.statusBar}>
                  <Chip icon="record" textStyle={{ color: 'white' }} style={{ backgroundColor: '#d32f2f' }}>
                    RECORDING
                  </Chip>
                  <Text variant="displaySmall">{formatDuration(recordingDuration)}</Text>
                </View>
                
                <Text style={styles.info}>📋 Session ID: ...{sessionId?.slice(-8)}</Text>
                <Text style={styles.info}>📦 Chunks processed: {chunkCount}</Text>
                <Text style={styles.info}>⚔️ Events detected: {events.length}</Text>
              </>
            )}
          </Card.Content>
        </Card>

        {transcript.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge">📝 Transcript</Text>
              <Text style={styles.transcript}>{transcript}</Text>
            </Card.Content>
          </Card>
        )}

        {events.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge">⚔️ Events ({events.length})</Text>
              {events.slice(-5).reverse().map((event, idx) => (
                <View key={idx} style={styles.event}>
                  <Chip icon="sword" style={styles.eventChip}>{event.type.toUpperCase()}</Chip>
                  <Text style={styles.eventText}>
                    <Text style={{ fontWeight: 'bold' }}>{event.actor}:</Text> {event.action}
                  </Text>
                  {event.metadata?.damage && (
                    <Text style={styles.damage}>💥 {event.metadata.damage} damage</Text>
                  )}
                  {event.metadata?.gold_value && (
                    <Text style={styles.gold}>💰 {event.metadata.gold_value} gold</Text>
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {!isRecording ? (
          <FAB
            icon="record"
            label="Start Session"
            onPress={handleStartSession}
            style={styles.fab}
          />
        ) : (
          <>
            <FAB
              icon="upload"
              label="Process"
              onPress={processAudioChunk}
              disabled={isProcessing}
              style={styles.fabSmall}
            />
            <FAB
              icon="stop"
              label="End"
              onPress={handleEndSession}
              disabled={isProcessing}
              style={styles.fabDanger}
            />
          </>
        )}
      </View>

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Processing audio...</Text>
          <Text style={styles.processingSubtext}>Transcribing speech and extracting D&D events...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1, padding: 16 },
  card: { marginBottom: 16, elevation: 2 },
  warning: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    color: '#e65100',
    fontSize: 14
  },
  instructions: {
    marginTop: 16,
    color: '#666',
    fontSize: 14,
    lineHeight: 20
  },
  statusBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginVertical: 16 
  },
  info: { marginTop: 8, fontSize: 14, color: '#333' },
  transcript: { 
    marginTop: 8, 
    padding: 12, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20
  },
  event: { 
    marginTop: 12, 
    padding: 12, 
    backgroundColor: '#f9f9f9', 
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee'
  },
  eventChip: { alignSelf: 'flex-start', marginBottom: 8 },
  eventText: { fontSize: 14, marginBottom: 4 },
  damage: { marginTop: 4, color: '#d32f2f', fontWeight: 'bold', fontSize: 14 },
  gold: { marginTop: 4, color: '#f57f17', fontWeight: 'bold', fontSize: 14 },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    padding: 16, 
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8
  },
  fab: { backgroundColor: '#6200ee' },
  fabSmall: { backgroundColor: '#6200ee', marginHorizontal: 4 },
  fabDanger: { backgroundColor: '#d32f2f', marginHorizontal: 4 },
  processingOverlay: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  processingText: { color: 'white', marginTop: 16, fontSize: 18, fontWeight: 'bold' },
  processingSubtext: { color: '#ccc', marginTop: 8, fontSize: 14 }
});
'@ | Out-File -Encoding UTF8 src/screens/SessionScreen.js