import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Text, Button, TextInput, Chip } from 'react-native-paper';
import { apiClient } from '../services/api';

export default function ApprovalQueue() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [comments, setComments] = useState({});

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setRefreshing(true);
      const response = await apiClient.get('/approvals/pending');
      setPendingRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await apiClient.post(`/approvals/${requestId}`, {
        dm_id: 'dm_1', // TODO: get from auth
        decision: 'approve',
        comment: comments[requestId] || ''
      });

      alert('Request approved! Sheets updated and messages sent.');
      fetchPendingRequests();
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Failed to approve request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      const comment = comments[requestId];
      if (!comment) {
        alert('Please provide a reason for rejection');
        return;
      }

      await apiClient.post(`/approvals/${requestId}`, {
        dm_id: 'dm_1',
        decision: 'reject',
        comment
      });

      alert('Request rejected.');
      fetchPendingRequests();
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject request');
    }
  };

  const renderSheetData = (payload) => {
    if (payload.rows) {
      // Gameplay log
      return (
        <View>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {payload.rows.length} rows to add
          </Text>
          {payload.rows.slice(0, 3).map((row, idx) => (
            <Text key={idx} variant="bodySmall">
              • {row.Item} ({row.Quantity}) - {row['Gold Value']} gp
            </Text>
          ))}
          {payload.rows.length > 3 && (
            <Text variant="bodySmall">... and {payload.rows.length - 3} more</Text>
          )}
        </View>
      );
    } else {
      // Player or inventory data
      return (
        <View>
          {Object.entries(payload).map(([key, value]) => (
            <Text key={key} variant="bodySmall">
              {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
            </Text>
          ))}
        </View>
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchPendingRequests} />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineMedium">Approval Queue</Text>
        <Chip icon="alert-circle">
          {pendingRequests.length} pending
        </Chip>
      </View>

      {pendingRequests.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyLarge">No pending requests</Text>
            <Text variant="bodyMedium">
              All Google Sheets write requests have been processed.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        pendingRequests.map((request) => (
          <Card key={request.id} style={styles.card}>
            <Card.Content>
              <View style={styles.requestHeader}>
                <Text variant="titleLarge">{request.target_sheet}</Text>
                <Chip mode="outlined">
                  {new Date(request.created_ts).toLocaleTimeString()}
                </Chip>
              </View>

              <Text variant="bodyMedium" style={styles.sessionId}>
                Session: {request.created_by}
              </Text>

              <View style={styles.dataPreview}>
                <Text variant="titleMedium">Data to write:</Text>
                {renderSheetData(request.payload)}
              </View>

              <TextInput
                label="Comment (optional for approval, required for rejection)"
                value={comments[request.id] || ''}
                onChangeText={(text) =>
                  setComments({ ...comments, [request.id]: text })
                }
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.commentInput}
              />

              <View style={styles.actions}>
                <Button
                  mode="contained"
                  onPress={() => handleApprove(request.id)}
                  style={styles.approveButton}
                  icon="check"
                >
                  Approve
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleReject(request.id)}
                  style={styles.rejectButton}
                  icon="close"
                >
                  Reject
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionId: {
    color: 'gray',
    marginBottom: 12,
  },
  dataPreview: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  subtitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  commentInput: {
    marginVertical: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  approveButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#4caf50',
  },
  rejectButton: {
    flex: 1,
    marginLeft: 8,
  },
});
