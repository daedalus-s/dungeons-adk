import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Text, ProgressBar, Chip } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useSessionStore } from '../stores/sessionStore';
import { RecordingControls } from '../components/RecordingControls';
import { EventTimeline } from '../components/EventTimeline';
import { apiClient } from '../services/api';

export default function SessionScreen() {
  const {
    sessionId,
    isRecording,
    events,
    startSession,
    stopSession,
    addEvent
  } = useSessionStore();

  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioChunks, setAudioChunks] = useState([]);

  const MAX_DURATION = 2 * 60 * 60 * 1000; // 2 hours
  const CHUNK_INTERVAL = 30 * 1000; // 30 seconds

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1000;
          if (newDuration >= MAX_DURATION) {
            handleStopSession();
          }
          return newDuration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Chunk audio every 30 seconds
  useEffect(() => {
    let chunkInterval;
    if (isRecording && recording) {
      chunkInterval = setInterval(async () => {
        await processAudioChunk();
      }, CHUNK_INTERVAL);
    }
    return () => clearInterval(chunkInterval);
  }, [isRecording, recording]);

  const handleStartSession = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission required');
        return;
      }

      // Create session on backend
      const response = await apiClient.post('/sessions', {
        players: [], // TODO: get from player selection
        dm_id: 'dm_1' // TODO: get from auth
      });

      startSession(response.data.sessionId);

      // Start recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setRecordingDuration(0);

    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session');
    }
  };

  const processAudioChunk = async () => {
    if (!recording) return;

    try {
      // Stop current recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Upload chunk
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: `chunk_${audioChunks.length}.m4a`
      });
      formData.append('chunkIndex', audioChunks.length.toString());

      const response = await apiClient.post(
        `/sessions/${sessionId}/audio`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      // Add transcript events
      if (response.data.transcript?.segments) {
        response.data.transcript.segments.forEach(segment => {
          addEvent({
            type: 'transcript',
            speaker: segment.speaker,
            text: segment.text,
            timestamp: segment.startTime
          });
        });
      }

      setAudioChunks(prev => [...prev, { uri, index: audioChunks.length }]);

      // Start new recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);

    } catch (error) {
      console.error('Failed to process chunk:', error);
    }
  };

  const handleStopSession = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }

      // End session on backend
      const response = await apiClient.post(`/sessions/${sessionId}/end`);

      stopSession(response.data);
      setRecording(null);
      setRecordingDuration(0);

      alert('Session ended! Summaries will be sent after DM approval.');

    } catch (error) {
      console.error('Failed to stop session:', error);
      alert('Failed to stop session');
    }
  };

  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium">D&D Session Recording</Text>

          {isRecording && (
            <>
              <View style={styles.durationContainer}>
                <Text variant="displaySmall">{formatDuration(recordingDuration)}</Text>
                <Chip icon="clock-outline">
                  {audioChunks.length} chunks processed
                </Chip>
              </View>
              <ProgressBar
                progress={recordingDuration / MAX_DURATION}
                color="#6200ee"
                style={styles.progressBar}
              />
            </>
          )}

          <RecordingControls
            isRecording={isRecording}
            onStart={handleStartSession}
            onStop={handleStopSession}
          />
        </Card.Content>
      </Card>

      {sessionId && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge">Session ID: {sessionId}</Text>
            <Text variant="bodyMedium">
              Events detected: {events.length}
            </Text>
          </Card.Content>
        </Card>
      )}

      {events.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge">Real-time Events</Text>
            <EventTimeline events={events} />
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  progressBar: {
    marginVertical: 8,
    height: 8,
    borderRadius: 4,
  },
});
