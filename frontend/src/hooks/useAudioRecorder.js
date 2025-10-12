import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for audio recording using Web Audio API
 * Optimized for speech transcription (16kHz mono when possible)
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Try to get 16kHz for speech transcription (browser may not support)
          sampleRate: 16000,
          channelCount: 1
        } 
      });

      streamRef.current = stream;

      // Check supported MIME types (prefer WebM/Opus for speech)
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to WebM
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          // Last resort - let browser choose
          mimeType = '';
        }
      }

      // Create MediaRecorder with optimized settings for speech
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000 // 64kbps is good for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message}`);
        setIsRecording(false);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      console.log('Recording started:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state
      });

    } catch (err) {
      console.error('Failed to start recording:', err);
      
      let errorMessage = 'Failed to access microphone';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is already in use by another application.';
      }
      
      setError(errorMessage);
      cleanup();
    }
  }, [cleanup]);

  /**
   * Stop recording and return the audio blob
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        console.warn('No active recording to stop');
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      // Handle stop event
      mediaRecorder.onstop = () => {
        try {
          // Create blob from recorded chunks
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          });

          console.log('Recording stopped:', {
            size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
            type: audioBlob.type,
            duration: `${duration}s`
          });

          // Cleanup
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          setIsRecording(false);
          setDuration(0);
          audioChunksRef.current = [];

          resolve(audioBlob);
        } catch (err) {
          console.error('Error creating audio blob:', err);
          reject(err);
        }
      };

      // Stop recording
      mediaRecorder.stop();
    });
  }, [duration]);

  /**
   * Pause recording (if supported by browser)
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  /**
   * Resume recording (if paused)
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  }, []);

  /**
   * Get current recording state
   */
  const getState = useCallback(() => {
    return mediaRecorderRef.current?.state || 'inactive';
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getState
  };
}